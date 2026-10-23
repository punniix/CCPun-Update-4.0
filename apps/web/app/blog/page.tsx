import type { ResolvingMetadata } from "next";
import { resolvePageSeoMetadata } from "@/lib/seo/page-seo";
import { metadata as defaults, renderBlogPage } from "@/features/blog/pages/BlogArchivePage";

export default async function BlogPage(props: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.CCPUN_APP_ENV === "web-uat" || process.env.CCPUN_APP_ENV === "local-uat") {
    const { CCPunAiSearchBar } = await import("@/features/ai-search/CCPunAiSearchWidgets");
    return renderBlogPage({ ...props, searchEnhancement: <CCPunAiSearchBar /> });
  }
  return renderBlogPage(props);
}

export function generateMetadata(props: unknown, parent: ResolvingMetadata) {
  void props;
  return resolvePageSeoMetadata("/blog/", defaults, parent);
}
