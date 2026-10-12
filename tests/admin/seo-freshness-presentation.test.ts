import { readPhase1Source } from "../../qa/read-phase1-source.mjs";
import { relative } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";

test("admin distinguishes saved current, saved stale, and unsaved live SEO results", () => {
  const contentPage = readCurrentSource("app/(control-plane)/content/articles/page.tsx", "utf8");
  const detailPage = readCurrentSource("app/(control-plane)/seo/audits/[id]/page.tsx", "utf8");

  assert.match(contentPage, /article\.seoAuditVersion === SEO_AUDIT_VERSION/);
  assert.match(contentPage, /ผลที่บันทึกแล้ว · ใช้กฎตรวจเวอร์ชันปัจจุบัน/);
  assert.match(contentPage, /ผลเก่าที่บันทึกไว้ · ต้องตรวจใหม่/);
  assert.match(contentPage, /คะแนนสด · คำนวณจากฉบับปัจจุบัน · ยังไม่บันทึก/);
  assert.match(detailPage, /คะแนนคำนวณสดจากฉบับปัจจุบัน/);
  assert.match(detailPage, /ผลนี้ยังไม่ได้บันทึกเป็นผลตรวจ SEO/);
  assert.match(detailPage, /runSeoAudit\(id, false\)/);
  assert.doesNotMatch(detailPage, /runSeoAudit\(id, true\)/);
});

function readCurrentSource(file: string | URL, _encoding: "utf8"): string {
  return readPhase1Source(file instanceof URL ? relative(process.cwd(), fileURLToPath(file)) : file);
}
