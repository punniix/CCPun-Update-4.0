import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isConfiguredAdminOrigin, isSameOriginAdminMutation } from "@/lib/admin/auth-config";
import { getAdminIdentity } from "@/lib/admin/identity";
import { hasAdminPermission } from "@/lib/admin/rbac";
import { getMediaLibraryRuntimeStatus } from "@/lib/admin/media/foundation";
import { createProcessLocalMediaUploadRateLimiter } from "@/lib/admin/media/rate-limit";
import {
  validateMediaUploadIntentHttpHeaders,
  validateMediaUploadIntentHttpRequest,
} from "@/lib/admin/media/request-validation";
import { createDirectUploadIntent } from "@/lib/admin/media/service";

const uploadIntentRateLimiter = createProcessLocalMediaUploadRateLimiter();

export async function POST(request: Request) {
  const identity = await getAdminIdentity();
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasAdminPermission(identity.role, "media:upload")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (
    !isConfiguredAdminOrigin(request.url, process.env.AUTH_URL) ||
    !isSameOriginAdminMutation(request.url, request.headers.get("origin"))
  ) {
    return NextResponse.json({ error: "forbidden-origin" }, { status: 403 });
  }
  if (!getMediaLibraryRuntimeStatus().enabled) {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }
  const requestId = randomUUID();
  const rateLimit = uploadIntentRateLimiter.reserve(identity.actor);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "rate-limited", requestId },
      { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  const headerValidation = validateMediaUploadIntentHttpHeaders({
    contentType: request.headers.get("content-type"),
    contentLength: request.headers.get("content-length"),
  });
  if (!headerValidation.ok) {
    return NextResponse.json(
      { error: headerValidation.error, requestId },
      { status: headerValidation.status, headers: { "Cache-Control": "no-store" } },
    );
  }

  const body = await request.text();
  const validation = validateMediaUploadIntentHttpRequest({
    contentType: request.headers.get("content-type"),
    contentLength: request.headers.get("content-length"),
    body,
  });
  if (!validation.ok) {
    return NextResponse.json(
      { error: validation.error, requestId },
      { status: validation.status, headers: { "Cache-Control": "no-store" } },
    );
  }

  const intent = createDirectUploadIntent(validation.data);
  return NextResponse.json(
    { error: intent.errorCategory, requestId, intent },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}
