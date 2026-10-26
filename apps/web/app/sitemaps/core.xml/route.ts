import { renderUrlSet, xmlResponse } from "@/lib/sitemap/xml";

export const dynamic = "force-static";

export function GET() {
  return xmlResponse(
    renderUrlSet([
      { loc: "https://ccpun.com/" },
      { loc: "https://ccpun.com/privacy/" },
      // Owner-approved new URL (2026-10-25): the About page.
      { loc: "https://ccpun.com/about/" },
    ]),
  );
}
