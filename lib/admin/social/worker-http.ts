import "server-only";

import { NextResponse } from "next/server";
import { isEmailDigestSendEnabled } from "./email-digest-model";
import { createNeonEmailDigestStore } from "./email-digest-neon-store";
import type { EmailDigestStore } from "./email-digest-service";
import { verifyWorkerRequest, WORKER_HMAC_SECRET_ENV } from "./worker-signature";

export const WORKER_NO_STORE = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow, noarchive" } as const;

/**
 * n8n -> Admin authentication. Behind the send flag the routes do not exist (404).
 * Signature, window and one-time nonce are checked before any job data is read.
 */
export async function authenticateWorkerRequest(request: Request, body: string): Promise<{ store: EmailDigestStore } | { response: NextResponse }> {
  if (!isEmailDigestSendEnabled() || !process.env[WORKER_HMAC_SECRET_ENV]) {
    return { response: NextResponse.json({ error: "not-found" }, { status: 404, headers: WORKER_NO_STORE }) };
  }
  let store: EmailDigestStore;
  try {
    store = await createNeonEmailDigestStore();
  } catch {
    return { response: NextResponse.json({ error: "worker-store-unavailable" }, { status: 503, headers: WORKER_NO_STORE }) };
  }
  const url = new URL(request.url);
  const verdict = await verifyWorkerRequest({
    secret: process.env[WORKER_HMAC_SECRET_ENV],
    method: request.method,
    path: `${url.pathname}${url.search}`,
    body,
    headers: request.headers,
    nonces: store,
  });
  if (!verdict.ok) {
    return { response: NextResponse.json({ error: verdict.reason === "not-configured" ? "not-found" : "unauthorized" }, { status: verdict.reason === "not-configured" ? 404 : 401, headers: WORKER_NO_STORE }) };
  }
  return { store };
}
