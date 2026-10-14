import { readPhase1Source } from "../../qa/read-phase1-source.mjs";
import { isAbsolute, relative } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { getApplyableFieldPath, isStaleSuggestionRevision } from "../../lib/admin/suggestion-lifecycle";
import test from "node:test";
import {
  adminDataLaneLabel,
  contentReviewStatusLabel,
  connectionLabel,
  datasetLabel,
  environmentLabel,
  friendlyApiError,
  friendlyApiErrorFromPayload,
  proposalStatusLabel,
  proposalTypeLabel,
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
  assert.equal(riskLabel("critical"), "วิกฤต — ตรวจใน Sanity Studio");
  assert.equal(connectionLabel(false, "write"), "ปิดการบันทึกไว้เพื่อความปลอดภัย");
  assert.equal(environmentLabel("uat"), "UAT");
  assert.equal(environmentLabel("admin-uat"), "Admin UAT");
  assert.equal(environmentLabel("local-uat"), "Local UAT");
  assert.equal(environmentLabel("local-production"), "Local Production");
  assert.equal(environmentLabel("production-admin"), "Production Admin");
  assert.equal(adminDataLaneLabel("production-admin"), "Production Draft");
  assert.equal(adminDataLaneLabel("local-uat"), "UAT");
  assert.equal(adminDataLaneLabel("local-production"), "Production Draft");
  assert.equal(connectionLabel(true, "read", "local-production"), "อ่านข้อมูล Production ได้");
  assert.equal(connectionLabel(true, "studio", "local-production"), "แก้ Draft ใน Sanity Studio (Production) ได้");
  assert.equal(datasetLabel("production"), "Production");
  assert.equal(datasetLabel("uat"), "UAT");
  assert.equal(connectionLabel(false, "studio", "local-production"), "ปิดการแก้ Draft ไว้เพื่อความปลอดภัย");
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
  const dashboard = readCurrentSource("apps/admin/app/(control-plane)/dashboard/page.tsx", "utf8");
  const login = readCurrentSource("apps/admin/app/(control-plane-auth)/login/page.tsx", "utf8");
  const audit = readCurrentSource("apps/admin/app/(control-plane)/operations/audit-log/page.tsx", "utf8");

  assert.match(dashboard, /พื้นที่นี้ใช้ข้อมูลจาก/);
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
    const source = readCurrentSource(path, "utf8");
    assert.doesNotMatch(source, /Sanity UAT|Neon UAT|ฐานข้อมูล UAT|SANITY UAT|LIVE UAT|HISTORICAL SOCIAL UAT/);
  }

  const socialOverview = readCurrentSource("features/admin/social/overview-page.tsx", "utf8");
  assert.match(socialOverview, /isSocialProviderExecutionGateEnabled\(\)/);
  assert.match(socialOverview, /providerWriteEnabled \? "ใช้ได้หลังผู้มีสิทธิ์อนุมัติ" : "ปิดอยู่"/);
  assert.match(socialOverview, /ส่งได้เฉพาะข้อความหรือลิงก์ที่อนุมัติแล้ว ส่วนสื่อยังทำด้วยตนเอง/);
});

test("content list separates document state from content review state", () => {
  const contentPage = readCurrentSource("apps/admin/app/(control-plane)/content/articles/page.tsx", "utf8");
  const sanityControl = readCurrentSource("lib/admin/sanity-control.ts", "utf8");
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

function readCurrentSource(file: string | URL, encoding: "utf8"): string {
  void encoding;
  return readPhase1Source(file instanceof URL ? relative(process.cwd(), fileURLToPath(file)) : isAbsolute(file) ? relative(process.cwd(), file) : file);
}


test("legacy drafting and uncertain proposal outcomes remain distinct from approval and completion", () => {
  assert.equal(contentReviewStatusLabel("drafting"), "กำลังจัดทำฉบับร่าง");
  assert.equal(proposalStatusLabel("reconciliation-required"), "ต้องตรวจผลการนำข้อเสนอไปใช้");
  assert.equal(proposalStatusLabel("edited"), "สถานะไม่ทราบ", "current editing returns needs-human-review, not an edited alias");
  assert.equal(contentReviewStatusLabel("completed"), "ไม่รู้จักขั้นตรวจนี้");
  assert.equal(contentReviewStatusLabel("needs-human-review"), "ไม่รู้จักขั้นตรวจนี้");
  assert.equal(proposalStatusLabel("drafting"), "สถานะไม่ทราบ");
  assert.equal(contentReviewStatusLabel("future-status"), "ไม่รู้จักขั้นตรวจนี้");
});

test("untrusted label values cannot inherit prototype entries or coerce themselves into an approval", () => {
  for (const value of ["constructor", "toString", "__proto__", "hasOwnProperty", "future-status", 1, 0, true, {}, { toString: () => "approved" }]) {
    const input = value as unknown as string;
    assert.equal(contentReviewStatusLabel(input), "ไม่รู้จักขั้นตรวจนี้");
    assert.equal(proposalStatusLabel(input), "สถานะไม่ทราบ");
    assert.equal(riskLabel(input), "ไม่ทราบ");
    assert.equal(proposalTypeLabel(input), "ข้อเสนอ SEO");
  }
  assert.equal(contentReviewStatusLabel(undefined), "ยังไม่มีข้อมูลการตรวจ");
  assert.equal(contentReviewStatusLabel(""), "ยังไม่มีข้อมูลการตรวจ");
  assert.equal(riskLabel(null), "ไม่ระบุ");
  assert.equal(riskLabel("low"), "ต่ำ");
  assert.equal(proposalTypeLabel("seo-title"), "ชื่อเรื่องสำหรับ SEO");
});

test("current proposal UI explains reconciliation without approval, edit, reject, apply or retry actions", async () => {
  const { transpileModule, ModuleKind } = createRequire(import.meta.url)("typescript") as typeof import("typescript");
  const source = readFileSync(new URL("../../features/admin/components/SeoReviewInboxPage.tsx", import.meta.url), "utf8");
  const compiled = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS, jsx: 4 } }).outputText;
  type Element = { type: unknown; props: { children?: unknown; href?: string; disabled?: boolean } };
  const elements = (node: unknown): Element[] => {
    if (Array.isArray(node)) return node.flatMap(elements);
    if (!node || typeof node !== "object" || !("props" in node)) return [];
    const element = node as Element;
    return [element, ...elements(element.props.children)];
  };
  const text = (node: unknown): string => {
    if (Array.isArray(node)) return node.map(text).join(" ");
    if (node && typeof node === "object" && "props" in node) return text((node as Element).props.children);
    return typeof node === "string" || typeof node === "number" ? String(node) : "";
  };
  for (const allowed of [true, false]) {
    for (const status of ["reconciliation-required", "needs-human-review", "approved", "edited", "future-status"]) {
      const permissions: string[] = [];
      let reads = 0;
      const loaded = { exports: {} as { AdminReviewsPage: (copy: { dataset: () => string; readFailure: string }) => Promise<unknown> } };
      const row = { id: "synthetic-suggestion", articleId: "synthetic-article", articleTitle: "Synthetic article", status, type: "seo-title", riskLevel: "low", targetRevision: "revision-one", targetCurrentRevision: "revision-one", approvedTargetRevision: "revision-one", approvedTargetId: "synthetic-article", approvedType: "seo-title", approvedRiskLevel: "low", approvedAfter: "Synthetic approved copy", before: "Synthetic before", after: "Synthetic after", reason: "Synthetic reason" };
      runInNewContext(compiled, { module: loaded, exports: loaded.exports, encodeURIComponent, require: (name: string) => {
        if (name === "react/jsx-runtime") return { jsx: (type: unknown, props: unknown) => ({ type, props }), jsxs: (type: unknown, props: unknown) => ({ type, props }) };
        if (name === "next/link") return { default: "a" };
        if (name.endsWith("/ApproveSuggestionButton")) return { default: "approve-control" };
        if (name.endsWith("/ApplySuggestionButton")) return { default: "apply-control" };
        if (name.endsWith("/ReviewDecisionControls")) return { default: "review-controls" };
        if (name.endsWith("/presentation")) return { connectionLabel, proposalStatusLabel, proposalTypeLabel, riskLabel };
        if (name.endsWith("/require-permission")) return { requireAdminPermission: async (permission: string) => { permissions.push(permission); return { role: "owner" }; } };
        if (name.endsWith("/rbac")) return { hasAdminPermission: () => allowed };
        if (name.endsWith("/sanity-control")) return { listSeoSuggestions: async () => { reads++; return { rows: [row], status: { dataset: "uat", environment: "admin-uat", writeReady: true }, error: null }; } };
        if (name.endsWith("/suggestion-lifecycle")) return { getApplyableFieldPath, isStaleSuggestionRevision };
        if (name.endsWith("/environment")) return { isStudioDataPlaneAllowed: () => true };
        assert.fail("Unexpected current-source dependency " + name);
      } });
      const tree = await loaded.exports.AdminReviewsPage({ dataset: () => "UAT", readFailure: "Synthetic unavailable" });
      const controls = elements(tree).filter(element => ["approve-control", "apply-control", "review-controls", "button", "form"].includes(String(element.type)));
      assert.deepEqual(permissions, ["reviews:read"]);
      assert.equal(reads, 1);
      if (status === "reconciliation-required") {
        assert.match(text(tree), /ต้องตรวจผลการนำข้อเสนอไปใช้/);
        assert.match(text(tree), /ผลการนำข้อเสนอไปใช้ยังไม่ยืนยัน ต้องตรวจฉบับร่างและประวัติก่อนดำเนินการต่อ/);
        assert.equal(controls.length, 0, "uncertainty is not an actionable approval or retry state even for the owner");
        assert.doesNotMatch(text(tree), /สถานะนี้ไม่มีรายการที่ต้องทำต่อ/);
      } else if (status === "needs-human-review") {
        assert.deepEqual(controls.map(control => String(control.type)), ["approve-control", "review-controls"]);
        assert.equal(controls[0].props.disabled, !allowed);
      } else if (status === "approved") {
        assert.deepEqual(controls.map(control => String(control.type)), ["apply-control"]);
        assert.equal(controls[0].props.disabled, !allowed);
      } else {
        assert.equal(controls.length, 0);
        assert.match(text(tree), /สถานะไม่ทราบ/);
      }
      assert.equal(elements(tree).some(element => element.props.href?.startsWith("/api/") || element.props.href === "/operations/jobs/"), false, "the warning adds no mutation or jobs shortcut");
    }
  }
});
