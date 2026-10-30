import type { Metadata, ResolvingMetadata } from "next";
import { resolvePageSeoMetadata } from "@/lib/seo/page-seo";
import { metadata as defaults } from '@/features/tools-hub/page';
export { default } from '@/features/tools-hub/page';
export function generateMetadata(props: unknown, parent: ResolvingMetadata) {
  void props;
  return resolvePageSeoMetadata('/tools/', defaults, parent);
}
