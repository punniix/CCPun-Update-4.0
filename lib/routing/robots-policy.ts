import type { MetadataRoute } from "next";

export function robotsPolicy(blockAll: boolean, privatePaths: string[]): MetadataRoute.Robots {
  if (blockAll) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return { rules: [{ userAgent: "*", allow: "/", disallow: privatePaths }], sitemap: "https://ccpun.com/sitemap.xml" };
}
