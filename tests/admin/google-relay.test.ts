import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const directory = mkdtempSync(join(tmpdir(), "ccpun-google-relay-test-"));
const stub = join(directory, "server-only.cjs");
writeFileSync(stub, "module.exports={};");
registerHooks({ resolve(specifier, context, next) { if (specifier === "server-only") return { url: pathToFileURL(stub).href, shortCircuit: true }; return next(specifier, context); } });
after(() => rmSync(directory, { recursive: true, force: true }));

const relay = () => import("../../lib/admin/google-relay");
const GSC_ENV = { CCPUN_GSC_SITE_URL: "sc-domain:ccpun.com" };
const GA4_ENV = { CCPUN_GA4_PROPERTY_ID: "219719845" };
type Planned = { key: string; url: string; body: Record<string, unknown> };

function gscResponse(body: Record<string, unknown>) {
  const dimensions = body.dimensions as string[];
  const keys = dimensions.map((dimension) => dimension === "date" ? String(body.endDate) : dimension === "page" ? "https://ccpun.com/ci-planning/" : "ประกันโรคร้ายแรง");
  return { rows: [{ keys, clicks: 2, impressions: 40, ctr: 0.05, position: 7.5 }], responseAggregationType: "byPage" };
}

test("relay fetcher answers the token exchange locally, records unknown Google requests and replays known bodies", async () => {
  const { createGoogleRelayFetcher, googleRelayKey, GOOGLE_RELAY_TOKEN } = await relay();
  const url = "https://www.googleapis.com/webmasters/v3/sites/sc-domain%3Accpun.com/searchAnalytics/query";
  const body = JSON.stringify({ startDate: "2026-10-01", endDate: "2026-10-07" });
  const empty = createGoogleRelayFetcher([]);
  const token = await empty.fetcher("https://oauth2.googleapis.com/token", { method: "POST", body: "client_secret=never-sent" });
  assert.equal((await token.json()).access_token, GOOGLE_RELAY_TOKEN);
  assert.equal((await empty.fetcher(url, { method: "POST", body })).status, 503);
  assert.equal((await empty.fetcher(url, { method: "POST", body })).status, 503);
  assert.deepEqual(empty.missing(), [{ key: googleRelayKey(url, body), method: "POST", url, body: JSON.parse(body) }]);
  await assert.rejects(empty.fetcher("https://example.com/collect", { method: "POST", body }), /GOOGLE_RELAY_UNSUPPORTED_REQUEST/);
  await assert.rejects(empty.fetcher(url, { method: "GET" }), /GOOGLE_RELAY_UNSUPPORTED_REQUEST/);
  const known = createGoogleRelayFetcher([{ key: googleRelayKey(url, body), status: 200, body: { rows: [] } }]);
  const replayed = await known.fetcher(url, { method: "POST", body });
  assert.equal(replayed.status, 200);
  assert.deepEqual(await replayed.json(), { rows: [] });
  assert.deepEqual(known.missing(), []);
});

test("relay response contract is strict and bounded", async () => {
  const { googleRelayResponsesSchema, GOOGLE_RELAY_MAX_RESPONSES } = await relay();
  const key = "a".repeat(64);
  assert.equal(googleRelayResponsesSchema.safeParse([{ key, status: 200, body: {} }]).success, true);
  assert.equal(googleRelayResponsesSchema.safeParse([{ key: "short", status: 200, body: {} }]).success, false);
  assert.equal(googleRelayResponsesSchema.safeParse([{ key, status: 200, body: {}, token: "x" }]).success, false);
  assert.equal(googleRelayResponsesSchema.safeParse(Array.from({ length: GOOGLE_RELAY_MAX_RESPONSES + 1 }, () => ({ key, status: 200, body: {} }))).success, false);
});

test("marketing GSC relay plans the exact Admin requests and needs nothing more once n8n returns them", async () => {
  const { createGoogleRelayFetcher, GOOGLE_RELAY_TOKEN } = await relay();
  const { planMarketingRelay, collectMarketingDaily } = await import("../../lib/admin/marketing/collect");
  const first = createGoogleRelayFetcher([]);
  await planMarketingRelay("gsc", "2026-10-01", "2026-10-07", { token: GOOGLE_RELAY_TOKEN, fetcher: first.fetcher }, GSC_ENV);
  const planned = first.missing() as Planned[];
  assert.equal(planned.length, 2);
  for (const request of planned) {
    assert.equal(request.url, "https://www.googleapis.com/webmasters/v3/sites/sc-domain%3Accpun.com/searchAnalytics/query");
    assert.equal(request.body.dataState, "final");
    assert.equal(request.body.startDate, "2026-10-01");
  }
  assert.deepEqual(planned.map((request) => (request.body.dimensions as string[]).join()).sort(), ["date,page", "date,query,page"]);
  const responses = planned.map((request) => ({ key: request.key, status: 200, body: gscResponse(request.body) }));
  const second = createGoogleRelayFetcher(responses);
  await planMarketingRelay("gsc", "2026-10-01", "2026-10-07", { token: GOOGLE_RELAY_TOKEN, fetcher: second.fetcher }, GSC_ENV);
  assert.deepEqual(second.missing(), []);
  const replay = createGoogleRelayFetcher(responses);
  const reports = await collectMarketingDaily({ source: "gsc", token: GOOGLE_RELAY_TOKEN, resource: "sc-domain:ccpun.com", start: "2026-10-01", end: "2026-10-07" }, () => replay.fetcher, Date.now() + 85_000);
  assert.deepEqual(reports.map((report) => report.report).sort(), ["gsc-daily-page", "gsc-daily-query-page"]);
  const page = reports.find((report) => report.report === "gsc-daily-page")!;
  assert.equal(page.rows[0]?.["วันที่"], "2026-10-07");
  assert.equal(page.rows[0]?.["CTR (%)"], 5);
});

test("marketing GA4 relay plans hostname-scoped native and campaign reports for the configured property", async () => {
  const { createGoogleRelayFetcher, GOOGLE_RELAY_TOKEN } = await relay();
  const { planMarketingRelay } = await import("../../lib/admin/marketing/collect");
  const plan = createGoogleRelayFetcher([]);
  await planMarketingRelay("ga4", "2026-10-01", "2026-10-07", { token: GOOGLE_RELAY_TOKEN, fetcher: plan.fetcher }, GA4_ENV);
  const planned = plan.missing() as Planned[];
  assert.equal(planned.length, 3);
  for (const request of planned) {
    assert.equal(request.url, "https://analyticsdata.googleapis.com/v1beta/properties/219719845:runReport");
    assert.match(JSON.stringify(request.body), /hostName/);
  }
});

test("marketing relay refuses an unconfigured resource instead of guessing one", async () => {
  const { createGoogleRelayFetcher, GOOGLE_RELAY_TOKEN } = await relay();
  const { planMarketingRelay } = await import("../../lib/admin/marketing/collect");
  await assert.rejects(planMarketingRelay("gsc", "2026-10-01", "2026-10-07", { token: GOOGLE_RELAY_TOKEN, fetcher: createGoogleRelayFetcher([]).fetcher }, { CCPUN_GSC_SITE_URL: "not a site" }), /NOT_CONFIGURED/);
});

test("analytics daily relay dry-run discovers requests round by round without touching storage", async () => {
  const { createGoogleRelayFetcher, GOOGLE_RELAY_TOKEN } = await relay();
  const { collectAnalyticsSource } = await import("../../lib/admin/analytics/collect");
  // No database URL is configured: any storage call would throw, so a "dry-run" result proves storage was untouched.
  const gscPlan = createGoogleRelayFetcher([]);
  const gscDry = await collectAnalyticsSource("gsc", "2026-10-24", GSC_ENV, gscPlan.fetcher, { mode: "relay-dry-run", relayToken: GOOGLE_RELAY_TOKEN });
  assert.equal(gscDry.status, "dry-run");
  const gscRequests = gscPlan.missing() as Planned[];
  assert.equal(gscRequests.length, 2);
  const gscResponses = gscRequests.map((request) => ({ key: request.key, status: 200, body: request.body.rowLimit === 1 ? { rows: [{ keys: ["x"], clicks: 3, impressions: 90, ctr: 0.0333, position: 9 }] } : { rows: [{ keys: ["ประกันโรคร้ายแรง", "https://ccpun.com/ci-planning/"], clicks: 3, impressions: 90, ctr: 0.0333, position: 9 }] } }));
  const gscDone = createGoogleRelayFetcher(gscResponses);
  const complete = await collectAnalyticsSource("gsc", "2026-10-24", GSC_ENV, gscDone.fetcher, { mode: "relay-dry-run", relayToken: GOOGLE_RELAY_TOKEN });
  assert.deepEqual(gscDone.missing(), []);
  assert.equal(complete.status, "dry-run");
  assert.equal("reports" in complete ? complete.reports : 0, 2);

  const ga4First = createGoogleRelayFetcher([]);
  await collectAnalyticsSource("ga4", "2026-10-24", GA4_ENV, ga4First.fetcher, { mode: "relay-dry-run", relayToken: GOOGLE_RELAY_TOKEN });
  const baseline = ga4First.missing() as Planned[];
  assert.equal(baseline.length, 2);
  const baselineResponses = baseline.map((request) => ({ key: request.key, status: 200, body: Array.isArray(request.body.dimensions)
    ? { dimensionHeaders: [{ name: "landingPage" }], metricHeaders: [{ name: "sessions" }, { name: "engagedSessions" }], rows: [], rowCount: 0, metadata: { timeZone: "Asia/Bangkok" } }
    : { metricHeaders: [{ name: "activeUsers" }, { name: "sessions" }, { name: "eventCount" }], totals: [{ metricValues: [{ value: "8" }, { value: "10" }, { value: "30" }] }], metadata: { timeZone: "Asia/Bangkok" } } }));
  const ga4Second = createGoogleRelayFetcher(baselineResponses);
  await collectAnalyticsSource("ga4", "2026-10-24", GA4_ENV, ga4Second.fetcher, { mode: "relay-dry-run", relayToken: GOOGLE_RELAY_TOKEN });
  const optional = ga4Second.missing() as Planned[];
  assert.ok(optional.length >= 1, "optional GA4 marketing reports are requested in the next round");
  assert.equal(optional.some((request) => baseline.some((item) => item.key === request.key)), false);
});

test("relay modes are refused for non-Google sources and without the relay token", async () => {
  const { createGoogleRelayFetcher } = await relay();
  const { collectAnalyticsSource } = await import("../../lib/admin/analytics/collect");
  await assert.rejects(collectAnalyticsSource("meta", "2026-10-24", {}, createGoogleRelayFetcher([]).fetcher, { mode: "relay-dry-run", relayToken: "x" }), /ANALYTICS_RELAY_UNSUPPORTED/);
  await assert.rejects(collectAnalyticsSource("gsc", "2026-10-24", GSC_ENV, createGoogleRelayFetcher([]).fetcher, { mode: "relay-dry-run" }), /ANALYTICS_RELAY_UNSUPPORTED/);
});

test("internal routes keep the dedicated service-token guard and only relax payload size for relay bodies", () => {
  const daily = readFileSync("apps/admin/app/api/internal/analytics/daily/route.ts", "utf8");
  const refresh = readFileSync("apps/admin/app/api/internal/marketing/refresh/route.ts", "utf8");
  for (const route of [daily, refresh]) {
    assert.match(route, /isN8nExportRequestAuthorized\(request\)\)return NextResponse\.json\(\{error:"unauthorized"\},\{status:401,headers\}\)|isN8nExportRequestAuthorized\(request\)\) return NextResponse\.json\(\{ error: "unauthorized" \}, \{ status: 401, headers \}\)/);
    assert.match(route, /GOOGLE_RELAY_MAX_BYTES/);
  }
  assert.match(daily, /if \(!relayResponses && bytes > 1024\) return/);
  assert.match(refresh, /parsed\.data\.operation!=="relay"&&size>2048\)return/);
  assert.match(daily, /mode: "relay-dry-run"/);
  assert.doesNotMatch(daily + refresh, /CLIENT_SECRET|REFRESH_TOKEN/);
});
