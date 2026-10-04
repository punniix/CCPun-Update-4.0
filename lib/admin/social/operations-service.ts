import "server-only";

import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { z } from "zod";
import { getSocialDatabaseReadiness } from "./database";
import { listApprovedSocialVariants } from "./publishing-store";

const boundedId = z.string().trim().min(1).max(120).regex(/^[A-Za-z0-9_.:-]+$/);
const platformSchema = z.enum(["facebook", "instagram"]);
const executionTargetSchema = z.enum([
  "facebook-publish-now",
  "facebook-native-scheduled",
  "instagram-publish-now",
  "instagram-mobile-handoff",
]);
const publicationStatusSchema = z.enum([
  "draft", "approved", "queued", "native-scheduled", "awaiting-native-finish",
  "processing", "published", "failed", "cancelled", "superseded",
]);
const jobStatusSchema = z.enum(["queued", "processing", "succeeded", "failed", "cancelled"]);
const errorCategorySchema = z.enum([
  "authentication", "authorization", "rate-limit", "timeout", "provider-unavailable",
  "invalid-request", "conflict", "unknown",
]);

export const socialOperationMutationSchema = z.strictObject({
  publicationId: boundedId,
  expectedJobVersion: z.number().int().min(1),
  idempotencyKey: z.string().trim().min(16).max(120).regex(/^[A-Za-z0-9_.:-]+$/),
});

export const socialRescheduleMutationSchema = socialOperationMutationSchema.extend({
  scheduledAt: z.string().datetime(),
});

const operationalRowsSchema = z.array(z.object({
  publication_id: boundedId,
  variant_id: boundedId,
  channel: platformSchema,
  format: z.string().trim().min(1).max(80),
  execution_target: executionTargetSchema,
  publication_status: publicationStatusSchema,
  scheduled_at: z.coerce.date().nullable(),
  provider_object_id: z.string().trim().min(1).max(300).nullable(),
  publication_updated_at: z.coerce.date(),
  approved_revision: z.string().trim().min(1).max(120).nullable(),
  approved_version: z.number().int().min(1).nullable(),
  job_id: boundedId,
  job_status: jobStatusSchema,
  job_version: z.number().int().min(1),
  attempt_count: z.number().int().min(0).max(100),
  max_attempts: z.number().int().min(1).max(100),
  lock_owner: z.string().trim().min(1).max(200).nullable(),
  lock_expires_at: z.coerce.date().nullable(),
  last_error_category: errorCategorySchema.nullable(),
  job_updated_at: z.coerce.date(),
})).max(500);

type SqlClient = { query: (query: string, params?: unknown[]) => Promise<unknown> };

async function verifiedSql(env: Record<string, string | undefined> = process.env): Promise<SqlClient> {
  const connectionString = env.CCPUN_SOCIAL_DATABASE_URL?.trim();
  if (!connectionString) throw new Error("SOCIAL_OPERATIONS_NOT_CONFIGURED");
  const readiness = await getSocialDatabaseReadiness(connectionString, env);
  if (!readiness.reachable || !readiness.migrationCurrent) throw new Error("SOCIAL_OPERATIONS_DATABASE_NOT_READY");
  return neon(connectionString, { fetchOptions: { signal: AbortSignal.timeout(15_000) } }) as SqlClient;
}

function safeActorRef(actor: string) {
  return `admin:${createHash("sha256").update(actor).digest("hex").slice(0, 32)}`;
}

function classifyStatus(row: z.infer<typeof operationalRowsSchema>[number], now: Date) {
  const activeLease = row.job_status === "processing"
    && Boolean(row.lock_owner)
    && Boolean(row.lock_expires_at && row.lock_expires_at.getTime() > now.getTime());
  if (row.publication_status === "cancelled" || row.job_status === "cancelled") return "cancelled" as const;
  if (row.publication_status === "native-scheduled" && row.job_status === "succeeded") return "native-scheduled" as const;
  if (row.publication_status === "published" && row.job_status === "succeeded") return "published" as const;
  if (row.job_status === "processing") return "processing" as const;
  if (row.job_status === "failed") {
    if (row.last_error_category === "unknown") return "needs-reconciliation" as const;
    if (row.attempt_count >= row.max_attempts) return "retry-exhausted" as const;
    if (row.last_error_category === "rate-limit") return "retryable" as const;
    return "failed" as const;
  }
  if (activeLease) return "processing" as const;
  return "queued" as const;
}

function operationCapabilities(row: z.infer<typeof operationalRowsSchema>[number], now: Date) {
  const leaseActive = row.job_status === "processing"
    && Boolean(row.lock_expires_at && row.lock_expires_at.getTime() > now.getTime());
  const retryable = row.job_status === "failed"
    && row.last_error_category === "rate-limit"
    && row.attempt_count < row.max_attempts;
  const executable = !leaseActive
    && row.attempt_count < row.max_attempts
    && ["approved", "failed"].includes(row.publication_status)
    && (row.job_status === "queued" || retryable)
    && ["facebook-publish-now", "facebook-native-scheduled"].includes(row.execution_target);
  const amendable = row.channel === "facebook"
    && row.execution_target === "facebook-native-scheduled"
    && row.provider_object_id === null
    && row.attempt_count === 0
    && ["approved", "failed", "cancelled", "superseded"].includes(row.publication_status)
    && ["queued", "failed", "cancelled"].includes(row.job_status);
  return {
    executeNow: executable,
    retry: retryable && executable,
    cancel: amendable,
    reschedule: amendable,
    reconcile: row.job_status === "failed" && row.last_error_category === "unknown",
  };
}

export type SocialOperationalItem = Awaited<ReturnType<typeof listSocialOperationalItems>>[number];

export async function listSocialOperationalItems(input: {
  limit?: number;
  env?: Record<string, string | undefined>;
  now?: Date;
} = {}) {
  const env = input.env ?? process.env;
  const now = input.now ?? new Date();
  const limit = z.number().int().min(1).max(500).parse(input.limit ?? 250);
  const sql = await verifiedSql(env);
  const rows = operationalRowsSchema.parse(await sql.query(
    `SELECT publication.id AS publication_id,publication.variant_id,variant.channel,variant.format,
       publication.execution_target,publication.status AS publication_status,publication.scheduled_at,
       publication.platform_object_id,publication.updated_at AS publication_updated_at,
       publication.approved_revision,publication.approved_version,
       job.id AS job_id,job.status AS job_status,job.version AS job_version,
       job.attempt_count,job.max_attempts,job.lock_owner,job.lock_expires_at,
       job.last_error_category,job.updated_at AS job_updated_at
     FROM ccpun_social.social_publication AS publication
     JOIN ccpun_social.social_variant_link AS variant ON variant.variant_id=publication.variant_id
     JOIN LATERAL (
       SELECT * FROM ccpun_social.social_publication_job
       WHERE publication_id=publication.id ORDER BY created_at DESC,id DESC LIMIT 1
     ) AS job ON true
     ORDER BY COALESCE(publication.scheduled_at,publication.updated_at) DESC
     LIMIT $1`,
    [limit],
  ));

  let titles = new Map<string, string>();
  try {
    const variants = await listApprovedSocialVariants(env);
    titles = new Map(variants.map((variant) => [variant.variantId, variant.title]));
  } catch {
    // Operational state must remain available even when Sanity enrichment is temporarily unavailable.
  }

  return rows.map((row) => {
    const capabilities = operationCapabilities(row, now);
    const status = classifyStatus(row, now);
    const leaseState = row.job_status !== "processing"
      ? "none" as const
      : row.lock_expires_at && row.lock_expires_at.getTime() > now.getTime()
        ? "active" as const
        : "expired" as const;
    return {
      publicationId: row.publication_id,
      variantId: row.variant_id,
      title: titles.get(row.variant_id) ?? row.variant_id,
      platform: row.channel,
      format: row.format,
      executionTarget: row.execution_target,
      status,
      publicationStatus: row.publication_status,
      jobStatus: row.job_status,
      scheduledAt: row.scheduled_at?.toISOString() ?? null,
      attemptCount: row.attempt_count,
      maxAttempts: row.max_attempts,
      lastErrorCategory: row.last_error_category,
      leaseState,
      jobVersion: row.job_version,
      approvedRevision: row.approved_revision,
      approvedVersion: row.approved_version,
      updatedAt: new Date(Math.max(row.publication_updated_at.getTime(), row.job_updated_at.getTime())).toISOString(),
      capabilities,
    };
  });
}

export const SOCIAL_OPERATION_RECEIPT_VERSION = "20261004_social_operation_receipts_v1";
export const SOCIAL_OPERATION_RECEIPT_CHECKSUM = "sha256:361b035bf36ee32a439cb30b0fa5924acecff0bedc4d81360ee506e6b6c10981";
export const SOCIAL_OPERATION_RECEIPT_TRIGGER_MD5 = "9bd649549b7c7f2c4aae49eb5d253e48";

const savedResultSchema = z.discriminatedUnion("state", [
  z.strictObject({ state: z.literal("rescheduled"), publicationId: boundedId, jobId: boundedId,
    jobVersion: z.number().int().min(1), scheduledAt: z.string().datetime() }),
  z.strictObject({ state: z.literal("cancelled"), publicationId: boundedId, jobId: boundedId,
    jobVersion: z.number().int().min(1) }),
]);
const receiptSchema = z.strictObject({
  schemaVersion: z.literal(1), action: z.enum(["reschedule", "cancel"]),
  idempotencyKey: socialOperationMutationSchema.shape.idempotencyKey, publicationId: boundedId,
  actorRef: z.string().regex(/^admin:[a-f0-9]{32}$/), payloadDigest: z.string().regex(/^[a-f0-9]{64}$/),
  payload: z.union([socialRescheduleMutationSchema, socialOperationMutationSchema]), result: savedResultSchema,
});
const receiptRowsSchema = z.array(z.strictObject({ receipt: receiptSchema })).max(1);
const operationResultRowsSchema = z.array(z.strictObject({ result: savedResultSchema })).max(1);

// Readiness belongs only to amendments; unrelated Social capabilities keep their existing contract.
export const SOCIAL_OPERATION_RECEIPT_READINESS_SQL = `SELECT
  current_user='ccpun_social_runtime' AND current_database()='neondb' AS runtime_current,
  current_setting('transaction_isolation')='read committed' AS isolation_current,
  EXISTS (SELECT 1 FROM ccpun_social.schema_migration WHERE version=$1 AND checksum=$2) AS ledger_current,
  EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid='ccpun_social.social_publication_job'::regclass
    AND a.attname='mutation_receipts' AND a.atttypid='jsonb'::regtype AND a.attnotnull AND NOT a.attisdropped
    AND EXISTS (SELECT 1 FROM pg_attrdef d WHERE d.adrelid=a.attrelid AND d.adnum=a.attnum
      AND pg_get_expr(d.adbin,d.adrelid)=(quote_literal('{}')||'::jsonb'))) AS column_current,
  EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
    WHERE t.tgrelid='ccpun_social.social_publication_job'::regclass
      AND t.tgname='social_operation_receipts_guard' AND NOT t.tgisinternal
      AND t.tgtype=31 AND t.tgenabled='O' AND p.pronamespace='ccpun_social'::regnamespace
      AND p.proname='guard_social_operation_receipts' AND p.provolatile='v' AND NOT p.prosecdef
      AND p.proconfig=ARRAY['search_path=pg_catalog']::text[] AND md5(p.prosrc)=$3
      AND has_function_privilege(current_user,p.oid,'EXECUTE')) AS trigger_current,
  NOT EXISTS (SELECT 1 FROM pg_trigger WHERE NOT tgisinternal AND
    (tgrelid IN ('ccpun_social.social_publication'::regclass,'ccpun_social.social_execution_audit'::regclass)
      OR (tgrelid='ccpun_social.social_publication_job'::regclass AND tgname<>'social_operation_receipts_guard')))
    AS other_triggers_absent,
  (SELECT count(*)=3 AND bool_and(NOT relrowsecurity AND NOT relforcerowsecurity) FROM pg_class
    WHERE oid IN ('ccpun_social.social_publication'::regclass,'ccpun_social.social_publication_job'::regclass,
      'ccpun_social.social_execution_audit'::regclass)) AS rls_absent,
  EXISTS (SELECT 1 FROM pg_constraint c WHERE c.contype='f' AND c.convalidated AND NOT c.condeferrable
    AND NOT c.condeferred AND c.conrelid='ccpun_social.social_publication_job'::regclass
    AND c.confrelid='ccpun_social.social_publication'::regclass
    AND c.conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=c.conrelid AND attname='publication_id')]::smallint[]
    AND c.confkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=c.confrelid AND attname='id')]::smallint[])
    AS immediate_fk_current,
  has_column_privilege(current_user,'ccpun_social.social_publication_job','mutation_receipts','UPDATE')
    AND NOT has_table_privilege(current_user,'ccpun_social.social_publication_job','UPDATE') AS receipt_grant_current,
  has_table_privilege(current_user,'ccpun_social.social_execution_audit','INSERT')
    AND NOT has_any_column_privilege(current_user,'ccpun_social.social_execution_audit','SELECT')
    AND NOT has_table_privilege(current_user,'ccpun_social.social_execution_audit','UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    AS audit_append_only`;

async function verifiedMutationSql(env: Record<string, string | undefined>) {
  const sql = await verifiedSql(env);
  const rows = z.array(z.strictObject(Object.fromEntries([
    "runtime_current", "isolation_current", "ledger_current", "column_current", "trigger_current",
    "other_triggers_absent", "rls_absent", "immediate_fk_current", "receipt_grant_current", "audit_append_only",
  ].map((key) => [key, z.boolean()])))).length(1).parse(await sql.query(
    SOCIAL_OPERATION_RECEIPT_READINESS_SQL,
    [SOCIAL_OPERATION_RECEIPT_VERSION, SOCIAL_OPERATION_RECEIPT_CHECKSUM, SOCIAL_OPERATION_RECEIPT_TRIGGER_MD5],
  ));
  if (!Object.values(rows[0]).every((value) => value === true)) throw new Error("SOCIAL_OPERATION_RECEIPTS_NOT_READY");
  return sql;
}

// One statement. Publication -> job/immutable receipt -> mandatory INSERT-only audit.
// An audit uniqueness error aborts all effects; never suppress it with DO NOTHING.
export const SOCIAL_OPERATION_MUTATION_SQL = `WITH locked_publication AS MATERIALIZED (
  SELECT publication.* FROM ccpun_social.social_publication AS publication
  WHERE publication.id=$1 AND current_setting('transaction_isolation')='read committed' FOR UPDATE
), eligible AS MATERIALIZED (
  SELECT publication.id AS publication_id,job.id AS job_id
  FROM locked_publication AS publication
  JOIN ccpun_social.social_variant_link AS variant ON variant.variant_id=publication.variant_id
  JOIN LATERAL (
    SELECT * FROM ccpun_social.social_publication_job
    WHERE publication_id=publication.id ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE
  ) AS job ON true
  WHERE job.version=$2 AND variant.channel='facebook'
    AND publication.execution_target='facebook-native-scheduled'
    AND publication.platform_object_id IS NULL AND job.attempt_count=0
    AND publication.status IN ('approved','failed','cancelled','superseded')
    AND job.status IN ('queued','failed','cancelled')
), amended_publication AS (
  UPDATE ccpun_social.social_publication AS publication
  SET status=CASE WHEN $3='reschedule' THEN 'approved' ELSE 'cancelled' END,
    scheduled_at=CASE WHEN $3='reschedule' THEN $4::timestamptz ELSE publication.scheduled_at END,
    platform_object_id=CASE WHEN $3='reschedule' THEN NULL ELSE publication.platform_object_id END,
    published_at=CASE WHEN $3='reschedule' THEN NULL ELSE publication.published_at END,updated_at=now()
  WHERE id=(SELECT publication_id FROM eligible) RETURNING id,status,scheduled_at
), amended_job AS (
  UPDATE ccpun_social.social_publication_job AS job
  SET status=CASE WHEN $3='reschedule' THEN 'queued' ELSE 'cancelled' END,version=version+1,
    attempt_count=CASE WHEN $3='reschedule' THEN 0 ELSE job.attempt_count END,
    lock_owner=NULL,locked_at=NULL,lock_expires_at=NULL,last_error_category=NULL,last_error_ref=NULL,updated_at=now(),
    mutation_receipts=job.mutation_receipts || jsonb_build_object($8::text,jsonb_build_object(
      'schemaVersion',1,'action',$3::text,'idempotencyKey',$6::text,'publicationId',$1::text,
      'actorRef',$5::text,'payloadDigest',$7::text,'payload',$9::jsonb,
      'result',jsonb_build_object('state',CASE WHEN $3='reschedule' THEN 'rescheduled' ELSE 'cancelled' END,
        'publicationId',publication.id,'jobId',job.id,'jobVersion',job.version+1)
        || CASE WHEN $3='reschedule' THEN jsonb_build_object('scheduledAt',
          to_char(publication.scheduled_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) ELSE '{}'::jsonb END))
  FROM amended_publication AS publication
  WHERE job.id=(SELECT job_id FROM eligible) AND job.version=$2
  RETURNING job.mutation_receipts->$8::text->'result' AS result
), audit AS (
  INSERT INTO ccpun_social.social_execution_audit
    (id,actor_type,actor_ref,action,object_type,object_id,request_ref,outcome)
  SELECT $8,'human',$5,'publication:'||$3,'publication',$1,$6,'succeeded'
  FROM amended_job RETURNING 1
)
SELECT amended_job.result FROM amended_job CROSS JOIN audit`;

type OperationAction = "reschedule" | "cancel";
type OperationPayload = z.infer<typeof socialOperationMutationSchema> | z.infer<typeof socialRescheduleMutationSchema>;

async function readReceipt(sql: SqlClient, action: OperationAction, mutation: OperationPayload, actorRef: string, payloadDigest: string) {
  const auditId = `audit:${mutation.idempotencyKey}:${action}`;
  const rows = receiptRowsSchema.parse(await sql.query(
    `SELECT mutation_receipts->$2::text AS receipt FROM ccpun_social.social_publication_job
     WHERE publication_id=$1 AND mutation_receipts ? $2::text LIMIT 2`,
    [mutation.publicationId, auditId],
  ));
  const receipt = rows[0]?.receipt;
  if (!receipt) return null;
  if (receipt.action !== action || receipt.publicationId !== mutation.publicationId
    || receipt.idempotencyKey !== mutation.idempotencyKey || receipt.actorRef !== actorRef
    || receipt.payloadDigest !== payloadDigest || JSON.stringify(receipt.payload) !== JSON.stringify(mutation)
    || receipt.result.publicationId !== mutation.publicationId
    || receipt.result.state !== (action === "reschedule" ? "rescheduled" : "cancelled")
    || receipt.result.jobVersion !== mutation.expectedJobVersion + 1) throw new Error("SOCIAL_OPERATION_CAS_CONFLICT");
  return receipt.result;
}

async function mutatePublication(action: OperationAction, mutation: OperationPayload, actor: string, env: Record<string, string | undefined>, now = new Date()) {
  const actorRef = safeActorRef(actor);
  const payloadDigest = createHash("sha256").update(JSON.stringify([action, actorRef, mutation])).digest("hex");
  const sql = await verifiedMutationSql(env);
  const replay = await readReceipt(sql, action, mutation, actorRef, payloadDigest);
  if (replay) return { ...replay, state: "replay" as const };
  const scheduledAt = "scheduledAt" in mutation ? mutation.scheduledAt : null;
  if (action === "reschedule" && new Date(scheduledAt!).getTime() <= now.getTime() + 60_000) {
    throw new Error("SOCIAL_RESCHEDULE_REQUIRES_FUTURE_TIME");
  }
  let raw: unknown;
  try {
    raw = await sql.query(SOCIAL_OPERATION_MUTATION_SQL, [mutation.publicationId, mutation.expectedJobVersion,
      action, scheduledAt, actorRef, mutation.idempotencyKey, payloadDigest,
      `audit:${mutation.idempotencyKey}:${action}`, JSON.stringify(mutation)]);
  } catch (error) {
    // Only a definite SQL uniqueness rollback permits a fresh read. Transport ambiguity never retries mutation.
    const code = error && typeof error === "object" ? Object.getOwnPropertyDescriptor(error, "code")?.value : undefined;
    if (code !== "23505") throw new Error("SOCIAL_OPERATION_OUTCOME_UNKNOWN");
    const committed = await readReceipt(sql, action, mutation, actorRef, payloadDigest);
    if (committed) return { ...committed, state: "replay" as const };
    throw new Error("SOCIAL_OPERATION_LEGACY_REPLAY_HOLD");
  }
  const result = operationResultRowsSchema.parse(raw)[0]?.result;
  if (result) return result;
  const committed = await readReceipt(sql, action, mutation, actorRef, payloadDigest);
  if (committed) return { ...committed, state: "replay" as const };
  throw new Error("SOCIAL_OPERATION_CAS_CONFLICT");
}

export async function rescheduleSocialPublication(input: {
  mutation: z.input<typeof socialRescheduleMutationSchema>; actor: string;
  env?: Record<string, string | undefined>; now?: Date;
}) {
  const result = await mutatePublication("reschedule", socialRescheduleMutationSchema.parse(input.mutation), input.actor, input.env ?? process.env, input.now);
  if (!("scheduledAt" in result)) throw new Error("SOCIAL_OPERATION_OUTCOME_UNKNOWN");
  return result;
}

export async function cancelSocialPublication(input: {
  mutation: z.input<typeof socialOperationMutationSchema>; actor: string; env?: Record<string, string | undefined>;
}) {
  const result = await mutatePublication("cancel", socialOperationMutationSchema.parse(input.mutation), input.actor, input.env ?? process.env);
  if ("scheduledAt" in result) throw new Error("SOCIAL_OPERATION_OUTCOME_UNKNOWN");
  return result;
}
