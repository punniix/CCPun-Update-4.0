import { renderUrlSet, xmlResponse } from "@/lib/sitemap/xml";

export function GET() {
  return xmlResponse(
    renderUrlSet([
      { loc: "https://ccpun.com/ci-planning/" },
      { loc: "https://ccpun.com/tools/financial-health-check/" },
    ]),
  );
}
