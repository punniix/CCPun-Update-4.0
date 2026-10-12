type CalendarCopy = { disabledHint: string; intro: string; emptyHint: string; eyebrow: string; title: string; dataHeading: string; runtimeHeading: string; durableHeading: string; recordsHeading: string; articlesLink: string; modeHeading: string; readReady: string; status: (status: string) => string; mode: (mode: string) => string; queueReady: (durable: boolean, effective: boolean) => string; readFailure: (error: string) => string; showErrorDetails: boolean; hideCancelled: boolean };
import { formatBangkok, dayKey, dayLabel, statusTone } from "@/lib/admin/operations/page-presentation";
import Link from "next/link";
import { requireAdminPermission } from "@/lib/admin/require-permission";
import { listAdminArticles } from "@/lib/admin/sanity-control";
import { readArticleSchedulerModel, type ArticleScheduleRecord } from "@/lib/admin/operations/article-scheduler-read-model";









function CalendarRecord({ record, title, copy }: { record: ArticleScheduleRecord; title: string; copy: CalendarCopy }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-white/45">{formatBangkok(record.scheduled_at)}</p>
          <h3 className="mt-1 text-sm font-semibold text-white/90">{title}</h3>
          <p className="mt-1 break-all font-mono text-xs text-white/35">{record.article_id}</p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusTone(record.status)}`}>{copy.status(record.status)}</span>
      </div>
      <dl className="mt-4 grid gap-2 text-xs text-white/55 sm:grid-cols-3">
        <div><dt className="text-white/35">{copy.modeHeading}</dt><dd className="mt-0.5">{copy.mode(record.mode)}</dd></div>
        <div><dt className="text-white/35">อัปเดตล่าสุด</dt><dd className="mt-0.5">{formatBangkok(record.updated_at)}</dd></div>
        <div><dt className="text-white/35">ผู้ตั้งเวลา</dt><dd className="mt-0.5 break-all">{record.created_by}</dd></div>
      </dl>
      {record.error_code ? copy.showErrorDetails ? <details className="mt-3 text-xs text-rose-100"><summary className="cursor-pointer">มีรายละเอียดปัญหาให้ตรวจ</summary><p className="mt-1 font-mono">{record.error_code}</p></details> : <p className="mt-3 text-xs text-rose-100">Error: {record.error_code}</p> : null}
    </article>
  );
}

export async function ContentCalendarPage(copy: CalendarCopy) {
  await requireAdminPermission("content:read");
  const [scheduler, articles] = await Promise.all([
    readArticleSchedulerModel({ scheduleLimit: 120, auditLimit: 1 }),
    listAdminArticles(),
  ]);

  const titleById = new Map(
    articles.rows.map((article) => [article.id.replace(/^drafts\./, ""), article.title || article.id]),
  );
  const records = (copy.hideCancelled ? scheduler.schedules.filter((record) => record.status !== "cancelled") : [...scheduler.schedules]).sort((a, b) => Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at));
  const groups = new Map<string, ArticleScheduleRecord[]>();
  for (const record of records) {
    const key = dayKey(record.scheduled_at);
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">{copy.eyebrow}</p>
      <h1 className="mt-2 text-3xl font-semibold">{copy.title}</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">
        {copy.intro}
      </p>

      <div className="mt-7 grid gap-4 md:grid-cols-4">
        <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-sm text-white/50">{copy.dataHeading}</p><p className="mt-2 text-xl font-semibold">{scheduler.status === "ready" ? copy.readReady : "อ่านไม่ได้"}</p></section>
        <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-sm text-white/50">{copy.runtimeHeading}</p><p className="mt-2 text-xl font-semibold">{scheduler.runtimeEnabled ? "เปิด" : "ปิด"}</p></section>
        <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-sm text-white/50">{copy.durableHeading}</p><p className="mt-2 text-xl font-semibold">{copy.queueReady(scheduler.durableEnabled, scheduler.effectiveEnabled)}</p></section>
        <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-sm text-white/50">{copy.recordsHeading}</p><p className="mt-2 text-xl font-semibold">{scheduler.status === "ready" ? records.length.toLocaleString("th-TH") : "—"}</p></section>
      </div>

      {!scheduler.effectiveEnabled ? (
        <section className="mt-5 rounded-2xl border border-amber-200/20 bg-amber-200/[0.06] p-4 text-sm leading-6 text-amber-50/90">
          {copy.disabledHint}
        </section>
      ) : null}

      {scheduler.error ? (
        <section className="mt-5 rounded-2xl border border-rose-300/20 bg-rose-300/[0.06] p-4 text-sm text-rose-100">{copy.readFailure(scheduler.error)}</section>
      ) : null}

      {scheduler.status === "ready" && records.length === 0 ? (
        <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.025] p-7 text-center">
          <h2 className="text-lg font-semibold">ยังไม่มีรายการตั้งเวลา</h2>
          <p className="mt-2 text-sm text-white/55">{copy.emptyHint}</p>
          <Link href="/content/articles/" className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-white/15 px-4 py-2 text-sm text-white/80 hover:bg-white/5">{copy.articlesLink}</Link>
        </section>
      ) : null}

      {records.length > 0 ? (
        <div className="mt-6 space-y-6">
          {[...groups.entries()].map(([key, items]) => (
            <section key={key} className="rounded-3xl border border-white/10 bg-white/[0.02] p-5 md:p-6">
              <div className="flex items-center justify-between gap-4"><h2 className="text-lg font-semibold">{dayLabel(items[0].scheduled_at)}</h2><span className="text-xs text-white/40">{items.length} รายการ</span></div>
              <div className="mt-4 grid gap-3 xl:grid-cols-2">{items.map((record) => <CalendarRecord key={record.generation} record={record} title={titleById.get(record.article_id) ?? record.article_id} copy={copy} />)}</div>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}
