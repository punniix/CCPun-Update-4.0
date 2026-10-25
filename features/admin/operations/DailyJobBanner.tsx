import Link from "next/link";
import { dailyJobStepLabel, type DailyJobHealth } from "@/lib/admin/ops-telemetry/contracts";
import { dispatchDailyJobFailureAlert, readDailyJobHealth } from "@/lib/admin/ops-telemetry/daily-job";

function adminOrigin(): string | null {
  try { return process.env.AUTH_URL ? new URL(process.env.AUTH_URL).origin : null; } catch { return null; }
}

// Presentational banner shared by the Admin-wide slot and pages that already
// hold a DailyJobHealth (for example the morning report with the Neon fallback).
export function DailyJobBannerView({ health }: { health: Pick<DailyJobHealth, "state" | "runDate" | "failedSteps"> }) {
  if (health.state !== "failed" && health.state !== "missing") return null;
  const steps = health.failedSteps.map(dailyJobStepLabel).join(", ");
  return (
    <div role="alert" className="mb-5 rounded-2xl border border-amber-200/20 bg-amber-200/10 p-4 text-sm leading-6 text-amber-50" data-daily-job-banner={health.state}>
      <p className="font-semibold">
        {health.state === "failed"
          ? `รอบเก็บข้อมูล 06:00${health.runDate ? ` วันที่ ${health.runDate}` : ""} ไม่สำเร็จ`
          : "ยังไม่พบรอบเก็บข้อมูล 06:00 ของวันนี้"}
      </p>
      <p className="mt-1 text-amber-50/85">
        {health.state === "failed" && steps ? `ขั้นตอนที่มีปัญหา: ${steps} · ` : ""}
        ตัวเลขที่บันทึกสำเร็จครั้งก่อนยังใช้ได้ กด “ดึงใหม่ตอนนี้” ในรายงานเช้านี้เพื่อลองอีกครั้ง
      </p>
      <Link href="/analytics/" className="mt-2 inline-flex min-h-11 items-center font-medium underline underline-offset-4">เปิดรายงานเช้านี้</Link>
    </div>
  );
}

// Admin-wide slot: reads Supabase only (never Neon) and sends the one-time
// failure email when an email adapter is configured. Never throws.
export default async function DailyJobBanner() {
  const health = await readDailyJobHealth().catch(() => null);
  if (!health) return null;
  if (health.state === "failed") await dispatchDailyJobFailureAlert(health, { adminOrigin: adminOrigin() }).catch(() => null);
  return <DailyJobBannerView health={health} />;
}
