import { readLocalAiOperations } from "@/lib/admin/local-ai/database";
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

export default async function LocalAiPage() {
  await requireAdminPermission("settings:read");
  const model = await readLocalAiOperations(30);

  return <div>
    <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">AI ภายในของ CCPun</p>
    <h1 className="mt-2 text-3xl font-semibold">ผู้ช่วย AI ภายในระบบ</h1>
    <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">ดูสถานะงานที่ให้ AI ภายในช่วยเตรียม โดยข้อมูลลูกค้าจะถูกป้องกันก่อนส่งและเปิดอ่านเฉพาะช่วงที่เครื่องของ CCPun กำลังประมวลผลเท่านั้น</p>

    <div className="mt-7 grid gap-4 md:grid-cols-4">
      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-sm text-white/55">ระบบ AI ภายใน</p><p className="mt-2 text-xl font-semibold">{model.status === "ready" ? "พร้อมใช้งาน" : model.status === "not-configured" ? "ยังไม่เปิดใช้งาน" : "ติดต่อระบบไม่ได้"}</p></section>
      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-sm text-white/55">เครื่องประมวลผล</p><p className="mt-2 text-xl font-semibold">{model.health?.workerFresh && model.health.ollamaReady ? "พร้อม" : "ยังไม่พร้อม"}</p><p className="mt-1 text-xs text-white/40">ตรวจพบล่าสุด {formatDate(model.health?.workerLastSeenAt ?? null)}</p></section>
      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-sm text-white/55">รอทำ / กำลังทำ</p><p className="mt-2 text-xl font-semibold">{model.health ? `${model.health.queued} / ${model.health.activeJobCount ?? 0}` : "—"}</p></section>
      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-sm text-white/55">งานที่เกี่ยวกับลูกค้า</p><p className="mt-2 text-xl font-semibold">{model.health?.privateJobs ?? "—"}</p><p className="mt-1 text-xs text-white/40">แสดงเฉพาะผลที่ผ่านการตรวจรูปแบบแล้ว</p></section>
    </div>

    <section className="mt-5 rounded-2xl border border-[#e0c985]/20 bg-[#e0c985]/[0.06] p-4 text-sm leading-6 text-white/70">
      <strong className="text-[#f4df9b]">ข้อมูลลูกค้าถูกป้องกันอย่างไร:</strong> ระบบจะล็อกข้อมูลก่อนบันทึก เปิดอ่านเฉพาะตอนที่ AI ภายในกำลังทำงาน และไม่ส่งข้อความต้นฉบับหรือกุญแจเปิดข้อมูลไปยัง n8n
    </section>

    {model.error ? <p className="mt-5 rounded-2xl border border-rose-300/15 bg-rose-300/[0.04] p-4 text-sm text-rose-100">ขณะนี้ยังเชื่อมต่อระบบ AI ภายในไม่ได้ กรุณาลองใหม่อีกครั้งหรือตรวจหน้า System Health</p> : null}

    <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.035] p-5 md:p-6">
      <div><h2 className="text-xl font-semibold">งานล่าสุด</h2><p className="mt-1 text-sm text-white/55">หน้านี้ไม่แสดงข้อความต้นฉบับ กุญแจ หรือข้อมูลส่วนตัวของลูกค้า</p></div>
      {model.jobs.length ? <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10"><table className="min-w-[820px] w-full text-left"><thead className="bg-black/15 text-xs text-white/45"><tr><th className="px-4 py-3">เลขอ้างอิง</th><th className="px-4 py-3">งานที่ให้ช่วย</th><th className="px-4 py-3">สถานะ</th><th className="px-4 py-3">จำนวนครั้ง</th><th className="px-4 py-3">อัปเดตล่าสุด</th></tr></thead><tbody>{model.jobs.map((job) => <tr key={job.id} className="border-t border-white/10 align-top"><td className="px-4 py-4 text-xs text-white/50">{job.id.slice(0, 8).toUpperCase()}</td><td className="px-4 py-4"><div className="text-sm text-white/85">{taskLabels[job.taskType] ?? "งานช่วยเตรียมข้อมูล"}</div><div className="mt-1 text-xs text-white/45">{dataClassLabels[job.dataClass] ?? "ข้อมูลที่ได้รับการป้องกัน"}</div></td><td className="px-4 py-4"><span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${tone(job.status)}`}>{statusLabels[job.status] ?? "กำลังตรวจสอบ"}</span>{job.errorCategory ? <div className="mt-2 text-xs text-rose-100">โปรดตรวจสอบงานนี้อีกครั้ง</div> : null}</td><td className="px-4 py-4 text-sm text-white/60">{job.attempts.current} จาก {job.attempts.max}</td><td className="px-4 py-4 text-sm text-white/60">{formatDate(job.updatedAt)}</td></tr>)}</tbody></table></div> : <p className="mt-5 rounded-2xl border border-white/10 p-4 text-sm text-white/60">ยังไม่มีงาน หรือระบบ AI ภายในยังไม่เปิดใช้งาน</p>}
    </section>
  </div>;
}
