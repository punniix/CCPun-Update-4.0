import { getFundDetail } from "@/features/investment-allocation/server/sec-v2";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectId = (url.searchParams.get("proj_id") ?? "").trim();
  const className = url.searchParams.get("class_name")?.trim() || null;

  if (!/^M\d{4}_\d{4}$/.test(projectId)) return Response.json({ error: "proj_id_invalid" }, { status: 400 });
  if (className && className.length > 120) return Response.json({ error: "class_name_invalid" }, { status: 400 });

  const result = await getFundDetail(projectId, className);
  return Response.json(result, {
    headers: {
      "Cache-Control": "private, max-age=0, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
