import { renderSitemapIndex, xmlResponse } from "@/lib/sitemap/xml";

export const dynamic = "force-static";

export function GET() {
  return xmlResponse(
    renderSitemapIndex([
      "https://ccpun.com/sitemaps/core.xml",
      "https://ccpun.com/sitemaps/tools.xml",
      "https://ccpun.com/sitemaps/blog.xml",
    ]),
  );
}
