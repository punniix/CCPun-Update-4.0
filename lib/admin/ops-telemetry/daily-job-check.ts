import "server-only";
import { type DailyJobHealth, type OpsLane, type OpsStoreState } from "./contracts";
import { dispatchDailyJobAlert, readDailyJobHealth, type DailyJobAlertOutcome } from "./daily-job";
import { getOpsTelemetryStore, type OpsTelemetryStore } from "./store";
import { type NotificationAdapter } from "../notifications/notifier";

// Missed/failed-run check that does not depend on anyone opening Admin.
// scripts/admin-daily-job-check.ts runs it from a timer outside the Admin
// process (VPS cron/systemd timer, or an n8n Execute Command node). It reads the
// same Supabase row as the banner and uses the same alert claim, so the page
// render fallback and this check never both send the same alert.
//
// It cannot prove n8n itself is up when n8n is the thing running it: a check
// scheduled inside n8n stops together with n8n. A whole-n8n (or whole-VPS)
// outage needs a timer outside n8n plus an external heartbeat monitor.

export type DailyJobCheckReport = {
  lane: OpsLane | null;
  storeState: OpsStoreState;
  state: DailyJobHealth["state"];
  runDate: string | null;
  alert: DailyJobAlertOutcome;
  // 0 healthy or alert handled; 1 the check could not read the job status;
  // 2 the job needs attention and no alert has been relay-accepted for it.
  exitCode: 0 | 1 | 2;
};

const UNHEALTHY: ReadonlySet<DailyJobHealth["state"]> = new Set(["failed", "stuck", "missing"]);

export async function runDailyJobCheck(options: {
  store?: OpsTelemetryStore;
  notifier?: NotificationAdapter;
  adminOrigin?: string | null;
  now?: Date | string | number;
  dispatch?: boolean;
} = {}): Promise<DailyJobCheckReport> {
  const store = options.store ?? getOpsTelemetryStore();
  const now = options.now ?? Date.now();
  const health = await readDailyJobHealth(store, now);
  const { lane } = await store.status().catch(() => ({ lane: null }));
  const alert: DailyJobAlertOutcome = options.dispatch === false
    ? { outcome: "not-needed" }
    : await dispatchDailyJobAlert(health, { store, notifier: options.notifier, adminOrigin: options.adminOrigin ?? null, now }).catch(() => ({ outcome: "store-unavailable" as const, reference: "" }));
  const handled = alert.outcome === "relay-accepted" || alert.outcome === "already-accepted" || alert.outcome === "claim-held";
  const exitCode = health.storeState !== "ready" ? 1 : UNHEALTHY.has(health.state) && !handled ? 2 : 0;
  return { lane, storeState: health.storeState, state: health.state, runDate: health.runDate, alert, exitCode };
}
