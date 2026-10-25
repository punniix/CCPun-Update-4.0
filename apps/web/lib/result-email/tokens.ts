import "server-only";

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const DOI_TOKEN = /^[A-Za-z0-9_-]{43}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SIGNATURE = /^[A-Za-z0-9_-]{43}$/;

/** Double opt-in token: 32 random bytes, sent once in the email; only its SHA-256 is stored. */
export function createDoiToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashDoiToken(token)! };
}

export function hashDoiToken(token: unknown): string | null {
  if (typeof token !== "string" || !DOI_TOKEN.test(token)) return null;
  return createHash("sha256").update(`ccpun-email-doi-v1\0${token}`).digest("hex");
}

/**
 * Unsubscribe token: `<subscriber uuid>.<HMAC>`. Stateless, so a later monthly sender (n8n) holding
 * the same secret can build links without the database ever storing a usable token.
 */
export function createUnsubscribeToken(subscriberId: string, secret: string): string {
  return `${subscriberId}.${createHmac("sha256", secret).update(`ccpun-email-unsubscribe-v1\0${subscriberId}`).digest("base64url")}`;
}

export function verifyUnsubscribeToken(token: unknown, secret: string): string | null {
  if (typeof token !== "string" || token.length > 120) return null;
  const [id, signature, extra] = token.split(".");
  if (extra !== undefined || !id || !signature || !UUID.test(id) || !SIGNATURE.test(signature)) return null;
  const expected = Buffer.from(createUnsubscribeToken(id, secret).split(".")[1]);
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual) ? id : null;
}
