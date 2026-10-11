import { renderUrlSet, xmlResponse } from "@/lib/sitemap/xml";
import { INVESTMENT_ALLOCATION_ENABLED } from "@/lib/runtime/investment-availability";

export function GET() {
  return xmlResponse(
    renderUrlSet([
      { loc: "https://ccpun.com/ci-planning/" },
      { loc: "https://ccpun.com/tools/financial-health-check/" },
      ...(INVESTMENT_ALLOCATION_ENABLED ? [{ loc: "https://ccpun.com/tools/investment-allocation/" }] : []),
    ]),
  );
}
