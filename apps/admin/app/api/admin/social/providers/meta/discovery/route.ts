import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isConfiguredAdminOrigin, isSameOriginAdminMutation } from "@/lib/admin/auth-config";
import { getAdminIdentity } from "@/lib/admin/identity";
import { hasAdminPermission } from "@/lib/admin/rbac";
import { getSocialOperationsRuntimeStatus } from "@/lib/admin/social/operations";
import { fetchMetaReadOnlyDiscovery } from "@/lib/admin/social/providers/meta/read-only";

let syncInFlight = false;

export async function POST(request: Request) {
  const identity = await getAdminIdentity();
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (identity.actorType !== "human" || !hasAdminPermission(identity.role, "social:read")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!isConfiguredAdminOrigin(request.url, process.env.AUTH_URL)
    || !isSameOriginAdminMutation(request.url, request.headers.get("origin"))) {
    return NextResponse.json({ error: "forbidden-origin" }, { status: 403 });
  }
  if (!getSocialOperationsRuntimeStatus().enabled) return NextResponse.json({ error: "not-found" }, { status: 404 });
  if (syncInFlight) return NextResponse.json({ error: "sync-in-progress" }, { status: 409 });

  syncInFlight = true;
  const requestId = randomUUID();
  try {
    const discovery = await fetchMetaReadOnlyDiscovery();
    return NextResponse.json({ requestId, discovery }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "META_READ_NOT_CONFIGURED") return NextResponse.json({ error: "provider-not-connected", requestId }, { status: 409 });
    if (code === "META_READ_AUTH_REQUIRED") return NextResponse.json({ error: "provider-auth-required", requestId }, { status: 401 });
    if (code === "META_READ_RATE_LIMITED") return NextResponse.json({ error: "provider-rate-limited", requestId }, { status: 429, headers: { "Retry-After": "60" } });
    if (code === "META_READ_TIMEOUT") return NextResponse.json({ error: "provider-timeout", requestId }, { status: 504 });
    if (code === "META_READ_INVALID_RESPONSE") return NextResponse.json({ error: "provider-invalid-response", requestId }, { status: 502 });
    return NextResponse.json({ error: "provider-unavailable", requestId }, { status: 502 });
  } finally {
    syncInFlight = false;
  }
}
