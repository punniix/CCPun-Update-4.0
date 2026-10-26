// Private VPS timer/oneshot only. Do not expose this runner as a route or Cloud cron.
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  claimPublishedSeoJob, finishPublishedSeoJob, markSitemapAttempt,
  reconcilePublishedSeoJobs,
} from "../lib/admin/seo-intelligence/post-publish-queue";
import { isPostPublishWorkerSourceAllowed } from "../lib/admin/seo-intelligence/post-publish-worker-policy";
import { runPostPublishSeoPipeline } from "../lib/admin/seo-intelligence/post-publish-runner";
import { runDueSeoInspections } from "../lib/admin/seo-intelligence/post-publish-notifications";
import { recordSeoWorkerPass } from "../lib/admin/seo-intelligence/post-publish-notification-store";


export async function runSeoPostPublishWorkerOnce(
  env: Record<string, string | undefined> = process.env,
  dependencies = {
    reconcile: () => reconcilePublishedSeoJobs(env),
    claim: () => claimPublishedSeoJob(env),
    finish: finishPublishedSeoJob,
    markAttempt: markSitemapAttempt,
    execute: runPostPublishSeoPipeline,
    inspectDue: runDueSeoInspections,
    recordPass: recordSeoWorkerPass,
  },
) {
  const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  if (!isPostPublishWorkerSourceAllowed(env, head)) throw new Error("SEO_WORKER_SOURCE_DENIED");
  const discovered = await dependencies.reconcile();
  let processed = 0;
  let incomplete = 0;
  for (let i = 0; i < 5; i++) {
    const job = await dependencies.claim();
    if (!job) break;
    processed++;
    try {
      const result = await dependencies.execute({
        articleId: job.article_id, actor: job.actor, requestId: job.job_id,
        revision: job.content_version instanceof Date ? job.content_version.toISOString() : job.content_version,
        ownerApproved: job.owner_approved,
        job,
        beforeExternalWrite: () => dependencies.markAttempt(job, env),
      });
      const eligible = result && result.live.state === "pass"
        && result.canonical.state === "pass" && result.indexability.state === "pass"
        && result.sitemap.state === "pass";
      const uncertain = result?.sitemapSubmission.state === "provider-unavailable" && job.owner_approved;
      const outcome = result?.notificationOutcome ?? (uncertain ? "reconciliation-required" : result === null || eligible ? "completed" : "retry");
      if (outcome !== "completed") incomplete++;
      await dependencies.finish(job, {
        outcome,
        errorCode: result?.notificationError ?? (result === null ? "SEO_REVISION_STALE" : !eligible ? "SEO_VERIFICATION_INCOMPLETE" : undefined),
        retryAfterMs: result?.retryAfterMs,
        receipt: result ? {
          checkedAt: result.checkedAt, url: result.url,
          live: result.live.state, canonical: result.canonical.state,
          indexability: result.indexability.state, sitemap: result.sitemap.state,
          discovery: result.discovery.state, google: result.google.state,
          sitemapSubmission: result.sitemapSubmission.state,
        } : { skipped: "stale-or-ineligible" },
      }, env);
    } catch {
      incomplete++;
      await dependencies.finish(job, { outcome: "retry", errorCode: "SEO_WORKER_TRANSIENT_FAILURE" }, env);
    }
  }
  const inspections = await dependencies.inspectDue?.(env) ?? 0;
  await dependencies.recordPass?.(env);
  return { discovered, processed, incomplete, inspections };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void runSeoPostPublishWorkerOnce().then((receipt) => {
    console.log(JSON.stringify(receipt));
    if (receipt.incomplete) process.exitCode = 1;
  }).catch(() => {
    console.error("SEO_POST_PUBLISH_WORKER_DENIED");
    process.exitCode = 1;
  });
}
