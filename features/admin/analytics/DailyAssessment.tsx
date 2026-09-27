import Link from "next/link";
import type { DailyAssessmentView } from "@/lib/admin/analytics/assessment";

type AssessmentJob = NonNullable<DailyAssessmentView["latest"]>;
const date = (value: string | null) => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(value)) : "ยังไม่ระบุ";
const statuses: Record<string, string> = { queued: "รอโมเดลประเมิน", leased: "โมเดลกำลังประเมิน", succeeded: "ประเมินเสร็จแล้ว", failed: "รอบนี้ประเมินไม่สำเร็จ", "reconciliation-required": "ต้องตรวจสถานะงานก่อนประเมินใหม่", cancelled: "ยกเลิกรอบประเมิน" };
const review = (job: AssessmentJob) => job.reviewStatus === "approved" ? "เจ้าของตรวจทานแล้ว" : job.reviewStatus === "rejected" ? "เจ้าของไม่รับข้อเสนอนี้" : job.output ? "ข้อเสนอจากโมเดล · ยังไม่ได้ตรวจทาน" : "ยังไม่มีข้อเสนอให้ตรวจทาน";

function AssessmentResult({ job }: { job: AssessmentJob }) {
  const output = job.output;
  return <div className="mt-4 min-w-0 rounded-xl border border-white/15 bg-black/10 p-4">
    <p className="text-sm font-medium text-[#e0c985]">{review(job)}</p>
    <p className="mt-2 text-xs leading-5 text-white/65">{statuses[job.status] ?? `สถานะงาน: ${job.status}`} · เริ่มเมื่อ <time dateTime={job.createdAt}>{date(job.createdAt)}</time> (เวลาไทย){job.completedAt ? <> · เสร็จเมื่อ <time dateTime={job.completedAt}>{date(job.completedAt)}</time> (เวลาไทย)</> : null}</p>
    <p className="mt-1 break-words text-xs leading-5 text-white/60">โมเดลบน VPS: {job.modelName || "ยังไม่มีชื่อโมเดลที่บันทึกไว้"}{output ? ` · วันที่ประเมิน ${output.assessmentDate} · Prompt ${output.promptVersion}` : ""}</p>
    {output && job.reviewStatus !== "rejected" ? <>
      <ol className="mt-4 list-decimal space-y-5 pl-5">{output.findings.slice(0, 5).map(finding => <li key={finding.id} className="min-w-0 pl-1">
        <h3 className="break-words font-medium">{finding.label}</h3>
        <p className="mt-1 break-words text-sm leading-6 text-white/75">{finding.why}</p>
        <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-2">{finding.metrics.map((metric, index) => <div key={`${metric.name}-${index}`} className="min-w-0 text-xs"><dt className="break-words text-white/60">{metric.name}</dt><dd className="mt-1 font-medium">{metric.value === null ? "ไม่มีข้อมูล" : metric.value.toLocaleString("th-TH", { maximumFractionDigits: 4 })}</dd></div>)}</dl>
        {finding.evidenceIds.length ? <ul className="mt-2 space-y-1 text-xs leading-5 text-white/60">{output.evidence.filter(item => finding.evidenceIds.includes(item.id)).map(item => <li key={item.id} className="break-words">{item.report} · ช่วง {item.windowStart ?? "ไม่ระบุ"} ถึง {item.windowEnd ?? "ไม่ระบุ"} · ต้นทาง ณ {item.sourceAsOf ?? "ต้นทางไม่ได้ระบุ"} · เขตเวลา {item.nativeTimeZone ?? "ต้นทางไม่ได้ระบุ"}{item.truncated ? " · ข้อมูลมีการจำกัดจำนวน" : ""}</li>)}</ul> : <p className="mt-2 text-xs leading-5 text-white/60">รายการนี้ระบุสิ่งที่ต้องเชื่อมต่อเพิ่ม ยังไม่มีรายงานเป็นหลักฐาน</p>}
      </li>)}</ol>
      {output.limitations.length ? <ul className="mt-4 space-y-1 border-t border-white/10 pt-3 text-xs leading-5 text-amber-100">{output.limitations.map((note, index) => <li key={index} className="break-words">{note}</li>)}</ul> : null}
      <details className="mt-3"><summary className="min-h-11 cursor-pointer py-2 text-xs text-white/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e0c985]">ดูที่มาของรอบประเมิน</summary><p className="break-all text-xs leading-5 text-white/60">Snapshot: {output.snapshotHash}<br />งาน: {job.jobId}</p><ul className="mt-2 space-y-2 text-xs leading-5 text-white/60">{output.evidence.map(item => <li key={item.id} className="break-all">{item.report} · Batch {item.batchId}<br />Raw hash: {item.rawHash}</li>)}</ul></details>
    </> : null}
  </div>;
}

export function DailyAssessment({ assessment }: { assessment: DailyAssessmentView }) {
  const previous = assessment.lastGood && assessment.lastGood.jobId !== assessment.latest?.jobId ? assessment.lastGood : null;
  return <section className="mt-8 min-w-0 border-t border-white/15 pt-6" aria-labelledby="daily-assessment-heading">
    <h2 id="daily-assessment-heading" className="text-xl font-semibold">AI เสนองานตรวจจากข้อมูลที่มี</h2>
    <p className="mt-2 max-w-3xl text-sm leading-6 text-white/70">โมเดลบน VPS จัดลำดับงานจากหลักฐานที่บันทึกไว้ ตัวเลขและช่วงวันมาจากรายงานเดิม การเปิดหน้านี้ไม่เรียกโมเดลหรือ API ต้นทาง ข้อเสนอต้องผ่านเจ้าของตรวจทานก่อนนำไปใช้</p>
    <p className="mt-2 text-xs leading-5 text-white/60">รอบประเมินใช้ข้อมูลล่าสุดจากทุกแหล่งที่มี ไม่เปลี่ยนตามตัวกรองรายงานด้านบน และอาจใช้ข้อมูลคนละช่วงวัน</p>
    {assessment.state === "unavailable" ? <p className="mt-4 text-sm leading-6 text-amber-100">ยังอ่านสถานะการประเมินไม่ได้ รายงานและไฟล์ข้อมูลเดิมยังใช้งานได้</p> : null}
    {assessment.latest ? <AssessmentResult job={assessment.latest} /> : assessment.state === "ready" ? <p className="mt-4 text-sm leading-6 text-white/65">ยังไม่มีรอบประเมินที่บันทึกไว้ จึงยังไม่มีข้อเสนอจากโมเดล</p> : null}
    {previous ? <div className="mt-5"><h3 className="text-sm font-semibold">รอบก่อนหน้าที่ประเมินสำเร็จ</h3><p className="mt-1 text-xs leading-5 text-white/60">คงข้อเสนอเดิมไว้เมื่อรอบใหม่ยังไม่มีผลสำเร็จ อ่านวันที่และสถานะตรวจทานประกอบ</p><AssessmentResult job={previous} /></div> : null}
    <Link href="/operations/local-ai/" className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-white/20 px-4 py-2 text-sm text-[#e0c985] hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e0c985]">ดูสถานะงานและตรวจทานข้อเสนอ</Link>
  </section>;
}
