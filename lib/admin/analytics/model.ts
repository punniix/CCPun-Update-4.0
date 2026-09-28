import { createHash } from "node:crypto";
import { z } from "zod";

export const analyticsSourceSchema = z.enum(["gsc", "ga4", "meta", "ubersuggest"]);
export const analyticsReportSchema = z.enum(["gsc-summary", "gsc-query-page", "ga4-summary", "ga4-organic-landing", "ga4-session-performance", "ga4-marketing-events", "social-performance", "seo-intelligence", "ubersuggest-web-keywords", "gsc-daily-page", "gsc-daily-query-page", "ga4-daily-organic", "ga4-content-events"]);
export type AnalyticsSource = z.infer<typeof analyticsSourceSchema>;
export type AnalyticsReport = z.infer<typeof analyticsReportSchema>;
const cell = z.union([z.string(), z.number().finite(), z.boolean(), z.null()]);
export const analyticsDatasetSchema = z.object({
  report: analyticsReportSchema, source: analyticsSourceSchema, title: z.string(), resourceScope: z.string().max(500).nullable().optional(),
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


export const ga4MarketingReports = ["ga4-session-performance", "ga4-marketing-events"] as const;
export type Ga4MarketingReport = typeof ga4MarketingReports[number];
const ga4MarketingFields = {
  "ga4-session-performance": { dimensions: ["date", "sessionSourceMedium", "sessionCampaignName", "landingPage"], metrics: ["sessions", "engagedSessions", "keyEvents", "sessionKeyEventRate"], columns: ["วันที่", "แหล่งทราฟฟิก / Medium", "แคมเปญ", "หน้าเข้า", "เซสชัน", "Engaged sessions", "Key events", "Session key event rate (%)"] },
  "ga4-marketing-events": { dimensions: ["date", "eventName"], metrics: ["eventCount"], columns: ["วันที่", "Event", "จำนวน event"] },
} as const;
const ga4MarketingResponseSchema = z.object({
  dimensionHeaders: z.array(z.object({ name: z.string() })), metricHeaders: z.array(z.object({ name: z.string() })),
  rows: z.array(z.object({ dimensionValues: z.array(z.object({ value: z.string() })), metricValues: z.array(z.object({ value: z.string() })) })).max(10_000).default([]),
  rowCount: z.number().int().nonnegative().default(0),
  metadata: z.object({ timeZone: z.string().optional(), subjectToThresholding: z.boolean().optional(), dataLossFromOtherRow: z.boolean().optional(), samplingMetadatas: z.array(z.unknown()).optional() }).optional(),
});
export function ga4MarketingRequest(report: Ga4MarketingReport, startDate: string, endDate: string) {
  const fields = ga4MarketingFields[report];
  return { dateRanges: [{ startDate, endDate }], dimensions: fields.dimensions.map((name) => ({ name })), metrics: fields.metrics.map((name) => ({ name })),
    ...(report === "ga4-marketing-events" ? { dimensionFilter: { filter: { fieldName: "eventName", stringFilter: { matchType: "FULL_REGEXP", value: "^(ci_.*|fhc_.*|line_oa_click)$", caseSensitive: true } } } } : {}),
    orderBys: fields.dimensions.map((dimensionName) => ({ dimension: { dimensionName } })), limit: "10000", offset: "0", returnPropertyQuota: true };
}
export function normalizeGa4Marketing(report: Ga4MarketingReport, raw: unknown, startDate: string, endDate: string) {
  const data = ga4MarketingResponseSchema.parse(raw), fields = ga4MarketingFields[report];
  if (data.dimensionHeaders.map((item) => item.name).join() !== fields.dimensions.join() || data.metricHeaders.map((item) => item.name).join() !== fields.metrics.join() || data.rowCount < data.rows.length) throw new Error("GA4_INVALID_RESPONSE");
  const rows = data.rows.map((row) => {
    if (row.dimensionValues.length !== fields.dimensions.length || row.metricValues.length !== fields.metrics.length) throw new Error("GA4_INVALID_RESPONSE");
    const dimensions = row.dimensionValues.map((item) => item.value), nativeDate = dimensions[0]!;
    if (!/^\d{8}$/.test(nativeDate)) throw new Error("GA4_INVALID_RESPONSE");
    const date = `${nativeDate.slice(0, 4)}-${nativeDate.slice(4, 6)}-${nativeDate.slice(6, 8)}`;
    if (!z.string().date().safeParse(date).success || date < startDate || date > endDate) throw new Error("GA4_INVALID_RESPONSE");
    const values = row.metricValues.map((item, index) => {
      const metric = fields.metrics[index], value = Number(item.value);
      if (!/^\d+(?:\.\d+)?$/.test(item.value) || !Number.isFinite(value) || value < 0 || ((metric !== "keyEvents" && metric !== "sessionKeyEventRate") && !Number.isSafeInteger(value)) || (metric === "sessionKeyEventRate" && value > 1)) throw new Error("GA4_INVALID_RESPONSE");
      return metric === "sessionKeyEventRate" ? value * 100 : value;
    });
    if (report === "ga4-session-performance" && (values[1]! > values[0]! || /[?#]/.test(dimensions[3]!))) throw new Error("GA4_INVALID_RESPONSE");
    if (report === "ga4-marketing-events" && !/^(ci_.*|fhc_.*|line_oa_click)$/.test(dimensions[1]!)) throw new Error("GA4_INVALID_RESPONSE");
    return Object.fromEntries(fields.columns.map((column, index) => [column, index === 0 ? date : index < dimensions.length ? dimensions[index]! : values[index - dimensions.length]!]));
  });
  const truncated = data.rowCount > data.rows.length;
  return { title: report === "ga4-session-performance" ? "GA4 · ช่องทาง แคมเปญ และหน้าเข้า" : "GA4 · Events ของ CI / FHC / LINE", columns: [...fields.columns], rows, nativeTimeZone: data.metadata?.timeZone ?? null, truncated,
    overview: [{ label: "แถวที่ GA4 รายงาน", value: data.rowCount }, { label: "แถวที่เก็บ", value: rows.length }, { label: "Grain", value: report === "ga4-session-performance" ? "วัน × source/medium × campaign × landing page" : "วัน × event name" }],
    limitations: [...(truncated ? ["เก็บหน้าแรกสูงสุด 10,000 แถว; ข้อมูลไม่ครบตาม rowCount ของ GA4"] : []), ...(data.metadata?.subjectToThresholding ? ["GA4 applied data thresholding"] : []), ...(data.metadata?.dataLossFromOtherRow ? ["GA4 grouped rows into (other)"] : []), ...(data.metadata?.samplingMetadatas?.length ? ["GA4 sampled this report"] : []),
      ...(rows.some((row) => Object.values(row).includes("(not set)")) ? ["คง (not set) ตามที่ GA4 ส่งคืน; ไม่อนุมาน attribution"] : []),
      report === "ga4-session-performance" ? "Key events เป็นจำนวน native และอาจมีทศนิยม; Session key event rate (%) มาจาก GA4 โดยตรง ไม่ใช่ key events / sessions; ห้ามเฉลี่ย rate ข้ามแถว" : "จำนวน event เฉพาะ ci_*, fhc_* และ line_oa_click; event ไม่ใช่ lead ที่ยืนยันแล้ว", "ข้อมูลถึงวันก่อนหน้า; sourceAsOf เป็นวันสุดท้ายของช่วง ไม่ใช่เวลาอัปเดต provider"] };
}
export type Ga4MarketingOutcome = { report: Ga4MarketingReport; data: ReturnType<typeof normalizeGa4Marketing> | null; error: "provider-unavailable-or-incompatible" | "invalid-response" | "time-budget" | null };
// These two reports are optional: incompatible property fields must not discard baseline data.
export async function fetchOptionalGa4Marketing(input: { propertyId: string; token: string; startDate: string; endDate: string }, fetchForReport: (report: Ga4MarketingReport) => typeof fetch, deadline: number): Promise<Ga4MarketingOutcome[]> {
  if (deadline - Date.now() <= 20_000) return ga4MarketingReports.map((report) => ({ report, data: null, error: "time-budget" }));
  return Promise.all(ga4MarketingReports.map(async (report): Promise<Ga4MarketingOutcome> => {
    try {
      const response = await fetchForReport(report)(`https://analyticsdata.googleapis.com/v1beta/properties/${input.propertyId}:runReport`, { method: "POST", headers: { Authorization: `Bearer ${input.token}`, "Content-Type": "application/json" }, body: JSON.stringify(ga4MarketingRequest(report, input.startDate, input.endDate)), signal: AbortSignal.timeout(15_000), cache: "no-store" });
      if (!response.ok) return { report, data: null, error: "provider-unavailable-or-incompatible" };
      try {
        const data = normalizeGa4Marketing(report, await response.json(), input.startDate, input.endDate);
        return deadline - Date.now() <= 5_000 ? { report, data: null, error: "time-budget" } : { report, data, error: null };
      }
      catch { return { report, data: null, error: "invalid-response" }; }
    } catch { return { report, data: null, error: "provider-unavailable-or-incompatible" }; }
  }));
}
