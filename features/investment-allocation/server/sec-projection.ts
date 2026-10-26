// SEC Open API v2 constants and the public-field projection shared by the live
// adapter (sec-v2.ts, inside Next) and the private catalog sync job (catalog-sync.ts,
// a plain Node CLI). No Next.js or "server-only" import so the CLI can load it.

export const SEC_BASE_URL = "https://api.sec.or.th";
export const SEC_HEADER = "Ocp-Apim-Subscription-Key";
export const SEC_PAGE_SIZE = 100;

// Keep original row positions: catalog cursors refer to upstream offsets, including
// rows rejected by later validation. Only public fields consumed by the tool are kept.
export const SEC_PUBLIC_FIELDS = [
  "proj_id", "proj_abbr_name", "proj_name_th", "proj_name_en", "unique_id",
  "comp_name_th", "comp_name_en", "fund_status", "policy_desc", "invest_country_flag",
  "management_style", "feederfund_master_fund", "feederfund_country", "last_upd_date",
  "fund_class_name", "fund_class_detail", "fund_class_description",
  "fund_class_tax_incentive_type", "fund_class_isin_code", "spec_code", "spec_desc",
  "risk_spectrum", "risk_spectrum_desc", "start_date", "end_date", "prospectus_type",
  "asset_name", "asset_ratio", "type", "period", "redemp_period_oth", "settlement_period",
] as const;

export type SecPublicRow = Partial<Record<(typeof SEC_PUBLIC_FIELDS)[number], string | number | null>>;

/** Keeps only the public SEC fields with scalar values; anything else is dropped. */
export function projectSecRow(value: unknown): SecPublicRow | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  return Object.fromEntries(SEC_PUBLIC_FIELDS.flatMap((field) => {
    const item = row[field];
    return typeof item === "string" || typeof item === "number" || item === null ? [[field, item]] : [];
  })) as SecPublicRow;
}

export type SecPage = { items: SecPublicRow[]; nextCursor: string | null };
export type SecFetch = (url: string, init: { method: "GET"; headers: Record<string, string>; signal: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
}>;

/**
 * Minimal SEC v2 reader for the sync job: one GET, 10 s timeout, projected rows.
 * Throws `sec_http_<status>` / `sec_invalid_json` / `sec_invalid_envelope` only;
 * never the body, URL or key.
 */
export function createSecReader(key: string, fetchImpl: SecFetch, timeoutMs = 10_000) {
  return async function readSecPage(path: string): Promise<SecPage> {
    const response = await fetchImpl(`${SEC_BASE_URL}${path}`, {
      method: "GET",
      headers: { [SEC_HEADER]: key, Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new Error(`sec_http_${response.status}`);
    if (response.status === 204) return { items: [], nextCursor: null };
    const text = await response.text();
    if (!text) return { items: [], nextCursor: null };
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      throw new Error("sec_invalid_json");
    }
    if (typeof body !== "object" || body === null || Array.isArray(body)) throw new Error("sec_invalid_envelope");
    const envelope = body as { items?: unknown; next_cursor?: unknown };
    const items = Array.isArray(envelope.items) ? envelope.items.map(projectSecRow).filter((row): row is SecPublicRow => Boolean(row)) : [];
    const nextCursor = typeof envelope.next_cursor === "string" && envelope.next_cursor.trim() ? envelope.next_cursor.trim() : null;
    return { items, nextCursor };
  };
}
