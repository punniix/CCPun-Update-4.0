import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isConfiguredAdminOrigin, isSameOriginAdminMutation } from "@/lib/admin/auth-config";
import { getAdminIdentity } from "@/lib/admin/identity";
import { hasAdminPermission } from "@/lib/admin/rbac";
import { getSocialOperationsRuntimeStatus } from "@/lib/admin/social/operations";
import { getSocialProviderReadiness } from "@/lib/admin/social/provider-readonly";
import {
  discoverInstagramPublishingUser,
  instagramAudioSearchInputSchema,
  searchInstagramAudio,
} from "@/lib/admin/social/providers/meta/publishing";

function mappedError(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  if (["META_API_NOT_CONFIGURED", "META_API_SCOPE_REQUIRED"].includes(code)) return { error: "provider-not-configured", status: 409 };
  if (["META_PAGE_SELECTION_REQUIRED", "META_INSTAGRAM_ACCOUNT_REQUIRED"].includes(code)) return { error: "provider-account-required", status: 409 };
  if (code === "META_API_AUTH_REQUIRED") return { error: "provider-auth-required", status: 401 };
  if (code === "META_API_RATE_LIMITED") return { error: "provider-rate-limited", status: 429 };
  if (code === "META_API_TIMEOUT") return { error: "provider-timeout", status: 504 };
  if (["META_API_INVALID_REQUEST", "META_API_INVALID_RESPONSE"].includes(code)) return { error: "provider-invalid-response", status: 502 };
  return { error: "provider-unavailable", status: 502 };
}

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
  const readiness = getSocialProviderReadiness("meta");
  if (!getSocialOperationsRuntimeStatus().enabled || !readiness.laneReady) {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }
  const parsed = instagramAudioSearchInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid-request" }, { status: 400 });

  const requestId = randomUUID();
  try {
    const { instagramUserId } = await discoverInstagramPublishingUser();
    const audio = await searchInstagramAudio({ instagramUserId, ...parsed.data });
    return NextResponse.json({ requestId, audio }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const mapped = mappedError(error);
    return NextResponse.json(
      { error: mapped.error, requestId },
      { status: mapped.status, ...(mapped.status === 429 ? { headers: { "Retry-After": "60" } } : {}) },
    );
  }
}
