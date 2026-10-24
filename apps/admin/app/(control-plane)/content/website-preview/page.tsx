import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import V5Home from "@/features/home/v5/V5Home";
import { renderCiPlanningPage } from "@/features/ci-planning/page";
import { renderFinancialHealthCheckPage } from "@/features/financial-health-check/page";
import { renderBlogPage } from "@/features/blog/pages/BlogArchivePage";
import { renderPrivacyPage } from "@/features/legal/pages/PrivacyPage";
import { renderCookiePolicyPage } from "@/features/legal/pages/CookiePolicyPage";
import { renderMoneyStoryPage } from "@/features/money-story/page";
import { PublicCopyProvider } from "@/components/ui/PublicCopyProvider";
import { getPublicCopyPreview } from "@/lib/admin/public-copy-preview";
import { getPrimaryAuthorPreviewProfile } from "@/lib/content/sanity";
import { PUBLIC_COPY_SCOPES, publicCopyDocumentId, type PublicCopyScope } from "@/lib/content/public-copy-registry";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "ตัวอย่างฉบับร่างเว็บไซต์", robots: { index: false, follow: false } };

export default async function WebsiteCopyPreview({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = await searchParams;
  const requested = filters.scope ?? "home";
  if (typeof requested !== "string" || !Object.hasOwn(PUBLIC_COPY_SCOPES, requested)) notFound();
  const scope = requested as PublicCopyScope;
  const { copy, site, seo } = await getPublicCopyPreview(scope);
  const authorProfile = await getPrimaryAuthorPreviewProfile();
  let content: React.ReactNode;
  switch (scope) {
    case "site": case "home": content = <V5Home authorProfile={authorProfile} copy={copy} siteCopy={site} />; break;
    case "ci": content = await renderCiPlanningPage(copy, site); break;
    case "fhc": content = await renderFinancialHealthCheckPage(copy, site); break;
    case "blog": content = await renderBlogPage({ searchParams: Promise.resolve(filters) }, copy, site); break;
    case "privacy": content = await renderPrivacyPage(copy, site); break;
    case "cookies": content = await renderCookiePolicyPage(copy, site); break;
    case "moneyStory": content = await renderMoneyStoryPage(copy, site); break;
  }
  return <>
    <aside className="mb-6 border border-primary/30 p-4" aria-label="ตัวอย่างฉบับร่างหน้าเว็บไซต์">
      <h1 className="text-xl font-semibold">ตัวอย่างฉบับร่าง · {PUBLIC_COPY_SCOPES[scope].label}</h1>
      <p className="mt-2 text-sm">เมื่อเปิดในตัวอย่างเว็บไซต์ของ Sanity ข้อความฉบับร่างจะอัปเดตหลังบันทึกโดยอัตโนมัติ ผู้เข้าชมยังเห็นฉบับเผยแพร่</p>
      <nav aria-label="เลือกหน้าตัวอย่าง" className="mt-3 flex flex-wrap gap-3">{Object.entries(PUBLIC_COPY_SCOPES).map(([value, config]) => <Link key={value} href={`/content/website-preview/${value}/`} aria-current={scope === value ? "page" : undefined} className="inline-flex min-h-11 items-center underline">{config.label}</Link>)}</nav>
      <Link href="/content/website-preview/author-home/" className="inline-flex min-h-11 items-center underline">แก้ชื่อและคุณวุฒิผู้เขียน</Link>
      {scope !== "site" ? <Link href={`/content/website-preview/seo-${scope}/`} className="inline-flex min-h-11 items-center underline">แก้ SEO พร้อมดูหน้าเว็บไซต์</Link> : null}
      <Link href={`/studio/intent/edit/id=${publicCopyDocumentId(scope)};type=publicPageCopy`} className="inline-flex min-h-11 items-center underline">แก้ข้อความใน Sanity</Link>
      <dl className="mt-3 space-y-2 text-sm"><div><dt>SEO Title</dt><dd>{seo.seoTitle}</dd></div><div><dt>Meta Description</dt><dd>{seo.seoDescription}</dd></div><div><dt>OG Title</dt><dd>{seo.ogTitle}</dd></div><div><dt>OG Description</dt><dd>{seo.ogDescription}</dd></div></dl>
    </aside>
    <PublicCopyProvider values={{ ...site, ...copy }}>{content}</PublicCopyProvider>
  </>;
}
