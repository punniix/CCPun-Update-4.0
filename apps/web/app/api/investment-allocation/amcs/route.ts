import { INVESTMENT_ALLOCATION_ENABLED } from "@/lib/runtime/investment-availability";
import { enforceInvestmentApiRateLimit } from "@/features/investment-allocation/server/rate-limit";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(request: Request) {
  if (!INVESTMENT_ALLOCATION_ENABLED) {
    return Response.json({ error: "not_found" }, { status: 404, headers: NO_STORE });
  }
  const limited = enforceInvestmentApiRateLimit(request, "amcs");
  if (limited) return limited;
  const url = new URL(request.url);
  // Tool scope (owner request 2026-10-26): absent = main tool, "aia" = บลจ. เอไอเอ tool.
  const scopeRaw = url.searchParams.get("scope");
  if (scopeRaw !== null && scopeRaw !== "main" && scopeRaw !== "aia") return Response.json({ error: "scope_invalid" }, { status: 400, headers: NO_STORE });
  const scope = scopeRaw === "aia" ? "aia" : "main";
  const { listFundAmcs } = await import("@/features/investment-allocation/server/sec-v2");
  const result = await listFundAmcs(scope);
  return Response.json(result, {
    headers: {
      "Cache-Control": result.source === "sec_v2" ? "private, max-age=0, must-revalidate" : "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
