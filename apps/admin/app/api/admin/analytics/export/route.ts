import { NextResponse } from "next/server";
import { getAdminIdentity } from "@/lib/admin/identity";
import { ownerDatasetToCsv } from "@/lib/admin/agent-os/export-csv";
import { analyticsReportSchema } from "@/lib/admin/analytics/model";
import { readAnalyticsDashboard } from "@/lib/admin/analytics/store";
import { analyticsExportStream, buildStoredMarketingExport, marketingExportXlsx } from "@/lib/admin/analytics/export";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow, noarchive", "X-Content-Type-Options": "nosniff" };
  const identity = await getAdminIdentity();
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  if (identity.role !== "owner") return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
  const url = new URL(request.url), format = url.searchParams.get("format") ?? "csv", report = url.searchParams.get("report");
  if (!["csv", "xlsx"].includes(format) || (report && !analyticsReportSchema.safeParse(report).success)) return NextResponse.json({ error: "invalid-export-request" }, { status: 400, headers });
  const model = await readAnalyticsDashboard();
  const datasets = model.datasets.filter((data) => !report || data.report === report);
  if (model.state !== "ready" || !datasets.length) return NextResponse.json({ error: "no-completed-data" }, { status: 503, headers });
  const now = new Date().toISOString(), filename = `CCPun_${report ?? "Marketing"}_${now.slice(0, 10)}.${format}`;
  const content = format === "xlsx" ? new Uint8Array(marketingExportXlsx(datasets, now)) : ownerDatasetToCsv(buildStoredMarketingExport(datasets, now));
  return new NextResponse(analyticsExportStream(content), { headers: { ...headers, "Content-Disposition": `attachment; filename="${filename}"`, "Content-Type": format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv; charset=utf-8" } });
}
