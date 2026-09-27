import "server-only";

import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { z } from "zod";

import {
  agentOsJobSchema,
  runtimeDurationBaseline,
  type AgentOsJob,
} from "./agent-os-job-contract";
import {
  adminOperationsRuntimeInputFromEnvironment,
  resolveAdminOperationsRuntimeIdentity,
} from "./foundation";

const createResultSchema = z.object({
  outcome: z.enum(["created", "duplicate", "idempotency_conflict"]),
  job_id: z.string().uuid(),
  correlation_id: z.string().uuid(),
  request_id: z.string().uuid(),
  row_version: z.coerce.number().int().positive(),
});

const updateResultSchema = z.object({
  outcome: z.enum(["updated", "conflict", "not_found", "terminal"]),
  row_version: z.coerce.number().int().positive().nullable(),
});

const eventRowSchema = z.object({
  event_id: z.string().uuid(),
  job_id: z.string().uuid(),
  row_version: z.coerce.number().int().positive(),
  status: agentOsJobSchema.shape.status,
  stage: agentOsJobSchema.shape.stage,
  attempt: z.coerce.number().int().nonnegative(),
  error_category: z.string().nullable(),
  occurred_at: z.union([z.string(), z.date()]),
});

const dbJobSchema = z.object({
  job_id: z.string().uuid(),
  correlation_id: z.string().uuid(),
  request_id: z.string().uuid(),
  payload_digest_sha256: z.string().regex(/^[0-9a-f]{64}$/),
  source: agentOsJobSchema.shape.source,
  action: agentOsJobSchema.shape.action,
  workflow_key: agentOsJobSchema.shape.workflowKey,
  status: agentOsJobSchema.shape.status,
  stage: agentOsJobSchema.shape.stage,
  queue_class: agentOsJobSchema.shape.queueClass,
  attempt: z.coerce.number().int().nonnegative(),
  max_attempts: z.coerce.number().int().positive(),
  queued_at: z.union([z.string(), z.date()]).nullable(),
  started_at: z.union([z.string(), z.date()]).nullable(),
  heartbeat_at: z.union([z.string(), z.date()]).nullable(),
  completed_at: z.union([z.string(), z.date()]).nullable(),
  n8n_execution_id: z.string().nullable(),
  provider_reference: z.string().nullable(),
  error_category: z.string().nullable(),
  duration_ms: z.coerce.number().int().nonnegative().nullable(),
  queue_wait_ms: z.coerce.number().int().nonnegative().nullable(),
  row_version: z.coerce.number().int().positive(),
  created_at: z.union([z.string(), z.date()]),
  updated_at: z.union([z.string(), z.date()]),
});

function iso(value: string | Date | null) {
  return value instanceof Date ? value.toISOString() : value;
}

function mapDbJob(row: z.infer<typeof dbJobSchema>) {
  return {
    jobId: row.job_id,
    correlationId: row.correlation_id,
    requestId: row.request_id,
    payloadDigestSha256: row.payload_digest_sha256,
    source: row.source,
    action: row.action,
    workflowKey: row.workflow_key,
    status: row.status,
    stage: row.stage,
    queueClass: row.queue_class,
    attempt: row.attempt,
    maxAttempts: row.max_attempts,
    queuedAt: iso(row.queued_at),
    startedAt: iso(row.started_at),
    heartbeatAt: iso(row.heartbeat_at),
    completedAt: iso(row.completed_at),
    n8nExecutionId: row.n8n_execution_id,
    providerReference: row.provider_reference,
    errorCategory: row.error_category,
    durationMs: row.duration_ms,
    queueWaitMs: row.queue_wait_ms,
    rowVersion: row.row_version,
    createdAt: iso(row.created_at)!,
    updatedAt: iso(row.updated_at)!,
  };
}

async function runtimeSql(variables: Record<string, string | undefined> = process.env) {
  const runtime = resolveAdminOperationsRuntimeIdentity(adminOperationsRuntimeInputFromEnvironment(variables));
  const connectionString = variables.CCPUN_ADMIN_DATABASE_URL?.trim();
  if (!runtime || !connectionString) return null;
  return neon(connectionString, { fetchOptions: { signal: AbortSignal.timeout(5_000) } });
}

export async function createAgentRuntimeJob(input: {
  correlationId?: string;
  requestId?: string;
  idempotencyKey: string;
  payloadDigestSha256: string;
  source: AgentOsJob["source"];
  action: string;
  workflowKey: string;
  stage: string;
  queueClass: AgentOsJob["queueClass"];
  maxAttempts?: number;
  queuedAt?: string | null;
  n8nExecutionId?: string | null;
  providerReference?: string | null;
}, variables: Record<string, string | undefined> = process.env) {
  const sql = await runtimeSql(variables);
  if (!sql) throw new Error("AGENT_OS_RUNTIME_NOT_READY");

  const jobId = randomUUID();
  const correlationId = input.correlationId ?? randomUUID();
  const requestId = input.requestId ?? randomUUID();

  const rows = createResultSchema.array().parse(await sql.query(
    "SELECT outcome,job_id::text,correlation_id::text,request_id::text,row_version FROM ccpun_admin.admin_create_agent_runtime_job($1::jsonb)",
    [JSON.stringify({
      job_id: jobId,
      correlation_id: correlationId,
      request_id: requestId,
      idempotency_key: input.idempotencyKey,
      payload_digest_sha256: input.payloadDigestSha256,
      source: input.source,
      action: input.action,
      workflow_key: input.workflowKey,
      status: "queued",
      stage: input.stage,
      queue_class: input.queueClass,
      attempt: 0,
      max_attempts: input.maxAttempts ?? 3,
      queued_at: input.queuedAt ?? new Date().toISOString(),
      n8n_execution_id: input.n8nExecutionId ?? null,
      provider_reference: input.providerReference ?? null,
    })],
  ));

  const row = rows[0];
  if (!row) throw new Error("AGENT_OS_JOB_CREATE_FAILED");
  return {
    outcome: row.outcome,
    jobId: row.job_id,
    correlationId: row.correlation_id,
    requestId: row.request_id,
    rowVersion: row.row_version,
  };
}

export async function updateAgentRuntimeJob(input: {
  jobId: string;
  expectedVersion: number;
  status?: AgentOsJob["status"];
  stage?: string;
  attempt?: number;
  heartbeatAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  n8nExecutionId?: string | null;
  providerReference?: string | null;
  errorCategory?: string | null;
  durationMs?: number | null;
  queueWaitMs?: number | null;
}, variables: Record<string, string | undefined> = process.env) {
  const sql = await runtimeSql(variables);
  if (!sql) throw new Error("AGENT_OS_RUNTIME_NOT_READY");

  const payload: Record<string, unknown> = {
    job_id: input.jobId,
    expected_version: input.expectedVersion,
  };

  const fields = {
    status: input.status,
    stage: input.stage,
    attempt: input.attempt,
    heartbeat_at: input.heartbeatAt,
    started_at: input.startedAt,
    completed_at: input.completedAt,
    n8n_execution_id: input.n8nExecutionId,
    provider_reference: input.providerReference,
    error_category: input.errorCategory,
    duration_ms: input.durationMs,
    queue_wait_ms: input.queueWaitMs,
  };

  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) payload[key] = value;
  }

  const row = updateResultSchema.array().parse(await sql.query(
    "SELECT outcome,row_version FROM ccpun_admin.admin_update_agent_runtime_job($1::jsonb)",
    [JSON.stringify(payload)],
  ))[0];

  if (!row) throw new Error("AGENT_OS_JOB_UPDATE_FAILED");
  return { outcome: row.outcome, rowVersion: row.row_version };
}

export async function readAgentRuntimeJobs(
  limit = 50,
  variables: Record<string, string | undefined> = process.env,
) {
  const sql = await runtimeSql(variables);
  if (!sql) return { state: "not_ready" as const, jobs: [] };

  try {
    const rows = dbJobSchema.array().parse(await sql.query(
      "SELECT * FROM ccpun_admin.admin_read_agent_runtime_jobs($1::integer)",
      [Math.min(Math.max(limit, 1), 200)],
    ));
    return {
      state: "ready" as const,
      jobs: rows.map(mapDbJob),
    };
  } catch {
    return { state: "unavailable" as const, jobs: [] };
  }
}

export async function readAgentRuntimeJobById(
  jobId: string,
  variables: Record<string, string | undefined> = process.env,
) {
  const parsedJobId = z.string().uuid().safeParse(jobId);
  if (!parsedJobId.success) return { state: "invalid" as const, job: null };

  const sql = await runtimeSql(variables);
  if (!sql) return { state: "not_ready" as const, job: null };

  try {
    const rows = dbJobSchema.array().parse(await sql.query(
      "SELECT * FROM ccpun_admin.admin_read_agent_runtime_job($1::uuid)",
      [parsedJobId.data],
    ));
    return { state: "ready" as const, job: rows[0] ? mapDbJob(rows[0]) : null };
  } catch (error) {
    // ponytail: retain the old 200-job detail window until the additive lookup migration is applied.
    if (error && typeof error === "object" && "code" in error && error.code === "42883") {
      const legacy = await readAgentRuntimeJobs(200, variables);
      return { state: legacy.state, job: legacy.jobs.find((item) => item.jobId === parsedJobId.data) ?? null };
    }
    return { state: "unavailable" as const, job: null };
  }
}

export async function readAgentRuntimeDurationBaseline(
  workflowKey: string,
  stage: string,
  variables: Record<string, string | undefined> = process.env,
) {
  const sql = await runtimeSql(variables);
  if (!sql) return runtimeDurationBaseline([]);

  try {
    const rows = z.array(z.object({
      duration_ms: z.coerce.number().int().nonnegative(),
    })).parse(await sql.query(
      "SELECT duration_ms FROM ccpun_admin.admin_read_agent_runtime_duration_samples($1,$2,$3::integer)",
      [workflowKey, stage, 50],
    ));
    return runtimeDurationBaseline(rows.map((row) => row.duration_ms));
  } catch {
    return runtimeDurationBaseline([]);
  }
}


export async function readAgentRuntimeJobEvents(
  jobId: string,
  limit = 100,
  variables: Record<string, string | undefined> = process.env,
) {
  const parsedJobId = z.string().uuid().safeParse(jobId);
  if (!parsedJobId.success) return { state: "invalid" as const, events: [] };

  const sql = await runtimeSql(variables);
  if (!sql) return { state: "not_ready" as const, events: [] };

  try {
    const rows = eventRowSchema.array().parse(await sql.query(
      "SELECT * FROM ccpun_admin.admin_read_agent_runtime_job_events($1::uuid,$2::integer)",
      [parsedJobId.data, Math.min(Math.max(limit, 1), 500)],
    ));
    return {
      state: "ready" as const,
      events: rows.map((row) => ({
        eventId: row.event_id,
        jobId: row.job_id,
        rowVersion: row.row_version,
        status: row.status,
        stage: row.stage,
        attempt: row.attempt,
        errorCategory: row.error_category,
        occurredAt: iso(row.occurred_at)!,
      })),
    };
  } catch {
    return { state: "unavailable" as const, events: [] };
  }
}
