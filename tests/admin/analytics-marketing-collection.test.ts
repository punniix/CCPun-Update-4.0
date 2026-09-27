import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { analyticsReportSchema, fetchOptionalGa4Marketing, ga4MarketingRequest, normalizeGa4Marketing, sanitizeAnalyticsRaw } from "../../lib/admin/analytics/model";

const input = { propertyId: "123", token: "synthetic-not-a-credential", startDate: "2026-08-30", endDate: "2026-09-26" };
function response(report: "ga4-session-performance" | "ga4-marketing-events") {
  const request = ga4MarketingRequest(report, input.startDate, input.endDate);
  return { dimensionHeaders: request.dimensions, metricHeaders: request.metrics, rowCount: 1,
    rows: [{ dimensionValues: (report === "ga4-session-performance" ? ["20260926", "google / cpc", "CI September", "/ci-planning/"] : ["20260926", "ci_calculator_complete"]).map((value) => ({ value })),
      metricValues: (report === "ga4-session-performance" ? ["10", "6", "3.5", "0.2"] : ["3"]).map((value) => ({ value })) }],
    metadata: { timeZone: "Asia/Bangkok", subjectToThresholding: true, dataLossFromOtherRow: true, samplingMetadatas: [{ samplesReadCount: "100", samplingSpaceSize: "200" }] } };
}
test("marketing request uses native session attribution and path-only dimension, never assumes events are leads", () => {
  assert.ok(analyticsReportSchema.options.includes("ga4-session-performance"));
  assert.deepEqual(ga4MarketingRequest("ga4-session-performance", input.startDate, input.endDate).dimensions.map((item) => item.name), ["date", "sessionSourceMedium", "sessionCampaignName", "landingPage"]);
  const events = ga4MarketingRequest("ga4-marketing-events", input.startDate, input.endDate);
  assert.equal(events.limit, "10000"); assert.equal(events.offset, "0");
  assert.equal(events.dimensionFilter?.filter.stringFilter.value, "^(ci_.*|fhc_.*|line_oa_click)$");
});
test("native decimals, dates, flags and session rate remain correct: 20 percent is not 3.5/10", () => {
  const report = normalizeGa4Marketing("ga4-session-performance", response("ga4-session-performance"), input.startDate, input.endDate);
  assert.equal(report.rows[0]?.["Key events"], 3.5); assert.equal(report.rows[0]?.["Session key event rate (%)"], 20);
  assert.equal(report.rows[0]?.["วันที่"], "2026-09-26"); assert.equal(report.nativeTimeZone, "Asia/Bangkok");
  assert.ok(report.limitations.some((value) => value.includes("thresholding")));
  assert.ok(report.limitations.some((value) => value.includes("sampled")));
  assert.ok(report.limitations.some((value) => value.includes("(other)")));
  const events = normalizeGa4Marketing("ga4-marketing-events", response("ga4-marketing-events"), input.startDate, input.endDate);
  assert.equal(events.rows[0]?.["จำนวน event"], 3); assert.ok(events.limitations.some((value) => value.includes("ไม่ใช่ lead")));
});
test("empty native report is valid; count overflow, date, headers, query paths and wrong event family fail without zero fallback", () => {
  const empty = { ...response("ga4-marketing-events"), rows: undefined, rowCount: 0 };
  assert.deepEqual(normalizeGa4Marketing("ga4-marketing-events", empty, input.startDate, input.endDate).rows, []);
  const mutations = [
    (raw: ReturnType<typeof response>) => { raw.rows[0]!.metricValues[0]!.value = "9007199254740992"; },
    (raw: ReturnType<typeof response>) => { raw.rows[0]!.metricValues[0]!.value = "3.1"; },
    (raw: ReturnType<typeof response>) => { raw.rows[0]!.dimensionValues[0]!.value = "20260230"; },
    (raw: ReturnType<typeof response>) => { raw.rows[0]!.dimensionValues[0]!.value = "20260927"; },
    (raw: ReturnType<typeof response>) => { raw.rows[0]!.dimensionValues[1]!.value = "purchase"; },
    (raw: ReturnType<typeof response>) => { raw.metricHeaders[0]!.name = "keyEvents"; },
  ];
  for (const change of mutations) { const raw = response("ga4-marketing-events"); change(raw); assert.throws(() => normalizeGa4Marketing("ga4-marketing-events", raw, input.startDate, input.endDate)); }
  const path = response("ga4-session-performance"); path.rows[0]!.dimensionValues[3]!.value += "?email=private";
  assert.throws(() => normalizeGa4Marketing("ga4-session-performance", path, input.startDate, input.endDate));
  path.rows[0]!.dimensionValues[3]!.value = "/ci-planning/#private";
  assert.throws(() => normalizeGa4Marketing("ga4-session-performance", path, input.startDate, input.endDate));
  const rate = response("ga4-session-performance"); rate.rows[0]!.metricValues[3]!.value = "1.01";
  assert.throws(() => normalizeGa4Marketing("ga4-session-performance", rate, input.startDate, input.endDate));
});
test("one-page coverage is honest and full metadata stays in sanitized raw", () => {
  const raw = { ...response("ga4-session-performance"), rowCount: 10001, access_token: "hidden" };
  const report = normalizeGa4Marketing("ga4-session-performance", raw, input.startDate, input.endDate);
  assert.equal(report.truncated, true); assert.equal(report.overview[0]?.value, 10001);
  assert.ok(report.limitations.some((value) => value.includes("10,000")));
  const sanitized = sanitizeAnalyticsRaw(raw);
  assert.match(JSON.stringify(sanitized), /samplesReadCount|subjectToThresholding|rowCount/);
  assert.doesNotMatch(JSON.stringify(sanitized), /hidden|access_token/);
});
test("optional incompatible/unsupported response does not reject or erase the other successful report", async () => {
  const calls: string[] = [];
  const outcomes = await fetchOptionalGa4Marketing(input, (report) => (async (_url, options) => {
    calls.push(report);
    const body = JSON.parse(String(options?.body));
    assert.deepEqual(body.dateRanges, [{ startDate: input.startDate, endDate: input.endDate }]);
    assert.ok(options?.signal); assert.equal(options?.cache, "no-store");
    return report === "ga4-session-performance" ? Response.json({ error: { code: 400, message: "incompatible dimensions" } }, { status: 400 }) : Response.json(response(report));
  }) as typeof fetch, Date.now() + 90_000);
  assert.equal(calls.length, 2); assert.equal(outcomes[0]?.data, null); assert.equal(outcomes[0]?.error, "provider-unavailable-or-incompatible");
  assert.equal(outcomes[1]?.data?.rows[0]?.["จำนวน event"], 3);
  assert.deepEqual(outcomes.filter((value) => value.data).map((value) => value.report), ["ga4-marketing-events"]);
});
test("invalid JSON/schema and network failure are optional omissions, never fake zero reports", async () => {
  const outcomes = await fetchOptionalGa4Marketing(input, (report) => (async () => {
    if (report === "ga4-session-performance") throw new Error("synthetic network failure");
    return Response.json({ unexpected: true });
  }) as typeof fetch, Date.now() + 90_000);
  assert.deepEqual(outcomes.map((value) => value.data), [null, null]);
  assert.deepEqual(outcomes.map((value) => value.error), ["provider-unavailable-or-incompatible", "invalid-response"]);
});
test("insufficient remaining source budget makes no extra API calls", async () => {
  let calls = 0;
  const outcomes = await fetchOptionalGa4Marketing(input, () => (async () => { calls++; return Response.json({}); }) as typeof fetch, Date.now() + 19_000);
  assert.equal(calls, 0); assert.deepEqual(outcomes.map((value) => value.error), ["time-budget", "time-budget"]);
});
test("v2 atomic CHECK superset keeps v1 immutable and grants unchanged; ledger body checksum is exact", () => {
  const read = (path: string) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");
  const sql = read("db/migrations/20260927_analytics_marketing_reports_v2.sql");
  const body = sql.split("-- checksum-source-begin\n")[1]!.split("-- checksum-source-end")[0]!;
  const hash = createHash("sha256").update(body).digest("hex");
  assert.match(sql, new RegExp("sha256:" + hash));
  assert.match(sql, /BEGIN;[\s\S]*DROP CONSTRAINT[\s\S]*ADD CONSTRAINT[\s\S]*COMMIT;/);
  assert.doesNotMatch(sql, /DROP TABLE|DELETE FROM|GRANT|CREATE OR REPLACE FUNCTION/);
  for (const report of analyticsReportSchema.options) assert.ok(sql.includes("'" + report + "'"));
  assert.match(sql, /96bb27179454643c5f0e8e991e5a41193a344755d3b65cc3b8dadf0b8e9cf076/);
  const collect = read("lib/admin/analytics/collect.ts");
  assert.match(collect, /if \(result.data\) reports.push/); assert.match(collect, /else \{/);
  assert.match(collect, /18_000_000/); assert.match(collect, /raw.splice\(index, 1\)/);
  const v1 = read("db/migrations/20260927_analytics_daily_raw_v1.sql");
  assert.match(v1, /SELECT DISTINCT ON\(r.report\)/); // Failed optional report omission retains per-report last-good.
});


test("actual daily collector retains baseline on optional incompatibility, invalid raw, overrun and payload overflow", () => {
  const folder = mkdtempSync(join(tmpdir(), "ccpun-marketing-collector-"));
  try {
    const stub = join(folder, "dependencies.cjs");
    writeFileSync(stub, `module.exports = {
      getGoogleDataAccessToken: async () => 'synthetic-not-a-credential', getSeoGoogleProviderReadiness: () => ({status:'manual-sync-ready'}),
      fetchGscSearchAnalytics: () => {}, fetchGscSearchAnalyticsTotals: () => {}, fetchMetaReadOnlyDiscovery: () => {}, getUbersuggestDashboardData: () => {}, buildSeoIntelligenceExport: () => {}, readAnalyticsResearch: () => {},
      fetchGa4LandingPages: async (_input, fetcher) => { await fetcher('https://analyticsdata.googleapis.com/v1beta/properties/123:runReport', {method:'POST',body:JSON.stringify({dimensions:[{name:'landingPage'}]})}); return {timeZone:'Asia/Bangkok',rows:[{landingPage:'/ci-planning/',sessions:4,engagedSessions:2,engagementRate:0.5}],limitations:[],truncated:false}; },
      beginAnalyticsCollection: async () => ({status:'claimed',batchId:'00000000-0000-4000-8000-000000000001',attempt:1}),
      finishAnalyticsCollection: async (input) => { globalThis.finished = input; return input.error ? 'failed' : 'completed'; }
    };`);
    const script = `import assert from 'node:assert/strict'; import {registerHooks} from 'node:module'; import {pathToFileURL} from 'node:url';
      const stub=pathToFileURL(process.argv[1]).href, mode=process.argv[2];
      registerHooks({resolve(s,c,next){if(s==='server-only' || (c.parentURL?.endsWith('/analytics/collect.ts') && s!=='zod' && s!=='./model')) return {url:stub,shortCircuit:true}; return next(s,c);}});
      const {collectAnalyticsSource}=await import('./lib/admin/analytics/collect.ts');
      const templates=${JSON.stringify({ sessions: response('ga4-session-performance'), events: response('ga4-marketing-events') })};
      let clock=Date.now(); Date.now=()=>clock;
      const result=await collectAnalyticsSource('ga4','2026-09-27',{CCPUN_GA4_PROPERTY_ID:'123'},async (_url,init)=>{
        const query=JSON.parse(init.body), dimensions=query.dimensions?.map(item=>item.name) ?? [];
        if(!dimensions.length) return Response.json({metricHeaders:[{name:'activeUsers'},{name:'sessions'},{name:'eventCount'}],totals:[{metricValues:[{value:'8'},{value:'10'},{value:'30'}]}],metadata:{timeZone:'Asia/Bangkok'}});
        if(dimensions.length===1) return Response.json({rows:[],rowCount:0});
        if(dimensions.includes('eventName')) return Response.json(templates.events);
        if(mode==='unsupported') return Response.json({error:{code:400,message:'incompatible dimensions'}},{status:400});
        if(mode==='invalid') templates.sessions.rows[0].dimensionValues[3].value='/ci-planning/?email=private';
        if(mode==='oversize') templates.sessions.extra='x'.repeat(9_000_000);
        if(mode==='overrun') clock+=91_000;
        return Response.json(templates.sessions);
      });
      assert.equal(result.status,'completed'); assert.equal(globalThis.finished.error,null);
      const saved=globalThis.finished, ids=saved.reports.map(item=>item.report);
      assert.ok(ids.includes('ga4-summary')); assert.ok(ids.includes('ga4-organic-landing'));
      if(mode==='success') {assert.equal(saved.reports.length,4); const raw=saved.raw.find(item=>item.report==='ga4-session-performance'); assert.equal(raw.body.metadata.samplingMetadatas[0].samplesReadCount,'100'); assert.equal(raw.requestMeta.parameters.query.limit,'10000'); assert.ok(!JSON.stringify(raw).includes('synthetic-not-a-credential'));}
      else {assert.ok(!ids.includes('ga4-session-performance')); assert.ok(saved.reports[0].limitations.some(value=>value.includes('รายงานเสริม')));}
      if(mode==='unsupported') {assert.ok(ids.includes('ga4-marketing-events')); assert.ok(saved.raw.some(item=>item.report==='ga4-session-performance' && item.body.error.code===400));}
      if(mode==='invalid') {assert.ok(ids.includes('ga4-marketing-events')); assert.ok(!JSON.stringify(saved).includes('email=private')); assert.ok(!saved.raw.some(item=>item.report==='ga4-session-performance'));}
      if(mode==='oversize' || mode==='overrun') {assert.equal(saved.reports.length,2); assert.ok(!saved.raw.some(item=>item.report==='ga4-session-performance' || item.report==='ga4-marketing-events'));}
      console.log('collector '+mode+' PASS');`;
    for (const mode of ["success", "unsupported", "invalid", "overrun", "oversize"]) {
      const result = execFileSync(process.execPath, ["--input-type=module", "--import", "tsx", "-e", script, stub, mode], { cwd: new URL("../../", import.meta.url), encoding: "utf8", timeout: 15_000 });
      assert.match(result, /PASS/);
    }
  } finally { rmSync(folder, { recursive: true, force: true }); }
});
