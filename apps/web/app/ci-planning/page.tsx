import type { ResolvingMetadata } from "next";
import { resolvePageSeoMetadata } from "@/lib/seo/page-seo";
import { metadata as defaults } from "@/features/ci-planning/page";
import ToolPage from "@/features/ci-planning/page";
import { getPublicCopy } from "@/lib/content/public-copy";
import { getPublishedArticles, getShellTopics } from "@/components/layout/v5/shell-data";
import { PublicCopyProvider } from "@/components/ui/PublicCopyProvider";

export default async function Page() {
  // Begin independent per-request Sanity reads with CI copy; the renderer,
  // header and footer reuse the same React cache entries once they render.
  // No cross-request cache or change to published content visibility.
  const ciCopy = getPublicCopy("ci");
  void Promise.allSettled([
    getPublicCopy("blog"),
    getPublishedArticles(),
    getShellTopics(),
  ]);
  const copy = await ciCopy;
  return <PublicCopyProvider values={copy}><ToolPage /></PublicCopyProvider>;
}

export function generateMetadata(props: unknown, parent: ResolvingMetadata) {
  void props;
  return resolvePageSeoMetadata("/ci-planning/", defaults, parent);
}
