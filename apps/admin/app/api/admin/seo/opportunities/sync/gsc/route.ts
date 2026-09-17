import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isConfiguredAdminOrigin, isSameOriginAdminMutation } from "@/lib/admin/auth-config";
import { getAdminIdentity } from "@/lib/admin/identity";
import { hasAdminPermission } from "@/lib/admin/rbac";
import { joinGscDashboardRows, previousEqualDateRange } from "@/lib/admin/seo-intelligence/contracts";
import { getSeoIntelligenceRuntimeStatus } from "@/lib/admin/seo-intelligence/foundation";
import { getGoogleDataAccessToken } from "@/lib/admin/seo-intelligence/google-data-auth";
import { fetchGscSearchAnalytics, fetchGscSearchAnalyticsTotals } from "@/lib/admin/seo-intelligence/providers/gsc";

const inputSchema = z.object({
  startDate: z.iso.date(),
  endDate: z.iso.date(),
}).superRefine((input, context) => {
  const start = Date.parse(`${input.startDate}T00:00:00Z`);
  const end = Date.parse(`${input.endDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["startDate"], message: "Invalid date range" });
  } else if ((end - start) / 86_400_000 >= 90) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["endDate"], message: "Date range exceeds 90 days" });
  }
});

let syncInFlight = false;

function providerError(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  if (code === "GSC_AUTH_REQUIRED") return "provider-auth-required";
  if (code === "GSC_RATE_LIMITED") return "provider-rate-limited";
  if (code === "GSC_TIMEOUT") return "provider-timeout";
  if (code === "GSC_INVALID_RESPONSE") return "provider-invalid-response";
  return "provider-unavailable";
}

export async function POST(request: Request) {
  const identity = await getAdminIdentity();
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (identity.actorType !== "human" || !hasAdminPermission(identity.role, "research:provider-query")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (
    !isConfiguredAdminOrigin(request.url, process.env.AUTH_URL) ||
    !isSameOriginAdminMutation(request.url, request.headers.get("origin"))
  ) return NextResponse.json({ error: "forbidden-origin" }, { status: 403 });
  if (!getSeoIntelligenceRuntimeStatus().enabled) return NextResponse.json({ error: "not-found" }, { status: 404 });

  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid-input" }, { status: 400 });

  const siteUrl = process.env.CCPUN_GSC_SITE_URL?.trim();
  if (!siteUrl) return NextResponse.json({ error: "provider-not-connected" }, { status: 409 });
  if (syncInFlight) return NextResponse.json({ error: "sync-in-progress" }, { status: 409 });

  syncInFlight = true;
  const requestId = randomUUID();
  const dimensions = ["query", "page"] as const;
  const comparisonRange = previousEqualDateRange(parsed.data.startDate, parsed.data.endDate);
  try {
    // ponytail: one owner and one manual sync at a time; use a durable lock only when scheduled sync exists.
    const token = await getGoogleDataAccessToken();
    const [current, currentTotals] = await Promise.all([
      fetchGscSearchAnalytics({ siteUrl, token, ...parsed.data, dimensions }),
      fetchGscSearchAnalyticsTotals({ siteUrl, token, ...parsed.data }),
    ]);
    let previous: Awaited<ReturnType<typeof fetchGscSearchAnalytics>> | null = null;
    let previousTotals: Awaited<ReturnType<typeof fetchGscSearchAnalyticsTotals>> | null = null;
    let comparisonError: string | null = null;
    try {
      [previous, previousTotals] = await Promise.all([
        fetchGscSearchAnalytics({ siteUrl, token, ...comparisonRange, dimensions }),
        fetchGscSearchAnalyticsTotals({ siteUrl, token, ...comparisonRange }),
      ]);
    } catch (error) {
      comparisonError = providerError(error);
    }
    const joinedRows = joinGscDashboardRows(current.rows, previous?.rows ?? []);
    const rows = [...joinedRows]
      .sort((a, b) => b.current.impressions - a.current.impressions || b.current.clicks - a.current.clicks)
      .slice(0, 100);
    const signals = joinedRows
      .filter((row) => row.previous !== null)
      .sort((a, b) => Math.abs(b.current.clicks - b.previous!.clicks) - Math.abs(a.current.clicks - a.previous!.clicks))
      .slice(0, 3);
    return NextResponse.json({
      requestId,
      source: "gsc",
      state: previous && previousTotals ? "ready" : "partial",
      dateRange: parsed.data,
      comparisonRange,
      fetchedAt: new Date().toISOString(),
      current: currentTotals.totals,
      comparison: previousTotals?.totals ?? null,
      comparisonError,
      rows,
      signals,
      truncated: current.truncated || Boolean(previous?.truncated),
      limitations: [
        current.limitation,
        ...(previous ? [previous.limitation] : []),
        "ยอดรวมมาจากรายงานแบบไม่แบ่ง dimension; รายละเอียด query/page อาจรวมไม่เท่ายอดรวมเพราะ Search Console ปกปิด query ปริมาณต่ำหรือไม่ระบุตัวตน",
        "รายละเอียดจับคู่ช่วงก่อนหน้าด้วย query และ page ที่ตรงกันทุกตัวอักษร จำกัด 100 แถวหลังเรียงจากข้อมูลที่ดึงได้ และไม่บันทึกข้อมูล",
      ],
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "GOOGLE_DATA_NOT_CONFIGURED") return NextResponse.json({ error: "provider-not-connected", requestId }, { status: 409 });
    if (code === "GOOGLE_DATA_AUTH_REQUIRED") return NextResponse.json({ error: "provider-auth-required", requestId }, { status: 401 });
    if (code === "GOOGLE_DATA_RATE_LIMITED") return NextResponse.json({ error: "provider-rate-limited", requestId }, { status: 429, headers: { "Retry-After": "60" } });
    if (code === "GOOGLE_DATA_TIMEOUT") return NextResponse.json({ error: "provider-timeout", requestId }, { status: 504 });
    if (code === "GOOGLE_DATA_INVALID_RESPONSE") return NextResponse.json({ error: "provider-invalid-response", requestId }, { status: 502 });
    if (code === "GSC_AUTH_REQUIRED") return NextResponse.json({ error: "provider-auth-required", requestId }, { status: 401 });
    if (code === "GSC_RATE_LIMITED") return NextResponse.json({ error: "provider-rate-limited", requestId }, { status: 429, headers: { "Retry-After": "60" } });
    if (code === "GSC_TIMEOUT") return NextResponse.json({ error: "provider-timeout", requestId }, { status: 504 });
    if (code === "GSC_INVALID_RESPONSE") return NextResponse.json({ error: "provider-invalid-response", requestId }, { status: 502 });
    return NextResponse.json({ error: "provider-unavailable", requestId }, { status: 502 });
  } finally {
    syncInFlight = false;
  }
}
