import "server-only";

import { neon } from "@neondatabase/serverless";
import { z } from "zod";
import { ARTICLE_SCHEDULER_CHECKSUM, ARTICLE_SCHEDULER_MIGRATION } from "../../../db/migrations/20260911_article_scheduling_v1";
import { getSocialDatabaseReadiness } from "../social/database";
import { resolveSocialRuntime, SOCIAL_UAT_RUNTIME_BRANCHES } from "../social/runtime";
import { resolveArticleSchedulerLane, SCHEDULER_LANES, SCHEDULER_ROLE, scheduleStatusSchema } from "./article-schedule-contract";

const timestamp = z.union([z.string(), z.date()]).transform((value) => new Date(value).toISOString());

const articleRowSchema = z.object({
  article_id: z.string().min(1).max(128),
  generation: z.string().uuid(),
  status: scheduleStatusSchema,
  mode: z.enum(["publish", "validate-only"]),
  scheduled_at: timestamp,
  workflow_run_id: z.string().nullable(),
  execution_id: z.string().uuid().nullable(),
  lease_expires_at: timestamp.nullable(),
  updated_at: timestamp,
  completed_at: timestamp.nullable(),
  error_code: z.string().nullable(),
});

const socialRowSchema = z.object({
  job_id: z.string().min(1).max(120),
  publication_id: z.string().min(1).max(120),
  job_type: z.enum(["native-handoff", "publish", "status-sync", "analytics-sync", "comment-series"]),
  job_status: z.enum(["queued", "processing", "succeeded", "failed", "cancelled"]),
  attempt_count: z.coerce.number().int().nonnegative(),
  max_attempts: z.coerce.number().int().positive(),
  locked: z.boolean(),
  lock_expires_at: timestamp.nullable(),
  last_error_category: z.string().nullable(),
  updated_at: timestamp,
  publication_status: z.string(),
  scheduled_at: timestamp.nullable(),
  channel: z.string(),
  format: z.string(),
});

export type OperationsJob = {
  source: "article-scheduler" | "social-publication";
  id: string;
  objectId: string;
  kind: string;
  status: string;
  scheduledAt: string | null;
  updatedAt: string;
  completedAt: string | null;
  attempts: { current: number; max: number } | null;
  locked: boolean;
  lockExpiresAt: string | null;
  error: string | null;
  detail: string;
};

export type JobsReadModel = {
  status: "ready" | "partial" | "unavailable";
  articleScheduler: { ready: boolean; count: number; jobs: OperationsJob[]; error: string | null };
  socialPublication: { ready: boolean; count: number; jobs: OperationsJob[]; error: string | null };
  jobs: OperationsJob[];
};

async function readArticleJobs(limit: number, env: Record<string, string | undefined>) {
  const lane = resolveArticleSchedulerLane(env);
  if (!lane) throw new Error("scheduler-lane-not-ready");
  const expected = SCHEDULER_LANES[lane];
  const connectionString = env.CCPUN_ADMIN_DATABASE_URL?.trim();
  if (!connectionString) throw new Error("scheduler-database-not-configured");
  const sql = neon(connectionString, { fetchOptions: { signal: AbortSignal.timeout(5_000) } });
  const identity = z.array(z.object({
    database_name: z.literal("neondb"),
    role_name: z.literal(SCHEDULER_ROLE),
    lane: z.literal(lane),
    project_id: z.literal(expected.projectId),
    branch_id: z.literal(expected.branchId),
    endpoint_id: z.literal(expected.endpointId),
    migration_version: z.literal(ARTICLE_SCHEDULER_MIGRATION),
    migration_checksum: z.literal(ARTICLE_SCHEDULER_CHECKSUM),
  })).length(1).parse(await sql.query(
    `SELECT current_database() AS database_name,current_user AS role_name,lane,project_id,branch_id,endpoint_id,migration_version,migration_checksum
     FROM ccpun_admin.article_scheduler_identity WHERE singleton=true`,
  ));
  if (!identity[0]) throw new Error("scheduler-identity-mismatch");
  const rows = z.array(articleRowSchema).parse(await sql.query(
    `SELECT article_id,generation,status,mode,scheduled_at,workflow_run_id,execution_id,lease_expires_at,updated_at,completed_at,error_code
     FROM ccpun_admin.article_schedule ORDER BY updated_at DESC LIMIT $1`,
    [limit],
  ));
  const now = Date.now();
  return rows.map((row): OperationsJob => {
    const leaseExpired = row.status === "executing" && (!row.lease_expires_at || Date.parse(row.lease_expires_at) <= now);
    return {
      source: "article-scheduler",
      id: row.generation,
      objectId: row.article_id,
      kind: row.mode === "publish" ? "Article publish" : "Article validation",
      status: leaseExpired ? "reconciliation-required" : row.status,
      scheduledAt: row.scheduled_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
      attempts: null,
      locked: row.status === "executing" && !leaseExpired,
      lockExpiresAt: row.lease_expires_at,
      error: leaseExpired ? "EXECUTION_OUTCOME_UNKNOWN" : row.error_code,
      detail: row.workflow_run_id ? `workflow ${row.workflow_run_id}` : "ยังไม่มี workflow run",
    };
  });
}

async function readSocialJobs(limit: number, env: Record<string, string | undefined>) {
  const readiness = await getSocialDatabaseReadiness(env.CCPUN_SOCIAL_DATABASE_URL?.trim(), env);
  if (!readiness.reachable || !readiness.migrationCurrent) throw new Error(readiness.errorCategory ?? "social-database-not-ready");
  const runtime = resolveSocialRuntime(env, { uatBranches: SOCIAL_UAT_RUNTIME_BRANCHES, requireUatNeon: true });
  if (!runtime) throw new Error("social-runtime-identity-mismatch");
  const connectionString = env.CCPUN_SOCIAL_DATABASE_URL?.trim();
  if (!connectionString) throw new Error("social-database-not-configured");
  const sql = neon(connectionString, { fetchOptions: { signal: AbortSignal.timeout(5_000) } });
  const identity = z.array(z.object({
    database_name: z.literal(runtime.neonIdentity.database),
    role_name: z.literal(runtime.neonIdentity.role),
    identity_current: z.boolean(),
  })).length(1).parse(await sql.query(
    `SELECT current_database() AS database_name,current_user AS role_name,
       EXISTS (SELECT 1 FROM ccpun_social.system_identity WHERE singleton=true AND project_id=$1 AND branch_id=$2 AND endpoint_id=$3 AND database_name=$4) AS identity_current`,
    [runtime.neonIdentity.projectId, runtime.neonIdentity.branchId, runtime.neonIdentity.endpointId, runtime.neonIdentity.database],
  ));
  if (!identity[0]?.identity_current) throw new Error("social-runtime-identity-mismatch");
  const rows = z.array(socialRowSchema).parse(await sql.query(
    `SELECT job.id AS job_id,job.publication_id,job.job_type,job.status AS job_status,
       job.attempt_count,job.max_attempts,(job.lock_owner IS NOT NULL) AS locked,job.lock_expires_at,
       job.last_error_category,job.updated_at,publication.status AS publication_status,publication.scheduled_at,
       variant.channel,variant.format
     FROM ccpun_social.social_publication_job AS job
     JOIN ccpun_social.social_publication AS publication ON publication.id=job.publication_id
     JOIN ccpun_social.social_variant_link AS variant ON variant.variant_id=publication.variant_id
     ORDER BY job.updated_at DESC LIMIT $1`,
    [limit],
  ));
  return rows.map((row): OperationsJob => ({
    source: "social-publication",
    id: row.job_id,
    objectId: row.publication_id,
    kind: `${row.channel} · ${row.format} · ${row.job_type}`,
    status: row.job_status,
    scheduledAt: row.scheduled_at,
    updatedAt: row.updated_at,
    completedAt: row.job_status === "succeeded" || row.job_status === "cancelled" ? row.updated_at : null,
    attempts: { current: row.attempt_count, max: row.max_attempts },
    locked: row.locked,
    lockExpiresAt: row.lock_expires_at,
    error: row.last_error_category,
    detail: `publication ${row.publication_status}`,
  }));
}

export async function readOperationsJobs(
  limit = 30,
  env: Record<string, string | undefined> = process.env,
): Promise<JobsReadModel> {
  const boundedLimit = Math.max(1, Math.min(50, Math.trunc(limit)));
  const [article, social] = await Promise.allSettled([
    readArticleJobs(boundedLimit, env),
    readSocialJobs(boundedLimit, env),
  ]);
  const articleJobs = article.status === "fulfilled" ? article.value : [];
  const socialJobs = social.status === "fulfilled" ? social.value : [];
  const jobs = [...articleJobs, ...socialJobs]
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, boundedLimit);
  const articleReady = article.status === "fulfilled";
  const socialReady = social.status === "fulfilled";
  return {
    status: articleReady && socialReady ? "ready" : articleReady || socialReady ? "partial" : "unavailable",
    articleScheduler: {
      ready: articleReady,
      count: articleJobs.length,
      jobs: articleJobs,
      error: article.status === "rejected" ? String(article.reason instanceof Error ? article.reason.message : article.reason) : null,
    },
    socialPublication: {
      ready: socialReady,
      count: socialJobs.length,
      jobs: socialJobs,
      error: social.status === "rejected" ? String(social.reason instanceof Error ? social.reason.message : social.reason) : null,
    },
    jobs,
  };
}
