import "server-only";
import { dailyJobStepLabel, deriveDailyJobHealth, type DailyJobHealth } from "./contracts";
import { getOpsTelemetryStore, type OpsTelemetryStore } from "./store";
import { getOwnerNotifier, type NotificationAdapter, type NotifyResult } from "../notifications/notifier";

// Reads the 06:00 job status from Supabase only. It never queries Neon, so the
// Admin-wide banner does not wake Neon compute on every page view. Pages that
// already read the Neon analytics status can use deriveDailyJobHealthFromAnalytics.
export async function readDailyJobHealth(store: OpsTelemetryStore = getOpsTelemetryStore(), now: Date | string | number = Date.now()): Promise<DailyJobHealth> {
  try {
    const latest = await store.readLatestDailyJob();
    if (latest.state !== "ready") return { state: "unknown", source: "none", runDate: null, failedSteps: [], job: null, storeState: latest.state };
    return { ...deriveDailyJobHealth(latest.value, now), storeState: "ready" };
  } catch {
    return { state: "unknown", source: "none", runDate: null, failedSteps: [], job: null, storeState: "unavailable" };
  }
}

export function dailyJobFailureEmail(health: DailyJobHealth, adminOrigin: string | null) {
  const steps = health.failedSteps.length ? health.failedSteps.map(dailyJobStepLabel).join(", ") : "ไม่ระบุขั้นตอน";
  const link = adminOrigin ? `${adminOrigin}/analytics/` : "ศูนย์จัดการ CCPun → การตลาดและข้อมูล";
  return {
    kind: "daily-job-failed" as const,
    subject: `CCPun: รอบเก็บข้อมูล 06:00 วันที่ ${health.runDate ?? "-"} ไม่สำเร็จ`,
    text: [
      `รอบเก็บข้อมูลอัตโนมัติ 06:00 ของวันที่ ${health.runDate ?? "-"} ไม่สำเร็จ`,
      `ขั้นตอนที่มีปัญหา: ${steps}`,
      `เปิดรายงานและกด "ดึงใหม่ตอนนี้" ได้ที่: ${link}`,
      "อีเมลนี้ส่งครั้งเดียวต่อหนึ่งรอบ และไม่มีข้อมูลลูกค้า",
    ].join("\n"),
    reference: `daily-0600:${health.job?.executionId ?? health.runDate ?? "unknown"}`,
  };
}

/**
 * Sends the failure email at most once per failed run: the Supabase row is
 * claimed atomically first, and released again if delivery fails. Email is
 * disabled by default; without Supabase nothing is claimed and nothing is sent.
 */
export async function dispatchDailyJobFailureAlert(
  health: DailyJobHealth,
  options: { store?: OpsTelemetryStore; notifier?: NotificationAdapter; adminOrigin?: string | null } = {},
): Promise<NotifyResult | { delivered: false; reason: "not-needed" | "already-sent" | "store-unavailable" }> {
  const job = health.job;
  if (health.state !== "failed" || health.source !== "supabase" || !job) return { delivered: false, reason: "not-needed" };
  if (job.alertSentAt) return { delivered: false, reason: "already-sent" };
  const notifier = options.notifier ?? getOwnerNotifier();
  if (notifier.channel === "disabled") return notifier.send(dailyJobFailureEmail(health, null));
  const store = options.store ?? getOpsTelemetryStore();
  const at = new Date().toISOString();
  const claim = await store.claimDailyJobAlert(job.id, at);
  if (claim.state !== "ready") return { delivered: false, reason: "store-unavailable" };
  if (!claim.value) return { delivered: false, reason: "already-sent" };
  const result = await notifier.send(dailyJobFailureEmail(health, options.adminOrigin ?? null));
  if (!result.delivered) await store.releaseDailyJobAlert(job.id, at).catch(() => null);
  return result;
}
