import { z } from "zod";

const isoDate = z.iso.date();
const externalHttpUrl = z.string().url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "https:" || protocol === "http:";
}, "Only HTTP(S) market URLs are accepted");

export const gscDimensionSchema = z.enum(["query", "page", "device", "country", "searchAppearance", "date"]);

export const gscQueryInputSchema = z.object({
  siteUrl: z.string().trim().min(1).max(500),
  token: z.string().trim().min(1),
  startDate: isoDate,
  endDate: isoDate,
  dimensions: z.array(gscDimensionSchema).min(1).max(5),
  rowLimit: z.number().int().min(1).max(25_000).default(25_000),
}).superRefine((input, context) => {
  if (input.startDate > input.endDate) context.addIssue({ code: z.ZodIssueCode.custom, path: ["startDate"], message: "Start date must not follow end date" });
  if (new Set(input.dimensions).size !== input.dimensions.length) context.addIssue({ code: z.ZodIssueCode.custom, path: ["dimensions"], message: "Dimensions must be unique" });
});

export const gscSearchAnalyticsPageSchema = z.object({
  rows: z.array(z.object({
    keys: z.array(z.string()),
    clicks: z.number().nonnegative(),
    impressions: z.number().nonnegative(),
    ctr: z.number().min(0).max(1),
    position: z.number().nonnegative(),
  })).default([]),
}).passthrough();

export type GscDimension = z.infer<typeof gscDimensionSchema>;
export type GscNormalizedRow = {
  dimensions: Partial<Record<GscDimension, string>>;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type GscMetricTotals = {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number | null;
};

export type GscDashboardRow = {
  dimensions: { query: string; page: string };
  current: GscMetricTotals & { position: number };
  previous: (GscMetricTotals & { position: number }) | null;
};

export const ga4QueryInputSchema = z.object({
  propertyId: z.string().trim().regex(/^\d+$/).max(30),
  token: z.string().trim().min(1),
  startDate: isoDate,
  endDate: isoDate,
  rowLimit: z.number().int().min(1).max(10_000).default(10_000),
}).refine((input) => input.startDate <= input.endDate, { path: ["startDate"], message: "Start date must not follow end date" });

const ga4LandingPageReportSchema = z.object({
  dimensionHeaders: z.array(z.object({ name: z.string() })),
  metricHeaders: z.array(z.object({ name: z.string() }).passthrough()),
  rows: z.array(z.object({
    dimensionValues: z.array(z.object({ value: z.string() })),
    metricValues: z.array(z.object({ value: z.string() })),
  })).default([]),
  rowCount: z.number().int().nonnegative().default(0),
  metadata: z.object({
    samplingMetadatas: z.array(z.unknown()).optional(),
    dataLossFromOtherRow: z.boolean().optional(),
    subjectToThresholding: z.boolean().optional(),
    timeZone: z.string().optional(),
  }).passthrough().optional(),
}).passthrough();

export type Ga4LandingPageRow = {
  landingPage: string;
  sessions: number;
  engagedSessions: number;
  engagementRate: number;
};

export type Ga4MetricTotals = {
  sessions: number;
  engagedSessions: number;
  engagementRate: number;
};

export type Ga4DashboardRow = {
  landingPage: string;
  current: Ga4MetricTotals;
  previous: Ga4MetricTotals | null;
};

export const marketProviderStateSchema = z.enum(["ready", "unavailable", "stale", "missing"]);

export const marketProviderSnapshotSchema = z.object({
  provider: z.string().trim().min(1).max(60),
  state: marketProviderStateSchema,
  fetchedAt: z.string().datetime().nullable(),
  evidenceTrust: z.literal("untrusted-external-data"),
  evidence: z.object({
    keyword: z.string().trim().min(1).max(300),
    scope: z.string().trim().min(1).max(120).nullable(),
    location: z.string().trim().min(1).max(120).nullable(),
    language: z.string().trim().min(1).max(80).nullable(),
    volume: z.number().nonnegative().nullable(),
    difficulty: z.number().min(0).max(100).nullable(),
    intent: z.enum(["informational", "commercial", "transactional", "navigational", "mixed"]).nullable(),
    serp: z.array(z.object({
      position: z.number().int().positive().nullable(),
      title: z.string().trim().max(500).nullable(),
      url: externalHttpUrl.nullable(),
      domain: z.string().trim().max(255).nullable(),
      snippet: z.string().trim().max(3000).nullable(),
    })).max(30),
    competitors: z.array(z.string().trim().min(1).max(255)).max(50),
  }).strict().nullable(),
  limitations: z.array(z.string().trim().min(1).max(500)).min(1).max(12),
}).strict().superRefine((snapshot, context) => {
  const hasEvidence = snapshot.evidence !== null && snapshot.fetchedAt !== null;
  if ((snapshot.state === "ready" || snapshot.state === "stale") !== hasEvidence) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["evidence"], message: "Ready/stale state requires timestamped evidence" });
  }
});

export type MarketProviderSnapshot = z.infer<typeof marketProviderSnapshotSchema>;

export function normalizeGa4LandingPageReport(raw: unknown): {
  rows: Ga4LandingPageRow[];
  rowCount: number;
  timeZone: string | null;
  limitations: string[];
} {
  const data = ga4LandingPageReportSchema.parse(raw);
  if (data.dimensionHeaders.map((header) => header.name).join(",") !== "landingPage") throw new Error("GA4_HEADER_MISMATCH");
  if (data.metricHeaders.map((header) => header.name).join(",") !== "sessions,engagedSessions") throw new Error("GA4_HEADER_MISMATCH");
  const rows = data.rows.flatMap((row) => {
    if (row.dimensionValues.length !== 1 || row.metricValues.length !== 2) throw new Error("GA4_VALUE_MISMATCH");
    const values = row.metricValues.map((item) => Number(item.value));
    if (values.some((value) => !Number.isFinite(value) || value < 0) || values[1]! > values[0]!) throw new Error("GA4_VALUE_MISMATCH");
    const landingPage = row.dimensionValues[0]!.value.trim();
    if (!landingPage || landingPage === "(not set)") return [];
    return [{ landingPage, sessions: values[0]!, engagedSessions: values[1]!, engagementRate: values[0] ? values[1]! / values[0]! : 0 }];
  });
  const limitations = [];
  if (data.metadata?.samplingMetadatas?.length) limitations.push("GA4 sampled this report");
  if (data.metadata?.subjectToThresholding) limitations.push("GA4 applied data thresholding");
  if (data.metadata?.dataLossFromOtherRow) limitations.push("GA4 grouped low-volume rows into (other)");
  return { rows, rowCount: data.rowCount || data.rows.length, timeZone: data.metadata?.timeZone ?? null, limitations };
}

const ga4OrganicTotalsReportSchema = z.object({
  dimensionHeaders: z.array(z.object({ name: z.string() })).default([]),
  metricHeaders: z.array(z.object({ name: z.string() }).passthrough()),
  rows: z.array(z.object({
    metricValues: z.array(z.object({ value: z.string() })),
  }).passthrough()).default([]),
  metadata: z.object({
    samplingMetadatas: z.array(z.unknown()).optional(),
    dataLossFromOtherRow: z.boolean().optional(),
    subjectToThresholding: z.boolean().optional(),
    timeZone: z.string().optional(),
  }).passthrough().optional(),
}).passthrough();

export function normalizeGa4OrganicTotalsReport(raw: unknown): {
  totals: Ga4MetricTotals;
  timeZone: string | null;
  limitations: string[];
} {
  const data = ga4OrganicTotalsReportSchema.parse(raw);
  if (data.dimensionHeaders.length !== 0) throw new Error("GA4_HEADER_MISMATCH");
  if (data.metricHeaders.map((header) => header.name).join(",") !== "sessions,engagedSessions") throw new Error("GA4_HEADER_MISMATCH");
  const row = data.rows[0];
  if (data.rows.length > 1 || (row && row.metricValues.length !== 2)) throw new Error("GA4_VALUE_MISMATCH");
  const values = row?.metricValues.map((item) => Number(item.value)) ?? [0, 0];
  if (values.some((value) => !Number.isFinite(value) || value < 0) || values[1]! > values[0]!) throw new Error("GA4_VALUE_MISMATCH");
  const sessions = values[0]!;
  const engagedSessions = values[1]!;
  const limitations = [];
  if (data.metadata?.samplingMetadatas?.length) limitations.push("GA4 sampled this report");
  if (data.metadata?.subjectToThresholding) limitations.push("GA4 applied data thresholding");
  if (data.metadata?.dataLossFromOtherRow) limitations.push("GA4 grouped low-volume rows into (other)");
  return {
    totals: { sessions, engagedSessions, engagementRate: sessions ? engagedSessions / sessions : 0 },
    timeZone: data.metadata?.timeZone ?? null,
    limitations,
  };
}

export function previousEqualDateRange(startDate: string, endDate: string) {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  const days = Math.round((end - start) / 86_400_000) + 1;
  const previousEnd = new Date(start - 86_400_000);
  const previousStart = new Date(previousEnd.getTime() - (days - 1) * 86_400_000);
  return {
    startDate: previousStart.toISOString().slice(0, 10),
    endDate: previousEnd.toISOString().slice(0, 10),
  };
}

export function normalizeGscSearchAnalyticsPage(raw: unknown, dimensions: readonly GscDimension[]): GscNormalizedRow[] {
  return gscSearchAnalyticsPageSchema.parse(raw).rows.map((row) => {
    if (row.keys.length !== dimensions.length) throw new Error("GSC_DIMENSION_MISMATCH");
    return {
      dimensions: Object.fromEntries(dimensions.map((dimension, index) => [dimension, row.keys[index]!])),
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
    };
  });
}

const gscSearchAnalyticsTotalsSchema = z.object({
  rows: z.array(z.object({
    clicks: z.number().nonnegative(),
    impressions: z.number().nonnegative(),
    ctr: z.number().min(0).max(1),
    position: z.number().nonnegative(),
  }).passthrough()).max(1).default([]),
}).passthrough();

export function normalizeGscSearchAnalyticsTotals(raw: unknown): GscMetricTotals {
  const row = gscSearchAnalyticsTotalsSchema.parse(raw).rows[0];
  if (!row) return { clicks: 0, impressions: 0, ctr: 0, position: null };
  return {
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.impressions ? row.clicks / row.impressions : 0,
    position: row.impressions ? row.position : null,
  };
}

function exactGscDashboardKey(row: GscNormalizedRow) {
  const query = row.dimensions.query;
  const page = row.dimensions.page;
  return query && page ? JSON.stringify([query, page]) : null;
}

export function joinGscDashboardRows(currentRows: readonly GscNormalizedRow[], previousRows: readonly GscNormalizedRow[]): GscDashboardRow[] {
  const previous = new Map<string, GscNormalizedRow>();
  const ambiguous = new Set<string>();
  for (const row of previousRows) {
    const key = exactGscDashboardKey(row);
    if (!key) continue;
    if (previous.has(key)) ambiguous.add(key);
    else previous.set(key, row);
  }
  return currentRows.flatMap((row) => {
    const key = exactGscDashboardKey(row);
    if (!key) return [];
    const comparison = ambiguous.has(key) ? null : previous.get(key) ?? null;
    return [{
      dimensions: { query: row.dimensions.query!, page: row.dimensions.page! },
      current: { clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position },
      previous: comparison ? { clicks: comparison.clicks, impressions: comparison.impressions, ctr: comparison.ctr, position: comparison.position } : null,
    }];
  });
}

export function joinGa4DashboardRows(currentRows: readonly Ga4LandingPageRow[], previousRows: readonly Ga4LandingPageRow[]): Ga4DashboardRow[] {
  const previous = new Map(previousRows.map((row) => [row.landingPage, row]));
  return currentRows.map((row) => ({
    landingPage: row.landingPage,
    current: { sessions: row.sessions, engagedSessions: row.engagedSessions, engagementRate: row.engagementRate },
    previous: previous.has(row.landingPage)
      ? {
          sessions: previous.get(row.landingPage)!.sessions,
          engagedSessions: previous.get(row.landingPage)!.engagedSessions,
          engagementRate: previous.get(row.landingPage)!.engagementRate,
        }
      : null,
  }));
}
