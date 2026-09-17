import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isConfiguredAdminOrigin, isSameOriginAdminMutation } from "@/lib/admin/auth-config";
import { getAdminIdentity } from "@/lib/admin/identity";
import {
  executeSocialPublication,
  isSocialProviderExecutionEnabled,
  socialPublicationExecuteRequestSchema,
} from "@/lib/admin/social/execution-store";

function mappedError(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  if (code === "SOCIAL_EXECUTION_NOT_FOUND") return { error: "publication-not-found", status: 404 };
  if (code === "SOCIAL_EXECUTION_CAS_CONFLICT") return { error: "job-version-conflict", status: 409 };
  if (code === "SOCIAL_EXECUTION_RETRY_EXHAUSTED") return { error: "retry-exhausted", status: 409 };
  if (code === "SOCIAL_EXECUTION_ACTIVE_LEASE") return { error: "execution-in-progress", status: 409 };
  if (code === "META_API_RATE_LIMITED") return { error: "provider-rate-limited", status: 429 };
  if (code === "META_API_TIMEOUT") return { error: "provider-timeout", status: 504 };
  if (code === "META_API_AUTH_REQUIRED" || code === "META_API_SCOPE_REQUIRED") return { error: "provider-auth-required", status: 409 };
  if (code === "SOCIAL_EXECUTION_RECONCILIATION_REQUIRED") return { error: "manual-reconciliation-required", status: 503 };
  if ([
    "SOCIAL_EXECUTION_MOBILE_HANDOFF_ONLY", "SOCIAL_EXECUTION_TRUSTED_MEDIA_REQUIRED",
    "SOCIAL_EXECUTION_UNSUPPORTED_FORMAT", "SOCIAL_EXECUTION_TERMINAL_JOB",
    "SOCIAL_EXECUTION_PUBLICATION_CONFLICT", "SOCIAL_EXECUTION_EDITORIAL_CONFLICT",
    "SOCIAL_EXECUTION_EDITORIAL_UNSUPPORTED", "SOCIAL_EXECUTION_AUTHORIZATION_DENIED",
    "SOCIAL_EXECUTION_INVALID_PROVIDER_REQUEST",
  ].includes(code)) return { error: "execution-not-allowed", status: 409 };
  return { error: "execution-failed", status: 502 };
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
  if (!isSocialProviderExecutionEnabled()) return NextResponse.json({ error: "not-found" }, { status: 404 });
  const parsed = socialPublicationExecuteRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid-request" }, { status: 400 });

  const requestId = randomUUID();
  try {
    const result = await executeSocialPublication({ request: parsed.data, actor: identity.actor, requestId });
    return NextResponse.json({ requestId, result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const mapped = mappedError(error);
    return NextResponse.json(
      { error: mapped.error, requestId },
      { status: mapped.status, ...(mapped.status === 429 ? { headers: { "Retry-After": "60" } } : {}) },
    );
  }
}
