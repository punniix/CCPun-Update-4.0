import type { Metadata } from "next";
import Link from "next/link";
import { readGrowthSources } from "@/lib/admin/growth";
import { requireAdminPermission } from "@/lib/admin/require-permission";
import { listResearchSnapshots } from "@/lib/admin/research";
import { normalizeResearchKeyword, researchOpportunityScore } from "@/lib/admin/research-input";
import { listAdminArticles } from "@/lib/admin/sanity-control";

export const metadata: Metadata = { title: "ภาพรวมการเติบโต" };

const sourceLabels = { gsc: "Google Search Console", ga4: "Google Analytics 4", vercel: "Vercel Health" } as const;

export default async function GrowthDashboardPage() {
  await requireAdminPermission("dashboard:read");
  const [sources, research, articles] = await Promise.all([readGrowthSources(), listResearchSnapshots(), listAdminArticles()]);
  const covered = new Set(articles.rows.flatMap((article) => [article.primaryKeyword, ...(article.secondaryKeywords ?? [])]).filter((value): value is string => Boolean(value)).map(normalizeResearchKeyword));
  const opportunities = research.rows
    .map((row) => ({ ...row, covered: covered.has(normalizeResearchKeyword(row.keyword)), score: researchOpportunityScore(row.volume, row.difficulty) }))
    .filter((row) => !row.covered && row.score != null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 5);

  return <div>
    <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">หลักฐานเพื่อเลือกงานถัดไป</p>
    <h1 className="mt-2 text-3xl font-semibold">ภาพรวมการเติบโต</h1>
    <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">แต่ละแหล่งข้อมูลแยกจากกัน ระบบไม่เติมเลขศูนย์ ไม่เดาผล และไม่สรุปว่า metric ใดเป็นสาเหตุของอันดับ ยอดขาย หรือลูกค้า</p>

    <section className="mt-7 grid gap-4 xl:grid-cols-3" aria-label="สถานะแหล่งข้อมูล">
      {sources.map((source) => <article key={source.source} className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
        <div className="flex items-start justify-between gap-3"><h2 className="font-semibold">{sourceLabels[source.source]}</h2><span className={`rounded-full px-2.5 py-1 text-xs ${source.state === "ready" ? "bg-emerald-300/10 text-emerald-200" : source.state === "unavailable" ? "bg-red-300/10 text-red-200" : "bg-white/5 text-white/60"}`}>{source.state === "ready" ? "อ่านข้อมูลได้" : source.state === "unavailable" ? "ดึงข้อมูลไม่สำเร็จ" : "ยังไม่เชื่อมต่อ"}</span></div>
        {source.dateRange ? <p className="mt-2 text-xs text-white/50">ช่วงข้อมูล: {source.dateRange}</p> : null}
        {source.fetchedAt ? <p className="mt-1 text-xs text-white/50">อัปเดตล่าสุด: {new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(source.fetchedAt))}</p> : null}
        <p className="mt-1 text-xs text-white/50">เปรียบเทียบ: {source.comparison ?? "ยังไม่มีข้อมูลช่วงก่อนหน้า"}</p>
        {source.metrics.length ? <dl className="mt-4 grid gap-3 sm:grid-cols-2">{source.metrics.map((metric) => <div key={metric.label} className="rounded-xl bg-black/10 p-3"><dt className="text-xs leading-5 text-white/55">{metric.label}</dt><dd className="mt-1 text-lg font-semibold">{metric.value}</dd></div>)}</dl> : null}
        <p className="mt-4 text-sm leading-6 text-white/60">{source.limitation}</p>
      </article>)}
    </section>

    <section className="mt-7 rounded-3xl border border-white/10 bg-white/[0.025] p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-lg font-semibold">โอกาสจากข้อมูลคำค้น</h2><p className="mt-1 text-sm leading-6 text-white/60">เรียงจาก Volume และ Difficulty ภายในระบบ ไม่ใช่คะแนน Google หรือคำทำนายอันดับ</p></div><Link href="/content/research/" className="inline-flex min-h-11 items-center rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/70">เปิดข้อมูลงานวิจัย</Link></div>
      {opportunities.length ? <ol className="mt-4 grid gap-3">{opportunities.map((item, index) => <li key={item.id} className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/10 p-4 sm:flex-row sm:items-center sm:justify-between"><div><span className="text-xs text-[#e0c985]">ลำดับ {index + 1}</span><h3 className="mt-1 font-medium">{item.keyword}</h3><p className="mt-1 text-sm text-white/55">{item.provider} · ตรวจเมื่อ {new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeZone: "Asia/Bangkok" }).format(new Date(item.checkedAt))}</p></div><div className="text-sm text-white/70">โอกาสภายใน <strong className="text-white">{item.score}/100</strong></div></li>)}</ol> : <p className="mt-4 rounded-2xl border border-white/10 p-4 text-sm text-white/60">ยังไม่มีคำค้นที่มี Volume + Difficulty และยังไม่ครอบคลุมในบทความ ระบบจึงไม่สร้างรายการสมมติ</p>}
    </section>
  </div>;
}
