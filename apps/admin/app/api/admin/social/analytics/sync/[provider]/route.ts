import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isConfiguredAdminOrigin, isSameOriginAdminMutation } from "@/lib/admin/auth-config";
import { getAdminIdentity } from "@/lib/admin/identity";
import { hasAdminPermission } from "@/lib/admin/rbac";
import {
  getSocialAnalyticsIngestionRuntimeStatus,
  recordSocialAnalyticsFailure,
  socialAnalyticsProviderSchema,
  syncSocialHistoricalAnalytics,
} from "@/lib/admin/social/analytics-ingestion";

const inFlight = new Set<string>();

function providerError(provider: string, code: string) {
  const prefix = provider.toUpperCase();
  if (code === "META_PAGE_SELECTION_REQUIRED") return { error: "provider-selection-required", status: 409, category: "authorization" as const };
  if (code === `${prefix}_READ_NOT_CONFIGURED`) return { error: "provider-not-connected", status: 409, category: "authentication" as const };
  if (code === `${prefix}_READ_AUTH_REQUIRED`) return { error: "provider-auth-required", status: 401, category: "authentication" as const };
  if (code === `${prefix}_READ_RATE_LIMITED`) return { error: "provider-rate-limited", status: 429, category: "rate-limit" as const };
  if (code === `${prefix}_READ_TIMEOUT`) return { error: "provider-timeout", status: 504, category: "timeout" as const };
  if (code === `${prefix}_READ_INVALID_RESPONSE`) return { error: "provider-invalid-response", status: 502, category: "invalid-response" as const };
  if (code.startsWith(`${prefix}_READ_`)) return { error: "provider-unavailable", status: 502, category: "provider-unavailable" as const };
  return null;
}

function safeErrorField(error: unknown, field: "name" | "code") {
  const record = typeof error === "object" && error !== null ? error as Record<string, unknown> : null;
  return record && typeof record[field] === "string" ? record[field] : undefined;
}

function databaseError(error: unknown) {
  const source = typeof error === "object" && error !== null && "sourceError" in error ? error.sourceError : undefined;
  const code = safeErrorField(error, "code") ?? safeErrorField(source, "code") ?? "";
  const httpStatus = error instanceof Error ? /^Server error \(HTTP status (\d{3})\):/.exec(error.message)?.[1] : undefined;
  console.error("[social-analytics-db]", {
    name: safeErrorField(error, "name"),
    code: code || undefined,
    sourceName: safeErrorField(source, "name"),
    httpStatus,
  });
  if (code === "28P01") return { error: "database-auth-required", status: 409 };
  if (code === "42501") return { error: "database-forbidden", status: 409 };
  if (["3D000", "3F000", "42P01"].includes(code)) return { error: "database-not-ready", status: 409 };
  return { error: "database-unavailable", status: 503 };
}

export async function POST(request: Request, context: { params: Promise<{ provider: string }> }) {
  const parsed = socialAnalyticsProviderSchema.safeParse((await context.params).provider);
  if (!parsed.success) return NextResponse.json({ error: "not-found" }, { status: 404 });
  const provider = parsed.data;
  const identity = await getAdminIdentity();
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (identity.actorType !== "human" || !hasAdminPermission(identity.role, "social:read")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!isConfiguredAdminOrigin(request.url, process.env.AUTH_URL)
    || !isSameOriginAdminMutation(request.url, request.headers.get("origin"))) return NextResponse.json({ error: "forbidden-origin" }, { status: 403 });
  if (!getSocialAnalyticsIngestionRuntimeStatus().enabled) return NextResponse.json({ error: "not-found" }, { status: 404 });
  if (inFlight.has(provider)) return NextResponse.json({ error: "sync-in-progress" }, { status: 409 });

  inFlight.add(provider);
  const requestId = randomUUID();
  try {
    // ponytail: one manual sync per provider instance; add durable locks only if background sync is approved.
    const result = await syncSocialHistoricalAnalytics({ provider, actor: identity.actor, requestId });
    return NextResponse.json({ requestId, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const mapped = providerError(provider, code);
    if (mapped) {
      await recordSocialAnalyticsFailure({ provider, actor: identity.actor, requestId, category: mapped.category }).catch(() => undefined);
      return NextResponse.json({ error: mapped.error, requestId }, { status: mapped.status, headers: mapped.status === 429 ? { "Retry-After": "60" } : undefined });
    }
    if (code === "SOCIAL_ANALYTICS_NOT_CONFIGURED" || code === "SOCIAL_ANALYTICS_IDENTITY_MISMATCH") return NextResponse.json({ error: "database-not-ready", requestId }, { status: 409 });
    const database = databaseError(error);
    return NextResponse.json({ error: database.error, requestId }, { status: database.status });
  } finally {
    inFlight.delete(provider);
  }
}
