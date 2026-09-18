import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  lineBotDecisionLabel,
  lineDocumentStatusLabel,
  lineEvidenceSourceLabel,
  lineJourneyLabel,
  lineMessageStatusLabel,
  lineStageLabel,
  lineTechnicalStateLabel,
} from "../../lib/admin/line/presentation";

const root = path.resolve(import.meta.dirname, "../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

test("raw LINE states are translated into plain Thai before display", () => {
  assert.equal(lineStageLabel("New"), "ลูกค้าใหม่");
  assert.equal(lineStageLabel("Quote"), "กำลังดูใบเสนอราคา");
  assert.equal(lineStageLabel("Won"), "ดูแลเรียบร้อยแล้ว");
  assert.equal(lineJourneyLabel("motor_quote_review"), "ประกันรถ");
  assert.equal(lineBotDecisionLabel("human_handoff"), "รอปันตอบ");
  assert.equal(lineDocumentStatusLabel("pending_fetch"), "กำลังรับไฟล์จาก LINE");
  assert.equal(lineDocumentStatusLabel("pending_upload"), "กำลังเก็บไฟล์");
  assert.equal(lineDocumentStatusLabel("reconciliation_required"), "สถานะไฟล์ยังไม่ชัด ต้องเช็กอีกครั้ง");
  assert.equal(lineMessageStatusLabel("unsent"), "ลูกค้ายกเลิกข้อความนี้");
  assert.equal(lineEvidenceSourceLabel("line_oa_csv"), "นำเข้าจาก LINE OA");
  assert.equal(lineTechnicalStateLabel("key_unavailable"), "ยังเปิดข้อมูลนี้ไม่ได้");
});

test("customer list hides CRM maintenance controls and raw operational language", () => {
  const page = read("apps/admin/app/(control-plane)/dashboard/inbox/page.tsx");
  assert.match(page, /ลูกค้า LINE/);
  assert.match(page, /ตอบใน LINE OA ตามเดิม/);
  assert.match(page, /lineStageLabel/);
  assert.match(page, /lineJourneyLabel/);
  assert.doesNotMatch(page, /name="priority"|name="caseState"|name="journey"|name="tag"|Assigned advisor|Add safe tag/);
  assert.doesNotMatch(page, /Advisor Inbox|Private-by-default|safe view|fail-closed|human_handoff/);
});

test("daily customer case keeps only follow-up and notes from CRM-style operations", () => {
  const operations = read("features/admin/line/AdvisorCaseOperations.tsx");
  assert.match(operations, /ติดตามลูกค้า/);
  assert.match(operations, /โน้ตของเรา/);
  assert.match(operations, /ตั้งวันติดตาม/);
  assert.doesNotMatch(operations, /Priority|Case state|Assigned advisor|Add safe tag|tagAdd|assignedAdvisor|caseState/);
});

test("customer detail moves raw values behind a collapsed system-details section", () => {
  const page = read("apps/admin/app/(control-plane)/dashboard/inbox/[leadId]/page.tsx");
  assert.match(page, /ประวัติการคุย/);
  assert.match(page, /หลักฐานการคุย/);
  assert.match(page, /<summary[^>]*>รายละเอียดระบบ<\/summary>/);
  assert.match(page, /lineMessageStatusLabel/);
  assert.match(page, /lineDocumentStatusLabel/);
  assert.doesNotMatch(page, /Conversation timeline|Operational timeline|Private notes|Case stage|OWNER-ONLY|Evidence archive/);
});

test("evidence page explains purpose in plain language and hides identifiers behind details", () => {
  const page = read("apps/admin/app/(control-plane)/dashboard/inbox/[leadId]/evidence/page.tsx");
  assert.match(page, /หลักฐานการคุย/);
  assert.match(page, /ถ้าลูกค้ายกเลิกข้อความใน LINE/);
  assert.match(page, /รายละเอียดตรวจสอบ/);
  assert.match(page, /รหัสตรวจสอบ SHA-256/);
  assert.doesNotMatch(page, /OWNER-ONLY EVIDENCE VIEW|Evidence archive|archive record|plaintext/);
});

test("LINE campaign UI exposes simple customer choices rather than raw segment fields", () => {
  const page = read("features/admin/line/LineCampaignManager.tsx");
  assert.match(page, /ส่งให้ลูกค้ากลุ่มไหน/);
  assert.match(page, /ลูกค้าที่คุยกันล่าสุดเมื่อไร/);
  assert.match(page, /ตรวจแล้ว ใช้ข้อความนี้/);
  assert.doesNotMatch(page, /stage segment|priority segment|tag segment|journey \(optional\)|Human Approve|Provider send/);
});

test("privacy UI describes consequences without implementation jargon", () => {
  const page = read("apps/admin/app/(control-plane)/operations/privacy/page.tsx");
  const manager = read("features/admin/line/PrivacyRequestManager.tsx");
  assert.match(page, /ข้อมูลและความเป็นส่วนตัว/);
  assert.match(manager, /เตรียมคำขอลบข้อมูล/);
  assert.match(manager, /ยังไม่มีข้อมูลถูกลบ/);
  assert.doesNotMatch(page + manager, /Delete dry-run|Retention review policy|manual review only|Save review policy|Create data-rights request/);
});

test("navigation uses customer-facing Thai labels for LINE work", () => {
  const layout = read("apps/admin/app/(control-plane)/layout.tsx");
  assert.match(layout, /ลูกค้า LINE/);
  assert.match(layout, /ข้อความแจ้งลูกค้า/);
  assert.doesNotMatch(layout, /Advisor Inbox|LINE Campaigns/);
});
