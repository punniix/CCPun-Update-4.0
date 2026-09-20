import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  LOCAL_AI_QUEUE_POLICY,
  parseLocalAiTaskResult,
} from "../../lib/local-ai/contracts";
import { createLocalAiRequestFingerprint } from "../../lib/local-ai/crypto";
import {
  classifyLocalAiWorkerError,
  localAiOllamaBackoffMs,
  readLocalAiWorkerMetrics,
} from "../../workers/local-ai/src/index";

const root = path.resolve(import.meta.dirname, "../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

const contentInput = {
  locale: "th-TH",
  title: "วางแผนประกันสุขภาพ",
  body: "เนื้อหาสาธารณะสำหรับทดสอบระบบ",
  canonicalPath: "/blog/health-planning/",
  allowedCategories: ["health-insurance", "financial-planning"],
} as const;

const contentOutput = {
  category: "health-insurance",
  tags: ["health"],
  slugSuggestion: "health-planning",
  excerpt: "สรุปเนื้อหาสำหรับให้คนตรวจ",
  faqCandidates: [],
  reviewRequired: true,
} as const;

const seoInput = {
  locale: "th-TH",
  queries: [
    { query: "ประกันสุขภาพ", page: "/blog/health-insurance/" },
    { query: "วางแผนค่ารักษา", page: null },
  ],
} as const;

const seoOutput = {
  clusters: [{
    label: "การวางแผนสุขภาพ",
    intent: "informational",
    queries: ["ประกันสุขภาพ", "วางแผนค่ารักษา"],
    ownerCandidate: "/blog/health-insurance/",
    reviewRequired: true,
  }],
} as const;

test("queue classes have fixed priority bands and bounded deadlines", () => {
  assert.equal(LOCAL_AI_QUEUE_POLICY.urgent.priority, 80);
  assert.equal(LOCAL_AI_QUEUE_POLICY.urgent.deadlineSeconds, 900);
  assert.equal(LOCAL_AI_QUEUE_POLICY.batch.priority, 20);
  assert.equal(LOCAL_AI_QUEUE_POLICY.batch.deadlineSeconds, 21_600);
  assert.ok(LOCAL_AI_QUEUE_POLICY.urgent.priority > LOCAL_AI_QUEUE_POLICY.batch.priority);
});

test("model output is bound to its input and always requires human review", () => {
  assert.equal(parseLocalAiTaskResult("content-operations", contentInput, contentOutput).success, true);
  assert.equal(parseLocalAiTaskResult("content-operations", contentInput, {
    ...contentOutput,
    category: "invented-category",
  }).success, false);
  assert.equal(parseLocalAiTaskResult("content-operations", contentInput, {
    ...contentOutput,
    reviewRequired: false,
  }).success, false);

  assert.equal(parseLocalAiTaskResult("seo-preprocessing", seoInput, seoOutput).success, true);
  assert.equal(parseLocalAiTaskResult("seo-preprocessing", seoInput, {
    clusters: [{ ...seoOutput.clusters[0], queries: ["ประกันสุขภาพ", "ประกันสุขภาพ"] }],
  }).success, false);
  assert.equal(parseLocalAiTaskResult("seo-preprocessing", seoInput, {
    clusters: [{ ...seoOutput.clusters[0], queries: ["ประกันสุขภาพ", "คำที่ไม่มีใน input"] }],
  }).success, false);
  assert.equal(parseLocalAiTaskResult("seo-preprocessing", seoInput, {
    clusters: [{ ...seoOutput.clusters[0], ownerCandidate: "/invented-page/" }],
  }).success, false);
  assert.equal(parseLocalAiTaskResult("seo-preprocessing", seoInput, {
    clusters: [{ ...seoOutput.clusters[0], reviewRequired: false }],
  }).success, false);
});

test("idempotency fingerprint is canonical and payload-bound", () => {
  const reordered = {
    allowedCategories: [...contentInput.allowedCategories],
    canonicalPath: contentInput.canonicalPath,
    body: contentInput.body,
    title: contentInput.title,
    locale: contentInput.locale,
  } as const;
  const fingerprint = createLocalAiRequestFingerprint("content-operations", contentInput);
  assert.match(fingerprint, /^[a-f0-9]{64}$/);
  assert.equal(fingerprint, createLocalAiRequestFingerprint("content-operations", reordered));
  assert.notEqual(fingerprint, createLocalAiRequestFingerprint("content-operations", {
    ...contentInput,
    body: "เนื้อหาอีกฉบับ",
  }));
});

test("worker errors use a bounded allowlist and never preserve raw messages", () => {
  const allowed = new Set([
    "ollama-timeout",
    "ollama-unavailable",
    "lease-completion-rejected",
    "model-output-invalid",
    "worker-failure",
  ]);
  const cases = [
    classifyLocalAiWorkerError(new DOMException("sentinel-private-prompt", "TimeoutError")),
    classifyLocalAiWorkerError(new Error("OLLAMA_REQUEST_FAILED")),
    classifyLocalAiWorkerError(new Error("LEASE_COMPLETION_REJECTED")),
    classifyLocalAiWorkerError(new Error("MODEL_OUTPUT_INVALID")),
    classifyLocalAiWorkerError(new Error("sentinel-private-prompt")),
  ];
  for (const result of cases) {
    assert.equal(allowed.has(result.category), true);
    assert.doesNotMatch(JSON.stringify(result), /sentinel-private-prompt/);
  }
  assert.deepEqual(cases.map(({ retryable }) => retryable), [true, true, true, false, false]);

  const backoffs = Array.from({ length: 12 }, (_, index) => localAiOllamaBackoffMs(index + 1));
  assert.equal(backoffs.every((value) => Number.isInteger(value) && value >= 1_000 && value <= 60_000), true);
  assert.equal(backoffs.every((value, index) => index === 0 || value >= backoffs[index - 1]!), true);
});

test("worker proves Ollama readiness before claim and does not log raw errors", () => {
  const worker = read("workers/local-ai/src/index.ts");
  const loop = worker.indexOf("while (!stopped)");
  const claim = worker.indexOf("worker_claim_local_ai_job", loop);
  const readinessProbe = worker.indexOf("ollamaReady", loop);
  const readinessGuard = worker.indexOf("if (!ollamaReadyState)", loop);
  assert.ok(loop >= 0 && readinessProbe > loop && readinessGuard > readinessProbe && readinessGuard < claim);
  assert.match(worker, /body\.data\.models\.some\(/);
  assert.match(worker, /ollamaReady\(config\.ollamaBaseUrl,\s*config\.model\)/);
  assert.match(worker, /classifyLocalAiWorkerError\(/);
  assert.doesNotMatch(worker, /safeLog\([^;]*(?:error\.message|\(error as Error\)\.message)/);
  assert.doesNotMatch(worker, /category\s*:\s*(?:error\.message|\(error as Error\)\.message)/);
  assert.doesNotMatch(worker, /safeLog\([^;]*(?:JSON\.stringify\((?:payload|input|rawOutput|output\.data)|rawOutput|ciphertextB64|authTagB64)/i);
});

test("v2 queue migration enforces payload replay, cap, deadlines, and review state", () => {
  const files = [
    "db/migrations/20260920_local_ai_production_operations_v2_uat.sql",
    "db/migrations/20260920_local_ai_production_operations_v2_production.sql",
  ];
  for (const file of files) {
    const migration = read(file);
    assert.match(migration, /request_fingerprint/);
    assert.match(migration, /queue_class/);
    assert.match(migration, /deadline_at/);
    assert.match(migration, /next_attempt_at/);
    assert.match(migration, /review_status/);
    assert.match(migration, /idempotency-conflict/);
    assert.match(migration, /backpressure/);
    assert.match(migration, /(?:queued[\s\S]{0,120}leased|leased[\s\S]{0,120}queued)[\s\S]{0,240}(?:<\s*25|>=\s*25)/i);
    assert.match(migration, /'urgent'[\s\S]{0,160}\b80\b/);
    assert.match(migration, /'batch'[\s\S]{0,160}\b20\b/);
    assert.match(migration, /review_status[\s\S]{0,160}'pending'/);
    assert.match(migration, /min\(created_at\) FILTER \(WHERE status='queued'\)/);
    assert.doesNotMatch(migration, /EXTRACT\([^)]*min\(created_at\)\) FILTER/);
    assert.doesNotMatch(migration, /review_status\s*=\s*'approved'[\s\S]{0,120}WHERE\s+review_status\s+IS\s+NULL/i);
  }

  for (const file of files.map((file) => file.replace(/\.sql$/, "_readback.sql"))) {
    const readback = read(file);
    assert.match(readback, /request_fingerprint/);
    assert.match(readback, /review_status/);
    assert.match(readback, /queue_class/);
    assert.match(readback, /worker_table_denied|worker.*denied/i);
  }
});

test("bridge hides output before owner review and Local AI routes cannot publish", () => {
  const enqueueRoute = read("apps/admin/app/api/internal/local-ai/jobs/route.ts");
  const statusRoute = read("apps/admin/app/api/internal/local-ai/reviews/route.ts");
  const reviewRoute = read("apps/admin/app/api/admin/local-ai/review/route.ts");
  const database = read("lib/admin/local-ai/database.ts");

  assert.match(enqueueRoute, /queueClass/);
  assert.doesNotMatch(enqueueRoute, /\bpriority\s*:/);
  assert.match(statusRoute, /reviewStatus/);
  assert.match(statusRoute, /approved/);
  assert.match(database, /row\.status\s*===\s*"succeeded"\s*&&\s*row\.review_status\s*===\s*"approved"/);
  assert.match(reviewRoute, /getAdminIdentity/);
  assert.match(reviewRoute, /evaluateAdminAction/);
  assert.match(reviewRoute, /if \(!policy\.allowed\)/);
  assert.match(reviewRoute, /reviewLocalAiJob/);

  const routeSurface = `${enqueueRoute}\n${statusRoute}\n${reviewRoute}`;
  assert.doesNotMatch(routeSurface, /publish(?:Article|Post|Content)|applySuggestion|dispatch|sanity\.patch|sanity\.create/i);
});

test("monitoring is metadata-only and private processing remains hard-disabled", () => {
  const metrics = readLocalAiWorkerMetrics();
  assert.deepEqual(Object.keys(metrics).sort(), [
    "heapUsedBytes",
    "processRssBytes",
    "systemLoad1",
    "uptimeSeconds",
  ]);
  assert.equal(Object.values(metrics).every((value) => Number.isFinite(value) && value >= 0), true);
  assert.doesNotMatch(JSON.stringify(metrics), /prompt|payload|output|text|cipher|key|token/i);

  const healthRoute = read("apps/admin/app/api/internal/local-ai/operations/health/route.ts");
  const incidentsRoute = read("apps/admin/app/api/internal/local-ai/operations/incidents/route.ts");
  assert.doesNotMatch(`${healthRoute}\n${incidentsRoute}`, /ciphertext|authTag|nonce|prompt|payload|output_json|redactedText/i);

  const compose = read("workers/local-ai/docker-compose.yml");
  const worker = read("workers/local-ai/src/index.ts");
  assert.match(compose, /CCPUN_LOCAL_AI_PRIVATE_JOBS_ENABLED:\s*"false"/);
  assert.doesNotMatch(compose, /ports:/);
  assert.match(compose, /model_private:\n\s+internal:\s+true/);
  assert.match(compose, /OLLAMA_NUM_PARALLEL:\s*"1"/);
  assert.match(worker, /allowedHosts\.has\(databaseUrl\.hostname\)/);
  assert.match(worker, /hostname !== "ollama"/);

  const enqueueRoute = read("apps/admin/app/api/internal/local-ai/jobs/route.ts");
  assert.doesNotMatch(enqueueRoute, /z\.literal\("(?:line-intent|privacy-redaction)"\)/);
});
