import { readLocalAiOperations, readLocalAiReviewQueue } from "@/lib/admin/local-ai/database";
import { requireAdminPermission } from "@/lib/admin/require-permission";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(value));
}

function tone(status: string) {
  if (status === "succeeded") return "border-emerald-300/20 bg-emerald-300/10 text-emerald-100";
  if (["queued", "leased"].includes(status)) return "border-amber-200/20 bg-amber-200/10 text-amber-50";
  if (["failed", "reconciliation-required"].includes(status)) return "border-rose-300/20 bg-rose-300/10 text-rose-100";
  return "border-white/10 bg-white/[0.04] text-white/65";
}

const taskLabels: Record<string, string> = {
  "privacy-redaction": "ปิดบังข้อมูลส่วนตัว",
  "line-intent": "แยกความสนใจจาก LINE",
  "content-operations": "เตรียมเนื้อหา",
  "seo-preprocessing": "จัดกลุ่มข้อมูล SEO",
};

const statusLabels: Record<string, string> = {
  queued: "รอประมวลผล",
  leased: "กำลังประมวลผล",
  succeeded: "เสร็จแล้ว",
  failed: "ไม่สำเร็จ",
  "reconciliation-required": "ต้องตรวจสอบ",
  cancelled: "ยกเลิกแล้ว",
};

const dataClassLabels: Record<string, string> = {
  "customer-private": "ข้อมูลลูกค้าที่ได้รับการป้องกัน",
  "public-safe": "ข้อมูลทั่วไป",
};

const reviewLabels: Record<string, string> = {
  pending: "รอคุณตรวจ",
  approved: "อนุมัติแล้ว",
  rejected: "ไม่ใช้ผลลัพธ์นี้",
};

export default async function LocalAiPage() {
  await requireAdminPermission("settings:read");
  const [model, reviews] = await Promise.all([readLocalAiOperations(30), readLocalAiReviewQueue(25)]);
  const incidents = model.status === "ready" && model.health ? [
    !model.health.workerFresh ? "ไม่พบสัญญาณจาก worker ภายใน 90 วินาที" : null,
    model.health.ollamaReady === false ? "Ollama หรือโมเดลที่กำหนดยังไม่พร้อม" : null,
    model.health.failed24h > 0 ? `มีงานล้มเหลว ${model.health.failed24h} งานใน 24 ชั่วโมงล่าสุด` : null,
    model.health.oldestQueueSeconds > 900 ? `งานที่รอนานที่สุดเกิน 15 นาที (${Math.round(model.health.oldestQueueSeconds / 60)} นาที)` : null,
  ].filter((message): message is string => Boolean(message)) : [];

  return <div>
    <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">AI ภายในของ CCPun</p>
    <h1 className="mt-2 text-3xl font-semibold">ผู้ช่วย AI ภายในระบบ</h1>
    <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">ดูสถานะงานที่ให้ AI ภายในช่วยเตรียม ผลลัพธ์ทุกชิ้นต้องผ่านคนตรวจก่อนส่งต่อ คำอธิบายการ์ด LINE จะบันทึกเมื่อคุณกดอนุมัติเท่านั้น และระบบจะไม่เผยแพร่บทความอัตโนมัติ</p>

    <div className="mt-7 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-sm text-white/55">ระบบ AI ภายใน</p><p className="mt-2 text-xl font-semibold">{model.status === "ready" ? "พร้อมใช้งาน" : model.status === "not-configured" ? "ยังไม่เปิดใช้งาน" : "ติดต่อระบบไม่ได้"}</p></section>
      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-sm text-white/55">เครื่องประมวลผล</p><p className="mt-2 text-xl font-semibold">{model.health?.workerFresh && model.health.ollamaReady ? "พร้อม" : "ยังไม่พร้อม"}</p><p className="mt-1 text-xs text-white/40">ตรวจพบล่าสุด {formatDate(model.health?.workerLastSeenAt ?? null)}</p></section>
      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-sm text-white/55">รอทำ / กำลังทำ</p><p className="mt-2 text-xl font-semibold">{model.health ? `${model.health.queued} / ${model.health.activeJobCount ?? 0}` : "—"}</p></section>
      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-sm text-white/55">งานที่เกี่ยวกับลูกค้า</p><p className="mt-2 text-xl font-semibold">{model.health?.privateJobs ?? "—"}</p><p className="mt-1 text-xs text-white/40">แสดงเฉพาะผลที่ผ่านการตรวจรูปแบบแล้ว</p></section>
      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-sm text-white/55">รอคนตรวจ</p><p className="mt-2 text-xl font-semibold">{model.health?.pendingReview ?? "—"}</p><p className="mt-1 text-xs text-white/40">AI ไม่มีสิทธิ์อนุมัติเอง</p></section>
      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-sm text-white/55">เวลาประมวลผล P95</p><p className="mt-2 text-xl font-semibold">{model.health ? `${Math.round(model.health.durationP95Ms / 1000)} วินาที` : "—"}</p><p className="mt-1 text-xs text-white/40">จากงาน 24 ชั่วโมงล่าสุด</p></section>
    </div>

    <section className="mt-5 rounded-2xl border border-[#e0c985]/20 bg-[#e0c985]/[0.06] p-4 text-sm leading-6 text-white/70">
      <strong className="text-[#f4df9b]">ข้อมูลลูกค้าถูกป้องกันอย่างไร:</strong> ระบบจะล็อกข้อมูลก่อนบันทึก เปิดอ่านเฉพาะตอนที่ AI ภายในกำลังทำงาน และไม่ส่งข้อความต้นฉบับหรือกุญแจเปิดข้อมูลไปยัง n8n
    </section>

    {model.error ? <p className="mt-5 rounded-2xl border border-rose-300/15 bg-rose-300/[0.04] p-4 text-sm text-rose-100">ขณะนี้ยังเชื่อมต่อระบบ AI ภายในไม่ได้ กรุณาลองใหม่อีกครั้งหรือตรวจหน้าภาพรวมระบบ</p> : null}

    {incidents.length ? <section role="alert" className="mt-5 border-l-4 border-rose-400 bg-rose-950/45 px-5 py-4 text-rose-50">
      <h2 className="font-semibold">Local AI ต้องตรวจสอบ</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6">{incidents.map((incident) => <li key={incident}>{incident}</li>)}</ul>
      <p className="mt-3 text-xs text-rose-100/70">พัก workflow ที่เกี่ยวข้องและตรวจ health/incident metadata ก่อนส่งงานใหม่ ห้ามคัดลอก prompt หรือข้อมูลลูกค้าไปในรายงานเหตุขัดข้อง</p>
    </section> : null}

    <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.035] p-5 md:p-6">
      <div><h2 className="text-xl font-semibold">งานล่าสุด</h2><p className="mt-1 text-sm text-white/55">หน้านี้ไม่แสดงข้อความต้นฉบับ กุญแจ หรือข้อมูลส่วนตัวของลูกค้า</p></div>
      {model.jobs.length ? <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10"><table className="min-w-[900px] w-full text-left"><thead className="bg-black/15 text-xs text-white/45"><tr><th className="px-4 py-3">เลขอ้างอิง</th><th className="px-4 py-3">งานที่ให้ช่วย</th><th className="px-4 py-3">สถานะ</th><th className="px-4 py-3">คิว</th><th className="px-4 py-3">จำนวนครั้ง</th><th className="px-4 py-3">อัปเดตล่าสุด</th></tr></thead><tbody>{model.jobs.map((job) => <tr key={job.id} className="border-t border-white/10 align-top"><td className="px-4 py-4 text-xs text-white/50">{job.id.slice(0, 8).toUpperCase()}</td><td className="px-4 py-4"><div className="text-sm text-white/85">{taskLabels[job.taskType] ?? "งานช่วยเตรียมข้อมูล"}</div><div className="mt-1 text-xs text-white/45">{dataClassLabels[job.dataClass] ?? "ข้อมูลที่ได้รับการป้องกัน"}</div></td><td className="px-4 py-4"><span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${tone(job.status)}`}>{statusLabels[job.status] ?? "กำลังตรวจสอบ"}</span>{job.reviewStatus ? <div className="mt-2 text-xs text-white/55">{reviewLabels[job.reviewStatus]}</div> : null}{job.errorCategory ? <div className="mt-2 text-xs text-rose-100">โปรดตรวจสอบงานนี้อีกครั้ง</div> : null}</td><td className="px-4 py-4 text-sm text-white/60">{job.queueClass === "urgent" ? "เร่งด่วน" : "งานชุด"}</td><td className="px-4 py-4 text-sm text-white/60">{job.attempts.current} จาก {job.attempts.max}</td><td className="px-4 py-4 text-sm text-white/60">{formatDate(job.updatedAt)}</td></tr>)}</tbody></table></div> : <p className="mt-5 rounded-2xl border border-white/10 p-4 text-sm text-white/60">ยังไม่มีงาน หรือระบบ AI ภายในยังไม่เปิดใช้งาน</p>}
    </section>

    <section className="mt-6 space-y-4">
      <div><h2 className="text-xl font-semibold">ผลลัพธ์ที่รอคุณตรวจ</h2><p className="mt-1 text-sm text-white/55">งานทั่วไปจะเปิดให้ workflow อ่านผล ส่วนคำอธิบายการ์ด LINE จะบันทึกในบทความหลังคุณอนุมัติ โดยไม่แก้คำอธิบายของ Google</p></div>
      {reviews.map((review) => {
        const isLineDescription = "mode" in review.output && review.output.mode === "line-card-description";
        return <article key={`review-${review.jobId}`} className="rounded-3xl border border-[#e0c985]/20 bg-[#e0c985]/[0.05] p-5 md:p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between"><div><p className="text-xs text-[#e0c985]">{taskLabels[review.taskType]}</p><h3 className="mt-1 font-semibold">งาน {review.jobId.slice(0, 8).toUpperCase()}</h3></div><p className="text-xs text-white/45">ผลจากโมเดลต้องผ่านการตัดสินใจของคุณ</p></div>
        <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap rounded-2xl bg-black/25 p-4 text-xs leading-6 text-white/75">{JSON.stringify(review.output, null, 2)}</pre>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <form action="/api/admin/local-ai/review/" method="post"><input type="hidden" name="jobId" value={review.jobId} /><input type="hidden" name="decision" value="approve" /><button className="min-h-11 w-full rounded-xl border border-emerald-300/25 bg-emerald-300/10 px-4 py-2 text-sm font-semibold text-emerald-100" type="submit">{isLineDescription ? "อนุมัติและบันทึกคำอธิบาย LINE" : "อนุมัติให้ workflow อ่านผล"}</button></form>
          <form action="/api/admin/local-ai/review/" method="post" className="flex flex-col gap-2"><input type="hidden" name="jobId" value={review.jobId} /><input type="hidden" name="decision" value="reject" /><label className="text-xs text-white/55" htmlFor={`reason-${review.jobId}`}>เหตุผลที่ไม่ใช้ผลลัพธ์</label><textarea id={`reason-${review.jobId}`} name="reason" required maxLength={1000} className="min-h-20 rounded-xl border border-white/10 bg-black/20 p-3 text-sm" /><button className="min-h-11 rounded-xl border border-rose-300/25 bg-rose-300/10 px-4 py-2 text-sm font-semibold text-rose-100" type="submit">ปฏิเสธผลลัพธ์</button></form>
        </div>
      </article>;
      })}
      {reviews.length === 0 ? <p className="rounded-2xl border border-white/10 p-4 text-sm text-white/60">ไม่มีผลลัพธ์ที่รอตรวจ</p> : null}
    </section>
  </div>;
}
