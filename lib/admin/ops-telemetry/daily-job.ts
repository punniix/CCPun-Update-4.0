import "server-only";
import {
  DAILY_JOB_KEY,
  DAILY_JOB_N8N_EXECUTION_TIMEOUT_SECONDS,
  DAILY_JOB_STUCK_AFTER_MINUTES,
  OPS_ALERT_CLAIM_TTL_SECONDS,
  bangkokDate,
  dailyJobScheduledForLane,
  dailyJobStepLabel,
  deriveDailyJobHealth,
  type DailyJobHealth,
  type OpsAlertKind,
  type OpsLane,
} from "./contracts";
import { getOpsTelemetryStore, type OpsTelemetryStore } from "./store";
import { getOwnerNotifier, type NotificationAdapter, type OwnerNotification } from "../notifications/notifier";

// Reads the 06:00 job status from Supabase only. It never queries Neon, so the
// Admin-wide banner does not wake Neon compute on every page view. Pages that
// already read the Neon analytics status can use deriveDailyJobHealthFromAnalytics.
export async function readDailyJobHealth(store: OpsTelemetryStore = getOpsTelemetryStore(), now: Date | string | number = Date.now()): Promise<DailyJobHealth> {
  try {
    const latest = await store.readLatestDailyJob();
    if (latest.state !== "ready") return { state: "unknown", source: "none", runDate: null, failedSteps: [], job: null, storeState: latest.state };
    // The lane check is cached per store, so this adds no request. Only a
    // scheduled lane (Production) can report a missing run; UAT has no 06:00 schedule.
    const { lane } = await store.status();
    return { ...deriveDailyJobHealth(latest.value, now, { scheduled: dailyJobScheduledForLane(lane) }), storeState: "ready" };
  } catch {
    return { state: "unknown", source: "none", runDate: null, failedSteps: [], job: null, storeState: "unavailable" };
  }
}

const ALERT_KIND_BY_STATE: Partial<Record<DailyJobHealth["state"], OpsAlertKind>> = {
  failed: "daily-job-failed",
  stuck: "daily-job-stuck",
  missing: "daily-job-missing",
};

/**
 * One owner alert per event, identified by a lane-scoped reference that is
 * also the relay idempotency key: failed/stuck once per status row, missing
 * once per Bangkok day. No personal data.
 */
export function dailyJobAlert(health: DailyJobHealth, lane: OpsLane, adminOrigin: string | null, now: Date | string | number = Date.now()): OwnerNotification | null {
  const kind = health.source === "supabase" ? ALERT_KIND_BY_STATE[health.state] : undefined;
  if (!kind) return null;
  const link = adminOrigin ? `${adminOrigin}/analytics/` : "ศูนย์จัดการ CCPun → การตลาดและข้อมูล";
  const footer = "อีเมลนี้ส่งครั้งเดียวต่อหนึ่งเหตุการณ์ และไม่มีข้อมูลลูกค้า";
  if (kind === "daily-job-missing") {
    const today = bangkokDate(now);
    return {
      kind,
      subject: `CCPun: ยังไม่พบรอบเก็บข้อมูล 06:00 วันที่ ${today}`,
      text: [`ถึงเวลาตรวจแล้วแต่ยังไม่พบรอบเก็บข้อมูลอัตโนมัติ 06:00 ของวันที่ ${today}`, "อาจเป็นเพราะ n8n ไม่ได้เริ่มงาน หรือเริ่มแล้วแต่บันทึกสถานะไม่สำเร็จ", `เปิดรายงานและกด "ดึงใหม่ตอนนี้" ได้ที่: ${link}`, footer].join("\n"),
      reference: `${lane}:${DAILY_JOB_KEY}:missing:${today}`,
    };
  }
  const job = health.job;
  if (!job) return null;
  if (kind === "daily-job-failed") {
    const steps = health.failedSteps.length ? health.failedSteps.map(dailyJobStepLabel).join(", ") : "ไม่ระบุขั้นตอน";
    return {
      kind,
      subject: `CCPun: รอบเก็บข้อมูล 06:00 วันที่ ${job.runDate} ไม่สำเร็จ`,
      text: [`รอบเก็บข้อมูลอัตโนมัติ 06:00 ของวันที่ ${job.runDate} ไม่สำเร็จ`, `ขั้นตอนที่มีปัญหา: ${steps}`, `เปิดรายงานและกด "ดึงใหม่ตอนนี้" ได้ที่: ${link}`, footer].join("\n"),
      reference: `${lane}:${DAILY_JOB_KEY}:failed:${job.id}`,
    };
  }
  return {
    kind,
    subject: `CCPun: รอบเก็บข้อมูล 06:00 วันที่ ${job.runDate} ค้างเกินเวลา`,
    text: [
      `รอบเก็บข้อมูลของวันที่ ${job.runDate} เริ่มแล้วแต่สถานะยังไม่จบหลังผ่านไป ${DAILY_JOB_STUCK_AFTER_MINUTES} นาที (n8n หยุดงานเองที่ ${DAILY_JOB_N8N_EXECUTION_TIMEOUT_SECONDS / 60} นาที)`,
      `ตรวจ execution ใน n8n แล้วกด "ดึงใหม่ตอนนี้" ได้ที่: ${link}`,
      footer,
    ].join("\n"),
    reference: `${lane}:${DAILY_JOB_KEY}:stuck:${job.id}`,
  };
}

export type DailyJobAlertOutcome =
  | { outcome: "not-needed" }
  | { outcome: "email-disabled" | "email-invalid-config" | "store-unavailable" | "claim-held" | "already-accepted" | "relay-rejected" | "relay-unconfirmed"; reference: string }
  | { outcome: "relay-accepted"; reference: string; recorded: boolean };

/**
 * Sends the owner alert for a failed, stuck or missing 06:00 run at most once
 * per event. Both callers (the Admin page-render fallback and the scheduled
 * check in daily-job-check.ts) go through the same Supabase claim:
 *  1. claim the reference for OPS_ALERT_CLAIM_TTL_SECONDS (database clock);
 *  2. POST it to the relay with the reference as idempotency key;
 *  3. on 2xx mark it "accepted" (relay accepted, not "email delivered").
 * Nothing is released on failure: a crash, a rejection or an unconfirmed send
 * leaves the claim pending, and the next caller after expiry re-sends the same
 * reference, which the relay de-duplicates. Email is disabled by default and a
 * disabled notifier never claims anything.
 */
export async function dispatchDailyJobAlert(
  health: DailyJobHealth,
  options: { store?: OpsTelemetryStore; notifier?: NotificationAdapter; adminOrigin?: string | null; now?: Date | string | number } = {},
): Promise<DailyJobAlertOutcome> {
  if (health.storeState !== "ready" || health.source !== "supabase" || !ALERT_KIND_BY_STATE[health.state]) return { outcome: "not-needed" };
  const store = options.store ?? getOpsTelemetryStore();
  const { lane, state } = await store.status();
  if (state !== "ready" || !lane) return { outcome: "not-needed" };
  const message = dailyJobAlert(health, lane, options.adminOrigin ?? null, options.now ?? Date.now());
  if (!message) return { outcome: "not-needed" };
  const notifier = options.notifier ?? getOwnerNotifier();
  if (notifier.channel === "disabled") {
    const result = await notifier.send(message);
    return { outcome: !result.accepted && result.reason === "invalid-config" ? "email-invalid-config" : "email-disabled", reference: message.reference };
  }
  const claim = await store.claimAlert({ reference: message.reference, kind: message.kind, ttlSeconds: OPS_ALERT_CLAIM_TTL_SECONDS });
  if (claim.state !== "ready") return { outcome: "store-unavailable", reference: message.reference };
  if (!claim.value.claimed) return { outcome: claim.value.state === "pending" ? "claim-held" : "already-accepted", reference: message.reference };
  const result = await notifier.send(message);
  if (!result.accepted) return { outcome: result.reason === "relay-rejected" ? "relay-rejected" : "relay-unconfirmed", reference: message.reference };
  const marked = await store.markAlertRelayAccepted(message.reference).catch(() => null);
  return { outcome: "relay-accepted", reference: message.reference, recorded: marked?.state === "ready" && marked.value };
}
