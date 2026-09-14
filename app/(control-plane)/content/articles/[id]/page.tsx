import Link from "next/link";
import { notFound } from "next/navigation";
import { getStudioArticleEditHref } from "@/cms/sanity/policy/studio-policy";
import AdminCapabilityState from "@/features/admin/components/AdminCapabilityState";
import { requireAdminPermission } from "@/lib/admin/require-permission";
import { listAdminArticles } from "@/lib/admin/sanity-control";

export default async function ArticleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPermission("content:read");
  const { id } = await params;
  const result = await listAdminArticles();

  if (result.error) {
    return <AdminCapabilityState
      title="Article detail"
      status={result.error === "request-failed" ? "provider-error" : "not-configured"}
      source={`Sanity ${result.status.dataset ?? "unconfigured"}`}
      description="ระบบยังอ่านรายละเอียดบทความไม่ได้ จึงไม่แสดงข้อมูลแทนด้วยค่าศูนย์หรือข้อมูลจำลอง"
      action={{ href: "/content/articles/", label: "กลับ Articles" }}
    />;
  }

  const article = result.rows.find((row) => row.id.replace(/^drafts\./, "") === id.replace(/^drafts\./, ""));
  if (!article) notFound();

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.12em] text-gold-500">CONTENT · ARTICLE</p>
      <h1 className="mt-2 text-3xl font-semibold">{article.title ?? "บทความไม่มีชื่อ"}</h1>
      <dl className="glass-card mt-6 grid gap-5 p-5 text-sm sm:grid-cols-2 xl:grid-cols-3">
        <div><dt className="text-white/50">Editorial status</dt><dd className="mt-1 text-white/85">{article.reviewStatus ?? "ยังไม่ได้ระบุ"}</dd></div>
        <div><dt className="text-white/50">Publish state</dt><dd className="mt-1 text-white/85">{article.hasPublished ? article.isDraft ? "เผยแพร่แล้ว · มี Draft" : "เผยแพร่แล้ว" : "Draft"}</dd></div>
        <div><dt className="text-white/50">SEO score</dt><dd className="mt-1 text-white/85">{article.seoScore ?? "ยังไม่มี audit"}</dd></div>
        <div><dt className="text-white/50">Primary keyword</dt><dd className="mt-1 text-white/85">{article.primaryKeyword ?? "ยังไม่ได้ระบุ"}</dd></div>
        <div><dt className="text-white/50">Category</dt><dd className="mt-1 text-white/85">{article.category ?? "ยังไม่ได้ระบุ"}</dd></div>
        <div><dt className="text-white/50">Updated</dt><dd className="mt-1 text-white/85">{new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(article.updatedAt))}</dd></div>
      </dl>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link href={getStudioArticleEditHref(article.id)} target="_blank" rel="noopener noreferrer" className="gold-button inline-flex min-h-11 items-center px-5 py-3 text-sm">Edit in Studio<span className="sr-only"> (เปิดแท็บใหม่)</span></Link>
        <Link href={`/seo/audits/${encodeURIComponent(article.id)}/`} className="glass-button-sm inline-flex min-h-11 items-center text-sm text-white">ดู SEO audit</Link>
        <Link href="/content/articles/" className="glass-button-sm inline-flex min-h-11 items-center text-sm text-white">กลับ Articles</Link>
      </div>
    </div>
  );
}
