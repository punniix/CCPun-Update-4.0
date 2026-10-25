import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { registerHooks } from "node:module";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path, { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  DAILY_JOB_EXPECTED_BY_MINUTES,
  DAILY_JOB_N8N_EXECUTION_TIMEOUT_SECONDS,
  DAILY_JOB_STUCK_AFTER_MINUTES,
  OPS_ALERT_CLAIM_TTL_SECONDS,
  applyRunLogRetentionInMemory,
  claimAlertInMemory,
  dailyJobScheduledForLane,
  deriveDailyJobHealth,
  insertRunLogRowInMemory,
  markAlertAcceptedInMemory,
  type AlertClaimRow,
  type DailyJobStatus,
  type OpsAlertKind,
  type OpsLane,
  type RunLogRow,
  type RunLogState,
} from "../../lib/admin/ops-telemetry/contracts";
import { adminCopyFixesPredecessorDigest, adminOps20261025PredecessorDigest, adminOps20261025SourceDigest, adminOps20261025Sources, adminOpsAuditFollowUpSources } from "../../qa/admin-ops-20261025-proof.mjs";

// Codex audit follow-ups (2026-10-25): F01 stuck/overdue, F02 scheduled check,
// F03 crash-safe alert claim, F06 late-row guard. Adapter/synthetic only: no
// real Supabase, relay or email is contacted.

const root = path.resolve(import.meta.dirname, "../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const directory = mkdtempSync(join(tmpdir(), "ccpun-admin-ops-followups-"));
const stub = join(directory, "empty.cjs");
writeFileSync(stub, "module.exports={};");
registerHooks({ resolve(specifier, context, next) { return specifier === "server-only" ? { url: pathToFileURL(stub).href, shortCircuit: true } : next(specifier, context); } });
after(() => rmSync(directory, { recursive: true, force: true }));

let notifier: typeof import("../../lib/admin/notifications/notifier");
let dailyJob: typeof import("../../lib/admin/ops-telemetry/daily-job");
let check: typeof import("../../lib/admin/ops-telemetry/daily-job-check");
let cli: typeof import("../../scripts/admin-daily-job-check");
before(async () => {
  notifier = await import("../../lib/admin/notifications/notifier");
  dailyJob = await import("../../lib/admin/ops-telemetry/daily-job");
  check = await import("../../lib/admin/ops-telemetry/daily-job-check");
  cli = await import("../../scripts/admin-daily-job-check");
});

// Bangkok = UTC+7. 2026-10-25 06:00 Bangkok = 2026-10-24T23:00Z.
const bkk = (date: string, time: string) => new Date(`${date}T${time}:00+07:00`).toISOString();
const job = (overrides: Partial<DailyJobStatus> = {}): DailyJobStatus => ({ id: 42, jobKey: "daily-0600", runDate: "2026-10-25", executionId: "n8n-9001", trigger: "schedule", status: "running", startedAt: bkk("2026-10-25", "06:00"), finishedAt: null, failedSteps: [], errorCategory: null, alertSentAt: null, ...overrides });

// --- F01 -----------------------------------------------------------------------

test("F01: stuck threshold is derived from the n8n executionTimeout and stays inside the 07:30 expected-by time", () => {
  const snapshot = JSON.parse(read("workers/local-ai/n8n/owner-export-google-sheet.direct.json"));
  assert.equal(snapshot.settings.executionTimeout, DAILY_JOB_N8N_EXECUTION_TIMEOUT_SECONDS, "constant mirrors the daily workflow snapshot");
  assert.equal(snapshot.settings.timezone, "Asia/Bangkok");
  assert.ok(DAILY_JOB_STUCK_AFTER_MINUTES * 60 > DAILY_JOB_N8N_EXECUTION_TIMEOUT_SECONDS, "n8n has already hard-stopped the run");
  assert.ok(6 * 60 + DAILY_JOB_STUCK_AFTER_MINUTES < DAILY_JOB_EXPECTED_BY_MINUTES, "a stuck 06:00 run surfaces before the missing check");
  assert.deepEqual([dailyJobScheduledForLane("production-admin"), dailyJobScheduledForLane("admin-uat"), dailyJobScheduledForLane(null)], [true, false, false]);
});

test("F01: before due with no run is unknown on both lanes", () => {
  const now = bkk("2026-10-25", "06:10");
  assert.equal(deriveDailyJobHealth(null, now).state, "unknown");
  assert.equal(deriveDailyJobHealth(null, now, { scheduled: false }).state, "unknown");
  assert.equal(deriveDailyJobHealth(null, bkk("2026-10-25", "07:29")).state, "unknown");
});

test("F01: after due with no run is missing on Production and unscheduled (not an outage) on UAT", () => {
  const now = bkk("2026-10-25", "07:30");
  assert.equal(deriveDailyJobHealth(null, now).state, "missing");
  assert.equal(deriveDailyJobHealth(null, now, { scheduled: true }).state, "missing");
  assert.equal(deriveDailyJobHealth(null, now, { scheduled: false }).state, "unscheduled");
});

test("F01: running is normal until 30 minutes after its start, then stuck (schedule and manual runs)", () => {
  assert.equal(deriveDailyJobHealth(job(), bkk("2026-10-25", "06:20")).state, "running");
  assert.equal(deriveDailyJobHealth(job(), bkk("2026-10-25", "06:29")).state, "running");
  assert.equal(deriveDailyJobHealth(job(), bkk("2026-10-25", "06:30")).state, "stuck");
  assert.equal(deriveDailyJobHealth(job(), bkk("2026-10-25", "21:00")).state, "stuck", "never 'running' forever");
  assert.equal(deriveDailyJobHealth(job(), bkk("2026-10-25", "06:45"), { scheduled: false }).state, "stuck", "a real UAT run that hangs is still stuck");
  const manual = job({ trigger: "manual", startedAt: bkk("2026-10-25", "14:00") });
  assert.equal(deriveDailyJobHealth(manual, bkk("2026-10-25", "14:10")).state, "running");
  assert.equal(deriveDailyJobHealth(manual, bkk("2026-10-25", "14:45")).state, "stuck");
});

test("F01: succeeded is ok, partial and failed are failed with their steps", () => {
  const now = bkk("2026-10-25", "08:00");
  assert.equal(deriveDailyJobHealth(job({ status: "succeeded", finishedAt: bkk("2026-10-25", "06:04") }), now).state, "ok");
  const partial = deriveDailyJobHealth(job({ status: "partial", failedSteps: ["meta"] }), now);
  assert.deepEqual([partial.state, partial.failedSteps], ["failed", ["meta"]]);
  const failed = deriveDailyJobHealth(job({ status: "failed", failedSteps: ["gsc", "ga4"] }), now);
  assert.deepEqual([failed.state, failed.failedSteps], ["failed", ["gsc", "ga4"]]);
});

test("F01: the day rolls over at Asia/Bangkok midnight, not UTC", () => {
  const yesterdayOk = job({ runDate: "2026-10-24", status: "succeeded", startedAt: bkk("2026-10-24", "06:00") });
  // 2026-10-25 00:30 Bangkok is still 2026-10-24 in UTC.
  assert.equal(deriveDailyJobHealth(yesterdayOk, "2026-10-24T17:30:00.000Z").state, "unknown", "yesterday's success is not today's");
  assert.equal(deriveDailyJobHealth(yesterdayOk, "2026-10-24T16:59:00.000Z").state, "ok", "23:59 Bangkok is still the same day");
  // Today's 06:00 row is 'today' although its UTC date is the 24th.
  assert.equal(deriveDailyJobHealth(job({ status: "succeeded" }), "2026-10-24T23:10:00.000Z").state, "ok");
});

test("F01: stale data from a previous day never counts as today's failure, run or stuck run", () => {
  const now = bkk("2026-10-25", "08:00");
  for (const status of ["failed", "partial", "running", "succeeded"] as const) {
    const stale = job({ runDate: "2026-10-24", status, startedAt: bkk("2026-10-24", "06:00"), failedSteps: status === "failed" ? ["gsc"] : [] });
    const health = deriveDailyJobHealth(stale, now);
    assert.equal(health.state, "missing", status);
    assert.deepEqual(health.failedSteps, [], status);
    assert.equal(health.runDate, "2026-10-24");
    assert.equal(deriveDailyJobHealth(stale, now, { scheduled: false }).state, "unscheduled", status);
    assert.equal(deriveDailyJobHealth(stale, bkk("2026-10-25", "06:50")).state, "unknown", status);
  }
});

test("F01: banner and ภาพรวม card show the stuck state; UAT unscheduled raises no banner", () => {
  const banner = read("features/admin/operations/DailyJobBanner.tsx");
  assert.match(banner, /const BANNER_STATES: ReadonlySet<DailyJobHealth\["state"\]> = new Set\(\["failed", "stuck", "missing"\]\);/);
  assert.match(banner, /ค้างเกินเวลา/);
  assert.doesNotMatch(banner, /unscheduled/);
  const dashboard = read("apps/admin/app/(control-plane)/dashboard/page.tsx");
  assert.match(dashboard, /dailyJob\.state === "failed" \|\| dailyJob\.state === "stuck" \|\| dailyJob\.state === "missing" \? "text-amber-200"/);
  assert.match(dashboard, /dailyJob\.state === "stuck" \? "ค้างเกินเวลา"/);
  assert.match(dashboard, /dailyJob\.state === "unscheduled" \? "ระบบทดสอบไม่มีรอบอัตโนมัติ"/);
});

// --- adapters --------------------------------------------------------------------

function memoryStore(options: { lane: OpsLane; job: DailyJobStatus | null; clock: { now: number }; claims?: Map<string, AlertClaimRow> }) {
  const claims = options.claims ?? new Map<string, AlertClaimRow>();
  const calls: string[] = [];
  const store = {
    provider: "supabase" as const,
    status: async () => ({ state: "ready" as const, provider: "supabase" as const, lane: options.lane }),
    readLatestDailyJob: async () => ({ state: "ready" as const, value: options.job }),
    // The in-memory claim is synchronous, so racing promises see it atomically,
    // like the single ON CONFLICT statement in ops_claim_alert().
    claimAlert: async (input: { reference: string; kind: OpsAlertKind; ttlSeconds?: number }) => { calls.push("claim"); await Promise.resolve(); return { state: "ready" as const, value: claimAlertInMemory(claims, input, options.clock.now) }; },
    markAlertRelayAccepted: async (reference: string) => { calls.push("accepted"); return { state: "ready" as const, value: markAlertAcceptedInMemory(claims, reference, options.clock.now) }; },
    applyRunLogRetention: async () => ({ state: "not-configured" as const, value: null }),
  };
  return { store, claims, calls };
}

// A relay that de-duplicates on the idempotency reference, behind the real
// signed webhook adapter. Each request follows the next scripted behaviour.
function dedupingRelay(script: Array<"accept" | "reject" | "timeout" | "accept-then-drop"> = []) {
  const delivered = new Set<string>();
  const emails: string[] = [];
  const requests: Array<{ reference: string; idempotencyKey: string }> = [];
  const fetchImpl = async (_url: string, init: RequestInit = {}) => {
    const body = JSON.parse(String(init.body));
    const headers = init.headers as Record<string, string>;
    requests.push({ reference: body.reference, idempotencyKey: headers["Idempotency-Key"]! });
    const behaviour = script.shift() ?? "accept";
    if (behaviour === "reject") return new Response(null, { status: 502 });
    if (behaviour === "timeout") throw Object.assign(new Error("timeout"), { name: "TimeoutError" });
    if (!delivered.has(body.reference)) { delivered.add(body.reference); emails.push(body.subject); }
    if (behaviour === "accept-then-drop") throw new Error("socket hang up");
    return new Response(null, { status: 200 });
  };
  const adapter = notifier.createWebhookEmailAdapter({ url: "https://relay.example.test/hook", secret: "s".repeat(40), to: "owner@example.test" }, fetchImpl);
  return { adapter, emails, requests };
}

const failedHealth = (now: string) => ({ ...deriveDailyJobHealth(job({ status: "failed", failedSteps: ["gsc"] }), now), storeState: "ready" as const });

// --- F03 -------------------------------------------------------------------------

test("F03: in-memory claim mirror matches ops_claim_alert()/ops_mark_alert_accepted() and the migration shape", () => {
  const rows = new Map<string, AlertClaimRow>();
  const ref = "production-admin:daily-0600:failed:42";
  const t0 = Date.parse("2026-10-25T01:00:00.000Z");
  assert.deepEqual(claimAlertInMemory(rows, { reference: ref, kind: "daily-job-failed" }, t0), { claimed: true, state: "pending", attempts: 1 });
  assert.deepEqual(claimAlertInMemory(rows, { reference: ref, kind: "daily-job-failed" }, t0 + 599_000), { claimed: false, state: "pending", attempts: 1 });
  assert.deepEqual(claimAlertInMemory(rows, { reference: ref, kind: "daily-job-stuck" }, t0 + 3_600_000), { claimed: false, state: "pending", attempts: 1 }, "kind mismatch");
  assert.deepEqual(claimAlertInMemory(rows, { reference: ref, kind: "daily-job-failed" }, t0 + 600_000), { claimed: true, state: "pending", attempts: 2 });
  assert.equal(markAlertAcceptedInMemory(rows, ref, t0 + 601_000), true);
  assert.equal(markAlertAcceptedInMemory(rows, ref, t0 + 602_000), false);
  assert.deepEqual(claimAlertInMemory(rows, { reference: ref, kind: "daily-job-failed" }, t0 + 86_400_000), { claimed: false, state: "accepted", attempts: 2 });
  assert.throws(() => claimAlertInMemory(rows, { reference: "Bad Ref", kind: "daily-job-failed" }, t0), /OPS_ALERT_REFERENCE_INVALID/);
  assert.throws(() => claimAlertInMemory(rows, { reference: "x", kind: "daily-job-failed", ttlSeconds: 5 }, t0), /OPS_ALERT_TTL_INVALID/);
  assert.equal(OPS_ALERT_CLAIM_TTL_SECONDS, 600);

  const sql = read("db/supabase/migrations/20261025000300_ops_alert_claims.sql");
  assert.match(sql, /state text NOT NULL DEFAULT 'pending' CHECK \(state IN \('pending', 'accepted', 'sent'\)\)/);
  assert.match(sql, /ON CONFLICT \(reference\) DO UPDATE SET[\s\S]*WHERE c\.state = 'pending' AND c\.kind = EXCLUDED\.kind AND c\.claim_expires_at <= EXCLUDED\.claimed_at/);
  assert.match(sql, /p_now timestamptz DEFAULT now\(\)/);
  assert.match(sql, /CREATE POLICY ops_deny_client_roles ON public\.ops_alert_claims AS RESTRICTIVE FOR ALL TO anon, authenticated USING \(false\) WITH CHECK \(false\);/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.ops_claim_alert\(text, text, integer, timestamptz\) FROM PUBLIC, anon, authenticated;/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.ops_mark_alert_accepted\(text, timestamptz\) FROM PUBLIC, anon, authenticated;/);
  assert.doesNotMatch(sql.replace(/--.*$/gm, ""), /ALTER TABLE public\.ops_daily_job_status|DROP COLUMN|customer|phone|email/i, "additive only, no customer data");
  for (const file of ["20261025000100_ops_telemetry_foundation.sql", "20261025000200_ops_run_log_retention.sql"]) assert.ok(existsSync(path.join(root, "db/supabase/migrations", file)));
});

test("F03: crash after claim before send, then the retry after expiry succeeds exactly once", async () => {
  const clock = { now: Date.parse(bkk("2026-10-25", "08:00")) };
  const { store, claims } = memoryStore({ lane: "production-admin", job: job({ status: "failed", failedSteps: ["gsc"] }), clock });
  const relay = dedupingRelay();
  const health = failedHealth(bkk("2026-10-25", "08:00"));
  const reference = "production-admin:daily-0600:failed:42";
  // The crashed process claimed and died before sending.
  assert.deepEqual((await store.claimAlert({ reference, kind: "daily-job-failed" })).value, { claimed: true, state: "pending", attempts: 1 });
  clock.now += 60_000;
  assert.deepEqual(await dailyJob.dispatchDailyJobAlert(health, { store, notifier: relay.adapter }), { outcome: "claim-held", reference });
  assert.equal(relay.requests.length, 0);
  clock.now += 9 * 60_000;
  assert.deepEqual(await dailyJob.dispatchDailyJobAlert(health, { store, notifier: relay.adapter }), { outcome: "relay-accepted", reference, recorded: true });
  assert.equal(relay.emails.length, 1);
  assert.deepEqual([claims.get(reference)!.state, claims.get(reference)!.attempts], ["accepted", 2]);
});

test("F03: relay timeout is 'unconfirmed', keeps the claim, and the same reference is retried after expiry", async () => {
  const clock = { now: Date.parse(bkk("2026-10-25", "08:00")) };
  const { store, claims } = memoryStore({ lane: "production-admin", job: null, clock });
  const relay = dedupingRelay(["timeout"]);
  const health = failedHealth(bkk("2026-10-25", "08:00"));
  const first = await dailyJob.dispatchDailyJobAlert(health, { store, notifier: relay.adapter });
  assert.equal(first.outcome, "relay-unconfirmed");
  assert.equal(claims.get("production-admin:daily-0600:failed:42")!.state, "pending", "not recorded as delivered");
  assert.equal((await dailyJob.dispatchDailyJobAlert(health, { store, notifier: relay.adapter })).outcome, "claim-held");
  clock.now += OPS_ALERT_CLAIM_TTL_SECONDS * 1000;
  assert.equal((await dailyJob.dispatchDailyJobAlert(health, { store, notifier: relay.adapter })).outcome, "relay-accepted");
  assert.equal(relay.emails.length, 1);
  assert.deepEqual(relay.requests.map((item) => item.idempotencyKey), ["production-admin:daily-0600:failed:42", "production-admin:daily-0600:failed:42"]);
});

test("F03: relay accepted but the client got no response: the retry is de-duplicated by the reference (one email)", async () => {
  const clock = { now: Date.parse(bkk("2026-10-25", "08:00")) };
  const { store, claims } = memoryStore({ lane: "production-admin", job: null, clock });
  const relay = dedupingRelay(["accept-then-drop", "accept"]);
  const health = failedHealth(bkk("2026-10-25", "08:00"));
  assert.equal((await dailyJob.dispatchDailyJobAlert(health, { store, notifier: relay.adapter })).outcome, "relay-unconfirmed");
  clock.now += OPS_ALERT_CLAIM_TTL_SECONDS * 1000;
  assert.equal((await dailyJob.dispatchDailyJobAlert(health, { store, notifier: relay.adapter })).outcome, "relay-accepted");
  assert.equal(relay.requests.length, 2, "the relay saw the same reference twice");
  assert.equal(new Set(relay.requests.map((item) => item.reference)).size, 1);
  assert.deepEqual(relay.emails, ["CCPun: รอบเก็บข้อมูล 06:00 วันที่ 25 ต.ค. 2569 ไม่สำเร็จ"], "no duplicate email");
  assert.equal(claims.get("production-admin:daily-0600:failed:42")!.state, "accepted");
});

test("F03: a relay rejection is 'relay-rejected', never 'delivered', and retries only after expiry", async () => {
  const clock = { now: Date.parse(bkk("2026-10-25", "08:00")) };
  const { store } = memoryStore({ lane: "production-admin", job: null, clock });
  const relay = dedupingRelay(["reject"]);
  const health = failedHealth(bkk("2026-10-25", "08:00"));
  assert.equal((await dailyJob.dispatchDailyJobAlert(health, { store, notifier: relay.adapter })).outcome, "relay-rejected");
  assert.equal((await dailyJob.dispatchDailyJobAlert(health, { store, notifier: relay.adapter })).outcome, "claim-held");
  clock.now += OPS_ALERT_CLAIM_TTL_SECONDS * 1000;
  assert.equal((await dailyJob.dispatchDailyJobAlert(health, { store, notifier: relay.adapter })).outcome, "relay-accepted");
  assert.equal(relay.requests.length, 2); assert.equal(relay.emails.length, 1);
});

test("F03: concurrent retries (render fallback and scheduled checks racing): only one wins", async () => {
  const clock = { now: Date.parse(bkk("2026-10-25", "08:00")) };
  const { store } = memoryStore({ lane: "production-admin", job: null, clock });
  const relay = dedupingRelay();
  const health = failedHealth(bkk("2026-10-25", "08:00"));
  const outcomes = await Promise.all(Array.from({ length: 25 }, () => dailyJob.dispatchDailyJobAlert(health, { store, notifier: relay.adapter })));
  assert.equal(outcomes.filter((item) => item.outcome === "relay-accepted").length, 1);
  assert.equal(outcomes.filter((item) => item.outcome === "claim-held").length, 24);
  assert.equal(relay.requests.length, 1);
  // The same race again after an expired claim: still one winner.
  const second = memoryStore({ lane: "production-admin", job: null, clock });
  await second.store.claimAlert({ reference: "production-admin:daily-0600:failed:42", kind: "daily-job-failed" });
  clock.now += OPS_ALERT_CLAIM_TTL_SECONDS * 1000;
  const relay2 = dedupingRelay();
  const raced = await Promise.all(Array.from({ length: 25 }, () => dailyJob.dispatchDailyJobAlert(health, { store: second.store, notifier: relay2.adapter })));
  assert.equal(raced.filter((item) => item.outcome === "relay-accepted").length, 1);
  assert.equal(relay2.requests.length, 1);
});

test("F03: a re-render storm never resends, while pending or after acceptance", async () => {
  const clock = { now: Date.parse(bkk("2026-10-25", "08:00")) };
  const { store } = memoryStore({ lane: "production-admin", job: null, clock });
  const relay = dedupingRelay();
  const health = failedHealth(bkk("2026-10-25", "08:00"));
  assert.equal((await dailyJob.dispatchDailyJobAlert(health, { store, notifier: relay.adapter })).outcome, "relay-accepted");
  for (let render = 0; render < 60; render += 1) {
    clock.now += 3 * 60_000; // three hours of page views
    assert.equal((await dailyJob.dispatchDailyJobAlert(health, { store, notifier: relay.adapter })).outcome, "already-accepted");
  }
  assert.equal(relay.requests.length, 1);
  assert.equal(relay.emails.length, 1);
});

// --- F02 -------------------------------------------------------------------------

const emailOn = () => dedupingRelay();

test("F02: without opening Admin, the scheduled check alerts a missing Production run once", async () => {
  const clock = { now: Date.parse(bkk("2026-10-25", "07:45")) };
  const { store } = memoryStore({ lane: "production-admin", job: job({ runDate: "2026-10-24", status: "succeeded", startedAt: bkk("2026-10-24", "06:00") }), clock });
  const relay = emailOn();
  const report = await check.runDailyJobCheck({ store, notifier: relay.adapter, now: clock.now });
  assert.deepEqual([report.lane, report.state, report.alert.outcome, report.exitCode], ["production-admin", "missing", "relay-accepted", 0]);
  assert.equal((report.alert as { reference: string }).reference, "production-admin:daily-0600:missing:2026-10-25");
  assert.equal(relay.emails[0], "CCPun: ยังไม่พบรอบเก็บข้อมูล 06:00 วันที่ 25 ต.ค. 2569");
  const again = await check.runDailyJobCheck({ store, notifier: relay.adapter, now: clock.now + 15 * 60_000 });
  assert.deepEqual([again.alert.outcome, again.exitCode], ["already-accepted", 0]);
  assert.equal(relay.requests.length, 1);
});

test("F02: a run that started and died is alerted as stuck; partial is alerted as failed; recovery raises nothing", async () => {
  const clock = { now: Date.parse(bkk("2026-10-25", "06:40")) };
  const stuck = memoryStore({ lane: "production-admin", job: job(), clock });
  const relay = emailOn();
  const report = await check.runDailyJobCheck({ store: stuck.store, notifier: relay.adapter, now: clock.now });
  assert.deepEqual([report.state, report.alert.outcome], ["stuck", "relay-accepted"]);
  assert.equal((report.alert as { reference: string }).reference, "production-admin:daily-0600:stuck:42");
  const partial = memoryStore({ lane: "production-admin", job: job({ id: 43, status: "partial", failedSteps: ["meta"] }), clock, claims: stuck.claims });
  const partialReport = await check.runDailyJobCheck({ store: partial.store, notifier: relay.adapter, now: clock.now });
  assert.deepEqual([partialReport.state, partialReport.alert.outcome], ["failed", "relay-accepted"]);
  assert.equal((partialReport.alert as { reference: string }).reference, "production-admin:daily-0600:failed:43", "a separate event, its own reference");
  const recovered = memoryStore({ lane: "production-admin", job: job({ id: 44, trigger: "manual", status: "succeeded" }), clock, claims: stuck.claims });
  const okReport = await check.runDailyJobCheck({ store: recovered.store, notifier: relay.adapter, now: clock.now });
  assert.deepEqual([okReport.state, okReport.alert.outcome, okReport.exitCode], ["ok", "not-needed", 0]);
  assert.deepEqual(recovered.calls, [], "recovery claims nothing");
  assert.equal(relay.emails.length, 2);
});

test("F02: page-render fallback and scheduled check share the claim (no duplicate), and a failed send is retried", async () => {
  const clock = { now: Date.parse(bkk("2026-10-25", "08:00")) };
  const { store } = memoryStore({ lane: "production-admin", job: job({ status: "failed", failedSteps: ["gsc"] }), clock });
  const relay = dedupingRelay(["reject"]);
  const health = await dailyJob.readDailyJobHealth(store, clock.now);
  assert.equal((await dailyJob.dispatchDailyJobAlert(health, { store, notifier: relay.adapter, now: clock.now })).outcome, "relay-rejected", "render fallback tried first");
  const during = await check.runDailyJobCheck({ store, notifier: relay.adapter, now: clock.now + 60_000 });
  assert.deepEqual([during.alert.outcome, during.exitCode], ["claim-held", 0]);
  clock.now += OPS_ALERT_CLAIM_TTL_SECONDS * 1000;
  const retried = await check.runDailyJobCheck({ store, notifier: relay.adapter, now: clock.now });
  assert.deepEqual([retried.alert.outcome, retried.exitCode], ["relay-accepted", 0]);
  assert.equal((await dailyJob.dispatchDailyJobAlert(health, { store, notifier: relay.adapter, now: clock.now })).outcome, "already-accepted", "a later render does not resend");
  assert.equal(relay.emails.length, 1);
});

test("F02: UAT is never alerted for a missing run; email disabled exits 2 so a cron or monitor can act; unreadable store exits 1", async () => {
  const clock = { now: Date.parse(bkk("2026-10-25", "09:00")) };
  const uat = memoryStore({ lane: "admin-uat", job: null, clock });
  const relay = emailOn();
  const uatReport = await check.runDailyJobCheck({ store: uat.store, notifier: relay.adapter, now: clock.now });
  assert.deepEqual([uatReport.state, uatReport.alert.outcome, uatReport.exitCode], ["unscheduled", "not-needed", 0]);
  assert.deepEqual(uat.calls, []);
  const prod = memoryStore({ lane: "production-admin", job: null, clock });
  const disabled = await check.runDailyJobCheck({ store: prod.store, notifier: notifier.disabledNotificationAdapter, now: clock.now });
  assert.deepEqual([disabled.state, disabled.alert.outcome, disabled.exitCode], ["missing", "email-disabled", 2]);
  assert.deepEqual(prod.calls, [], "disabled email never claims");
  const readOnly = await check.runDailyJobCheck({ store: prod.store, notifier: relay.adapter, now: clock.now, dispatch: false });
  assert.deepEqual([readOnly.alert.outcome, readOnly.exitCode], ["not-needed", 2]);
  assert.equal(relay.requests.length, 0);
  const notConfigured = await check.runDailyJobCheck({ store: (await import("../../lib/admin/ops-telemetry/store")).disabledOpsTelemetryStore, now: clock.now });
  assert.deepEqual([notConfigured.storeState, notConfigured.exitCode], ["not-configured", 1]);
});

test("F02: the CLI accepts only --no-dispatch for an explicit Admin lane and prints no secrets", async () => {
  const env = { CCPUN_APP_ENV: "production-admin", CCPUN_SUPABASE_SERVICE_ROLE_KEY: "service-role-secret", AUTH_URL: "https://admin.ccpun.com" };
  assert.throws(() => cli.parseDailyJobCheckArguments(["--send-now"], env), /ARGUMENT_DENIED/);
  assert.throws(() => cli.parseDailyJobCheckArguments([], { CCPUN_APP_ENV: "development" }), /LANE_DENIED/);
  assert.throws(() => cli.parseDailyJobCheckArguments([], { ...env, NEXT_RUNTIME: "nodejs" }), /LANE_DENIED/);
  assert.deepEqual(cli.parseDailyJobCheckArguments(["--no-dispatch"], env), { dispatch: false });
  let seen: { dispatch: boolean; adminOrigin: string | null } | null = null;
  const result = await cli.runDailyJobCheckCli([], env, async (options) => {
    seen = options;
    return { lane: "production-admin", storeState: "ready", state: "missing", runDate: null, alert: { outcome: "relay-accepted", reference: "production-admin:daily-0600:missing:2026-10-25", recorded: true }, exitCode: 0 };
  });
  assert.deepEqual(seen, { dispatch: true, adminOrigin: "https://admin.ccpun.com" });
  assert.equal(result.exitCode, 0);
  assert.deepEqual(JSON.parse(result.line), { lane: "production-admin", storeState: "ready", state: "missing", runDate: null, alert: "relay-accepted" });
  assert.doesNotMatch(result.line, /service-role-secret|https?:/);
  assert.match(read("scripts/admin-daily-job-check.ts"), /from "\.\.\/lib\/admin\/ops-telemetry\/daily-job-check"/, "logic lives in lib, the script is a thin wrapper");
});

// --- F06 -------------------------------------------------------------------------

const runRow = (runDate: string, executionId: string, step: string, status: RunLogRow["status"] = "succeeded"): RunLogRow => ({ workflowId: "XOQHPkio5WzZIz0l", workflowName: "CCPun Daily", executionId, step, status, startedAt: `${runDate}T00:00:00.000Z`, finishedAt: `${runDate}T00:00:01.000Z`, durationMs: 1000, runDate });

test("F06: a late step of an already counted execution can no longer double count an archived day", () => {
  const day = "2026-07-27";
  const writeAt = "2026-10-24T03:00:00.000Z"; // cutoff 2026-07-26, day still inside the window
  let state: RunLogState = { runs: [], daily: [] };
  state = insertRunLogRowInMemory(state, runRow(day, "E1", "gsc"), writeAt);
  state = insertRunLogRowInMemory(state, runRow(day, "E1", "ga4"), writeAt);
  assert.throws(() => insertRunLogRowInMemory(state, runRow(day, "E1", "gsc"), writeAt), /OPS_RUN_LOG_DUPLICATE_STEP/);
  const archived = applyRunLogRetentionInMemory(state, "2026-10-26T03:00:00.000Z").state; // cutoff 2026-07-28
  const before = archived.daily.find((item) => item.runDate === day)!;
  assert.deepEqual([before.totalSteps, before.executions, before.succeeded, before.detailRowsRetained], [2, 1, 2, false]);
  // The reproduced bug: E1/meta (late) and a replay of E1/gsc landing on the archived day.
  assert.throws(() => insertRunLogRowInMemory(archived, runRow(day, "E1", "meta", "failed"), "2026-07-28T03:00:00.000Z"), /OPS_RUN_LOG_DAY_ARCHIVED/);
  assert.throws(() => insertRunLogRowInMemory(archived, runRow(day, "E1", "gsc"), "2026-07-28T03:00:00.000Z"), /OPS_RUN_LOG_DAY_ARCHIVED/);
  assert.throws(() => insertRunLogRowInMemory(archived, runRow(day, "E1", "meta", "failed"), "2026-10-26T03:00:00.000Z"), /OPS_RUN_LOG_TOO_OLD/);
  const after = applyRunLogRetentionInMemory(archived, "2026-10-26T03:00:00.000Z").state.daily.find((item) => item.runDate === day)!;
  assert.deepEqual(after, before, "the archived summary is final");
  // Another workflow on that day has no archived summary and is still accepted.
  insertRunLogRowInMemory(archived, { ...runRow(day, "R1", "gsc"), workflowId: "pcDVd2P6ipg8b6p4" }, "2026-07-28T03:00:00.000Z");
});

test("F06: the late-row guard migration is additive, exact and documents the count contract", () => {
  const sql = read("db/supabase/migrations/20261025000400_ops_run_log_late_row_guard.sql");
  assert.match(sql, /v_run_date date := \(timezone\('Asia\/Bangkok', NEW\.started_at\)\)::date;/, "computes run_date itself (generated column is null in a BEFORE trigger)");
  assert.match(sql, /PERFORM pg_advisory_xact_lock_shared\(hashtext\('ccpun_ops:run_log_retention'\)\);/, "cannot slip between summarize and delete");
  assert.match(sql, /IF v_run_date < \(timezone\('Asia\/Bangkok', now\(\)\)\)::date - 90 THEN\s+RAISE EXCEPTION 'OPS_RUN_LOG_TOO_OLD'/);
  assert.match(sql, /NOT d\.detail_rows_retained\s+\) THEN\s+RAISE EXCEPTION 'OPS_RUN_LOG_DAY_ARCHIVED'/);
  assert.match(sql, /BEFORE INSERT OR UPDATE OF started_at, workflow_id ON public\.ops_workflow_runs/);
  assert.match(sql, /Count contract/);
  assert.doesNotMatch(sql, /cron\.schedule|SELECT public\.ops_apply_run_log_retention\(/, "retention is still never run or scheduled");
  assert.match(read("lib/admin/ops-telemetry/contracts.ts"), /Count contract \(with the insert guard below, migration 20261025000400\)/);
  const retention = read("db/supabase/migrations/20261025000200_ops_run_log_retention.sql");
  assert.match(retention, /executions = CASE WHEN d\.detail_rows_retained THEN EXCLUDED\.executions ELSE d\.executions \+ EXCLUDED\.executions END/, "the original migration is unchanged");
  const acceptance = read("db/supabase/acceptance/ops_audit_followups_acceptance.sql");
  assert.match(acceptance, /LOCAL OR DISPOSABLE DATABASE ONLY/);
  assert.match(acceptance.trim(), /ROLLBACK;$/);
});

// --- F09 -------------------------------------------------------------------------

test("F09: the Supabase guide separates contract from status, names both projects and keeps history", () => {
  const guide = read("docs/architecture/supabase-ops-telemetry-20261025.md");
  assert.match(guide, /^## Status$/m);
  assert.match(guide, /receipt เดียว/);
  assert.match(guide, /qgmfyyaakycfkcfdvzik/);
  assert.match(guide, /yzujeklhhwryijcnmkri/);
  assert.match(guide, /Codex เป็นเจ้าของการเชื่อม n8n/);
  assert.match(guide, /ประวัติ: สถานะเดิมตอนเขียนเอกสารนี้ครั้งแรก[^\n]*ยังไม่ได้สร้างโปรเจกต์ Supabase/, "history kept");
  assert.match(guide, /20261025000300_ops_alert_claims\.sql/);
  assert.match(guide, /20261025000400_ops_run_log_late_row_guard\.sql/);
  assert.match(guide, /n8n ล่มทั้งระบบไม่ได้/);
});

// --- frozen proof --------------------------------------------------------------------

test("audit follow-up admissions chain exactly to the reviewed 2026-10-25 successors", () => {
  for (const [file, { before: predecessor, after: successor }] of Object.entries(adminOpsAuditFollowUpSources)) {
    const current = adminOps20261025SourceDigest(read(file));
    // The 2026-10-25 copy-fix admission may replace this follow-up; it must name the follow-up as its predecessor.
    assert.equal(adminCopyFixesPredecessorDigest(file, current), successor, `${file} is exactly the reviewed follow-up`);
    assert.equal(adminOps20261025Sources[file as keyof typeof adminOps20261025Sources]?.after, predecessor, "chains to the reviewed successor");
    assert.equal(adminOps20261025PredecessorDigest(file, current), adminOps20261025Sources[file as keyof typeof adminOps20261025Sources]!.before);
    const unreviewed = adminOps20261025SourceDigest(read(file) + "\n// unreviewed");
    assert.equal(adminOps20261025PredecessorDigest(file, unreviewed), unreviewed);
    assert.equal(adminOps20261025PredecessorDigest(file, predecessor), adminOps20261025Sources[file as keyof typeof adminOps20261025Sources]!.before, "the previous successor still maps");
  }
});
