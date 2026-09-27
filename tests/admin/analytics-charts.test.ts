import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AnalyticsCharts, keywordChartData, nativeMetricBars } from "../../features/admin/analytics/AnalyticsCharts";
import type { AnalyticsDataset } from "../../lib/admin/analytics/model";

const dataset = (rows: AnalyticsDataset["rows"], report: AnalyticsDataset["report"] = "ubersuggest-web-keywords"): AnalyticsDataset => ({ report, source: "ubersuggest", title: "รายงานจริง", rows, columns: [], batchId: "00000000-0000-4000-8000-000000000001", collectedAt: "2026-09-27T12:00:00Z", sourceAsOf: "2026-09-23", windowStart: "2026-08-28", windowEnd: "2026-09-27", nativeTimeZone: null, overview: [], limitations: [], truncated: false, rawHash: "a".repeat(64), lastAttemptAt: null, lastAttemptStatus: null });

test("rank infographic preserves unranked/fractional values as unknown and counts exact boundaries", () => {
  const values = [1, 3, 4, 10, 11, 20, 21, 50, 51, 100, 101, null, 0, 1.5];
  const model = keywordChartData(dataset(values.map((rank, index) => ({ "คำค้น": `คำค้น ${index}`, "อันดับ": rank, Intent: index % 2 ? "informational" : null, Volume: index === 0 ? 0 : null }))));
  assert.deepEqual(model.ranks.map((item) => item.value), [2, 2, 2, 4, 1]);
  assert.equal(model.unknownRank, 3); assert.equal(model.ranked, 11); assert.equal(model.topTen, 4);
  assert.equal(model.intents.reduce((total, item) => total + item.value, 0), values.length);
  assert.deepEqual(model.top, [{ label: "คำค้น 0", value: 0 }]); assert.equal(model.unknownVolume, 13); assert.equal(model.zeroVolume, 1);
});

test("native bar chart ranks observed values only and preserves explicit zero without summing distinct rows", () => {
  const rows = [{ name: "missing", clicks: null }, { name: "zero", clicks: 0 }, { name: "top", clicks: 5 }, { name: "top", clicks: 3 }, { name: "invalid", clicks: -1 }];
  assert.deepEqual(nativeMetricBars({ rows }, "name", "clicks"), [{ label: "top", value: 5 }, { label: "top", value: 3 }, { label: "zero", value: 0 }]);
});

test("mixed intent is one keyword bucket regardless of tag order and unavailable intent stays unknown", () => {
  const model = keywordChartData(dataset([{ Intent: "informational,commercial" }, { Intent: "commercial,informational" }, { Intent: "mixed" }, { Intent: "-" }, { Intent: null }]));
  assert.deepEqual(model.intents, [{ label: "หลายเจตนา (ผสม)", value: 3 }, { label: "ไม่ระบุ Intent", value: 2 }]);
  const html = renderToStaticMarkup(createElement(AnalyticsCharts, { dataset: dataset([{ "คำค้น": "same", "หน้าเว็บ": "/one", "คลิก": 5 }, { "คำค้น": "same", "หน้าเว็บ": "/two", "คลิก": 3 }], "gsc-query-page") }));
  assert.match(html, /\/one/); assert.match(html, /\/two/);
});

test("rendered infographic exposes real counts and accessible SVG title, never a fake trend or unknown zero percentage", () => {
  const html = renderToStaticMarkup(createElement(AnalyticsCharts, { dataset: dataset([{ "คำค้น": "ไทย <unsafe>", "อันดับ": 3, Volume: 20, Intent: "informational" }, { "คำค้น": "unknown", "อันดับ": null, Volume: null, Intent: null }]) }));
  assert.match(html, /2 คำค้น/); assert.match(html, /role="img"/); assert.match(html, /ต้นทางระบุอันดับ 1 จาก 2/);
  assert.match(html, /ไม่ระบุ Intent/); assert.match(html, /ไทย &lt;unsafe&gt;/); assert.match(html, /เป็นภาพ ณ ช่วงข้อมูล ไม่ใช่แนวโน้มรายวัน/);
  const unknown = renderToStaticMarkup(createElement(AnalyticsCharts, { dataset: dataset([{ "คำค้น": "no metrics", "อันดับ": null, Volume: null, Intent: null }]) }));
  assert.match(unknown, /ยังไม่มีอันดับที่ระบุพอคำนวณสัดส่วน/); assert.doesNotMatch(unknown, /role="img"|>0%/);
  assert.equal(renderToStaticMarkup(createElement(AnalyticsCharts, { dataset: dataset([]) })), "");
  assert.equal(renderToStaticMarkup(createElement(AnalyticsCharts, { dataset: dataset([], "gsc-summary") })), "");
});

test("GA4 daily-dimension charts keep scoped session and event rows without implying leads or deriving key-event rates", () => {
  const sessions = renderToStaticMarkup(createElement(AnalyticsCharts, { dataset: dataset([{ "วันที่": "2026-09-20", "แหล่งทราฟฟิก / Medium": "google / organic", "แคมเปญ": "report campaign", "หน้าเข้า": "/ci-planning/", "เซสชัน": 2, "Key events": 3.75, "Session key event rate (%)": 25 }], "ga4-session-performance") }));
  assert.match(sessions, /google \/ organic/); assert.match(sessions, /2026-09-20/); assert.match(sessions, /report campaign/); assert.match(sessions, /\/ci-planning\//);
  assert.doesNotMatch(sessions, /3\.75|187\.5%/);
  const events = renderToStaticMarkup(createElement(AnalyticsCharts, { dataset: dataset([{ "วันที่": "2026-09-20", Event: "line_oa_click", "จำนวน event": 0 }, { "วันที่": "2026-09-21", Event: "line_oa_click", "จำนวน event": null }], "ga4-marketing-events") }));
  assert.match(events, /line_oa_click/); assert.match(events, /2026-09-20/); assert.doesNotMatch(events, /2026-09-21/);
  assert.match(events, /ไม่ใช่จำนวนลูกค้าหรือยอดขายที่ยืนยันแล้ว/);
});
