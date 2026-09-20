import { createHash, randomBytes } from "node:crypto";
import { loadavg } from "node:os";
import { pathToFileURL } from "node:url";
import { neon } from "@neondatabase/serverless";
import { z } from "zod";
import {
  localAiTaskOutputSchemas,
  parseLocalAiTaskInput,
  parseLocalAiTaskResult,
  type LocalAiTaskType,
} from "../../../lib/local-ai/contracts";
import { createLocalAiPayloadCrypto } from "../../../lib/local-ai/crypto";

const RUNTIME_VERSION = "local-ai-worker-v1";
const MODEL_ALLOWLIST = new Set(["qwen3:1.7b"]);
const laneSchema = z.enum(["uat", "production"]);
const claimSchema = z.object({
  job_id: z.string().uuid(), task_type: z.enum(["privacy-redaction", "line-intent", "content-operations", "seo-preprocessing"]),
  data_class: z.enum(["public-safe", "customer-private"]), schema_version: z.literal("local-ai-contract-v1"),
  ciphertext_b64: z.string(), nonce_b64: z.string(), auth_tag_b64: z.string(), key_version: z.literal(1),
  attempt_count: z.coerce.number().int(), max_attempts: z.coerce.number().int(),
});

const LANE_IDENTITIES = {
  uat: { projectId: "young-term-47483330", branchId: "br-crimson-mouse-az7ajkv8", endpointId: "ep-mute-frost-aztvz394", hostSuffix: "c-3.ap-southeast-1.aws.neon.tech" },
  production: { projectId: "lively-bar-43618798", branchId: "br-long-resonance-b3ys5xrv", endpointId: "ep-broad-butterfly-b3ro7u8w", hostSuffix: "c-4.ap-southeast-1.aws.neon.tech" },
} as const;

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`CONFIG_${name}_MISSING`);
  return value;
}

function loadConfiguration() {
  const lane = laneSchema.parse(required("CCPUN_LOCAL_AI_LANE"));
  const identity = LANE_IDENTITIES[lane];
  if (required("CCPUN_NEON_PROJECT_ID") !== identity.projectId || required("CCPUN_NEON_BRANCH_ID") !== identity.branchId) {
    throw new Error("CONFIG_DATABASE_IDENTITY_MISMATCH");
  }
  const databaseUrl = new URL(required("CCPUN_LOCAL_AI_DATABASE_URL"));
  const allowedHosts = new Set([`${identity.endpointId}.${identity.hostSuffix}`, `${identity.endpointId}-pooler.${identity.hostSuffix}`]);
  if (databaseUrl.protocol !== "postgresql:" || !allowedHosts.has(databaseUrl.hostname) || decodeURIComponent(databaseUrl.username) !== "ccpun_local_ai_runtime"
    || decodeURIComponent(databaseUrl.pathname.slice(1)) !== "neondb" || databaseUrl.searchParams.get("sslmode") !== "require" || !databaseUrl.password) {
    throw new Error("CONFIG_DATABASE_URL_DENIED");
  }
  const ollamaBaseUrl = new URL(required("OLLAMA_BASE_URL"));
  if (ollamaBaseUrl.protocol !== "http:" || ollamaBaseUrl.hostname !== "ollama" || ollamaBaseUrl.port !== "11434" || ollamaBaseUrl.pathname !== "/") {
    throw new Error("CONFIG_OLLAMA_BOUNDARY_DENIED");
  }
  const model = required("OLLAMA_MODEL");
  if (!MODEL_ALLOWLIST.has(model)) throw new Error("CONFIG_MODEL_DENIED");
  if (process.env.CCPUN_LOCAL_AI_PRIVATE_JOBS_ENABLED?.trim() === "true") {
    throw new Error("CONFIG_PRIVATE_JOBS_DISABLED");
  }
  return {
    lane, databaseUrl: databaseUrl.toString(), ollamaBaseUrl: ollamaBaseUrl.toString(), model,
    workerDigest: createHash("sha256").update(required("CCPUN_LOCAL_AI_WORKER_ID")).digest("hex"),
    privateJobsEnabled: false as const,
  };
}

const instructions: Record<LocalAiTaskType, string> = {
  "privacy-redaction": "Replace every direct or sensitive identifier with typed placeholders such as [PHONE], [EMAIL], [PERSON], [ADDRESS], [POLICY_NUMBER], [HEALTH_DETAIL]. Preserve meaning but never copy an identifier into any output field.",
  "line-intent": "Classify intent for routing. Never reproduce, summarize, quote, or explain the customer text. Return only enum values, booleans, numeric confidence, productTags, and reasonCodes allowed by the schema.",
  "content-operations": "Classify and preprocess this public editorial draft. Do not invent claims. Return category, tags, a slug, excerpt, concise FAQ candidates, and reviewRequired=true.",
  "seo-preprocessing": "Cluster these public-safe search queries by intent and likely owner page. Input queries are objects; output queries must contain only their exact query text as strings, never objects. Preserve every query string exactly once. Return exactly one JSON object with only this shape: {\"clusters\":[{\"label\":\"short label\",\"intent\":\"informational|commercial|transactional|navigational|mixed\",\"queries\":[\"exact input query\"],\"ownerCandidate\":\"/existing-input-page-or-null\",\"reviewRequired\":true}]}. ownerCandidate must copy an input page beginning with / or be null; use null when uncertain. Do not add keys or prose.",
};

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function safeLog(event: string, fields: Record<string, string | number | boolean | null> = {}) {
  process.stdout.write(`${JSON.stringify({ event, ...fields, at: new Date().toISOString() })}\n`);
}

export function readLocalAiWorkerMetrics() {
  const memory = process.memoryUsage();
  return {
    processRssBytes: memory.rss,
    heapUsedBytes: memory.heapUsed,
    systemLoad1: loadavg()[0] ?? 0,
    uptimeSeconds: Math.floor(process.uptime()),
  };
}

export function localAiOllamaBackoffMs(consecutiveFailures: number) {
  return Math.min(30_000, 1_000 * (2 ** Math.max(0, Math.min(consecutiveFailures - 1, 5))));
}

export function classifyLocalAiWorkerError(error: unknown) {
  if (error instanceof DOMException && ["AbortError", "TimeoutError"].includes(error.name)) {
    return { category: "ollama-timeout" as const, retryable: true };
  }
  const code = error instanceof Error ? error.message : "";
  if (code === "OLLAMA_REQUEST_FAILED") return { category: "ollama-unavailable" as const, retryable: true };
  if (code === "LEASE_COMPLETION_REJECTED") return { category: "lease-completion-rejected" as const, retryable: true };
  if (["MODEL_JSON_INVALID", "MODEL_OUTPUT_INVALID"].includes(code)) return { category: "model-output-invalid" as const, retryable: false };
  return { category: "worker-failure" as const, retryable: false };
}

async function ollamaReady(baseUrl: string, configuredModel: string) {
  try {
    const response = await fetch(new URL("api/tags", baseUrl), { signal: AbortSignal.timeout(3_000) });
    if (!response.ok) return false;
    const body = z.object({ models: z.array(z.object({ name: z.string(), model: z.string().optional() })) }).safeParse(await response.json());
    return body.success && body.data.models.some(({ name, model }) => name === configuredModel || model === configuredModel);
  } catch { return false; }
}

async function infer(baseUrl: string, model: string, taskType: LocalAiTaskType, payload: unknown) {
  const response = await fetch(new URL("api/chat", baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(90_000),
    body: JSON.stringify({
      model, stream: false, think: false, format: z.toJSONSchema(localAiTaskOutputSchemas[taskType]), keep_alive: "5m",
      options: { temperature: 0, num_ctx: 4096 },
      messages: [
        { role: "system", content: `You are a private offline CCPun processor. ${instructions[taskType]} Output one JSON object only.` },
        { role: "user", content: JSON.stringify(payload) },
      ],
    }),
  });
  if (!response.ok) throw new Error("OLLAMA_REQUEST_FAILED");
  const body = z.object({ message: z.object({ content: z.string().min(2).max(50_000) }) }).parse(await response.json());
  try { return JSON.parse(body.message.content) as unknown; }
  catch { throw new Error("MODEL_JSON_INVALID"); }
}

async function main() {
  const config = loadConfiguration();
  const crypto = createLocalAiPayloadCrypto();
  const sql = neon(config.databaseUrl, { fetchOptions: { signal: AbortSignal.timeout(10_000) } });
  let active = 0;
  let stopped = false;
  process.on("SIGTERM", () => { stopped = true; });
  process.on("SIGINT", () => { stopped = true; });

  const heartbeat = async (ready: boolean) => {
    await sql.query("SELECT ccpun_admin.worker_report_local_ai_heartbeat($1,$2,$3,$4,$5,$6,$7::jsonb)", [
      config.workerDigest,RUNTIME_VERSION,config.model,ready,config.privateJobsEnabled,active,
      JSON.stringify(readLocalAiWorkerMetrics()),
    ]);
  };

  safeLog("worker-started", { lane: config.lane, model: config.model, privateJobsEnabled: config.privateJobsEnabled });
  let lastHeartbeat = 0;
  let ollamaReadyState = false;
  let ollamaFailures = 0;
  let nextOllamaProbeAt = 0;
  while (!stopped) {
    try {
      if (Date.now() >= nextOllamaProbeAt) {
        ollamaReadyState = await ollamaReady(config.ollamaBaseUrl, config.model);
        ollamaFailures = ollamaReadyState ? 0 : ollamaFailures + 1;
        nextOllamaProbeAt = Date.now() + (ollamaReadyState ? 5_000 : localAiOllamaBackoffMs(ollamaFailures));
      }
      if (Date.now() - lastHeartbeat > 30_000 || lastHeartbeat === 0) {
        await heartbeat(ollamaReadyState);
        lastHeartbeat = Date.now();
      }
      if (!ollamaReadyState) {
        await new Promise((resolve) => setTimeout(resolve, Math.min(localAiOllamaBackoffMs(ollamaFailures), 5_000)));
        continue;
      }
      const leaseToken = randomBytes(32).toString("hex");
      const leaseDigest = sha256(leaseToken);
      const rows = await sql.query("SELECT * FROM ccpun_admin.worker_claim_local_ai_job($1,$2,$3,$4)", [config.workerDigest,leaseDigest,180,config.privateJobsEnabled]);
      if (!rows[0]) { await new Promise((resolve) => setTimeout(resolve, 2_000)); continue; }
      const job = claimSchema.parse(rows[0]);
      active = 1;
      try {
        if (job.data_class === "customer-private" && !config.privateJobsEnabled) throw new Error("PRIVATE_JOBS_DISABLED");
        const decrypted = crypto.decrypt(job.job_id, job.task_type, {
          keyVersion: job.key_version, ciphertextB64: job.ciphertext_b64, nonceB64: job.nonce_b64, authTagB64: job.auth_tag_b64,
        });
        const input = parseLocalAiTaskInput(job.task_type, decrypted);
        if (!input.success) throw new Error("DECRYPTED_INPUT_INVALID");
        const rawOutput = await infer(config.ollamaBaseUrl, config.model, job.task_type, input.data);
        const output = parseLocalAiTaskResult(job.task_type, input.data, rawOutput);
        if (!output.success) {
          safeLog("model-output-rejected", { jobId: job.job_id, taskType: job.task_type, issues: output.error.issues.slice(0, 12).map(({ code, path }) => `${path.join(".")}:${code}`).join(",") });
          throw new Error("MODEL_OUTPUT_INVALID");
        }
        const serialized = JSON.stringify(output.data);
        const completed = await sql.query("SELECT ccpun_admin.worker_complete_local_ai_job($1,$2,$3,$4::jsonb,$5) AS completed", [
          job.job_id,leaseDigest,config.model,serialized,sha256(serialized),
        ]) as Array<{ completed: boolean }>;
        if (!completed[0]?.completed) throw new Error("LEASE_COMPLETION_REJECTED");
        safeLog("job-succeeded", { jobId: job.job_id, taskType: job.task_type });
      } catch (error) {
        const { category, retryable } = classifyLocalAiWorkerError(error);
        if (["ollama-timeout", "ollama-unavailable"].includes(category)) {
          ollamaReadyState = false;
          ollamaFailures += 1;
          nextOllamaProbeAt = Date.now() + localAiOllamaBackoffMs(ollamaFailures);
        }
        await sql.query("SELECT ccpun_admin.worker_fail_local_ai_job($1,$2,$3,$4,$5) AS status", [job.job_id,leaseDigest,category,retryable,false]);
        safeLog("job-failed", { jobId: job.job_id, taskType: job.task_type, category, retryable });
      } finally { active = 0; }
    } catch (error) {
      safeLog("worker-cycle-failed", { category: classifyLocalAiWorkerError(error).category });
      await new Promise((resolve) => setTimeout(resolve, 5_000));
    }
  }
  try { await heartbeat(ollamaReadyState); } catch { /* shutdown remains best effort */ }
  safeLog("worker-stopped");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    safeLog("worker-fatal", { category: classifyLocalAiWorkerError(error).category });
    process.exitCode = 1;
  });
}
