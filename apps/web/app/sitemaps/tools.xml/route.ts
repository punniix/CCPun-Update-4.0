import { renderUrlSet, xmlResponse } from "@/lib/sitemap/xml";

export const dynamic = "force-static";

export function GET() {
  return xmlResponse(
    renderUrlSet([
      // Owner-approved new hub URL (2026-10-25): it links to the tool owners below.
      { loc: "https://ccpun.com/tools/" },
      { loc: "https://ccpun.com/ci-planning/" },
      { loc: "https://ccpun.com/tools/financial-health-check/" },
      // Owner-approved 2026-10-25: ships with v5 only; canonical and indexability are unchanged.
      { loc: "https://ccpun.com/play/money-story/" },
    ]),
  );
}
