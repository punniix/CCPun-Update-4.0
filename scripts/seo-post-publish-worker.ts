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


export async function runSeoPostPublishWorkerOnce(
  env: Record<string, string | undefined> = process.env,
  dependencies = {
    reconcile: () => reconcilePublishedSeoJobs(env),
    claim: () => claimPublishedSeoJob(env),
    finish: finishPublishedSeoJob,
    markAttempt: markSitemapAttempt,
    execute: runPostPublishSeoPipeline,
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
        beforeExternalWrite: () => dependencies.markAttempt(job, env),
      });
      const eligible = result && result.live.state === "pass"
        && result.canonical.state === "pass" && result.indexability.state === "pass"
        && result.sitemap.state === "pass";
      const uncertain = result?.sitemapSubmission.state === "provider-unavailable" && job.owner_approved;
      const outcome = uncertain ? "reconciliation-required" : result === null || eligible ? "completed" : "retry";
      if (outcome !== "completed") incomplete++;
      await dependencies.finish(job, {
        outcome,
        errorCode: result === null ? "SEO_REVISION_STALE" : !eligible ? "SEO_VERIFICATION_INCOMPLETE" : undefined,
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
  return { discovered, processed, incomplete };
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
