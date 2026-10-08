import "server-only";

import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { z } from "zod";
import {
  adminOperationsRuntimeInputFromEnvironment, resolveAdminOperationsRuntimeIdentity,
} from "@/lib/admin/operations/foundation";
import { getPublishedSeoObservationArticle, listRecentPublishedSeoObservationArticles } from "@/lib/admin/sanity-control";
import { approvedPublishedArticle } from "./post-publish-network";
import { workerDatabaseIdentity } from "./post-publish-worker-policy";
import { isGscSitemapWriteApproved } from "./gsc-sitemap-write-policy";

const states = ["queued", "processing", "completed", "retry-required", "reconciliation-required"] as const;
const rowSchema = z.object({
  job_id: z.string().uuid(), article_id: z.string(), content_version: z.union([z.date(), z.string()]),
  state: z.enum(states), source: z.enum(["owner", "reconciler"]), actor: z.string(),
  owner_approved: z.boolean(), attempts: z.number().int(), sitemap_attempted: z.boolean(),
  lease_id: z.string().uuid().nullish(), result_json: z.unknown().nullable().optional(),
});
export type SeoPostPublishJob = z.infer<typeof rowSchema>;
type Env = Record<string, string | undefined>;


function sqlForProducer(env: Env = process.env) {
  if (env.CCPUN_SEO_POST_PUBLISH_QUEUE_ENABLED !== "1"
    || env.CCPUN_APP_ENV !== "production-admin"
    || !resolveAdminOperationsRuntimeIdentity(adminOperationsRuntimeInputFromEnvironment(env))) {
    throw new Error("SEO_POST_PUBLISH_QUEUE_UNAVAILABLE");
  }
  return neon(env.CCPUN_ADMIN_DATABASE_URL!, { fetchOptions: { signal: AbortSignal.timeout(10_000) } });
}
function sqlForWorker(env: Env = process.env) {
  if (!workerDatabaseIdentity(env)) throw new Error("SEO_POST_PUBLISH_WORKER_DENIED");
  return neon(env.CCPUN_SEO_POST_PUBLISH_DATABASE_URL!, { fetchOptions: { signal: AbortSignal.timeout(10_000) } });
}

export async function enqueuePublishedSeoArticle(input: {
  articleId: string; actor: string; ownerApproved: boolean; source: "owner" | "reconciler"; requestId?: string;
}, env: Env = process.env) {
  const article = await getPublishedSeoObservationArticle(input.articleId);
  if (!article || article.noindex === true || !approvedPublishedArticle(article)) return null;
  const sql = sqlForProducer(env);
  const rows = rowSchema.array().max(1).parse(await sql.query(
    `INSERT INTO ccpun_admin.seo_post_publish_job
      (article_id, content_version, source, actor, owner_approved, request_id)
     VALUES ($1,$2::timestamptz,$3,$4,$5,$6::uuid)
     ON CONFLICT (article_id,content_version) DO UPDATE SET
       owner_approved = ccpun_admin.seo_post_publish_job.owner_approved OR EXCLUDED.owner_approved
     RETURNING job_id,article_id,content_version,state,source,actor,owner_approved,attempts,sitemap_attempted,lease_id,result_json`,
    [article.id, article.updatedAt, input.source, input.actor, input.ownerApproved, input.requestId ?? randomUUID()],
  ));
  return rows[0] ?? null;
}

export async function readPublishedSeoJob(articleId: string, env: Env = process.env) {
  const sql = sqlForProducer(env);
  const rows = rowSchema.array().max(1).parse(await sql.query(
    `SELECT job_id,article_id,content_version,state,source,actor,owner_approved,attempts,sitemap_attempted,lease_id,result_json
     FROM ccpun_admin.seo_post_publish_job WHERE article_id=$1
     ORDER BY content_version DESC LIMIT 1`,
    [articleId],
  ));
  return rows[0] ?? null;
}

export async function claimPublishedSeoJob(env: Env = process.env): Promise<SeoPostPublishJob | null> {
  const sql = sqlForWorker(env);
  await sql.query(
    `UPDATE ccpun_admin.seo_post_publish_job SET state='reconciliation-required', lease_id=NULL,
      last_error_code='SEO_LEASE_EXPIRED',lease_until=NULL,updated_at=now()
      WHERE state='processing' AND lease_until<now()`,
  );
  // If the private reconciler completed a read-only job before its owner's
  // delayed approval, requeue it only after the separate GSC write gate opens.
  if (isGscSitemapWriteApproved(env)) {
    await sql.query(
      `UPDATE ccpun_admin.seo_post_publish_job
       SET state='queued',next_attempt_at=now(),updated_at=now()
       WHERE state='completed' AND source='reconciler' AND owner_approved=true
         AND sitemap_attempted=false AND result_json->>'sitemapSubmission'='skipped'`,
    );
  }
  const rows = rowSchema.array().max(1).parse(await sql.query(
    `WITH eligible AS (
       SELECT job_id FROM ccpun_admin.seo_post_publish_job
       WHERE state='queued' AND next_attempt_at<=now()
       ORDER BY next_attempt_at,created_at LIMIT 1 FOR UPDATE SKIP LOCKED
     )
     UPDATE ccpun_admin.seo_post_publish_job AS job
     SET state='processing',attempts=attempts+1,lease_id=$1::uuid,
       lease_until=now()+interval '4 minutes',updated_at=now()
     FROM eligible WHERE job.job_id=eligible.job_id
     RETURNING job.job_id,job.article_id,job.content_version,job.state,job.source,
       job.actor,job.owner_approved,job.attempts,job.sitemap_attempted,job.lease_id,job.result_json`,
    [randomUUID()],
  ));
  return rows[0] ?? null;
}

export async function markSitemapAttempt(job: SeoPostPublishJob, env: Env = process.env) {
  const sql = sqlForWorker(env);
  const rows = await sql.query(
    `UPDATE ccpun_admin.seo_post_publish_job SET sitemap_attempted=true,updated_at=now()
     WHERE job_id=$1::uuid AND state='processing' AND lease_id=$2::uuid
       AND lease_until>now() AND sitemap_attempted=false RETURNING job_id`,
    [job.job_id, job.lease_id],
  );
  if (rows.length !== 1) throw new Error("SEO_SUBMISSION_LEASE_DENIED");
}

export async function finishPublishedSeoJob(
  job: SeoPostPublishJob,
  result: { outcome: "completed" | "retry" | "reconciliation-required"; errorCode?: string; receipt?: unknown },
  env: Env = process.env,
) {
  const sql = sqlForWorker(env);
  const receipt = result.receipt ? JSON.stringify(result.receipt) : null;
  const rows = await sql.query(
    `UPDATE ccpun_admin.seo_post_publish_job
     SET state=CASE
       WHEN $3='completed' THEN 'completed'
       WHEN $3='reconciliation-required' OR sitemap_attempted THEN 'reconciliation-required'
       WHEN attempts>=3 THEN 'retry-required' ELSE 'queued' END,
       next_attempt_at=CASE WHEN $3='retry' AND attempts<3
          THEN now() + (interval '30 seconds' * power(2,attempts)) ELSE next_attempt_at END,
       last_error_code=$4, result_json=$5::jsonb, lease_id=NULL,lease_until=NULL, updated_at=now()
     WHERE job_id=$1::uuid AND state='processing' AND lease_id=$2::uuid AND lease_until>now()
     RETURNING job_id`,
    [job.job_id, job.lease_id, result.outcome, result.errorCode ?? null, receipt],
  );
  if (rows.length !== 1) throw new Error("SEO_COMPLETION_LEASE_DENIED");
}

// Reconcile missed browser dispatches and owner-authorized scheduled publications.
// Recovery is observation-only: it NEVER grants Google Sitemap write permission.
export async function reconcilePublishedSeoJobs(env: Env = process.env): Promise<number> {
  const sql = sqlForWorker(env);
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const articles = await listRecentPublishedSeoObservationArticles(since);
  let inserted = 0;
  for (const article of articles) {
    if (article.noindex === true || !approvedPublishedArticle(article)) continue;
    const rows = await sql.query(
      `INSERT INTO ccpun_admin.seo_post_publish_job
        (article_id,content_version,source,owner_approved,actor,request_id)
       VALUES($1,$2::timestamptz,'reconciler',false,'vps-reconciler',$3::uuid)
       ON CONFLICT(article_id,content_version) DO NOTHING RETURNING job_id`,
      [article.id, article.updatedAt, randomUUID()],
    );
    inserted += rows.length;
  }
  return inserted;
}
