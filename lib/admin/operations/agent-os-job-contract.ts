import { z } from "zod";

export const AGENT_OS_JOB_SOURCES = [
  "admin",
  "shortcut",
  "schedule",
  "webhook",
  "n8n",
  "system",
] as const;

export const AGENT_OS_JOB_STATUSES = [
  "queued",
  "running",
  "waiting_external",
  "waiting_ai",
  "validating",
  "awaiting_review",
  "retrying",
  "completed",
  "failed",
  "reconciliation_required",
  "cancelled",
] as const;

export const AGENT_OS_QUEUE_CLASSES = [
  "realtime",
  "urgent",
  "normal",
  "batch",
] as const;

export const agentOsJobSourceSchema = z.enum(AGENT_OS_JOB_SOURCES);
export const agentOsJobStatusSchema = z.enum(AGENT_OS_JOB_STATUSES);
export const agentOsQueueClassSchema = z.enum(AGENT_OS_QUEUE_CLASSES);

const safeId = z.string().regex(/^[a-z0-9][a-z0-9._:-]{0,159}$/);
const optionalIso = z.string().datetime().nullable();

export const agentOsJobSchema = z.object({
  jobId: z.string().uuid(),
  correlationId: z.string().uuid(),
  requestId: z.string().uuid(),
  payloadDigestSha256: z.string().regex(/^[0-9a-f]{64}$/),
  source: agentOsJobSourceSchema,
  action: safeId,
  workflowKey: safeId,
  status: agentOsJobStatusSchema,
  stage: safeId,
  queueClass: agentOsQueueClassSchema,
  attempt: z.number().int().nonnegative(),
  maxAttempts: z.number().int().positive().max(20),
  createdAt: z.string().datetime(),
  queuedAt: optionalIso,
  startedAt: optionalIso,
  updatedAt: z.string().datetime(),
  completedAt: optionalIso,
  heartbeatAt: optionalIso,
  n8nExecutionId: z.string().max(160).nullable(),
  providerReference: z.string().max(200).nullable(),
  errorCategory: safeId.nullable(),
  durationMs: z.number().int().nonnegative().nullable(),
  queueWaitMs: z.number().int().nonnegative().nullable(),
}).strict();

export type AgentOsJob = z.infer<typeof agentOsJobSchema>;

export type RuntimeDurationBaseline = {
  sampleSize: number;
  p50Ms: number | null;
  p90Ms: number | null;
};

function percentile(sorted: number[], ratio: number) {
  if (!sorted.length) return null;
  const position = (sorted.length - 1) * ratio;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower] ?? null;
  const a = sorted[lower] ?? 0;
  const b = sorted[upper] ?? a;
  return Math.round(a + (b - a) * (position - lower));
}

export function runtimeDurationBaseline(values: number[]): RuntimeDurationBaseline {
  const sorted = values
    .filter((value) => Number.isFinite(value) && value >= 0)
    .map((value) => Math.round(value))
    .sort((a, b) => a - b);
  return {
    sampleSize: sorted.length,
    p50Ms: percentile(sorted, 0.5),
    p90Ms: percentile(sorted, 0.9),
  };
}

export type RuntimePace = "unknown" | "normal" | "slower_than_usual" | "heartbeat_stale";

export function classifyRuntimePace(input: {
  elapsedMs: number;
  heartbeatAgeMs: number | null;
  baseline: RuntimeDurationBaseline;
  staleHeartbeatMs?: number;
}): RuntimePace {
  const staleHeartbeatMs = input.staleHeartbeatMs ?? 60_000;
  if (input.heartbeatAgeMs != null && input.heartbeatAgeMs > staleHeartbeatMs) return "heartbeat_stale";
  if (input.baseline.sampleSize < 5 || input.baseline.p90Ms == null) return "unknown";
  return input.elapsedMs > input.baseline.p90Ms ? "slower_than_usual" : "normal";
}

export function jobIsTerminal(status: AgentOsJob["status"]) {
  return ["completed", "failed", "reconciliation_required", "cancelled"].includes(status);
}
