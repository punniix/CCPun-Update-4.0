import { renderUrlSet, xmlResponse } from "@/lib/sitemap/xml";

export const dynamic = "force-static";

export function GET() {
  return xmlResponse(
    renderUrlSet([
      { loc: "https://ccpun.com/" },
      { loc: "https://ccpun.com/privacy/" },
      { loc: "https://ccpun.com/cookie-policy/" },
    ]),
  );
}
