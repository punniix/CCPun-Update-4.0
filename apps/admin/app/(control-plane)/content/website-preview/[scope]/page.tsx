import { notFound } from "next/navigation";
import WebsiteCopyPreview from "../page";
import { PUBLIC_COPY_SCOPES, type PublicCopyScope } from "@/lib/content/public-copy-registry";
import { getPageSeoPage } from "@/lib/content/page-seo-registry";

export default async function ScopedWebsiteCopyPreview({ params, searchParams }: { params: Promise<{ scope: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const requested = (await params).scope;
  const scope = (requested === "author-home" ? "home" : requested.startsWith("seo-") ? requested.slice(4) : requested) as PublicCopyScope;
  if (!Object.hasOwn(PUBLIC_COPY_SCOPES, scope) || (requested.startsWith("seo-") && !getPageSeoPage(PUBLIC_COPY_SCOPES[scope].pathname))) notFound();
  return <WebsiteCopyPreview searchParams={Promise.resolve({ ...await searchParams, scope })} />;
}
