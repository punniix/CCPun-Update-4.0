import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { aisvSourceRuntimeLabel } from "../../lib/admin/seo-intelligence/aisv";
import { ownerAnalyticsLimitation, ownerAnalyticsOverviewLabel, ownerAnalyticsOverviewValue } from "../../features/admin/analytics/owner-copy";

test("Owner results presentation retains period/source selection, stored provenance and per-report CSV scope", async () => {
  const { transpileModule, ModuleKind } = createRequire(import.meta.url)("typescript") as typeof import("typescript");
  const source = readFileSync(new URL("../../features/admin/analytics/StoredAnalyticsDashboard.tsx", import.meta.url), "utf8");
  const compiled = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS, jsx: 4 } }).outputText;
  const selected = { source: "gsc", report: "gsc-summary", batchId: "synthetic-batch", windowStart: "2026-10-01", windowEnd: "2026-10-07", sourceAsOf: "2026-10-08", collectedAt: "2026-10-09T02:00:00Z", overview: [], rows: [{ clicks: 0 }], columns: ["clicks"], limitations: [], nativeTimeZone: "Asia/Bangkok" };
  let unavailable = false;
  const permissions: string[] = [];
  const loaded = { exports: {} as { StoredAnalyticsDashboard: (props: unknown) => Promise<unknown> } };
  runInNewContext(compiled, { module: loaded, exports: loaded.exports, Date, Intl, encodeURIComponent,
    require: (name: string) => {
      if (name === "next/link") return { default: "a" };
      if (name === "react") return { cache: (fn: unknown) => fn };
      if (name === "react/jsx-runtime") { const jsx = (type: unknown, props: unknown) => typeof type === "function" ? type(props) : ({ type, props }); return { jsx, jsxs: jsx }; }
      if (name === "./AnalyticsCharts") return { AnalyticsCharts: () => null };
      if (name === "./PerformanceInsights") return { PerformanceInsights: () => null };
      if (name === "./DailyAssessment") return { DailyAssessment: () => null };
      if (name === "./owner-copy") return { ownerAnalyticsLimitation, ownerAnalyticsOverviewLabel, ownerAnalyticsOverviewValue };
      if (name.endsWith("/assessment")) return { readDailyAssessment: async () => null };
      if (name.endsWith("/store")) return { readAnalyticsDashboard: async () => ({ state: unavailable ? "unavailable" : "ready", datasets: unavailable ? [] : [selected, { ...selected, source: "ga4", report: "ga4-summary", batchId: "synthetic-other" }], sources: [] }) };
      if (name.endsWith("/require-permission")) return { requireAdminPermission: async (permission: string) => permissions.push(permission) };
      assert.fail(`Unexpected module ${name}`);
    } });
  const rendered = JSON.stringify(await loaded.exports.StoredAnalyticsDashboard({ searchParams: { source: "gsc", report: "gsc-summary", period: "2026-10-01|2026-10-07" }, now: Date.parse("2026-10-09T03:00:00Z") }));
  assert.match(rendered, /"name":"source","defaultValue":"gsc"/);
  assert.match(rendered, /"name":"period","defaultValue":"2026-10-01\|2026-10-07"/);
  assert.match(rendered, /\/api\/admin\/analytics\/export\/\?report=gsc-summary/);
  assert.doesNotMatch(rendered, /\/api\/admin\/analytics\/export\/\?report=ga4-summary/);
  assert.match(rendered, /"dateTime":"2026-10-08"/);
  assert.match(rendered, /"dateTime":"2026-10-09T02:00:00Z"/);
  assert.match(rendered, /"children":"0"/);
  unavailable = true;
  const failed = JSON.stringify(await loaded.exports.StoredAnalyticsDashboard({ searchParams: {}, now: Date.now() }));
  assert.match(failed, /"role":"status"[^}]*ยังอ่านคลังข้อมูลไม่ได้/);
  assert.deepEqual(permissions, ["settings:read", "settings:read"]);
});

test("Research names known AISV collection paths and explains an unknown path without jargon", () => {
  assert.equal(aisvSourceRuntimeLabel("ccpun-local-admin"), "CCPun Local Admin");
  assert.equal(aisvSourceRuntimeLabel("chatgpt-ubersuggest-connector"), "ChatGPT · Ubersuggest Connector");
  assert.equal(aisvSourceRuntimeLabel(null), "ยังไม่ทราบ Runtime");
  assert.equal(aisvSourceRuntimeLabel("unexpected-path"), "ยังไม่ทราบ Runtime");
});

test("Analytics explains the Production AISV summary while retaining exact stored values", () => {
  const limitation = "อ่าน stored Research/AISV เดิม ไม่ยิง Ubersuggest ใหม่; แถว keyword และ prompt มี grain ต่างกัน; provider runtime อยู่บน Local Mac; ไม่รวม 2 คำค้นทดสอบ CSV ที่ COO อนุมัติ";
  assert.equal(ownerAnalyticsOverviewLabel("seo-intelligence", "AISV Runtime"), "AISV Runtime");
  assert.equal(ownerAnalyticsOverviewValue("seo-intelligence", "AISV Runtime", "ccpun-local-admin"), "CCPun Local Admin");
  assert.match(ownerAnalyticsLimitation("seo-intelligence", limitation), /ไม่ดึง Ubersuggest ใหม่.*ข้อมูลสองชนิดนับคนละแบบ.*เครื่องภายใน CCPun/);
  assert.doesNotMatch(ownerAnalyticsLimitation("seo-intelligence", limitation), /stored|keyword|prompt|grain|runtime|Local Mac/);
  assert.equal(ownerAnalyticsOverviewLabel("gsc-summary", "AISV Runtime"), "AISV Runtime");
  assert.match(ownerAnalyticsLimitation("gsc-summary", limitation), /เปิดข้อความต้นฉบับ/);
  const page = readFileSync(new URL("../../features/admin/analytics/StoredAnalyticsDashboard.tsx", import.meta.url), "utf8");
  assert.match(page, /ownerAnalyticsOverviewLabel\(item\.report, metric\.label\)/);
  assert.match(page, /ownerAnalyticsOverviewValue\(item\.report, metric\.label, metric\.value\)/);
  assert.match(page, /ownerAnalyticsLimitation\(item\.report, note\)/);
  assert.match(page, /ข้อความต้นฉบับสำหรับทีมดูแล/);
});

test("Analytics gives source report codes and stored limitations an owner-readable display", () => {
  const page = readFileSync(new URL("../../features/admin/analytics/StoredAnalyticsDashboard.tsx", import.meta.url), "utf8");
  for (const report of ["ga4-content-events", "ga4-daily-organic", "gsc-daily-page", "gsc-daily-query-page"]) {
    assert.match(page, new RegExp(`"${report}": "[ก-๙]`));
  }
  assert.match(page, /รหัสรายงาน: \{item\.report\}/);
  assert.equal(ownerAnalyticsOverviewLabel("ga4-session-performance", "Grain"), "Grain");
  assert.equal(ownerAnalyticsOverviewValue("ga4-content-events", "Grain", "วัน × event name"), "วัน × event name");
  assert.equal(ownerAnalyticsOverviewValue("ubersuggest-web-keywords", "ประเภทไฟล์", "keyword-coverage"), "Keyword Coverage");
  assert.match(ownerAnalyticsLimitation("ga4-summary", "Unexpected provider limitation"), /ยังไม่ได้แปล.*ก่อนใช้ตัวเลขนี้ตัดสินใจ/);
  for (const [report, note] of [
    ["ga4-content-events", "Scope: hostName ccpun.com/www.ccpun.com only; blog.ccpun.com excluded explicitly"],
    ["gsc-daily-page", "Final web data; page-only totals and query diagnostics are separate grains; no summation of overlapping report windows"],
    ["social-performance", "Provider response pages และ insight period/end_time เก็บใน raw ก่อน normalize"],
  ]) {
    assert.match(ownerAnalyticsLimitation(report, note), /[ก-๙]/);
    assert.doesNotMatch(ownerAnalyticsLimitation(report, note), /Scope:|Final web data|Provider response/);
  }
});
