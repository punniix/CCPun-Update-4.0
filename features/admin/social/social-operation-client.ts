"use client";

export type SocialOperationResult = {
  state: string;
  publicationId: string;
  jobId: string;
  jobVersion: number;
  scheduledAt?: string | null;
};

type ApiError = Error & { status?: number; code?: string };

function idempotencyKey(action: string) {
  return `${action}:${crypto.randomUUID()}`;
}

async function postOperation(path: string, body: Record<string, unknown>) {
  if (!path.startsWith("/api/admin/social/") || path.startsWith("//") || path.includes("://")) {
    throw new Error("SOCIAL_OPERATION_SAME_ORIGIN_REQUIRED");
  }
  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null) as { result?: SocialOperationResult; error?: string } | null;
  if (!response.ok || !payload?.result) {
    const error = new Error(payload?.error ?? "social-operation-failed") as ApiError;
    error.status = response.status;
    error.code = payload?.error;
    throw error;
  }
  return payload.result;
}

export async function rescheduleSocialPublication(input: {
  publicationId: string;
  expectedJobVersion: number;
  scheduledAt: string;
}) {
  return postOperation("/api/admin/social/publications/reschedule/", {
    ...input,
    idempotencyKey: idempotencyKey("reschedule"),
  });
}

export async function cancelSocialPublication(input: {
  publicationId: string;
  expectedJobVersion: number;
}) {
  return postOperation("/api/admin/social/publications/cancel/", {
    ...input,
    idempotencyKey: idempotencyKey("cancel"),
  });
}

export async function executeSocialPublication(input: {
  publicationId: string;
  expectedJobVersion: number;
}) {
  if (!input.publicationId || input.expectedJobVersion < 1) throw new Error("invalid-execution-request");
  const response = await fetch("/api/admin/social/publications/execute/", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = await response.json().catch(() => null) as { result?: Record<string, unknown>; error?: string } | null;
  if (!response.ok || !payload?.result) {
    const error = new Error(payload?.error ?? "execution-failed") as ApiError;
    error.status = response.status;
    error.code = payload?.error;
    throw error;
  }
  return payload.result;
}
