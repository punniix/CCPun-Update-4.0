import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { registerHooks, createRequire } from "node:module";
import { createHmac } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path, { join } from "node:path";
import { pathToFileURL } from "node:url";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import ts from "typescript";
import {
  OPS_NOT_CONNECTED_LABEL,
  applyRunLogRetentionInMemory,
  bangkokDate,
  deriveDailyJobHealth,
  deriveDailyJobHealthFromAnalytics,
  claimAlertInMemory,
  markAlertAcceptedInMemory,
  retentionCutoff,
  type AlertClaimRow,
  type DailyJobStatus,
  type OpsAlertKind,
  type RunLogRow,
  type RunLogState,
} from "../../lib/admin/ops-telemetry/contracts";
import { ADMIN_NAVIGATION_REDIRECTS, contextualNavigationItems, splitTechnicalNavigationItems } from "../../features/admin/components/admin-navigation-model";
import { LOCAL_AI_FIRST_JOBS, buildArticleSuggestionInput } from "../../lib/local-ai/first-jobs";
import { LOCAL_AI_TASK_TYPES, localAiTaskInputSchemas } from "../../lib/local-ai/contracts";
import { hasArticleContentChanges } from "../../cms/sanity/policy/article-publication";
import { adminCopyFixesPredecessorDigest, adminOps20261025PredecessorDigest, adminOps20261025SourceDigest, adminOps20261025Sources, adminOpsAuditFollowUpSources } from "../../qa/admin-ops-20261025-proof.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const directory = mkdtempSync(join(tmpdir(), "ccpun-admin-ops-"));
const stub = join(directory, "empty.cjs");
writeFileSync(stub, "module.exports={};");
registerHooks({ resolve(specifier, context, next) { return specifier === "server-only" ? { url: pathToFileURL(stub).href, shortCircuit: true } : next(specifier, context); } });
after(() => rmSync(directory, { recursive: true, force: true }));

let store: typeof import("../../lib/admin/ops-telemetry/store");
let notifier: typeof import("../../lib/admin/notifications/notifier");
let dailyJob: typeof import("../../lib/admin/ops-telemetry/daily-job");
before(async () => {
  store = await import("../../lib/admin/ops-telemetry/store");
  notifier = await import("../../lib/admin/notifications/notifier");
  dailyJob = await import("../../lib/admin/ops-telemetry/daily-job");
});

// --- A5: run-log retention -------------------------------------------------

function run(runDate: string, step: string, status: RunLogRow["status"], executionId = `exec-${runDate}`, durationMs = 100): RunLogRow {
  return { workflowId: "XOQHPkio5WzZIz0l", workflowName: "CCPun — Owner Export to Google Sheets", executionId, step, status, startedAt: `${runDate}T00:00:00.000Z`, finishedAt: `${runDate}T00:00:01.000Z`, durationMs, runDate };
}

test("run-log retention keeps 90 days of detail rows and daily summaries forever, idempotently", () => {
  const now = "2026-10-25T03:00:00.000Z"; // 10:00 Bangkok
  assert.equal(retentionCutoff(now), "2026-07-27");
  const state: RunLogState = { runs: [run("2026-07-01", "gsc", "succeeded"), run("2026-07-01", "ga4", "failed"), run("2026-07-26", "gsc", "succeeded"), run("2026-07-27", "gsc", "succeeded"), run("2026-10-25", "gsc", "warning")], daily: [] };
  const first = applyRunLogRetentionInMemory(state, now);
  assert.deepEqual(first.result, { cutoff: "2026-07-27", keepDays: 90, refreshedSummaries: 2, archivedSummaries: 2, deletedRows: 3 });
  assert.deepEqual(first.state.runs.map((row) => row.runDate), ["2026-07-27", "2026-10-25"]);
  const july = first.state.daily.find((item) => item.runDate === "2026-07-01")!;
  assert.equal(july.totalSteps, 2); assert.equal(july.succeeded, 1); assert.equal(july.failed, 1); assert.equal(july.detailRowsRetained, false);
  assert.equal(first.state.daily.find((item) => item.runDate === "2026-07-27")!.detailRowsRetained, true);
  const second = applyRunLogRetentionInMemory(first.state, now);
  assert.deepEqual(second.state, first.state, "second run with the same now changes nothing");
  assert.deepEqual(second.result, { cutoff: "2026-07-27", keepDays: 90, refreshedSummaries: 0, archivedSummaries: 0, deletedRows: 0 });
});

test("a summary crossing the cutoff is replaced once; late rows for a purged day are merged, never double counted", () => {
  const day = "2026-07-27";
  const kept = applyRunLogRetentionInMemory({ runs: [run(day, "gsc", "succeeded"), run(day, "ga4", "succeeded")], daily: [] }, "2026-10-25T03:00:00.000Z");
  const crossed = applyRunLogRetentionInMemory(kept.state, "2026-10-26T03:00:00.000Z");
  const summary = crossed.state.daily.find((item) => item.runDate === day)!;
  assert.equal(summary.totalSteps, 2, "full recompute replaced the retained summary instead of adding to it");
  assert.equal(summary.detailRowsRetained, false);
  assert.equal(crossed.state.runs.length, 0);
  const late = applyRunLogRetentionInMemory({ runs: [run(day, "meta", "failed", "exec-late")], daily: crossed.state.daily }, "2026-10-26T03:00:00.000Z");
  const merged = late.state.daily.find((item) => item.runDate === day)!;
  assert.equal(merged.totalSteps, 3); assert.equal(merged.failed, 1); assert.equal(merged.executions, 2);
  assert.deepEqual(applyRunLogRetentionInMemory(late.state, "2026-10-26T03:00:00.000Z").state, late.state);
  assert.throws(() => applyRunLogRetentionInMemory(late.state, "2026-10-26T03:00:00.000Z", 30), /OPS_RETENTION_TOO_SHORT/);
});

test("Supabase migrations enable RLS on every table, deny client roles and only define (never run) retention", () => {
  const foundation = read("db/supabase/migrations/20261025000100_ops_telemetry_foundation.sql");
  const retention = read("db/supabase/migrations/20261025000200_ops_run_log_retention.sql");
  const tables = ["ops_lane_identity", "ops_workflow_runs", "ops_workflow_run_daily", "ops_raw_daily_pulls", "ops_daily_job_status"];
  for (const table of tables) assert.match(foundation, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table} \\(`));
  assert.match(foundation, new RegExp(`ARRAY\\['${tables.join("', '")}'\\]`), "the RLS loop covers every table");
  assert.match(foundation, /ALTER TABLE public\.%I ENABLE ROW LEVEL SECURITY/);
  assert.match(foundation, /AS RESTRICTIVE FOR ALL TO anon, authenticated USING \(false\) WITH CHECK \(false\)/);
  assert.match(foundation, /REVOKE ALL ON TABLE public\.%I FROM PUBLIC, anon, authenticated/);
  assert.match(foundation, /GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public\.%I TO service_role/);
  assert.match(foundation, /REVOKE ALL ON SEQUENCE %s FROM PUBLIC, anon, authenticated/);
  const statements = foundation.replace(/--.*$/gm, "");
  assert.doesNotMatch(statements, /line_|customer|phone|email/i, "no customer data columns");
  assert.match(retention, /IF p_keep_days IS NULL OR p_keep_days < 90 THEN/);
  assert.match(retention, /REVOKE ALL ON FUNCTION public\.ops_apply_run_log_retention\(timestamptz, integer\) FROM PUBLIC, anon, authenticated;/);
  assert.match(retention, /GRANT EXECUTE ON FUNCTION public\.ops_apply_run_log_retention\(timestamptz, integer\) TO service_role;/);
  assert.match(retention, /DELETE FROM public\.ops_workflow_runs WHERE run_date < v_cutoff;/);
  assert.doesNotMatch(retention, /DELETE FROM public\.ops_workflow_run_daily/, "summaries are kept forever");
  assert.doesNotMatch(retention, /cron\.schedule|SELECT public\.ops_apply_run_log_retention\(/, "the migration does not run or schedule cleanup");
  for (const lane of ["admin-uat", "production-admin"]) assert.match(read(`db/supabase/lane/${lane}.sql`), new RegExp(`VALUES \\(true, '${lane}'\\)`));
});

// --- Supabase store ----------------------------------------------------------

function fakeSupabase(responses: Array<{ status?: number; body: unknown }>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetch = async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    const next = responses.shift() ?? { body: [] };
    return new Response(JSON.stringify(next.body), { status: next.status ?? 200 });
  };
  return { calls, fetch };
}
const jobRow = { id: 7, job_key: "daily-0600", run_date: "2026-10-25", execution_id: "n8n-1", trigger: "schedule", status: "failed", started_at: "2026-10-24T23:00:00.000Z", finished_at: "2026-10-24T23:02:00.000Z", failed_steps: ["gsc"], error_category: "source-unavailable", alert_sent_at: null };

test("without CCPUN_SUPABASE_* env the store degrades to 'ยังไม่ได้เชื่อม Supabase' and never throws", async () => {
  for (const env of [{}, { CCPUN_APP_ENV: "production-admin" }, { CCPUN_APP_ENV: "production-admin", CCPUN_SUPABASE_URL: "https://x.supabase.co" }, { CCPUN_APP_ENV: "development", CCPUN_SUPABASE_URL: "https://x.supabase.co", CCPUN_SUPABASE_SERVICE_ROLE_KEY: "k" }, { CCPUN_APP_ENV: "admin-uat", CCPUN_SUPABASE_URL: "http://x.supabase.co", CCPUN_SUPABASE_SERVICE_ROLE_KEY: "k" }]) {
    const disabled = store.getOpsTelemetryStore(env);
    assert.equal(disabled.provider, "disabled", JSON.stringify(env));
    assert.deepEqual(await disabled.readLatestDailyJob(), { state: "not-configured", value: null });
    assert.deepEqual(await disabled.claimAlert({ reference: "admin-uat:daily-0600:failed:1", kind: "daily-job-failed" }), { state: "not-configured", value: null });
    assert.deepEqual(await disabled.markAlertRelayAccepted("admin-uat:daily-0600:failed:1"), { state: "not-configured", value: null });
    assert.deepEqual(await disabled.applyRunLogRetention(), { state: "not-configured", value: null });
  }
  const health = await dailyJob.readDailyJobHealth(store.getOpsTelemetryStore({}));
  assert.equal(health.storeState, "not-configured");
  assert.equal(OPS_NOT_CONNECTED_LABEL, "ยังไม่ได้เชื่อม Supabase");
});

test("Supabase store is lane-locked, sends the service key only in headers and claims alerts atomically", async () => {
  const env = { CCPUN_APP_ENV: "admin-uat", CCPUN_SUPABASE_URL: "https://abc.supabase.co", CCPUN_SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key" };
  const mismatch = fakeSupabase([{ body: [{ lane: "production-admin" }] }]);
  const wrongLane = store.getOpsTelemetryStore(env, mismatch.fetch);
  assert.deepEqual(await wrongLane.readLatestDailyJob(), { state: "lane-mismatch", value: null });
  assert.equal(mismatch.calls.length, 1, "no data read after a lane mismatch");

  const fake = fakeSupabase([{ body: [{ lane: "admin-uat" }] }, { body: [jobRow] }, { body: { claimed: true, state: "pending", attempts: 1 } }, { body: { claimed: false, state: "pending", attempts: 1 } }, { body: { cutoff: "2026-07-27", keepDays: 90, refreshedSummaries: 1, archivedSummaries: 0, deletedRows: 0 } }, { body: true }]);
  const uat = store.getOpsTelemetryStore(env, fake.fetch);
  const latest = await uat.readLatestDailyJob();
  assert.equal(latest.state, "ready"); assert.equal(latest.value?.status, "failed"); assert.deepEqual(latest.value?.failedSteps, ["gsc"]);
  const reference = "admin-uat:daily-0600:failed:7";
  assert.deepEqual(await uat.claimAlert({ reference, kind: "daily-job-failed" }), { state: "ready", value: { claimed: true, state: "pending", attempts: 1 } });
  assert.deepEqual(await uat.claimAlert({ reference, kind: "daily-job-failed" }), { state: "ready", value: { claimed: false, state: "pending", attempts: 1 } });
  assert.equal((await uat.applyRunLogRetention({ now: "2026-10-25T03:00:00.000Z" })).state, "ready");
  assert.deepEqual(await uat.markAlertRelayAccepted(reference), { state: "ready", value: true });
  assert.deepEqual(await uat.claimAlert({ reference: "Not A Reference", kind: "daily-job-failed" }), { state: "unavailable", value: null }, "an invalid reference never reaches Supabase");
  assert.equal(fake.calls.length, 6);
  for (const call of fake.calls) {
    assert.ok(call.url.startsWith("https://abc.supabase.co/rest/v1/"));
    assert.doesNotMatch(call.url, /service-role-test-key/);
    assert.equal((call.init.headers as Record<string, string>).Authorization, "Bearer service-role-test-key");
    assert.equal(call.init.redirect, "error");
  }
  assert.match(fake.calls[2]!.url, /rpc\/ops_claim_alert$/);
  assert.equal(fake.calls[2]!.init.method, "POST");
  assert.deepEqual(JSON.parse(String(fake.calls[2]!.init.body)), { p_reference: reference, p_kind: "daily-job-failed", p_ttl_seconds: 600 }, "claim expiry uses the database clock (no p_now)");
  assert.match(fake.calls[5]!.url, /rpc\/ops_mark_alert_accepted$/);
  assert.deepEqual(JSON.parse(String(fake.calls[5]!.init.body)), { p_reference: reference });
  assert.match(fake.calls[4]!.url, /rpc\/ops_apply_run_log_retention$/);
  assert.deepEqual(JSON.parse(String(fake.calls[4]!.init.body)), { p_now: "2026-10-25T03:00:00.000Z", p_keep_days: 90 });
  assert.equal((await uat.applyRunLogRetention({ keepDays: 30 })).state, "unavailable", "retention shorter than 90 days is refused");

  const failing = store.getOpsTelemetryStore(env, async () => { throw new Error("network"); });
  assert.deepEqual(await failing.readLatestDailyJob(), { state: "unavailable", value: null });
});

// --- A6: banner + email -------------------------------------------------------

const failedJob: DailyJobStatus = { id: 7, jobKey: "daily-0600", runDate: "2026-10-25", executionId: "n8n-1", trigger: "schedule", status: "failed", startedAt: "2026-10-24T23:00:00.000Z", finishedAt: null, failedSteps: ["gsc"], errorCategory: null, alertSentAt: null };

test("06:00 health: failed, running, ok and missing after 07:30 Bangkok; Neon fallback only reports today's failures", () => {
  const morning = "2026-10-25T01:00:00.000Z"; // 08:00 Bangkok
  assert.equal(bangkokDate(morning), "2026-10-25");
  assert.equal(deriveDailyJobHealth(failedJob, morning).state, "failed");
  assert.equal(deriveDailyJobHealth({ ...failedJob, status: "partial" }, morning).state, "failed");
  assert.equal(deriveDailyJobHealth({ ...failedJob, status: "running" }, "2026-10-24T23:20:00.000Z").state, "running");
  // Codex audit F01: a 06:00 run still "running" at 08:00 is stuck, not running forever.
  assert.equal(deriveDailyJobHealth({ ...failedJob, status: "running" }, morning).state, "stuck");
  assert.equal(deriveDailyJobHealth({ ...failedJob, status: "succeeded" }, morning).state, "ok");
  assert.equal(deriveDailyJobHealth({ ...failedJob, runDate: "2026-10-24" }, morning).state, "missing");
  assert.equal(deriveDailyJobHealth(null, "2026-10-24T23:10:00.000Z").state, "unknown", "06:10 Bangkok is too early to call it missing");
  const sources = [{ source: "gsc", lastAttemptAt: "2026-10-24T23:01:00.000Z", lastAttemptStatus: "failed" }, { source: "ga4", lastAttemptAt: "2026-10-24T23:01:00.000Z", lastAttemptStatus: "completed" }];
  assert.deepEqual(deriveDailyJobHealthFromAnalytics(sources, morning).failedSteps, ["gsc"]);
  assert.equal(deriveDailyJobHealthFromAnalytics(sources.map((item) => ({ ...item, lastAttemptAt: "2026-10-20T23:01:00.000Z" })), morning).state, "unknown");
});

test("email notifier is disabled by default and the webhook adapter signs every message", async () => {
  assert.equal(notifier.alertEmailStatus({}), "disabled");
  assert.equal(notifier.getOwnerNotifier({}).channel, "disabled");
  assert.deepEqual(await notifier.getOwnerNotifier({}).send({ kind: "daily-job-failed", subject: "s", text: "t", reference: "r" }), { accepted: false, reason: "disabled" });
  for (const env of [{ CCPUN_ALERT_EMAIL_PROVIDER: "webhook" }, { CCPUN_ALERT_EMAIL_PROVIDER: "webhook", CCPUN_ALERT_EMAIL_WEBHOOK_URL: "http://relay.example.test/x", CCPUN_ALERT_EMAIL_WEBHOOK_SECRET: "x".repeat(32), CCPUN_ALERT_EMAIL_TO: "owner@example.test" }, { CCPUN_ALERT_EMAIL_PROVIDER: "webhook", CCPUN_ALERT_EMAIL_WEBHOOK_URL: "https://relay.example.test/x", CCPUN_ALERT_EMAIL_WEBHOOK_SECRET: "short", CCPUN_ALERT_EMAIL_TO: "owner@example.test" }]) {
    assert.equal(notifier.alertEmailStatus(env), "invalid-config", JSON.stringify(env));
  }
  const secret = "s".repeat(40);
  const sent: Array<{ url: string; init: RequestInit }> = [];
  const adapter = notifier.getOwnerNotifier({ CCPUN_ALERT_EMAIL_PROVIDER: "webhook", CCPUN_ALERT_EMAIL_WEBHOOK_URL: "https://relay.example.test/hook", CCPUN_ALERT_EMAIL_WEBHOOK_SECRET: secret, CCPUN_ALERT_EMAIL_TO: "owner@example.test" }, async (url, init = {}) => { sent.push({ url, init }); return new Response(null, { status: 200 }); });
  assert.deepEqual(await adapter.send({ kind: "daily-job-failed", subject: "s", text: "t", reference: "daily-0600:n8n-1" }), { accepted: true, channel: "email-webhook" });
  const headers = sent[0]!.init.headers as Record<string, string>;
  assert.equal(headers["Idempotency-Key"], "daily-0600:n8n-1", "the reference is the relay idempotency key");
  assert.equal(headers["X-CCPun-Signature"], "sha256=" + createHmac("sha256", secret).update(`${headers["X-CCPun-Timestamp"]}.${String(sent[0]!.init.body)}`).digest("hex"));
  assert.equal(JSON.parse(String(sent[0]!.init.body)).to, "owner@example.test");
});

test("failure email is sent once per failed run; a failed send keeps the claim until it expires, then retries", async () => {
  const health = { ...deriveDailyJobHealth(failedJob, "2026-10-25T01:00:00.000Z"), storeState: "ready" as const };
  const clock = { now: Date.parse("2026-10-25T01:00:00.000Z") };
  const claims = new Map<string, AlertClaimRow>();
  const calls: string[] = [];
  const fakeStore = {
    provider: "supabase" as const,
    status: async () => ({ state: "ready" as const, provider: "supabase" as const, lane: "admin-uat" as const }),
    readLatestDailyJob: async () => ({ state: "ready" as const, value: failedJob }),
    claimAlert: async (input: { reference: string; kind: OpsAlertKind; ttlSeconds?: number }) => { calls.push("claim"); return { state: "ready" as const, value: claimAlertInMemory(claims, input, clock.now) }; },
    markAlertRelayAccepted: async (reference: string) => { calls.push("accepted"); return { state: "ready" as const, value: markAlertAcceptedInMemory(claims, reference, clock.now) }; },
    applyRunLogRetention: async () => ({ state: "not-configured" as const, value: null }),
  };
  const messages: string[] = [];
  const ok = { channel: "email-webhook" as const, send: async (message: { subject: string }) => { messages.push(message.subject); return { accepted: true as const, channel: "email-webhook" as const }; } };
  const broken = { channel: "email-webhook" as const, send: async () => ({ accepted: false as const, reason: "relay-rejected" as const }) };
  const reference = "admin-uat:daily-0600:failed:7";
  assert.deepEqual(await dailyJob.dispatchDailyJobAlert(health, { store: fakeStore, notifier: broken }), { outcome: "relay-rejected", reference });
  assert.deepEqual(calls, ["claim"], "a rejected send is not released");
  assert.deepEqual(await dailyJob.dispatchDailyJobAlert(health, { store: fakeStore, notifier: ok }), { outcome: "claim-held", reference }, "no retry before the claim expires");
  assert.equal(messages.length, 0);
  clock.now += 10 * 60_000;
  assert.deepEqual(await dailyJob.dispatchDailyJobAlert(health, { store: fakeStore, notifier: ok }), { outcome: "relay-accepted", reference, recorded: true });
  assert.deepEqual(await dailyJob.dispatchDailyJobAlert(health, { store: fakeStore, notifier: ok }), { outcome: "already-accepted", reference });
  assert.equal(messages.length, 1); assert.match(messages[0]!, /06:00 วันที่ 25 ต\.ค\. 2569 ไม่สำเร็จ/);
  calls.length = 0;
  assert.deepEqual(await dailyJob.dispatchDailyJobAlert(health, { store: fakeStore, notifier: notifier.disabledNotificationAdapter }), { outcome: "email-disabled", reference });
  assert.deepEqual(calls, [], "disabled email never claims the run");
  assert.deepEqual(await dailyJob.dispatchDailyJobAlert({ ...health, state: "ok" }, { store: fakeStore, notifier: ok }), { outcome: "not-needed" });
});

test("Admin-wide banner reads Supabase only; the report fallback reuses the Neon status it already loaded", () => {
  const banner = read("features/admin/operations/DailyJobBanner.tsx");
  assert.doesNotMatch(banner.match(/^import .*$/gm)!.join("\n"), /neon|analytics\/store/i);
  assert.match(read("lib/admin/ops-telemetry/daily-job.ts"), /never queries Neon/);
  assert.doesNotMatch(read("lib/admin/ops-telemetry/daily-job.ts"), /from "@neondatabase|analytics\/store/);
  const layout = read("apps/admin/app/(control-plane)/layout.tsx");
  assert.match(layout, /alert=\{hasAdminPermission\(role, "settings:read"\) \? <Suspense fallback=\{null\}><DailyJobBanner \/><\/Suspense> : null\}/);
  assert.match(read("features/admin/analytics/StoredAnalyticsDashboard.tsx"), /deriveDailyJobHealthFromAnalytics\(model\.sources, now\)/);
});

// --- A2/A4/A8/A9: navigation and pages ------------------------------------------

test("A4: manual GSC/GA4 page leaves the menu, redirects to the report and the same syncs run from ดึงใหม่ตอนนี้", () => {
  const layout = read("apps/admin/app/(control-plane)/layout.tsx");
  assert.doesNotMatch(layout, /href: "\/seo\/opportunities\/"/);
  assert.equal(ADMIN_NAVIGATION_REDIRECTS["/seo/opportunities/"], "/analytics/");
  const route = read("apps/admin/app/(control-plane)/seo/opportunities/page.tsx");
  assert.match(route, /redirect\("\/analytics\/"\)/);
  assert.match(route, /redirect\(`\/analytics\/\?googleConnect=\$\{googleConnect\}`\)/);
  assert.match(route, /\/\^\[a-z-\]\{1,40\}\$\/\.test\(googleConnect\)/, "only a safe status token is forwarded");
  const panel = read("features/admin/seo/opportunities/RefreshNowPanel.tsx");
  assert.match(panel, />\s*ดึงใหม่ตอนนี้\s*</);
  assert.match(panel, /<GscManualSync [^>]*autoStart=\{run > 0\}/);
  assert.match(panel, /<Ga4ManualSync [\s\S]*autoStart=\{run > 0\}/);
  for (const control of ["GscManualSync", "Ga4ManualSync"]) {
    const source = read(`features/admin/seo/opportunities/${control}.tsx`);
    assert.match(source, /if \(!autoStart \|\| autoStarted\.current\) return;/);
    assert.match(source, /void sync\(\);/);
  }
  const section = read("features/admin/seo/opportunities/RefreshNowSection.tsx");
  assert.match(section, /hasAdminPermission\(identity\.role, "research:provider-query"\)/);
  assert.match(section, /getSeoIntelligenceRuntimeStatus\(\)/);
  assert.match(read("apps/admin/app/(control-plane)/analytics/page.tsx"), /refreshSlot=\{<RefreshNowSection googleConnect=\{googleConnect\} \/>\}/);
});

test("A2: every Admin link into Studio opens in the same tab; Studio keeps its back link", () => {
  for (const file of ["features/admin/components/AdminProtectedChrome.tsx", "features/admin/components/ArticleDetailPage.tsx", "features/admin/components/ContentArticlesPage.tsx", "features/admin/components/SeoAuditDetailPage.tsx", "features/admin/components/SeoOverviewPage.tsx", "features/admin/components/SeoReviewInboxPage.tsx", "apps/admin/app/(control-plane)/dashboard/page.tsx"]) {
    const source = read(file);
    for (const match of source.matchAll(/<Link[^>]*href=\{?[`"][^`"]*\/studio\/[^>]*>/g)) assert.doesNotMatch(match[0], /target=/, `${file}: ${match[0]}`);
  }
  assert.match(read("cms/sanity/components/StudioAdminBackLink.tsx"), /← กลับศูนย์จัดการ/);
});

test("A9: versions and system info sit in a collapsed สำหรับทีมเทคนิค section; LINE keys collapse on สถานะระบบ", () => {
  const layout = read("apps/admin/app/(control-plane)/layout.tsx");
  assert.match(layout, /href: "\/operations\/deployments\/", label: "เวอร์ชันที่ใช้งาน", technical: true/);
  assert.match(layout, /href: "\/settings\/system\/", label: "ข้อมูลระบบ", technical: true/);
  const { everyday, technical } = splitTechnicalNavigationItems(contextualNavigationItems({ href: "/operations/", label: "สถานะระบบ", children: [{ href: "/operations/health/", label: "ภาพรวมระบบ" }, { href: "/operations/deployments/", label: "เวอร์ชันที่ใช้งาน", technical: true }] }));
  assert.deepEqual(everyday.map((item) => item.href), ["/operations/health/"]);
  assert.deepEqual(technical.map((item) => item.href), ["/operations/deployments/"]);
  const nav = read("features/admin/components/AdminNavigation.tsx");
  assert.match(nav, /<details className="[^"]*" open=\{technicalActive \|\| undefined\} data-admin-technical-nav="">/);
  assert.match(nav, />สำหรับทีมเทคนิค<\/summary>/);
  assert.match(read("apps/admin/app/(control-plane)/operations/health/page.tsx"), /<summary [^>]*>สำหรับทีมเทคนิค · ความพร้อมของการเข้ารหัส LINE<\/summary>\s*<Card title="ความพร้อมของการเข้ารหัส LINE"/);
});

test("A8: ภาพรวม and ลูกค้า LINE use cards and 44px targets at 390px", () => {
  const inbox = read("apps/admin/app/(control-plane)/dashboard/inbox/page.tsx");
  assert.doesNotMatch(inbox, /<table/);
  assert.match(inbox, /className="inline-flex min-h-11 items-center break-words hover:text-white/);
  assert.match(inbox, /className="block min-h-11 rounded-2xl border border-\[#e0c985\]\/15/);
  assert.match(inbox, /<section className="mt-7 grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="สรุปลูกค้า">/);
  const dashboard = read("apps/admin/app/(control-plane)/dashboard/page.tsx");
  assert.doesNotMatch(dashboard, /<table/);
  assert.doesNotMatch(dashboard, /px-3 py-2 text-xs text-white\/65/, "small link chips became 44px targets");
  assert.match(dashboard, /inline-flex min-h-11 items-center text-sm text-\[#e0c985\]/);
  assert.match(read("features/admin/components/AdminProtectedChrome.tsx"), /<div className="break-all text-white\/80">\{identityLabel\}<\/div>/);
});

// --- A7: first Local AI jobs ------------------------------------------------------

test("A7: the first Local AI jobs use existing public-safe task types; article suggestions are a scaffold", () => {
  assert.deepEqual(LOCAL_AI_FIRST_JOBS.map((job) => [job.id, job.taskType, job.state]), [["daily-marketing-summary", "analytics-review", "active"], ["article-improvement-suggestions", "content-operations", "scaffold"]]);
  for (const job of LOCAL_AI_FIRST_JOBS) { assert.ok((LOCAL_AI_TASK_TYPES as readonly string[]).includes(job.taskType)); assert.equal(job.dataClass, "public-safe"); }
  const input = buildArticleSuggestionInput({ title: " ประกันสุขภาพ ", body: "เนื้อหา", canonicalPath: "/blog/health-insurance/x/", allowedCategories: ["health-insurance", "health-insurance", " "] });
  assert.ok(input);
  assert.equal(localAiTaskInputSchemas["content-operations"].safeParse(input).success, true);
  assert.equal(buildArticleSuggestionInput({ title: "x", body: "y".repeat(30_001), allowedCategories: ["a"] }), null);
  assert.equal(buildArticleSuggestionInput({ title: "x", body: "y", allowedCategories: [] }), null);
  assert.match(read("features/admin/operations/LocalAiPage.tsx"), /LOCAL_AI_FIRST_JOBS\.map/);
});

// --- A3: approve and publish -------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Bag = Record<string, any>;
const nodeRequire = createRequire(import.meta.url);
const { JSDOM } = nodeRequire("jsdom");
const actionSource = read("cms/sanity/policy/article-publish-action.tsx");
const compiledAction = ts.transpileModule(actionSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;

async function mountApprove(draftOverrides: Bag = {}) {
  const dom = new JSDOM("<div id='root'></div>");
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  const rootNode = createRoot(dom.window.document.getElementById("root"));
  const state: Bag = { validation: { isValidating: false, validation: [] }, sync: { isSyncing: false }, calls: [], complete: 0, extraBlock: null };
  const exports: Bag = {};
  new Function("require", "exports", compiledAction)((id: string) => {
    if (id === "sanity") return { useClient: () => ({}), useSyncState: () => state.sync, useValidationStatus: () => state.validation };
    if (id === "./article-publication") return {
      articlePublishBlock: (draft: Bag) => state.extraBlock ?? (draft?.review?.status === "approved" ? null : "not approved"),
      hasArticleContentChanges,
      publishApprovedArticle: async (_client: unknown, draft: Bag, published: Bag, _now: unknown, optimization: boolean) => { state.calls.push({ draft, published, optimization }); },
    };
    return nodeRequire(id);
  }, exports);
  const action = exports.createApproveAndPublishArticleAction();
  let current: Bag | null = null;
  let props: Bag = {
    id: "article", type: "article", onComplete: () => state.complete++,
    draft: { _id: "drafts.article", _type: "article", _rev: "draft-1", title: "Draft", review: { status: "ready-for-coo" }, ...draftOverrides },
    published: null,
  };
  function Probe() { current = action(props); return null; }
  const render = async (update: Bag = {}) => { props = { ...props, ...update }; await act(async () => rootNode.render(createElement(Probe))); };
  await render();
  return {
    state, exports, get result() { return current; }, get props() { return props; }, render,
    handle: async () => { await act(async () => current!.onHandle()); },
    cancel: async () => { await act(async () => current!.dialog.onCancel()); },
    confirm: async () => { await act(async () => current!.dialog.onConfirm()); },
    close: async () => { await act(async () => rootNode.unmount()); dom.window.close(); Object.assign(globalThis, previous); },
  };
}

test("A3: one อนุมัติและเผยแพร่ button publishes the approved snapshot through the existing guarded transaction", async () => {
  const ui = await mountApprove();
  try {
    assert.equal(ui.result!.label, "อนุมัติและเผยแพร่");
    assert.equal(ui.result!.disabled, false);
    await ui.handle(); assert.equal(ui.result!.dialog.type, "confirm");
    assert.equal(ui.result!.dialog.confirmButtonText, "ยืนยันอนุมัติและเผยแพร่");
    await ui.cancel(); assert.equal(ui.state.calls.length, 0, "cancel never mutates");
    await ui.handle(); await ui.confirm();
    assert.equal(ui.state.calls.length, 1); assert.equal(ui.state.complete, 1);
    assert.equal(ui.state.calls[0].draft.review.status, "approved", "approval is recorded in the same publication");
    assert.equal(ui.state.calls[0].draft._rev, "draft-1", "the original Draft revision guards the transaction");
    assert.equal(ui.props.draft.review.status, "ready-for-coo", "the Draft in memory is not patched separately");
  } finally { await ui.close(); }
});

test("A3: the button hides once approved and stays blocked by every other publish guard", async () => {
  const approved = await mountApprove({ review: { status: "approved" } });
  try { assert.equal(approved.result, null, "approved Drafts use the existing publish action"); } finally { await approved.close(); }
  const ui = await mountApprove();
  try {
    ui.state.extraBlock = "URL หรือหมวดหมู่ต่างจากฉบับ Live ต้องผ่าน SEO Migration ก่อน"; await ui.render();
    assert.equal(ui.result!.disabled, true); assert.equal(ui.result!.title, ui.state.extraBlock);
    ui.state.extraBlock = null; ui.state.validation.validation = [{ level: "error" }]; await ui.render();
    assert.equal(ui.result!.disabled, true);
    ui.state.validation.validation = []; await ui.render(); await ui.handle();
    await ui.render({ draft: { ...ui.props.draft, _rev: "draft-2" } }); await ui.confirm();
    assert.equal(ui.state.calls.length, 0, "a changed revision after opening the dialog is rejected");
    assert.equal(ui.result!.dialog.type, "dialog");
  } finally { await ui.close(); }
  const wrapped = ui.exports.wrapGoogleSafeArticlePublishActions([Object.assign(() => null, { action: "publish" })], "production-admin", "article");
  assert.equal(wrapped.length, 2);
  assert.equal(wrapped[0].displayName, "CCPunApproveAndPublishArticleAction");
  assert.equal(wrapped[1].displayName, "CCPunGoogleSafeArticlePublishAction");
  assert.equal(ui.exports.wrapGoogleSafeArticlePublishActions([Object.assign(() => null, { action: "publish" })], "admin-uat", "article").length, 1, "UAT keeps publishing disabled by policy");
});

// --- Frozen-proof admissions ---------------------------------------------------------

test("2026-10-25 frozen-proof admissions are exact and reject any further edit", () => {
  for (const [file, { before: predecessor, after: successor }] of Object.entries(adminOps20261025Sources)) {
    assert.ok(existsSync(path.join(root, file)), file);
    const current = adminOps20261025SourceDigest(read(file));
    // Later exact admissions (copy fixes, then the audit follow-up) may replace the successor; each must name the one it replaced.
    const copyReviewed = adminCopyFixesPredecessorDigest(file, current);
    const followUp = Object.hasOwn(adminOpsAuditFollowUpSources, file) ? adminOpsAuditFollowUpSources[file as keyof typeof adminOpsAuditFollowUpSources] : null;
    const digest = followUp && copyReviewed === followUp.after ? followUp.before : copyReviewed;
    assert.equal(digest, successor, `${file} is exactly the reviewed successor`);
    assert.equal(adminOps20261025PredecessorDigest(file, current), predecessor);
    assert.equal(adminOps20261025PredecessorDigest(file, digest), predecessor);
    assert.equal(adminOps20261025PredecessorDigest(file, adminOps20261025SourceDigest(read(file) + "\n// unreviewed")), adminOps20261025SourceDigest(read(file) + "\n// unreviewed"));
    assert.notEqual(predecessor, successor);
  }
});
