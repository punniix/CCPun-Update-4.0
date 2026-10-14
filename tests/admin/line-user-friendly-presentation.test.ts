import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { buildActionCenterSignals, selectActionCenterSignals } from "../../lib/admin/agent-os/action-center";
import { buildAdminNavigation } from "../../features/admin/components/admin-navigation-model";
import {
  lineBotDecisionLabel,
  lineConversationStatusLabel,
  lineDocumentStatusLabel,
  lineEvidenceSourceLabel,
  lineJourneyLabel,
  lineMessageStatusLabel,
  lineMessageTypeLabel,
  lineStageLabel,
  lineTechnicalStateLabel,
  resolveInboxListRows,
} from "../../lib/admin/line/presentation";

const root = path.resolve(import.meta.dirname, "../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

test("Owner inbox rows keep one exact case link and preserve unavailable filter state", async () => {
  const { transpileModule, ModuleKind } = createRequire(import.meta.url)("typescript") as typeof import("typescript");
  const compiled = transpileModule(read("apps/admin/app/(control-plane)/dashboard/inbox/page.tsx"), { compilerOptions: { module: ModuleKind.CommonJS, jsx: 4 } }).outputText;
  let filterFailed = false;
  let unavailable = false;
  const row = { leadId: "synthetic-case", customerCode: "SYNTHETIC0001", stage: "Expert Review", journey: "motor_quote_review", conversationStatus: "open", lastActivityAt: "2026-10-14T02:00:00Z", unreadCount: 1, materialReceived: false, latestMessageType: "text", latestMessageStatus: "received", latestMessageNeedsHuman: true, followUpAt: "2026-10-14T17:15:00Z", caseState: "active" as const };
  let operationalRows: unknown = [row];
  const profileRequests: string[][] = [];
  class Clock extends Date { constructor(value?: string) { super(value ?? "2026-10-14T17:30:00Z"); } }
  const permissions: string[] = [];
  const loaded = { exports: {} as { default: (props: unknown) => Promise<unknown> } };
  runInNewContext(compiled, { module: loaded, exports: loaded.exports, Date: Clock, Intl, encodeURIComponent,
    require: (name: string) => {
      if (name === "next/link") return { default: "a" };
      if (name === "react/jsx-runtime") return { jsx: (type: unknown, props: unknown) => ({ type, props }), jsxs: (type: unknown, props: unknown) => ({ type, props }) };
      if (name.endsWith("/control-plane")) return { LINE_ADVISOR_INBOX_STAGES: ["New", "Expert Review", "Quote"], listAdvisorInboxSafe: async () => ({ unavailableReason: unavailable ? "synthetic-unavailable" : null, rows: [row], aggregate: { stageCounts: { New: 0, Qualified: 0, "Expert Review": 1, Solution: 0, Quote: 0, Implementation: 0, Won: 0, Lost: 0 } } }) };
      if (name.endsWith("/presentation")) return { lineConversationStatusLabel, lineJourneyLabel, lineMessageStatusLabel, lineMessageTypeLabel, lineStageLabel, resolveInboxListRows };
      if (name.endsWith("/require-permission")) return { requireAdminPermission: async (permission: string) => permissions.push(permission) };
      if (name.endsWith("/conversation-archive")) return { getLinePrivateProfiles: async (ids: string[]) => { profileRequests.push(Array.from(ids)); assert.deepEqual(Array.from(ids), ["synthetic-case"]); return new Map([["synthetic-case", { displayName: "Synthetic customer" }]]); } };
      if (name.endsWith("/advisor-workflow")) return { listAdvisorInboxOperational: async (filters: { stage?: string }) => { if (filters.stage) assert.equal(filters.stage, "Expert Review"); if (filterFailed) throw new Error("synthetic-filter-unavailable"); return operationalRows; } };
      if (name.endsWith("/action-center")) return { buildActionCenterSignals, selectActionCenterSignals };
      assert.fail(`Unexpected module ${name}`);
    } });
  const props = { searchParams: Promise.resolve({ stage: "Expert Review" }) };
  const rendered = JSON.stringify(await loaded.exports.default(props));
  assert.equal(rendered.match(/"href":"\/dashboard\/inbox\/synthetic-case\/"/g)?.length, 1);
  assert.match(rendered, /"name":"stage","defaultValue":"Expert Review"/);
  assert.match(rendered, /stage=Expert%20Review/);
  assert.match(rendered, /Synthetic customer/);
  assert.doesNotMatch(rendered, /caseState|Case state/);
  assert.match(rendered, /09:00/);
  filterFailed = true;
  const failed = JSON.stringify(await loaded.exports.default(props));
  assert.match(failed, /ยังอ่านรายการตามตัวกรองที่เลือกไม่ได้/);
  assert.doesNotMatch(failed, /Synthetic customer|"href":"\/dashboard\/inbox\/synthetic-case\/"/);
  assert.deepEqual(permissions, ["advisor:read", "advisor:read"]);
  filterFailed = false;
  const human = { ...row, stage: "New" };
  const completed = { ...human, leadId: "synthetic-completed", caseState: "completed" as const };
  const other = { ...row, leadId: "synthetic-other", stage: "Won", unreadCount: 0, latestMessageNeedsHuman: false, followUpAt: null };
  operationalRows = [human, human, completed, other];
  const selectedSignals = selectActionCenterSignals(buildActionCenterSignals([human, completed, other], "2026-10-14T17:30:00Z"), "human");
  assert.equal(selectedSignals.length, 2);
  assert.equal(new Set(selectedSignals.map(signal => signal.leadId)).size, 1);
  const attentionProps = { searchParams: Promise.resolve({ attention: "human" }) };
  const attention = JSON.stringify(await loaded.exports.default(attentionProps));
  assert.equal(attention.match(/"href":"\/dashboard\/inbox\/synthetic-case\/"/g)?.length, 1);
  assert.match(attention, /"name":"attention","value":"human"/);
  assert.match(attention, /attention=human&stage=Expert%20Review/);
  assert.doesNotMatch(attention, /synthetic-completed|synthetic-other/);
  assert.deepEqual(profileRequests.at(-1), ["synthetic-case"]);
  const followUpSignals = selectActionCenterSignals(buildActionCenterSignals([human], "2026-10-14T17:30:00Z"), "follow-up");
  assert.equal(followUpSignals[0].kind, "follow_up_today", "Bangkok date has already crossed into 15 October");
  const followUp = JSON.stringify(await loaded.exports.default({ searchParams: Promise.resolve({ attention: "follow-up" }) }));
  assert.match(followUp, /"href":"\/dashboard\/inbox\/synthetic-case\/"/);
  for (const bad of [null, [{ ...human, caseState: null }], [{ ...human, followUpAt: "invalid-date" }], [{ ...human, customerCode: undefined }]]) {
    operationalRows = bad;
    const before = profileRequests.length;
    const invalid = JSON.stringify(await loaded.exports.default(attentionProps));
    assert.match(invalid, /ยังอ่านรายการตามตัวกรองที่เลือกไม่ได้/);
    assert.equal(profileRequests.length, before);
  }
  for (const invalidAttention of ["unexpected", ["human", "follow-up"]]) {
    const invalid = JSON.stringify(await loaded.exports.default({ searchParams: Promise.resolve({ attention: invalidAttention }) }));
    assert.match(invalid, /ตัวกรองงานที่เลือกไม่ถูกต้อง/);
    assert.doesNotMatch(invalid, /Synthetic customer/);
  }
  unavailable = true;
  const outage = JSON.stringify(await loaded.exports.default(attentionProps));
  assert.equal(outage.match(/"children":"—"/g)?.length, 4, "unknown counts remain unavailable rather than zero");
});

test("a failed requested inbox filter never shows unfiltered rows or a false empty result", () => {
  const baseRows = [{ id: "synthetic-other-stage" }];
  assert.deepEqual(resolveInboxListRows({ baseRows, unavailable: false, filterRequested: true, filteredRows: null, filterFailed: true }), { state: "unavailable", rows: [] });
  assert.deepEqual(resolveInboxListRows({ baseRows, unavailable: false, filterRequested: true, filteredRows: null, filterFailed: false }), { state: "unavailable", rows: [] });
  assert.deepEqual(resolveInboxListRows({ baseRows, unavailable: true, filterRequested: false, filteredRows: null, filterFailed: false }), { state: "unavailable", rows: [] });
  assert.deepEqual(resolveInboxListRows({ baseRows, unavailable: false, filterRequested: true, filteredRows: [], filterFailed: false }), { state: "empty", rows: [] });
  assert.deepEqual(resolveInboxListRows({ baseRows, unavailable: false, filterRequested: false, filteredRows: null, filterFailed: false }), { state: "ready", rows: baseRows });
});

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
  assert.match(operations.match(/<input[\s\S]*?\/>/)?.[0] ?? "", /min-h-11/);
  const buttons = operations.match(/<button[\s\S]*?<\/button>/g) ?? [];
  assert.equal(buttons.length, 2);
  for (const button of buttons) {
    assert.match(button, /min-h-11/);
    assert.match(button, /focus-visible:outline-2/);
  }
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
  assert.match(layout, /buildAdminNavigation\(/);
  const leaves = buildAdminNavigation({ profile: "full", hasPermission: () => true, isPathAllowed: () => true }).flatMap(item => item.children);
  assert.equal(leaves.find(item => item.href === "/dashboard/inbox/")?.label, "ลูกค้า LINE");
  assert.equal(leaves.find(item => item.href === "/dashboard/campaigns/")?.label, "ข้อความแจ้งลูกค้า");
  assert.doesNotMatch(leaves.map(item => item.label).join(" "), /Advisor Inbox|LINE Campaigns/);
});
