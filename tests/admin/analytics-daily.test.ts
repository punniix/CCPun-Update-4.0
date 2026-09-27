import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { analyticsHash, sanitizeAnalyticsRaw, shiftAnalyticsDate } from "../../lib/admin/analytics/model";
import { prepareUbersuggestWebImport } from "../../lib/admin/analytics/import";
import { analyticsExportStream, buildStoredMarketingExport, marketingExportXlsx } from "../../lib/admin/analytics/export";
import { ownerDatasetToCsv } from "../../lib/admin/agent-os/export-csv";
import { parseUbersuggestKeywordCsv } from "../../lib/admin/ubersuggest-csv";

const batchId = "00000000-0000-4000-8000-000000000001";
const collectedAt = "2026-09-27T12:00:00.000Z";
const metadata = { windowStart: "2026-08-01", windowEnd: "2026-08-31", market: "Thailand", language: "Thai", currency: null };
test("download stream preserves UTF8 bytes beyond the Vercel buffered response cap", async () => {
  const content = "ภาษาไทย".repeat(300_000);
  assert.ok(Buffer.byteLength(content) > 4_500_000);
  assert.equal(await new Response(analyticsExportStream(content)).text(), content);
});
test("raw sanitization preserves native metric period/series and removes credentials before hashing", () => {
  const sanitized = sanitizeAnalyticsRaw({ access_token: "should-not-store", "API Key": "hidden", api_key: "hidden", Signature: "hidden", keyword: "retained", data: [{ name: "views", period: "day", values: [{ value: 0, end_time: "2026-09-26T00:00:00Z" }] }], nested: { authorization: "Bearer hidden", url: "https://graph.facebook.com/a?access_token=hidden&metric=views" } });
  const json = JSON.stringify(sanitized);
  assert.doesNotMatch(json, /hidden|should-not-store|access_token|authorization/);
  assert.match(json, /end_time/); assert.match(json, /"value":0/); assert.match(json, /period/); assert.match(json, /metric=views/);
  assert.match(json, /"keyword":"retained"/); assert.doesNotMatch(json, /API Key|api_key|Signature/);
  assert.equal(analyticsHash(sanitized).length, 64);
  assert.equal(shiftAnalyticsDate("2026-03-01", -1), "2026-02-28");
});
test("website CSV retains every sanitized original row and unknown column; typed dataset separates invalid and duplicates", () => {
  const csv = "Keyword,Volume,CPC,PD,SD,Position,Estimated visits,URL,Unknown column,Access token\r\n=HYPERLINK(1),10,1.25,4,5,2,3,https://ccpun.com/a?token=hide,extra,hide\r\n=HYPERLINK(1),10,,,,,,,duplicate,hide\r\nbad,abc,,,,,,,invalid,hide";
  const data = prepareUbersuggestWebImport(csv, metadata, batchId, collectedAt);
  assert.equal(data.parsed.rows.length, 1); assert.equal(data.parsed.sourceRows, 3); assert.equal(data.parsed.duplicateRows, 1); assert.equal(data.parsed.invalidRowCount, 1);
  assert.equal(data.data.rows[0]?.CPC, 1.25); assert.equal(data.data.rows[0]?.["สกุลเงิน CPC"], null);
  assert.equal(data.data.sourceAsOf, null); assert.equal(data.data.windowEnd, "2026-08-31");
  const raw = data.body as { headers: string[]; records: string[][] };
  assert.ok(raw.headers.includes("Unknown column")); assert.equal(raw.records.length, 3);
  assert.doesNotMatch(JSON.stringify(data.body), /hide|Access token/);
  assert.equal(data.hash, analyticsHash(data.body));
});
test("legacy import keeps 200 cap while analytics accepts full website file up to its explicit 50k bound", () => {
  const csv = "Keyword,Volume\n" + Array.from({ length: 201 }, (_, index) => `keyword ${index},${index}`).join("\n");
  assert.throws(() => parseUbersuggestKeywordCsv(csv), /TOO_MANY_ROWS/);
  assert.equal(parseUbersuggestKeywordCsv(csv, 50_000).rows.length, 201);
  assert.throws(() => parseUbersuggestKeywordCsv(csv, 50_001), /TOO_MANY_ROWS/);
});
test("website source update date is stored and hashed without inventing a timezone or update time", () => {
  const data = prepareUbersuggestWebImport("Keyword,Position,Change,SearchIntent,Volume,SEODifficulty,URL\nประกัน,3,+1,Informational,100,30,https://ccpun.com/", { ...metadata, sourceAsOf: "2026-09-23" }, batchId, collectedAt);
  assert.equal(data.data.sourceAsOf, "2026-09-23"); assert.equal(data.data.nativeTimeZone, null);
  assert.equal((data.body as { sourceAsOf: string }).sourceAsOf, "2026-09-23");
  assert.ok((data.body as { headers: string[] }).headers.includes("Change"));
  assert.equal(data.data.rows[0]?.Intent, "informational"); assert.equal(data.data.rows[0]?.["Difficulty (0–100)"], 30); assert.equal(data.data.rows[0]?.["การเปลี่ยนอันดับ (ต้นทาง)"], "+1");
  const noDate = prepareUbersuggestWebImport("Keyword,Position,Change,SearchIntent,Volume,SEODifficulty,URL\nประกัน,3,+1,Informational,100,30,https://ccpun.com/", metadata, batchId, collectedAt);
  assert.notEqual(data.hash, noDate.hash);
});
test("CSV has BOM/CRLF, quotes text, protects spreadsheet formulas and leaves typed negative numbers unchanged", () => {
  const csv = ownerDatasetToCsv({ columns: ["คำค้น", "ค่า"], rows: [{ "คำค้น": " \t=IMPORTXML(1)", "ค่า": -2 }, { "คำค้น": 'a,"b"\nไทย', "ค่า": 0 }] });
  assert.ok(csv.startsWith("\uFEFF")); assert.match(csv, /' \t=IMPORTXML/); assert.match(csv, /,-2\r\n/); assert.match(csv, /"a,""b""\nไทย",0\r\n/);
});
test("completed-dataset files retain batch hash and source window and produce valid typed multi-sheet XLSX without formulas", () => {
  const input = prepareUbersuggestWebImport('Keyword,Volume,CPC\n"=1+1",0,1.25', { ...metadata, sourceAsOf: "2026-08-31" }, batchId, collectedAt);
  const dataset = buildStoredMarketingExport([input.data], collectedAt);
  assert.equal(dataset.rows[0]?.["Batch ID"], batchId); assert.equal(dataset.rows[0]?.["Raw SHA256"], input.hash);
  assert.equal(dataset.rows[0]?.["ช่วงข้อมูลสิ้นสุด"], metadata.windowEnd); assert.equal(dataset.rows[0]?.Volume, 0);
  assert.ok(dataset.overview.some(item => item.label.endsWith(" · ช่วงข้อมูล") && item.value === "2026-08-01 – 2026-08-31"));
  assert.ok(dataset.overview.some(item => item.label.endsWith(" · ต้นทางอัปเดต ณ") && item.value === "2026-08-31"));
  assert.ok(dataset.overview.some(item => item.label.endsWith(" · เขตเวลาต้นทาง") && item.value === "ไม่ทราบ"));
  assert.ok(dataset.overview.some(item => item.label.endsWith(" · จำกัดแถว") && item.value === "ไม่"));
  const folder = mkdtempSync(join(tmpdir(), "ccpun-xlsx-test-"));
  try {
    const path = join(folder, "export.xlsx"); writeFileSync(path, marketingExportXlsx([input.data], collectedAt));
    const check = execFileSync("python3", ["-c", "import sys,zipfile,xml.etree.ElementTree as E; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; roots=[E.fromstring(z.read(n)) for n in z.namelist() if n.endswith('.xml') or n.endswith('.rels')]; ns={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}; w=E.fromstring(z.read('xl/workbook.xml')); assert len(w.findall('m:sheets/m:sheet',ns))==3; s=E.fromstring(z.read('xl/worksheets/sheet2.xml')); assert not s.findall('.//m:f',ns); assert any(c.get('t')=='inlineStr' and ''.join(c.itertext())=='=1+1' for c in s.findall('.//m:c',ns)); assert any(c.get('t') is None and c.find('m:v',ns) is not None and c.find('m:v',ns).text=='0' for c in s.findall('.//m:c',ns)); print('ZIP CRC, XML, typed cells, three sheets PASS')", path], { encoding: "utf8" });
    assert.match(check, /PASS/);
  } finally { rmSync(folder, { recursive: true, force: true }); }
});
test("cached reads/exports have no provider calls; daily auth is dedicated service token and tables are EXECUTE-only", () => {
  const read = (path: string) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");
  assert.doesNotMatch(read("lib/admin/analytics/store.ts"), /getGoogleDataAccessToken|fetchGsc|fetchGa4|graph.facebook.com/);
  assert.doesNotMatch(read("apps/admin/app/api/admin/analytics/export/route.ts"), /collectAnalyticsSource|fetch\(/);
  const ownerBuilder = read("lib/admin/agent-os/export-datasets.ts").split("export async function buildOwnerExportDataset")[1]!;
  assert.match(ownerBuilder, /dataset === "marketing-analytics" \|\| dataset === "social-performance" \|\| dataset === "seo-intelligence"/);
  assert.doesNotMatch(ownerBuilder, /getSocialMarketingDashboard|listResearchSnapshots|getUbersuggestDashboardData/);
  assert.match(read("apps/admin/app/api/internal/analytics/daily/route.ts"), /isN8nExportRequestAuthorized/);
  const sql = read("db/migrations/20260927_analytics_daily_raw_v1.sql");
  assert.match(sql, /REVOKE ALL ON ccpun_admin.analytics_daily_batch,ccpun_admin.analytics_raw_page,ccpun_admin.analytics_completed_report FROM PUBLIC,ccpun_admin_runtime/);
  assert.doesNotMatch(sql, /GRANT (?:SELECT|INSERT|UPDATE|DELETE|ALL)/);
  assert.match(sql, /b.status='completed' AND b.completed_at<=p_cutoff/);
  assert.match(sql, /b.attempt<>\(p->>'attempt'\)::integer/);
});
