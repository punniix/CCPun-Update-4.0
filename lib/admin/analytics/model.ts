import { createHash } from "node:crypto";
import { z } from "zod";

export const analyticsSourceSchema = z.enum(["gsc", "ga4", "meta", "ubersuggest"]);
export const analyticsReportSchema = z.enum(["gsc-summary", "gsc-query-page", "ga4-summary", "ga4-organic-landing", "social-performance", "seo-intelligence", "ubersuggest-web-keywords"]);
export type AnalyticsSource = z.infer<typeof analyticsSourceSchema>;
export type AnalyticsReport = z.infer<typeof analyticsReportSchema>;
const cell = z.union([z.string(), z.number().finite(), z.boolean(), z.null()]);
export const analyticsDatasetSchema = z.object({
  report: analyticsReportSchema, source: analyticsSourceSchema, title: z.string(),
  batchId: z.string().uuid(), collectedAt: z.string().datetime(), sourceAsOf: z.string().nullable(),
  windowStart: z.string().nullable(), windowEnd: z.string().nullable(), nativeTimeZone: z.string().nullable(),
  columns: z.array(z.string()).max(100), rows: z.array(z.record(z.string(), cell)).max(50_000),
  overview: z.array(z.object({ label: z.string(), value: z.union([z.string(), z.number().finite()]) })),
  limitations: z.array(z.string()), truncated: z.boolean(), rawHash: z.string().regex(/^[0-9a-f]{64}$/),
  lastAttemptAt: z.string().nullable(), lastAttemptStatus: z.string().nullable(),
});
export type AnalyticsDataset = z.infer<typeof analyticsDatasetSchema>;
export type RawAnalyticsPage = { report: AnalyticsReport; page: number; collectedAt: string; body: unknown; canonicalJson: string; hash: string; requestMeta?: { path: string; parameters: unknown }; origin: "provider-response" | "existing-private-store" | "owner-web-csv" };
export function isAnalyticsCredentialKey(key: string) { return /token|secret|authorization|password|cookie|signature|credential|apikey|privatekey|accesskey/i.test(key.replace(/[^a-z0-9]/gi, "")); }

// ponytail: preserve response data, never OAuth responses, request headers, or signed URLs.
export function sanitizeAnalyticsRaw(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeAnalyticsRaw);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => !isAnalyticsCredentialKey(key)).map(([key, child]) => [key, sanitizeAnalyticsRaw(child)]));
  if (typeof value === "string" && /^https?:\/\//i.test(value)) {
    try { const url = new URL(value); url.username = ""; url.password = ""; for (const key of [...url.searchParams.keys()]) if (isAnalyticsCredentialKey(key) || /^(key|auth)$/i.test(key)) url.searchParams.delete(key); return url.toString(); } catch { return value; }
  }
  return value;
}
export function analyticsHash(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
export function analyticsDate(daysAgo = 0, now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(now.getTime() - daysAgo * 86_400_000));
}
export function shiftAnalyticsDate(date: string, days: number) { return new Date(Date.parse(date + "T00:00:00Z") + days * 86_400_000).toISOString().slice(0, 10); }
