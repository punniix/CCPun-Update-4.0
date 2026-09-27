import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import type { AnalyticsDataset } from "../../lib/admin/analytics/model";
import { buildPerformanceExport, buildPerformanceTables } from "../../lib/admin/analytics/performance";
import { marketingExportXlsx } from "../../lib/admin/analytics/export";
import { ownerDatasetToCsv } from "../../lib/admin/agent-os/export-csv";
const now = "2026-09-27T12:00:00.000Z";
function dataset(report: AnalyticsDataset["report"], rows: AnalyticsDataset["rows"], sourceAsOf = "2026-09-24"): AnalyticsDataset {
  return { report, source: report.startsWith("gsc") ? "gsc" : report.startsWith("ubersuggest") ? "ubersuggest" : "ga4", title: report, batchId: "00000000-0000-4000-8000-000000000001", collectedAt: now, sourceAsOf, windowStart: "2026-08-28", windowEnd: sourceAsOf, nativeTimeZone: null, columns: [...new Set(rows.flatMap(row => Object.keys(row)))], rows, overview: [], limitations: [], truncated: false, rawHash: "a".repeat(64), lastAttemptAt: now, lastAttemptStatus: "completed" };
}
test("stored performance views retain exact join dates, unknowns, native campaign rates and typed formula-safe exports", () => {
  const gsc = dataset("gsc-query-page", [{ "คำค้น": " Insurance ", "หน้าเว็บ": "https://ccpun.com/", "การแสดงผล": 100, "คลิก": 0, "CTR (%)": 0, "อันดับเฉลี่ย": 12 }, { "คำค้น": "Insurances", "การแสดงผล": 99, "คลิก": 1, "อันดับเฉลี่ย": null }]);
  const ubs = dataset("ubersuggest-web-keywords", [{ "คำค้น": "insurance", Intent: "commercial", Volume: 0, "อันดับ": null }], "2026-09-23");
  const campaign = dataset("ga4-session-performance", [{ "วันที่": "2026-09-26", "แหล่งทราฟฟิก / Medium": "(direct) / (none)", "แคมเปญ": "(not set)", "หน้าเข้า": "/ci-planning", "เซสชัน": 4, "Engaged sessions": 2, "Key events": 0.5, "Session key event rate (%)": 25 }]);
  const activity = dataset("ga4-marketing-events", [{ "วันที่": "2026-09-26", Event: "ci_contact_click", "จำนวน event": 3 }]);
  const data = [gsc, ubs, campaign, activity], tables = buildPerformanceTables(data), first = tables[0]!.rows[0]!;
  assert.equal(first["ข้อมูลต้นทาง ณ"], "2026-09-24"); assert.equal(first["Ubersuggest ต้นทาง ณ"], "2026-09-23");
  assert.equal(first["Volume Ubersuggest"], 0); assert.equal(first["อันดับ Ubersuggest"], null); assert.equal(first["อันดับเฉลี่ย GSC"], 12);
  assert.match(String(first["งานที่ควรตรวจ"]), /ข้อความผลค้นหา/); assert.match(String(first["เหตุผล / กติกา"]), /ไม่ใช่ benchmark/);
  assert.equal(tables[0]!.rows[1]!["Volume Ubersuggest"], null); // No fuzzy join.
  const ambiguous = buildPerformanceTables([gsc, ubs, { ...ubs, batchId: "00000000-0000-4000-8000-000000000002" }])[0]!.rows[0]!;
  assert.equal(ambiguous["Volume Ubersuggest"], null); assert.match(String(ambiguous["การจับคู่คำค้น"]), /หลายแถว/);
  const fallback = buildPerformanceTables([ubs])[0]!.rows[0]!; assert.equal(fallback["การแสดงผล GSC"], null); assert.equal(fallback["Volume Ubersuggest"], 0); assert.match(String(fallback["งานที่ควรตรวจ"]), /วางแผน/);
  assert.equal(tables[2]!.rows[0]!["Key events"], 0.5); assert.equal(tables[2]!.rows[0]!["Session key event rate (%)"], 25); assert.equal(tables[2]!.rows[0]!["แคมเปญ"], "(not set)");
  assert.equal(tables[3]!.rows[0]!["ความหมาย"], "คลิกติดต่อจาก CI"); assert.match(tables[3]!.guidance, /ไม่ใช่ funnel/);
  assert.equal(tables[1]!.rows.find(row => row["ข้อมูล"] === "การตั้งค่า Key event")?.["สถานะ"], "ยังไม่ได้ยืนยัน");
  assert.equal(buildPerformanceTables([ubs])[2]!.rows.length, 0); assert.equal(buildPerformanceTables([ubs])[1]!.rows.find(row => row["ข้อมูล"] === "แคมเปญและหน้าเข้า")?.["สถานะ"], "ยังไม่มีรายงานที่บันทึกไว้");
  const unsafe = dataset("ubersuggest-web-keywords", [{ "คำค้น": "=1+1", Volume: 0 }]);
  const csv = ownerDatasetToCsv(buildPerformanceExport([unsafe], "seo-review", now)); assert.ok(csv.startsWith("\uFEFF")); assert.match(csv, /'=1\+1/); assert.match(csv, /Ubersuggest ต้นทาง ณ/);
  const folder = mkdtempSync(join(tmpdir(), "ccpun-performance-xlsx-"));
  try {
    const path = join(folder, "performance.xlsx"); writeFileSync(path, marketingExportXlsx([gsc, { ...ubs, rows: unsafe.rows }, campaign, activity], now));
    const result = execFileSync("python3", ["-c", "import sys,zipfile,xml.etree.ElementTree as E; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; ns={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}; w=E.fromstring(z.read('xl/workbook.xml')); names=[s.get('name') for s in w.findall('m:sheets/m:sheet',ns)]; assert len(names)==len(set(names)); assert all(len(n)<=31 for n in names); assert {'ภาพรวม','คำอธิบายข้อมูล','งานตรวจ SEO','ข้อมูลที่ต้องเชื่อม','แคมเปญและหน้าเข้า','กิจกรรมการตลาด'}.issubset(names); roots=[E.fromstring(z.read(n)) for n in z.namelist() if n.startswith('xl/worksheets/')]; assert not any(r.findall('.//m:f',ns) for r in roots); assert any(c.get('t') is None and c.find('m:v',ns) is not None and c.find('m:v',ns).text=='0.5' for r in roots for c in r.findall('.//m:c',ns)); print('PASS')", path], { encoding: "utf8" });
    assert.match(result, /PASS/);
  } finally { rmSync(folder, { recursive: true, force: true }); }
  const route = readFileSync(new URL("../../apps/admin/app/api/admin/analytics/export/route.ts", import.meta.url), "utf8");
  assert.match(route, /identity.role !== "owner"/); assert.match(route, /PERFORMANCE_VIEWS.includes/); assert.match(route, /report !== null \|\| format !== "csv"/); assert.doesNotMatch(route, /fetch\(|collectAnalyticsSource/);
});
