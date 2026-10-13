import type { ResolvingMetadata } from "next";
import { resolvePageSeoMetadata } from "@/lib/seo/page-seo";
import { metadata as defaults } from "@/features/blog/pages/BlogArchivePage";
export { default } from "@/features/blog/pages/BlogArchivePage";

export function generateMetadata(props: unknown, parent: ResolvingMetadata) {
  void props;
  return resolvePageSeoMetadata("/blog/", defaults, parent);
}
