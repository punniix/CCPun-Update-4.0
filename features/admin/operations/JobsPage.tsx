import { readOperationsJobs, type OperationsJob } from "@/lib/admin/operations/jobs-read-model";
import { requireAdminPermission } from "@/lib/admin/require-permission";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(value));
}

function statusTone(status: string) {
  if (["published", "validated", "succeeded"].includes(status)) return "border-emerald-300/20 bg-emerald-300/10 text-emerald-100";
  if (["scheduled", "queued", "processing", "executing", "preparing"].includes(status)) return "border-amber-200/20 bg-amber-200/10 text-amber-50";
  if (["failed", "reconciliation-required"].includes(status)) return "border-rose-300/20 bg-rose-300/10 text-rose-100";
  return "border-white/10 bg-white/[0.04] text-white/65";
}

function JobRow({ job }: { job: OperationsJob }) {
  return <tr className="border-t border-white/10 align-top">
    <td className="px-4 py-4"><div className="text-sm font-medium text-white/90">{job.source === "article-scheduler" ? "Article Scheduler" : "Social Publication"}</div><div className="mt-1 max-w-[240px] break-all text-xs text-white/40">{job.objectId}</div></td>
    <td className="px-4 py-4"><div className="text-sm text-white/80">{job.kind}</div><div className="mt-1 text-xs text-white/45">{job.detail}</div></td>
    <td className="px-4 py-4"><span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusTone(job.status)}`}>{job.status}</span>{job.locked ? <div className="mt-2 text-xs text-amber-100">มี active lock ถึง {formatDate(job.lockExpiresAt)}</div> : null}</td>
    <td className="px-4 py-4 text-sm text-white/60">{job.attempts ? `${job.attempts.current}/${job.attempts.max}` : "—"}</td>
    <td className="px-4 py-4 text-sm text-white/60"><div>{formatDate(job.updatedAt)}</div>{job.scheduledAt ? <div className="mt-1 text-xs text-white/40">นัดไว้ {formatDate(job.scheduledAt)}</div> : null}</td>
    <td className="px-4 py-4 text-xs text-rose-100/80">{job.error ?? "—"}</td>
  </tr>;
}

export default async function AdminJobsPage() {
  await requireAdminPermission("settings:read");
  const model = await readOperationsJobs(30);
  return <div>
    <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">OWNER DIAGNOSTICS</p>
    <h1 className="mt-2 text-3xl font-semibold">Operations Jobs</h1>
    <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">รวมสถานะ Article Scheduler และ Social publication jobs แบบอ่านอย่างเดียว เพื่อให้เห็น queue, retry, lock และ failure โดยไม่ claim job, retry, cancel หรือเปลี่ยน durable state</p>

    <div className="mt-7 grid gap-4 md:grid-cols-3">
      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-sm text-white/55">ภาพรวม</p><p className="mt-2 text-2xl font-semibold">{model.status === "ready" ? "พร้อม" : model.status === "partial" ? "ข้อมูลบางส่วน" : "อ่านไม่ได้"}</p></section>
      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-sm text-white/55">Article Scheduler</p><p className="mt-2 text-2xl font-semibold">{model.articleScheduler.ready ? model.articleScheduler.count : "—"}</p><p className="mt-1 text-xs text-white/40">รายการล่าสุดที่อ่านได้</p></section>
      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-sm text-white/55">Social jobs</p><p className="mt-2 text-2xl font-semibold">{model.socialPublication.ready ? model.socialPublication.count : "—"}</p><p className="mt-1 text-xs text-white/40">รายการล่าสุดที่อ่านได้</p></section>
    </div>

    {!model.articleScheduler.ready || !model.socialPublication.ready ? <section className="mt-5 rounded-2xl border border-amber-200/15 bg-amber-200/[0.04] p-4 text-sm leading-6 text-white/65">{!model.articleScheduler.ready ? <p>Article Scheduler: {model.articleScheduler.error ?? "not ready"}</p> : null}{!model.socialPublication.ready ? <p>Social publication: {model.socialPublication.error ?? "not ready"}</p> : null}</section> : null}

    <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.035] p-5 md:p-6">
      <div><h2 className="text-xl font-semibold">Recent jobs</h2><p className="mt-1 text-sm text-white/55">เรียงตามเวลาที่ระบบอัปเดตล่าสุด · หน้านี้ไม่มีปุ่ม execute / retry / cancel</p></div>
      {model.jobs.length ? <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10"><table className="min-w-[980px] w-full text-left"><thead className="bg-black/15 text-xs text-white/45"><tr><th className="px-4 py-3">Source / Object</th><th className="px-4 py-3">ประเภท</th><th className="px-4 py-3">สถานะ</th><th className="px-4 py-3">Attempts</th><th className="px-4 py-3">เวลา</th><th className="px-4 py-3">Error</th></tr></thead><tbody>{model.jobs.map((job) => <JobRow key={`${job.source}:${job.id}`} job={job} />)}</tbody></table></div> : <p className="mt-5 rounded-2xl border border-white/10 p-4 text-sm text-white/60">Data plane พร้อม แต่ยังไม่มี job ในช่วงที่อ่านได้ นี่เป็น healthy zero ไม่ใช่การเชื่อมต่อขัดข้อง</p>}
    </section>
  </div>;
}
