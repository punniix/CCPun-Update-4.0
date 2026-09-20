import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { z } from "zod";
import {
  expectedDataClass,
  localAiDataClassSchema,
  localAiJobStatusSchema,
  localAiQueueClassSchema,
  localAiReviewStatusSchema,
  localAiTaskTypeSchema,
  parseLocalAiTaskInput,
  parseLocalAiTaskOutput,
  type LocalAiTaskInput,
  type LocalAiQueueClass,
  type LocalAiTaskType,
} from "../../local-ai/contracts";
import { createLocalAiPayloadCrypto, createLocalAiRequestFingerprint } from "../../local-ai/crypto";
import {
  LOCAL_AI_MIGRATION_CHECKSUM,
  LOCAL_AI_MIGRATION_VERSION,
  getLocalAiAdminStatus,
  resolveLocalAiAdminRuntime,
} from "./foundation";

export const LOCAL_AI_OPERATIONS_MIGRATION_VERSION = "20260920_local_ai_production_operations_v2";
export const LOCAL_AI_OPERATIONS_MIGRATION_CHECKSUM = "sha256:deb9f6761364a61bae275d5226f341ca021087da4116bc3f4703bd8b8c46fb1f";

const dateSchema = z.union([z.string(), z.date()]).nullable();
const jobRowSchema = z.object({
  job_id: z.string().uuid(),
  task_type: localAiTaskTypeSchema,
  data_class: localAiDataClassSchema,
  status: localAiJobStatusSchema,
  queue_class: localAiQueueClassSchema,
  deadline_at: dateSchema,
  attempt_count: z.coerce.number().int(),
  max_attempts: z.coerce.number().int(),
  model_name: z.string().nullable(),
  output_json: z.record(z.string(), z.unknown()).nullable(),
  review_status: localAiReviewStatusSchema.nullable(),
  error_category: z.string().nullable(),
  created_at: dateSchema,
  updated_at: dateSchema,
  started_at: dateSchema,
  completed_at: dateSchema,
});
const healthRowSchema = z.object({
  queued: z.coerce.number().int(), leased: z.coerce.number().int(), succeeded: z.coerce.number().int(),
  failed: z.coerce.number().int(), reconciliation_required: z.coerce.number().int(),
  pending_review: z.coerce.number().int(), succeeded_24h: z.coerce.number().int(), failed_24h: z.coerce.number().int(),
  oldest_queue_seconds: z.coerce.number().int(), duration_p50_ms: z.coerce.number().int(), duration_p95_ms: z.coerce.number().int(),
  private_jobs: z.coerce.number().int(), public_safe_jobs: z.coerce.number().int(),
  worker_last_seen_at: dateSchema, worker_model_name: z.string().nullable(),
  ollama_ready: z.boolean().nullable(), accepting_private_jobs: z.boolean().nullable(),
  active_job_count: z.coerce.number().int().nullable(),
  process_rss_bytes: z.coerce.number().int().nullable(), heap_used_bytes: z.coerce.number().int().nullable(),
  system_load_1: z.coerce.number().nullable(), uptime_seconds: z.coerce.number().int().nullable(),
});
const incidentRowSchema = z.object({
  job_id: z.string().uuid(), task_type: localAiTaskTypeSchema, status: localAiJobStatusSchema,
  queue_class: localAiQueueClassSchema, attempt_count: z.coerce.number().int(), max_attempts: z.coerce.number().int(),
  error_category: z.string().nullable(), updated_at: dateSchema,
});
const reviewRowSchema = z.object({
  job_id: z.string().uuid(), task_type: localAiTaskTypeSchema, queue_class: localAiQueueClassSchema,
  output_json: z.record(z.string(), z.unknown()), completed_at: dateSchema,
});

function mapJob(row: z.infer<typeof jobRowSchema>) {
  return {
    id: row.job_id, taskType: row.task_type, dataClass: row.data_class, status: row.status,
    queueClass: row.queue_class, deadlineAt: iso(row.deadline_at), attempts: { current: row.attempt_count, max: row.max_attempts },
    modelName: row.model_name, output: row.output_json, reviewStatus: row.review_status, errorCategory: row.error_category,
    createdAt: iso(row.created_at), updatedAt: iso(row.updated_at), startedAt: iso(row.started_at), completedAt: iso(row.completed_at),
  };
}

function iso(value: string | Date | null) {
  return value instanceof Date ? value.toISOString() : value;
}

function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

async function localAiSql() {
  const runtime = resolveLocalAiAdminRuntime();
  const connectionString = process.env.CCPUN_ADMIN_DATABASE_URL?.trim();
  if (!runtime || !connectionString) return null;
  const sql = neon(connectionString, { fetchOptions: { signal: AbortSignal.timeout(5_000) } });
  const rows = await sql.query(
    `SELECT current_database() AS database_name,current_user AS role_name,
       EXISTS(SELECT 1 FROM ccpun_admin.local_ai_identity WHERE singleton=true AND lane=$1 AND project_id=$2
         AND branch_id=$3 AND endpoint_id=$4 AND database_name=$5 AND migration_version=$6 AND migration_checksum=$7) AS identity_current,
       EXISTS(SELECT 1 FROM ccpun_admin.schema_migration WHERE version=$6 AND checksum=$7) AS ledger_current,
       EXISTS(SELECT 1 FROM ccpun_admin.schema_migration WHERE version=$8 AND checksum=$9) AS operations_ledger_current`,
    [runtime.lane,runtime.localAiIdentity.projectId,runtime.localAiIdentity.branchId,runtime.localAiIdentity.endpointId,
      runtime.localAiIdentity.database,LOCAL_AI_MIGRATION_VERSION,LOCAL_AI_MIGRATION_CHECKSUM,
      LOCAL_AI_OPERATIONS_MIGRATION_VERSION,LOCAL_AI_OPERATIONS_MIGRATION_CHECKSUM],
  ) as Array<{ database_name: string; role_name: string; identity_current: boolean; ledger_current: boolean; operations_ledger_current: boolean }>;
  const row = rows[0];
  if (!row || row.database_name !== runtime.localAiIdentity.database || row.role_name !== runtime.localAiIdentity.runtimeRole
    || !row.identity_current || !row.ledger_current || !row.operations_ledger_current) throw new Error("LOCAL_AI_DATABASE_IDENTITY_MISMATCH");
  return sql;
}

export async function readLocalAiOperations(limit = 30) {
  const configuration = getLocalAiAdminStatus();
  try {
    const sql = await localAiSql();
    if (!sql) return { status: "not-configured" as const, configuration, health: null, jobs: [], error: null };
    const [healthRows, jobRows] = await Promise.all([
      sql.query("SELECT * FROM ccpun_admin.admin_read_local_ai_health_v2()", []),
      sql.query("SELECT * FROM ccpun_admin.admin_read_local_ai_jobs_v2($1)", [Math.min(Math.max(limit, 1), 100)]),
    ]);
    const health = healthRowSchema.parse(healthRows[0]);
    const jobs = z.array(jobRowSchema).parse(jobRows).map(mapJob);
    const workerLastSeenAt = iso(health.worker_last_seen_at);
    const workerFresh = workerLastSeenAt
      ? Date.now() - new Date(workerLastSeenAt).getTime() < 90_000
      : false;
    return {
      status: "ready" as const, configuration,
      health: {
        queued: health.queued, leased: health.leased, succeeded: health.succeeded, failed: health.failed,
        reconciliationRequired: health.reconciliation_required, pendingReview: health.pending_review,
        succeeded24h: health.succeeded_24h, failed24h: health.failed_24h,
        oldestQueueSeconds: health.oldest_queue_seconds, durationP50Ms: health.duration_p50_ms,
        durationP95Ms: health.duration_p95_ms, privateJobs: health.private_jobs,
        publicSafeJobs: health.public_safe_jobs, workerLastSeenAt, workerFresh,
        workerModelName: health.worker_model_name, ollamaReady: health.ollama_ready,
        acceptingPrivateJobs: health.accepting_private_jobs, activeJobCount: health.active_job_count,
        workerMetrics: {
          processRssBytes: health.process_rss_bytes, heapUsedBytes: health.heap_used_bytes,
          systemLoad1: health.system_load_1, uptimeSeconds: health.uptime_seconds,
        },
      },
      jobs,
      error: null,
    };
  } catch (error) {
    return {
      status: "unavailable" as const, configuration, health: null, jobs: [],
      error: error instanceof Error ? error.message : "LOCAL_AI_READ_FAILED",
    };
  }
}

export async function readLocalAiJob(jobId: string) {
  const parsedId = z.string().uuid().safeParse(jobId);
  if (!parsedId.success) return null;
  const sql = await localAiSql();
  if (!sql) throw new Error("LOCAL_AI_DATABASE_NOT_CONFIGURED");
  const rows = await sql.query("SELECT * FROM ccpun_admin.admin_read_local_ai_job_v2($1)", [parsedId.data]);
  const row = rows[0] ? jobRowSchema.parse(rows[0]) : null;
  if (!row) return null;
  if (row.status === "succeeded" && row.review_status === "approved") {
    if (!row.output_json) throw new Error("LOCAL_AI_STORED_OUTPUT_INVALID");
    const output = parseLocalAiTaskOutput(row.task_type, row.output_json);
    if (!output.success) throw new Error("LOCAL_AI_STORED_OUTPUT_INVALID");
  }
  return mapJob(row);
}

export async function enqueueLocalAiJob<T extends LocalAiTaskType>(input: {
  taskType: T;
  payload: LocalAiTaskInput[T];
  actor: string;
  idempotencyKey: string;
  queueClass?: LocalAiQueueClass;
}) {
  const status = getLocalAiAdminStatus();
  if (!status.readyToEnqueue) throw new Error("LOCAL_AI_ENQUEUE_DISABLED");
  const parsed = parseLocalAiTaskInput(input.taskType, input.payload);
  if (!parsed.success) throw new Error("LOCAL_AI_INPUT_INVALID");
  const sql = await localAiSql();
  if (!sql) throw new Error("LOCAL_AI_DATABASE_NOT_CONFIGURED");
  const jobId = randomUUID();
  const encrypted = createLocalAiPayloadCrypto().encrypt(jobId, input.taskType, parsed.data);
  const rows = await sql.query(
    "SELECT * FROM ccpun_admin.admin_enqueue_local_ai_job_v2($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
    [jobId,input.taskType,expectedDataClass(input.taskType),encrypted.ciphertextB64,encrypted.nonceB64,
      encrypted.authTagB64,encrypted.keyVersion,digest(`${input.taskType}:${input.idempotencyKey}`),
      createLocalAiRequestFingerprint(input.taskType,parsed.data),digest(`${jobId}:${input.actor.trim().toLowerCase()}`),input.queueClass ?? "batch"],
  ) as Array<{ job_id: string | null; status: string | null; reused: boolean; outcome: string }>;
  const row = rows[0];
  if (!row) throw new Error("LOCAL_AI_ENQUEUE_FAILED");
  if (row.outcome === "backpressure") throw new Error("LOCAL_AI_BACKPRESSURE");
  if (row.outcome === "idempotency-conflict") throw new Error("LOCAL_AI_IDEMPOTENCY_CONFLICT");
  if (!row.job_id || !row.status || !["inserted", "reused"].includes(row.outcome)) throw new Error("LOCAL_AI_ENQUEUE_FAILED");
  return { jobId: row.job_id, status: localAiJobStatusSchema.parse(row.status), reused: row.reused, queueClass: input.queueClass ?? "batch" };
}

export async function reviewLocalAiJob(input: {
  jobId: string;
  decision: "approve" | "reject";
  actor: string;
  reason?: string;
}) {
  const jobId = z.string().uuid().parse(input.jobId);
  const reason = input.reason?.trim() || null;
  if (input.decision === "reject" && !reason) throw new Error("LOCAL_AI_REVIEW_REASON_REQUIRED");
  const sql = await localAiSql();
  if (!sql) throw new Error("LOCAL_AI_DATABASE_NOT_CONFIGURED");
  const rows = await sql.query(
    "SELECT ccpun_admin.admin_review_local_ai_job_v2($1,$2,$3,$4) AS review_status",
    [jobId,input.decision,digest(input.actor.trim().toLowerCase()),reason],
  ) as Array<{ review_status: string }>;
  return localAiReviewStatusSchema.parse(rows[0]?.review_status);
}

export async function readLocalAiReviewQueue(limit = 25) {
  try {
    const sql = await localAiSql();
    if (!sql) return [];
    const rows = z.array(reviewRowSchema).parse(await sql.query(
      "SELECT * FROM ccpun_admin.admin_read_local_ai_review_queue_v2($1)",
      [Math.min(Math.max(limit, 1), 100)],
    ));
    return rows.map((row) => {
      const output = parseLocalAiTaskOutput(row.task_type, row.output_json);
      if (!output.success) throw new Error("LOCAL_AI_STORED_OUTPUT_INVALID");
      return {
        jobId: row.job_id, taskType: row.task_type, queueClass: row.queue_class,
        output: output.data, completedAt: iso(row.completed_at),
      };
    });
  } catch {
    return [];
  }
}

export async function readLocalAiBridgeHealth() {
  const model = await readLocalAiOperations(1);
  if (model.status !== "ready" || !model.health) return { status: model.status, health: null };
  return {
    status: "ready" as const,
    health: {
      queued: model.health.queued, leased: model.health.leased, pendingReview: model.health.pendingReview,
      succeeded24h: model.health.succeeded24h, failed24h: model.health.failed24h,
      oldestQueueSeconds: model.health.oldestQueueSeconds, durationP50Ms: model.health.durationP50Ms,
      durationP95Ms: model.health.durationP95Ms, workerFresh: model.health.workerFresh,
      ollamaReady: model.health.ollamaReady, acceptingPrivateJobs: false as const,
    },
  };
}

export async function readLocalAiIncidents(limit = 25) {
  const sql = await localAiSql();
  if (!sql) throw new Error("LOCAL_AI_DATABASE_NOT_CONFIGURED");
  const rows = z.array(incidentRowSchema).parse(await sql.query(
    "SELECT * FROM ccpun_admin.admin_read_local_ai_incidents_v2($1)",
    [Math.min(Math.max(limit, 1), 100)],
  ));
  return rows.map((row) => ({
    jobId: row.job_id, taskType: row.task_type, status: row.status, queueClass: row.queue_class,
    attempts: { current: row.attempt_count, max: row.max_attempts }, errorCategory: row.error_category,
    updatedAt: iso(row.updated_at),
  }));
}
