import { z } from "zod";

// Owner-approved data split (2026-10-25): high-frequency n8n data (run logs,
// raw daily pulls, the 06:00 job status) lives in a dedicated Supabase project
// per lane so Neon compute can stay asleep. Admin-owned or sensitive data stays
// in Neon. This module is pure (no network, no server-only import) so the
// contract and the retention rules can be tested directly.

export const OPS_LANES = ["admin-uat", "production-admin"] as const;
export type OpsLane = (typeof OPS_LANES)[number];

export const OPS_RUN_STATUSES = ["started", "succeeded", "failed", "skipped", "warning"] as const;
export type OpsRunStatus = (typeof OPS_RUN_STATUSES)[number];

export const OPS_DAILY_JOB_STATUSES = ["running", "succeeded", "partial", "failed"] as const;
export type OpsDailyJobStatus = (typeof OPS_DAILY_JOB_STATUSES)[number];

export const DAILY_JOB_KEY = "daily-0600";
// Detail rows are kept 90 days; daily summaries are kept forever (owner decision A5).
export const RUN_LOG_RETENTION_DAYS = 90;
// The 06:00 run normally finishes well before this Bangkok time.
export const DAILY_JOB_EXPECTED_BY_MINUTES = 7 * 60 + 30;
// n8n hard-stops the daily workflow after settings.executionTimeout = 600 s
// (workers/local-ai/n8n/owner-export-google-sheet.direct.json). A run whose
// status row still says "running" after this n8n limit plus a 20-minute grace
// (queueing, a slow final status write, clock skew) can no longer finish on its
// own: it is reported as stuck. 30 minutes after a 06:00 start is still well
// inside the 07:30 expected-by time, so a stuck schedule run surfaces before
// the "missing" check would.
export const DAILY_JOB_N8N_EXECUTION_TIMEOUT_SECONDS = 600;
export const DAILY_JOB_STUCK_AFTER_MINUTES = 30;
// Only Production runs the 06:00 n8n schedule. UAT has no schedule, so a day
// without a UAT run is "unscheduled", never a "missing" outage.
export const DAILY_JOB_SCHEDULED_LANES: readonly OpsLane[] = ["production-admin"];

export const OPS_NOT_CONNECTED_LABEL = "ยังไม่ได้เชื่อม Supabase";

export type OpsStoreState = "ready" | "not-configured" | "lane-mismatch" | "unavailable";
export type OpsResult<T> = { state: "ready"; value: T } | { state: Exclude<OpsStoreState, "ready">; value: null };

export const opsStoreStateLabel: Record<OpsStoreState, string> = {
  ready: "เชื่อม Supabase แล้ว",
  "not-configured": OPS_NOT_CONNECTED_LABEL,
  "lane-mismatch": "Supabase ไม่ตรงกับระบบนี้ จึงหยุดอ่านไว้ก่อน",
  unavailable: "ยังอ่าน Supabase ไม่ได้",
};

const isoTimestamp = z.string().refine((value) => Number.isFinite(Date.parse(value)), "timestamp");

export const dailyJobStatusRowSchema = z.object({
  id: z.number().int().positive(),
  job_key: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
  run_date: z.iso.date(),
  execution_id: z.string().min(1).max(64),
  trigger: z.enum(["schedule", "manual", "admin"]),
  status: z.enum(OPS_DAILY_JOB_STATUSES),
  started_at: isoTimestamp,
  finished_at: isoTimestamp.nullable(),
  failed_steps: z.array(z.string().max(120)).max(40),
  error_category: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/).nullable(),
  alert_sent_at: isoTimestamp.nullable(),
});
export type DailyJobStatusRow = z.infer<typeof dailyJobStatusRowSchema>;

export type DailyJobStatus = {
  id: number;
  jobKey: string;
  runDate: string;
  executionId: string;
  trigger: DailyJobStatusRow["trigger"];
  status: OpsDailyJobStatus;
  startedAt: string;
  finishedAt: string | null;
  failedSteps: string[];
  errorCategory: string | null;
  alertSentAt: string | null;
};

export function toDailyJobStatus(row: DailyJobStatusRow): DailyJobStatus {
  return {
    id: row.id,
    jobKey: row.job_key,
    runDate: row.run_date,
    executionId: row.execution_id,
    trigger: row.trigger,
    status: row.status,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    failedSteps: row.failed_steps,
    errorCategory: row.error_category,
    alertSentAt: row.alert_sent_at,
  };
}

export const retentionResultSchema = z.object({
  cutoff: z.iso.date(),
  keepDays: z.number().int().min(RUN_LOG_RETENTION_DAYS),
  refreshedSummaries: z.number().int().nonnegative(),
  archivedSummaries: z.number().int().nonnegative(),
  deletedRows: z.number().int().nonnegative(),
}).strict();
export type RetentionResult = z.infer<typeof retentionResultSchema>;

/** Bangkok calendar date (the 06:00 job and n8n schedule run on Bangkok time). */
export function bangkokDate(value: Date | string | number = Date.now()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

function bangkokMinutes(value: Date | string | number): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value ?? 0);
  return part("hour") * 60 + part("minute");
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function retentionCutoff(now: Date | string | number, keepDays = RUN_LOG_RETENTION_DAYS): string {
  if (!Number.isInteger(keepDays) || keepDays < RUN_LOG_RETENTION_DAYS) throw new Error("OPS_RETENTION_TOO_SHORT");
  return addDays(bangkokDate(now), -keepDays);
}

// ---------------------------------------------------------------------------
// Run-log retention. This mirrors public.ops_apply_run_log_retention() in
// db/supabase/migrations/20261025000200_ops_run_log_retention.sql exactly, so the
// rules are tested here and the SQL stays the single production implementation.
// ---------------------------------------------------------------------------

export type RunLogRow = {
  workflowId: string;
  workflowName: string;
  executionId: string;
  step: string;
  status: OpsRunStatus;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  runDate: string;
};

export type RunLogDailySummary = {
  runDate: string;
  workflowId: string;
  workflowName: string;
  totalSteps: number;
  executions: number;
  succeeded: number;
  failed: number;
  warning: number;
  skipped: number;
  started: number;
  totalDurationMs: number;
  maxDurationMs: number | null;
  firstStartedAt: string | null;
  lastFinishedAt: string | null;
  // true while the detail rows behind this summary still exist (full recompute);
  // false once they were purged (later late-arriving rows are merged, not replaced).
  detailRowsRetained: boolean;
};

export type RunLogState = { runs: RunLogRow[]; daily: RunLogDailySummary[] };

const maxIso = (a: string | null, b: string | null) => (a === null ? b : b === null ? a : (Date.parse(a) >= Date.parse(b) ? a : b));
const minIso = (a: string | null, b: string | null) => (a === null ? b : b === null ? a : (Date.parse(a) <= Date.parse(b) ? a : b));
const maxNumber = (a: number | null, b: number | null) => (a === null ? b : b === null ? a : Math.max(a, b));

function summarize(rows: RunLogRow[], retained: boolean): RunLogDailySummary[] {
  const groups = new Map<string, RunLogRow[]>();
  for (const row of rows) {
    const key = `${row.runDate}|${row.workflowId}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.values()].map((group) => {
    const latest = [...group].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))[0]!;
    const count = (status: OpsRunStatus) => group.filter((row) => row.status === status).length;
    return {
      runDate: latest.runDate,
      workflowId: latest.workflowId,
      workflowName: latest.workflowName,
      totalSteps: group.length,
      executions: new Set(group.map((row) => row.executionId)).size,
      succeeded: count("succeeded"),
      failed: count("failed"),
      warning: count("warning"),
      skipped: count("skipped"),
      started: count("started"),
      totalDurationMs: group.reduce((sum, row) => sum + (row.durationMs ?? 0), 0),
      maxDurationMs: group.reduce<number | null>((max, row) => maxNumber(max, row.durationMs), null),
      firstStartedAt: group.reduce<string | null>((min, row) => minIso(min, row.startedAt), null),
      lastFinishedAt: group.reduce<string | null>((max, row) => maxIso(max, row.finishedAt), null),
      detailRowsRetained: retained,
    };
  });
}

function sameSummary(a: RunLogDailySummary, b: RunLogDailySummary) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Idempotent: running it again with the same `now` changes nothing.
 * 1. Dates inside the window are fully recomputed from their detail rows.
 * 2. Dates past the window are summarized (replacing a summary that was still
 *    backed by detail rows, or merging late rows into an already-purged one)
 *    and their detail rows are deleted. Summaries are never deleted.
 *
 * Count contract (with the insert guard below, migration 20261025000400):
 * every summary counts each accepted detail row exactly once. totalSteps is
 * the number of distinct (executionId, step) rows, executions the number of
 * distinct executionIds and the status columns one per row, all for that
 * (runDate, workflowId). Once a day is archived (detailRowsRetained = false)
 * its summary is final, because no new detail row can land on it. The additive
 * merge in step 2 is only reachable for rows accepted before that guard
 * existed; for those, executions is an upper bound (a late step of an already
 * counted execution is counted again), never an under-count.
 */
export function applyRunLogRetentionInMemory(state: RunLogState, now: Date | string | number, keepDays = RUN_LOG_RETENTION_DAYS): { state: RunLogState; result: RetentionResult } {
  const cutoff = retentionCutoff(now, keepDays);
  const daily = new Map(state.daily.map((item) => [`${item.runDate}|${item.workflowId}`, { ...item }]));
  let refreshedSummaries = 0;
  let archivedSummaries = 0;

  for (const fresh of summarize(state.runs.filter((row) => row.runDate >= cutoff), true)) {
    const key = `${fresh.runDate}|${fresh.workflowId}`;
    const existing = daily.get(key);
    if (existing && sameSummary(existing, fresh)) continue;
    daily.set(key, fresh);
    refreshedSummaries += 1;
  }

  for (const expiring of summarize(state.runs.filter((row) => row.runDate < cutoff), false)) {
    const key = `${expiring.runDate}|${expiring.workflowId}`;
    const existing = daily.get(key);
    archivedSummaries += 1;
    if (!existing || existing.detailRowsRetained) {
      daily.set(key, expiring);
      continue;
    }
    daily.set(key, {
      ...existing,
      workflowName: expiring.workflowName,
      totalSteps: existing.totalSteps + expiring.totalSteps,
      executions: existing.executions + expiring.executions,
      succeeded: existing.succeeded + expiring.succeeded,
      failed: existing.failed + expiring.failed,
      warning: existing.warning + expiring.warning,
      skipped: existing.skipped + expiring.skipped,
      started: existing.started + expiring.started,
      totalDurationMs: existing.totalDurationMs + expiring.totalDurationMs,
      maxDurationMs: maxNumber(existing.maxDurationMs, expiring.maxDurationMs),
      firstStartedAt: minIso(existing.firstStartedAt, expiring.firstStartedAt),
      lastFinishedAt: maxIso(existing.lastFinishedAt, expiring.lastFinishedAt),
      detailRowsRetained: false,
    });
  }

  const runs = state.runs.filter((row) => row.runDate >= cutoff);
  return {
    state: { runs, daily: [...daily.values()].sort((a, b) => a.runDate.localeCompare(b.runDate) || a.workflowId.localeCompare(b.workflowId)) },
    result: { cutoff, keepDays, refreshedSummaries, archivedSummaries, deletedRows: state.runs.length - runs.length },
  };
}

/**
 * Mirror of the BEFORE INSERT/UPDATE trigger public.ops_guard_workflow_run_date()
 * (migration 20261025000400). A detail row is refused when its Bangkok run date
 * is older than the minimum 90-day retention window at write time, or when that
 * day/workflow was already archived (its summary no longer has detail rows).
 * Without this guard a late step of an already counted execution was merged
 * additively into the purged summary and counted twice (reproduced on PG16).
 */
export function insertRunLogRowInMemory(state: RunLogState, row: RunLogRow, now: Date | string | number): RunLogState {
  if (row.runDate < retentionCutoff(now)) throw new Error("OPS_RUN_LOG_TOO_OLD");
  if (state.daily.some((item) => item.runDate === row.runDate && item.workflowId === row.workflowId && !item.detailRowsRetained)) throw new Error("OPS_RUN_LOG_DAY_ARCHIVED");
  if (state.runs.some((item) => item.workflowId === row.workflowId && item.executionId === row.executionId && item.step === row.step)) throw new Error("OPS_RUN_LOG_DUPLICATE_STEP");
  return { runs: [...state.runs, row], daily: state.daily };
}

// ---------------------------------------------------------------------------
// 06:00 job health for the Admin banner and the owner alert.
// ---------------------------------------------------------------------------

export type DailyJobHealthState = "ok" | "running" | "stuck" | "failed" | "missing" | "unscheduled" | "unknown";

export type DailyJobHealth = {
  state: DailyJobHealthState;
  source: "supabase" | "neon-fallback" | "none";
  runDate: string | null;
  failedSteps: string[];
  job: DailyJobStatus | null;
  storeState: OpsStoreState;
};

export function dailyJobScheduledForLane(lane: OpsLane | null | undefined): boolean {
  return lane != null && DAILY_JOB_SCHEDULED_LANES.includes(lane);
}

/** True once a "running" row is past n8n's own execution limit plus grace. */
export function isDailyJobRunStuck(job: Pick<DailyJobStatus, "status" | "startedAt">, now: Date | string | number): boolean {
  if (job.status !== "running") return false;
  const startedAt = Date.parse(job.startedAt);
  return Number.isFinite(startedAt) && new Date(now).getTime() - startedAt >= DAILY_JOB_STUCK_AFTER_MINUTES * 60_000;
}

/**
 * From the Supabase 06:00 status row (preferred source).
 * - today's row: failed/partial -> failed, succeeded -> ok, running -> running
 *   until DAILY_JOB_STUCK_AFTER_MINUTES after its start, then stuck;
 * - no row today (none at all, or only an older day): before 07:30 Bangkok
 *   unknown; from 07:30 missing on a scheduled lane, unscheduled on UAT.
 * `scheduled` defaults to true so a caller that does not know its lane keeps
 * the stricter Production reading.
 */
export function deriveDailyJobHealth(latest: DailyJobStatus | null, now: Date | string | number = Date.now(), options: { scheduled?: boolean } = {}): Omit<DailyJobHealth, "storeState"> {
  const today = bangkokDate(now);
  const due = bangkokMinutes(now) >= DAILY_JOB_EXPECTED_BY_MINUTES;
  const scheduled = options.scheduled ?? true;
  if (!latest || latest.runDate < today) {
    return { state: !due ? "unknown" : scheduled ? "missing" : "unscheduled", source: "supabase", runDate: latest?.runDate ?? null, failedSteps: [], job: latest };
  }
  const state = latest.status === "failed" || latest.status === "partial" ? "failed"
    : latest.status === "running" ? (isDailyJobRunStuck(latest, now) ? "stuck" : "running")
    : "ok";
  return { state, source: "supabase", runDate: latest.runDate, failedSteps: latest.failedSteps, job: latest };
}

// ---------------------------------------------------------------------------
// Owner alert claim. Mirrors public.ops_claim_alert() / ops_mark_alert_accepted()
// in db/supabase/migrations/20261025000300_ops_alert_claims.sql so the
// crash-safety rules are tested here; the SQL is the production implementation.
//   pending  -> claimed by one attempt until claim_expires_at; if that attempt
//               dies (or the relay outcome is unknown) the claim can be taken
//               again after expiry and the same reference is re-sent;
//   accepted -> the relay answered 2xx for this reference. This is "relay
//               accepted", NOT "email delivered";
//   sent     -> reserved for a later delivery confirmation; nothing sets it yet.
// The reference doubles as the relay idempotency key, so a retry after an
// accepted-but-unanswered send is de-duplicated downstream.
// ---------------------------------------------------------------------------

export const OPS_ALERT_KINDS = ["daily-job-failed", "daily-job-stuck", "daily-job-missing"] as const;
export type OpsAlertKind = (typeof OPS_ALERT_KINDS)[number];
export const OPS_ALERT_STATES = ["pending", "accepted", "sent"] as const;
export type OpsAlertState = (typeof OPS_ALERT_STATES)[number];
// Longer than the 5 s relay timeout by far; also the retry interval after a
// crash, a relay rejection or an unconfirmed send.
export const OPS_ALERT_CLAIM_TTL_SECONDS = 600;
export const OPS_ALERT_REFERENCE_PATTERN = /^[a-z0-9][a-z0-9:._-]{0,159}$/;

export const alertClaimResultSchema = z.object({
  claimed: z.boolean(),
  state: z.enum(OPS_ALERT_STATES),
  attempts: z.number().int().positive(),
}).strict();
export type AlertClaimResult = z.infer<typeof alertClaimResultSchema>;

export type AlertClaimRow = { reference: string; kind: OpsAlertKind; state: OpsAlertState; attempts: number; claimedAt: string; claimExpiresAt: string; relayAcceptedAt: string | null };

export function claimAlertInMemory(rows: Map<string, AlertClaimRow>, input: { reference: string; kind: OpsAlertKind; ttlSeconds?: number }, now: Date | string | number): AlertClaimResult {
  const ttlSeconds = input.ttlSeconds ?? OPS_ALERT_CLAIM_TTL_SECONDS;
  if (!OPS_ALERT_REFERENCE_PATTERN.test(input.reference)) throw new Error("OPS_ALERT_REFERENCE_INVALID");
  if (!Number.isInteger(ttlSeconds) || ttlSeconds < 60 || ttlSeconds > 86_400) throw new Error("OPS_ALERT_TTL_INVALID");
  const at = new Date(now);
  const expires = new Date(at.getTime() + ttlSeconds * 1000).toISOString();
  const existing = rows.get(input.reference);
  if (!existing) {
    rows.set(input.reference, { reference: input.reference, kind: input.kind, state: "pending", attempts: 1, claimedAt: at.toISOString(), claimExpiresAt: expires, relayAcceptedAt: null });
    return { claimed: true, state: "pending", attempts: 1 };
  }
  if (existing.state === "pending" && existing.kind === input.kind && Date.parse(existing.claimExpiresAt) <= at.getTime()) {
    const next = { ...existing, attempts: existing.attempts + 1, claimedAt: at.toISOString(), claimExpiresAt: expires };
    rows.set(input.reference, next);
    return { claimed: true, state: "pending", attempts: next.attempts };
  }
  return { claimed: false, state: existing.state, attempts: existing.attempts };
}

export function markAlertAcceptedInMemory(rows: Map<string, AlertClaimRow>, reference: string, now: Date | string | number): boolean {
  const existing = rows.get(reference);
  if (!existing || existing.state !== "pending") return false;
  rows.set(reference, { ...existing, state: "accepted", relayAcceptedAt: new Date(now).toISOString() });
  return true;
}

type AnalyticsSourceAttempt = { source: string; lastAttemptAt: string | null; lastAttemptStatus: string | null };

/**
 * Fallback while Supabase is not connected: the existing Neon analytics batch
 * status already records each source attempt of the 06:00 run. Only a failure
 * recorded today raises the banner; a missing run is not inferred here because
 * UAT does not run the 06:00 schedule.
 */
export function deriveDailyJobHealthFromAnalytics(sources: AnalyticsSourceAttempt[], now: Date | string | number = Date.now()): Omit<DailyJobHealth, "storeState"> {
  const today = bangkokDate(now);
  const attemptedToday = sources.filter((item) => item.lastAttemptAt && bangkokDate(item.lastAttemptAt) === today);
  if (!attemptedToday.length) return { state: "unknown", source: "neon-fallback", runDate: null, failedSteps: [], job: null };
  const failed = attemptedToday.filter((item) => item.lastAttemptStatus === "failed").map((item) => item.source);
  const running = attemptedToday.some((item) => item.lastAttemptStatus === "running");
  return { state: failed.length ? "failed" : running ? "running" : "ok", source: "neon-fallback", runDate: today, failedSteps: failed, job: null };
}

const STEP_LABELS: Record<string, string> = {
  gsc: "Google Search Console",
  ga4: "Google Analytics",
  meta: "Facebook / Instagram",
  ubersuggest: "Ubersuggest",
};

export function dailyJobStepLabel(step: string): string {
  return STEP_LABELS[step] ?? step;
}
