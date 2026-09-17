import type { Metadata } from "next";
import Link from "next/link";
import RunSeoAuditButton from "@/features/admin/components/RunSeoAuditButton";
import { requireAdminPermission } from "@/lib/admin/require-permission";
import { listAdminArticles } from "@/lib/admin/sanity-control";
import { isStudioDataPlaneAllowed } from "@/lib/admin/environment";
import { SEO_AUDIT_VERSION } from "@/lib/admin/seo-heuristics";
import { getSeoIntelligenceRuntimeStatus } from "@/lib/admin/seo-intelligence/foundation";

export const metadata: Metadata = { title: "SEO Control Center" };

function scoreTone(score: number | null | undefined) {
  if (score == null) return "text-white/60";
  if (score >= 85) return "text-emerald-300";
  if (score >= 70) return "text-[#e0c985]";
  if (score >= 50) return "text-amber-300";
  return "text-red-300";
}

function formatAuditDate(value: string | null | undefined) {
  if (!value) return "ไม่ทราบเวลา";
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(value));
}

export default async function AdminSeoPage() {
  await requireAdminPermission("seo:read");
  const result = await listAdminArticles();
  const audited = result.rows.filter((row) => row.seoScore != null && row.seoAuditVersion === SEO_AUDIT_VERSION);
  const average = audited.length ? Math.round(audited.reduce((sum, row) => sum + (row.seoScore ?? 0), 0) / audited.length) : null;
  const studioReady = isStudioDataPlaneAllowed(result.status.dataset ?? undefined);
  const intelligenceReady = getSeoIntelligenceRuntimeStatus().enabled;

  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">SEO CONTROL CENTER</p>
          <h1 className="mt-2 text-3xl font-semibold">SEO Control Center</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">
            รวมผลตรวจ SEO กับกติกาการแก้ไขที่ปลอดภัยในที่เดียว คะแนนมาจากกฎของ CCPun ไม่ใช่คะแนนจาก Google และการเปลี่ยน URL/indexability ของหน้าที่เผยแพร่แล้วต้องผ่าน migration workflow แยกต่างหาก
          </p>
        </div>
        <div className="flex gap-2">
          {intelligenceReady ? <Link href="/seo/opportunities/" className="inline-flex min-h-11 items-center rounded-xl border border-[#e0c985]/30 bg-[#e0c985]/10 px-4 py-2.5 text-sm text-[#f4df9b] hover:bg-[#e0c985]/15">ดู Opportunities UAT</Link> : null}
          <Link href="/content/research/" className="inline-flex min-h-11 items-center rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/70 hover:bg-white/5">ดูข้อมูลงานวิจัย</Link>
          <Link href="/dashboard/inbox/" className="inline-flex min-h-11 items-center rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/70 hover:bg-white/5">ดูข้อเสนอที่รอตรวจ</Link>
        </div>
      </div>

      <section className="mt-7 grid gap-3 sm:grid-cols-4">
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><div className="text-sm text-white/60">ชุดข้อมูล</div><div className="mt-2 text-lg font-semibold">{result.status.dataset ?? "—"}</div></article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><div className="text-sm text-white/60">บทความทั้งหมด</div><div className="mt-2 text-lg font-semibold">{result.rows.length}</div></article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><div className="text-sm text-white/60">มีผลตรวจที่บันทึก</div><div className="mt-2 text-lg font-semibold">{audited.length}</div></article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><div className="text-sm text-white/60">เฉลี่ยจากผลที่บันทึก</div><div className={`mt-2 text-lg font-semibold ${scoreTone(average)}`}>{average == null ? "—" : `${average}/100`}</div></article>
      </section>

      <section className="mt-6 grid gap-3 lg:grid-cols-2">
        <article className="rounded-3xl border border-emerald-200/15 bg-emerald-200/[0.04] p-5">
          <h2 className="font-semibold text-emerald-100">แก้ผ่าน Draft ได้ตามปกติ</h2>
          <p className="mt-2 text-sm leading-6 text-white/65">SEO Title · Meta Description · Keyword · Search Intent · Semantic Topic · รูปภาพ · Author · Sources</p>
          <p className="mt-2 text-xs leading-5 text-white/50">Semantic Topic ใช้จัดความหมาย/Knowledge Graph และไม่ใช่คำสั่งย้าย URL</p>
        </article>
        <article className="rounded-3xl border border-amber-200/20 bg-amber-200/[0.05] p-5">
          <h2 className="font-semibold text-amber-100">Protected หลังบทความเคยเผยแพร่</h2>
          <p className="mt-2 text-sm leading-6 text-white/65">URL Slug · หมวดที่กำหนด URL path · Canonical override · Noindex</p>
          <p className="mt-2 text-xs leading-5 text-white/50">หากต้องเปลี่ยน ให้ทำ SEO Migration Workflow ที่ประสาน redirect + canonical + sitemap + internal links + schema + regression พร้อมกัน</p>
        </article>
      </section>

      {result.error ? <section role="alert" className="mt-6 rounded-3xl border border-amber-200/20 bg-amber-200/10 p-5 text-sm text-amber-50">ยังอ่านข้อมูลบทความเพื่อตรวจ SEO ไม่ได้ ระบบหยุดไว้โดยไม่สลับ project หรือชุดข้อมูล</section> : null}

      {result.rows.length > 0 ? (
        <section className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.025]">
          <p className="px-5 pt-4 text-sm text-white/60 xl:hidden">เลื่อนตารางไปทางซ้ายหรือขวาเพื่อดูข้อมูลทั้งหมด</p>
          <div role="region" aria-label="ตารางตรวจ SEO" tabIndex={0} className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="border-b border-white/10 bg-white/[0.03] text-xs tracking-wide text-white/55"><tr><th className="px-5 py-4 font-medium">บทความ</th><th className="px-4 py-4 font-medium">คำค้นหลัก</th><th className="px-4 py-4 font-medium">เป้าหมายการค้นหา</th><th className="px-4 py-4 font-medium">ผลตรวจล่าสุดที่บันทึก</th><th className="px-5 py-4 font-medium">ทำต่อ</th></tr></thead>
              <tbody className="divide-y divide-white/5">
                {result.rows.map((article) => (
                  <tr key={article.rawId} className="align-middle hover:bg-white/[0.025]">
                    <td className="px-5 py-4"><div className="font-medium text-white/85">{article.title || "บทความยังไม่มีชื่อ"}</div><div className="mt-1 text-xs text-white/55">{article.isDraft ? "ฉบับร่าง" : "เผยแพร่แล้ว"} · /{article.slug || "ยังไม่มี slug"}</div></td>
                    <td className="px-4 py-4 text-white/60">{article.primaryKeyword || "—"}</td>
                    <td className="px-4 py-4 text-white/60">{article.searchIntent || "—"}</td>
                    <td className={`px-4 py-4 font-semibold ${scoreTone(article.seoScore)}`}>
                      <div>{article.seoScore == null ? "ยังไม่ตรวจ" : article.seoAuditVersion === SEO_AUDIT_VERSION ? `${article.seoScore}/100` : "ต้องตรวจใหม่"}</div>
                      {article.seoScore != null ? <div className="mt-1 text-xs font-normal text-white/50">บันทึกเมื่อ {formatAuditDate(article.seoAuditedAt)}{article.seoAuditVersion === SEO_AUDIT_VERSION ? " · ตรวจใหม่หลังแก้บทความ" : " · กฎตรวจเวอร์ชันเก่า"}</div> : null}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Link href={`/seo/audits/${encodeURIComponent(article.id)}/`} className="inline-flex min-h-11 items-center rounded-xl border border-white/10 px-3.5 py-2 text-sm font-medium text-white/70 hover:bg-white/5">ดูรายละเอียด</Link>
                        {article.isDraft && result.status.writeReady ? (
                          <RunSeoAuditButton articleId={article.id} hasPreviousAudit={article.seoScore != null} />
                        ) : !article.isDraft && studioReady ? (
                          <Link href={`/studio/structure/article;${encodeURIComponent(article.id.replace(/^drafts\./, ""))}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-xl border border-[#e0c985]/30 bg-[#e0c985]/10 px-3.5 py-2 text-sm font-medium text-[#f4df9b] hover:bg-[#e0c985]/15">
                            เปิด Studio เพื่อเริ่มฉบับร่าง<span className="sr-only"> (เปิดแท็บใหม่)</span>
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-5 text-sm leading-6 text-white/70">การตรวจและการสร้างข้อเสนอเป็นคนละขั้นกับการอนุมัติ ระบบจะไม่ใช้ข้อเสนอหรือเผยแพร่บทความเอง และจะยังไม่สร้าง SEO Title / Meta description อัตโนมัติจนกว่าจะตรวจ page + query ownership จาก GSC เพื่อป้องกัน keyword cannibalization</section>
    </div>
  );
}
