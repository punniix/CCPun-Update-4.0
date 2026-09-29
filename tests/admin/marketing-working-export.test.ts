import assert from "node:assert/strict";
import test from "node:test";
import type { AnalyticsDataset } from "../../lib/admin/analytics/model";
import { buildPerformanceExport } from "../../lib/admin/analytics/performance";
import { buildContentPerformanceRows, buildMarketingTrackingOverview } from "../../lib/admin/analytics/tracking-overview";
import { ownerDatasetToCsv } from "../../lib/admin/agent-os/export-csv";
import { exportSelectionSchema } from "../../lib/admin/agent-os/export-contract";

const now = "2026-09-29T05:00:00.000Z";
function dataset(report: AnalyticsDataset["report"], rows: AnalyticsDataset["rows"], source: AnalyticsDataset["source"], title: string): AnalyticsDataset {
  return {
    report, source, title,
    batchId: "00000000-0000-4000-8000-" + String(report.length).padStart(12, "0"),
    collectedAt: now,
    sourceAsOf: "2026-09-28",
    windowStart: "2026-09-22",
    windowEnd: "2026-09-28",
    nativeTimeZone: source === "gsc" ? "America/Los_Angeles" : "Asia/Bangkok",
    columns: [...new Set(rows.flatMap((row) => Object.keys(row)))],
    rows,
    overview: [],
    limitations: [],
    truncated: false,
    rawHash: report[0]!.repeat(64),
    lastAttemptAt: now,
    lastAttemptStatus: "completed",
  };
}

const social = dataset("social-performance", [{
  "แพลตฟอร์ม": "Facebook",
  "Provider Object ID": "post-1",
  "วันที่เผยแพร่ (UTC)": "2026-09-27T12:00:00Z",
  "เนื้อหา": "ประกันรถน้ำท่วม คุ้มครองแบบไหน",
  "รูปแบบ": "post",
  "ลิงก์โพสต์": "https://facebook.com/ccpun/posts/post-1",
  "Insights status": "partial-or-available",
  "ยอดดู": 1200,
  "Reach": 900,
  "คลิก": 45,
  "Total interactions": 80,
  "คอมเมนต์": 10,
  "แชร์": 12,
  "บันทึก": 4,
}], "meta", "Meta · ผลงานโพสต์");

const gscQuery = dataset("gsc-query-page", [{
  "คำค้น": "ประกันสุขภาพ",
  "หน้าเว็บ": "https://ccpun.com/blog/health-insurance/aia-health-happy-describe/",
  "คลิก": 20,
  "การแสดงผล": 500,
  "CTR (%)": 4,
  "อันดับเฉลี่ย": 7.5,
}], "gsc", "Google Search Console · คำค้นและหน้า");

const ubersuggest = dataset("ubersuggest-web-keywords", [{
  "คำค้น": "ประกันสุขภาพ",
  Intent: "commercial",
  Volume: 1600,
  "Difficulty (0–100)": 42,
  "อันดับ": 8,
  "Estimated visits": 120,
  "หน้าเว็บ": "https://ccpun.com/blog/health-insurance/aia-health-happy-describe/",
  "พื้นที่": "Thailand",
  "ภาษา": "Thai",
}], "ubersuggest", "Ubersuggest · Website CSV");

const gscPage = dataset("gsc-daily-page", [{
  "วันที่": "2026-09-28",
  "หน้าเว็บ": "https://ccpun.com/blog/health-insurance/aia-health-happy-describe/",
  "คลิก": 9,
  "การแสดงผล": 240,
  "CTR (%)": 3.75,
  "อันดับเฉลี่ย": 6.5,
}], "gsc", "GSC · รายวันต่อหน้า");

const ga4Organic = dataset("ga4-daily-organic", [{
  "วันที่": "2026-09-28",
  "หน้าเข้า": "/blog/health-insurance/aia-health-happy-describe/",
  "เซสชัน": 30,
  "Engaged sessions": 22,
}], "ga4", "GA4 · Organic รายวันต่อหน้า");

const campaign = dataset("ga4-session-performance", [{
  "วันที่": "2026-09-28",
  "แหล่งทราฟฟิก / Medium": "google / organic",
  "แคมเปญ": "(organic)",
  "หน้าเข้า": "/blog/health-insurance/aia-health-happy-describe/",
  "เซสชัน": 30,
  "Engaged sessions": 22,
  "Key events": 2,
  "Session key event rate (%)": 6.67,
}], "ga4", "GA4 · ช่องทาง แคมเปญ และหน้าเข้า");

const activity = dataset("ga4-marketing-events", [{
  "วันที่": "2026-09-28",
  Event: "ci_calculator_complete",
  "จำนวน event": 5,
}], "ga4", "GA4 · Events ของ CI / FHC / LINE");

const all = [social, gscQuery, ubersuggest, gscPage, ga4Organic, campaign, activity];

test("All Marketing Stats is normalized owner working data, not a sparse raw union", () => {
  const rows = buildMarketingTrackingOverview(all);
  assert.ok(rows.length > 10);
  assert.ok(rows.some((row) => row["ประเภทที่ติดตาม"] === "Content" && row["รายการ"] === "ประกันรถน้ำท่วม คุ้มครองแบบไหน" && row.Metric === "Views" && row["ค่า"] === 1200));
  assert.ok(rows.some((row) => row["ประเภทที่ติดตาม"] === "Keyword" && row["รายการ"] === "ประกันสุขภาพ" && row.Metric === "Average Position" && row["ค่า"] === 7.5));
  assert.ok(rows.some((row) => row["ประเภทที่ติดตาม"] === "Traffic" && row.Metric === "Sessions" && row["ค่า"] === 30));
  assert.ok(rows.some((row) => row["ประเภทที่ติดตาม"] === "Activity" && row["รายการ"] === "ci_calculator_complete" && row["ค่า"] === 5));
  assert.ok(rows.every((row) => Object.hasOwn(row, "ข้อมูลต้นทางถึง") && Object.hasOwn(row, "คุณภาพข้อมูล") && Object.hasOwn(row, "Batch ID")));
});

test("Content Performance shows social engagement and web search/organic performance by content", () => {
  const rows = buildContentPerformanceRows(all);
  const post = rows.find((row) => row["ID อ้างอิง"] === "post-1")!;
  assert.equal(post.Views, 1200);
  assert.equal(post.Reach, 900);
  assert.equal(post.Clicks, 45);

  const page = rows.find((row) => row["ประเภทคอนเทนต์"] === "Web page")!;
  assert.equal(page["Search Clicks"], 9);
  assert.equal(page["Search Impressions"], 240);
  assert.equal(page["Organic Sessions"], 30);
  assert.equal(page["Engaged Sessions"], 22);
  assert.ok(Math.abs(Number(page["Engagement Rate (%)"]) - 73.3333333333) < 0.001);
});

test("Keyword Performance joins exact GSC keyword with Ubersuggest context for analysis", () => {
  const output = buildPerformanceExport(all, "keyword-performance", now);
  const row = output.rows.find((item) => item["คำค้น"] === "ประกันสุขภาพ")!;
  assert.equal(row["คลิก GSC"], 20);
  assert.equal(row["การแสดงผล GSC"], 500);
  assert.equal(row["อันดับเฉลี่ย GSC"], 7.5);
  assert.equal(row["Intent Ubersuggest"], "commercial");
  assert.equal(row["Volume Ubersuggest"], 1600);
  assert.equal(row["Difficulty Ubersuggest (0–100)"], 42);
  assert.equal(row["อันดับ Ubersuggest"], 8);
});

test("CSV working export has stable owner columns and is not the old 80+ column raw archive", () => {
  const output = buildPerformanceExport(all, "tracking-overview", now);
  const csv = ownerDatasetToCsv(output);
  assert.ok(output.columns.length < 30);
  assert.match(csv, /ประเภทที่ติดตาม,แพลตฟอร์ม \/ แหล่งข้อมูล,รายงานต้นทาง/);
  assert.match(csv, /ประกันรถน้ำท่วม คุ้มครองแบบไหน/);
  assert.match(csv, /ประกันสุขภาพ/);
  assert.doesNotMatch(csv.split("\r\n")[0]!, /Reaction Angry|Paid difficulty|AI Visibility/);
});

test("Google Sheet selection accepts owner-facing views and defaults server-side to tracking overview when omitted", () => {
  for (const view of ["tracking-overview", "content-performance", "keyword-performance"] as const) {
    assert.equal(exportSelectionSchema.safeParse({ dataset: "marketing-analytics", view }).success, true);
  }
  assert.deepEqual(exportSelectionSchema.parse({ dataset: "marketing-analytics" }), { dataset: "marketing-analytics" });
});
