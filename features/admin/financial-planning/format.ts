/**
 * Thai number formatting and input parsing for the financial planning room.
 * Pure functions: no locale state, no network, no logging.
 */

const BAHT = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 });
const DECIMAL_1 = new Intl.NumberFormat("th-TH", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";

/** 1234567.4 -> "1,234,567"; -5000 -> "-5,000". Non-finite -> "—". */
export function formatBaht(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const rounded = Math.round(value);
  return BAHT.format(Object.is(rounded, -0) ? 0 : rounded);
}

/** 0.125 -> "12.5%". */
export function formatPercent(ratio: number | null | undefined): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return "—";
  return `${DECIMAL_1.format(ratio * 100)}%`;
}

/** 4.25 -> "4.3 เดือน". */
export function formatMonths(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${DECIMAL_1.format(value)} เดือน`;
}

export type ParsedAmount = { ok: true; value: number | null } | { ok: false };

/**
 * Parses what ปั้น types into an amount field.
 * Accepts commas, spaces, a trailing "บาท" and Thai digits. Empty means
 * "not filled in yet" (null), which the calculations treat as missing, not 0.
 * Negative amounts are rejected: direction comes from the section, not a sign.
 */
export function parseAmountInput(raw: string): ParsedAmount {
  const normalized = Array.from(raw ?? "")
    .map((char) => {
      const digit = THAI_DIGITS.indexOf(char);
      return digit >= 0 ? String(digit) : char;
    })
    .join("")
    .replace(/บาท/g, "")
    .replace(/[\s,]/g, "");
  if (normalized === "") return { ok: true, value: null };
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return { ok: false };
  const value = Number(normalized);
  return Number.isFinite(value) ? { ok: true, value } : { ok: false };
}

/** Formats a stored amount back into an editable string with commas. */
export function amountToInput(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "";
  const [whole, fraction] = String(value).split(".");
  const grouped = BAHT.format(Number(whole));
  return fraction ? `${grouped}.${fraction}` : grouped;
}

/** Bangkok calendar date for display, from an ISO date (YYYY-MM-DD) or timestamp. */
export function formatThaiDate(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00+07:00`) : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeZone: "Asia/Bangkok" }).format(parsed);
}
