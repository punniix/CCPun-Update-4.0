import "server-only";

// Email phase 1 (owner-approved 2026-10-25): "send my result by email" is OFF on every lane,
// Production and UAT included, unless the exact flag "1" is set. Anything else (missing, "0",
// "true") keeps it off. With the flag off nothing renders and every /api/result-email/ route 404s.
export function isResultEmailEnabled(variables: Record<string, string | undefined> = process.env): boolean {
  return variables.CCPUN_RESULT_EMAIL_ENABLED === "1";
}

export const RESULT_EMAIL_ENABLED = isResultEmailEnabled();
