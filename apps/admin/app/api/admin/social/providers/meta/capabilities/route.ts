import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isConfiguredAdminOrigin, isSameOriginAdminMutation } from "@/lib/admin/auth-config";
import { getAdminIdentity } from "@/lib/admin/identity";
import { hasAdminPermission } from "@/lib/admin/rbac";
import { getSocialOperationsRuntimeStatus } from "@/lib/admin/social/operations";
import { probeMetaInsightsCapabilities } from "@/lib/admin/social/providers/meta/capability-probe";

let probeInFlight = false;

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
  if (probeInFlight) return NextResponse.json({ error: "probe-in-progress" }, { status: 409 });

  probeInFlight = true;
  const requestId = randomUUID();
  try {
    const capability = await probeMetaInsightsCapabilities();
    return NextResponse.json({ requestId, capability }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "META_CAPABILITY_NOT_CONFIGURED") return NextResponse.json({ error: "provider-not-connected", requestId }, { status: 409 });
    if (code === "META_CAPABILITY_AUTH_REQUIRED") return NextResponse.json({ error: "provider-auth-required", requestId }, { status: 401 });
    if (code === "META_CAPABILITY_PAGE_SELECTION_REQUIRED") return NextResponse.json({ error: "page-selection-required", requestId }, { status: 409 });
    if (code === "META_CAPABILITY_TIMEOUT") return NextResponse.json({ error: "provider-timeout", requestId }, { status: 504 });
    if (code === "META_CAPABILITY_INVALID_RESPONSE") return NextResponse.json({ error: "provider-invalid-response", requestId }, { status: 502 });
    return NextResponse.json({ error: "provider-unavailable", requestId }, { status: 502 });
  } finally {
    probeInFlight = false;
  }
}
