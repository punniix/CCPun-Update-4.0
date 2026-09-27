import { NextResponse } from "next/server";
import { z } from "zod";
import { isN8nExportRequestAuthorized } from "@/lib/admin/agent-os/export-service-auth";
import { buildMarketingWorkspace } from "@/lib/admin/marketing/export";
import { readMarketingAnalysis } from "@/lib/admin/marketing/analysis";
import { readMarketingDashboard } from "@/lib/admin/marketing/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow, noarchive", "X-Content-Type-Options": "nosniff" };
const input = z.object({ generatedAt: z.iso.datetime().optional() }).strict();

export async function POST(request: Request) {
  if (!isN8nExportRequestAuthorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  let value: unknown;
  try {
    const reader = request.body?.getReader(); if (!reader) throw new Error("INVALID_BODY");
    const chunks: Uint8Array[] = []; let size = 0;
    for (;;) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.length; if (size > 1024) { await reader.cancel(); return NextResponse.json({ error: "payload-too-large" }, { status: 413, headers }); } chunks.push(chunk.value); }
    value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch { return NextResponse.json({ error: "invalid-json" }, { status: 400, headers }); }
  const parsed = input.safeParse(value);
  if (!parsed.success || (parsed.data.generatedAt && Math.abs(Date.now() - Date.parse(parsed.data.generatedAt)) > 10 * 60_000)) return NextResponse.json({ error: "invalid-workspace-request" }, { status: 400, headers });
  const cutoff = parsed.data.generatedAt ?? new Date().toISOString();
  const [weekly, monthly, weeklyAnalysis, monthlyAnalysis] = await Promise.all([readMarketingDashboard("this_week", process.env, cutoff), readMarketingDashboard("this_month", process.env, cutoff), readMarketingAnalysis("this_week"), readMarketingAnalysis("this_month")]);
  try {
    return NextResponse.json({ ...buildMarketingWorkspace(weekly, monthly, { this_week: weeklyAnalysis, this_month: monthlyAnalysis }), spreadsheetId: "1zpXXHuQ152wSZXdHb0yFJPVcdQiGOHvz4Yhxrmjdo-o", refresh: { status: "prepared", cutoff, windows: ["this_week", "this_month"], preserveLegacyTabs: true, humanActionAuthority: "Admin/Neon" } }, { headers });
  } catch { return NextResponse.json({ error: "stored-workspace-not-ready" }, { status: 503, headers }); }
}
