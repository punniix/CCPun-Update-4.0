import { INVESTMENT_ALLOCATION_ENABLED } from "@/lib/runtime/investment-availability";

export const runtime = "nodejs";

export async function GET() {
  if (!INVESTMENT_ALLOCATION_ENABLED) {
    return Response.json({ error: "not_found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const { listFundAmcs } = await import("@/features/investment-allocation/server/sec-v2");
  const result = await listFundAmcs();
  return Response.json(result, {
    headers: {
      "Cache-Control": result.source === "sec_v2" ? "private, max-age=0, must-revalidate" : "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
