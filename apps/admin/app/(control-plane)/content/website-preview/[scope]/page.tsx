import { notFound } from "next/navigation";
import WebsiteCopyPreview from "../page";
import { PUBLIC_COPY_SCOPES, type PublicCopyScope } from "@/lib/content/public-copy-registry";
import { categorySeoPreviewId } from "@/lib/content/category-registry";
import { getPageSeoPreviewPage } from "@/lib/content/page-seo-registry";

export default async function ScopedWebsiteCopyPreview({ params, searchParams }: { params: Promise<{ scope: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const requested = (await params).scope;
  if (requested.startsWith("seo-")) {
    const previewScope = requested.slice(4);
    if (categorySeoPreviewId(previewScope)) return <WebsiteCopyPreview searchParams={Promise.resolve({ ...await searchParams, categorySeo: previewScope })} />;
    const page = getPageSeoPreviewPage(previewScope);
    if (!page) notFound();
    if (page.metadataOnly) return <WebsiteCopyPreview searchParams={Promise.resolve({ ...await searchParams, seoPage: previewScope })} />;
  }
  const scope = (requested === "author-home" ? "home" : requested.startsWith("seo-") ? requested.slice(4) : requested) as PublicCopyScope;
  if (!Object.hasOwn(PUBLIC_COPY_SCOPES, scope)) notFound();
  return <WebsiteCopyPreview searchParams={Promise.resolve({ ...await searchParams, scope })} />;
}
