// Which AMCs a tool instance may show (owner request 2026-10-26).
// - "main": /tools/investment-allocation/ — every AMC except บลจ. เอไอเอ while
//   EXCLUDE_AIA_FROM_MAIN_TOOL is true (keeps the main tool independent).
// - "aia":  /tools/aia-fund-allocation/ — บลจ. เอไอเอ funds only, no AMC picker.
// Flip EXCLUDE_AIA_FROM_MAIN_TOOL to false to show AIA funds in the main tool again;
// the AIA tool stays restricted either way.

export const EXCLUDE_AIA_FROM_MAIN_TOOL = true;

// API routes accept `scope` absent (main), "main" or "aia" and reject anything else with 400.
export type FundScope = "main" | "aia";

/**
 * True for AIA Investment Management (Thailand), matched on the names SEC publishes
 * (`comp_name_th` / `comp_name_en`), never on a hard-coded unique_id.
 * Thai: the registered name contains "เอไอเอ". English: "AIA" as a word plus
 * "Investment Management" or "Asset Management".
 */
export function isAiaAmcName(nameTh: string | null | undefined, nameEn?: string | null): boolean {
  if (typeof nameTh === "string" && nameTh.includes("เอไอเอ")) return true;
  const english = typeof nameEn === "string" ? nameEn.toUpperCase() : "";
  return /(^|[^A-Z])AIA([^A-Z]|$)/.test(english) && /(INVESTMENT|ASSET)\s+MANAGEMENT/.test(english);
}

/** Whether a fund or AMC row with these names may appear in a tool of this scope. */
export function amcAllowedInScope(scope: FundScope, nameTh: string | null | undefined, nameEn?: string | null): boolean {
  const aia = isAiaAmcName(nameTh, nameEn);
  if (scope === "aia") return aia;
  return EXCLUDE_AIA_FROM_MAIN_TOOL ? !aia : true;
}

/** Appends `scope=aia` for the AIA tool; the main tool keeps its existing request URLs. */
export function withFundScope(params: URLSearchParams, scope: FundScope): URLSearchParams {
  if (scope !== "main") params.set("scope", scope);
  return params;
}
