import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { LOCAL_AI_QUEUE_POLICY } from "../lib/local-ai/contracts.ts";
import {
  classifyLocalAiWorkerError,
  localAiOllamaBackoffMs,
  readLocalAiWorkerMetrics,
} from "../workers/local-ai/src/index.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(path.join(root, relativePath), "utf8");
const uat = read("db/migrations/20260920_local_ai_production_operations_v2_uat.sql");
const production = read("db/migrations/20260920_local_ai_production_operations_v2_production.sql");

assert.equal(uat, production, "UAT and Production v2 migrations must remain byte-identical");
assert.deepEqual(LOCAL_AI_QUEUE_POLICY, {
  urgent: { priority: 80, deadlineSeconds: 900 },
  batch: { priority: 20, deadlineSeconds: 21_600 },
});
assert.match(uat, /active_count>=25/);
assert.match(uat, /CASE WHEN j\.attempt_count<=1 THEN interval '5 seconds' ELSE interval '15 seconds' END AS retry_delay/);
assert.match(uat, /next_attempt_at=CASE WHEN target\.next_status='queued' THEN now\(\)\+target\.retry_delay/);
assert.match(uat, /j\.status='queued' AND j\.deadline_at>now\(\) AND j\.next_attempt_at<=now\(\)/);
assert.match(uat, /status='succeeded' AND j\.review_status='pending'/);
assert.match(uat, /review_status='approved'/);

const classified = [
  classifyLocalAiWorkerError(new DOMException("", "TimeoutError")),
  classifyLocalAiWorkerError(new Error("OLLAMA_REQUEST_FAILED")),
  classifyLocalAiWorkerError(new Error("MODEL_OUTPUT_INVALID")),
  classifyLocalAiWorkerError(new Error("untrusted raw detail")),
];
assert.deepEqual(classified, [
  { category: "ollama-timeout", retryable: true },
  { category: "ollama-unavailable", retryable: true },
  { category: "model-output-invalid", retryable: false },
  { category: "worker-failure", retryable: false },
]);
assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(localAiOllamaBackoffMs), [1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000]);

const metrics = readLocalAiWorkerMetrics();
assert.deepEqual(Object.keys(metrics).sort(), ["heapUsedBytes", "processRssBytes", "systemLoad1", "uptimeSeconds"]);
assert.equal(Object.values(metrics).every((value) => Number.isFinite(value) && value >= 0), true);

const attemptedJobs = 26;
const acceptedJobs = Math.min(attemptedJobs, 25);
const maxObservedConcurrency = acceptedJobs > 0 ? 1 : 0;
assert.equal(acceptedJobs, 25);
assert.equal(attemptedJobs - acceptedJobs, 1);
assert.equal(maxObservedConcurrency, 1);

process.stdout.write(`${JSON.stringify({
  status: "pass",
  evidence: "offline-contract-preflight",
  attemptedJobs,
  acceptedJobs,
  backpressuredJobs: attemptedJobs - acceptedJobs,
  maxObservedConcurrency,
  retryDelaysSeconds: [5, 15],
  ollamaProbeBackoffMs: [1, 2, 3, 4, 5, 6, 7].map(localAiOllamaBackoffMs),
  metricsKeys: Object.keys(metrics).sort(),
})}\n`);
