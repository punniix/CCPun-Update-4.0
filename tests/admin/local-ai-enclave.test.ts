import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { LOCAL_AI_MIGRATION_CHECKSUM } from "../../lib/admin/local-ai/foundation";
import {
  containsDirectPersonalIdentifier,
  expectedDataClass,
  parseLocalAiTaskInput,
  parseLocalAiTaskOutput,
} from "../../lib/local-ai/contracts";
import { createLocalAiPayloadCrypto, getLocalAiCryptoStatus } from "../../lib/local-ai/crypto";
import { isN8nLocalAiRequestAuthorized } from "../../lib/admin/local-ai/service-auth";

const root = path.resolve(import.meta.dirname, "../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

test("local AI envelopes are authenticated and task-bound", () => {
  const variables = {
    CCPUN_LOCAL_AI_ACTIVE_KEY_VERSION: "1",
    CCPUN_LOCAL_AI_ENCRYPTION_KEY_V1: Buffer.alloc(32, 7).toString("base64"),
  };
  assert.deepEqual(getLocalAiCryptoStatus(variables), { ready: true, activeKeyVersion: 1 });
  const crypto = createLocalAiPayloadCrypto(variables);
  const jobId = "018f2f2b-90ac-7a21-bd5a-252727b10d4b";
  const input = { locale: "th-TH", text: "สนใจประกันสุขภาพ", journey: "line_inbox" } as const;
  const encrypted = crypto.encrypt(jobId, "line-intent", input);
  assert.notEqual(encrypted.ciphertextB64, Buffer.from(JSON.stringify(input)).toString("base64"));
  assert.deepEqual(crypto.decrypt(jobId, "line-intent", encrypted), input);
  assert.throws(() => crypto.decrypt(jobId, "privacy-redaction", encrypted));
  assert.throws(() => createLocalAiPayloadCrypto({ ...variables, CCPUN_LOCAL_AI_ENCRYPTION_KEY_V1: "invalid" }));
});

test("private tasks have strict inputs and non-quoting outputs", () => {
  assert.equal(expectedDataClass("line-intent"), "customer-private");
  assert.equal(expectedDataClass("privacy-redaction"), "customer-private");
  assert.equal(expectedDataClass("seo-preprocessing"), "public-safe");
  assert.equal(parseLocalAiTaskInput("line-intent", { locale: "th-TH", text: "สนใจ", phone: "0812345678" }).success, false);
  assert.equal(parseLocalAiTaskOutput("line-intent", {
    intent: "health-insurance", urgency: "normal", needsHuman: true, confidence: 0.9,
    productTags: ["health"], reasonCodes: ["explicit-product"], customerQuote: "forbidden",
  }).success, false);
  assert.equal(containsDirectPersonalIdentifier("ติดต่อ 081-234-5678"), true);
  assert.equal(parseLocalAiTaskOutput("privacy-redaction", {
    redactedText: "ติดต่อ 081-234-5678", piiTypes: ["phone"], detectedCount: 1, reviewRequired: false,
  }).success, false);
  assert.equal(parseLocalAiTaskOutput("privacy-redaction", {
    redactedText: "ติดต่อ [PHONE]", piiTypes: ["phone"], detectedCount: 1, reviewRequired: false,
  }).success, true);
});

test("UAT and Production migrations have capability parity and a canonical checksum", () => {
  const uat = read("db/migrations/20260919_local_ai_control_plane_v1_uat.sql");
  const production = read("db/migrations/20260919_local_ai_control_plane_v1_production.sql");
  const normalize = (source: string) => source
    .replace("true,'uat','young-term-47483330','br-crimson-mouse-az7ajkv8','ep-mute-frost-aztvz394','neondb',", "true,'<lane>','<project>','<branch>','<endpoint>','neondb',")
    .replace("true,'production','lively-bar-43618798','br-long-resonance-b3ys5xrv','ep-broad-butterfly-b3ro7u8w','neondb',", "true,'<lane>','<project>','<branch>','<endpoint>','neondb',")
    .replaceAll(/sha256:[a-f0-9]{64}/g, "sha256:<checksum>")
    .trimEnd() + "\n";
  assert.equal(normalize(uat), normalize(production));
  assert.equal(`sha256:${createHash("sha256").update(normalize(uat)).digest("hex")}`, LOCAL_AI_MIGRATION_CHECKSUM);
  for (const source of [uat, production]) {
    assert.match(source, /CREATE ROLE ccpun_local_ai_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS/);
    assert.match(source, /REVOKE ALL PRIVILEGES ON ccpun_admin\.local_ai_identity,ccpun_admin\.local_ai_job/);
    assert.doesNotMatch(source, /GRANT (?:SELECT|INSERT|UPDATE|DELETE) ON (?:TABLE )?ccpun_admin\.local_ai_job TO ccpun_local_ai_runtime/i);
    assert.match(source, /worker_claim_local_ai_job\(text,text,integer,boolean\)[\s\S]*TO ccpun_local_ai_runtime/);
  }
});

test("worker and compose preserve the private model boundary", () => {
  const worker = read("workers/local-ai/src/index.ts");
  const compose = read("workers/local-ai/docker-compose.yml");
  assert.match(worker, /hostname !== "ollama"/);
  assert.match(worker, /MODEL_ALLOWLIST = new Set\(\["qwen3:1\.7b"\]\)/);
  assert.match(worker, /CCPUN_LOCAL_AI_PRIVATE_JOBS_ENABLED/);
  assert.doesNotMatch(worker, /console\.(?:log|info|warn|error|debug)/);
  assert.doesNotMatch(compose, /ports:/);
  assert.match(compose, /model_private:\n\s+internal: true/);
  assert.match(compose, /OLLAMA_NUM_PARALLEL: "1"/);
  assert.match(compose, /read_only: true/);
});

test("Admin read model never selects encrypted envelope fields", () => {
  const database = read("lib/admin/local-ai/database.ts");
  const page = read("features/admin/operations/LocalAiPage.tsx");
  assert.doesNotMatch(database, /SELECT[^\n]*(?:ciphertext_b64|nonce_b64|auth_tag_b64)/i);
  assert.doesNotMatch(page, /job\.output/);
  assert.match(page, /ไม่แสดงข้อความต้นฉบับ กุญแจ หรือข้อมูลส่วนตัวของลูกค้า/);
  assert.doesNotMatch(page, />Control plane<|>Private worker<|>Queue \/ Active<|>Recent Local AI jobs</);
});

test("n8n bridge is token-gated and can enqueue only public-safe tasks", () => {
  const token = "x".repeat(48);
  const request = new Request("https://admin.ccpun.com/api/internal/local-ai/jobs/", { headers: { authorization: `Bearer ${token}` } });
  assert.equal(isN8nLocalAiRequestAuthorized(request, { CCPUN_LOCAL_AI_N8N_ENABLED: "false", CCPUN_LOCAL_AI_N8N_TOKEN: token }), false);
  assert.equal(isN8nLocalAiRequestAuthorized(request, { CCPUN_LOCAL_AI_N8N_ENABLED: "true", CCPUN_LOCAL_AI_N8N_TOKEN: token }), true);
  assert.equal(isN8nLocalAiRequestAuthorized(new Request(request.url, { headers: { authorization: "Bearer wrong" } }), { CCPUN_LOCAL_AI_N8N_ENABLED: "true", CCPUN_LOCAL_AI_N8N_TOKEN: token }), false);
  const enqueueRoute = read("apps/admin/app/api/internal/local-ai/jobs/route.ts");
  assert.match(enqueueRoute, /z\.literal\("content-operations"\)/);
  assert.match(enqueueRoute, /z\.literal\("seo-preprocessing"\)/);
  assert.doesNotMatch(enqueueRoute, /z\.literal\("(?:line-intent|privacy-redaction)"\)/);
  const resultRoute = read("apps/admin/app/api/internal/local-ai/jobs/[jobId]/route.ts");
  assert.match(resultRoute, /job\.status === "succeeded" \? job\.output : null/);
});
