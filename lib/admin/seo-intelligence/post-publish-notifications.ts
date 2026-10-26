import "server-only";
import { getPublishedSeoObservationArticle } from "../sanity-control";
import { approvedPublishedArticle, BLOG_SITEMAP_URL } from "./post-publish-network";
import { emptyGoogleInspection, verifyPublishedArticleSeo } from "./post-publish";
import { getGoogleDataAccessToken } from "./google-data-auth";
import { getGscSitemapWriteToken, isGscSitemapWriteApproved } from "./gsc-sitemap-write-auth";
import { inspectGscIndexedUrl, submitGscSitemap, getGscSitemapStatus } from "./providers/gsc";
import { indexNowBudget, indexNowEnabled, submitIndexNow } from "./providers/indexnow";
import { reserveNotification, finishNotification, scheduleSeoInspections, claimSeoInspection, reserveInitialInspection, deferSeoInspection, claimGscWindow, readGscWindowMembers, beginGscWindow, finishGscWindow, claimGscReconciliation, finishGscReconciliation, failGscWindowValidation } from "./post-publish-notification-store";
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
  failValidation:failGscWindowValidation,claimWindow:claimGscWindow,members:readGscWindowMembers,beginWindow:beginGscWindow,finishWindow:finishGscWindow,claimReconciliation:claimGscReconciliation,finishReconciliation:finishGscReconciliation,sitemapStatus:getGscSitemapStatus,
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
    const enrollment=await deps.reserve(job,"gsc-sitemap-submit",gscBudget(env),env);
    result.sitemapSubmission={state:enrollment==='done'?'submitted':'skipped',submittedAt:null,limitation:'The durable GSC window independently waits, validates and reconciles sitemap submission.'};
    if(enrollment==='denied')result.notificationError='gsc-enrollment-denied';
    await safeTelemetry({jobId:job.job_id,step:'gsc-sitemap-submit',status:enrollment==='done'?'succeeded':'skipped',detail},env);
  }
  if (indexNowEnabled(env)) {
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

export async function runDueSeoInspections(env: Env = process.env, deps = { ...notificationDependencies, claim: claimSeoInspection, reserveInitialInspection, deferSeoInspection, claimGscWindow, readGscWindowMembers, beginGscWindow, finishGscWindow, claimGscReconciliation, finishGscReconciliation, failGscWindowValidation }) {
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

/** Same private timer, separate durable GSC leases; no main-job retry can suppress IndexNow. */
export async function runDueGscSitemapWindows(env:Env=process.env,deps=notificationDependencies){
 if(!workerDatabaseIdentity(env))throw new Error('SEO_POST_PUBLISH_WORKER_DENIED');
 if(!isGscSitemapWriteApproved(env))return {submitted:0,reconciled:0};
 let submitted=0,reconciled=0;
 const uncertain=await deps.claimReconciliation(gscBudget(env),env);
 if(uncertain){
  let confirmed=false;let observation:unknown;
  try{
   const status=await deps.sitemapStatus(await deps.readToken(env));
   const started=uncertain.started_at?Date.parse(String(uncertain.started_at)):NaN;
   const observed=status.lastSubmitted?Date.parse(status.lastSubmitted):NaN;
   // GSC timestamps may omit fractional seconds. Never use historic lastDownloaded as submission evidence.
   confirmed=Number.isFinite(started)&&Number.isFinite(observed)&&observed>=Math.floor(started/1000)*1000&&observed<=Date.now()+300_000;
   observation={kind:confirmed?'confirmed':'unconfirmed',...status};
  }catch{observation={kind:'transport-error',error:'gsc-read-unavailable'};}
  await deps.finishReconciliation(uncertain,confirmed,observation,env);reconciled++;
 }
 const window=await deps.claimWindow(env);if(!window)return {submitted,reconciled};
 const eligible:string[]=[];const retry:string[]=[];const deadline=Date.now()+120_000;
 try{
  const members=await deps.members(window,env);
  for(const member of members){
   if(Date.now()>deadline){retry.push(member.job_id);continue;}
   try{
    const article=await deps.readArticle(member.article_id);
    const version=member.content_version instanceof Date?member.content_version.toISOString():member.content_version;
    const authority=member.source==='owner'&&member.owner_approved||member.notification_approved===true;
    if(!article||!authority||article.reviewStatus!=='approved'||article.noindex||Date.parse(article.updatedAt)!==Date.parse(version))continue;
    const url=approvedPublishedArticle(article);if(!url)continue;
    const verification=await deps.verify({articleId:article.id,url,expectedLastmod:article.updatedAt,sitemapUrl:BLOG_SITEMAP_URL});
    if([verification.live,verification.canonical,verification.indexability,verification.sitemap].every(check=>check.state==='pass'))eligible.push(member.job_id);else retry.push(member.job_id);
   }catch{retry.push(member.job_id);}
  }
 }catch(error){
  await deps.failValidation(window,error instanceof Error&&error.message==='GSC_WINDOW_MEMBER_LIMIT'?'gsc-window-member-limit':'gsc-validation-unavailable',env);
  return {submitted,reconciled};
 }
 const reservation=await deps.beginWindow(window,eligible,retry,gscBudget(env),env);
 if(reservation!=='reserved')return {submitted,reconciled};
 try{
  const receipt=await deps.submitSitemap({siteUrl:'sc-domain:ccpun.com',sitemapUrl:GSC_NOTIFICATION_SITEMAP,token:await deps.writeToken(env)});
  await deps.finishWindow(window,'succeeded',null,receipt,env);submitted++;
 }catch(error){
  const code=error instanceof Error?error.message:'GSC_UNKNOWN';
  const auth=['GSC_AUTH_REQUIRED','GSC_SITEMAP_AUTH_REQUIRED'].includes(code);
  const known=['GSC_RATE_LIMITED','GSC_RETRYABLE_RESPONSE'].includes(code);
  await deps.finishWindow(window,auth?'blocked':known?'failed':'uncertain',auth?'gsc-auth-required':known?'gsc-retry-later':'gsc-uncertain',{kind:auth?'authorization-error':known?'retryable-response':'uncertain-write'},env);
 }
 return {submitted,reconciled};
}
