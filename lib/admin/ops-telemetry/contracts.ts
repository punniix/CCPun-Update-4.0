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

// ---------------------------------------------------------------------------
// 06:00 job health for the Admin banner and the failure email.
// ---------------------------------------------------------------------------

export type DailyJobHealth = {
  state: "ok" | "running" | "failed" | "missing" | "unknown";
  source: "supabase" | "neon-fallback" | "none";
  runDate: string | null;
  failedSteps: string[];
  job: DailyJobStatus | null;
  storeState: OpsStoreState;
};

/** From the Supabase 06:00 status row (preferred source). */
export function deriveDailyJobHealth(latest: DailyJobStatus | null, now: Date | string | number = Date.now()): Omit<DailyJobHealth, "storeState"> {
  const today = bangkokDate(now);
  const due = bangkokMinutes(now) >= DAILY_JOB_EXPECTED_BY_MINUTES;
  if (!latest || latest.runDate < today) {
    return { state: due ? "missing" : "unknown", source: "supabase", runDate: latest?.runDate ?? null, failedSteps: [], job: latest };
  }
  const state = latest.status === "failed" || latest.status === "partial" ? "failed" : latest.status === "running" ? "running" : "ok";
  return { state, source: "supabase", runDate: latest.runDate, failedSteps: latest.failedSteps, job: latest };
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
