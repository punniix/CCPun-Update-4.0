import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { z } from "zod";
import {
  expectedDataClass,
  localAiDataClassSchema,
  localAiJobStatusSchema,
  localAiTaskTypeSchema,
  parseLocalAiTaskInput,
  parseLocalAiTaskOutput,
  type LocalAiTaskInput,
  type LocalAiTaskType,
} from "../../local-ai/contracts";
import { createLocalAiPayloadCrypto } from "../../local-ai/crypto";
import {
  LOCAL_AI_MIGRATION_CHECKSUM,
  LOCAL_AI_MIGRATION_VERSION,
  getLocalAiAdminStatus,
  resolveLocalAiAdminRuntime,
} from "./foundation";

const dateSchema = z.union([z.string(), z.date()]).nullable();
const jobRowSchema = z.object({
  job_id: z.string().uuid(),
  task_type: localAiTaskTypeSchema,
  data_class: localAiDataClassSchema,
  status: localAiJobStatusSchema,
  priority: z.coerce.number().int(),
  attempt_count: z.coerce.number().int(),
  max_attempts: z.coerce.number().int(),
  model_name: z.string().nullable(),
  output_json: z.record(z.string(), z.unknown()).nullable(),
  error_category: z.string().nullable(),
  created_at: dateSchema,
  updated_at: dateSchema,
  started_at: dateSchema,
  completed_at: dateSchema,
});
const healthRowSchema = z.object({
  queued: z.coerce.number().int(), leased: z.coerce.number().int(), succeeded: z.coerce.number().int(),
  failed: z.coerce.number().int(), reconciliation_required: z.coerce.number().int(),
  private_jobs: z.coerce.number().int(), public_safe_jobs: z.coerce.number().int(),
  worker_last_seen_at: dateSchema, worker_model_name: z.string().nullable(),
  ollama_ready: z.boolean().nullable(), accepting_private_jobs: z.boolean().nullable(),
  active_job_count: z.coerce.number().int().nullable(),
});

function mapJob(row: z.infer<typeof jobRowSchema>) {
  return {
    id: row.job_id, taskType: row.task_type, dataClass: row.data_class, status: row.status,
    priority: row.priority, attempts: { current: row.attempt_count, max: row.max_attempts },
    modelName: row.model_name, output: row.output_json, errorCategory: row.error_category,
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
       EXISTS(SELECT 1 FROM ccpun_admin.schema_migration WHERE version=$6 AND checksum=$7) AS ledger_current`,
    [runtime.lane,runtime.localAiIdentity.projectId,runtime.localAiIdentity.branchId,runtime.localAiIdentity.endpointId,
      runtime.localAiIdentity.database,LOCAL_AI_MIGRATION_VERSION,LOCAL_AI_MIGRATION_CHECKSUM],
  ) as Array<{ database_name: string; role_name: string; identity_current: boolean; ledger_current: boolean }>;
  const row = rows[0];
  if (!row || row.database_name !== runtime.localAiIdentity.database || row.role_name !== runtime.localAiIdentity.runtimeRole
    || !row.identity_current || !row.ledger_current) throw new Error("LOCAL_AI_DATABASE_IDENTITY_MISMATCH");
  return sql;
}

export async function readLocalAiOperations(limit = 30) {
  const configuration = getLocalAiAdminStatus();
  try {
    const sql = await localAiSql();
    if (!sql) return { status: "not-configured" as const, configuration, health: null, jobs: [], error: null };
    const [healthRows, jobRows] = await Promise.all([
      sql.query("SELECT * FROM ccpun_admin.admin_read_local_ai_health()", []),
      sql.query("SELECT * FROM ccpun_admin.admin_read_local_ai_jobs($1)", [Math.min(Math.max(limit, 1), 100)]),
    ]);
    const health = healthRowSchema.parse(healthRows[0]);
    const jobs = z.array(jobRowSchema).parse(jobRows).map(mapJob);
    return {
      status: "ready" as const, configuration,
      health: {
        queued: health.queued, leased: health.leased, succeeded: health.succeeded, failed: health.failed,
        reconciliationRequired: health.reconciliation_required, privateJobs: health.private_jobs,
        publicSafeJobs: health.public_safe_jobs, workerLastSeenAt: iso(health.worker_last_seen_at),
        workerModelName: health.worker_model_name, ollamaReady: health.ollama_ready,
        acceptingPrivateJobs: health.accepting_private_jobs, activeJobCount: health.active_job_count,
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
  const rows = await sql.query("SELECT * FROM ccpun_admin.admin_read_local_ai_job($1)", [parsedId.data]);
  const row = rows[0] ? jobRowSchema.parse(rows[0]) : null;
  if (!row) return null;
  if (row.status === "succeeded") {
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
  priority?: number;
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
    "SELECT * FROM ccpun_admin.admin_enqueue_local_ai_job($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
    [jobId,input.taskType,expectedDataClass(input.taskType),encrypted.ciphertextB64,encrypted.nonceB64,
      encrypted.authTagB64,encrypted.keyVersion,digest(`${input.taskType}:${input.idempotencyKey}`),
      digest(`${jobId}:${input.actor.trim().toLowerCase()}`),input.priority ?? 50],
  ) as Array<{ job_id: string; status: string; reused: boolean }>;
  const row = rows[0];
  if (!row) throw new Error("LOCAL_AI_ENQUEUE_FAILED");
  return { jobId: row.job_id, status: localAiJobStatusSchema.parse(row.status), reused: row.reused };
}
