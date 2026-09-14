import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPermission } from "@/lib/admin/require-permission";
import { listAuditLogs } from "@/lib/admin/sanity-audit";
import { readArticleSchedulerModel } from "@/lib/admin/operations/article-scheduler-read-model";

export const metadata: Metadata = { title: "ประวัติการทำงาน" };

function formatTimestamp(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "medium", timeZone: "Asia/Bangkok" }).format(new Date(value));
}

function statusTone(status: string) {
  if (["published", "validated"].includes(status)) return "text-emerald-100";
  if (["preparing", "scheduled", "executing"].includes(status)) return "text-amber-100";
  if (["failed", "stale", "reconciliation-required"].includes(status)) return "text-rose-100";
  return "text-white/65";
}

export default async function AdminAuditPage() {
  await requireAdminPermission("audit:read");
  const [result, scheduler] = await Promise.all([
    listAuditLogs(),
    readArticleSchedulerModel({ scheduleLimit: 20, auditLimit: 80 }),
  ]);

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">ตรวจสอบย้อนหลังได้</p>
      <h1 className="mt-2 text-3xl font-semibold">ประวัติการทำงาน</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">
        แยก Audit trail ของ Control Plane ออกจาก transition log ของ Article Scheduler อย่างชัดเจน เพื่อให้ตรวจย้อนหลังได้ว่าใครทำอะไร และคิวเผยแพร่เปลี่ยนสถานะเมื่อใด
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Link href="/operations/jobs/" className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/75 hover:bg-white/[0.05]"><span className="block text-xs text-white/40">Operations</span><strong className="mt-1 block font-medium">Jobs / queue</strong></Link>
        <Link href="/operations/deployments/" className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/75 hover:bg-white/[0.05]"><span className="block text-xs text-white/40">Release</span><strong className="mt-1 block font-medium">Deployment history</strong></Link>
        <Link href="/content/calendar/" className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/75 hover:bg-white/[0.05]"><span className="block text-xs text-white/40">Content</span><strong className="mt-1 block font-medium">Schedule calendar</strong></Link>
      </div>

      <section className="mt-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/40">Control Plane audit</p><h2 className="mt-1 text-xl font-semibold">การทำงานของผู้ใช้และระบบ</h2></div>
          <p className="text-xs text-white/40">{result.rows.length.toLocaleString("th-TH")} รายการที่โหลดล่าสุด</p>
        </div>

        {result.error ? (
          <section className="mt-4 rounded-3xl border border-amber-200/20 bg-amber-200/10 p-5 text-sm leading-6 text-amber-50">
            <h3 className="font-semibold">ยังอ่านประวัติจากฐานข้อมูล Control Plane ไม่ได้</h3>
            <p className="mt-2 text-amber-50/80">ระบบหยุดไว้เพื่อความปลอดภัยเมื่อ private operational database ไม่ตรง lane หรือยังไม่พร้อม และจะไม่ย้อนกลับไปใช้ Sanity operational records เก่าแทนโดยอัตโนมัติ</p>
          </section>
        ) : null}

        {!result.error && result.rows.length === 0 ? (
          <section className="mt-4 rounded-3xl border border-white/10 bg-white/[0.035] p-7 text-center">
            <h3 className="text-lg font-semibold">ยังไม่มีรายการในประวัติ</h3>
            <p className="mt-2 text-sm text-white/65">เมื่อสร้างข้อเสนอ อนุมัติ ตรวจ SEO หรือนำข้อเสนอไปใช้กับฉบับร่าง ระบบจะแสดงรายการที่นี่</p>
          </section>
        ) : null}

        {result.rows.length > 0 ? (
          <section className="mt-4 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.025]">
            <p className="px-5 pt-4 text-sm text-white/60 xl:hidden">เลื่อนตารางไปทางซ้ายหรือขวาเพื่อดูข้อมูลทั้งหมด</p>
            <div role="region" aria-label="ตารางประวัติการทำงาน" tabIndex={0} className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wide text-white/60"><tr><th className="px-5 py-4 font-medium">เวลา</th><th className="px-4 py-4 font-medium">ผู้ทำ</th><th className="px-4 py-4 font-medium">รายการ</th><th className="px-4 py-4 font-medium">ข้อมูลที่เกี่ยวข้อง</th><th className="px-4 py-4 font-medium">พื้นที่</th><th className="px-5 py-4 font-medium">รหัสอ้างอิง</th></tr></thead>
                <tbody className="divide-y divide-white/5">{result.rows.map((row) => <tr key={row.id} className="transition hover:bg-white/[0.025]"><td className="px-5 py-4 text-white/50">{formatTimestamp(row.timestamp)}</td><td className="px-4 py-4"><div className="text-white/70">{row.actor || "—"}</div><div className="mt-1 text-xs text-white/60">{row.actorType || "—"}</div></td><td className="px-4 py-4 font-medium text-white/75">{row.action || "—"}</td><td className="px-4 py-4 text-white/55">{row.objectType || "—"} · {row.objectId || "—"}</td><td className="px-4 py-4 text-white/55">{row.environment || "—"}</td><td className="px-5 py-4 font-mono text-xs text-white/60">{row.requestId || "—"}</td></tr>)}</tbody>
              </table>
            </div>
          </section>
        ) : null}
      </section>

      <section className="mt-9">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/40">Article Scheduler log</p><h2 className="mt-1 text-xl font-semibold">การเปลี่ยนสถานะของคิวบทความ</h2></div>
          <div className="text-right text-xs text-white/40"><div>Runtime {scheduler.runtimeEnabled ? "ON" : "OFF"} · Durable {scheduler.durableEnabled ? "ON" : "OFF"}</div><div>{scheduler.audit.length.toLocaleString("th-TH")} transitions ที่โหลดล่าสุด</div></div>
        </div>

        {scheduler.error ? <div className="mt-4 rounded-2xl border border-amber-200/20 bg-amber-200/[0.06] p-4 text-sm text-amber-50/90">อ่าน Scheduler log ไม่ได้: {scheduler.error}</div> : null}
        {scheduler.status === "ready" && scheduler.audit.length === 0 ? <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.025] p-5 text-sm text-white/55">ยังไม่มี Scheduler transition record นี่เป็น healthy zero จาก `article_schedule_audit` ไม่ใช่ log ที่หาย</div> : null}

        {scheduler.audit.length > 0 ? (
          <div role="region" aria-label="Article Scheduler transition log" tabIndex={0} className="mt-4 overflow-x-auto rounded-3xl border border-white/10 bg-white/[0.025]">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wide text-white/60"><tr><th className="px-5 py-4 font-medium">เกิดขึ้นเมื่อ</th><th className="px-4 py-4 font-medium">บทความ</th><th className="px-4 py-4 font-medium">สถานะ</th><th className="px-4 py-4 font-medium">ผู้ทำ</th><th className="px-4 py-4 font-medium">เวลาที่ตั้ง</th><th className="px-5 py-4 font-medium">Generation / Version</th></tr></thead>
              <tbody className="divide-y divide-white/5">{scheduler.audit.map((row) => <tr key={`${row.generation}:${row.row_version}`}><td className="px-5 py-4 text-white/50">{formatTimestamp(row.occurred_at)}</td><td className="px-4 py-4 font-mono text-xs text-white/60">{row.article_id}</td><td className={`px-4 py-4 font-medium ${statusTone(row.status)}`}>{row.status}{row.error_code ? <div className="mt-1 text-xs text-rose-100">{row.error_code}</div> : null}</td><td className="px-4 py-4 text-white/60">{row.actor}</td><td className="px-4 py-4 text-white/55">{formatTimestamp(row.scheduled_at)}</td><td className="px-5 py-4 font-mono text-xs text-white/45">{row.generation.slice(0, 12)}… · v{row.row_version}</td></tr>)}</tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
