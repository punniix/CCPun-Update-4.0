import type { ResolvingMetadata } from "next";
import { resolvePageSeoMetadata } from "@/lib/seo/page-seo";
import { metadata as defaults } from "@/features/financial-health-check/page";
import ToolPage from "@/features/financial-health-check/page";
import { getPublicCopy } from "@/lib/content/public-copy";
import { PublicCopyProvider } from "@/components/ui/PublicCopyProvider";

export default async function Page() {
  const copy = await getPublicCopy("fhc");
  return <PublicCopyProvider values={copy}><ToolPage /></PublicCopyProvider>;
}

export function generateMetadata(props: unknown, parent: ResolvingMetadata) {
  void props;
  return resolvePageSeoMetadata("/tools/financial-health-check/", defaults, parent);
}
