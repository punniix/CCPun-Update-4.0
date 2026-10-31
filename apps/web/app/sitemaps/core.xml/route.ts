import { renderUrlSet, xmlResponse } from "@/lib/sitemap/xml";

export const dynamic = "force-static";

export function GET() {
  return xmlResponse(
    renderUrlSet([
      { loc: "https://ccpun.com/" },
      { loc: "https://ccpun.com/about/" },
      { loc: "https://ccpun.com/tools/" },
      { loc: "https://ccpun.com/play/money-story/" },
      { loc: "https://ccpun.com/privacy/" },
    ]),
  );
}
