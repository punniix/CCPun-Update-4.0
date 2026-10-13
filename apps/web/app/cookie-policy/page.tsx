import type { ResolvingMetadata } from "next";
import { resolvePageSeoMetadata } from "@/lib/seo/page-seo";
import { metadata as defaults } from "@/features/legal/pages/CookiePolicyPage";
export { default } from "@/features/legal/pages/CookiePolicyPage";

export function generateMetadata(props: unknown, parent: ResolvingMetadata) {
  void props;
  return resolvePageSeoMetadata("/cookie-policy/", defaults, parent);
}
