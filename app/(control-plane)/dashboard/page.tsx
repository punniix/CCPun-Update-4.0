import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireAdminPermission } from "@/lib/admin/require-permission";
import { adminDataLaneLabel, environmentLabel } from "@/lib/admin/presentation";
import { isStudioDataPlaneAllowed } from "@/lib/admin/environment";
import { getAdminOperationsRuntimeStatus } from "@/lib/admin/operations/foundation";
import { readArticleSchedulerModel } from "@/lib/admin/operations/article-scheduler-read-model";
import { getAdminSanityStatus, listAdminArticles, listSeoSuggestions } from "@/lib/admin/sanity-control";

export const metadata: Metadata = { title: "เริ่มที่นี่" };

type DashboardProps = { searchParams: Promise<{ error?: string }> };

function Metric({ label, value, tone = "default" }: { label: string; value: string | number; tone?: "default" | "good" | "warning" }) {
  return <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3 sm:p-4"><p className="text-[10px] text-white/40 sm:text-xs">{label}</p><p className={`mt-1.5 text-lg font-semibold sm:text-xl ${tone === "good" ? "text-emerald-200" : tone === "warning" ? "text-amber-100" : "text-white/90"}`}>{value}</p></div>;
}

function TaskRow({ href, title, meta, badge, tone = "default" }: { href: string; title: string; meta: string; badge?: string; tone?: "default" | "gold" }) {
  return <Link href={href} className="flex min-h-16 items-center gap-3 border-t border-white/[0.055] px-3.5 py-3 first:border-t-0 hover:bg-white/[0.025] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#e0c985] sm:px-4">
    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone === "gold" ? "bg-[#e0c985]" : "bg-white/30"}`} aria-hidden="true" />
    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-white/88">{title}</span><span className="mt-0.5 block truncate text-[11px] text-white/40">{meta}</span></span>
    {badge ? <span className={`hidden shrink-0 rounded-full border px-2.5 py-1 text-[10px] sm:inline-flex ${tone === "gold" ? "border-[#e0c985]/25 bg-[#e0c985]/[0.06] text-[#f4df9b]" : "border-white/10 text-white/45"}`}>{badge}</span> : null}
    <ChevronRight className="h-4 w-4 shrink-0 text-white/25 sm:hidden" aria-hidden="true" />
  </Link>;
}

export default async function AdminDashboardPage({ searchParams }: DashboardProps) {
  await requireAdminPermission("dashboard:read");
  const params = await searchParams;
  const status = getAdminSanityStatus();
  const operations = getAdminOperationsRuntimeStatus();
  const [reviews, articles, scheduler] = await Promise.all([
    listSeoSuggestions(),
    listAdminArticles(),
    readArticleSchedulerModel({ scheduleLimit: 100, auditLimit: 1 }),
  ]);

  const pendingReviews = reviews.error ? null : reviews.rows.filter((item) => item.status === "needs-human-review").length;
  const scheduled = scheduler.status === "ready" ? scheduler.schedules.filter((item) => ["preparing", "scheduled", "executing"].includes(item.status)).length : null;
  const approvedDrafts = articles.error ? null : articles.rows.filter((item) => item.isDraft && item.reviewStatus === "approved").length;
  const lane = adminDataLaneLabel(status.environment);
  const studioReady = isStudioDataPlaneAllowed(status.dataset ?? undefined);
  const systemHealthy = operations.identityValid && scheduler.status === "ready" && scheduler.effectiveEnabled;
  const nextScheduled = scheduler.status === "ready"
    ? scheduler.schedules.filter((item) => item.status === "scheduled").sort((a, b) => Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at))[0] ?? null
    : null;

  const steps = [
    ["1", "เลือกหรือสร้างบทความ", "/content/articles/", `เลือกบทความจาก ${lane} หรือสร้างฉบับร่างใหม่`],
    ["2", "ตรวจ SEO", "/seo/", "ดูผลตรวจที่บันทึกไว้และเหตุผลจากกฎที่อธิบายได้"],
    ["3", "ตรวจข้อเสนอ", "/dashboard/inbox/", "คุณเป็นคนตัดสินใจว่าจะอนุมัติหรือไม่"],
    ["4", "นำไปใช้กับฉบับร่าง", "/dashboard/inbox/", `แก้เฉพาะฉบับร่าง ${lane} และไม่เผยแพร่`],
    ["5", "Preview / Publish / Schedule", "/studio/", studioReady ? "ตรวจหน้าจริงใน Studio แล้วเลือก Publish หรือ Schedule เอง" : "Studio ปิดอยู่ในโหมดอ่านอย่างเดียว"],
  ] as const;

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.12em] text-[#e0c985] sm:text-xs">OWNER OVERVIEW</p>
          <h1 className="mt-1.5 text-[28px] font-semibold leading-[1.12] tracking-[-0.02em] sm:text-3xl">วันนี้ต้องจัดการอะไร?</h1>
          <p className="mt-1.5 max-w-2xl text-xs leading-5 text-white/45 sm:text-sm">เห็นเฉพาะงานที่ต้องตัดสินใจก่อน รายละเอียดระบบเปิดดูเมื่อจำเป็น</p>
        </div>
        <Link href="/dashboard/inbox/" className="hidden min-h-10 items-center rounded-xl bg-[#e0c985] px-4 py-2 text-sm font-semibold text-[#251818] hover:bg-[#ebd9a2] sm:inline-flex">เปิด Inbox</Link>
      </div>

      {params.error === "forbidden" ? <div role="alert" className="mt-4 rounded-xl border border-amber-200/20 bg-amber-200/[0.07] p-3 text-sm text-amber-50">บัญชีของคุณเปิดหน้านั้นไม่ได้ตามสิทธิ์ที่ได้รับ</div> : null}

      <section aria-label="ภาพรวมสถานะ" className="mt-4 grid grid-cols-3 gap-2 sm:mt-5 sm:grid-cols-4 sm:gap-3">
        <Metric label="Attention" value={pendingReviews == null ? "—" : pendingReviews} tone={pendingReviews && pendingReviews > 0 ? "warning" : "default"} />
        <Metric label="Scheduled" value={scheduled == null ? "—" : scheduled} />
        <Metric label="System" value={systemHealthy ? "Healthy" : "Check"} tone={systemHealthy ? "good" : "warning"} />
        <div className="hidden sm:block"><Metric label="Drafts ready" value={approvedDrafts == null ? "—" : approvedDrafts} /></div>
      </section>

      <section className="mt-3 overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02] sm:mt-4" aria-labelledby="attention-heading">
        <div className="flex items-center justify-between px-3.5 py-3 sm:px-4"><h2 id="attention-heading" className="text-sm font-semibold">Needs attention</h2><span className="text-[10px] text-white/35">{pendingReviews == null ? "อ่านไม่ได้" : `${pendingReviews} รายการรอตรวจ`}</span></div>
        <TaskRow href="/dashboard/inbox/" title={pendingReviews == null ? "Review inbox อ่านไม่ได้" : pendingReviews ? `${pendingReviews} ข้อเสนอรอการตัดสินใจ` : "Review inbox ไม่มีงานค้าง"} meta="Content review · คุณเป็นผู้ตัดสินใจ" badge={pendingReviews ? "Review" : "Healthy"} tone={pendingReviews ? "gold" : "default"} />
        {nextScheduled ? <TaskRow href="/content/calendar/" title={`Schedule ถัดไป · ${new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(nextScheduled.scheduled_at))}`} meta={nextScheduled.article_id} badge="Scheduled" tone="gold" /> : <TaskRow href="/content/calendar/" title="ยังไม่มี Schedule ที่กำลังรอ" meta="Content Calendar" badge="Calendar" />}
        <TaskRow href="/operations/health/" title={systemHealthy ? "Control Plane ทำงานปกติ" : "Control Plane ต้องตรวจสถานะ"} meta="Runtime · Database · Scheduler" badge={systemHealthy ? "Healthy" : "Check"} />
      </section>

      <section className="mt-3 overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02] sm:mt-4" aria-labelledby="quick-heading">
        <div className="px-3.5 py-3 sm:px-4"><h2 id="quick-heading" className="text-sm font-semibold">Quick access</h2></div>
        <TaskRow href="/content/articles/" title="Articles" meta="Draft · Live · Review" />
        <TaskRow href="/content/calendar/" title="Content Calendar" meta="ตั้งเวลา · เลื่อนเวลา · ยกเลิก Schedule" />
        <TaskRow href="/seo/opportunities/" title="Growth" meta="SEO opportunities · Search analytics" />
      </section>

      <details className="mt-4 rounded-2xl border border-white/[0.07] bg-white/[0.018] open:bg-white/[0.025]">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-white/60 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#e0c985]">รายละเอียดระบบและขอบเขตความปลอดภัย</summary>
        <div className="border-t border-white/[0.06] px-4 py-4 text-sm leading-6 text-white/55">
          <p>พื้นที่นี้ทำงานใน <strong className="font-medium text-white/80">{lane}</strong> เท่านั้น และจะหยุดเองหาก project หรือ dataset ไม่ตรง environment</p>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-white/[0.06] p-3"><dt className="text-xs text-white/35">Sanity dataset</dt><dd className="mt-1 text-white/75">{status.dataset ?? "ไม่ได้ตั้งค่า"}</dd></div>
            <div className="rounded-xl border border-white/[0.06] p-3"><dt className="text-xs text-white/35">Environment</dt><dd className="mt-1 text-white/75">{environmentLabel(status.environment)}</dd></div>
            <div className="rounded-xl border border-white/[0.06] p-3"><dt className="text-xs text-white/35">Operations DB</dt><dd className="mt-1 text-white/75">{operations.identityValid ? "Identity verified" : "Check identity"}</dd></div>
            <div className="rounded-xl border border-white/[0.06] p-3"><dt className="text-xs text-white/35">Scheduler</dt><dd className="mt-1 text-white/75">{scheduler.effectiveEnabled ? "Ready" : "Not ready"}</dd></div>
          </dl>
        </div>
      </details>

      <details className="mt-2 rounded-2xl border border-white/[0.07] bg-white/[0.018] open:bg-white/[0.025]">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-white/60 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#e0c985]">ขั้นตอนทำงาน 5 ขั้นและสถานะเอกสาร</summary>
        <div className="border-t border-white/[0.06] p-4">
          <div className="grid gap-2 md:grid-cols-5">
            {steps.map(([number, title, href, detail]) => {
              const external = href === "/studio/";
              return <Link key={number} href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined} className="rounded-xl border border-white/[0.07] p-3 hover:bg-white/[0.03]"><span className="text-[10px] font-semibold text-[#e0c985]">{number}</span><h3 className="mt-1 text-sm font-medium">{title}</h3><p className="mt-1 text-xs leading-5 text-white/40">{detail}</p></Link>;
            })}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/[0.07] p-3"><h3 className="text-sm font-medium">สถานะเอกสาร</h3><p className="mt-1 text-xs leading-5 text-white/45">Draft ยังไม่เผยแพร่; Published + Draft หมายถึงหน้าเดิมยัง Live จนกว่าคุณจะเผยแพร่ revision ใหม่</p></div>
            <div className="rounded-xl border border-white/[0.07] p-3"><h3 className="text-sm font-medium">สิ่งที่ระบบไม่ทำแทน</h3><p className="mt-1 text-xs leading-5 text-white/45">AI ไม่อนุมัติ ไม่ Publish ไม่ลบ และไม่เปลี่ยน Production โดยไม่มี action ที่ได้รับสิทธิ์</p></div>
          </div>
        </div>
      </details>
    </div>
  );
}
