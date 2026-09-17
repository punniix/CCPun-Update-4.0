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

const mutationRowsSchema = z.array(z.object({
  publication_id: boundedId,
  job_id: boundedId,
  job_version: z.number().int().min(1),
  scheduled_at: z.coerce.date().nullable(),
  publication_status: publicationStatusSchema,
  job_status: jobStatusSchema,
})).max(1);

const replayRowsSchema = z.array(z.object({ audit_id: z.string().min(1) })).max(1);

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

async function hasMutationReplay(sql: SqlClient, auditId: string) {
  const rows = replayRowsSchema.parse(await sql.query(
    `SELECT id AS audit_id FROM ccpun_social.social_execution_audit WHERE id=$1 LIMIT 1`,
    [auditId],
  ));
  return Boolean(rows[0]);
}

async function readMutationState(sql: SqlClient, publicationId: string) {
  return mutationRowsSchema.parse(await sql.query(
    `SELECT publication.id AS publication_id,publication.status AS publication_status,publication.scheduled_at,
       job.id AS job_id,job.status AS job_status,job.version AS job_version
     FROM ccpun_social.social_publication AS publication
     JOIN LATERAL (
       SELECT * FROM ccpun_social.social_publication_job
       WHERE publication_id=publication.id ORDER BY created_at DESC,id DESC LIMIT 1
     ) AS job ON true
     WHERE publication.id=$1 LIMIT 1`,
    [publicationId],
  ))[0] ?? null;
}

export async function rescheduleSocialPublication(input: {
  mutation: z.input<typeof socialRescheduleMutationSchema>;
  actor: string;
  env?: Record<string, string | undefined>;
  now?: Date;
}) {
  const mutation = socialRescheduleMutationSchema.parse(input.mutation);
  const env = input.env ?? process.env;
  const now = input.now ?? new Date();
  const scheduledAt = new Date(mutation.scheduledAt);
  if (scheduledAt.getTime() <= now.getTime() + 60_000) throw new Error("SOCIAL_RESCHEDULE_REQUIRES_FUTURE_TIME");
  const sql = await verifiedSql(env);
  const auditId = `audit:${mutation.idempotencyKey}:reschedule`;
  if (await hasMutationReplay(sql, auditId)) {
    const replay = await readMutationState(sql, mutation.publicationId);
    if (!replay) throw new Error("SOCIAL_PUBLICATION_NOT_FOUND");
    return { state: "replay" as const, publicationId: replay.publication_id, jobId: replay.job_id, jobVersion: replay.job_version, scheduledAt: replay.scheduled_at?.toISOString() ?? null };
  }
  const actorRef = safeActorRef(input.actor);
  const rows = mutationRowsSchema.parse(await sql.query(
    `WITH eligible AS MATERIALIZED (
       SELECT publication.id AS publication_id,job.id AS job_id
       FROM ccpun_social.social_publication AS publication
       JOIN ccpun_social.social_variant_link AS variant ON variant.variant_id=publication.variant_id
       JOIN LATERAL (
         SELECT * FROM ccpun_social.social_publication_job
         WHERE publication_id=publication.id ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE
       ) AS job ON true
       WHERE publication.id=$1 AND job.version=$2 AND variant.channel='facebook'
         AND publication.execution_target='facebook-native-scheduled'
         AND publication.platform_object_id IS NULL AND job.attempt_count=0
         AND publication.status IN ('approved','failed','cancelled','superseded')
         AND job.status IN ('queued','failed','cancelled')
       FOR UPDATE OF publication
     ), amended_publication AS (
       UPDATE ccpun_social.social_publication
       SET status='approved',scheduled_at=$3::timestamptz,platform_object_id=NULL,published_at=NULL,updated_at=now()
       WHERE id=(SELECT publication_id FROM eligible) RETURNING id,status,scheduled_at
     ), amended_job AS (
       UPDATE ccpun_social.social_publication_job
       SET status='queued',version=version+1,attempt_count=0,lock_owner=NULL,locked_at=NULL,lock_expires_at=NULL,
         last_error_category=NULL,last_error_ref=NULL,updated_at=now()
       WHERE id=(SELECT job_id FROM eligible) AND version=$2
       RETURNING id,status,version
     ), audit AS (
       INSERT INTO ccpun_social.social_execution_audit
         (id,actor_type,actor_ref,action,object_type,object_id,request_ref,outcome)
       SELECT $6,'human',$4,'publication:reschedule','publication',$1,$5,'succeeded'
       FROM amended_publication CROSS JOIN amended_job ON CONFLICT (id) DO NOTHING RETURNING id
     )
     SELECT amended_publication.id AS publication_id,amended_publication.status AS publication_status,
       amended_publication.scheduled_at,amended_job.id AS job_id,amended_job.status AS job_status,
       amended_job.version AS job_version
     FROM amended_publication CROSS JOIN amended_job
     WHERE EXISTS (SELECT 1 FROM audit)`,
    [mutation.publicationId, mutation.expectedJobVersion, mutation.scheduledAt, actorRef, mutation.idempotencyKey, auditId],
  ));
  const row = rows[0];
  if (!row) {
    const current = await readMutationState(sql, mutation.publicationId);
    if (!current) throw new Error("SOCIAL_PUBLICATION_NOT_FOUND");
    if (current.job_version !== mutation.expectedJobVersion) throw new Error("SOCIAL_OPERATION_CAS_CONFLICT");
    throw new Error("SOCIAL_RESCHEDULE_NOT_ALLOWED");
  }
  return { state: "rescheduled" as const, publicationId: row.publication_id, jobId: row.job_id, jobVersion: row.job_version, scheduledAt: row.scheduled_at?.toISOString() ?? null };
}

export async function cancelSocialPublication(input: {
  mutation: z.input<typeof socialOperationMutationSchema>;
  actor: string;
  env?: Record<string, string | undefined>;
}) {
  const mutation = socialOperationMutationSchema.parse(input.mutation);
  const env = input.env ?? process.env;
  const sql = await verifiedSql(env);
  const auditId = `audit:${mutation.idempotencyKey}:cancel`;
  if (await hasMutationReplay(sql, auditId)) {
    const replay = await readMutationState(sql, mutation.publicationId);
    if (!replay) throw new Error("SOCIAL_PUBLICATION_NOT_FOUND");
    return { state: "replay" as const, publicationId: replay.publication_id, jobId: replay.job_id, jobVersion: replay.job_version };
  }
  const actorRef = safeActorRef(input.actor);
  const rows = mutationRowsSchema.parse(await sql.query(
    `WITH eligible AS MATERIALIZED (
       SELECT publication.id AS publication_id,job.id AS job_id
       FROM ccpun_social.social_publication AS publication
       JOIN ccpun_social.social_variant_link AS variant ON variant.variant_id=publication.variant_id
       JOIN LATERAL (
         SELECT * FROM ccpun_social.social_publication_job
         WHERE publication_id=publication.id ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE
       ) AS job ON true
       WHERE publication.id=$1 AND job.version=$2 AND variant.channel='facebook'
         AND publication.execution_target='facebook-native-scheduled'
         AND publication.platform_object_id IS NULL AND job.attempt_count=0
         AND publication.status IN ('approved','failed','cancelled','superseded')
         AND job.status IN ('queued','failed','cancelled')
       FOR UPDATE OF publication
     ), cancelled_publication AS (
       UPDATE ccpun_social.social_publication SET status='cancelled',updated_at=now()
       WHERE id=(SELECT publication_id FROM eligible) RETURNING id,status,scheduled_at
     ), cancelled_job AS (
       UPDATE ccpun_social.social_publication_job
       SET status='cancelled',version=version+1,lock_owner=NULL,locked_at=NULL,lock_expires_at=NULL,
         last_error_category=NULL,last_error_ref=NULL,updated_at=now()
       WHERE id=(SELECT job_id FROM eligible) AND version=$2 RETURNING id,status,version
     ), audit AS (
       INSERT INTO ccpun_social.social_execution_audit
         (id,actor_type,actor_ref,action,object_type,object_id,request_ref,outcome)
       SELECT $3,'human',$4,'publication:cancel','publication',$1,$5,'succeeded'
       FROM cancelled_publication CROSS JOIN cancelled_job ON CONFLICT (id) DO NOTHING RETURNING id
     )
     SELECT cancelled_publication.id AS publication_id,cancelled_publication.status AS publication_status,
       cancelled_publication.scheduled_at,cancelled_job.id AS job_id,cancelled_job.status AS job_status,
       cancelled_job.version AS job_version
     FROM cancelled_publication CROSS JOIN cancelled_job
     WHERE EXISTS (SELECT 1 FROM audit)`,
    [mutation.publicationId, mutation.expectedJobVersion, auditId, actorRef, mutation.idempotencyKey],
  ));
  const row = rows[0];
  if (!row) {
    const current = await readMutationState(sql, mutation.publicationId);
    if (!current) throw new Error("SOCIAL_PUBLICATION_NOT_FOUND");
    if (current.job_version !== mutation.expectedJobVersion) throw new Error("SOCIAL_OPERATION_CAS_CONFLICT");
    throw new Error("SOCIAL_CANCEL_NOT_ALLOWED");
  }
  return { state: "cancelled" as const, publicationId: row.publication_id, jobId: row.job_id, jobVersion: row.job_version };
}
