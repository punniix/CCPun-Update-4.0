import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isPostPublishAdminOriginAllowed } from "@/lib/admin/seo-intelligence/post-publish-origin";
import { getAdminEnvironment } from "@/lib/admin/environment";
import { getAdminIdentity } from "@/lib/admin/identity";
import { hasAdminPermission } from "@/lib/admin/rbac";
import { joinGa4DashboardRows, previousEqualDateRange } from "@/lib/admin/seo-intelligence/contracts";
import { getSeoIntelligenceRuntimeStatus } from "@/lib/admin/seo-intelligence/foundation";
import { getGoogleDataAccessToken } from "@/lib/admin/seo-intelligence/google-data-auth";
import { cookies } from "next/headers";
import { getConnectedGoogleAccessToken, hasGoogleSessionGrant } from "@/lib/admin/seo-intelligence/google-session-connection";
import { fetchGa4LandingPages, fetchGa4OrganicTotals, getGa4FailurePhase } from "@/lib/admin/seo-intelligence/providers/ga4";

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

const GA4_SYNC_STAGE_MARKERS = {
  entry: "CCPUN_GA4_SYNC_STAGE:entry",
  gatesPassed: "CCPUN_GA4_SYNC_STAGE:gates-passed",
  tokenReady: "CCPUN_GA4_SYNC_STAGE:token-ready",
  currentReady: "CCPUN_GA4_SYNC_STAGE:current-ready",
  comparisonReady: "CCPUN_GA4_SYNC_STAGE:comparison-ready",
  comparisonPartial: "CCPUN_GA4_SYNC_STAGE:comparison-partial",
  failed: "CCPUN_GA4_SYNC_STAGE:failed",
  finished: "CCPUN_GA4_SYNC_STAGE:finished",
  failedGa4Auth: "CCPUN_GA4_SYNC_STAGE:failed-ga4-auth",
  failedGa4Rate: "CCPUN_GA4_SYNC_STAGE:failed-ga4-rate",
  failedGa4Timeout: "CCPUN_GA4_SYNC_STAGE:failed-ga4-timeout",
  failedGa4Invalid: "CCPUN_GA4_SYNC_STAGE:failed-ga4-invalid",
  failedGa4Unavailable: "CCPUN_GA4_SYNC_STAGE:failed-ga4-unavailable",
  failedUnclassified: "CCPUN_GA4_SYNC_STAGE:failed-unclassified",
  errorResponseReady: "CCPUN_GA4_SYNC_STAGE:error-response-ready",
  phaseInput: "CCPUN_GA4_SYNC_STAGE:phase-input",
  phaseFetch: "CCPUN_GA4_SYNC_STAGE:phase-fetch",
  phaseHttp: "CCPUN_GA4_SYNC_STAGE:phase-http",
  phaseDecode: "CCPUN_GA4_SYNC_STAGE:phase-decode",
  phaseSchemaHeaders: "CCPUN_GA4_SYNC_STAGE:phase-schema-headers",
  phaseSchemaDimensionValue: "CCPUN_GA4_SYNC_STAGE:phase-schema-dimension-value",
  phaseSchemaMetricValue: "CCPUN_GA4_SYNC_STAGE:phase-schema-metric-value",
  phaseSchemaRowCount: "CCPUN_GA4_SYNC_STAGE:phase-schema-row-count",
  phaseSchemaMetadata: "CCPUN_GA4_SYNC_STAGE:phase-schema-metadata",
  phaseSchemaOther: "CCPUN_GA4_SYNC_STAGE:phase-schema-other",
  phaseNormalizeHeaders: "CCPUN_GA4_SYNC_STAGE:phase-normalize-headers",
  phaseNormalizeValues: "CCPUN_GA4_SYNC_STAGE:phase-normalize-values",
  phaseNormalizeOther: "CCPUN_GA4_SYNC_STAGE:phase-normalize-other",
  headerSchemaHeadersLandingDimensionMissing: "CCPUN_GA4_SYNC_STAGE:schema-headers-landing-dimension-missing",
  headerSchemaHeadersLandingDimensionNull: "CCPUN_GA4_SYNC_STAGE:schema-headers-landing-dimension-null",
  headerSchemaHeadersLandingDimensionNonarray: "CCPUN_GA4_SYNC_STAGE:schema-headers-landing-dimension-nonarray",
  headerSchemaHeadersLandingDimensionNameInvalid: "CCPUN_GA4_SYNC_STAGE:schema-headers-landing-dimension-name-invalid",
  headerSchemaHeadersLandingDimensionOther: "CCPUN_GA4_SYNC_STAGE:schema-headers-landing-dimension-other",
  headerSchemaHeadersLandingMetricMissing: "CCPUN_GA4_SYNC_STAGE:schema-headers-landing-metric-missing",
  headerSchemaHeadersLandingMetricNull: "CCPUN_GA4_SYNC_STAGE:schema-headers-landing-metric-null",
  headerSchemaHeadersLandingMetricNonarray: "CCPUN_GA4_SYNC_STAGE:schema-headers-landing-metric-nonarray",
  headerSchemaHeadersLandingMetricNameInvalid: "CCPUN_GA4_SYNC_STAGE:schema-headers-landing-metric-name-invalid",
  headerSchemaHeadersLandingMetricOther: "CCPUN_GA4_SYNC_STAGE:schema-headers-landing-metric-other",
  headerSchemaHeadersTotalsDimensionMissing: "CCPUN_GA4_SYNC_STAGE:schema-headers-totals-dimension-missing",
  headerSchemaHeadersTotalsDimensionNull: "CCPUN_GA4_SYNC_STAGE:schema-headers-totals-dimension-null",
  headerSchemaHeadersTotalsDimensionNonarray: "CCPUN_GA4_SYNC_STAGE:schema-headers-totals-dimension-nonarray",
  headerSchemaHeadersTotalsDimensionNameInvalid: "CCPUN_GA4_SYNC_STAGE:schema-headers-totals-dimension-name-invalid",
  headerSchemaHeadersTotalsDimensionOther: "CCPUN_GA4_SYNC_STAGE:schema-headers-totals-dimension-other",
  headerSchemaHeadersTotalsMetricMissing: "CCPUN_GA4_SYNC_STAGE:schema-headers-totals-metric-missing",
  headerSchemaHeadersTotalsMetricNull: "CCPUN_GA4_SYNC_STAGE:schema-headers-totals-metric-null",
  headerSchemaHeadersTotalsMetricNonarray: "CCPUN_GA4_SYNC_STAGE:schema-headers-totals-metric-nonarray",
  headerSchemaHeadersTotalsMetricNameInvalid: "CCPUN_GA4_SYNC_STAGE:schema-headers-totals-metric-name-invalid",
  headerSchemaHeadersTotalsMetricOther: "CCPUN_GA4_SYNC_STAGE:schema-headers-totals-metric-other",
  phaseUnclassified: "CCPUN_GA4_SYNC_STAGE:phase-unclassified",
} as const;

function traceGa4SyncStage(stage: keyof typeof GA4_SYNC_STAGE_MARKERS) {
  try {
    if (getAdminEnvironment() === "admin-uat"
      && process.env.CCPUN_DEPLOYMENT_PROVIDER?.trim() === "hostinger"
      && process.env.CCPUN_DEPLOYMENT_ROLE?.trim() === "admin"
      && Object.hasOwn(GA4_SYNC_STAGE_MARKERS, stage)) console.warn(GA4_SYNC_STAGE_MARKERS[stage]);
  } catch { /* Best-effort fixed UAT markers never change request behavior. */ }
}


function traceGa4FailurePhase(error: unknown) {
  try {
    const phase = error instanceof z.ZodError ? "input"
      : getGa4FailurePhase(error);
    switch (phase) {
      case "input": traceGa4SyncStage("phaseInput"); break;
      case "fetch": traceGa4SyncStage("phaseFetch"); break;
      case "http": traceGa4SyncStage("phaseHttp"); break;
      case "decode": traceGa4SyncStage("phaseDecode"); break;
      case "schema-headers": traceGa4SyncStage("phaseSchemaHeaders"); break;
      case "schema-headers-landing-dimension-missing": traceGa4SyncStage("phaseSchemaHeaders"); traceGa4SyncStage("headerSchemaHeadersLandingDimensionMissing"); break;
      case "schema-headers-landing-dimension-null": traceGa4SyncStage("phaseSchemaHeaders"); traceGa4SyncStage("headerSchemaHeadersLandingDimensionNull"); break;
      case "schema-headers-landing-dimension-nonarray": traceGa4SyncStage("phaseSchemaHeaders"); traceGa4SyncStage("headerSchemaHeadersLandingDimensionNonarray"); break;
      case "schema-headers-landing-dimension-name-invalid": traceGa4SyncStage("phaseSchemaHeaders"); traceGa4SyncStage("headerSchemaHeadersLandingDimensionNameInvalid"); break;
      case "schema-headers-landing-dimension-other": traceGa4SyncStage("phaseSchemaHeaders"); traceGa4SyncStage("headerSchemaHeadersLandingDimensionOther"); break;
      case "schema-headers-landing-metric-missing": traceGa4SyncStage("phaseSchemaHeaders"); traceGa4SyncStage("headerSchemaHeadersLandingMetricMissing"); break;
      case "schema-headers-landing-metric-null": traceGa4SyncStage("phaseSchemaHeaders"); traceGa4SyncStage("headerSchemaHeadersLandingMetricNull"); break;
      case "schema-headers-landing-metric-nonarray": traceGa4SyncStage("phaseSchemaHeaders"); traceGa4SyncStage("headerSchemaHeadersLandingMetricNonarray"); break;
      case "schema-headers-landing-metric-name-invalid": traceGa4SyncStage("phaseSchemaHeaders"); traceGa4SyncStage("headerSchemaHeadersLandingMetricNameInvalid"); break;
      case "schema-headers-landing-metric-other": traceGa4SyncStage("phaseSchemaHeaders"); traceGa4SyncStage("headerSchemaHeadersLandingMetricOther"); break;
      case "schema-headers-totals-dimension-missing": traceGa4SyncStage("phaseSchemaHeaders"); traceGa4SyncStage("headerSchemaHeadersTotalsDimensionMissing"); break;
      case "schema-headers-totals-dimension-null": traceGa4SyncStage("phaseSchemaHeaders"); traceGa4SyncStage("headerSchemaHeadersTotalsDimensionNull"); break;
      case "schema-headers-totals-dimension-nonarray": traceGa4SyncStage("phaseSchemaHeaders"); traceGa4SyncStage("headerSchemaHeadersTotalsDimensionNonarray"); break;
      case "schema-headers-totals-dimension-name-invalid": traceGa4SyncStage("phaseSchemaHeaders"); traceGa4SyncStage("headerSchemaHeadersTotalsDimensionNameInvalid"); break;
      case "schema-headers-totals-dimension-other": traceGa4SyncStage("phaseSchemaHeaders"); traceGa4SyncStage("headerSchemaHeadersTotalsDimensionOther"); break;
      case "schema-headers-totals-metric-missing": traceGa4SyncStage("phaseSchemaHeaders"); traceGa4SyncStage("headerSchemaHeadersTotalsMetricMissing"); break;
      case "schema-headers-totals-metric-null": traceGa4SyncStage("phaseSchemaHeaders"); traceGa4SyncStage("headerSchemaHeadersTotalsMetricNull"); break;
      case "schema-headers-totals-metric-nonarray": traceGa4SyncStage("phaseSchemaHeaders"); traceGa4SyncStage("headerSchemaHeadersTotalsMetricNonarray"); break;
      case "schema-headers-totals-metric-name-invalid": traceGa4SyncStage("phaseSchemaHeaders"); traceGa4SyncStage("headerSchemaHeadersTotalsMetricNameInvalid"); break;
      case "schema-headers-totals-metric-other": traceGa4SyncStage("phaseSchemaHeaders"); traceGa4SyncStage("headerSchemaHeadersTotalsMetricOther"); break;
      case "schema-dimension-value": traceGa4SyncStage("phaseSchemaDimensionValue"); break;
      case "schema-metric-value": traceGa4SyncStage("phaseSchemaMetricValue"); break;
      case "schema-row-count": traceGa4SyncStage("phaseSchemaRowCount"); break;
      case "schema-metadata": traceGa4SyncStage("phaseSchemaMetadata"); break;
      case "schema-other": traceGa4SyncStage("phaseSchemaOther"); break;
      case "normalize-headers": traceGa4SyncStage("phaseNormalizeHeaders"); break;
      case "normalize-values": traceGa4SyncStage("phaseNormalizeValues"); break;
      case "normalize-other": traceGa4SyncStage("phaseNormalizeOther"); break;
      default: traceGa4SyncStage("phaseUnclassified");
    }
  } catch { /* Diagnostic metadata never changes the existing failure response. */ }
}

function providerError(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  if (code === "GA4_AUTH_REQUIRED") return { error: "provider-auth-required", status: 409 };
  if (code === "GA4_RATE_LIMITED") return { error: "provider-rate-limited", status: 429 };
  if (code === "GA4_TIMEOUT") return { error: "provider-timeout", status: 504 };
  if (code === "GA4_INVALID_RESPONSE") return { error: "provider-invalid-response", status: 502 };
  return { error: "provider-unavailable", status: 502 };
}

export async function POST(request: Request) {
  traceGa4SyncStage("entry");
  const identity = await getAdminIdentity();
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (identity.actorType !== "human" || !hasAdminPermission(identity.role, "research:provider-query")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!isPostPublishAdminOriginAllowed(request, process.env, getAdminEnvironment())) return NextResponse.json({ error: "forbidden-origin" }, { status: 403 });
  if (!getSeoIntelligenceRuntimeStatus().enabled) return NextResponse.json({ error: "not-found" }, { status: 404 });

  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid-input" }, { status: 400 });
  const propertyId = process.env.CCPUN_GA4_PROPERTY_ID?.trim();
  if (!propertyId) return NextResponse.json({ error: "provider-not-connected" }, { status: 409 });
  const expectedProperty = getAdminEnvironment() === "production-admin" ? "219719845" : getAdminEnvironment() === "admin-uat" ? "551040812" : null;
  if (expectedProperty && propertyId !== expectedProperty) return NextResponse.json({ error: "provider-not-connected" }, { status: 409 });
  if (syncInFlight) return NextResponse.json({ error: "sync-in-progress" }, { status: 409 });

  syncInFlight = true;
  const requestId = randomUUID();
  const comparisonRange = previousEqualDateRange(parsed.data.startDate, parsed.data.endDate);
  try {
    traceGa4SyncStage("gatesPassed");
    // ponytail: one owner and one manual sync at a time; add a durable lock only with scheduled sync.
    const token = getAdminEnvironment() === "admin-uat" || hasGoogleSessionGrant(request, process.env)
      ? await getConnectedGoogleAccessToken(request, identity, process.env,
        asyncCookieWriter(await cookies()))
      : await getGoogleDataAccessToken();
    traceGa4SyncStage("tokenReady");
    const [current, currentTotals] = await Promise.all([
      fetchGa4LandingPages({ propertyId, token, ...parsed.data }),
      fetchGa4OrganicTotals({ propertyId, token, ...parsed.data }),
    ]);
    traceGa4SyncStage("currentReady");
    let comparison: Awaited<ReturnType<typeof fetchGa4LandingPages>> | null = null;
    let comparisonTotals: Awaited<ReturnType<typeof fetchGa4OrganicTotals>> | null = null;
    let comparisonError: string | null = null;
    try {
      [comparison, comparisonTotals] = await Promise.all([
        fetchGa4LandingPages({ propertyId, token, ...comparisonRange }),
        fetchGa4OrganicTotals({ propertyId, token, ...comparisonRange }),
      ]);
      traceGa4SyncStage("comparisonReady");
    } catch (error) {
      traceGa4SyncStage("comparisonPartial");
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
    traceGa4SyncStage("failed");
    const code = error instanceof Error ? error.message : "";
    if (code === "GOOGLE_SESSION_CONNECT_REQUIRED") return NextResponse.json({ error: "provider-auth-required", requestId }, { status: 409 });
    if (code === "GOOGLE_DATA_NOT_CONFIGURED") return NextResponse.json({ error: "provider-not-connected", requestId }, { status: 409 });
    if (code === "GOOGLE_DATA_AUTH_REQUIRED") return NextResponse.json({ error: "provider-auth-required", requestId }, { status: 401 });
    if (code === "GOOGLE_DATA_RATE_LIMITED") return NextResponse.json({ error: "provider-rate-limited", requestId }, { status: 429, headers: { "Retry-After": "60" } });
    if (code === "GOOGLE_DATA_TIMEOUT") return NextResponse.json({ error: "provider-timeout", requestId }, { status: 504 });
    if (code === "GOOGLE_DATA_INVALID_RESPONSE") return NextResponse.json({ error: "provider-invalid-response", requestId }, { status: 502 });
    if (code === "GA4_AUTH_REQUIRED") traceGa4SyncStage("failedGa4Auth");
    else if (code === "GA4_RATE_LIMITED") traceGa4SyncStage("failedGa4Rate");
    else if (code === "GA4_TIMEOUT") traceGa4SyncStage("failedGa4Timeout");
    else if (code === "GA4_INVALID_RESPONSE") traceGa4SyncStage("failedGa4Invalid");
    else if (code === "GA4_PROVIDER_UNAVAILABLE") traceGa4SyncStage("failedGa4Unavailable");
    else traceGa4SyncStage("failedUnclassified");
    traceGa4FailurePhase(error);
    const mapped = providerError(error);
    const response = NextResponse.json({ error: mapped.error, requestId }, {
      status: mapped.status,
      ...(mapped.status === 429 ? { headers: { "Retry-After": "60" } } : {}),
    });
    traceGa4SyncStage("errorResponseReady");
    return response;
  } finally {
    syncInFlight = false;
    traceGa4SyncStage("finished");
  }
}

function asyncCookieWriter(jar: Awaited<ReturnType<typeof cookies>>) {
  return (name: string, value: string, options: import("@/lib/admin/seo-intelligence/google-session-connection").GoogleCookieOptions) => {
    jar.set(name, value, options);
  };
}
