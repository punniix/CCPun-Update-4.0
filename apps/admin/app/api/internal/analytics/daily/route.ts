import { NextResponse } from "next/server";
import { z } from "zod";
import { isN8nExportRequestAuthorized } from "@/lib/admin/agent-os/export-service-auth";
import { analyticsSourceSchema, analyticsDate } from "@/lib/admin/analytics/model";
import { collectAnalyticsSource } from "@/lib/admin/analytics/collect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow, noarchive", "X-Content-Type-Options": "nosniff" };
const input = z.object({ source: analyticsSourceSchema, date: z.iso.date().optional() }).strict();
export async function POST(request: Request) {
  if (!isN8nExportRequestAuthorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  const text = await request.text();
  if (Buffer.byteLength(text) > 1024) return NextResponse.json({ error: "payload-too-large" }, { status: 413, headers });
  let value: unknown; try { value = JSON.parse(text); } catch { return NextResponse.json({ error: "invalid-json" }, { status: 400, headers }); }
  const parsed = input.safeParse(value);
  if (!parsed.success || (parsed.data.date && parsed.data.date !== analyticsDate())) return NextResponse.json({ error: "invalid-collection-request" }, { status: 400, headers });
  try { return NextResponse.json({ results: [await collectAnalyticsSource(parsed.data.source, parsed.data.date)] }, { headers }); }
  catch { return NextResponse.json({ error: "analytics-runtime-unavailable" }, { status: 503, headers }); }
}
