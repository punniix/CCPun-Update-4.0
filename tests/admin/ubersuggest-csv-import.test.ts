import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  parseUbersuggestKeywordIdeasCsv,
  UBERSUGGEST_CSV_MAX_ROWS,
} from "../../lib/admin/ubersuggest-csv";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("Ubersuggest Keyword Ideas CSV maps current web export columns", () => {
  const result = parseUbersuggestKeywordIdeasCsv([
    "Keywords,Intent,Volume,CPC,PD,SEO Difficulty",
    '"ประกันบำนาญ",Informational,2400,18.50,42,31',
    '"ประกันบำนาญ ลดหย่อนภาษี","Commercial, Informational","1,300",22.4,35,28',
  ].join("\n"));

  assert.equal(result.reportType, "keyword-ideas");
  assert.equal(result.sourceRows, 2);
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[0]?.keyword, "ประกันบำนาญ");
  assert.equal(result.rows[0]?.intent, "informational");
  assert.equal(result.rows[0]?.volume, 2400);
  assert.equal(result.rows[0]?.cpc, 18.5);
  assert.equal(result.rows[0]?.paidDifficulty, 42);
  assert.equal(result.rows[0]?.difficulty, 31);
  assert.equal(result.rows[1]?.intent, "mixed");
  assert.equal(result.rows[1]?.volume, 1300);
});

test("Ubersuggest Keywords by Traffic CSV keeps ranking provenance", () => {
  const result = parseUbersuggestKeywordIdeasCsv([
    "Keyword,Position,Est. Visits,Volume,CPC,SEO Difficulty,URL",
    '"ประกันรถยนต์",8,"1,250","2,400",19.5,32,https://ccpun.com/blog/car-insurance/',
  ].join("\n"));

  assert.equal(result.reportType, "keyword-coverage");
  assert.equal(result.rows[0]?.keyword, "ประกันรถยนต์");
  assert.equal(result.rows[0]?.position, 8);
  assert.equal(result.rows[0]?.estimatedVisits, 1250);
  assert.equal(result.rows[0]?.volume, 2400);
  assert.equal(result.rows[0]?.url, "https://ccpun.com/blog/car-insurance/");
});

test("CSV parser handles quoted commas, BOM, blank rows and duplicate keywords", () => {
  const result = parseUbersuggestKeywordIdeasCsv([
    "\uFEFFKeyword,Search Intent,Search Volume,Cost per Click,Paid Difficulty,Search Difficulty",
    '"ประกันรถ, ชั้น 1",C,900,"12.75",31,22',
    "",
    '"  ประกันรถ   ชั้น 2+  ",I,500,9,20,18',
    '"ประกันรถ ชั้น 2+",I,500,9,20,18',
  ].join("\r\n"));

  assert.equal(result.sourceRows, 3);
  assert.equal(result.rows.length, 2);
  assert.equal(result.duplicateRows, 1);
  assert.equal(result.rows[0]?.keyword, "ประกันรถ, ชั้น 1");
  assert.equal(result.rows[0]?.intent, "commercial");
  assert.equal(result.rows[1]?.keyword, "ประกันรถ ชั้น 2+");
});

test("CSV parser keeps valid rows while reporting invalid numeric rows", () => {
  const result = parseUbersuggestKeywordIdeasCsv([
    "Keyword,Volume,CPC,PD,SD",
    "good keyword,100,10,20,30",
    "bad difficulty,100,10,20,101",
    "bad volume,-1,10,20,30",
  ].join("\n"));

  assert.equal(result.rows.length, 1);
  assert.equal(result.invalidRows.length, 2);
  assert.equal(result.invalidRows[0]?.row, 3);
  assert.equal(result.invalidRows[1]?.row, 4);
});

test("CSV parser fails closed on unsupported reports and oversized batches", () => {
  assert.throws(
    () => parseUbersuggestKeywordIdeasCsv("URL,Traffic,Backlinks\nhttps://example.com,1,2"),
    /UBERSUGGEST_CSV_HEADER_UNSUPPORTED/,
  );

  const rows = Array.from({ length: UBERSUGGEST_CSV_MAX_ROWS + 1 }, (_, index) => `keyword ${index},10,20`);
  assert.throws(
    () => parseUbersuggestKeywordIdeasCsv(["Keyword,Volume,SD", ...rows].join("\n")),
    /UBERSUGGEST_CSV_TOO_MANY_ROWS/,
  );
});

test("Admin CSV import keeps preview/import gates and does not auto-publish or auto-track", () => {
  const route = read("app/api/admin/research/ubersuggest/import/route.ts");
  const ui = read("features/admin/components/UbersuggestCsvImport.tsx");
  const page = read("features/admin/research/page.tsx");
  const research = read("lib/admin/research.ts");

  assert.match(route, /identity\.actorType !== "human"/);
  assert.match(route, /"research:read"/);
  assert.match(route, /action: "research:create"/);
  assert.match(route, /isResearchWriteReady\(\)/);
  assert.match(route, /scope: \`ubersuggest:web-csv:\\${meta\\.reportType}\\`/);
  assert.match(route, /sourceMethod: "web-csv-import"/);
  assert.match(route, /previewRows\.filter\(\(row\) => row\.status !== "existing"\)/);
  assert.doesNotMatch(route, /publish|track_keywords|DispatchSEO|sanity/i);

  assert.match(ui, /ตรวจไฟล์ก่อนนำเข้า/);
  assert.match(ui, /ยังไม่ Track keyword หรือสร้างบทความให้อัตโนมัติ/);
  assert.match(page, /<UbersuggestCsvImport \/>/);

  assert.match(research, /parsed\.sourceMethod === "web-csv-import"/);
  assert.match(research, /parsed\.cpc \?\? ""/);
  assert.match(research, /parsed\.paidDifficulty \?\? ""/);
  assert.match(research, /parsed\.sourcePosition \?\? ""/);
  assert.match(research, /parsed\.estimatedVisits \?\? ""/);
});
