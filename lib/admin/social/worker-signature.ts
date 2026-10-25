import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * HMAC-SHA256 contract between Admin and the n8n social worker (both directions).
 *
 * Canonical string (UTF-8, joined with "\n"):
 *   v1, <unix seconds>, <nonce>, <HTTP METHOD>, <path without trailing slash + query>, <raw body ("" for GET)>
 * Headers: x-ccpun-timestamp, x-ccpun-nonce, x-ccpun-signature = "v1=" + hex digest (a-f, 0-9).
 * A request is accepted only inside the replay window and only once per nonce.
 */
export const WORKER_SIGNATURE_VERSION = "v1";
export const WORKER_SIGNATURE_WINDOW_SECONDS = 300;
export const WORKER_HMAC_SECRET_ENV = "CCPUN_SOCIAL_WORKER_HMAC_SECRET";
export const WORKER_WEBHOOK_URL_ENV = "CCPUN_SOCIAL_WORKER_WEBHOOK_URL";
export const WORKER_HEADERS = {
  timestamp: "x-ccpun-timestamp",
  nonce: "x-ccpun-nonce",
  signature: "x-ccpun-signature",
} as const;

const NONCE_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;
const SIGNATURE_PATTERN = /^v1=[a-f0-9]{64}$/;

export function canonicalWorkerPath(pathWithQuery: string) {
  const [path = "/", query] = pathWithQuery.split("?", 2) as [string, string | undefined];
  const trimmed = path.length > 1 ? path.replace(/\/+$/, "") : path;
  return query === undefined ? trimmed : `${trimmed}?${query}`;
}

export function workerCanonicalString(input: { timestamp: string; nonce: string; method: string; path: string; body: string }) {
  return [WORKER_SIGNATURE_VERSION, input.timestamp, input.nonce, input.method.toUpperCase(), canonicalWorkerPath(input.path), input.body].join("\n");
}

export function signWorkerRequest(input: { secret: string; method: string; path: string; body: string; now?: Date; nonce?: string }) {
  const timestamp = String(Math.floor((input.now ?? new Date()).getTime() / 1000));
  const nonce = input.nonce ?? randomBytes(16).toString("hex");
  const digest = createHmac("sha256", input.secret)
    .update(workerCanonicalString({ timestamp, nonce, method: input.method, path: input.path, body: input.body }))
    .digest("hex");
  return {
    [WORKER_HEADERS.timestamp]: timestamp,
    [WORKER_HEADERS.nonce]: nonce,
    [WORKER_HEADERS.signature]: `${WORKER_SIGNATURE_VERSION}=${digest}`,
  };
}

export type WorkerSignatureFailure = "not-configured" | "malformed" | "expired" | "bad-signature" | "replayed";
export type WorkerNonceStore = { claimNonce(nonce: string, seenAt: Date): Promise<boolean> };

export function isUsableWorkerSecret(secret: string | undefined): secret is string {
  return typeof secret === "string" && secret.trim().length >= 32;
}

/** Verifies signature and window first, then spends the nonce (so a forged request cannot burn a nonce). */
export async function verifyWorkerRequest(input: {
  secret: string | undefined;
  method: string;
  path: string;
  body: string;
  headers: { get(name: string): string | null };
  nonces: WorkerNonceStore;
  now?: Date;
}): Promise<{ ok: true } | { ok: false; reason: WorkerSignatureFailure }> {
  if (!isUsableWorkerSecret(input.secret)) return { ok: false, reason: "not-configured" };
  const timestamp = input.headers.get(WORKER_HEADERS.timestamp) ?? "";
  const nonce = input.headers.get(WORKER_HEADERS.nonce) ?? "";
  const signature = input.headers.get(WORKER_HEADERS.signature) ?? "";
  if (!/^\d{9,11}$/.test(timestamp) || !NONCE_PATTERN.test(nonce) || !SIGNATURE_PATTERN.test(signature)) return { ok: false, reason: "malformed" };
  const now = input.now ?? new Date();
  if (Math.abs(Math.floor(now.getTime() / 1000) - Number(timestamp)) > WORKER_SIGNATURE_WINDOW_SECONDS) return { ok: false, reason: "expired" };
  const expected = createHmac("sha256", input.secret)
    .update(workerCanonicalString({ timestamp, nonce, method: input.method, path: input.path, body: input.body }))
    .digest();
  const supplied = Buffer.from(signature.slice(3), "hex");
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return { ok: false, reason: "bad-signature" };
  if (!(await input.nonces.claimNonce(nonce, now))) return { ok: false, reason: "replayed" };
  return { ok: true };
}

export function createMemoryNonceStore(): WorkerNonceStore & { size(): number } {
  const seen = new Map<string, number>();
  return {
    async claimNonce(nonce, seenAt) {
      const cutoff = seenAt.getTime() - 2 * WORKER_SIGNATURE_WINDOW_SECONDS * 1000;
      for (const [key, at] of seen) if (at < cutoff) seen.delete(key);
      if (seen.has(nonce)) return false;
      seen.set(nonce, seenAt.getTime());
      return true;
    },
    size: () => seen.size,
  };
}
