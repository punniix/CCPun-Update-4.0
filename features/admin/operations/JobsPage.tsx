import { readOperationsJobs, type OperationsJob } from "@/lib/admin/operations/jobs-read-model";
import { requireAdminPermission } from "@/lib/admin/require-permission";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(value));
}

function statusTone(status: string) {
  if (["published", "validated", "succeeded"].includes(status)) return "border-emerald-300/20 bg-emerald-300/10 text-emerald-100";
  if (["scheduled", "queued", "processing", "executing", "preparing", "running", "waiting_external", "waiting_ai", "validating", "awaiting_review", "retrying"].includes(status)) return "border-amber-200/20 bg-amber-200/10 text-amber-50";
  if (["failed", "reconciliation-required", "reconciliation_required"].includes(status)) return "border-rose-300/20 bg-rose-300/10 text-rose-100";
  return "border-white/10 bg-white/[0.04] text-white/65";
}

function jobStatusLabel(status: string) {
  if (["published", "validated", "succeeded"].includes(status)) return "เสร็จแล้ว";
  if (["scheduled", "queued", "preparing"].includes(status)) return "รอดำเนินการ";
  if (["processing", "executing", "running", "waiting_external", "waiting_ai", "validating", "retrying"].includes(status)) return "กำลังดำเนินการ";
  if (status === "awaiting_review") return "รอคุณตรวจ";
  if (status === "reconciliation-required" || status === "reconciliation_required") return "สถานะยังไม่ชัด ต้องตรวจอีกครั้ง";
  if (status === "failed") return "ไม่สำเร็จ";
  return "ต้องตรวจ";
}

function jobKindLabel(job: OperationsJob) {
  if (job.source === "agent-os") return "งานอัตโนมัติ · " + job.kind;
  if (job.kind === "Article publish") return "เผยแพร่บทความ";
  if (job.kind === "Article validation") return "ตรวจบทความก่อนเผยแพร่";
  if (job.kind.includes("analytics-sync")) return "อัปเดตผลลัพธ์โพสต์";
  if (job.kind.includes("status-sync")) return "ตรวจสถานะโพสต์";
  if (job.kind.includes("native-handoff")) return "ส่งต่องานไปยังแอปของแพลตฟอร์ม";
  if (job.kind.includes("comment-series")) return "ส่งชุดข้อความต่อเนื่อง";
  return "ส่งโพสต์";
}

function JobRow({ job }: { job: OperationsJob }) {
  return <tr className="border-t border-white/10 align-top">
    <td className="px-4 py-4"><div className="text-sm font-medium text-white/90">{job.source === "article-scheduler" ? "ตั้งเวลาเผยแพร่บทความ" : job.source === "agent-os" ? "Agent OS / n8n" : "ส่งโพสต์โซเชียล"}</div><div className="mt-1 max-w-[240px] break-all text-xs text-white/40">{job.objectId}</div></td>
    <td className="px-4 py-4"><div className="text-sm text-white/80">{jobKindLabel(job)}</div><details className="mt-1 text-xs text-white/45"><summary className="cursor-pointer">ดูรายละเอียดสำหรับตรวจสอบ</summary><p className="mt-1">{job.kind} · {job.detail}</p></details></td>
    <td className="px-4 py-4"><span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusTone(job.status)}`}>{jobStatusLabel(job.status)}</span>{job.locked ? <div className="mt-2 text-xs text-amber-100">ระบบกำลังทำงานถึง {formatDate(job.lockExpiresAt)}</div> : null}</td>
    <td className="px-4 py-4 text-sm text-white/60">{job.attempts ? `${job.attempts.current}/${job.attempts.max}` : "—"}</td>
    <td className="px-4 py-4 text-sm text-white/60"><div>{formatDate(job.updatedAt)}</div>{job.scheduledAt ? <div className="mt-1 text-xs text-white/40">นัดไว้ {formatDate(job.scheduledAt)}</div> : null}</td>
    <td className="px-4 py-4 text-xs text-rose-100/80">{job.error ? <details><summary className="cursor-pointer">มีรายละเอียดให้ตรวจ</summary><p className="mt-1 font-mono">{job.error}</p></details> : "—"}</td>
  </tr>;
}

export default async function AdminJobsPage() {
  await requireAdminPermission("settings:read");
  const model = await readOperationsJobs(30);
  return <div>
    <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">สำหรับตรวจสถานะระบบ</p>
    <h1 className="mt-2 text-3xl font-semibold">งานเบื้องหลัง</h1>
    <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">รวมงานตั้งเวลาเผยแพร่บทความและงานส่งโพสต์ เพื่อให้เห็นว่างานใดกำลังรอ กำลังทำ หรือมีปัญหา หน้านี้ดูข้อมูลได้อย่างเดียว</p>

    <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-sm text-white/55">ภาพรวม</p><p className="mt-2 text-2xl font-semibold">{model.status === "ready" ? "พร้อม" : model.status === "partial" ? "ข้อมูลบางส่วน" : "อ่านไม่ได้"}</p></section>
      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-sm text-white/55">ตั้งเวลาเผยแพร่บทความ</p><p className="mt-2 text-2xl font-semibold">{model.articleScheduler.ready ? model.articleScheduler.count : "—"}</p><p className="mt-1 text-xs text-white/40">รายการล่าสุดที่อ่านได้</p></section>
      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-sm text-white/55">ส่งโพสต์โซเชียล</p><p className="mt-2 text-2xl font-semibold">{model.socialPublication.ready ? model.socialPublication.count : "—"}</p><p className="mt-1 text-xs text-white/40">รายการล่าสุดที่อ่านได้</p></section>
      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-sm text-white/55">Agent OS / n8n</p><p className="mt-2 text-2xl font-semibold">{model.agentOs.ready ? model.agentOs.count : "—"}</p><p className="mt-1 text-xs text-white/40">งานที่มี Job ID กลางและติดตามสถานะได้</p></section>
    </div>

    {!model.articleScheduler.ready || !model.socialPublication.ready || !model.agentOs.ready ? <section className="mt-5 rounded-2xl border border-amber-200/15 bg-amber-200/[0.04] p-4 text-sm leading-6 text-white/65">{!model.articleScheduler.ready ? <p>ยังอ่านงานตั้งเวลาเผยแพร่บทความไม่ได้</p> : null}{!model.socialPublication.ready ? <p>ยังอ่านงานส่งโพสต์โซเชียลไม่ได้</p> : null}{!model.agentOs.ready ? <p>Agent OS runtime ยังไม่พร้อมหรือยังไม่ได้เปิด migration</p> : null}<details className="mt-2 text-xs text-white/45"><summary className="cursor-pointer">ดูรายละเอียดสำหรับทีมเทคนิค</summary><p className="mt-1 font-mono">{model.articleScheduler.error ?? "—"} · {model.socialPublication.error ?? "—"} · {model.agentOs.error ?? "—"}</p></details></section> : null}

    <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.035] p-5 md:p-6">
      <div><h2 className="text-xl font-semibold">งานล่าสุด</h2><p className="mt-1 text-sm text-white/55">เรียงตามเวลาที่ระบบอัปเดตล่าสุด · หน้านี้ไม่มีปุ่มสั่งทำซ้ำหรือยกเลิกงาน</p></div>
      {model.jobs.length ? <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10"><table className="min-w-[980px] w-full text-left"><thead className="bg-black/15 text-xs text-white/45"><tr><th className="px-4 py-3">งาน</th><th className="px-4 py-3">ประเภท</th><th className="px-4 py-3">สถานะ</th><th className="px-4 py-3">จำนวนครั้ง</th><th className="px-4 py-3">เวลา</th><th className="px-4 py-3">รายละเอียดปัญหา</th></tr></thead><tbody>{model.jobs.map((job) => <JobRow key={`${job.source}:${job.id}`} job={job} />)}</tbody></table></div> : <p className="mt-5 rounded-2xl border border-white/10 p-4 text-sm text-white/60">ระบบพร้อมและไม่มีงานในช่วงที่ตรวจ ซึ่งเป็นสถานะปกติ</p>}
    </section>
  </div>;
}
