import { searchPlanningFunds } from "@/features/investment-allocation/server/sec-v2";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  if (!query) {
    return Response.json({ error: "query_required" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  if (query.length > 120) {
    return Response.json({ error: "query_too_long" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const result = await searchPlanningFunds(query);
  return Response.json(result, {
    status: 200,
    headers: {
      "Cache-Control": result.mode === "sec_live" ? "private, max-age=0, must-revalidate" : "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
