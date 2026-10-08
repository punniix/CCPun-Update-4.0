import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  approvedPublicArticleUrl, approvedPublishedArticle, boundedSeoFetch,
} from "../../lib/admin/seo-intelligence/post-publish-network";
import { isGscSitemapWriteApproved } from "../../lib/admin/seo-intelligence/gsc-sitemap-write-policy";
import { workerDatabaseIdentity, isPostPublishWorkerSourceAllowed } from "../../lib/admin/seo-intelligence/post-publish-worker-policy";


const source = (path: string) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");
const validArticle = "https://ccpun.com/blog/personal-finance/example/";

test("URL verification is exactly host and canonical constrained; no CMS-controlled external network fetch", async () => {
  for (const unsafe of [
    "http://ccpun.com/blog/a/b/", "https://ccpun.com.evil.test/blog/a/b/",
    "https://127.0.0.1/blog/a/b/", "https://localhost/blog/a/b/",
    "https://user@ccpun.com/blog/a/b/", "https://ccpun.com:8080/blog/a/b/",
    "https://ccpun.com/api/admin/status", "https://ccpun.com/blog/a/b/?q=1",
    "https://ccpun.com/blog/a/b/#anything", "https://ccpun.com/blog/a/../../api/private/",
  ]) {
    assert.equal(approvedPublicArticleUrl(unsafe), null, unsafe);
  }
  assert.equal(approvedPublicArticleUrl(validArticle), validArticle);
  assert.equal(approvedPublishedArticle({slug:"example",category:"Personal Finance",categorySlug:"personal-finance",canonical:"https://evil.test/"}), null);
  let calls = 0;
  await assert.rejects(() => boundedSeoFetch("https://evil.test/", async () => {
    calls++;
    return new Response("bad");
  }), /SEO_UNTRUSTED_URL/);
  assert.equal(calls, 0);
});

test("SEO fetch refuses redirects and bounded responses without following untrusted Location", async () => {
  const options: RequestInit[] = [];
  await assert.rejects(() => boundedSeoFetch(validArticle, async (_, init) => {
    options.push(init!);
    return new Response("", {status:302,headers:{Location:"http://169.254.169.254/latest/"}});
  }), /SEO_REDIRECT_DENIED/);
  assert.equal(options[0].redirect, "manual");
  await assert.rejects(() => boundedSeoFetch(validArticle, async () => new Response("a".repeat(512)), 64), /SEO_RESPONSE_TOO_LARGE/);
  await assert.rejects(() => boundedSeoFetch(validArticle, async () =>
    new Response("x", {headers: {"Content-Length":"250000000"}}),64), /SEO_RESPONSE_TOO_LARGE/);
});

test("GSC read-only refresh cannot silently authorize sitemap write", async () => {
  const base = {
    CCPUN_BACKGROUND_EXECUTION_PLANE: "vps",
    CCPUN_SEO_POST_PUBLISH_WORKER_ENABLED: "1",
    CCPUN_GSC_SITEMAP_WRITE_ENABLED: "1",
    CCPUN_GSC_SITE_URL: "sc-domain:ccpun.com",
    CCPUN_GSC_SITEMAP_CLIENT_ID: "separate-client",
    CCPUN_GSC_SITEMAP_CLIENT_SECRET: "test-secret",
    CCPUN_GSC_SITEMAP_REFRESH_TOKEN: "write-refresh",
    CCPUN_GOOGLE_DATA_REFRESH_TOKEN: "read-refresh",
  };
  assert.equal(isGscSitemapWriteApproved(base), true);
  assert.equal(isGscSitemapWriteApproved({...base,CCPUN_GSC_SITEMAP_REFRESH_TOKEN:"read-refresh"}),false);
  assert.equal(isGscSitemapWriteApproved({...base,CCPUN_BACKGROUND_EXECUTION_PLANE:"cloud"}),false);
  assert.match(source("lib/admin/seo-intelligence/gsc-sitemap-write-auth.ts"), /CCPUN_GSC_SITEMAP_REFRESH_TOKEN/);
  assert.doesNotMatch(source("lib/admin/seo-intelligence/gsc-sitemap-write-auth.ts"), /CCPUN_GOOGLE_DATA_CLIENT_SECRET/);
  assert.match(source("lib/admin/seo-intelligence/gsc-sitemap-write-auth.ts"), /oauth2\.googleapis\.com\/token/);
});

const workerEnv = {
  CCPUN_APP_ENV: "production-admin",
  CCPUN_DEPLOYMENT_PROVIDER: "hostinger",
  CCPUN_DEPLOYMENT_ROLE: "admin",
  CCPUN_BACKGROUND_EXECUTION_PLANE: "vps",
  CCPUN_SEO_POST_PUBLISH_WORKER_ENABLED: "1",
  CCPUN_NATIVE_WORKFLOW_ENABLED: "0",
  CCPUN_ARTICLE_SCHEDULE_EXECUTOR_ENABLED: "0",
  CCPUN_NEON_PROJECT_ID: "lively-bar-43618798",
  CCPUN_NEON_BRANCH_ID: "br-long-resonance-b3ys5xrv",
  CCPUN_NEON_DATABASE: "neondb",
  CCPUN_POST_PUBLISH_DATABASE_URL: "not-used",
  CCPUN_SEO_POST_PUBLISH_DATABASE_URL: "postgresql://ccpun_seo_post_publish_worker:local-test-placeholder@ep-broad-butterfly-b3ro7u8w.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
};

test("private-only worker refuses cloud, UAT, wrong role, Vercel and unpinned releases", () => {
  assert.equal(workerDatabaseIdentity(workerEnv),true);
  assert.equal(workerDatabaseIdentity({...workerEnv,CCPUN_BACKGROUND_EXECUTION_PLANE:"cloud"}),false);
  assert.equal(workerDatabaseIdentity({...workerEnv,CCPUN_APP_ENV:"admin-uat"}),false);
  assert.equal(workerDatabaseIdentity({...workerEnv,VERCEL_ENV:"production"}),false);
  assert.equal(workerDatabaseIdentity({...workerEnv,CCPUN_SEO_POST_PUBLISH_DATABASE_URL:workerEnv.CCPUN_SEO_POST_PUBLISH_DATABASE_URL.replace("ccpun_seo_post_publish_worker","ccpun_admin_runtime")}),false);
  assert.equal(isPostPublishWorkerSourceAllowed({...workerEnv,CCPUN_GIT_SHA:"a".repeat(40),CCPUN_GIT_REF:"pinned-"+"a".repeat(40)},"b".repeat(40)),false);
});

test("Neon durable SQL and worker protect idempotency, expired leases and retry state", () => {
  const migration = source("db/migrations/20261008_seo_post_publish_durable_v1.sql");
  const queue = source("lib/admin/seo-intelligence/post-publish-queue.ts");
  const route = source("apps/admin/app/api/admin/seo/post-publish/route.ts");
  const sweeper = source("lib/admin/sanity-control.ts");
  assert.match(migration,/UNIQUE\(article_id, content_version\)/);
  assert.match(migration,/GRANT UPDATE\(owner_approved\)/);
  assert.match(queue,/ON CONFLICT \(article_id,content_version\)/);
  assert.match(queue,/FOR UPDATE SKIP LOCKED/);
  assert.match(queue,/SEO_LEASE_EXPIRED/);
  assert.match(queue,/reconciliation-required/);
  assert.match(route,/enqueuePublishedSeoArticle/);
  assert.match(route,/queue-unavailable/);
  assert.doesNotMatch(route,/after\(/);
  assert.match(sweeper,/listRecentPublishedSeoObservationArticles/);
  assert.match(source("scripts/seo-post-publish-worker.ts"),/reconcilePublishedSeoJobs/);
  assert.doesNotMatch(source("scripts/seo-post-publish-worker.ts"),/listen\(|createServer\(/);
  assert.doesNotMatch(source("lib/admin/seo-intelligence/post-publish-runner.ts"),/indexing\.googleapis\.com|urlNotifications:publish/);
});
