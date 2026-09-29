import { NextResponse } from "next/server";
import { getAdminIdentity } from "@/lib/admin/identity";
import { ownerDatasetToCsv } from "@/lib/admin/agent-os/export-csv";
import { PERFORMANCE_VIEWS, buildPerformanceExport, type PerformanceView } from "@/lib/admin/analytics/performance";
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
  const url = new URL(request.url), format = url.searchParams.get("format") ?? "csv", report = url.searchParams.get("report"), requestedView = url.searchParams.get("view"), rawArchive = url.searchParams.get("raw") === "1";
  const view = requestedView ?? (!report && format === "csv" && !rawArchive ? "tracking-overview" : null);
  if (!["csv", "xlsx"].includes(format) || (report && !analyticsReportSchema.safeParse(report).success) || (rawArchive && (format !== "csv" || report !== null || requestedView !== null)) || (view !== null && (!PERFORMANCE_VIEWS.includes(view as PerformanceView) || report !== null || format !== "csv"))) return NextResponse.json({ error: "invalid-export-request" }, { status: 400, headers });
  const model = await readAnalyticsDashboard();
  const datasets = model.datasets.filter((data) => !report || data.report === report);
  if (model.state !== "ready" || !datasets.length) return NextResponse.json({ error: "no-completed-data" }, { status: 503, headers });
  const now = new Date().toISOString();
  const fileLabels: Partial<Record<PerformanceView, string>> = {
    "tracking-overview": "Marketing_Tracking",
    "content-performance": "Content_Performance",
    "keyword-performance": "Keyword_Performance",
    "seo-review": "SEO_Review",
    "measurement-gaps": "Measurement_Gaps",
    "campaign-performance": "Traffic_Campaigns",
    "marketing-activities": "Marketing_Activities",
  };
  const filename = rawArchive ? "CCPun_Marketing_Raw_Archive_" + now.slice(0, 10) + ".csv" : "CCPun_" + (view ? fileLabels[view as PerformanceView] : report ?? "Marketing_Analysis") + "_" + now.slice(0, 10) + "." + format;
  const analysis = view ? buildPerformanceExport(datasets, view as PerformanceView, now) : null;
  if (analysis && !analysis.rows.length) return NextResponse.json({ error: "no-completed-data-for-view" }, { status: 503, headers });
  const content = format === "xlsx" ? new Uint8Array(marketingExportXlsx(datasets, now)) : ownerDatasetToCsv(rawArchive ? buildStoredMarketingExport(datasets, now) : analysis ?? buildStoredMarketingExport(datasets, now));
  return new NextResponse(analyticsExportStream(content), { headers: { ...headers, "Content-Disposition": `attachment; filename="${filename}"`, "Content-Type": format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv; charset=utf-8" } });
}
