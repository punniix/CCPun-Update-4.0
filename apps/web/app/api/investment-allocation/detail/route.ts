import { INVESTMENT_ALLOCATION_ENABLED } from "@/features/investment-allocation/server/availability";
import { IS_REVIEW_ENVIRONMENT } from "@/lib/deployment-environment";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!INVESTMENT_ALLOCATION_ENABLED) {
    return Response.json({ error: "not_found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const url = new URL(request.url);
  const projectId = (url.searchParams.get("proj_id") ?? "").trim();
  const className = url.searchParams.get("class_name")?.trim() || null;

  const synthetic = IS_REVIEW_ENVIRONMENT && ["web-uat", "local-uat"].includes(process.env.CCPUN_APP_ENV ?? "") && /^UAT-[A-Z0-9-]+$/.test(projectId);
  if (!/^M\d{4}_\d{4}$/.test(projectId) && !synthetic) return Response.json({ error: "proj_id_invalid" }, { status: 400 });
  if (className && className.length > 120) return Response.json({ error: "class_name_invalid" }, { status: 400 });

  const { getFundDetail } = await import("@/features/investment-allocation/server/sec-v2");
  const result = await getFundDetail(projectId, className);
  return Response.json(result, {
    headers: {
      "Cache-Control": "private, max-age=0, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
