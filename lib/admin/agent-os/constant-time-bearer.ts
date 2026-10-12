import { createHash, timingSafeEqual } from "node:crypto";

// Callers retain their own flag/token/header policy; only fixed-size comparison is shared.
export function constantTimeBearerMatches(expected: string, supplied: string) {
  const expectedDigest = createHash("sha256").update(expected).digest();
  const suppliedDigest = createHash("sha256").update(supplied).digest();
  return timingSafeEqual(expectedDigest, suppliedDigest);
}
