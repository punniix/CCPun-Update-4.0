import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { resolveDeploymentIdentity } from "../lib/runtime/deployment-identity.ts";

const require = createRequire(import.meta.url);
const { transpileModule, ModuleKind } = require("typescript");
const source = readFileSync(new URL("../apps/web/lib/article-engagement.ts", import.meta.url), "utf8");
const productionId = "91b217d8-72f3-4e8b-a217-bed78cac437c";
const endpoint = "https://ccpun.com/api/article-engagement/";
const nonce = "b494e65b-9c14-465c-a7ea-45798ba4ac52";
function load(overrides = {}) {
  const variables = {
    CCPUN_DEPLOYMENT_PROVIDER: "hostinger", CCPUN_DEPLOYMENT_ROLE: "web", CCPUN_APP_ENV: "production",
    NEXT_PUBLIC_CCPUN_APP_ENV: "production", CCPUN_UAT_MODE: "0",
    NEXT_PUBLIC_SANITY_PROJECT_ID: "kyfxgjnq", NEXT_PUBLIC_SANITY_DATASET: "production",
    // Synthetic test credential only. No environment files are loaded.
    CCPUN_ARTICLE_DATABASE_URL: "postgresql://ccpun_article_runtime:synthetic@ep-broad-butterfly-b3ro7u8w.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
    ...overrides,
  };
  const calls = [];
  const articles = [{ id: productionId, status: "published", publishedAt: "2026-10-07T08:14:13.608Z" }];
  let fail = false;
  let failures = Infinity;
  let contentFailure = null;
  const logs = [];
  let activatedAt = "2026-10-19T10:00:00.000Z";
  const exports = {};
  const failure = kind => {
    if (kind === "network") return Object.assign(new Error("Error connecting to database: TypeError: fetch failed"), { name: "NeonDbError", sourceError: new TypeError("fetch failed") });
    if (kind === "timeout") return Object.assign(new Error("Error connecting to database: TimeoutError"), { name: "NeonDbError", sourceError: Object.assign(new Error("timeout"), { name: "TimeoutError" }) });
    if (kind === "upstream") return Object.assign(new Error("Server error (HTTP status 503): synthetic"), { name: "NeonDbError" });
    if (kind === "sql") return Object.assign(new Error("function does not exist"), { name: "NeonDbError", code: "42883" });
    return new Error("synthetic database failure: must never leak");
  };
  runInNewContext(transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS, target: 9 } }).outputText, {
    exports, process: { env: variables }, Buffer, URL, TextDecoder, Request, Response, Headers, AbortSignal,
    setTimeout, clearTimeout,
    console: { error: line => logs.push({ level: "error", line }), warn: line => logs.push({ level: "warn", line }) },
    require: name => {
      if (name === "server-only") return {};
      if (name === "node:crypto") return require(name);
      if (name.endsWith("deployment-identity")) return { resolveDeploymentIdentity };
      if (name.endsWith("content/provider")) return { getContentProvider: () => ({ listArticles: async options => {
        assert.equal(options.includeDrafts, false);
        if (contentFailure) throw new Error("Sanity content request failed; details redacted");
        return articles;
      } }) };
      if (name === "@neondatabase/serverless") return { neon: (_url, options) => ({ query: async (sql, params) => {
        assert.ok(options.fetchOptions.signal instanceof AbortSignal);
        calls.push({ sql, params });
        if (fail && failures > 0) { failures -= 1; throw failure(fail); }
        return [{ views: "2", shares: 0, hearts: sql.includes("set_article_heart") && params[2] ? 1 : null,
          liked: sql.includes("set_article_heart") ? params[2] : !!params.at(-1), activated_at: activatedAt }];
      } }) };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return { ...exports, variables, calls, articles, logs,
    fail: (kind = true, times = Infinity) => { fail = kind; failures = times; },
    failContent: (value = true) => { contentFailure = value; },
    activatedAt: value => { activatedAt = value; } };
}
function request(id = productionId, body, headers = {}, origin = "https://ccpun.com") {
  return new Request(`${origin}/api/article-engagement/${id}/`, {
    ...(body === undefined ? {} : { method: "POST", body: JSON.stringify(body) }),
    headers: { host: new URL(origin).host, ...(body === undefined ? {} : { "content-type": "application/json", origin }), ...headers },
  });
}

test("lane validation rejects missing, cross-lane, elevated and unsupported credentials", () => {
  const lib = load();
  assert.equal(lib.resolveArticleRuntime().environment, "production");
  for (const change of [
    { CCPUN_ARTICLE_DATABASE_URL: undefined }, { CCPUN_APP_ENV: "web-uat" },
    { CCPUN_DEPLOYMENT_ROLE: "admin" }, { NEXT_PUBLIC_SANITY_DATASET: "uat" },
    { CCPUN_ARTICLE_DATABASE_URL: lib.variables.CCPUN_ARTICLE_DATABASE_URL.replace("ccpun_article_runtime", "neondb_owner") },
    { CCPUN_ARTICLE_DATABASE_URL: lib.variables.CCPUN_ARTICLE_DATABASE_URL + "&options=role%3Dneondb_owner" },
    { CCPUN_ARTICLE_DATABASE_URL: lib.variables.CCPUN_ARTICLE_DATABASE_URL.replace("broad-butterfly-b3ro7u8w", "mute-frost-aztvz394") },
  ]) assert.equal(lib.resolveArticleRuntime({ ...lib.variables, ...change }), null);
});

test("GET has no cookie, unknown history stays null, and future published IDs work", async () => {
  const lib = load();
  const response = await lib.handleArticleEngagement(request(), productionId);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("set-cookie"), null);
  assert.match(response.headers.get("cache-control"), /private, no-store/);
  const body = await response.json();
  assert.deepEqual([body.views, body.shares, body.hearts, body.liked], [2, 0, null, false]);
  assert.equal(body.history.coverage, "partial");
  const futureId = "new-published-article-without-import";
  lib.articles.push({ id: futureId, status: "published", publishedAt: "2026-10-18T00:00:00Z" });
  assert.equal((await lib.handleArticleEngagement(request(futureId), futureId)).status, 200);
  for (const id of ["drafts.hidden", "not-published", "uat-public-snapshot-" + productionId]) {
    assert.equal((await lib.handleArticleEngagement(request(id), id)).status, 404);
  }
});

test("activated_at accepts the real Neon driver Date shape and rejects invalid timestamps", async () => {
  const { types } = require("@neondatabase/serverless");
  const parsed = types.getTypeParser(1184, "text")("2026-10-21 09:31:40.94+00");
  assert.ok(parsed instanceof Date, "driver parses timestamptz into Date");
  const lib = load();
  lib.activatedAt(parsed);
  const response = await lib.handleArticleEngagement(request(), productionId);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).activatedAt, "2026-10-21T09:31:40.940Z");
  for (const bad of [null, "not-a-date", new Date(Number.NaN), 1729500000000]) {
    const fresh = load();
    fresh.activatedAt(bad);
    const failed = await fresh.handleArticleEngagement(request(), productionId);
    assert.equal(failed.status, 503);
    assert.deepEqual(await failed.json(), { available: false, error: "unavailable" });
    assert.deepEqual(fresh.logs.map(entry => JSON.parse(entry.line.replace("[ARTICLE_ENGAGEMENT] ", ""))),
      [{ schema: "ccpun.article_engagement.v1", outcome: "unavailable", stage: "result", method: "GET", error: "invalid_result" }]);
  }
});

test("event contract enforces origin, consent, schema, nonce and actual streamed byte limit", async () => {
  const lib = load();
  for (const [payload, headers, expected] of [
    [{ type: "view", eventId: nonce }, {}, 403],
    [{ type: "share", eventId: nonce, analyticsConsent: false }, {}, 403],
    [{ type: "view", eventId: "bad", analyticsConsent: true }, {}, 400],
    [{ type: "heart", liked: true, articleId: "injected" }, {}, 400],
    [{ type: "heart", liked: true }, { origin: "https://attacker.example" }, 403],
    [{ type: "heart", liked: true }, { "content-type": "text/plain" }, 415],
  ]) assert.equal((await lib.handleArticleEngagement(request(productionId, payload, headers), productionId)).status, expected);
  assert.equal(lib.calls.length, 0);
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(2049)); controller.close(); } });
  const oversized = new Request(endpoint + productionId + "/", { method: "POST", body: stream, duplex: "half",
    headers: { host: "ccpun.com", origin: "https://ccpun.com", "content-type": "application/json", "content-length": "1" } });
  assert.equal((await lib.handleArticleEngagement(oversized, productionId)).status, 413);
  assert.equal((await lib.handleArticleEngagement(request(productionId, { type: "view", eventId: nonce, analyticsConsent: true }), productionId)).status, 200);
  assert.equal(lib.calls.length, 1);
  assert.equal(lib.calls[0].params[2], nonce);
});

test("explicit heart creates an article-scoped protected cookie and sends only its hash to SQL", async () => {
  const lib = load();
  const response = await lib.handleArticleEngagement(request(productionId, { type: "heart", liked: true }), productionId);
  assert.equal(response.status, 200);
  const cookie = response.headers.get("set-cookie");
  assert.match(cookie, /^__Secure-ccpun-heart-/);
  assert.match(cookie, /HttpOnly; Secure; SameSite=Strict/);
  assert.ok(cookie.includes(`Path=/api/article-engagement/${productionId}/`));
  const token = cookie.split(";")[0].split("=")[1];
  const hash = lib.calls[0].params[1];
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.notEqual(hash, token);
  assert.equal((await response.json()).hearts, 1);
  const read = await lib.handleArticleEngagement(request(productionId, undefined, { cookie: cookie.split(";")[0] }), productionId);
  assert.equal((await read.json()).liked, true);
  assert.equal(read.headers.get("set-cookie"), null);
  assert.equal(lib.calls[1].params[1], hash);
});

test("UAT uses its own database and current published IDs; failures remain generic", async () => {
  const lib = load({ CCPUN_APP_ENV: "web-uat", NEXT_PUBLIC_CCPUN_APP_ENV: "web-uat", CCPUN_UAT_MODE: "1", NEXT_PUBLIC_SANITY_PROJECT_ID: "ccb9lnw5", NEXT_PUBLIC_SANITY_DATASET: "uat",
    CCPUN_ARTICLE_DATABASE_URL: "postgresql://ccpun_article_runtime:synthetic@ep-mute-frost-aztvz394.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require" });
  const id = "uat-public-snapshot-not-approved";
  assert.equal((await lib.handleArticleEngagement(request(id, undefined, {}, "https://test.ccpun.com"), id)).status, 404);
  const uatRequest = () => request(productionId, undefined, {}, "https://test.ccpun.com");
  assert.equal((await lib.handleArticleEngagement(uatRequest(), productionId)).status, 200);
  assert.equal(lib.calls[0].params[0], productionId);
  const cold = load({ CCPUN_APP_ENV: "web-uat", NEXT_PUBLIC_CCPUN_APP_ENV: "web-uat", CCPUN_UAT_MODE: "1", NEXT_PUBLIC_SANITY_PROJECT_ID: "ccb9lnw5", NEXT_PUBLIC_SANITY_DATASET: "uat",
    CCPUN_ARTICLE_DATABASE_URL: "postgresql://ccpun_article_runtime:synthetic@ep-mute-frost-aztvz394.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require" });
  cold.fail();
  const failed = await cold.handleArticleEngagement(uatRequest(), productionId);
  assert.equal(failed.status, 503);
  assert.deepEqual(await failed.json(), { available: false, error: "unavailable" });
  assert.doesNotMatch(cold.logs.map(entry => entry.line).join("\n"), /synthetic|must never leak|neon\.tech|ccpun_article_runtime/);
});

test("both lanes accept Hostinger internal URLs only with pinned Host and exact forwarded headers", async () => {
  for (const [origin, variables] of [
    ["https://ccpun.com", {}],
    ["https://test.ccpun.com", { CCPUN_APP_ENV: "web-uat", NEXT_PUBLIC_CCPUN_APP_ENV: "web-uat", CCPUN_UAT_MODE: "1",
      NEXT_PUBLIC_SANITY_PROJECT_ID: "ccb9lnw5", NEXT_PUBLIC_SANITY_DATASET: "uat",
      CCPUN_ARTICLE_DATABASE_URL: "postgresql://ccpun_article_runtime:synthetic@ep-mute-frost-aztvz394.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require" }],
  ]) {
    const lib = load(variables);
    const host = new URL(origin).host;
    const headers = { host, origin, "content-type": "application/json", "x-forwarded-host": host, "x-forwarded-proto": "https" };
    const internal = (changes = {}, method = "POST") => new Request(`http://127.0.0.1:3000/api/article-engagement/${productionId}/`, {
      method, headers: { ...headers, ...changes },
      ...(method === "POST" ? { body: JSON.stringify({ type: "heart", liked: true }) } : {}),
    });
    assert.equal((await lib.handleArticleEngagement(internal(), productionId)).status, 200);
    const baselineCalls = lib.calls.length;
    for (const changes of [
      { host: "attacker.example" }, { host: `${host}, attacker.example` }, { host: "" },
      { "x-forwarded-host": "attacker.example" }, { "x-forwarded-host": `${host}, ${host}` }, { "x-forwarded-host": "" },
      { "x-forwarded-proto": "http" }, { "x-forwarded-proto": "https, https" }, { "x-forwarded-proto": "" },
      { origin: "https://attacker.example" }, { "sec-fetch-site": "cross-site" },
    ]) assert.equal((await lib.handleArticleEngagement(internal(changes), productionId)).status, 403);
    const missingHost = internal();
    missingHost.headers.delete("host");
    assert.equal((await lib.handleArticleEngagement(missingHost, productionId)).status, 403);
    const externalMissingHost = request(productionId, undefined, {}, origin);
    externalMissingHost.headers.delete("host");
    assert.equal((await lib.handleArticleEngagement(externalMissingHost, productionId)).status, 403);
    for (const url of ["ftp://127.0.0.1/path", "http://user:password@127.0.0.1/path"]) {
      assert.equal((await lib.handleArticleEngagement({ url, method: "GET", headers: new Headers(headers) }, productionId)).status, 403);
    }
    assert.equal(lib.calls.length, baselineCalls, "rejected requests must not reach SQL");
    const noForwardedHeaders = internal({}, "GET");
    noForwardedHeaders.headers.delete("x-forwarded-host");
    noForwardedHeaders.headers.delete("x-forwarded-proto");
    assert.equal((await lib.handleArticleEngagement(noForwardedHeaders, productionId)).status, 200);
  }
});

test("rate limiter has finite capacity and expires without storing network identity", () => {
  const lib = load();
  assert.equal(lib.takeArticleRateLimit("action", 1, 0), true);
  assert.equal(lib.takeArticleRateLimit("action", 1, 1), false);
  for (let i = 0; i < 255; i++) assert.equal(lib.takeArticleRateLimit(String(i), 1, 1), true);
  assert.equal(lib.takeArticleRateLimit("overflow", 1, 1), false);
  assert.equal(lib.takeArticleRateLimit("overflow", 1, 60_001), true);
});

test("cookieless GETs share a 30 s public aggregate; heart-cookie GETs and writes always reach SQL", async () => {
  const lib = load();
  assert.equal((await lib.handleArticleEngagement(request(), productionId)).status, 200);
  const cached = await lib.handleArticleEngagement(request(), productionId);
  assert.equal(cached.status, 200);
  const body = await cached.json();
  assert.deepEqual([body.views, body.shares, body.hearts, body.liked, body.degraded], [2, 0, null, false, false]);
  assert.equal(body.activatedAt, "2026-10-19T10:00:00.000Z");
  assert.equal(lib.calls.length, 1, "second cookieless read is served without Neon");
  assert.match(cached.headers.get("cache-control"), /private, no-store/);
  const heart = await lib.handleArticleEngagement(request(productionId, { type: "heart", liked: true }), productionId);
  const cookie = heart.headers.get("set-cookie").split(";")[0];
  assert.equal(lib.calls.length, 2);
  assert.equal((await (await lib.handleArticleEngagement(request(), productionId)).json()).hearts, 1, "a write refreshes the shared aggregate");
  assert.equal(lib.calls.length, 2);
  assert.equal((await (await lib.handleArticleEngagement(request(productionId, undefined, { cookie }), productionId)).json()).liked, true);
  assert.equal(lib.calls.length, 3, "a heart cookie needs its own liked state");
  assert.equal(lib.cachedArticleMetrics(productionId, lib.ARTICLE_METRICS_FRESH_MS, Date.now() + lib.ARTICLE_METRICS_FRESH_MS + 1), null, "fresh window expires");
  for (const id of ["not-published", "drafts.hidden"]) assert.equal((await lib.handleArticleEngagement(request(id), id)).status, 404);
});

test("a brief DB or content failure serves the last good totals as degraded, never a fake value", async () => {
  const lib = load();
  const old = Date.now() - lib.ARTICLE_METRICS_FRESH_MS - 1000;
  lib.rememberArticleMetrics(productionId, { views: 40, shares: 1, hearts: 3, activatedAt: "2026-10-19T10:00:00.000Z" }, old);
  lib.fail();
  const degraded = await lib.handleArticleEngagement(request(), productionId);
  assert.equal(degraded.status, 200);
  const body = await degraded.json();
  assert.deepEqual([body.available, body.views, body.shares, body.hearts, body.liked, body.degraded], [true, 40, 1, 3, false, true]);
  assert.equal(lib.logs.at(-1).level, "warn");
  assert.deepEqual(JSON.parse(lib.logs.at(-1).line.replace("[ARTICLE_ENGAGEMENT] ", "")), { schema: "ccpun.article_engagement.v1", outcome: "degraded", stage: "database", method: "GET", error: "error" });
  lib.failContent();
  const content = await lib.handleArticleEngagement(request(), productionId);
  assert.equal((await content.json()).degraded, true);
  assert.equal(JSON.parse(lib.logs.at(-1).line.replace("[ARTICLE_ENGAGEMENT] ", "")).stage, "content");
  lib.failContent(false);
  const cookie = `__Secure-ccpun-heart-${(await import("node:crypto")).createHash("sha256").update(productionId).digest("hex").slice(0, 16)}=${"a".repeat(64)}`;
  assert.equal((await lib.handleArticleEngagement(request(productionId, undefined, { cookie }), productionId)).status, 503, "liked state is never guessed");
  assert.equal((await lib.handleArticleEngagement(request(productionId, { type: "heart", liked: true }), productionId)).status, 503, "writes never fake success");
  const expired = load();
  expired.rememberArticleMetrics(productionId, { views: 40, shares: 1, hearts: 3, activatedAt: "2026-10-19T10:00:00.000Z" }, Date.now() - expired.ARTICLE_METRICS_STALE_MS - 1);
  expired.fail();
  assert.equal((await expired.handleArticleEngagement(request(), productionId)).status, 503, "stale window is bounded");
});

test("transient Neon transport errors retry once within the same budget; SQL errors and timeouts do not", async () => {
  for (const kind of ["network", "upstream"]) {
    const lib = load();
    lib.fail(kind, 1);
    const response = await lib.handleArticleEngagement(request(productionId, { type: "view", eventId: nonce, analyticsConsent: true }), productionId);
    assert.equal(response.status, 200, `${kind} recovers on the second attempt`);
    assert.equal(lib.calls.length, 2);
    assert.deepEqual(lib.calls[0], lib.calls[1], "the retry repeats the same idempotent call (same eventId nonce)");
    assert.equal(lib.logs.length, 0);
    const twice = load();
    twice.fail(kind, 2);
    assert.equal((await twice.handleArticleEngagement(request(), productionId)).status, 503);
    assert.equal(twice.calls.length, 2, "never more than one retry");
    assert.equal(JSON.parse(twice.logs[0].line.replace("[ARTICLE_ENGAGEMENT] ", "")).error, kind);
  }
  for (const [kind, logged] of [["sql", "sql_42883"], ["timeout", "timeout"], [true, "error"]]) {
    const lib = load();
    lib.fail(kind, 1);
    assert.equal((await lib.handleArticleEngagement(request(productionId, { type: "heart", liked: true }), productionId)).status, 503);
    assert.equal(lib.calls.length, 1, `${logged} is not retried`);
    assert.deepEqual(JSON.parse(lib.logs[0].line.replace("[ARTICLE_ENGAGEMENT] ", "")), { schema: "ccpun.article_engagement.v1", outcome: "unavailable", stage: "database", method: "POST", error: logged });
  }
});

test("failure logging is redacted and bounded per minute", async () => {
  const lib = load();
  lib.fail("sql");
  for (let i = 0; i < 40; i++) await lib.handleArticleEngagement(request(productionId, { type: "heart", liked: true }), productionId);
  assert.equal(lib.logs.length, 30);
  assert.doesNotMatch(lib.logs.map(entry => entry.line).join("\n"), /function does not exist|91b217d8|[0-9a-f]{64}|synthetic|neon\.tech/);
  const missing = load({ CCPUN_ARTICLE_DATABASE_URL: undefined });
  assert.equal((await missing.handleArticleEngagement(request(), productionId)).status, 503);
  assert.deepEqual(JSON.parse(missing.logs[0].line.replace("[ARTICLE_ENGAGEMENT] ", "")), { schema: "ccpun.article_engagement.v1", outcome: "unavailable", stage: "runtime", method: "GET", error: "unavailable" });
});
