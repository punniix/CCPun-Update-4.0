import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";

// An expiring, job-scoped UAT capability, not a reusable service token.
const validId = z.string().uuid();
const label = "ccpun:p1:uat:seo-callback:v1";
const shape = /^v1\.(\d{10})\.([0-9a-f]{32})\.([0-9a-f]{64})$/;
export const CALLBACK_TTL_SECONDS = 600;

function contextOk(input: { jobId: string; correlationId: string; secret: string }) {
  return validId.safeParse(input.jobId).success && validId.safeParse(input.correlationId).success
    && typeof input.secret === "string" && input.secret.length >= 43;
}
function digest(secret: string, jobId: string, correlationId: string, expiry: number, nonce: string) {
  return createHmac("sha256", secret).update([label, jobId, correlationId, expiry, nonce].join(":")).digest("hex");
}
export function issueScopedUatCapability(input: { jobId: string; correlationId: string; secret: string; nowMs?: number; nonce?: string }) {
  if (!contextOk(input)) return null;
  const now = input.nowMs ?? Date.now();
  if (!Number.isSafeInteger(now) || now < 0) return null;
  const nonce = input.nonce ?? randomBytes(16).toString("hex");
  if (!/^[a-f0-9]{32}$/.test(nonce)) return null;
  const expiry = Math.floor(now / 1000) + CALLBACK_TTL_SECONDS;
  return `v1.${expiry}.${nonce}.${digest(input.secret, input.jobId, input.correlationId, expiry, nonce)}`;
}
export function verifyScopedUatCapability(input: { authorization: string | null; jobId: string; correlationId: string; secret: string; nowMs?: number }) {
  if (!contextOk(input) || !input.authorization?.startsWith("Bearer ")) return false;
  const m = shape.exec(input.authorization.slice(7));
  if (!m) return false;
  const now = input.nowMs ?? Date.now();
  if (!Number.isSafeInteger(now) || now < 0) return false;
  const expiry = Number(m[1]);
  const seconds = Math.floor(now / 1000);
  if (!Number.isSafeInteger(expiry) || expiry < seconds || expiry > seconds + CALLBACK_TTL_SECONDS) return false;
  const expected = Buffer.from(digest(input.secret, input.jobId, input.correlationId, expiry, m[2]), "hex");
  const got = Buffer.from(m[3], "hex");
  return expected.length === got.length && timingSafeEqual(expected, got);
}
