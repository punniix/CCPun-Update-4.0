import "server-only";
import { randomUUID } from "node:crypto";
import { postPublishWorkerSql } from "./post-publish-queue";
import type { SeoPostPublishJob } from "./post-publish-queue";

type Env = Record<string, string | undefined>;
export type NotificationStep = "gsc-sitemap-submit" | "indexnow" | "inspect-1h" | "inspect-24h";
export async function reserveNotification(job: SeoPostPublishJob, step: NotificationStep, limit: number, env: Env = process.env) {
  const rows = await postPublishWorkerSql(env).query(
    "SELECT ccpun_admin.seo_reserve_notification($1::uuid,$2::uuid,$3,$4::int) AS state",
    [job.job_id, job.lease_id, step, limit],
  );
  return String(rows[0]?.state ?? "denied");
}
export async function finishNotification(job: SeoPostPublishJob, step: NotificationStep, input: {
  state: "succeeded" | "failed" | "uncertain" | "blocked"; errorCode?: string; retryMs?: number; result?: unknown;
}, env: Env = process.env) {
  const sql = postPublishWorkerSql(env);
  const rows = await sql.query(
    `WITH finished AS (UPDATE ccpun_admin.seo_post_publish_step SET state=$4,error_code=$5,result_json=$6::jsonb,
      next_attempt_at=now()+($7::bigint*interval '1 millisecond'),finished_at=now(),lease_id=NULL,lease_until=NULL
      WHERE job_id=$1::uuid AND step=$3 AND state='processing' AND lease_id=$2::uuid AND lease_until>now() RETURNING job_id)
     UPDATE ccpun_admin.seo_post_publish_job SET
      notify_state=CASE WHEN $4 IN ('failed','blocked','uncertain') THEN 'failed'
        WHEN $3='gsc-sitemap-submit' AND $4='succeeded' THEN 'gsc-submitted'
        WHEN $3='indexnow' AND $4='succeeded' THEN 'indexnow-sent' ELSE notify_state END,
      gsc_submit_at=CASE WHEN $3='gsc-sitemap-submit' AND $4='succeeded' THEN now() ELSE gsc_submit_at END,
      indexnow_at=CASE WHEN $3='indexnow' AND $4='succeeded' THEN now() ELSE indexnow_at END,
      inspect_1h_json=CASE WHEN $3='inspect-1h' THEN $6::jsonb ELSE inspect_1h_json END,
      inspect_24h_json=CASE WHEN $3='inspect-24h' THEN $6::jsonb ELSE inspect_24h_json END,
      final_index_state=CASE WHEN $3='inspect-24h' AND $4='succeeded' THEN coalesce($6::jsonb->>'state','unknown')
        WHEN $3='inspect-24h' AND $4='blocked' THEN 'unknown' ELSE final_index_state END,
      updated_at=now() WHERE job_id IN (SELECT job_id FROM finished) RETURNING job_id`,
    [job.job_id, job.lease_id, step, input.state, input.errorCode ?? null, JSON.stringify(input.result ?? null), input.retryMs ?? 0],
  );
  if (rows.length !== 1) throw new Error("SEO_STEP_LEASE_DENIED");
}
export async function scheduleSeoInspections(job: SeoPostPublishJob, env: Env = process.env) {
  await postPublishWorkerSql(env).query(
    `WITH schedule AS (UPDATE ccpun_admin.seo_post_publish_job SET
       inspect_due_1h=coalesce(inspect_due_1h,now()+interval '1 hour'),
       inspect_due_24h=coalesce(inspect_due_24h,now()+interval '24 hours')
       WHERE job_id=$1::uuid AND state='processing' AND lease_id=$2::uuid AND lease_until>now()
       RETURNING job_id,inspect_due_1h,inspect_due_24h)
     INSERT INTO ccpun_admin.seo_post_publish_step(job_id,step,next_attempt_at)
     SELECT job_id,'inspect-1h',inspect_due_1h FROM schedule UNION ALL SELECT job_id,'inspect-24h',inspect_due_24h FROM schedule
     ON CONFLICT DO NOTHING`, [job.job_id, job.lease_id],
  );
}
export async function claimSeoInspection(env: Env = process.env) {
  const sql = postPublishWorkerSql(env);
  await sql.query(`UPDATE ccpun_admin.seo_post_publish_step SET state=CASE WHEN attempts>=3 THEN 'blocked' ELSE 'failed' END,lease_id=NULL,lease_until=NULL,
    next_attempt_at=now()+interval '2 minutes',error_code='inspection-lease-expired'
    WHERE step LIKE 'inspect-%' AND state='processing' AND lease_until<now()`);
  await sql.query(`UPDATE ccpun_admin.seo_post_publish_job j SET final_index_state='unknown'
    WHERE EXISTS(SELECT 1 FROM ccpun_admin.seo_post_publish_step s WHERE s.job_id=j.job_id AND s.step='inspect-24h' AND s.state='blocked')`);
  const rows = await sql.query(
    `WITH due AS (SELECT job_id,step FROM ccpun_admin.seo_post_publish_step
      WHERE step IN ('inspect-1h','inspect-24h') AND state IN ('pending','failed') AND attempts<3 AND next_attempt_at<=now()
      ORDER BY next_attempt_at LIMIT 1 FOR UPDATE SKIP LOCKED), claimed AS (
      UPDATE ccpun_admin.seo_post_publish_step s SET state='processing',attempts=attempts+1,lease_id=$1::uuid,
      lease_until=now()+interval '4 minutes',started_at=now() FROM due
      WHERE s.job_id=due.job_id AND s.step=due.step RETURNING s.*)
     SELECT j.*,claimed.step,claimed.lease_id AS inspection_lease,claimed.attempts AS inspection_attempts
     FROM claimed JOIN ccpun_admin.seo_post_publish_job j USING(job_id)`, [randomUUID()],
  );
  return rows[0] as (SeoPostPublishJob & { step: "inspect-1h" | "inspect-24h"; inspection_lease: string; inspection_attempts: number }) | undefined ?? null;
}
export async function recordSeoWorkerPass(env: Env = process.env) {
  await postPublishWorkerSql(env).query(`INSERT INTO ccpun_admin.seo_post_publish_worker_pass(singleton,checked_at)
    VALUES(true,now()) ON CONFLICT(singleton) DO UPDATE SET checked_at=EXCLUDED.checked_at`);
}

export async function reserveInitialInspection(job: SeoPostPublishJob, env: Env = process.env) {
  const rows = await postPublishWorkerSql(env).query("SELECT ccpun_admin.seo_reserve_initial_inspection($1::uuid,$2::uuid) AS allowed", [job.job_id,job.lease_id]);
  return rows[0]?.allowed === true;
}
export async function deferSeoInspection(job: SeoPostPublishJob, step: NotificationStep, env: Env = process.env) {
  await postPublishWorkerSql(env).query(`UPDATE ccpun_admin.seo_post_publish_step SET state='pending',attempts=greatest(0,attempts-1),
    next_attempt_at=now()+interval '1 hour',lease_id=NULL,lease_until=NULL,error_code='inspection-budget'
    WHERE job_id=$1::uuid AND step=$3 AND state='processing' AND lease_id=$2::uuid AND lease_until>now()`, [job.job_id,job.lease_id,step]);
}
