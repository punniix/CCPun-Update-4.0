import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPermission } from "@/lib/admin/require-permission";
import { hasAdminPermission } from "@/lib/admin/rbac";
import { listAdvisorInboxOperational } from "@/lib/admin/line/advisor-workflow";
import { buildActionCenterSignals, selectActionCenterSignals, summarizeActionCenter } from "@/lib/admin/agent-os/action-center";
import { adminDataLaneLabel, connectionLabel, datasetLabel, environmentLabel } from "@/lib/admin/presentation";
import { isStudioDataPlaneAllowed } from "@/lib/admin/environment";
import { getAdminOperationsRuntimeStatus } from "@/lib/admin/operations/foundation";
import { readOperationsJobs } from "@/lib/admin/operations/jobs-read-model";
import { readConversionAnalytics } from "@/lib/admin/line/business-intelligence";
import { getAdminSanityStatus, listSeoSuggestions } from "@/lib/admin/sanity-control";
import { editorialDashboardSteps } from "@/lib/admin/dashboard-summary";

export const metadata: Metadata = { title: "วันนี้" };

type DashboardProps = { searchParams: Promise<{ error?: string }> };

export default async function AdminDashboardPage({ searchParams }: DashboardProps) {
  const identity = await requireAdminPermission("dashboard:read");
  const params = await searchParams;
  const status = getAdminSanityStatus();
  const operations = getAdminOperationsRuntimeStatus();
  const canReadReviews = hasAdminPermission(identity.role, "reviews:read");
  const canReadOperations = hasAdminPermission(identity.role, "settings:read");
  const reviews = canReadReviews ? await listSeoSuggestions() : null;
  const pendingReviews = !reviews || reviews.error
    ? null
    : reviews.rows.filter((item) => item.status === "needs-human-review").length;

  const canReadAdvisor = hasAdminPermission(identity.role, "advisor:read");
  const advisorSummary = canReadAdvisor
    ? await listAdvisorInboxOperational({}).then((rows) => {
        const signals = buildActionCenterSignals(rows.map((row) => ({
          leadId: row.leadId,
          stage: row.stage,
          materialReceived: row.materialReceived,
          unreadCount: row.unreadCount,
          followUpAt: row.followUpAt,
          lastActivityAt: row.lastActivityAt,
          latestMessageNeedsHuman: row.latestMessageNeedsHuman,
          caseState: row.caseState,
        })), new Date().toISOString());
        const humanSignals = selectActionCenterSignals(signals, "human");
        const followUpSignals = selectActionCenterSignals(signals, "follow-up");
        const cases = new Map<string, { leadId: string; reasons: string[] }>();
        for (const signal of signals) {
          const existingCase = cases.get(signal.leadId);
          if (existingCase) {
            if (!existingCase.reasons.includes(signal.reason)) existingCase.reasons.push(signal.reason);
          } else {
            cases.set(signal.leadId, { leadId: signal.leadId, reasons: [signal.reason] });
          }
        }
        return { ...summarizeActionCenter(signals),
          needsHuman: { people: new Set(humanSignals.map((signal) => signal.leadId)).size, signals: humanSignals.length },
          followUps: { people: new Set(followUpSignals.map((signal) => signal.leadId)).size, signals: followUpSignals.length },
          cases: Array.from(cases.values()).slice(0, 3),
        };
      }).catch(() => null)
    : null;

  const jobs = canReadOperations ? await readOperationsJobs(50).catch(() => null) : null;
  const attentionJobs = jobs?.jobs.filter((job) => ["failed", "reconciliation-required", "reconciliation_required"].includes(job.status)) ?? [];
  const businessOverview = canReadAdvisor
    ? await readConversionAnalytics().catch(() => ({ state: "unavailable" as const, summary: null })).then((analytics) => ({
        leadCount: analytics.state === "ready" ? analytics.summary?.lead_count ?? null : null,
        qualifiedCount: analytics.state === "ready" ? analytics.summary?.qualified_count ?? null : null,
        wonCount: analytics.state === "ready" ? analytics.summary?.won_count ?? null : null,
        revenueRecordCount: analytics.state === "ready" ? analytics.summary?.revenue_record_count ?? null : null,
      }))
    : null;

  const lane = adminDataLaneLabel(status.environment);
  const studioReady = isStudioDataPlaneAllowed(status.dataset ?? undefined);
  const steps = editorialDashboardSteps(lane, status.environment, studioReady, "/dashboard/reviews/");

  return (
    <div>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm leading-[22px] font-semibold tracking-[0.12em] text-[#e0c985]">ภาพรวมสำหรับเจ้าของระบบ</p>
          <h1 className="mt-2 text-2xl leading-8 font-semibold sm:text-[28px] sm:leading-9">วันนี้มีอะไรที่ต้องจัดการ?</h1>
          <p className="mt-2 max-w-3xl text-base leading-6 text-white/70">
            เริ่มจากลูกค้าที่ต้องดูต่อ งานที่รอตรวจ วันติดตาม และปัญหาของงานเบื้องหลัง แล้วเปิดงานที่ต้องการจัดการ
          </p>
        </div>
        <span className="w-fit rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm leading-[22px] text-white/70">
          {environmentLabel(status.environment)}
        </span>
      </div>

      {params.error === "forbidden" ? (
        <div role="alert" className="mt-6 rounded-2xl border border-amber-200/20 bg-amber-200/10 p-4 text-base leading-6 text-amber-50">
          บัญชีของคุณเปิดหน้านั้นไม่ได้ตามสิทธิ์ที่ได้รับ หากต้องใช้งาน กรุณาให้เจ้าของระบบตรวจบทบาทของบัญชีนี้
        </div>
      ) : null}

      <section className="mt-6" aria-labelledby="attention-heading">
        <h2 id="attention-heading" className="text-xl font-semibold">เลือกงานถัดไป</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {canReadAdvisor ? <Link href="/dashboard/inbox/?attention=human" className="rounded-2xl border border-[#e0c985]/25 bg-[#e0c985]/[0.06] p-5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e0c985]">
            <p className="text-base leading-6 text-white/70">ดูลูกค้าที่รอคุณ</p>
            <p className="mt-2 text-xl font-semibold text-[#f4df9b]">{advisorSummary == null ? "ยังอ่านไม่ได้" : advisorSummary.needsHuman.people ? `${advisorSummary.needsHuman.people} คน · ${advisorSummary.needsHuman.signals} เรื่อง` : "ยังไม่พบในรายการล่าสุด"}</p>
            <p className="mt-2 text-base leading-6 text-white/65">ข้อความรอคนดูและลูกค้าใหม่ที่ยังไม่ได้อ่าน · เปิดเฉพาะลูกค้ากลุ่มนี้</p>
          </Link> : null}
          {canReadReviews ? <Link href="/dashboard/reviews/" className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e0c985]">
            <p className="text-base leading-6 text-white/70">ตรวจข้อเสนอ SEO</p>
            <p className="mt-2 text-xl font-semibold">{pendingReviews == null ? "ยังอ่านไม่ได้" : pendingReviews === 0 ? "ยังไม่พบในรายการที่อ่านได้" : `${pendingReviews} รายการ`}</p>
            <p className="mt-2 text-base leading-6 text-white/65">เปิดข้อเสนอเพื่ออ่านเหตุผลและตัดสินใจ การตรวจนี้ยังไม่ใช่การเผยแพร่</p>
          </Link> : null}
          {canReadAdvisor ? <Link href="/dashboard/inbox/?attention=follow-up" className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e0c985]">
            <p className="text-base leading-6 text-white/70">ดูลูกค้าที่ถึงวันติดตาม</p>
            <p className="mt-2 text-xl font-semibold">{advisorSummary == null ? "ยังอ่านไม่ได้" : advisorSummary.followUps.people ? `${advisorSummary.followUps.people} คน · ${advisorSummary.followUps.signals} เรื่อง` : "ยังไม่พบในรายการล่าสุด"}</p>
            <p className="mt-2 text-base leading-6 text-white/65">วันติดตามวันนี้หรือที่เลยกำหนดจากเคสที่อ่านได้ · ยังไม่ส่งข้อความแทนคุณ</p>
          </Link> : null}
          {canReadOperations ? <Link href="/operations/jobs/" className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e0c985]">
            <p className="text-base leading-6 text-white/70">ตรวจงานที่สะดุด</p>
            <p className="mt-2 text-xl font-semibold text-amber-100">{!jobs || jobs.status === "unavailable" ? "ยังอ่านไม่ได้" : attentionJobs.length ? `${attentionJobs.length} รายการล่าสุด` : jobs.status === "partial" ? "อ่านได้บางแหล่ง" : "ยังไม่พบในรายการล่าสุด"}</p>
            <p className="mt-2 text-base leading-6 text-white/65">งานไม่สำเร็จหรือผลยังไม่ชัด ให้ตรวจประวัติก่อนลองใหม่</p>
          </Link> : null}
        </div>
        <p className="mt-3 text-sm leading-[22px] text-white/55">สัญญาณลูกค้ามาจากรายการล่าสุดสูงสุด 100 รายการ งานระบบมาจากรายการล่าสุดสูงสุด 50 รายการ ไม่ใช่งานค้างทั้งหมด{jobs?.status === "partial" ? " · แหล่งงานบางส่วนยังอ่านไม่ได้" : ""}</p>
        {advisorSummary?.cases.length ? <ul className="mt-4 divide-y divide-white/10 rounded-2xl border border-white/10 px-4">
          {advisorSummary.cases.map((item) => <li key={item.leadId}><Link href={`/dashboard/inbox/${item.leadId}/`} className="flex min-h-11 flex-wrap items-center justify-between gap-2 py-3 text-base leading-6 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e0c985]"><span className="flex min-w-0 flex-col gap-1 text-white/75">{item.reasons.map((reason) => <span key={reason}>{reason}</span>)}</span><span className="text-[#e0c985]">เปิดเคส →</span></Link></li>)}
        </ul> : null}
      </section>

      {canReadAdvisor ? (
        <section className="mt-7" aria-labelledby="business-overview-heading">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="business-overview-heading" className="text-xl font-semibold">ภาพรวมธุรกิจ</h2>
              <p className="mt-1 text-base leading-6 text-white/65">
                ดูจาก CRM และเส้นทางลูกค้าที่ระบบอ่านได้จริง หากอ่านไม่ได้จะแสดง “—” แทนการเดาเป็นศูนย์
              </p>
            </div>
            {hasAdminPermission(identity.role, "settings:read") ? (
              <Link href="/analytics/exports/" className="inline-flex min-h-11 items-center px-4 text-base leading-6 text-[#e0c985] hover:underline hover:underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e0c985]">
                ส่งออกข้อมูล →
              </Link>
            ) : null}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Lead", businessOverview?.leadCount],
              ["Qualified Conversation", businessOverview?.qualifiedCount],
              ["Won", businessOverview?.wonCount],
              ["รายการรายได้", businessOverview?.revenueRecordCount],
            ].map(([label, value]) => (
              <article key={String(label)} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <p className="text-base leading-6 text-white/65">{label}</p>
                <p className="mt-2 text-2xl font-semibold">
                  {typeof value === "number" ? value.toLocaleString("th-TH") : "—"}
                </p>
              </article>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/analytics/conversions/" className="inline-flex min-h-11 items-center rounded-xl border border-white/10 px-4 py-2 text-base leading-6 text-white/75 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e0c985]">
              ดูเส้นทางลูกค้า
            </Link>
            <Link href="/dashboard/inbox/" className="inline-flex min-h-11 items-center rounded-xl border border-white/10 px-4 py-2 text-base leading-6 text-white/75 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e0c985]">
              ดูลูกค้า CRM
            </Link>
          </div>
        </section>
      ) : null}

      <details className="mt-6 rounded-2xl border border-white/10 p-4">
      <summary className="flex min-h-11 cursor-pointer items-center text-base leading-6 font-medium text-white/75 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e0c985]">แหล่งข้อมูลและสถานะการเชื่อมต่อ</summary>
      <section className="mt-4 border-t border-white/10 pt-4" aria-labelledby="safety-heading">
        <h2 id="safety-heading" className="text-lg font-semibold text-[#f4df9b]">ขอบเขตของข้อมูลที่ใช้</h2>
        <p className="mt-2 max-w-4xl text-base leading-6 text-white/70">
          พื้นที่นี้ใช้ข้อมูลจาก <strong className="font-medium text-white">{lane}</strong> เท่านั้น หากเชื่อมต่อผิดชุด ระบบจะหยุดและไม่สลับไปใช้ข้อมูลชุดอื่นเอง
        </p>
      </section>

      <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="สถานะการเชื่อมต่อ">
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-base leading-6 text-white/70">ชุดข้อมูล</p><p className="mt-2 text-lg font-semibold">{datasetLabel(status.dataset)}</p></article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-base leading-6 text-white/70">การอ่านข้อมูล</p><p className="mt-2 text-lg font-semibold">{connectionLabel(status.readReady, "read", status.environment)}</p></article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-base leading-6 text-white/70">แก้บทความใน Sanity Studio</p><p className="mt-2 text-lg font-semibold">{connectionLabel(studioReady, "studio", status.environment)}</p>{studioReady && !status.writeReady ? <p className="mt-2 text-sm leading-[22px] text-white/50">ยังไม่นำข้อเสนอไปแก้ฉบับร่างให้อัตโนมัติ</p> : null}</article>
        <Link href="/operations/health/" className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 transition hover:border-[#e0c985]/30 hover:bg-white/[0.05]">
          <p className="text-base leading-6 text-white/70">ระบบหลังบ้าน</p>
          <p className={`mt-2 text-lg font-semibold ${operations.identityValid ? "text-emerald-200" : operations.configured ? "text-amber-200" : "text-white/70"}`}>
            {operations.identityValid ? "ยืนยันชุดฐานข้อมูลแล้ว" : operations.configured ? "ต้องตรวจการเชื่อมต่อ" : "ยังไม่ได้เชื่อมฐานข้อมูลส่วนตัว"}
          </p>
          <p className="mt-2 text-sm leading-[22px] text-white/50">การยืนยันชุดฐานข้อมูลยังไม่ใช่ผลตรวจความพร้อมของบริการทั้งหมด</p>
        </Link>
      </section>
      </details>

      {!operations.identityValid ? (
        <section className="mt-4 rounded-2xl border border-amber-200/20 bg-amber-200/10 p-4 text-base leading-6 text-amber-50">
          ระบบหยุดการอ่านและบันทึกประวัติ ข้อเสนอ และผลตรวจ SEO ไว้ก่อน จนกว่าจะยืนยันได้ว่าเชื่อมต่อฐานข้อมูลส่วนตัวชุดที่ถูกต้อง <Link href="/operations/health/" className="font-medium underline underline-offset-4">ดูสถานะระบบ</Link>
        </section>
      ) : null}

      {status.environment === "local-production" ? (
        <section className="mt-6 rounded-3xl border border-[#e0c985]/20 bg-[#e0c985]/[0.07] p-5" aria-labelledby="mac-start-heading">
          <h2 id="mac-start-heading" className="text-lg font-semibold text-[#f4df9b]">เริ่มใช้งานบน Mac</h2>
          <ol className="mt-3 grid gap-2 text-base leading-6 text-white/75 md:grid-cols-3">
            <li><strong className="text-white">1.</strong> เปิด <strong className="text-white">CCPun Admin.app</strong> จาก Desktop</li>
            <li><strong className="text-white">2.</strong> กด <strong className="text-white">เปิดระบบ</strong> แล้ว Safari จะเปิดหน้านี้</li>
            <li><strong className="text-white">3.</strong> เมื่อทำงานเสร็จ กลับไปกด <strong className="text-white">ปิดระบบ</strong></li>
          </ol>
        </section>
      ) : null}

      {status.environment === "local-production" && studioReady ? (
        <section className="mt-6 grid gap-3 md:grid-cols-3" aria-label="เครื่องมือบทความในระบบจริง">
          <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"><h2 className="font-semibold">สร้างและแก้บทความ</h2><p className="mt-2 text-base leading-6 text-white/70">Sanity Studio บันทึกทุกการเปลี่ยนแปลงไว้ในฉบับร่างเดียวกันอัตโนมัติ</p></article>
          <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"><h2 className="font-semibold">เผยแพร่หรือตั้งเวลา</h2><p className="mt-2 text-base leading-6 text-white/70">เปิดให้เฉพาะคุณกดใน Sanity Studio หลังตรวจตัวอย่างแล้ว</p></article>
          <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"><h2 className="font-semibold">ยกเลิกการเผยแพร่หรือลบ</h2><p className="mt-2 text-base leading-6 text-white/70">บทความที่เผยแพร่อยู่ต้องยกเลิกการเผยแพร่ก่อน จึงลบฉบับร่างได้</p></article>
        </section>
      ) : null}

      <details className="mt-8 rounded-2xl border border-white/10 p-4">
      <summary className="flex min-h-11 cursor-pointer items-center text-base leading-6 font-medium text-white/75 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e0c985]">คู่มือบทความและ SEO</summary>
      <section className="mt-4 grid gap-3 lg:grid-cols-2" aria-label="คู่มืออ่านสถานะ">
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <h2 className="font-semibold text-white">สถานะเอกสาร</h2>
          <p className="mt-2 text-base leading-6 text-white/70"><strong className="font-medium text-amber-100">ฉบับร่าง — ยังไม่เผยแพร่</strong> คือคนภายนอกยังไม่เห็นบทความนี้</p>
          <p className="mt-2 text-base leading-6 text-white/70"><strong className="font-medium text-emerald-100">เผยแพร่แล้ว · มีฉบับร่างแก้ไข</strong> คือหน้าเดิมยังแสดงอยู่จนกว่าคุณจะตรวจตัวอย่างและเผยแพร่ด้วยตัวเอง</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <h2 className="font-semibold text-white">ขั้นตรวจเนื้อหา</h2>
          <p className="mt-2 text-base leading-6 text-white/70">ใช้บอกว่างานกำลังตรวจเนื้อหา พร้อมให้คุณอนุมัติ หรืออนุมัติเนื้อหาแล้ว สถานะนี้ไม่ใช่การเผยแพร่ และเปลี่ยนหน้าเว็บสาธารณะไม่ได้</p>
        </article>
      </section>

      <section className="mt-8" aria-labelledby="workflow-heading">
        <h2 id="workflow-heading" className="text-xl font-semibold">ทำตาม 5 ขั้นตอนนี้</h2>
        <div className="mt-4 grid gap-3 lg:grid-cols-5">
          {steps.map(([number, title, href, detail]) => {
            const opensStudio = href.startsWith("/studio/");
            if (opensStudio && !studioReady) {
              return <div key={number} className="min-h-44 rounded-2xl border border-white/10 bg-white/[0.02] p-5 opacity-60"><span className="text-sm font-semibold text-[#e0c985]">ขั้นที่ {number}</span><h3 className="mt-3 text-lg font-semibold">{title}</h3><p className="mt-2 text-base leading-6 text-white/65">{detail}</p></div>;
            }
            return (
              <Link key={number} href={href} target={opensStudio ? "_blank" : undefined} rel={opensStudio ? "noopener noreferrer" : undefined} className="min-h-44 rounded-2xl border border-white/10 bg-white/[0.035] p-5 transition hover:border-[#e0c985]/30 hover:bg-white/[0.05]">
                <span className="text-sm font-semibold text-[#e0c985]">ขั้นที่ {number}</span>
                <h3 className="mt-3 text-lg font-semibold">{title}{opensStudio ? <span className="sr-only"> (เปิดแท็บใหม่)</span> : null}</h3>
                <p className="mt-2 text-base leading-6 text-white/65">{detail}</p>
              </Link>
            );
          })}
        </div>
      </section>
      </details>

      <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-5 text-base leading-6 text-white/70">
        <h2 className="font-semibold text-white">สิ่งที่ระบบจะไม่ทำแทนคุณ</h2>
        <p className="mt-2">AI ช่วยค้นคว้า วิเคราะห์ และสร้างข้อเสนอได้ แต่ไม่สามารถอนุมัติ เผยแพร่ ลบ หรือเปลี่ยนระบบจริงได้</p>
      </section>
    </div>
  );
}
