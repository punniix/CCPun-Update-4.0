import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { aisvSourceRuntimeLabel } from "../../lib/admin/seo-intelligence/aisv";
import { ownerAnalyticsLimitation, ownerAnalyticsOverviewLabel, ownerAnalyticsOverviewValue } from "../../features/admin/analytics/owner-copy";

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
