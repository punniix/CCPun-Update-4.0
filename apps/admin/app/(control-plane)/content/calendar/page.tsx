import Link from "next/link";
import { requireAdminPermission } from "@/lib/admin/require-permission";
import { listAdminArticles } from "@/lib/admin/sanity-control";
import { readArticleSchedulerModel, type ArticleScheduleRecord } from "@/lib/admin/operations/article-scheduler-read-model";

function formatBangkok(value: string) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
}

function dayKey(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
}

function dayLabel(value: string) {
  return new Intl.DateTimeFormat("th-TH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
}

function statusTone(status: string) {
  if (["published", "validated"].includes(status)) return "border-emerald-300/20 bg-emerald-300/10 text-emerald-100";
  if (["preparing", "scheduled", "executing"].includes(status)) return "border-amber-200/20 bg-amber-200/10 text-amber-50";
  if (["failed", "reconciliation-required", "stale"].includes(status)) return "border-rose-300/20 bg-rose-300/10 text-rose-100";
  return "border-white/10 bg-white/[0.04] text-white/65";
}

function statusLabel(status: string) {
  if (status === "published") return "เผยแพร่แล้ว";
  if (status === "validated") return "ตรวจพร้อมแล้ว";
  if (status === "preparing") return "กำลังเตรียม";
  if (status === "scheduled") return "ตั้งเวลาแล้ว";
  if (status === "executing") return "กำลังเผยแพร่";
  if (status === "reconciliation-required") return "สถานะยังไม่ชัด ต้องตรวจอีกครั้ง";
  if (status === "stale") return "บทความเปลี่ยนแล้ว ต้องตั้งเวลาใหม่";
  if (status === "failed") return "ไม่สำเร็จ";
  if (status === "cancelled") return "ยกเลิกแล้ว";
  return "ต้องตรวจ";
}

function CalendarRecord({ record, title }: { record: ArticleScheduleRecord; title: string }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-white/45">{formatBangkok(record.scheduled_at)}</p>
          <h3 className="mt-1 text-sm font-semibold text-white/90">{title}</h3>
          <p className="mt-1 break-all font-mono text-xs text-white/35">{record.article_id}</p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusTone(record.status)}`}>{statusLabel(record.status)}</span>
      </div>
      <dl className="mt-4 grid gap-2 text-xs text-white/55 sm:grid-cols-3">
        <div><dt className="text-white/35">การทำงาน</dt><dd className="mt-0.5">{record.mode === "publish" ? "เผยแพร่" : "ตรวจความพร้อมเท่านั้น"}</dd></div>
        <div><dt className="text-white/35">อัปเดตล่าสุด</dt><dd className="mt-0.5">{formatBangkok(record.updated_at)}</dd></div>
        <div><dt className="text-white/35">ผู้ตั้งเวลา</dt><dd className="mt-0.5 break-all">{record.created_by}</dd></div>
      </dl>
      {record.error_code ? <details className="mt-3 text-xs text-rose-100"><summary className="cursor-pointer">มีรายละเอียดปัญหาให้ตรวจ</summary><p className="mt-1 font-mono">{record.error_code}</p></details> : null}
    </article>
  );
}

export default async function ContentCalendarPage() {
  await requireAdminPermission("content:read");
  const [scheduler, articles] = await Promise.all([
    readArticleSchedulerModel({ scheduleLimit: 120, auditLimit: 1 }),
    listAdminArticles(),
  ]);

  const titleById = new Map(
    articles.rows.map((article) => [article.id.replace(/^drafts\./, ""), article.title || article.id]),
  );
  const records = [...scheduler.schedules].sort((a, b) => Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at));
  const groups = new Map<string, ArticleScheduleRecord[]>();
  for (const record of records) {
    const key = dayKey(record.scheduled_at);
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">เนื้อหา</p>
      <h1 className="mt-2 text-3xl font-semibold">ปฏิทินเผยแพร่</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">
        ดูเวลาที่ตั้งไว้และสถานะของบทความจากคิวเผยแพร่จริง ข้อมูลในหน้านี้จึงตรงกับงานที่ระบบกำลังใช้
      </p>

      <div className="mt-7 grid gap-4 md:grid-cols-4">
        <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-sm text-white/50">อ่านข้อมูลคิว</p><p className="mt-2 text-xl font-semibold">{scheduler.status === "ready" ? "พร้อม" : "อ่านไม่ได้"}</p></section>
        <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-sm text-white/50">รับงานจากศูนย์จัดการ</p><p className="mt-2 text-xl font-semibold">{scheduler.runtimeEnabled ? "เปิด" : "ปิด"}</p></section>
        <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-sm text-white/50">รับคิวใหม่</p><p className="mt-2 text-xl font-semibold">{scheduler.effectiveEnabled ? "พร้อม" : "ยังไม่พร้อม"}</p></section>
        <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-sm text-white/50">รายการตั้งเวลา</p><p className="mt-2 text-xl font-semibold">{scheduler.status === "ready" ? records.length.toLocaleString("th-TH") : "—"}</p></section>
      </div>

      {!scheduler.effectiveEnabled ? (
        <section className="mt-5 rounded-2xl border border-amber-200/20 bg-amber-200/[0.06] p-4 text-sm leading-6 text-amber-50/90">
          ระบบยังไม่รับคิวใหม่จนกว่าสวิตช์ความปลอดภัยทั้งสองส่วนจะพร้อม หากต้องเปิดใช้งาน กรุณาให้เจ้าของระบบตรวจการเชื่อมต่อก่อน
        </section>
      ) : null}

      {scheduler.error ? (
        <section className="mt-5 rounded-2xl border border-rose-300/20 bg-rose-300/[0.06] p-4 text-sm text-rose-100">ยังอ่านคิวเผยแพร่ไม่ได้ กรุณาลองใหม่หรือตรวจหน้าสถานะระบบ</section>
      ) : null}

      {scheduler.status === "ready" && records.length === 0 ? (
        <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.025] p-7 text-center">
          <h2 className="text-lg font-semibold">ยังไม่มีรายการตั้งเวลา</h2>
          <p className="mt-2 text-sm text-white/55">ระบบพร้อมและไม่มีบทความตั้งเวลาในช่วงที่อ่านได้</p>
          <Link href="/content/articles/" className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-white/15 px-4 py-2 text-sm text-white/80 hover:bg-white/5">ไปที่บทความ</Link>
        </section>
      ) : null}

      {records.length > 0 ? (
        <div className="mt-6 space-y-6">
          {[...groups.entries()].map(([key, items]) => (
            <section key={key} className="rounded-3xl border border-white/10 bg-white/[0.02] p-5 md:p-6">
              <div className="flex items-center justify-between gap-4"><h2 className="text-lg font-semibold">{dayLabel(items[0].scheduled_at)}</h2><span className="text-xs text-white/40">{items.length} รายการ</span></div>
              <div className="mt-4 grid gap-3 xl:grid-cols-2">{items.map((record) => <CalendarRecord key={record.generation} record={record} title={titleById.get(record.article_id) ?? record.article_id} />)}</div>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}
