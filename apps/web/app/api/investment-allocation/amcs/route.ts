import { listFundAmcs } from "@/features/investment-allocation/server/sec-v2";

export const runtime = "nodejs";

export async function GET() {
  const result = await listFundAmcs();
  return Response.json(result, {
    headers: {
      "Cache-Control": result.source === "sec_v2" ? "private, max-age=0, must-revalidate" : "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
