import "server-only";
import { postPublishProducerSql } from "./post-publish-queue";
import { getPublishedSeoObservationArticle } from "../sanity-control";
import { approvedPublishedArticle } from "./post-publish-network";
type Env = Record<string,string|undefined>;
export function searchConsoleInspectionLink(url: string) {
  return `https://search.google.com/search-console/inspect?resource_id=sc-domain%3Accpun.com&id=${encodeURIComponent(url)}`;
}
export async function readPostPublishHealth(env: Env = process.env) {
  try {
    const rows = await postPublishProducerSql(env).query(`SELECT
      (SELECT max(created_at) FROM ccpun_admin.seo_post_publish_intent WHERE origin='webhook') AS last_webhook,
      (SELECT checked_at FROM ccpun_admin.seo_post_publish_worker_pass WHERE singleton=true) AS last_worker,
      count(*) FILTER(WHERE state IN ('retry-required','queued') AND attempts>0)::int AS retries,
      (count(*) FILTER(WHERE state='reconciliation-required')+(SELECT count(*) FROM ccpun_admin.seo_gsc_window WHERE state IN ('uncertain','reconciling') OR last_error_code='gsc-uncertain-exhausted'))::int AS reconciliation
      FROM ccpun_admin.seo_post_publish_job`);
    return rows[0] as {last_webhook:string|null;last_worker:string|null;retries:number;reconciliation:number}|undefined;
  } catch { return undefined; }
}
export async function readLastPostPublishJobs(env: Env = process.env) {
  try {
    const rows = await postPublishProducerSql(env).query(`SELECT j.job_id,j.article_id,j.content_version,j.state,j.result_json,
      j.gsc_submit_at,j.indexnow_at,j.inspect_1h_json,j.inspect_24h_json,j.final_index_state,j.last_error_code,
      (SELECT CASE WHEN s.state='blocked' THEN 'blocked' WHEN w.state IN ('uncertain','reconciling') THEN 'reconciling' WHEN w.state IN ('pending','failed') THEN 'waiting'
        WHEN w.state='validating' THEN 'validating' WHEN w.state='blocked' THEN 'blocked' ELSE s.state END
        FROM ccpun_admin.seo_post_publish_step s LEFT JOIN ccpun_admin.seo_gsc_window w ON w.window_id=s.gsc_window_id
        WHERE s.job_id=j.job_id AND s.step='gsc-sitemap-submit') AS gsc_state,
      (SELECT CASE WHEN s.state='blocked' THEN s.error_code ELSE coalesce(w.last_error_code,s.error_code) END FROM ccpun_admin.seo_post_publish_step s LEFT JOIN ccpun_admin.seo_gsc_window w ON w.window_id=s.gsc_window_id
        WHERE s.job_id=j.job_id AND s.step='gsc-sitemap-submit') AS gsc_error,
      (SELECT state FROM ccpun_admin.seo_post_publish_step s WHERE s.job_id=j.job_id AND s.step='indexnow') AS indexnow_state
      FROM ccpun_admin.seo_post_publish_job j ORDER BY j.created_at DESC LIMIT 30`);
    return await Promise.all(rows.map(async (row: Record<string, unknown>): Promise<Record<string, unknown> & {title:string;url:string|null}> => {
      const article = await getPublishedSeoObservationArticle(String(row.article_id));
      return {...row,title:article?.title??'บทความที่ไม่พร้อมอ่าน',url:article?approvedPublishedArticle(article):null};
    }));
  } catch { return null; }
}
