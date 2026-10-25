import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { thaiDisplayDate } from "../../lib/admin/presentation";
import { lineBotDecisionLabel, lineNeedLabel } from "../../lib/admin/line/presentation";
import { adminCopyFixesSources, adminOps20261025DomPredecessor, adminOps20261025PredecessorDigest, adminOps20261025Sources, adminOpsAuditFollowUpSources } from "../../qa/admin-ops-20261025-proof.mjs";

// Admin wording fixes (2026-10-25, owner FigCraft review on PR #492): owner name
// "ปั้น", Thai display dates and Thai ภาพรวมธุรกิจ labels. Display text only;
// data keys, request values and alert idempotency references stay unchanged.
const ROOT = new URL("../../", import.meta.url);
const read = (file: string) => readFileSync(new URL(file, ROOT), "utf8");
const sha = (value: string) => createHash("sha256").update(value).digest("hex");

test("Thai display date keeps the calendar day and handles timestamps, empty and invalid values", () => {
  assert.equal(thaiDisplayDate("2026-10-25"), "25 ต.ค. 2569");
  assert.equal(thaiDisplayDate("2026-01-01"), "1 ม.ค. 2569");
  // A timestamp is shown as its Asia/Bangkok day (17:30Z is already the next day in Bangkok).
  assert.equal(thaiDisplayDate("2026-10-25T17:30:00Z"), "26 ต.ค. 2569");
  assert.equal(thaiDisplayDate(null), "—");
  assert.equal(thaiDisplayDate(""), "—");
  assert.equal(thaiDisplayDate("not-a-date"), "not-a-date");
});

test("owner name is ปั้น in Admin labels; unrelated words are untouched", () => {
  assert.equal(lineNeedLabel("waiting_for_advisor"), "รอปั้นตอบ");
  assert.equal(lineBotDecisionLabel("human_handoff"), "รอปั้นตอบ");
  assert.equal(lineBotDecisionLabel("something-new"), "รอปั้นดูรายละเอียด");
  for (const file of ["lib/admin/line/presentation.ts", "apps/admin/app/(control-plane)/dashboard/inbox/page.tsx"]) {
    assert.doesNotMatch(read(file), /รอปัน/, file);
  }
  assert.match(read("apps/admin/app/(control-plane)/dashboard/inbox/page.tsx"), /รอปั้นดูต่อ/);
});

test("ภาพรวมธุรกิจ uses the same Thai labels as the conversions page and keeps its data keys", () => {
  const dashboard = read("apps/admin/app/(control-plane)/dashboard/page.tsx");
  const conversions = read("apps/admin/app/(control-plane)/analytics/conversions/page.tsx");
  for (const [label, key, summaryKey] of [["ผู้สนใจ", "leadCount", "lead_count"], ["การคุยที่พร้อมให้คำแนะนำ", "qualifiedCount", "qualified_count"], ["สำเร็จ", "wonCount", "won_count"]]) {
    assert.ok(dashboard.includes(`["${label}", businessOverview?.${key}]`), label);
    assert.ok(dashboard.includes(`analytics.summary?.${summaryKey}`), summaryKey);
    assert.ok(conversions.includes(`["${label}", s.${summaryKey}]`), `conversions page uses ${label}`);
  }
  assert.doesNotMatch(dashboard, /"(?:Lead|Qualified Conversation|Won)"/);
});

test("06:00 banner and owner e-mail show Thai dates while the run date and alert reference stay ISO", () => {
  const banner = read("features/admin/operations/DailyJobBanner.tsx");
  assert.match(banner, /` วันที่ \$\{thaiDisplayDate\(health\.runDate\)\}`/);
  assert.match(banner, /data-daily-job-run-date=\{health\.runDate \?\? undefined\}/);
  const job = read("lib/admin/ops-telemetry/daily-job.ts");
  assert.doesNotMatch(job, /วันที่ \$\{(?:today|job\.runDate)\}/);
  assert.match(job, /reference: `\$\{lane\}:\$\{DAILY_JOB_KEY\}:missing:\$\{today\}`/);
  for (const file of ["features/admin/seo/opportunities/GscManualSync.tsx", "features/admin/seo/opportunities/Ga4ManualSync.tsx"]) {
    assert.match(read(file), /return `\$\{thaiDisplayDate\(range\.startDate\)\} – \$\{thaiDisplayDate\(range\.endDate\)\}`;/, file);
  }
});

test("copy-fix admissions are exact, chain to the reviewed successors and reject any further edit", () => {
  const entries = Object.entries(adminCopyFixesSources as Record<string, { before: string; after: string }>);
  assert.deepEqual(entries.map(([file]) => file), [
    "apps/admin/app/(control-plane)/dashboard/inbox/page.tsx",
    "apps/admin/app/(control-plane)/dashboard/page.tsx",
    "features/admin/seo/opportunities/Ga4ManualSync.tsx",
    "features/admin/seo/opportunities/GscManualSync.tsx",
  ]);
  const followUps = adminOpsAuditFollowUpSources as Record<string, { before: string; after: string }>;
  const reviewed = adminOps20261025Sources as Record<string, { before: string; after: string }>;
  for (const [file, { before, after }] of entries) {
    const source = read(file);
    assert.equal(sha(source), after, `${file}: byte-identical to the reviewed copy fix`);
    assert.equal(before, followUps[file]?.after ?? reviewed[file]!.after, `${file}: names the successor it replaced`);
    assert.equal(adminOps20261025PredecessorDigest(file, after), reviewed[file]!.before, `${file}: chains to its original predecessor`);
    const tampered = sha(source + "\n// tamper");
    assert.equal(adminOps20261025PredecessorDigest(file, tampered), tampered, `${file}: unreviewed bytes are not admitted`);
  }
});

test("DOM inverse rebuilds only the three relabelled ภาพรวมธุรกิจ cards", () => {
  for (const [thai, english] of [["ผู้สนใจ", "Lead"], ["การคุยที่พร้อมให้คำแนะนำ", "Qualified Conversation"], ["สำเร็จ", "Won"]]) {
    assert.equal(adminOps20261025DomPredecessor(`<p class="text-sm text-white/55">${thai}</p>`), `<p class="text-sm text-white/55">${english}</p>`);
  }
  const unrelated = '<p class="text-xs text-white/45">สำเร็จ</p><p class="text-sm text-white/55">รายการรายได้</p>';
  assert.equal(adminOps20261025DomPredecessor(unrelated), unrelated);
});
