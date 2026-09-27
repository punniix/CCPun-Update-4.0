import { NextResponse } from "next/server";
import { z } from "zod";
import { isN8nExportRequestAuthorized } from "@/lib/admin/agent-os/export-service-auth";
import { analyticsDate } from "@/lib/admin/analytics/model";
import { enqueueDailyAssessment } from "@/lib/admin/analytics/assessment";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow, noarchive", "X-Content-Type-Options": "nosniff" };
const input = z.object({ date: z.iso.date().optional() }).strict();
export async function POST(request: Request) {
  if (!isN8nExportRequestAuthorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  if (Number(request.headers.get("content-length")) > 1024) return NextResponse.json({ error: "payload-too-large" }, { status: 413, headers });
  const text = await request.text();
  if (Buffer.byteLength(text) > 1024) return NextResponse.json({ error: "payload-too-large" }, { status: 413, headers });
  let value: unknown; try { value = JSON.parse(text); } catch { return NextResponse.json({ error: "invalid-json" }, { status: 400, headers }); }
  const parsed = input.safeParse(value);
  if (!parsed.success || (parsed.data.date && parsed.data.date !== analyticsDate())) return NextResponse.json({ error: "invalid-assessment-request" }, { status: 400, headers });
  try { return NextResponse.json(await enqueueDailyAssessment(parsed.data.date), { headers }); }
  catch (error) { const backpressure = error instanceof Error && error.message === "LOCAL_AI_BACKPRESSURE"; return NextResponse.json({ error: backpressure ? "analytics-review-busy" : "analytics-review-unavailable" }, { status: backpressure ? 429 : 503, headers }); }
}
