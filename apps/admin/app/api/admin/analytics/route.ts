import { NextResponse } from "next/server";
import { getAdminIdentity } from "@/lib/admin/identity";
import { readAnalyticsDashboard } from "@/lib/admin/analytics/store";
import { analyticsExportStream } from "@/lib/admin/analytics/export";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow, noarchive", "X-Content-Type-Options": "nosniff" };
  const identity = await getAdminIdentity();
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  if (identity.role !== "owner") return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
  const data = await readAnalyticsDashboard();
  return new NextResponse(analyticsExportStream(JSON.stringify(data)), { status: data.state === "ready" ? 200 : 503, headers: { ...headers, "Content-Type": "application/json; charset=utf-8" } });
}
