import "server-only";

import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { isConfiguredAdminOrigin, isSameOriginAdminMutation } from "../auth-config";
import { getAdminIdentity } from "../identity";
import { authorizeEmailDigestActor, EmailDigestError } from "./email-digest-model";

export const NO_STORE = { "Cache-Control": "private, no-store" } as const;

/** 401 unauthenticated, 403 not a human owner (mutations) / no social:read, 403 wrong origin. */
export async function requireEmailDigestActor(request: Request, intent: "read" | "mutate") {
  const identity = await getAdminIdentity();
  const decision = authorizeEmailDigestActor(identity, intent);
  if (!decision.allowed) return { response: NextResponse.json({ error: decision.error }, { status: decision.status, headers: NO_STORE }) };
  if (!isConfiguredAdminOrigin(request.url, process.env.AUTH_URL)
    || (intent === "mutate" && !isSameOriginAdminMutation(request.url, request.headers.get("origin")))) {
    return { response: NextResponse.json({ error: "forbidden-origin" }, { status: 403, headers: NO_STORE }) };
  }
  return { identity: identity! };
}

const STATUS: Record<string, [string, number]> = {
  EMAIL_DIGEST_NOT_FOUND: ["digest-not-found", 404],
  WORKER_JOB_NOT_FOUND: ["job-not-found", 404],
  EMAIL_DIGEST_VERSION_CONFLICT: ["version-conflict", 409],
  WORKER_JOB_VERSION_CONFLICT: ["version-conflict", 409],
  EMAIL_DIGEST_IDEMPOTENCY_CONFLICT: ["idempotency-conflict", 409],
  EMAIL_DIGEST_INVALID_TRANSITION: ["invalid-transition", 409],
  EMAIL_DIGEST_INCOMPLETE: ["digest-incomplete", 409],
  EMAIL_DIGEST_MONTH_TAKEN: ["month-taken", 409],
  EMAIL_DIGEST_JOB_EXISTS: ["job-exists", 409],
  EMAIL_DIGEST_SCHEDULE_TIME_INVALID: ["schedule-time-invalid", 409],
  WORKER_JOB_IN_FLIGHT: ["job-in-flight", 409],
  WORKER_JOB_NOT_RETRYABLE: ["job-not-retryable", 409],
  WORKER_JOB_AMBIGUOUS_ACK_REQUIRED: ["ambiguous-ack-required", 409],
  EMAIL_DIGEST_CONFIRMATION_REQUIRED: ["confirmation-required", 428],
  EMAIL_DIGEST_SEND_DISABLED: ["send-disabled", 403],
  SOCIAL_EMAIL_DIGEST_MIGRATION_PENDING: ["migration-pending", 503],
  SOCIAL_EMAIL_DIGEST_STORE_UNAVAILABLE: ["store-unavailable", 503],
  SOCIAL_EMAIL_DIGEST_OUTCOME_UNKNOWN: ["outcome-unknown", 503],
};

export function emailDigestErrorResponse(error: unknown) {
  if (error instanceof ZodError) return NextResponse.json({ error: "invalid-request" }, { status: 400, headers: NO_STORE });
  const code = error instanceof EmailDigestError ? error.code : error instanceof Error ? error.message : "";
  const [message, status] = STATUS[code] ?? ["email-digest-failed", 500];
  return NextResponse.json({ error: message }, { status, headers: NO_STORE });
}

export async function readJson(request: Request) {
  return request.json().catch(() => null) as Promise<unknown>;
}
