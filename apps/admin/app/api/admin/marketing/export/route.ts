import { NextResponse } from "next/server";
import { getAdminIdentity } from "@/lib/admin/identity";
import { analyticsExportStream } from "@/lib/admin/analytics/export";
import { buildMarketingWorkspace, MARKETING_SHEET_TITLES, marketingWorkspaceCsv, marketingWorkspaceXlsx, type MarketingSheetTitle } from "@/lib/admin/marketing/export";
import { readMarketingAnalysis } from "@/lib/admin/marketing/analysis";
import { readMarketingWorkspaceModels } from "@/lib/admin/marketing/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow, noarchive", "X-Content-Type-Options": "nosniff" };
  const identity = await getAdminIdentity();
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  if (identity.role !== "owner") return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
  const url = new URL(request.url), format = url.searchParams.get("format") ?? "xlsx", sheet = url.searchParams.get("sheet");
  if (!["csv", "xlsx"].includes(format) || (sheet !== null && !MARKETING_SHEET_TITLES.includes(sheet as MarketingSheetTitle)) || (format === "csv" && !sheet)) return NextResponse.json({ error: "invalid-export-request" }, { status: 400, headers });
  try {
    const [snapshot, weeklyAnalysis, monthlyAnalysis] = await Promise.all([readMarketingWorkspaceModels(new Date().toISOString()), readMarketingAnalysis("this_week"), readMarketingAnalysis("this_month")]);
    const { weekly, monthly, cutoff } = snapshot;
    const workspace = buildMarketingWorkspace(weekly, monthly, { this_week: weeklyAnalysis, this_month: monthlyAnalysis });
    const content = format === "xlsx" ? new Uint8Array(marketingWorkspaceXlsx(workspace)) : marketingWorkspaceCsv(workspace, sheet as MarketingSheetTitle);
    return new NextResponse(analyticsExportStream(content), { headers: { ...headers, "Content-Disposition": `attachment; filename="CCPun_Performance_Marketing_${sheet ? sheet.replaceAll(" ", "_").replaceAll("&", "and") : "Workspace"}_${cutoff.slice(0, 10)}.${format}"`, "Content-Type": format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv; charset=utf-8" } });
  } catch { return NextResponse.json({ error: "stored-workspace-not-ready" }, { status: 503, headers }); }
}
