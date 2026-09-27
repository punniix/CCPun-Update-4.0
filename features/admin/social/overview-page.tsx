import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SocialReviewAttention from "@/features/admin/social/SocialReviewAttention";
import { requireAdminPermission } from "@/lib/admin/require-permission";
import { getSocialAnalyticsIngestionRuntimeStatus } from "@/lib/admin/social/analytics-ingestion";
import { getSocialOperationsRuntimeStatus } from "@/lib/admin/social/operations";
import { listSocialOperationalItems } from "@/lib/admin/social/operations-service";
import { isSocialProviderExecutionGateEnabled } from "@/lib/admin/social/publishing";
import { getSocialProviderReadiness } from "@/lib/admin/social/provider-readonly";

export const metadata: Metadata = { title: "ภาพรวมโซเชียล" };

const bangkokDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const bangkokDateTime = new Intl.DateTimeFormat("th-TH", {
  timeZone: "Asia/Bangkok",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function dateKey(value: Date | string) {
  const parts = bangkokDate.formatToParts(typeof value === "string" ? new Date(value) : value);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    queued: "รอส่ง",
    processing: "กำลังส่ง",
    "native-scheduled": "ตั้งเวลาที่แพลตฟอร์มแล้ว",
    failed: "ไม่สำเร็จ",
    retryable: "รอลองใหม่",
    "retry-exhausted": "ลองครบแล้ว ต้องตรวจ",
    "needs-reconciliation": "สถานะยังไม่ชัด ต้องตรวจอีกครั้ง",
    cancelled: "ยกเลิกแล้ว",
    published: "เผยแพร่แล้ว",
  };
  return labels[status] ?? status;
}

export default async function SocialOverviewPage() {
  await requireAdminPermission("social:read");
  const runtime = getSocialOperationsRuntimeStatus();
  if (!runtime.enabled) notFound();

  const now = new Date();
  let operations: Awaited<ReturnType<typeof listSocialOperationalItems>> = [];
  let operationStoreAvailable = true;
  try {
    operations = await listSocialOperationalItems({ limit: 120, now });
  } catch {
    operationStoreAvailable = false;
  }

  const today = dateKey(now);
  const scheduledToday = operations.filter((item) => item.scheduledAt
    && dateKey(item.scheduledAt) === today
    && !["cancelled", "published"].includes(item.status));
  const attention = operations.filter((item) => ["failed", "retryable", "retry-exhausted", "needs-reconciliation"].includes(item.status));
  const queued = operations.filter((item) => item.status === "queued").length;
  const processing = operations.filter((item) => item.status === "processing").length;
  const upcoming = operations
    .filter((item) => item.scheduledAt && Date.parse(item.scheduledAt) > now.getTime() && !["cancelled", "published"].includes(item.status))
    .sort((a, b) => Date.parse(a.scheduledAt!) - Date.parse(b.scheduledAt!))
    .slice(0, 5);
  const recentFailures = [...attention]
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, 4);

  const metaReadiness = getSocialProviderReadiness("meta");
  const providerWriteEnabled = isSocialProviderExecutionGateEnabled();
  const analyticsEnabled = getSocialAnalyticsIngestionRuntimeStatus().enabled;
  const connectionIssues = metaReadiness.required.filter((item) => !item.valid).length;

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">โซเชียล</p>
      <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">ภาพรวมโซเชียล</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">
            เริ่มตรวจโพสต์ จัดเวลา ติดตามการส่ง และดูความพร้อมของบัญชีที่เชื่อมต่อได้จากที่นี่
          </p>
        </div>
        <Link href="/analytics/social/" className="inline-flex min-h-11 items-center rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/70 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[#e0c985]">
          ดูผลลัพธ์โซเชียล
        </Link>
      </div>

      {!operationStoreAvailable ? (
        <section role="status" className="mt-6 rounded-2xl border border-amber-200/20 bg-amber-200/[0.05] px-4 py-3 text-sm leading-6 text-amber-50/85">
          ตอนนี้ยังอ่านรายการส่งโพสต์ไม่ได้ ระบบจึงไม่ใช้ฉบับร่างมาเดาสถานะแทน
        </section>
      ) : null}

      <section aria-label="สรุปงานโซเชียล" className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Link href="/social/calendar/" className="group rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition motion-reduce:transition-none hover:border-[#e0c985]/35 hover:bg-white/[0.045] focus:outline-none focus:ring-2 focus:ring-[#e0c985]">
          <div className="text-xs text-white/45">โพสต์ที่ตั้งไว้วันนี้</div>
          <div className="mt-2 text-2xl font-semibold">{operationStoreAvailable ? scheduledToday.length.toLocaleString("th-TH") : "—"}</div>
          <p className="mt-2 text-xs leading-5 text-white/55">เวลาไทย · เปิดปฏิทินเพื่อจัดเวลา</p>
          <span className="mt-3 inline-flex text-xs font-medium text-[#f4df9b] group-hover:underline">เปิดปฏิทิน →</span>
        </Link>

        <SocialReviewAttention />

        <Link href="/social/queue/" className="group rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition motion-reduce:transition-none hover:border-amber-200/30 hover:bg-amber-200/[0.035] focus:outline-none focus:ring-2 focus:ring-[#e0c985]">
          <div className="text-xs text-white/45">รายการที่ต้องตรวจ</div>
          <div className="mt-2 text-2xl font-semibold">{operationStoreAvailable ? attention.length.toLocaleString("th-TH") : "—"}</div>
          <p className="mt-2 text-xs leading-5 text-white/55">รวมรายการที่ไม่สำเร็จ ลองครบแล้ว หรือสถานะยังไม่ชัด</p>
          <span className="mt-3 inline-flex text-xs font-medium text-[#f4df9b] group-hover:underline">ตรวจคิวส่งโพสต์ →</span>
        </Link>

        <Link href="/social/accounts/" className="group rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition motion-reduce:transition-none hover:border-[#e0c985]/35 hover:bg-white/[0.045] focus:outline-none focus:ring-2 focus:ring-[#e0c985]">
          <div className="text-xs text-white/45">การเชื่อมต่อที่ต้องตรวจ</div>
          <div className="mt-2 text-2xl font-semibold">{connectionIssues.toLocaleString("th-TH")}</div>
          <p className="mt-2 text-xs leading-5 text-white/55">รายการตรวจความพร้อมของ Meta ที่ยังไม่ผ่าน</p>
          <span className="mt-3 inline-flex text-xs font-medium text-[#f4df9b] group-hover:underline">ตรวจการเชื่อมต่อ →</span>
        </Link>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-3xl border border-white/10 bg-white/[0.025] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">โพสต์ที่กำลังจะมาถึง</h2>
              <p className="mt-1 text-xs text-white/45">เรียงตามเวลาไทย</p>
            </div>
            <Link href="/social/calendar/" className="min-h-11 rounded-xl px-3 py-2.5 text-xs text-[#f4df9b] hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[#e0c985]">ดูทั้งหมด</Link>
          </div>
          <div className="mt-4 space-y-2">
            {upcoming.map((item) => (
              <Link key={item.publicationId} href="/social/calendar/" className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-white/[0.08] px-3 py-2.5 hover:bg-white/[0.03] focus:outline-none focus:ring-2 focus:ring-[#e0c985]">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-white/85">{item.title}</div>
                  <div className="mt-1 text-xs text-white/45">{item.platform} · {statusLabel(item.status)}</div>
                </div>
                <time className="shrink-0 text-xs text-white/55">{item.scheduledAt ? bangkokDateTime.format(new Date(item.scheduledAt)) : "—"}</time>
              </Link>
            ))}
            {operationStoreAvailable && upcoming.length === 0 ? <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-white/50">ยังไม่มีโพสต์ที่ตั้งเวลาไว้</p> : null}
          </div>
        </article>

        <article className="rounded-3xl border border-white/10 bg-white/[0.025] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">สถานะคิวส่งโพสต์</h2>
              <p className="mt-1 text-xs text-white/45">แสดงขั้นตอนการส่ง ไม่ใช่ผลตอบรับของผู้ชม</p>
            </div>
            <Link href="/social/queue/" className="min-h-11 rounded-xl px-3 py-2.5 text-xs text-[#f4df9b] hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[#e0c985]">เปิดคิว</Link>
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-2">
            {[["รอส่ง", queued], ["กำลังส่ง", processing], ["ต้องตรวจ", attention.length]].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border border-white/[0.08] p-3">
                <dt className="text-[11px] text-white/40">{label}</dt>
                <dd className="mt-1 text-xl font-semibold text-white/85">{operationStoreAvailable ? Number(value).toLocaleString("th-TH") : "—"}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 space-y-2">
            {recentFailures.map((item) => (
              <div key={item.publicationId} className="rounded-xl border border-amber-200/10 bg-amber-200/[0.025] px-3 py-2.5">
                <div className="truncate text-sm text-white/80">{item.title}</div>
                <div className="mt-1 text-xs text-amber-50/60">{statusLabel(item.status)}{item.lastErrorCategory ? " · มีรายละเอียดปัญหา" : ""}</div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <article className="rounded-3xl border border-white/10 bg-white/[0.025] p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">ความพร้อมของบัญชีที่เชื่อมต่อ</h2>
            <Link href="/social/accounts/" className="min-h-11 rounded-xl px-3 py-2.5 text-xs text-[#f4df9b] hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[#e0c985]">ดูการเชื่อมต่อ</Link>
          </div>
          <dl className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-white/[0.08] p-3"><dt className="text-xs text-white/40">อ่านข้อมูลจาก Meta</dt><dd className="mt-1 text-sm text-white/80">{metaReadiness.status === "manual-sync-ready" ? "เชื่อมต่อและพร้อม" : "ต้องตั้งค่าเพิ่ม"}</dd></div>
            <div className="rounded-xl border border-white/[0.08] p-3"><dt className="text-xs text-white/40">ส่งโพสต์</dt><dd className="mt-1 text-sm text-white/80">{providerWriteEnabled ? "ใช้ได้หลังผู้มีสิทธิ์อนุมัติ" : "ปิดอยู่"}</dd></div>
            <div className="rounded-xl border border-white/[0.08] p-3"><dt className="text-xs text-white/40">เก็บผลลัพธ์</dt><dd className="mt-1 text-sm text-white/80">{analyticsEnabled ? "พร้อม" : "ปิดอยู่"}</dd></div>
            <div className="rounded-xl border border-white/[0.08] p-3"><dt className="text-xs text-white/40">งานอัตโนมัติ</dt><dd className="mt-1 text-sm text-white/80">ส่งได้เฉพาะข้อความหรือลิงก์ที่อนุมัติแล้ว ส่วนสื่อยังทำด้วยตนเอง</dd></div>
          </dl>
        </article>

        <article className="rounded-3xl border border-white/10 bg-white/[0.025] p-5">
          <h2 className="text-lg font-semibold">ทางลัด</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {[
              ["/social/posts/", "ตรวจและอนุมัติโพสต์"],
              ["/social/calendar/", "ตั้งหรือเปลี่ยนเวลา"],
              ["/social/queue/", "ดูคิวส่งโพสต์"],
              ["/social/accounts/", "ตรวจการเชื่อมต่อ"],
            ].map(([href, label]) => (
              <Link key={href} href={href} className="inline-flex min-h-11 items-center rounded-xl border border-white/[0.08] px-3 text-sm text-white/70 hover:bg-white/[0.04] hover:text-white focus:outline-none focus:ring-2 focus:ring-[#e0c985]">{label}</Link>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
