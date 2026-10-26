import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AFPT_CREDENTIAL, getAfptRenewalReminder } from "../../lib/admin/afpt-renewal";
import { loadFixtureModule } from "../../qa/phase1-fixture-loader.mjs";
import { adminAfptReminder20261026Source, adminAfptReminder20261026PredecessorDigest, adminAfptReminder20261026SourcePredecessor, adminAfptReminder20261026DomPredecessor, adminAfptReminderCopy20261026Source, adminAfptReminderCopy20261026PredecessorDigest, adminAfptReminderCopy20261026SourcePredecessor, adminAfptReminderCopy20261026DomPredecessor } from "../../qa/admin-afpt-reminder-20261026-proof.mjs";
import { adminCopyFixesSources, adminOps20261025PredecessorDigest, adminOps20261025Sources } from "../../qa/admin-ops-20261025-proof.mjs";

test("AFPT™ uses the owner's single credential configuration", () => {
  assert.deepEqual(AFPT_CREDENTIAL, { name: "AFPT™", issuer: "TFPA", number: "AFPT260195", issuedOn: "2026-09-22", expiresOn: "2028-12-31", reminderDays: 90 });
  assert.ok(Object.isFrozen(AFPT_CREDENTIAL));
});

test("Bangkok day boundaries cover 91/90/1/0/-1 and the entire expiry date", () => {
  const cases = [
    ["2028-10-01T16:59:59.999Z", null],
    ["2028-10-01T17:00:00.000Z", { daysRemaining: 90, expired: false }],
    ["2028-12-29T17:00:00.000Z", { daysRemaining: 1, expired: false }],
    ["2028-12-30T17:00:00.000Z", { daysRemaining: 0, expired: false }],
    ["2028-12-31T16:59:59.999Z", { daysRemaining: 0, expired: false }],
    ["2028-12-31T17:00:00.000Z", { daysRemaining: -1, expired: true }],
  ] as const;
  for (const [iso, expected] of cases) assert.deepEqual(getAfptRenewalReminder(new Date(iso)), expected, iso);
  assert.equal(getAfptRenewalReminder(new Date("2026-10-26T00:00:00Z")), null);
  assert.throws(() => getAfptRenewalReminder(new Date(Number.NaN)), RangeError);
});

test("host time zone cannot change the Bangkok reminder result", () => {
  const modulePath = new URL("../../lib/admin/afpt-renewal.ts", import.meta.url).href;
  const script = `import {getAfptRenewalReminder as reminder} from ${JSON.stringify(modulePath)}; console.log(JSON.stringify(reminder(new Date("2028-10-01T17:00:00Z"))));`;
  for (const TZ of ["UTC", "America/Los_Angeles", "Pacific/Kiritimati"]) {
    assert.equal(execFileSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script], { cwd: path.resolve(import.meta.dirname, "../.."), env: { PATH: process.env.PATH, NODE_ENV: "test", TZ }, encoding: "utf8" }).trim(), '{"daysRemaining":90,"expired":false}');
  }
});

async function dashboardFixture(iso: string, source?: string) {
  class ClockDate extends Date { constructor(value?: string | number) { super(value ?? iso); } static now() { return Date.parse(iso); } }
  const mocks = new Map<string, unknown>([
    ["@/lib/admin/require-permission", { requireAdminPermission: async () => ({ role: "editor" }) }],
    ["@/lib/admin/environment", { getAdminEnvironment: () => "local-uat", isStudioDataPlaneAllowed: () => false }],
    ["@/lib/admin/dashboard-summary", { readEditorialDashboardSummary: async () => ({ status: { environment: "local-uat", dataset: "uat", readReady: false, writeReady: false }, operations: { identityValid: false, configured: false }, pendingReviews: null }), editorialDashboardSteps: () => [] }],
    ["@/lib/admin/line/advisor-workflow", { listAdvisorInboxOperational: async () => [] }],
    ["@/lib/admin/line/business-intelligence", { readConversionAnalytics: async () => ({ state: "unavailable", summary: null }) }],
    ["@/lib/admin/operations/jobs-read-model", { readOperationsJobs: async () => ({ jobs: [] }) }],
    ["@/lib/admin/ops-telemetry/daily-job", { readDailyJobHealth: async () => null }],
  ]);
  const file = "apps/admin/app/(control-plane)/dashboard/page.tsx";
  const page = loadFixtureModule(file, { mocks, globals: { Date: ClockDate }, sources: source ? new Map([[file, source]]) : new Map() });
  return renderToStaticMarkup(await page.default({ searchParams: Promise.resolve({}) }));
}

test("the real Today renderer hides outside the window and distinguishes due, final day and expired", async () => {
  const current = readFileSync(path.join(process.cwd(), adminAfptReminder20261026Source.file), "utf8");
  const previous = adminAfptReminderCopy20261026SourcePredecessor(current);
  for (const [name, iso, state, label] of [
    ["hidden", "2028-10-01T16:59:59.999Z", null, null],
    ["due", "2028-10-01T17:00:00Z", "due", "AFPT™ ต้องต่ออายุภายใน 31 ธ.ค. 2571 (เหลือ 90 วัน)"],
    ["one-day", "2028-12-29T17:00:00Z", "due", "AFPT™ ต้องต่ออายุภายใน 31 ธ.ค. 2571 (เหลือ 1 วัน)"],
    ["last-day", "2028-12-31T16:59:59.999Z", "due", "AFPT™ ใช้ได้ถึงวันนี้ (31 ธ.ค. 2571)"],
    ["expired", "2028-12-31T17:00:00Z", "expired", "AFPT™ หมดอายุแล้ว ตั้งแต่ 1 ม.ค. 2572"],
  ] as const) {
    const html = await dashboardFixture(iso);
    if (!state) { assert.doesNotMatch(html, /data-afpt-reminder|afpt-renewal-heading/); continue; }
    assert.ok(html.includes(`data-afpt-reminder="${state}"`));
    assert.ok(html.includes(label!));
    assert.ok(html.includes("AFPT™"));
    assert.ok(html.includes("AFPT260195"));
    assert.ok(html.includes("31 ธ.ค. 2571"));
    assert.ok(html.includes("เตือนต่ออายุคุณวุฒิ"));
    assert.ok(html.includes("TFPA · เลขที่ AFPT260195"));
    assert.ok(html.includes("มีผล 22 ก.ย. 2569 · ใช้ได้ถึง 31 ธ.ค. 2571"));
    const card = html.match(/<section role="status"[\s\S]*?<\/section>/)![0];
    assert.doesNotMatch(card, /โปรดตรวจการต่ออายุ|ใกล้ครบกำหนดต่ออายุ|เหลืออีก/);
    assert.equal(adminAfptReminderCopy20261026DomPredecessor(html), await dashboardFixture(iso, previous), "the exact C4b DOM inverse restores the actual previous C4 renderer");
    const inverse = adminAfptReminder20261026DomPredecessor(html);
    assert.equal(inverse, html.replace(card, ""), "only the exact admitted card is removed");
    assert.equal(adminAfptReminder20261026DomPredecessor(card + card), card + card, "duplicate card is not admitted");
    assert.equal(adminAfptReminder20261026DomPredecessor(card.replace("TFPA", "unreviewed")), card.replace("TFPA", "unreviewed"));
    assert.equal(adminAfptReminder20261026DomPredecessor("<p>unrelated</p>" + card), "<p>unrelated</p>");
    if (process.env.AFPT_QA_HTML_DIR) {
      mkdirSync(process.env.AFPT_QA_HTML_DIR, { recursive: true });
      writeFileSync(path.join(process.env.AFPT_QA_HTML_DIR, `${name}.html`), html);
    }
  }
});

test("the exact C4 successor reconstructs the sealed predecessor and rejects every further edit", () => {
  const entry = adminAfptReminder20261026Source;
  const source = readFileSync(path.join(process.cwd(), entry.file), "utf8");
  const sha = (value: string) => createHash("sha256").update(value).digest("hex");
  const copy = adminAfptReminderCopy20261026Source;
  const previous = adminAfptReminderCopy20261026SourcePredecessor(source);
  assert.equal(sha(source), copy.after);
  assert.equal(copy.before, entry.after);
  assert.equal(sha(previous), entry.after, "the exact C4b source inverse restores the prior C4 bytes");
  assert.equal(adminAfptReminderCopy20261026PredecessorDigest(entry.file, copy.after), entry.after);
  assert.equal(entry.before, adminCopyFixesSources[entry.file as keyof typeof adminCopyFixesSources].after);
  assert.equal(sha(adminAfptReminder20261026SourcePredecessor(source)), entry.before, "only import/setup/card additions differ from the prior sealed page");
  assert.equal(adminAfptReminder20261026PredecessorDigest(entry.file, entry.after), entry.before);
  assert.equal(adminOps20261025PredecessorDigest(entry.file, entry.after), adminOps20261025Sources[entry.file as keyof typeof adminOps20261025Sources].before);
  const card = source.match(/      \{afptReminder \? \([\s\S]*?      \) : null\}\n\n/)![0];
  for (const altered of [source + "\n// unrelated", source.replace("@/lib/admin/afpt-renewal", "@/lib/admin/unreviewed"), source.replace("getAfptRenewalReminder();", "getAfptRenewalReminder(new Date(0));"), source.replace("เตือนต่ออายุคุณวุฒิ", "unreviewed"), source.replace(card, card + card)]) {
    const digest = sha(altered);
    assert.equal(adminAfptReminder20261026PredecessorDigest(entry.file, digest), digest);
    assert.equal(adminOps20261025PredecessorDigest(entry.file, digest), digest);
    assert.equal(adminAfptReminder20261026SourcePredecessor(altered), altered);
    assert.equal(adminAfptReminderCopy20261026SourcePredecessor(altered), altered);
    assert.equal(adminAfptReminderCopy20261026PredecessorDigest(entry.file, digest), digest);
  }
  const oldTampered = previous + "\n// unreviewed old C4";
  assert.equal(adminAfptReminder20261026PredecessorDigest(entry.file, sha(oldTampered)), sha(oldTampered));
  assert.equal(adminAfptReminder20261026SourcePredecessor(oldTampered), oldTampered);
});

test("C4b copy inverses reject altered wording, dates, day counts and unrelated sources", async () => {
  const html = await dashboardFixture("2028-10-01T17:00:00Z");
  const card = html.match(/<section role="status"[\s\S]*?<\/section>/)![0];
  for (const altered of [card.replace("เตือนต่ออายุคุณวุฒิ", "unreviewed"), card.replace("เหลือ 90 วัน", "เหลือ 91 วัน"), card.replace("31 ธ.ค. 2571", "30 ธ.ค. 2571"), card.replace("AFPT™ ต้องต่ออายุภายใน", "AFPT ต้องต่ออายุภายใน"), card + card]) {
    assert.equal(adminAfptReminderCopy20261026DomPredecessor(altered), altered);
    assert.equal(adminAfptReminder20261026DomPredecessor(altered), altered);
  }
  const copy = adminAfptReminderCopy20261026Source;
  assert.equal(adminAfptReminderCopy20261026PredecessorDigest("unrelated.tsx", copy.after), copy.after);
});
