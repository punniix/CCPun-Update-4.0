import "server-only";
import { getPublishedSeoObservationArticle } from "../sanity-control";
import { approvedPublishedArticle, BLOG_SITEMAP_URL } from "./post-publish-network";
import { emptyGoogleInspection, verifyPublishedArticleSeo } from "./post-publish";
import { getGoogleDataAccessToken } from "./google-data-auth";
import { getGscSitemapWriteToken, isGscSitemapWriteApproved } from "./gsc-sitemap-write-auth";
import { inspectGscIndexedUrl, submitGscSitemap } from "./providers/gsc";
import { indexNowBudget, indexNowEnabled, submitIndexNow } from "./providers/indexnow";
import { reserveNotification, finishNotification, scheduleSeoInspections, claimSeoInspection, reserveInitialInspection, deferSeoInspection } from "./post-publish-notification-store";
import { writeSeoTelemetry } from "./post-publish-telemetry";
import { workerDatabaseIdentity } from "./post-publish-worker-policy";
import type { SeoPostPublishJob } from "./post-publish-queue";
import type { PostPublishSeoPipelineResult } from "./post-publish-runner";

export const GSC_NOTIFICATION_SITEMAP = "https://ccpun.com/sitemap.xml";
type Env = Record<string, string | undefined>;
function gscBudget(env: Env) {
  const quota = Number(env.CCPUN_GSC_SITEMAP_DAILY_BUDGET ?? 0);
  return Number.isSafeInteger(quota) && quota > 0 ? Math.min(20, Math.floor(quota * 0.8)) : 0;
}
export const notificationDependencies = {
  readArticle: getPublishedSeoObservationArticle, verify: verifyPublishedArticleSeo,
  initialBudget: reserveInitialInspection, defer: deferSeoInspection, reserve: reserveNotification, finish: finishNotification, schedule: scheduleSeoInspections,
  readToken: getGoogleDataAccessToken, writeToken: getGscSitemapWriteToken,
  inspect: inspectGscIndexedUrl, submitSitemap: submitGscSitemap, indexNow: submitIndexNow, telemetry: writeSeoTelemetry,
};

/** Called only by the existing, source-pinned private worker. Cloud producer never imports this. */
export async function runDurablePostPublishNotifications(job: SeoPostPublishJob, env: Env = process.env, deps = notificationDependencies): Promise<PostPublishSeoPipelineResult | null> {
  if (!workerDatabaseIdentity(env)) throw new Error("SEO_POST_PUBLISH_WORKER_DENIED");
  const safeTelemetry: typeof deps.telemetry = async (...args) => { try { await deps.telemetry(...args); } catch { console.warn("SEO_OPS_TELEMETRY_UNAVAILABLE"); } };
  const article = await deps.readArticle(job.article_id);
  const version = job.content_version instanceof Date ? job.content_version.toISOString() : job.content_version;
  if (!article || article.noindex || Date.parse(article.updatedAt) !== Date.parse(version)) return null;
  const url = approvedPublishedArticle(article); if (!url) return null;
  const publicationIntent = job.source === "owner" && job.owner_approved || job.notification_approved === true;
  const authorized = article.reviewStatus === "approved" && publicationIntent;
  if (publicationIntent && !authorized) return null;
  const detail = { articleId: article.id, path: new URL(url).pathname };
  if (job.notification_approved) await safeTelemetry({ jobId: job.job_id, step: "webhook-received", status: "succeeded", detail }, env);
  const verification = await deps.verify({ articleId: article.id, url, expectedLastmod: article.updatedAt, sitemapUrl: BLOG_SITEMAP_URL });
  const live = [verification.live, verification.canonical, verification.indexability, verification.sitemap].every(check => check.state === "pass");
  await safeTelemetry({ jobId: job.job_id, step: "live-gate", status: live ? "succeeded" : "warning", detail: { ...detail, ...(verification.live.httpStatus ? { httpStatus: verification.live.httpStatus } : {}) } }, env);
  let google = emptyGoogleInspection("Read-only inspection unavailable.");
  // Observation survives disabled notification flags and never acquires a write token.
  if (env.CCPUN_GSC_SITE_URL === "sc-domain:ccpun.com" && await deps.initialBudget(job, env)) {
    try { google = await deps.inspect({ siteUrl: "sc-domain:ccpun.com", inspectionUrl: url, token: await deps.readToken(env) }); } catch { /* optional observation */ }
  }
  const result: PostPublishSeoPipelineResult = { ...verification, google,
    sitemapSubmission: { state: "skipped", submittedAt: null, limitation: "Notifications are disabled or this observation has no approved publication intent." },
    notificationOutcome: live ? "completed" : "retry" };
  if (!live || !authorized) return result;
  await deps.schedule(job, env);
  const retry = (milliseconds: number, code: string) => {
    result.notificationOutcome = "retry"; result.retryAfterMs = Math.max(result.retryAfterMs ?? 0, milliseconds); result.notificationError = code;
  };
  if (isGscSitemapWriteApproved(env)) {
    const reservation = await deps.reserve(job, "gsc-sitemap-submit", gscBudget(env), env);
    if (reservation === "reserved") {
      try {
        const token = await deps.writeToken(env);
        const submitted = await deps.submitSitemap({ siteUrl: "sc-domain:ccpun.com", sitemapUrl: GSC_NOTIFICATION_SITEMAP, token });
        await deps.finish(job, "gsc-sitemap-submit", { state: "succeeded", result: { submittedAt: submitted.submittedAt } }, env);
        result.sitemapSubmission = { state: "submitted", submittedAt: submitted.submittedAt, limitation: "Sitemap accepted; no individual indexing request or crawl is guaranteed." };
      } catch (error) {
        const code = error instanceof Error ? error.message : "GSC_UNKNOWN";
        const auth = ["GSC_AUTH_REQUIRED", "GSC_SITEMAP_AUTH_REQUIRED"].includes(code);
        const knownRetry = ["GSC_RATE_LIMITED", "GSC_RETRYABLE_RESPONSE"].includes(code);
        await deps.finish(job, "gsc-sitemap-submit", { state: auth ? "blocked" : knownRetry ? "failed" : "uncertain", errorCode: auth ? "gsc-auth-required" : knownRetry ? "gsc-rate-limited" : "gsc-uncertain", retryMs: knownRetry ? 1_800_000 : 0 }, env);
        result.sitemapSubmission = { state: auth ? "authorization-required" : "provider-unavailable", submittedAt: null, limitation: auth ? "Separate GSC write authorization required." : "A known retryable response waits for the next window; an uncertain outcome needs reconciliation." };
        if (auth) result.notificationError = "gsc-auth-required";
        if (knownRetry) retry(1_800_000, "gsc-retry-later"); else if (!auth) result.notificationOutcome = "reconciliation-required";
      }
    } else if (!["done", "coalesced"].includes(reservation)) {
      if (reservation === "reconciliation-required" || reservation === "denied") result.notificationOutcome = "reconciliation-required";
      else retry(reservation === "budget-exhausted" ? 86_400_000 : 1_800_000, reservation);
    }
    await safeTelemetry({ jobId: job.job_id, step: "gsc-sitemap-submit", status: result.sitemapSubmission.state === "submitted" ? "succeeded" : "skipped", detail }, env);
  }
  if (indexNowEnabled(env) && result.notificationOutcome !== "reconciliation-required") {
    const reservation = await deps.reserve(job, "indexnow", indexNowBudget(env), env);
    if (reservation === "reserved") {
      const submitted = await deps.indexNow(url, env);
      const state = submitted.state === "sent" ? "succeeded" : submitted.state === "retry" ? "failed" : submitted.state === "uncertain" ? "uncertain" : "blocked";
      await deps.finish(job, "indexnow", { state, errorCode: state === "succeeded" ? undefined : `indexnow-${"httpStatus" in submitted ? submitted.httpStatus : submitted.state}`, retryMs: state === "failed" ? 3_600_000 : 0, result: { state: submitted.state } }, env);
      if (state === "blocked") result.notificationError = "indexnow-configuration-required";
      if (state === "failed") retry(3_600_000, "indexnow-rate-limited");
      if (state === "uncertain") result.notificationOutcome = "reconciliation-required";
      await safeTelemetry({ jobId: job.job_id, step: "indexnow", status: state === "succeeded" ? "succeeded" : "warning", detail }, env);
    } else if (reservation === "reconciliation-required" || reservation === "denied") result.notificationOutcome = "reconciliation-required";
    else if (reservation !== "done") retry(reservation === "budget-exhausted" ? 86_400_000 : 3_600_000, reservation);
  }
  return result;
}

export async function runDueSeoInspections(env: Env = process.env, deps = { ...notificationDependencies, claim: claimSeoInspection, reserveInitialInspection, deferSeoInspection }) {
  if (!workerDatabaseIdentity(env)) throw new Error("SEO_POST_PUBLISH_WORKER_DENIED");
  const safeTelemetry: typeof deps.telemetry = async (...args) => { try { await deps.telemetry(...args); } catch { console.warn("SEO_OPS_TELEMETRY_UNAVAILABLE"); } };
  let count = 0;
  for (let i = 0; i < 5; i++) {
    const claimed = await deps.claim(env); if (!claimed) break;
    const job = { ...claimed, lease_id: claimed.inspection_lease };
    const reservation = await deps.reserve(job, claimed.step, 1600, env);
    if (reservation !== "reserved") {
      await deps.defer(job, claimed.step, env);
      continue;
    }
    try {
      const article = await deps.readArticle(job.article_id);
      const version = job.content_version instanceof Date ? job.content_version.toISOString() : job.content_version;
      const url = article && !article.noindex && Date.parse(article.updatedAt) === Date.parse(version) ? approvedPublishedArticle(article) : null;
      if (!url || article?.reviewStatus !== "approved") {
        await deps.finish(job, claimed.step, { state: "blocked", errorCode: "inspection-ineligible", result: { state: "unknown" } }, env); continue;
      }
      const inspection = await deps.inspect({ siteUrl: "sc-domain:ccpun.com", inspectionUrl: url, token: await deps.readToken(env) });
      await deps.finish(job, claimed.step, { state: "succeeded", result: inspection }, env);
      await safeTelemetry({ jobId: job.job_id, step: claimed.step, status: "succeeded", detail: { articleId: article!.id, path: new URL(url).pathname, ...(inspection.verdict ? { verdict: inspection.verdict } : {}), ...(inspection.coverageState ? { coverageState: inspection.coverageState } : {}) } }, env);
      count++;
    } catch {
      await deps.finish(job, claimed.step, { state: claimed.inspection_attempts >= 3 ? "blocked" : "failed", errorCode: "inspection-unavailable", retryMs: 120_000, result: { state: "unknown" } }, env);
    }
  }
  return count;
}
