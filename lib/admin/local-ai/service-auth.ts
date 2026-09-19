import { createHash, timingSafeEqual } from "node:crypto";

export function isN8nLocalAiRequestAuthorized(
  request: Request,
  variables: Record<string, string | undefined> = process.env,
) {
  if (variables.CCPUN_LOCAL_AI_N8N_ENABLED?.trim() !== "true") return false;
  const expected = variables.CCPUN_LOCAL_AI_N8N_TOKEN?.trim();
  const authorization = request.headers.get("authorization")?.trim();
  if (!expected || expected.length < 43 || !authorization?.startsWith("Bearer ")) return false;
  const supplied = authorization.slice(7).trim();
  const expectedDigest = createHash("sha256").update(expected).digest();
  const suppliedDigest = createHash("sha256").update(supplied).digest();
  return timingSafeEqual(expectedDigest, suppliedDigest);
}
