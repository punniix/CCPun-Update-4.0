// Opaque catalog cursor handed to the browser. It is user-controlled input on the
// way back, so the route validates its exact shape before the SEC adapter loads,
// and the adapter never lets a client-supplied SEC cursor into a cache key.

export type CatalogCursor = {
  statusIndex: 0 | 1;
  secCursor: string;
  offset: number;
  skipProjectId: string | null;
};

export const CATALOG_CURSOR_MAX_LENGTH = 1024;
// Upstream SEC page size; a valid offset always points inside one upstream page.
export const CATALOG_CURSOR_MAX_OFFSET = 100;
// Printable ASCII only; the value is URL-encoded upstream and never used as a cache key.
const SEC_CURSOR_PATTERN = /^[\x21-\x7E]{1,512}$/;
const PROJECT_ID_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const CURSOR_KEYS = ["offset", "secCursor", "skipProjectId", "statusIndex"];

export const INITIAL_CATALOG_CURSOR: CatalogCursor = Object.freeze({ statusIndex: 0, secCursor: "", offset: 0, skipProjectId: null }) as CatalogCursor;

export function encodeCatalogCursor(cursor: CatalogCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

/** Returns the decoded cursor, or null when the value is not a cursor this server issued in shape. */
export function parseCatalogCursor(value: string): CatalogCursor | null {
  if (!value || value.length > CATALOG_CURSOR_MAX_LENGTH || !BASE64URL_PATTERN.test(value)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
  const record = parsed as Record<string, unknown>;
  if (Object.keys(record).sort().join(",") !== CURSOR_KEYS.join(",")) return null;
  const { statusIndex, secCursor, offset, skipProjectId } = record;
  if (statusIndex !== 0 && statusIndex !== 1) return null;
  if (typeof secCursor !== "string" || (secCursor !== "" && !SEC_CURSOR_PATTERN.test(secCursor))) return null;
  if (typeof offset !== "number" || !Number.isInteger(offset) || offset < 0 || offset > CATALOG_CURSOR_MAX_OFFSET) return null;
  if (skipProjectId !== null && (typeof skipProjectId !== "string" || !PROJECT_ID_PATTERN.test(skipProjectId))) return null;
  return { statusIndex, secCursor, offset, skipProjectId };
}
