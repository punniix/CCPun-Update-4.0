import type { ResolvingMetadata } from "next";
import { resolvePageSeoMetadata } from "@/lib/seo/page-seo";
import { metadata as defaults } from "@/features/ci-planning/page";
import ToolPage from "@/features/ci-planning/page";
import { getPublicCopy } from "@/lib/content/public-copy";
import { PublicCopyProvider } from "@/components/ui/PublicCopyProvider";

export default async function Page() {
  const copy = await getPublicCopy("ci");
  return <PublicCopyProvider values={copy}><ToolPage /></PublicCopyProvider>;
}

export function generateMetadata(props: unknown, parent: ResolvingMetadata) {
  void props;
  return resolvePageSeoMetadata("/ci-planning/", defaults, parent);
}
