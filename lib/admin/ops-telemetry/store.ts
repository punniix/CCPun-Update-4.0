import "server-only";
import { z } from "zod";
import type { AdminEnvironment } from "../environment";
import {
  DAILY_JOB_KEY,
  RUN_LOG_RETENTION_DAYS,
  dailyJobStatusRowSchema,
  retentionResultSchema,
  toDailyJobStatus,
  type DailyJobStatus,
  type OpsLane,
  type OpsResult,
  type OpsStoreState,
  type RetentionResult,
} from "./contracts";

// Server-only Supabase store for high-frequency n8n data. It talks to PostgREST
// with the service_role key over fetch (no extra SDK). The key is read from the
// Admin server env only, is never logged and never reaches client components.
// When the env vars are absent the disabled provider answers "not-configured"
// and every caller degrades to "ยังไม่ได้เชื่อม Supabase" instead of crashing.

export type OpsTelemetryStatus = { state: OpsStoreState; provider: "supabase" | "disabled"; lane: OpsLane | null };

export interface OpsTelemetryStore {
  readonly provider: "supabase" | "disabled";
  status(): Promise<OpsTelemetryStatus>;
  readLatestDailyJob(jobKey?: string): Promise<OpsResult<DailyJobStatus | null>>;
  /** Atomically marks the failure alert as sent; true only for the first caller. */
  claimDailyJobAlert(id: number, at?: string): Promise<OpsResult<boolean>>;
  /** Undoes a claim whose email could not be delivered, so a later render retries. */
  releaseDailyJobAlert(id: number, at: string): Promise<OpsResult<boolean>>;
  /** Calls public.ops_apply_run_log_retention(). Never invoked automatically. */
  applyRunLogRetention(input?: { now?: string; keepDays?: number }): Promise<OpsResult<RetentionResult>>;
}

type Variables = Record<string, string | undefined>;
type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export const SUPABASE_ENV = { url: "CCPUN_SUPABASE_URL", key: "CCPUN_SUPABASE_SERVICE_ROLE_KEY" } as const;

export function opsLaneForEnvironment(environment: AdminEnvironment | string | undefined): OpsLane | null {
  if (environment === "production-admin" || environment === "local-production") return "production-admin";
  if (environment === "admin-uat" || environment === "local-uat") return "admin-uat";
  return null;
}

export function readSupabaseConfig(variables: Variables = process.env): { url: string; key: string } | null {
  const rawUrl = variables[SUPABASE_ENV.url]?.trim();
  const key = variables[SUPABASE_ENV.key]?.trim();
  if (!rawUrl || !key) return null;
  let url: URL;
  try { url = new URL(rawUrl); } catch { return null; }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || (url.pathname !== "/" && url.pathname !== "")) return null;
  return { url: url.origin, key };
}

function notReady<T>(state: Exclude<OpsStoreState, "ready">): OpsResult<T> {
  return { state, value: null };
}

export const disabledOpsTelemetryStore: OpsTelemetryStore = Object.freeze({
  provider: "disabled" as const,
  async status() { return { state: "not-configured" as const, provider: "disabled" as const, lane: null }; },
  async readLatestDailyJob() { return notReady<DailyJobStatus | null>("not-configured"); },
  async claimDailyJobAlert() { return notReady<boolean>("not-configured"); },
  async releaseDailyJobAlert() { return notReady<boolean>("not-configured"); },
  async applyRunLogRetention() { return notReady<RetentionResult>("not-configured"); },
});

const laneRowsSchema = z.array(z.object({ lane: z.string() })).max(1);

export function createSupabaseOpsTelemetryStore(options: { url: string; key: string; lane: OpsLane; fetch?: FetchLike; timeoutMs?: number }): OpsTelemetryStore {
  const fetchImpl: FetchLike = options.fetch ?? ((input, init) => fetch(input, init));
  const timeoutMs = options.timeoutMs ?? 4_000;
  let laneCheck: Promise<OpsStoreState> | null = null;

  async function request(path: string, init: { method?: string; body?: unknown; prefer?: string } = {}) {
    const response = await fetchImpl(`${options.url}/rest/v1/${path}`, {
      method: init.method ?? "GET",
      headers: {
        apikey: options.key,
        Authorization: `Bearer ${options.key}`,
        Accept: "application/json",
        ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(init.prefer ? { Prefer: init.prefer } : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new Error("OPS_SUPABASE_HTTP_" + response.status);
    const text = await response.text();
    return text ? JSON.parse(text) as unknown : null;
  }

  function verifyLane(): Promise<OpsStoreState> {
    laneCheck ??= request("ops_lane_identity?select=lane&singleton=eq.true")
      .then((value) => {
        const rows = laneRowsSchema.parse(value);
        return rows[0]?.lane === options.lane ? "ready" as const : "lane-mismatch" as const;
      })
      .catch(() => { laneCheck = null; return "unavailable" as const; });
    return laneCheck;
  }

  async function guarded<T>(run: () => Promise<T>): Promise<OpsResult<T>> {
    const lane = await verifyLane();
    if (lane !== "ready") return notReady<T>(lane);
    try { return { state: "ready", value: await run() }; }
    catch { return notReady<T>("unavailable"); }
  }

  return {
    provider: "supabase",
    async status() { return { state: await verifyLane(), provider: "supabase", lane: options.lane }; },
    readLatestDailyJob(jobKey = DAILY_JOB_KEY) {
      return guarded(async () => {
        const value = await request(`ops_daily_job_status?select=id,job_key,run_date,execution_id,trigger,status,started_at,finished_at,failed_steps,error_category,alert_sent_at&job_key=eq.${encodeURIComponent(jobKey)}&order=run_date.desc,started_at.desc&limit=1`);
        const rows = z.array(dailyJobStatusRowSchema).max(1).parse(value);
        return rows[0] ? toDailyJobStatus(rows[0]) : null;
      });
    },
    claimDailyJobAlert(id, at = new Date().toISOString()) {
      return guarded(async () => {
        if (!Number.isSafeInteger(id) || id <= 0) throw new Error("OPS_INVALID_ID");
        const value = await request(`ops_daily_job_status?id=eq.${id}&alert_sent_at=is.null`, {
          method: "PATCH",
          body: { alert_sent_at: at, updated_at: at },
          prefer: "return=representation",
        });
        return Array.isArray(value) && value.length === 1;
      });
    },
    releaseDailyJobAlert(id, at) {
      return guarded(async () => {
        if (!Number.isSafeInteger(id) || id <= 0 || !Number.isFinite(Date.parse(at))) throw new Error("OPS_INVALID_ID");
        const value = await request(`ops_daily_job_status?id=eq.${id}&alert_sent_at=eq.${encodeURIComponent(at)}`, {
          method: "PATCH",
          body: { alert_sent_at: null },
          prefer: "return=representation",
        });
        return Array.isArray(value) && value.length === 1;
      });
    },
    applyRunLogRetention(input = {}) {
      return guarded(async () => {
        const keepDays = input.keepDays ?? RUN_LOG_RETENTION_DAYS;
        if (!Number.isInteger(keepDays) || keepDays < RUN_LOG_RETENTION_DAYS) throw new Error("OPS_RETENTION_TOO_SHORT");
        const value = await request("rpc/ops_apply_run_log_retention", {
          method: "POST",
          body: { p_now: input.now ?? new Date().toISOString(), p_keep_days: keepDays },
        });
        return retentionResultSchema.parse(value);
      });
    },
  };
}

let cached: { signature: string; store: OpsTelemetryStore } | null = null;

export function getOpsTelemetryStore(variables: Variables = process.env, fetchImpl?: FetchLike): OpsTelemetryStore {
  const config = readSupabaseConfig(variables);
  // Hostinger Admin lanes always set CCPUN_APP_ENV explicitly; anything else stays disabled (fail closed).
  const lane = opsLaneForEnvironment(variables.CCPUN_APP_ENV?.trim());
  if (!config || !lane) return disabledOpsTelemetryStore;
  if (fetchImpl) return createSupabaseOpsTelemetryStore({ ...config, lane, fetch: fetchImpl });
  // One store per process keeps the lane check cached between page renders.
  const signature = `${config.url}|${lane}|${config.key}`;
  if (cached?.signature !== signature) cached = { signature, store: createSupabaseOpsTelemetryStore({ ...config, lane }) };
  return cached.store;
}
