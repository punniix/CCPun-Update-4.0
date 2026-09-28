import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { aisvSourceRuntimeLabel } from "../../lib/admin/seo-intelligence/aisv";
import { ownerAnalyticsLimitation, ownerAnalyticsOverviewLabel, ownerAnalyticsOverviewValue } from "../../features/admin/analytics/owner-copy";

test("Research names known AISV collection paths and explains an unknown path without jargon", () => {
  assert.equal(aisvSourceRuntimeLabel("ccpun-local-admin"), "เก็บจากเครื่องมือภายใน CCPun");
  assert.equal(aisvSourceRuntimeLabel("chatgpt-ubersuggest-connector"), "นำเข้าผ่านการเชื่อมต่อ Ubersuggest");
  assert.equal(aisvSourceRuntimeLabel(null), "ยังไม่ทราบวิธีดึงข้อมูล");
  assert.equal(aisvSourceRuntimeLabel("unexpected-path"), "ยังไม่ทราบวิธีดึงข้อมูล");
});

test("Analytics explains the Production AISV summary while retaining exact stored values", () => {
  const limitation = "อ่าน stored Research/AISV เดิม ไม่ยิง Ubersuggest ใหม่; แถว keyword และ prompt มี grain ต่างกัน; provider runtime อยู่บน Local Mac; ไม่รวม 2 คำค้นทดสอบ CSV ที่ COO อนุมัติ";
  assert.equal(ownerAnalyticsOverviewLabel("seo-intelligence", "AISV Runtime"), "วิธีเก็บข้อมูลการปรากฏในคำตอบ AI");
  assert.equal(ownerAnalyticsOverviewValue("seo-intelligence", "AISV Runtime", "ccpun-local-admin"), "เก็บจากเครื่องมือภายใน CCPun");
  assert.match(ownerAnalyticsLimitation("seo-intelligence", limitation), /ไม่ดึง Ubersuggest ใหม่.*ข้อมูลสองชนิดนับคนละแบบ.*เครื่องภายใน CCPun/);
  assert.doesNotMatch(ownerAnalyticsLimitation("seo-intelligence", limitation), /stored|keyword|prompt|grain|runtime|Local Mac/);
  assert.equal(ownerAnalyticsOverviewLabel("gsc-summary", "AISV Runtime"), "AISV Runtime");
  assert.equal(ownerAnalyticsLimitation("gsc-summary", limitation), limitation);
  const page = readFileSync(new URL("../../features/admin/analytics/StoredAnalyticsDashboard.tsx", import.meta.url), "utf8");
  assert.match(page, /ownerAnalyticsOverviewLabel\(item\.report, metric\.label\)/);
  assert.match(page, /ownerAnalyticsOverviewValue\(item\.report, metric\.label, metric\.value\)/);
  assert.match(page, /ownerAnalyticsLimitation\(item\.report, note\)/);
  assert.match(page, /ข้อความต้นฉบับสำหรับทีมดูแล/);
});
