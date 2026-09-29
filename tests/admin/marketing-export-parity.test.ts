import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { AnalyticsDataset } from "../../lib/admin/analytics/model";
import { buildPerformanceExport, buildPerformanceTables } from "../../lib/admin/analytics/performance";
import { buildContentPerformanceRows } from "../../lib/admin/analytics/tracking-overview";
import { canonicalizeMarketingUrl } from "../../lib/admin/analytics/marketing-url";

const now = "2026-09-29T05:30:00.000Z";
function dataset(report: AnalyticsDataset["report"], rows: AnalyticsDataset["rows"], batchSuffix = "000000000001"): AnalyticsDataset {
  return {
    report,
    source: report.startsWith("gsc") ? "gsc" : report.startsWith("ga4") ? "ga4" : report === "social-performance" ? "meta" : "ubersuggest",
    title: report,
    batchId: "00000000-0000-4000-8000-" + batchSuffix,
    collectedAt: now,
    sourceAsOf: "2026-09-28",
    windowStart: "2026-09-01",
    windowEnd: "2026-09-28",
    nativeTimeZone: "Asia/Bangkok",
    columns: [...new Set(rows.flatMap((row) => Object.keys(row)))],
    rows,
    overview: [],
    limitations: [],
    truncated: false,
    rawHash: "a".repeat(64),
    lastAttemptAt: now,
    lastAttemptStatus: "completed",
  };
}

test("legacy and current CCPun URLs resolve to one canonical content identity", () => {
  assert.deepEqual(canonicalizeMarketingUrl("https://blog.ccpun.com/aia-health-happy-describe/"), {
    observedUrl: "https://blog.ccpun.com/aia-health-happy-describe/",
    canonicalUrl: "https://ccpun.com/blog/health-insurance/aia-health-happy-describe/",
    mappingStatus: "redirected",
  });
  assert.equal(
    canonicalizeMarketingUrl("https://ccpun.com/blog/life-insurance/aia-health-happy-describe/").canonicalUrl,
    "https://ccpun.com/blog/health-insurance/aia-health-happy-describe/",
  );

  const gsc = dataset("gsc-query-page", [
    { "คำค้น": "aia health happy", "หน้าเว็บ": "https://ccpun.com/blog/life-insurance/aia-health-happy-describe/", "คลิก": 2, "การแสดงผล": 20, "CTR (%)": 10, "อันดับเฉลี่ย": 8 },
    { "คำค้น": "aia health happy", "หน้าเว็บ": "https://ccpun.com/blog/health-insurance/aia-health-happy-describe/", "คลิก": 3, "การแสดงผล": 30, "CTR (%)": 10, "อันดับเฉลี่ย": 6 },
  ]);
  const keyword = buildPerformanceTables([gsc]).find((table) => table.view === "keyword-performance")!;
  assert.equal(keyword.rows.length, 1);
  assert.equal(keyword.rows[0]?.["หน้าเป้าหมาย"], "https://ccpun.com/blog/health-insurance/aia-health-happy-describe/");
  assert.match(String(keyword.rows[0]?.["Observed URL"]), /life-insurance/);
  assert.match(String(keyword.rows[0]?.["Observed URL"]), /health-insurance/);
  assert.equal(keyword.rows[0]?.["คลิก GSC"], 5);
  assert.equal(keyword.rows[0]?.["การแสดงผล GSC"], 50);
  assert.equal(keyword.rows[0]?.["อันดับเฉลี่ย GSC"], 6.8);
});

test("Content Performance aggregates search and organic metrics by canonical page", () => {
  const gsc = dataset("gsc-daily-page", [
    { "วันที่": "2026-09-27", "หน้าเว็บ": "https://ccpun.com/blog/life-insurance/aia-health-happy-describe/", "คลิก": 2, "การแสดงผล": 20, "CTR (%)": 10, "อันดับเฉลี่ย": 8 },
    { "วันที่": "2026-09-28", "หน้าเว็บ": "https://ccpun.com/blog/health-insurance/aia-health-happy-describe/", "คลิก": 3, "การแสดงผล": 30, "CTR (%)": 10, "อันดับเฉลี่ย": 6 },
  ]);
  const ga4 = dataset("ga4-daily-organic", [
    { "วันที่": "2026-09-27", "หน้าเข้า": "/blog/life-insurance/aia-health-happy-describe/", "เซสชัน": 4, "Engaged sessions": 3 },
    { "วันที่": "2026-09-28", "หน้าเข้า": "/blog/health-insurance/aia-health-happy-describe/", "เซสชัน": 6, "Engaged sessions": 5 },
  ], "000000000002");
  const rows = buildContentPerformanceRows([gsc, ga4]).filter((row) => row["ประเภทคอนเทนต์"] === "Web page");
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.URL, "https://ccpun.com/blog/health-insurance/aia-health-happy-describe/");
  assert.equal(rows[0]?.["Search Clicks"], 5);
  assert.equal(rows[0]?.["Search Impressions"], 50);
  assert.equal(rows[0]?.["Organic Sessions"], 10);
  assert.equal(rows[0]?.["Engaged Sessions"], 8);
  assert.match(String(rows[0]?.["Observed URLs"]), /life-insurance/);
  assert.match(String(rows[0]?.["Observed URLs"]), /health-insurance/);
  assert.equal(rows[0]?.["URL mapping"], "redirected");
});

test("CSV, XLSX source table, and Google Sheet selected view share one owner-facing table", () => {
  const gsc = dataset("gsc-query-page", [
    { "คำค้น": "ประกันสุขภาพ", "หน้าเว็บ": "https://ccpun.com/blog/health-insurance/aia-health-happy-describe/", "คลิก": 4, "การแสดงผล": 100, "CTR (%)": 4, "อันดับเฉลี่ย": 7 },
  ]);
  const ubs = dataset("ubersuggest-web-keywords", [
    { "คำค้น": "ประกันสุขภาพ", Intent: "commercial", Volume: 1000, "Difficulty (0–100)": 35, "อันดับ": 7, "หน้าเว็บ": "https://ccpun.com/blog/health-insurance/aia-health-happy-describe/" },
  ], "000000000002");

  const table = buildPerformanceTables([gsc, ubs]).find((item) => item.view === "keyword-performance")!;
  const csvDataset = buildPerformanceExport([gsc, ubs], "keyword-performance", now);
  assert.deepEqual(csvDataset.columns, table.columns);
  assert.deepEqual(csvDataset.rows, table.rows);

  const workflow = JSON.parse(readFileSync(new URL("../../workers/local-ai/n8n/owner-export-google-sheet.direct.json", import.meta.url), "utf8"));
  const prepare = workflow.nodes.find((node: { name: string }) => node.name === "เตรียมค่า Sheet");
  const sheet = new Function("$input", "$", prepare.parameters.jsCode)(
    { first: () => ({ json: { spreadsheetId: "parity-sheet", sheets: [{ properties: { sheetId: 1 } }, { properties: { sheetId: 2 } }] } }) },
    () => ({ item: { json: csvDataset } }),
  )[0].json;
  assert.deepEqual(sheet.dataValues[0], table.columns);
  assert.deepEqual(sheet.dataValues.slice(1), table.rows.map((row) => table.columns.map((column) => row[column] ?? "")));

  const xlsxSource = readFileSync(new URL("../../lib/admin/analytics/export.ts", import.meta.url), "utf8");
  assert.match(xlsxSource, /const analysis = buildPerformanceTables\(datasets\)/);
  assert.match(xlsxSource, /table\.columns/);
  assert.match(xlsxSource, /table\.rows/);
  assert.doesNotMatch(xlsxSource, /\.\.\.rawTabs/);
});
