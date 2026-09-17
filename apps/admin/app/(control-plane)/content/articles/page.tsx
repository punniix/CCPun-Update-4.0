import type { Metadata } from "next";
import Link from "next/link";
import {
  defaultContentSortOrder,
  getContentTags,
  resolveContentFilters,
  type ContentFilterParams,
  type ContentSortKey,
  type ContentSortOrder,
} from "@/lib/admin/content-filters";
import { adminDataLaneLabel, connectionLabel, contentReviewStatusLabel, friendlyApiError } from "@/lib/admin/presentation";
import { isStudioDataPlaneAllowed } from "@/lib/admin/environment";
import { requireAdminPermission } from "@/lib/admin/require-permission";
import { listAdminArticles } from "@/lib/admin/sanity-control";
import { runSeoAudit } from "@/lib/admin/seo-audit";
import { SEO_AUDIT_VERSION } from "@/lib/admin/seo-heuristics";
import { getStudioArticleEditHref } from "@/cms/sanity/policy/studio-policy";

export const metadata: Metadata = { title: "บทความ" };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(value));
}

type ContentListState = {
  category: string;
  tag: string;
  sort: ContentSortKey;
  order: ContentSortOrder;
};

function contentListHref(state: ContentListState) {
  const params = new URLSearchParams();
  if (state.category) params.set("category", state.category);
  if (state.tag) params.set("tag", state.tag);
  params.set("sort", state.sort);
  params.set("order", state.order);
  return `/content/articles/?${params.toString()}`;
}

function sortHref(state: ContentListState, sort: ContentSortKey) {
  const order = state.sort === sort
    ? state.order === "asc" ? "desc" : "asc"
    : defaultContentSortOrder(sort);
  return contentListHref({ ...state, sort, order });
}

function SortableHeader({
  label,
  sort,
  state,
}: {
  label: string;
  sort: ContentSortKey;
  state: ContentListState;
}) {
  const active = state.sort === sort;
  return (
    <th
      className="px-4 py-4 font-medium"
      aria-sort={active ? state.order === "asc" ? "ascending" : "descending" : undefined}
    >
      <Link
        href={sortHref(state, sort)}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-1 text-left transition hover:text-white focus:outline-none focus:ring-2 focus:ring-[#e0c985]/60"
      >
        <span>{label}</span>
        <span aria-hidden="true" className={active ? "text-[#e0c985]" : "text-white/35"}>
          {active ? state.order === "asc" ? "↑" : "↓" : "↕"}
        </span>
      </Link>
    </th>
  );
}

type AdminContentPageProps = {
  searchParams: Promise<ContentFilterParams>;
};

export default async function AdminContentPage({ searchParams }: AdminContentPageProps) {
  await requireAdminPermission("content:read");
  const params = await searchParams;
  const result = await listAdminArticles();
  const lane = adminDataLaneLabel(result.status.environment);
  const studioReady = isStudioDataPlaneAllowed(result.status.dataset ?? undefined);
  const filters = resolveContentFilters(result.rows, params);
  const listState: ContentListState = {
    category: filters.category,
    tag: filters.tag,
    sort: filters.sort,
    order: filters.order,
  };
  const liveAudits = new Map(await Promise.all(
    filters.rows
      .filter((article) => article.hasPublished && article.seoScore == null)
      .map(async (article) => {
        try {
          return [article.id, await runSeoAudit(article.id, false)] as const;
        } catch {
          return [article.id, null] as const;
        }
      }),
  ));

  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">เลือกงานที่จะตรวจ</p>
          <h1 className="mt-2 text-3xl font-semibold">บทความ</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">
            รายการนี้อ่านจากชุดข้อมูล <strong className="font-medium text-white">{result.status.dataset ?? "ที่ยังไม่ได้ตั้งค่า"}</strong> ในโหมด {lane} เท่านั้น ระบบจะหยุดหาก project หรือชุดข้อมูลไม่ตรงกัน
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {studioReady ? <Link href="/studio/intent/create/type=article" target="_blank" rel="noopener noreferrer" className="rounded-xl bg-[#e0c985] px-4 py-2.5 text-sm font-semibold text-[#17191d] transition hover:brightness-105">สร้างบทความใหม่<span className="sr-only"> (เปิดแท็บใหม่)</span></Link> : null}
          <Link href="/dashboard/inbox/" className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/70 transition hover:bg-white/5 hover:text-white">
            ดูข้อเสนอที่รอตรวจ
          </Link>
          {studioReady ? <Link href="/studio/" target="_blank" rel="noopener noreferrer" className="rounded-xl border border-[#e0c985]/40 px-4 py-2.5 text-sm font-medium text-[#f4df9b] transition hover:bg-[#e0c985]/10">เปิด Studio<span className="sr-only"> (เปิดแท็บใหม่)</span></Link> : null}
        </div>
      </div>

      {studioReady ? (
        <section className="mt-6 rounded-3xl border border-emerald-200/20 bg-emerald-200/[0.07] p-5 text-sm leading-6 text-white/75">
          <h2 className="font-semibold text-emerald-100">แก้ครั้งเดียว ข้อมูลอยู่ใน Sanity ชุดเดียวกัน</h2>
          <p className="mt-2">ทุกครั้งที่พิมพ์ เพิ่มรูป หรือลบข้อมูลใน Studio ระบบจะบันทึกลงฉบับร่างอัตโนมัติ เมื่อกลับมาหน้านี้ รายการจะรีเฟรชจาก Sanity ให้เอง หน้าเว็บจริงจะเปลี่ยนเฉพาะเมื่อคุณกด Publish ใน Studio ด้วยตัวเอง</p>
        </section>
      ) : null}

      <section className="mt-7 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <div className="text-sm text-white/60">ชุดข้อมูล</div>
          <div className="mt-2 text-lg font-semibold">{result.status.dataset ?? "—"}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <div className="text-sm text-white/60">การอ่านข้อมูล</div>
          <div className="mt-2 text-lg font-semibold">{connectionLabel(result.status.readReady, "read", result.status.environment)}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <div className="text-sm text-white/60">แก้บทความใน Studio</div>
          <div className="mt-2 text-lg font-semibold">{connectionLabel(studioReady, "studio", result.status.environment)}</div>
          {studioReady && !result.status.writeReady ? <div className="mt-2 text-xs leading-5 text-white/50">ปุ่ม Apply อัตโนมัติยังปิดไว้</div> : null}
        </div>
      </section>

      {result.error ? (
        <section className="mt-6 rounded-3xl border border-amber-200/20 bg-amber-200/10 p-5 text-sm leading-6 text-amber-50">
          <h2 className="font-semibold">ยังอ่านบทความไม่ได้</h2>
          <p className="mt-2 text-amber-50/80">
            {friendlyApiError(result.error)} ระบบหยุดไว้โดยไม่สลับ project หรือชุดข้อมูลให้เอง
          </p>
        </section>
      ) : null}

      {!result.error && result.rows.length === 0 ? (
        <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.035] p-7 text-center">
          <h2 className="text-lg font-semibold">ยังไม่มีบทความใน {lane}</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-white/65">
            {studioReady ? "เปิด Studio เพื่อสร้างหรือแก้ฉบับร่างตามขอบเขตของโหมดนี้" : "โหมดนี้เปิดให้อ่านอย่างเดียว จึงยังไม่แสดงเครื่องมือสร้างหรือแก้ฉบับร่าง"}
          </p>
        </section>
      ) : null}

      {!result.error && result.rows.length > 0 ? (
        <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.035] p-5" aria-labelledby="content-filter-heading">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="content-filter-heading" className="text-lg font-semibold">กรองบทความ</h2>
              <p className="mt-1 text-sm leading-6 text-white/60">เลือกหมวดหมู่หลักและแท็กหัวข้อย่อยจากบทความที่มีอยู่</p>
            </div>
            <p className="text-sm text-white/60" aria-live="polite">แสดง {filters.rows.length} จาก {result.rows.length} บทความ</p>
          </div>

          <form action="/content/articles/" method="get" className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
            <input type="hidden" name="sort" value={filters.sort} />
            <input type="hidden" name="order" value={filters.order} />
            <label className="grid gap-2 text-sm font-medium text-white/80">
              หมวดหมู่หลัก
              <select
                name="category"
                defaultValue={filters.category}
                className="min-h-11 w-full rounded-xl border border-white/15 bg-[#252a32] px-3 text-base text-white outline-none transition focus:border-[#e0c985] focus:ring-2 focus:ring-[#e0c985]/30"
              >
                <option value="">ทุกหมวดหมู่</option>
                {filters.categories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-medium text-white/80">
              แท็กหัวข้อย่อย
              <select
                name="tag"
                defaultValue={filters.tag}
                className="min-h-11 w-full rounded-xl border border-white/15 bg-[#252a32] px-3 text-base text-white outline-none transition focus:border-[#e0c985] focus:ring-2 focus:ring-[#e0c985]/30"
              >
                <option value="">ทุกแท็ก</option>
                {filters.tags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
              </select>
            </label>

            <div className="flex flex-wrap gap-2">
              <button type="submit" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#e0c985] px-4 text-sm font-semibold text-[#17191d] transition hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-[#e0c985]/60">
                ใช้ตัวกรอง
              </button>
              <Link href={contentListHref({ ...listState, category: "", tag: "" })} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 px-4 text-sm text-white/75 transition hover:bg-white/5 hover:text-white focus:outline-none focus:ring-2 focus:ring-[#e0c985]/60">
                ล้างตัวกรอง
              </Link>
            </div>
          </form>
        </section>
      ) : null}

      {!result.error && result.rows.length > 0 && filters.rows.length === 0 ? (
        <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.035] p-7 text-center">
          <h2 className="text-lg font-semibold">ไม่พบบทความที่ตรงกับตัวกรอง</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-white/65">
            ลองเลือกหมวดหมู่หรือแท็กอื่น หรือล้างตัวกรองเพื่อดูบทความทั้งหมด
          </p>
          <Link href={contentListHref({ ...listState, category: "", tag: "" })} className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl border border-[#e0c985]/40 px-4 text-sm font-medium text-[#e0c985] transition hover:bg-[#e0c985]/10 focus:outline-none focus:ring-2 focus:ring-[#e0c985]/60">
            ล้างตัวกรอง
          </Link>
        </section>
      ) : null}

      {filters.rows.length > 0 ? (
        <section className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.025]">
          <p className="px-5 pt-4 text-sm leading-6 text-white/60">สถานะเอกสารบอกว่าเผยแพร่แล้วหรือยัง ส่วนขั้นตรวจเนื้อหาบอกว่างานอยู่ขั้นไหน ทั้งสองอย่างไม่ใช่การเผยแพร่เอง</p>
          <p className="px-5 pt-2 text-sm text-white/60">กดหัวคอลัมน์ที่มี ↕ เพื่อเรียงลำดับ · ลูกศร ↑/↓ แสดงทิศทางปัจจุบัน</p>
          <p className="px-5 pt-2 text-sm text-white/60 xl:hidden">เลื่อนตารางไปทางซ้ายหรือขวาเพื่อดูข้อมูลทั้งหมด</p>
          <div role="region" aria-label={`ตารางบทความ ${lane}`} tabIndex={0} className="overflow-x-auto">
            <table className="w-full min-w-[1240px] text-left text-sm">
              <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wide text-white/60">
                <tr>
                  <SortableHeader label="บทความ" sort="title" state={listState} />
                  <SortableHeader label="สถานะเอกสาร" sort="document-status" state={listState} />
                  <SortableHeader label="ขั้นตรวจเนื้อหา" sort="review-status" state={listState} />
                  <th className="px-4 py-4 font-medium">คำค้นหลัก</th>
                  <th className="px-4 py-4 font-medium">เป้าหมายการค้นหา</th>
                  <SortableHeader label="ผลตรวจ SEO ที่บันทึก" sort="seo-score" state={listState} />
                  <SortableHeader label="เผยแพร่ครั้งแรก" sort="published-at" state={listState} />
                  <SortableHeader label="แก้ไขล่าสุด" sort="updated-at" state={listState} />
                  <th className="px-5 py-4 font-medium">ทำต่อ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filters.rows.map((article) => {
                  const documentId = article.id.replace(/^drafts\./, "");
                  const studioHref = getStudioArticleEditHref(article.id);
                  const liveAudit = liveAudits.get(article.id);
                  const seoScore = article.seoScore ?? liveAudit?.score;
                  const hasSavedAudit = article.seoScore != null;
                  const hasCurrentSavedAudit = hasSavedAudit && article.seoAuditVersion === SEO_AUDIT_VERSION;
                  const documentStatus = article.hasPublished
                    ? article.isDraft
                      ? "เผยแพร่แล้ว · มีฉบับร่างแก้ไข"
                      : "เผยแพร่แล้ว"
                    : "ฉบับร่าง — ยังไม่เผยแพร่";
                  const articleTags = getContentTags(article.tags);
                  return (
                    <tr key={article.rawId} className="align-top transition hover:bg-white/[0.025]">
                      <td className="px-5 py-4">
                        <div className="font-medium text-white/85">{article.title || "บทความยังไม่มีชื่อ"}</div>
                        <div className="mt-1 text-xs text-white/55">{article.category || "ยังไม่จัดหมวดหมู่"} · /{article.slug || "ยังไม่มี slug"}</div>
                        {articleTags.length > 0 ? (
                          <div className="mt-2 flex max-w-md flex-wrap gap-1.5" aria-label="แท็กบทความ">
                            {articleTags.map((tag) => (
                              <span key={tag} className="inline-flex rounded-full border border-[#e0c985]/20 bg-[#e0c985]/10 px-2.5 py-1 text-xs leading-5 text-[#f4df9b]">
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : <div className="mt-2 text-xs text-white/40">ยังไม่มีแท็ก</div>}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${article.hasPublished ? "border-emerald-200/20 bg-emerald-200/10 text-emerald-100" : "border-amber-200/20 bg-amber-200/10 text-amber-100"}`}>
                          {documentStatus}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-white/70">{contentReviewStatusLabel(article.reviewStatus)}</td>
                      <td className="px-4 py-4 text-white/60">{article.primaryKeyword || "—"}</td>
                      <td className="px-4 py-4 text-white/60">{article.searchIntent || "—"}</td>
                      <td className="px-4 py-4 text-white/60">
                        <div>{seoScore == null ? "ยังตรวจ SEO ไม่ได้" : `${seoScore}/100`}</div>
                        {article.seoAuditedAt ? <div className="mt-1 text-xs text-white/45">ตรวจเมื่อ {formatDate(article.seoAuditedAt)}</div> : null}
                        {hasSavedAudit ? (
                          <div className={`mt-1 text-xs ${hasCurrentSavedAudit ? "text-emerald-200/80" : "text-amber-200"}`}>
                            {hasCurrentSavedAudit ? "ผลที่บันทึกแล้ว · ใช้กฎตรวจเวอร์ชันปัจจุบัน" : "ผลเก่าที่บันทึกไว้ · ต้องตรวจใหม่"}
                          </div>
                        ) : liveAudit ? (
                          <div className="mt-1 text-xs text-sky-200">คะแนนสด · คำนวณจากฉบับปัจจุบัน · ยังไม่บันทึก</div>
                        ) : null}
                        <Link href={`/seo/audits/${encodeURIComponent(documentId)}/`} className="mt-2 inline-flex min-h-11 items-center font-medium text-[#e0c985] hover:underline">ดูรายละเอียดผลตรวจ</Link>
                      </td>
                      <td className="px-4 py-4 text-white/50">{article.publishedAt ? formatDate(article.publishedAt) : "ยังไม่เคยเผยแพร่"}</td>
                      <td className="px-4 py-4 text-white/50">{formatDate(article.updatedAt)}</td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-3">
                          {article.isDraft ? (
                            <form action={`/api/admin/content/${encodeURIComponent(documentId)}/preview`} method="post" target="_blank">
                              <button type="submit" className="font-medium text-[#e0c985] hover:underline">เปิดตัวอย่าง<span className="sr-only"> (เปิดแท็บใหม่)</span></button>
                            </form>
                          ) : null}
                          {studioReady ? <Link href={studioHref} target="_blank" rel="noopener noreferrer" className="font-medium text-[#e0c985] hover:underline">เปิดแก้ใน Studio<span className="sr-only"> (เปิดแท็บใหม่)</span></Link> : <span className="text-white/45">อ่านอย่างเดียว</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
