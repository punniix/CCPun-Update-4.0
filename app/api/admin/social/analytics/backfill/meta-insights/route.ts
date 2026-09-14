import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isConfiguredAdminOrigin, isSameOriginAdminMutation } from "@/lib/admin/auth-config";
import { getAdminIdentity } from "@/lib/admin/identity";
import { getSocialAnalyticsIngestionRuntimeStatus } from "@/lib/admin/social/analytics-ingestion";
import { backfillMetaInsightsBatch } from "@/lib/admin/social/providers/meta/full-backfill";

export const maxDuration = 60;

let backfillInFlight = false;

function mappedError(code: string) {
  if (code === "META_FULL_BACKFILL_NOT_CONFIGURED" || code === "META_FULL_BACKFILL_IDENTITY_MISMATCH") {
    return { error: "database-not-ready", status: 409 };
  }
  if (code === "META_FULL_BACKFILL_PAGE_SELECTION_REQUIRED") return { error: "provider-selection-required", status: 409 };
  if (code === "META_FULL_BACKFILL_AUTH_REQUIRED") return { error: "provider-auth-required", status: 401 };
  if (code === "META_FULL_BACKFILL_RATE_LIMITED") return { error: "provider-rate-limited", status: 429 };
  if (code === "META_FULL_BACKFILL_INVALID_RESPONSE") return { error: "provider-invalid-response", status: 502 };
  return { error: "provider-unavailable", status: 502 };
}

export async function POST(request: Request) {
  const identity = await getAdminIdentity();
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (identity.actorType !== "human" || identity.role !== "owner") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!isConfiguredAdminOrigin(request.url, process.env.AUTH_URL)
    || !isSameOriginAdminMutation(request.url, request.headers.get("origin"))) {
    return NextResponse.json({ error: "forbidden-origin" }, { status: 403 });
  }
  if (!getSocialAnalyticsIngestionRuntimeStatus().enabled) {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }
  if (backfillInFlight) return NextResponse.json({ error: "backfill-in-progress" }, { status: 409 });

  backfillInFlight = true;
  const requestId = randomUUID();
  try {
    const result = await backfillMetaInsightsBatch({ actor: identity.actor, requestId });
    return NextResponse.json({ requestId, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const mapped = mappedError(error instanceof Error ? error.message : "");
    return NextResponse.json({ error: mapped.error, requestId }, {
      status: mapped.status,
      headers: mapped.status === 429 ? { "Retry-After": "60" } : undefined,
    });
  } finally {
    backfillInFlight = false;
  }
}
