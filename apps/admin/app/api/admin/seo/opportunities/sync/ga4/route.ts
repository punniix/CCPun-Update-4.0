import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isConfiguredAdminOrigin, isSameOriginAdminMutation } from "@/lib/admin/auth-config";
import { getAdminIdentity } from "@/lib/admin/identity";
import { hasAdminPermission } from "@/lib/admin/rbac";
import { joinGa4DashboardRows, previousEqualDateRange } from "@/lib/admin/seo-intelligence/contracts";
import { getSeoIntelligenceRuntimeStatus } from "@/lib/admin/seo-intelligence/foundation";
import { getGoogleDataAccessToken } from "@/lib/admin/seo-intelligence/google-data-auth";
import { fetchGa4LandingPages, fetchGa4OrganicTotals } from "@/lib/admin/seo-intelligence/providers/ga4";

const inputSchema = z.object({ startDate: z.iso.date(), endDate: z.iso.date() }).superRefine((input, context) => {
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
  if (code === "GA4_AUTH_REQUIRED") return { error: "provider-auth-required", status: 409 };
  if (code === "GA4_RATE_LIMITED") return { error: "provider-rate-limited", status: 429 };
  if (code === "GA4_TIMEOUT") return { error: "provider-timeout", status: 504 };
  if (code === "GA4_INVALID_RESPONSE") return { error: "provider-invalid-response", status: 502 };
  return { error: "provider-unavailable", status: 502 };
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
  const propertyId = process.env.CCPUN_GA4_PROPERTY_ID?.trim();
  if (!propertyId) return NextResponse.json({ error: "provider-not-connected" }, { status: 409 });
  if (syncInFlight) return NextResponse.json({ error: "sync-in-progress" }, { status: 409 });

  syncInFlight = true;
  const requestId = randomUUID();
  const comparisonRange = previousEqualDateRange(parsed.data.startDate, parsed.data.endDate);
  try {
    // ponytail: one owner and one manual sync at a time; add a durable lock only with scheduled sync.
    const token = await getGoogleDataAccessToken();
    const [current, currentTotals] = await Promise.all([
      fetchGa4LandingPages({ propertyId, token, ...parsed.data }),
      fetchGa4OrganicTotals({ propertyId, token, ...parsed.data }),
    ]);
    let comparison: Awaited<ReturnType<typeof fetchGa4LandingPages>> | null = null;
    let comparisonTotals: Awaited<ReturnType<typeof fetchGa4OrganicTotals>> | null = null;
    let comparisonError: string | null = null;
    try {
      [comparison, comparisonTotals] = await Promise.all([
        fetchGa4LandingPages({ propertyId, token, ...comparisonRange }),
        fetchGa4OrganicTotals({ propertyId, token, ...comparisonRange }),
      ]);
    } catch (error) {
      comparisonError = providerError(error).error;
    }
    const joinedRows = joinGa4DashboardRows(current.rows, comparison?.rows ?? []);
    const rows = [...joinedRows]
      .sort((a, b) => b.current.sessions - a.current.sessions)
      .slice(0, 100);
    const signals = joinedRows
      .filter((row) => row.previous !== null)
      .sort((a, b) => Math.abs(b.current.sessions - b.previous!.sessions) - Math.abs(a.current.sessions - a.previous!.sessions))
      .slice(0, 3);
    return NextResponse.json({
      requestId,
      source: "ga4",
      state: comparison && comparisonTotals ? "ready" : "partial",
      channel: "Organic Search",
      dateRange: parsed.data,
      comparisonRange,
      fetchedAt: new Date().toISOString(),
      timeZone: currentTotals.timeZone ?? current.timeZone,
      current: currentTotals.totals,
      comparison: comparisonTotals?.totals ?? null,
      comparisonError,
      rows,
      signals,
      truncated: current.truncated || Boolean(comparison?.truncated),
      limitations: [...new Set([
        ...currentTotals.limitations,
        ...current.limitations,
        ...(comparisonTotals?.limitations ?? []),
        ...(comparison?.limitations ?? []),
        "ยอดรวม Organic Search มาจากรายงานแบบไม่แบ่ง landing page; รายละเอียดไม่รวม (not set)",
        "รายละเอียดจับคู่ช่วงก่อนหน้าด้วย landing page ที่ตรงกันทุกตัวอักษร จำกัด 100 แถวหลัง exact join และไม่บันทึกข้อมูล",
      ])],
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "GOOGLE_DATA_NOT_CONFIGURED") return NextResponse.json({ error: "provider-not-connected", requestId }, { status: 409 });
    if (code === "GOOGLE_DATA_AUTH_REQUIRED") return NextResponse.json({ error: "provider-auth-required", requestId }, { status: 401 });
    if (code === "GOOGLE_DATA_RATE_LIMITED") return NextResponse.json({ error: "provider-rate-limited", requestId }, { status: 429, headers: { "Retry-After": "60" } });
    if (code === "GOOGLE_DATA_TIMEOUT") return NextResponse.json({ error: "provider-timeout", requestId }, { status: 504 });
    if (code === "GOOGLE_DATA_INVALID_RESPONSE") return NextResponse.json({ error: "provider-invalid-response", requestId }, { status: 502 });
    const mapped = providerError(error);
    return NextResponse.json({ error: mapped.error, requestId }, {
      status: mapped.status,
      ...(mapped.status === 429 ? { headers: { "Retry-After": "60" } } : {}),
    });
  } finally {
    syncInFlight = false;
  }
}
