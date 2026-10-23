import type { ResolvingMetadata } from "next";
import { resolvePageSeoMetadata } from "@/lib/seo/page-seo";
import { metadata as defaults, renderBlogPage } from "@/features/blog/pages/BlogArchivePage";

export default async function BlogPage(props: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  return renderBlogPage(props);
}

export function generateMetadata(props: unknown, parent: ResolvingMetadata) {
  void props;
  return resolvePageSeoMetadata("/blog/", defaults, parent);
}
