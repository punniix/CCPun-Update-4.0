import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  adminDataLaneLabel,
  contentReviewStatusLabel,
  connectionLabel,
  environmentLabel,
  friendlyApiError,
  friendlyApiErrorFromPayload,
  proposalStatusLabel,
  riskLabel,
  roleLabel,
} from "../../lib/admin/presentation";

test("admin presentation uses friendly Thai labels and hides unknown API detail", () => {
  assert.equal(roleLabel("owner"), "เจ้าของระบบ");
  assert.equal(proposalStatusLabel("needs-human-review"), "รอคุณตรวจสอบ");
  assert.equal(contentReviewStatusLabel("content-review"), "กำลังตรวจเนื้อหา");
  assert.equal(contentReviewStatusLabel("ready-for-coo"), "พร้อมให้คุณอนุมัติ");
  assert.equal(contentReviewStatusLabel("approved"), "อนุมัติเนื้อหาแล้ว");
  assert.equal(contentReviewStatusLabel(null), "ยังไม่มีข้อมูลการตรวจ");
  assert.equal(contentReviewStatusLabel("future-status"), "ไม่รู้จักขั้นตรวจนี้");
  assert.equal(riskLabel("critical"), "วิกฤต — ตรวจใน Studio");
  assert.equal(connectionLabel(false, "write"), "ปิดการบันทึกไว้เพื่อความปลอดภัย");
  assert.equal(environmentLabel("uat"), "ระบบทดสอบ UAT");
  assert.equal(environmentLabel("admin-uat"), "ระบบหลังบ้าน UAT");
  assert.equal(environmentLabel("local-uat"), "Local UAT บน Mac");
  assert.equal(environmentLabel("local-production"), "Local Production บน Mac (ข้อมูลจริง)");
  assert.equal(environmentLabel("production-admin"), "ระบบหลังบ้าน Production (ข้อมูลจริง)");
  assert.equal(adminDataLaneLabel("production-admin"), "Production Draft (ข้อมูลจริง)");
  assert.equal(adminDataLaneLabel("local-uat"), "UAT");
  assert.equal(adminDataLaneLabel("local-production"), "Production Draft (ข้อมูลจริง)");
  assert.equal(connectionLabel(true, "read", "local-production"), "อ่านข้อมูล Production ได้");
  assert.equal(connectionLabel(true, "studio", "local-production"), "แก้ฉบับร่าง Production ใน Studio ได้");
  assert.equal(connectionLabel(false, "studio", "local-production"), "ปิดการแก้ฉบับร่างไว้เพื่อความปลอดภัย");
  assert.equal(friendlyApiError("not-configured"), "การเชื่อมต่อของสภาพแวดล้อมนี้ยังตั้งค่าไม่ครบ ระบบจึงหยุดไว้เพื่อความปลอดภัย");
  assert.equal(friendlyApiError("article-not-found"), "ไม่พบบทความนี้ในสภาพแวดล้อมนี้");
  assert.doesNotMatch(friendlyApiError("not-configured"), /UAT|Production/);
  assert.doesNotMatch(friendlyApiError("article-not-found"), /UAT|Production/);
  assert.equal(friendlyApiError("suggestion-conflict"), "บทความหรือข้อเสนอเปลี่ยนไปแล้ว กรุณาโหลดหน้าใหม่และตรวจอีกครั้ง");
  assert.equal(friendlyApiError("suggestion-stale"), "ฉบับร่างเปลี่ยนหลังจากอนุมัติข้อเสนอนี้ กรุณาตรวจ SEO และสร้างข้อเสนอใหม่");
  assert.equal(friendlyApiError("raw-provider-secret-detail"), "ระบบยังทำรายการนี้ไม่สำเร็จ กรุณาลองอีกครั้ง");
  assert.equal(friendlyApiErrorFromPayload({ error: "forbidden", reason: "raw internal detail" }), "บัญชีนี้ไม่มีสิทธิ์ทำรายการนี้");
});

test("production-capable admin surfaces do not hard-code UAT copy", () => {
  const dashboard = readFileSync("app/(control-plane)/dashboard/page.tsx", "utf8");
  const login = readFileSync("app/(control-plane-auth)/login/page.tsx", "utf8");
  const audit = readFileSync("app/(control-plane)/operations/audit-log/page.tsx", "utf8");

  assert.match(dashboard, /พื้นที่นี้ทำงานใน/);
  assert.match(dashboard, /\{lane\}/);
  assert.doesNotMatch(dashboard, /status\.environment === "local-production" \? "production" : "uat"/);
  assert.doesNotMatch(login, /พื้นที่ทดสอบ/);
  assert.doesNotMatch(audit, /Sanity UAT/);
  assert.doesNotMatch(audit, /สลับไปอ่าน Production/);

  for (const path of [
    "features/admin/social/operations-page.tsx",
    "features/admin/social/calendar-page.tsx",
    "features/admin/social/analytics-page.tsx",
    "features/admin/social/overview-page.tsx",
    "features/admin/social/meta-connection-page.tsx",
    "features/admin/social/SocialPostsWorkspace.tsx",
    "features/admin/social/SocialWorkspaceSummary.tsx",
    "features/admin/social/provider-readonly-panels.tsx",
    "features/admin/social/SocialSheetsExport.tsx",
  ]) {
    const source = readFileSync(path, "utf8");
    assert.doesNotMatch(source, /Sanity UAT|Neon UAT|ฐานข้อมูล UAT|SANITY UAT|LIVE UAT|HISTORICAL SOCIAL UAT/);
  }

  const socialOverview = readFileSync("features/admin/social/overview-page.tsx", "utf8");
  assert.match(socialOverview, /isSocialProviderExecutionGateEnabled\(\)/);
  assert.match(socialOverview, /providerWriteEnabled \? "ใช้ได้หลังผู้มีสิทธิ์อนุมัติ" : "ปิดอยู่"/);
  assert.match(socialOverview, /ส่งได้เฉพาะข้อความหรือลิงก์ที่อนุมัติแล้ว ส่วนสื่อยังทำด้วยตนเอง/);
});

test("content list separates document state from content review state", () => {
  const contentPage = readFileSync("app/(control-plane)/content/articles/page.tsx", "utf8");
  const sanityControl = readFileSync("lib/admin/sanity-control.ts", "utf8");
  assert.match(contentPage, /สถานะเอกสาร/);
  assert.match(contentPage, /ขั้นตรวจเนื้อหา/);
  assert.match(contentPage, /เผยแพร่แล้ว · มีฉบับร่างแก้ไข/);
  assert.match(contentPage, /runSeoAudit\(article\.id, false\)/);
  assert.match(contentPage, /คำนวณจากฉบับปัจจุบัน · ยังไม่บันทึก/);
  assert.match(contentPage, /ดูรายละเอียดผลตรวจ/);
  assert.match(contentPage, /เผยแพร่ครั้งแรก/);
  assert.match(sanityControl, /requireReadClient\("published"\)/);
  assert.match(sanityControl, /hasPublished/);
  assert.doesNotMatch(contentPage, /ฉบับร่าง ·/);
});
