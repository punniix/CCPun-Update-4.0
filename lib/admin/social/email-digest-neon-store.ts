import "server-only";

import { neon } from "@neondatabase/serverless";
import { z } from "zod";
import { getSocialDatabaseReadiness } from "./database";
import {
  emailDigestStatusSchema,
  workerJobStatusSchema,
  type AuditEntry,
  type DigestPlan,
  type EmailDigestRecord,
  type JobPlan,
  type WorkerJobRecord,
} from "./email-digest-model";
import type { EmailDigestStore } from "./email-digest-service";

export const EMAIL_DIGEST_MIGRATION_VERSION = "20261025_social_email_digest_v1";
export const EMAIL_DIGEST_MIGRATION_FILE = "db/migrations/20261025_social_email_digest_v1_uat.sql";
export const EMAIL_DIGEST_MIGRATION_CHECKSUM = "sha256:b5cc30b064ab9713a1131122eb9ac6cdc6ee14a45e2e50e2d3b7ce9795afc695";

type SqlClient = { query: (query: string, params?: unknown[]) => Promise<unknown> };
type Env = Record<string, string | undefined>;

export type EmailDigestStoreReadiness =
  | { ready: true }
  | { ready: false; reason: "not-configured" | "database-not-ready" | "migration-pending" | "unavailable" };

const DIGEST = "ccpun_social.social_email_digest";
const JOB = "ccpun_social.social_worker_job";
const AUDIT = "ccpun_social.social_execution_audit";

export const EMAIL_DIGEST_READINESS_SQL = `SELECT
  EXISTS (SELECT 1 FROM ccpun_social.schema_migration WHERE version=$1 AND checksum=$2) AS ledger_current,
  to_regclass('${DIGEST}') IS NOT NULL AND to_regclass('${JOB}') IS NOT NULL
    AND to_regclass('ccpun_social.social_worker_request_nonce') IS NOT NULL AS tables_current,
  COALESCE(has_function_privilege(current_user,
    to_regprocedure('ccpun_social.social_require_write(boolean,text)'),'EXECUTE'), false) AS require_write_current`;

async function connect(env: Env): Promise<{ sql: SqlClient } | { reason: Exclude<EmailDigestStoreReadiness, { ready: true }>["reason"] }> {
  const connectionString = env.CCPUN_SOCIAL_DATABASE_URL?.trim();
  if (!connectionString) return { reason: "not-configured" };
  const base = await getSocialDatabaseReadiness(connectionString, env);
  if (!base.reachable || !base.migrationCurrent) return { reason: "database-not-ready" };
  const sql = neon(connectionString, { fetchOptions: { signal: AbortSignal.timeout(15_000) } }) as SqlClient;
  try {
    const rows = z.array(z.object({ ledger_current: z.boolean(), tables_current: z.boolean(), require_write_current: z.boolean() })).length(1)
      .parse(await sql.query(EMAIL_DIGEST_READINESS_SQL, [EMAIL_DIGEST_MIGRATION_VERSION, EMAIL_DIGEST_MIGRATION_CHECKSUM]));
    const row = rows[0]!;
    if (!row.ledger_current || !row.tables_current || !row.require_write_current) return { reason: "migration-pending" };
  } catch {
    return { reason: "unavailable" };
  }
  return { sql };
}

export async function getEmailDigestStoreReadiness(env: Env = process.env): Promise<EmailDigestStoreReadiness> {
  const result = await connect(env);
  return "sql" in result ? { ready: true } : { ready: false, reason: result.reason };
}

const iso = (value: unknown) => (value === null || value === undefined ? null : new Date(value as string).toISOString());
const json = <T>(value: unknown, fallback: T): T => (value === null || value === undefined ? fallback : typeof value === "string" ? JSON.parse(value) as T : value as T);

const digestRowSchema = z.object({
  id: z.string(), month: z.string(), subject: z.string(), preheader: z.string(), intro: z.string(), closing: z.string().nullable(),
  articles: z.unknown(), status: emailDigestStatusSchema, version: z.number().int(), content_version: z.number().int(),
  reviewed_content_version: z.number().int().nullable(), reviewed_at: z.unknown(), reviewed_by_ref: z.string().nullable(),
  scheduled_at: z.unknown(), job_id: z.string().nullable(), sent_at: z.unknown(), created_by_ref: z.string(),
  created_at: z.unknown(), updated_at: z.unknown(), mutation_receipts: z.unknown(),
});
const jobRowSchema = z.object({
  id: z.string(), channel: z.literal("email_digest"), action: z.literal("send_digest"), object_id: z.string(),
  object_version: z.number().int(), scheduled_at: z.unknown(), idempotency_key: z.string(), status: workerJobStatusSchema,
  attempts: z.number().int(), max_attempts: z.number().int(), claim_token: z.string().nullable(), claimed_at: z.unknown(),
  claim_expires_at: z.unknown(), last_error_code: z.string().nullable(), external_ids: z.unknown(), version: z.number().int(),
  created_at: z.unknown(), updated_at: z.unknown(), completed_at: z.unknown(), mutation_receipts: z.unknown(),
});

function digestFromRow(raw: unknown): EmailDigestRecord {
  const row = digestRowSchema.parse(raw);
  return {
    id: row.id, month: row.month, subject: row.subject, preheader: row.preheader, intro: row.intro, closing: row.closing,
    articles: json(row.articles, []), status: row.status, version: row.version, contentVersion: row.content_version,
    reviewedContentVersion: row.reviewed_content_version, reviewedAt: iso(row.reviewed_at), reviewedByRef: row.reviewed_by_ref,
    scheduledAt: iso(row.scheduled_at), jobId: row.job_id, sentAt: iso(row.sent_at), createdByRef: row.created_by_ref,
    createdAt: iso(row.created_at)!, updatedAt: iso(row.updated_at)!, receipts: json(row.mutation_receipts, {}),
  };
}

function jobFromRow(raw: unknown): WorkerJobRecord {
  const row = jobRowSchema.parse(raw);
  return {
    id: row.id, channel: row.channel, action: row.action, objectId: row.object_id, objectVersion: row.object_version,
    scheduledAt: iso(row.scheduled_at)!, idempotencyKey: row.idempotency_key, status: row.status, attempts: row.attempts,
    maxAttempts: row.max_attempts, claimToken: row.claim_token, claimedAt: iso(row.claimed_at), claimExpiresAt: iso(row.claim_expires_at),
    lastErrorCode: row.last_error_code, externalIds: json(row.external_ids, {}), version: row.version,
    createdAt: iso(row.created_at)!, updatedAt: iso(row.updated_at)!, completedAt: iso(row.completed_at), receipts: json(row.mutation_receipts, {}),
  };
}

export function digestToRow(record: EmailDigestRecord) {
  return {
    id: record.id, month: record.month, subject: record.subject, preheader: record.preheader, intro: record.intro, closing: record.closing,
    articles: record.articles, status: record.status, version: record.version, content_version: record.contentVersion,
    reviewed_content_version: record.reviewedContentVersion, reviewed_at: record.reviewedAt, reviewed_by_ref: record.reviewedByRef,
    scheduled_at: record.scheduledAt, job_id: record.jobId, sent_at: record.sentAt, created_by_ref: record.createdByRef,
    created_at: record.createdAt, updated_at: record.updatedAt, mutation_receipts: record.receipts,
  };
}

export function jobToRow(record: WorkerJobRecord) {
  return {
    id: record.id, channel: record.channel, action: record.action, object_id: record.objectId, object_version: record.objectVersion,
    scheduled_at: record.scheduledAt, idempotency_key: record.idempotencyKey, status: record.status, attempts: record.attempts,
    max_attempts: record.maxAttempts, claim_token: record.claimToken, claimed_at: record.claimedAt, claim_expires_at: record.claimExpiresAt,
    last_error_code: record.lastErrorCode, external_ids: record.externalIds, version: record.version, created_at: record.createdAt,
    updated_at: record.updatedAt, completed_at: record.completedAt, mutation_receipts: record.receipts,
  };
}

const DIGEST_UPDATE_COLUMNS = ["month", "subject", "preheader", "intro", "closing", "articles", "status", "version", "content_version",
  "reviewed_content_version", "reviewed_at", "reviewed_by_ref", "scheduled_at", "job_id", "sent_at", "updated_at", "mutation_receipts"];
const JOB_UPDATE_COLUMNS = ["scheduled_at", "status", "attempts", "max_attempts", "claim_token", "claimed_at", "claim_expires_at",
  "last_error_code", "external_ids", "version", "updated_at", "completed_at", "mutation_receipts"];

function updateSet(table: string, alias: string, columns: string[], param: string) {
  return `(${columns.join(",")})=(SELECT ${columns.map((column) => `${alias}.${column}`).join(",")} FROM jsonb_populate_record(NULL::${table},${param}::jsonb) AS ${alias})`;
}

const auditInsert = (source: string, base: number) => `INSERT INTO ${AUDIT} (id,actor_type,actor_ref,action,object_type,object_id,request_ref,outcome)
  SELECT $${base},$${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7} FROM ${source} RETURNING 1`;
const auditParams = (entry: AuditEntry) => [entry.id, entry.actorType, entry.actorRef, entry.action, entry.objectType, entry.objectId, entry.requestRef, entry.outcome];

/**
 * One statement per plan: the digest CAS write, its outbox insert/CAS update and
 * the INSERT-only audit row commit together or not at all. A partial write
 * raises inside `social_require_write`, which rolls back the whole statement.
 */
export function digestPlanStatement(plan: DigestPlan) {
  const params: unknown[] = [JSON.stringify(digestToRow(plan.next))];
  const digestWrite = plan.expectedVersion === null
    ? `INSERT INTO ${DIGEST} SELECT * FROM jsonb_populate_record(NULL::${DIGEST},$1::jsonb) ON CONFLICT DO NOTHING RETURNING id`
    : `UPDATE ${DIGEST} SET ${updateSet(DIGEST, "r", DIGEST_UPDATE_COLUMNS, "$1")} WHERE id=$2 AND version=$3 RETURNING id`;
  if (plan.expectedVersion !== null) params.push(plan.next.id, plan.expectedVersion);
  let jobWrite = "";
  let jobExpectation = "true";
  if (plan.createJob) {
    params.push(JSON.stringify(jobToRow(plan.createJob)));
    jobWrite = `, job_write AS (INSERT INTO ${JOB} SELECT j.* FROM jsonb_populate_record(NULL::${JOB},$${params.length}::jsonb) AS j
      WHERE EXISTS (SELECT 1 FROM digest_write) ON CONFLICT DO NOTHING RETURNING id)`;
    jobExpectation = "EXISTS (SELECT 1 FROM job_write)";
  } else if (plan.jobUpdate) {
    params.push(JSON.stringify(jobToRow(plan.jobUpdate.next)), plan.jobUpdate.next.id, plan.jobUpdate.expectedVersion);
    const base = params.length - 2;
    jobWrite = `, job_write AS (UPDATE ${JOB} SET ${updateSet(JOB, "j", JOB_UPDATE_COLUMNS, `$${base}`)}
      WHERE id=$${base + 1} AND version=$${base + 2} AND EXISTS (SELECT 1 FROM digest_write) RETURNING id)`;
    jobExpectation = "EXISTS (SELECT 1 FROM job_write)";
  }
  const auditBase = params.length + 1;
  params.push(...auditParams(plan.audit));
  const text = `WITH digest_write AS (${digestWrite})${jobWrite}, audit AS (${auditInsert("digest_write", auditBase)})
SELECT ccpun_social.social_require_write(NOT EXISTS (SELECT 1 FROM digest_write)
  OR (${jobExpectation} AND EXISTS (SELECT 1 FROM audit)), 'SOCIAL_EMAIL_DIGEST_PARTIAL_WRITE')
  AND EXISTS (SELECT 1 FROM digest_write) AS applied`;
  return { text, params };
}

export function jobPlanStatement(plan: JobPlan) {
  const params: unknown[] = [JSON.stringify(jobToRow(plan.next)), plan.next.id, plan.expectedVersion];
  let digestWrite = "";
  let digestExpectation = "true";
  if (plan.digestUpdate) {
    params.push(JSON.stringify(digestToRow(plan.digestUpdate.next)), plan.digestUpdate.next.id, plan.digestUpdate.expectedVersion);
    digestWrite = `, digest_write AS (UPDATE ${DIGEST} SET ${updateSet(DIGEST, "r", DIGEST_UPDATE_COLUMNS, "$4")}
      WHERE id=$5 AND version=$6 AND EXISTS (SELECT 1 FROM job_write) RETURNING id)`;
    digestExpectation = "EXISTS (SELECT 1 FROM digest_write)";
  }
  const auditBase = params.length + 1;
  params.push(...auditParams(plan.audit));
  const text = `WITH job_write AS (UPDATE ${JOB} SET ${updateSet(JOB, "j", JOB_UPDATE_COLUMNS, "$1")} WHERE id=$2 AND version=$3 RETURNING id)${digestWrite},
audit AS (${auditInsert("job_write", auditBase)})
SELECT ccpun_social.social_require_write(NOT EXISTS (SELECT 1 FROM job_write)
  OR (${digestExpectation} AND EXISTS (SELECT 1 FROM audit)), 'SOCIAL_WORKER_JOB_PARTIAL_WRITE')
  AND EXISTS (SELECT 1 FROM job_write) AS applied`;
  return { text, params };
}

const appliedRows = z.array(z.object({ applied: z.boolean() })).length(1);
const errorCode = (error: unknown) => (error && typeof error === "object" ? Object.getOwnPropertyDescriptor(error, "code")?.value : undefined);

async function runPlan(sql: SqlClient, statement: { text: string; params: unknown[] }) {
  try {
    return appliedRows.parse(await sql.query(statement.text, statement.params))[0]!.applied;
  } catch (error) {
    // A definite rollback (partial-write guard, uniqueness) is a CAS loss; anything else is unknown.
    const code = errorCode(error);
    if (code === "40001" || code === "23505") return false;
    throw new Error("SOCIAL_EMAIL_DIGEST_OUTCOME_UNKNOWN");
  }
}

export async function createNeonEmailDigestStore(env: Env = process.env): Promise<EmailDigestStore> {
  const connection = await connect(env);
  if (!("sql" in connection)) throw new Error(connection.reason === "migration-pending" ? "SOCIAL_EMAIL_DIGEST_MIGRATION_PENDING" : "SOCIAL_EMAIL_DIGEST_STORE_UNAVAILABLE");
  const { sql } = connection;
  const many = async <T>(text: string, params: unknown[], map: (row: unknown) => T) => (z.array(z.unknown()).parse(await sql.query(text, params))).map(map);
  return {
    async getDigest(id) { return (await many(`SELECT * FROM ${DIGEST} WHERE id=$1`, [id], digestFromRow))[0] ?? null; },
    async findDigestByReceipt(key) { return (await many(`SELECT * FROM ${DIGEST} WHERE mutation_receipts ? $1 LIMIT 1`, [key], digestFromRow))[0] ?? null; },
    async findMonthOwner(month) {
      const rows = z.array(z.object({ id: z.string() })).parse(await sql.query(`SELECT id FROM ${DIGEST} WHERE month=$1 AND status<>'cancelled' LIMIT 1`, [month]));
      return rows[0]?.id ?? null;
    },
    async listDigests(limit) { return many(`SELECT * FROM ${DIGEST} ORDER BY month DESC, updated_at DESC LIMIT $1`, [limit], digestFromRow); },
    async getJob(id) { return (await many(`SELECT * FROM ${JOB} WHERE id=$1`, [id], jobFromRow))[0] ?? null; },
    async listJobs(limit) { return many(`SELECT * FROM ${JOB} ORDER BY created_at DESC LIMIT $1`, [limit], jobFromRow); },
    async commitDigestPlan(plan) { return runPlan(sql, digestPlanStatement(plan)); },
    async commitJobPlan(plan) { return runPlan(sql, jobPlanStatement(plan)); },
    async appendAudit(entry) {
      try {
        await sql.query(`INSERT INTO ${AUDIT} (id,actor_type,actor_ref,action,object_type,object_id,request_ref,outcome) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, auditParams(entry));
        return true;
      } catch (error) {
        if (errorCode(error) === "23505") return false;
        throw new Error("SOCIAL_EMAIL_DIGEST_OUTCOME_UNKNOWN");
      }
    },
    async claimNonce(nonce, seenAt) {
      const rows = z.array(z.object({ nonce: z.string() })).parse(await sql.query(
        `INSERT INTO ccpun_social.social_worker_request_nonce (nonce,seen_at) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING nonce`,
        [nonce, seenAt.toISOString()],
      ));
      return rows.length === 1;
    },
  };
}
