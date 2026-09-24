import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPermission } from "@/lib/admin/require-permission";
import { hasAdminPermission } from "@/lib/admin/rbac";
import { listAdvisorInboxOperational } from "@/lib/admin/line/advisor-workflow";
import { buildActionCenterSignals, summarizeActionCenter } from "@/lib/admin/agent-os/action-center";
import { adminDataLaneLabel, connectionLabel, environmentLabel } from "@/lib/admin/presentation";
import { isStudioDataPlaneAllowed } from "@/lib/admin/environment";
import { getAdminOperationsRuntimeStatus } from "@/lib/admin/operations/foundation";
import { getAdminSanityStatus, listSeoSuggestions } from "@/lib/admin/sanity-control";

export const metadata: Metadata = { title: "เริ่มที่นี่" };

type DashboardProps = { searchParams: Promise<{ error?: string }> };

export default async function AdminDashboardPage({ searchParams }: DashboardProps) {
  const identity = await requireAdminPermission("dashboard:read");
  const params = await searchParams;
  const status = getAdminSanityStatus();
  const operations = getAdminOperationsRuntimeStatus();
  const reviews = await listSeoSuggestions();
  const pendingReviews = reviews.error
    ? null
    : reviews.rows.filter((item) => item.status === "needs-human-review").length;

  const advisorSummary = hasAdminPermission(identity.role, "advisor:read")
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
        return summarizeActionCenter(signals);
      }).catch(() => null)
    : null;
  const lane = adminDataLaneLabel(status.environment);
  const studioReady = isStudioDataPlaneAllowed(status.dataset ?? undefined);
  const steps = [
    ["1", "เลือกหรือสร้างบทความ", "/content/articles/", `เลือกบทความจาก ${lane} หรือสร้างฉบับร่างใหม่`],
    ["2", "ตรวจ SEO", "/seo/", "ดูผลตรวจที่บันทึกไว้และเหตุผลจากกฎที่อธิบายได้"],
    ["3", "ตรวจข้อเสนอ", "/dashboard/reviews/", "คุณเป็นคนตัดสินใจว่าจะอนุมัติหรือไม่"],
    ["4", "นำไปใช้กับฉบับร่าง", "/dashboard/reviews/", `แก้เฉพาะฉบับร่าง ${lane} และไม่เผยแพร่`],
    ["5", status.environment === "local-production" ? "เปิดตัวอย่างและเผยแพร่" : "เปิดตัวอย่าง", "/studio/", studioReady ? "ตรวจหน้าจริงอีกครั้งใน Studio แล้วคุณจึงเลือก Publish หรือ Schedule เอง" : "Studio ปิดอยู่ในโหมดอ่านอย่างเดียว"],
  ] as const;

  return (
    <div>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">ภาพรวมสำหรับเจ้าของระบบ</p>
          <h1 className="mt-2 text-3xl font-semibold">วันนี้มีอะไรที่ต้องจัดการ?</h1>
          <p className="mt-2 max-w-3xl text-base leading-7 text-white/70">
            ใช้หน้านี้เป็นทางเข้าเพื่อเลือกบทความ ตรวจ SEO และตัดสินใจด้วยตัวคุณเอง ระบบช่วยเตรียมงานได้ แต่คุณเป็นผู้ตัดสินใจทุกครั้ง
          </p>
        </div>
        <span className="w-fit rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/70">
          {environmentLabel(status.environment)}
        </span>
      </div>

      {params.error === "forbidden" ? (
        <div role="alert" className="mt-6 rounded-2xl border border-amber-200/20 bg-amber-200/10 p-4 text-sm leading-6 text-amber-50">
          บัญชีของคุณเปิดหน้านั้นไม่ได้ตามสิทธิ์ที่ได้รับ หากต้องใช้งาน กรุณาให้เจ้าของระบบตรวจบทบาทของบัญชีนี้
        </div>
      ) : null}

      <section className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-labelledby="attention-heading">
        <h2 id="attention-heading" className="md:col-span-2 text-xl font-semibold">สิ่งที่ควรตรวจวันนี้</h2>
        <Link href="/dashboard/reviews/" className="glass-card p-5">
          <p className="text-sm text-white/60">งานรอตรวจ</p>
          <p className="mt-2 text-xl font-semibold text-gold-400">{pendingReviews == null ? "ยังอ่านไม่ได้" : pendingReviews === 0 ? "ไม่มีงานค้าง" : `${pendingReviews} รายการ`}</p>
          <p className="mt-2 text-sm leading-6 text-white/65">{pendingReviews == null ? "ระบบยังอ่านรายการไม่ได้ จึงไม่แสดงเป็นศูนย์" : "ข้อเสนอที่รอผู้มีสิทธิ์ตรวจและตัดสินใจ"}</p>
        </Link>
        <Link href="/operations/health/" className="glass-card p-5">
          <p className="text-sm text-white/60">ความพร้อมของระบบ</p>
          <p className={`mt-2 text-xl font-semibold ${operations.identityValid ? "text-emerald-200" : "text-amber-200"}`}>{operations.identityValid ? "พร้อมใช้งาน" : operations.configured ? "ต้องตรวจ" : "ยังตั้งค่าไม่ครบ"}</p>
          <p className="mt-2 text-sm leading-6 text-white/65">ตรวจแหล่งข้อมูล คิวงาน และการเชื่อมต่อภายนอก</p>
        </Link>
        {hasAdminPermission(identity.role, "advisor:read") ? (
          <Link href="/dashboard/inbox/" className="glass-card p-5">
            <p className="text-sm text-white/60">ลูกค้าที่ควรดูวันนี้</p>
            <p className={`mt-2 text-xl font-semibold ${advisorSummary?.urgent ? "text-rose-200" : "text-gold-400"}`}>
              {advisorSummary == null ? "ยังอ่านไม่ได้" : advisorSummary.total === 0 ? "ไม่มีงานค้าง" : `${advisorSummary.total} เรื่อง`}
            </p>
            <p className="mt-2 text-sm leading-6 text-white/65">
              {advisorSummary == null
                ? "ระบบจะไม่เดาว่าไม่มีงาน หากอ่าน CRM ไม่สำเร็จ"
                : advisorSummary.total === 0
                  ? "ยังไม่พบสัญญาณที่ต้องติดตามจากกฎปัจจุบัน"
                  : `เร่งด่วน ${advisorSummary.urgent} · สำคัญ ${advisorSummary.high} · ปกติ ${advisorSummary.normal}`}
            </p>
          </Link>
        ) : null}
      </section>

      <section className="mt-7 rounded-3xl border border-[#e0c985]/20 bg-[#e0c985]/[0.07] p-5 md:p-6" aria-labelledby="safety-heading">
        <h2 id="safety-heading" className="text-lg font-semibold text-[#f4df9b]">ขอบเขตปลอดภัยยังทำงานอยู่</h2>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-white/70">
          พื้นที่นี้ใช้ข้อมูลจาก <strong className="font-medium text-white">{lane}</strong> เท่านั้น หากเชื่อมต่อผิดชุด ระบบจะหยุดและไม่สลับไปใช้ข้อมูลชุดอื่นเอง
        </p>
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="สถานะการเชื่อมต่อ">
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-sm text-white/60">ชุดข้อมูล</p><p className="mt-2 text-lg font-semibold">{status.dataset ?? "ยังไม่ได้ตั้งค่า"}</p></article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-sm text-white/60">การอ่านข้อมูล</p><p className="mt-2 text-lg font-semibold">{connectionLabel(status.readReady, "read", status.environment)}</p></article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-sm text-white/60">แก้บทความใน Studio</p><p className="mt-2 text-lg font-semibold">{connectionLabel(studioReady, "studio", status.environment)}</p>{studioReady && !status.writeReady ? <p className="mt-2 text-xs leading-5 text-white/50">ยังไม่นำข้อเสนอไปแก้ฉบับร่างให้อัตโนมัติ</p> : null}</article>
        <Link href="/operations/health/" className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 transition hover:border-[#e0c985]/30 hover:bg-white/[0.05]">
          <p className="text-sm text-white/60">ระบบหลังบ้าน</p>
          <p className={`mt-2 text-lg font-semibold ${operations.identityValid ? "text-emerald-200" : operations.configured ? "text-amber-200" : "text-white/70"}`}>
            {operations.identityValid ? "พร้อมใช้งาน" : operations.configured ? "ต้องตรวจการเชื่อมต่อ" : "ยังไม่ได้เชื่อมฐานข้อมูลส่วนตัว"}
          </p>
          <p className="mt-2 text-xs leading-5 text-white/50">ประวัติ · ข้อเสนอ SEO · ข้อมูลประกอบ · สถานะระบบ</p>
        </Link>
      </section>

      {!operations.identityValid ? (
        <section className="mt-4 rounded-2xl border border-amber-200/20 bg-amber-200/10 p-4 text-sm leading-6 text-amber-50">
          ระบบหยุดการอ่านและบันทึกประวัติ ข้อเสนอ และผลตรวจ SEO ไว้ก่อน จนกว่าจะยืนยันได้ว่าเชื่อมต่อฐานข้อมูลส่วนตัวชุดที่ถูกต้อง <Link href="/operations/health/" className="font-medium underline underline-offset-4">ดูสถานะระบบ</Link>
        </section>
      ) : null}

      {status.environment === "local-production" ? (
        <section className="mt-6 rounded-3xl border border-[#e0c985]/20 bg-[#e0c985]/[0.07] p-5" aria-labelledby="mac-start-heading">
          <h2 id="mac-start-heading" className="text-lg font-semibold text-[#f4df9b]">เริ่มใช้งานบน Mac</h2>
          <ol className="mt-3 grid gap-2 text-sm leading-6 text-white/75 md:grid-cols-3">
            <li><strong className="text-white">1.</strong> เปิด <strong className="text-white">CCPun Admin.app</strong> จาก Desktop</li>
            <li><strong className="text-white">2.</strong> กด <strong className="text-white">เปิดระบบ</strong> แล้ว Safari จะเปิดหน้านี้</li>
            <li><strong className="text-white">3.</strong> เมื่อทำงานเสร็จ กลับไปกด <strong className="text-white">ปิดระบบ</strong></li>
          </ol>
        </section>
      ) : null}

      {status.environment === "local-production" && studioReady ? (
        <section className="mt-6 grid gap-3 md:grid-cols-3" aria-label="เครื่องมือบทความในระบบจริง">
          <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"><h2 className="font-semibold">สร้างและแก้บทความ</h2><p className="mt-2 text-sm leading-6 text-white/70">Studio บันทึกทุกการเปลี่ยนแปลงไว้ในฉบับร่างเดียวกันอัตโนมัติ</p></article>
          <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"><h2 className="font-semibold">เผยแพร่หรือตั้งเวลา</h2><p className="mt-2 text-sm leading-6 text-white/70">เปิดให้เฉพาะคุณกดใน Studio หลังตรวจตัวอย่างแล้ว</p></article>
          <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"><h2 className="font-semibold">ยกเลิกการเผยแพร่หรือลบ</h2><p className="mt-2 text-sm leading-6 text-white/70">บทความที่เผยแพร่อยู่ต้องยกเลิกการเผยแพร่ก่อน จึงลบฉบับร่างได้</p></article>
        </section>
      ) : null}

      <section className="mt-6 grid gap-3 lg:grid-cols-2" aria-label="คู่มืออ่านสถานะ">
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <h2 className="font-semibold text-white">สถานะเอกสาร</h2>
          <p className="mt-2 text-sm leading-6 text-white/70"><strong className="font-medium text-amber-100">ฉบับร่าง — ยังไม่เผยแพร่</strong> คือคนภายนอกยังไม่เห็นบทความนี้</p>
          <p className="mt-2 text-sm leading-6 text-white/70"><strong className="font-medium text-emerald-100">เผยแพร่แล้ว · มีฉบับร่างแก้ไข</strong> คือหน้าเดิมยังแสดงอยู่จนกว่าคุณจะตรวจตัวอย่างและเผยแพร่ด้วยตัวเอง</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <h2 className="font-semibold text-white">ขั้นตรวจเนื้อหา</h2>
          <p className="mt-2 text-sm leading-6 text-white/70">ใช้บอกว่างานกำลังตรวจเนื้อหา พร้อมให้คุณอนุมัติ หรืออนุมัติเนื้อหาแล้ว สถานะนี้ไม่ใช่การเผยแพร่ และเปลี่ยนหน้าเว็บสาธารณะไม่ได้</p>
        </article>
      </section>

      <section className="mt-8" aria-labelledby="workflow-heading">
        <h2 id="workflow-heading" className="text-xl font-semibold">ทำตาม 5 ขั้นตอนนี้</h2>
        <div className="mt-4 grid gap-3 lg:grid-cols-5">
          {steps.map(([number, title, href, detail]) => {
            const opensStudio = href.startsWith("/studio/");
            if (opensStudio && !studioReady) {
              return <div key={number} className="min-h-44 rounded-2xl border border-white/10 bg-white/[0.02] p-5 opacity-60"><span className="text-sm font-semibold text-[#e0c985]">ขั้นที่ {number}</span><h3 className="mt-3 text-lg font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-white/65">{detail}</p></div>;
            }
            return (
              <Link key={number} href={href} target={opensStudio ? "_blank" : undefined} rel={opensStudio ? "noopener noreferrer" : undefined} className="min-h-44 rounded-2xl border border-white/10 bg-white/[0.035] p-5 transition hover:border-[#e0c985]/30 hover:bg-white/[0.05]">
                <span className="text-sm font-semibold text-[#e0c985]">ขั้นที่ {number}</span>
                <h3 className="mt-3 text-lg font-semibold">{title}{opensStudio ? <span className="sr-only"> (เปิดแท็บใหม่)</span> : null}</h3>
                <p className="mt-2 text-sm leading-6 text-white/65">{detail}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-5 text-sm leading-6 text-white/70">
        <h2 className="font-semibold text-white">สิ่งที่ระบบจะไม่ทำแทนคุณ</h2>
        <p className="mt-2">AI ช่วยค้นคว้า วิเคราะห์ และสร้างข้อเสนอได้ แต่ไม่สามารถอนุมัติ เผยแพร่ ลบ หรือเปลี่ยนระบบจริงได้</p>
      </section>
    </div>
  );
}
