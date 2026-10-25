type ArticleDetailCopy = { errorTitle: string; back: string; eyebrow: string; reviewHeading: string; publishHeading: string; seoHeading: string; keywordHeading: string; categoryHeading: string; updatedHeading: string; studioLink: string; auditLink: string; source: (dataset: string | null | undefined) => string; reviewStatus: (status: string | null | undefined) => string; publishedDraft: string; draft: string; noAudit: string };
import Link from "next/link";
import { notFound } from "next/navigation";
import { getStudioArticleEditHref } from "@/cms/sanity/policy/studio-policy";
import AdminCapabilityState from "@/features/admin/components/AdminCapabilityState";
import { requireAdminPermission } from "@/lib/admin/require-permission";
import { listAdminArticles } from "@/lib/admin/sanity-control";

export async function ArticleDetailPage({ params }: { params: Promise<{ id: string }> }, copy: ArticleDetailCopy) {
  await requireAdminPermission("content:read");
  const { id } = await params;
  const result = await listAdminArticles();

  if (result.error) {
    return <AdminCapabilityState
      title={copy.errorTitle}
      status={result.error === "request-failed" ? "provider-error" : "not-configured"}
      source={copy.source(result.status.dataset)}
      description="ระบบยังอ่านรายละเอียดบทความไม่ได้ จึงไม่แสดงข้อมูลแทนด้วยค่าศูนย์หรือข้อมูลจำลอง"
      action={{ href: "/content/articles/", label: copy.back }}
    />;
  }

  const article = result.rows.find((row) => row.id.replace(/^drafts\./, "") === id.replace(/^drafts\./, ""));
  if (!article) notFound();

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.12em] text-gold-500">{copy.eyebrow}</p>
      <h1 className="mt-2 text-3xl font-semibold">{article.title ?? "บทความไม่มีชื่อ"}</h1>
      <dl className="glass-card mt-6 grid gap-5 p-5 text-sm sm:grid-cols-2 xl:grid-cols-3">
        <div><dt className="text-white/50">{copy.reviewHeading}</dt><dd className="mt-1 text-white/85">{copy.reviewStatus(article.reviewStatus)}</dd></div>
        <div><dt className="text-white/50">{copy.publishHeading}</dt><dd className="mt-1 text-white/85">{article.hasPublished ? article.isDraft ? copy.publishedDraft : "เผยแพร่แล้ว" : copy.draft}</dd></div>
        <div><dt className="text-white/50">{copy.seoHeading}</dt><dd className="mt-1 text-white/85">{article.seoScore ?? copy.noAudit}</dd></div>
        <div><dt className="text-white/50">{copy.keywordHeading}</dt><dd className="mt-1 text-white/85">{article.primaryKeyword ?? "ยังไม่ได้ระบุ"}</dd></div>
        <div><dt className="text-white/50">{copy.categoryHeading}</dt><dd className="mt-1 text-white/85">{article.category ?? "ยังไม่ได้ระบุ"}</dd></div>
        <div><dt className="text-white/50">{copy.updatedHeading}</dt><dd className="mt-1 text-white/85">{new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(article.updatedAt))}</dd></div>
      </dl>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link href={getStudioArticleEditHref(article.id)} className="gold-button inline-flex min-h-11 items-center px-5 py-3 text-sm">{copy.studioLink}</Link>
        <Link href={`/seo/audits/${encodeURIComponent(article.id)}/`} className="glass-button-sm inline-flex min-h-11 items-center text-sm text-white">{copy.auditLink}</Link>
        <Link href="/content/articles/" className="glass-button-sm inline-flex min-h-11 items-center text-sm text-white">{copy.back}</Link>
      </div>
    </div>
  );
}
