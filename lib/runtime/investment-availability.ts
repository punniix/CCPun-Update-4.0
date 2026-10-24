import "server-only";
import { resolveContentEnvironment } from "../content/sanity-lane";

// Owner-approved release contract (2026-10-24, ships with the v5 redesign):
// - explicit Web UAT lanes are ON by default (CCPUN_APP_ENV=web-uat|local-uat);
// - every other lane, Production included, is OFF unless the exact flag "1" is set;
// - the exact flag "0" is a kill switch on every lane, UAT included.
// The lane is never inferred from host names, review flags or a missing CCPUN_APP_ENV.
const DEFAULT_ON_LANES = new Set(["web-uat", "local-uat"]);

export function isInvestmentAllocationEnabled(
  variables: Record<string, string | undefined> = process.env,
): boolean {
  const flag = variables.CCPUN_INVESTMENT_ALLOCATION_ENABLED;
  if (flag === "1") return true;
  if (flag === "0") return false;
  const environment = resolveContentEnvironment(
    variables.CCPUN_APP_ENV,
    variables.VERCEL_ENV,
    variables.VERCEL_PROJECT_ID,
  );
  return DEFAULT_ON_LANES.has(environment);
}

export const INVESTMENT_ALLOCATION_ENABLED = isInvestmentAllocationEnabled();
