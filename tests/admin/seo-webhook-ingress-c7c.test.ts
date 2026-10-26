import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { encodeSignatureHeader } from "@sanity/webhook";
import { loadFixtureModule } from "../../qa/phase1-fixture-loader.mjs";
import { isSanityPublishIngress, isPostPublishAdminOriginAllowed, SANITY_PUBLISH_PATH } from "../../lib/admin/seo-intelligence/post-publish-origin";

const production = {
  CCPUN_APP_ENV: "production-admin", CCPUN_DEPLOYMENT_PROVIDER: "hostinger",
  CCPUN_DEPLOYMENT_ROLE: "admin", AUTH_URL: "https://admin.ccpun.com",
  CCPUN_SANITY_WEBHOOK_SECRET: "OBVIOUS-C7C-LOCAL-TEST-FIXTURE",
};
const now = 1793000000000;
const article = { id: "C7C-ARTICLE", rev: "C7C-REV", slug: "example", category: "Personal Finance", categorySlug: "personal-finance", updatedAt: "2026-10-26T00:00:00.000Z", reviewStatus: "approved" };
const payload = { articleId: article.id, rev: article.rev, contentUpdatedAt: article.updatedAt, op: "update" };
const headers = { host: "admin.ccpun.com", "x-forwarded-host": "admin.ccpun.com", "x-forwarded-proto": "https", "sanity-project-id": "kyfxgjnq", "sanity-dataset": "production", "idempotency-key": "C7C-DELIVERY" };
let sequence = 0;
function fixture(env: Record<string, string | undefined> = production) {
  const calls = { auth: 0, read: 0, enqueue: 0 };
  const globals = { process: { env }, Date: class extends Date { static now() { return now; } } };
  const proxy = loadFixtureModule("apps/admin/proxy.ts", { globals, mocks: new Map([
    ["@/auth", { auth: () => () => { calls.auth++; throw new Error("C7c must not enter browser auth"); } }],
  ]) });
  const route = loadFixtureModule("apps/admin/app/api/integrations/sanity/article-published/route.ts", { globals, mocks: new Map([
    ["@/lib/admin/sanity-control", { getPublishedSeoObservationArticle: async () => { calls.read++; return article; } }],
    ["@/lib/admin/seo-intelligence/post-publish-queue", { enqueuePublishedSeoWebhook: async () => { calls.enqueue++; return { job_id: "C7C-JOB" }; } }],
  ]) });
  return { calls, proxy, route, async run(request: NextRequest) {
    const fence = await proxy.default(request, {});
    if (fence.headers.get("x-middleware-next") !== "1") return fence;
    assert.equal(request.bodyUsed, false, "proxy must leave the raw signed body untouched");
    return route.POST(request);
  } };
}
type RequestOptions = { url?: string; body?: string; signature?: string | null; timestamp?: number; headers?: Record<string, string> };
async function request(options: RequestOptions = {}) {
  const body = options.body ?? JSON.stringify(payload);
  const signature = options.signature === undefined ? await encodeSignatureHeader(body, options.timestamp ?? now, production.CCPUN_SANITY_WEBHOOK_SECRET) : options.signature;
  return new NextRequest(options.url ?? `http://172.18.0.2:3000${SANITY_PUBLISH_PATH}`, { method: "POST", body, headers: {
    ...headers, "x-real-ip": `C7C-${sequence++}`, ...(signature === null ? {} : { "sanity-webhook-signature": signature }), ...options.headers,
  } });
}

test("C7c same Admin proxy path reaches generic signature denial for Hostinger internal IP/hostname", async () => {
  for (const host of ["172.18.0.2", "hostinger-internal", "127.0.0.1"]) {
    for (const signature of [null, "invalid-synthetic-signature"]) {
      const f = fixture();
      const response = await f.run(await request({ url: `http://${host}:3000${SANITY_PUBLISH_PATH}`, signature }));
      assert.equal(response.status, 401, host);
      assert.deepEqual(await response.json(), { error: "unauthorized" });
      assert.deepEqual(f.calls, { auth: 0, read: 0, enqueue: 0 });
    }
  }
});

test("C7c valid raw-body fixture traverses actual proxy and route to injected accepted flow", async () => {
  const f = fixture();
  const response = await f.run(await request());
  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { state: "queued", jobId: "C7C-JOB" });
  assert.deepEqual(f.calls, { auth: 0, read: 1, enqueue: 1 });
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("C7c UAT proxy and route skip before signature, CMS or queue", async () => {
  const env = { ...production, CCPUN_APP_ENV: "admin-uat", AUTH_URL: "https://admin-test.ccpun.com" };
  const f = fixture(env);
  const r = await request({ signature: null, headers: { host: "admin-test.ccpun.com", "x-forwarded-host": "admin-test.ccpun.com", "sanity-project-id": "ccb9lnw5", "sanity-dataset": "uat" } });
  const response = await f.run(r);
  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { state: "skipped", reason: "production-only" });
  assert.equal((await f.route.POST(r)).status, 202);
  assert.deepEqual(f.calls, { auth: 0, read: 0, enqueue: 0 });
});

test("C7c forwarded host alone, inconsistent forwarding and wrong deployment never bypass proxy", async () => {
  const badHeaders: Record<string, string>[] = [
    { host: "attacker.example" }, { host: "172.18.0.2:3000" }, { host: "" },
    { "x-forwarded-host": "attacker.example" }, { "x-forwarded-host": "admin.ccpun.com, attacker.example" },
    { "x-forwarded-proto": "http" }, { "x-forwarded-proto": "https,http" },
  ];
  for (const bad of badHeaders) {
    const f = fixture();
    const response = await f.run(await request({ headers: bad }));
    assert.equal(response.status, 404, JSON.stringify(bad));
    assert.deepEqual(f.calls, { auth: 0, read: 0, enqueue: 0 });
  }
  for (const env of [
    { ...production, CCPUN_DEPLOYMENT_PROVIDER: "local" }, { ...production, CCPUN_DEPLOYMENT_ROLE: "web" },
    { ...production, VERCEL_URL: "synthetic.example" }, { ...production, AUTH_URL: "https://attacker.example" },
    { ...production, CCPUN_ADMIN_CAPABILITY_PROFILE: "disabled" },
  ]) {
    const f = fixture(env);
    assert.equal((await f.run(await request())).status, 404);
    assert.deepEqual(f.calls, { auth: 0, read: 0, enqueue: 0 });
  }
});

test("C7c host fence reuses Owner Hostinger trust without broadening the signed path", async () => {
  for (const host of ["hostinger-internal", "172.18.0.2"]) {
    const r = await request({ url: `http://${host}:3000${SANITY_PUBLISH_PATH}` });
    assert.equal(isPostPublishAdminOriginAllowed(new Request(r.url, { method: "GET", headers: r.headers }), production, "production-admin"), true);
    assert.equal(isSanityPublishIngress(r, production), true);
  }
  for (const url of [
    `http://hostinger-internal:3000${SANITY_PUBLISH_PATH}?extra=1`,
    "http://hostinger-internal:3000/api/integrations/sanity/article-published",
    "http://hostinger-internal:3000/api/integrations/sanity/other/",
    `http://fixture-user@hostinger-internal:3000${SANITY_PUBLISH_PATH}`,
  ]) assert.equal(isSanityPublishIngress({ url, method: "POST", headers: new Headers(headers) } as Request, production), false);
});

test("C7c correct signature cannot cross dataset/draft/body/timestamp boundaries", async () => {
  const cases: RequestOptions[] = [
    { headers: { "sanity-dataset": "uat" } }, { headers: { "sanity-project-id": "ccb9lnw5" } },
    { body: JSON.stringify({ ...payload, articleId: "drafts.C7C-ARTICLE" }) },
    { body: "x".repeat(4097) }, { timestamp: now - 300001 }, { timestamp: now + 300001 },
  ];
  for (const options of cases) {
    const f = fixture();
    const response = await f.run(await request(options));
    assert.ok([400, 401, 403, 413].includes(response.status));
    assert.deepEqual(f.calls, { auth: 0, read: 0, enqueue: 0 });
  }
  const raw = JSON.stringify(payload);
  const signature = await encodeSignatureHeader(raw, now, production.CCPUN_SANITY_WEBHOOK_SECRET);
  const f = fixture();
  assert.equal((await f.run(await request({ body: raw + " ", signature }))).status, 401);
  assert.deepEqual(f.calls, { auth: 0, read: 0, enqueue: 0 });
});
