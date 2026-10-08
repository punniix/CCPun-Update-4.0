import "server-only";
import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { isUatPostPublishMockAllowed, UAT_POST_PUBLISH_MOCK_ID, UAT_POST_PUBLISH_MOCK_VERSION } from "./post-publish-uat-policy";

type Row = { job_id: string; state: string; attempts: number; owner_approved: boolean; sitemap_attempted: boolean; source: string; actor: string };

function db(env: Record<string, string | undefined> = process.env) {
  if (!isUatPostPublishMockAllowed(env)) throw new Error("UAT_POST_PUBLISH_MOCK_DENIED");
  return neon(env.CCPUN_ADMIN_DATABASE_URL!, { fetchOptions: { signal: AbortSignal.timeout(10_000) } });
}

export async function enqueueUatPostPublishMock(env: Record<string, string | undefined> = process.env) {
  const sql = db(env);
  // Identity is checked again by Neon itself, not only by user-set env variables.
  const identity = await sql.query("SELECT current_user AS role, current_database() AS db");
  if (identity[0]?.role !== "ccpun_admin_runtime" || identity[0]?.db !== "neondb")
    throw new Error("UAT_MOCK_DB_ROLE_DENIED");
  const rows = await sql.query(
    `INSERT INTO ccpun_admin.seo_post_publish_job
       (article_id, content_version, source, actor, owner_approved, request_id)
       VALUES ($1, $2::timestamptz, 'reconciler', 'uat-safe-postpublish-mock', false, $3::uuid)
       ON CONFLICT (article_id, content_version) DO NOTHING
       RETURNING job_id, state, attempts, owner_approved, sitemap_attempted, source, actor`,
    [UAT_POST_PUBLISH_MOCK_ID, UAT_POST_PUBLISH_MOCK_VERSION, randomUUID()],
  );
  const receipt = rows.length ? rows : await sql.query(
    "SELECT job_id,state,attempts,owner_approved,sitemap_attempted,source,actor FROM ccpun_admin.seo_post_publish_job WHERE article_id=$1 AND content_version=$2::timestamptz LIMIT 1",
    [UAT_POST_PUBLISH_MOCK_ID, UAT_POST_PUBLISH_MOCK_VERSION],
  );
  return safeReceipt(receipt[0] as Row | undefined);
}

export async function readUatPostPublishMock(env: Record<string, string | undefined> = process.env) {
  const sql = db(env);
  const rows = await sql.query(
    "SELECT job_id,state,attempts,owner_approved,sitemap_attempted,source,actor FROM ccpun_admin.seo_post_publish_job WHERE article_id=$1 AND content_version=$2::timestamptz LIMIT 1",
    [UAT_POST_PUBLISH_MOCK_ID, UAT_POST_PUBLISH_MOCK_VERSION],
  );
  return rows.length ? safeReceipt(rows[0] as Row) : null;
}

function safeReceipt(row?: Row) {
  if (!row || row.owner_approved || row.sitemap_attempted || row.source !== "reconciler" || row.actor !== "uat-safe-postpublish-mock")
    throw new Error("UAT_MOCK_RECEIPT_VIOLATION");
  return { jobId: row.job_id, state: row.state, attempts: row.attempts, mock: true, ownerApproved: false, googleWrites: 0 };
}
