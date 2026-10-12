import { readPhase1Source } from "../../qa/read-phase1-source.mjs";
import { isAbsolute, relative } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";

const researchService = readCurrentSource(new URL("../../lib/admin/research.ts", import.meta.url), "utf8");
const seoAuditService = readCurrentSource(new URL("../../lib/admin/seo-audit.ts", import.meta.url), "utf8");
const seoProposalService = readCurrentSource(new URL("../../lib/admin/seo-proposals.ts", import.meta.url), "utf8");
const contentReadinessService = readCurrentSource(new URL("../../lib/admin/content-readiness.ts", import.meta.url), "utf8");
const researchRoute = readCurrentSource(new URL("../../apps/admin/app/api/admin/research/route.ts", import.meta.url), "utf8");
const seoAuditRoute = readCurrentSource(new URL("../../apps/admin/app/api/admin/seo/audit/[id]/route.ts", import.meta.url), "utf8");
const proposalRoute = readCurrentSource(new URL("../../apps/admin/app/api/admin/seo/audit/[id]/proposals/route.ts", import.meta.url), "utf8");
const sanityControl = readCurrentSource(new URL("../../lib/admin/sanity-control.ts", import.meta.url), "utf8");
const studioScore = readCurrentSource(new URL("../../cms/sanity/components/SeoScoreInput.tsx", import.meta.url), "utf8");
const seoDetailPage = readCurrentSource(new URL("../../apps/admin/app/(control-plane)/seo/audits/[id]/page.tsx", import.meta.url), "utf8");

test("research and audit records use Neon while Article audit snapshots keep exact Sanity revisions", () => {
  const operations = readCurrentSource(new URL("../../lib/admin/operations/database.ts", import.meta.url), "utf8");
  assert.match(researchService, /createAdminResearchSnapshot/);
  assert.match(operations, /WITH inserted AS[\s\S]*ccpun_admin\.research_snapshot[\s\S]*ccpun_admin\.audit_log/);
  assert.match(seoAuditService, /patch\(targetId\)\.ifRevisionId\(article\.revision\)/);
  assert.match(seoAuditService, /insertAdminAudit\(auditDocument\)/);
  assert.doesNotMatch(researchService, /_type:\s*"researchSnapshot"/);
  assert.doesNotMatch(researchRoute, /appendAuditLog/);
  assert.doesNotMatch(seoAuditRoute, /appendAuditLog/);
});

test("audits and generated proposals stay bound to one article revision", () => {
  assert.match(seoAuditService, /"revision": _rev/);
  assert.match(seoAuditService, /ifRevisionId\(article\.revision\)/);
  assert.match(proposalRoute, /audit\.sourceRevision !== contextData\.revision/);
  assert.match(proposalRoute, /expectedTargetRevision: audit\.sourceRevision/);
  assert.match(sanityControl, /target\._rev !== context\.expectedTargetRevision/);
  assert.match(seoAuditService, /!article\.id\.startsWith\("drafts\."\).*SEO_AUDIT_DRAFT_REQUIRED/);
});

test("Studio displays the canonical saved audit instead of recomputing a second score", () => {
  assert.match(studioScore, /props\.value\?\.auditSnapshot/);
  assert.match(studioScore, /ผลตรวจ SEO ล่าสุดที่บันทึก/);
  assert.doesNotMatch(studioScore, /const checks|rawScore|useFormValue/);
});

test("content readiness is read-only and remains separate from the SEO score", () => {
  assert.match(seoAuditService, /contentReadiness:/);
  assert.match(contentReadinessService, /legacyInternalLinks/);
  assert.match(contentReadinessService, /legacyFacebookCtas/);
  assert.match(contentReadinessService, /geoCompleted/);
  assert.match(seoDetailPage, /ส่วนนี้เป็นรายการตรวจสำหรับคนทำงาน ไม่รวมในคะแนน SEO/);
  assert.match(seoDetailPage, /เปิดแก้ใน Studio/);
});

test("automatic metadata stays blocked while fresh research may propose search intent only", () => {
  assert.match(seoProposalService, /type: "search-intent"/);
  assert.doesNotMatch(seoProposalService, /type: "seo-title"|type: "meta-description"|type: "primary-keyword"/);
  assert.match(proposalRoute, /focusKeyword: contextData\.focusKeyword/);
  assert.match(proposalRoute, /evidence: proposal\.evidence/);
  assert.match(seoDetailPage, /เรื่องเป้าหมายการค้นหาเฉพาะเมื่อมีคำค้นหลัก/);
});

function readCurrentSource(file: string | URL, encoding: "utf8"): string {
  void encoding;
  return readPhase1Source(file instanceof URL ? relative(process.cwd(), fileURLToPath(file)) : isAbsolute(file) ? relative(process.cwd(), file) : file);
}
