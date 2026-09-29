import { createHash } from "node:crypto";
import type { MarketingDashboard, MarketingManifest, MarketingMetric } from "./model";
import { comparableWindow } from "./integrity";

export type MarketingDataQualityStatus = "ready" | "blocked_by_data_quality" | "insufficient_data" | "stale";
export type MarketingMetricSemantics = "period_activity" | "lifetime_snapshot" | "point_in_time_snapshot";
export type MarketingTrafficClassification = "production" | "internal" | "qa" | "unknown";
export type MarketingMigrationContext = "current" | "legacy" | "combined" | "unknown";

export type MarketingDataQuality = {
  status: MarketingDataQualityStatus;
  validDateRange: boolean;
  comparablePeriods: boolean;
  freshness: "fresh" | "stale" | "failed" | "unknown";
  snapshotSemanticsValid: boolean;
  denominatorAvailability: "available" | "partial" | "not_applicable";
  identityCoverage: number | null;
  migrationContext: MarketingMigrationContext;
  trafficClassification: MarketingTrafficClassification;
  limitations: string[];
};

function metricSemantics(metric: MarketingMetric): MarketingMetricSemantics {
  if (metric.metricSemantics) return metric.metricSemantics;
  return metric.metric.startsWith("social_") || metric.coverageStatus === "native_snapshot_not_period_activity"
    ? "lifetime_snapshot"
    : "period_activity";
}

export function marketingMigrationContext(model: MarketingDashboard): MarketingMigrationContext {
  let current = false, legacy = false;
  const urls = model.contentPerformance.map(row => row.url).filter(Boolean);
  for (const value of urls) {
    try {
      const host = new URL(value).hostname.toLowerCase();
      if (host === "blog.ccpun.com") legacy = true;
      if (host === "ccpun.com" || host === "www.ccpun.com") current = true;
    } catch {}
  }
  return current && legacy ? "combined" : current ? "current" : legacy ? "legacy" : "unknown";
}

function trafficClassification(model: MarketingDashboard): MarketingTrafficClassification {
  if (model.qualitySignals?.trafficClassification) return model.qualitySignals.trafficClassification;
  const ga4 = model.health.filter(item => item.report.startsWith("ga4-"));
  if (ga4.length && ga4.every(item => (item.limitations ?? []).some(note => /hostName ccpun\.com|blog excluded/i.test(note)))) return "production";
  return "unknown";
}

export type MarketingSeoScope = "current" | "legacy" | "combined";
export type MarketingSeoScopeRow = { scope: MarketingSeoScope; metric: "search_clicks" | "search_impressions"; current: number | null; previous: number | null };

export function marketingSeoScopeBreakdown(model: MarketingDashboard): MarketingSeoScopeRow[] {
  const metrics = ["search_clicks", "search_impressions"] as const;
  const buckets = new Map<string, { current: number; previous: number; hasCurrent: boolean; hasPrevious: boolean }>();
  for (const asset of model.contentPerformance) {
    let scope: Exclude<MarketingSeoScope, "combined"> | null = null;
    try {
      const host = new URL(asset.url).hostname.toLowerCase();
      if (host === "blog.ccpun.com") scope = "legacy";
      else if (host === "ccpun.com" || host === "www.ccpun.com") scope = "current";
    } catch {}
    if (!scope) continue;
    for (const metricName of metrics) {
      const metric = asset.metrics.find(item => item.metric === metricName);
      if (!metric) continue;
      const key = scope + ":" + metricName;
      const bucket = buckets.get(key) ?? { current: 0, previous: 0, hasCurrent: false, hasPrevious: false };
      if (metric.current !== null) { bucket.current += metric.current; bucket.hasCurrent = true; }
      if (metric.previous !== null) { bucket.previous += metric.previous; bucket.hasPrevious = true; }
      buckets.set(key, bucket);
    }
  }
  const rows: MarketingSeoScopeRow[] = [];
  for (const metric of metrics) {
    const current = buckets.get("current:" + metric);
    const legacy = buckets.get("legacy:" + metric);
    if (current) rows.push({ scope: "current", metric, current: current.hasCurrent ? current.current : null, previous: current.hasPrevious ? current.previous : null });
    if (legacy) rows.push({ scope: "legacy", metric, current: legacy.hasCurrent ? legacy.current : null, previous: legacy.hasPrevious ? legacy.previous : null });
    if (current || legacy) {
      const currentComplete = (!current || current.hasCurrent) && (!legacy || legacy.hasCurrent);
      const previousComplete = (!current || current.hasPrevious) && (!legacy || legacy.hasPrevious);
      rows.push({
        scope: "combined",
        metric,
        current: currentComplete ? (current?.current ?? 0) + (legacy?.current ?? 0) : null,
        previous: previousComplete ? (current?.previous ?? 0) + (legacy?.previous ?? 0) : null,
      });
    }
  }
  return rows;
}
export function assessMarketingDataQuality(model: MarketingDashboard): MarketingDataQuality {
  const limitations: string[] = [];
  const validDateRange = Boolean(model.window.currentStart && model.window.currentEnd && model.window.previousStart && model.window.previousEnd)
    && model.window.currentStart <= model.window.currentEnd
    && model.window.previousStart <= model.window.previousEnd;
  const comparablePeriods = validDateRange && comparableWindow(model);
  if (!validDateRange) limitations.push("Invalid reporting window; period_start must not exceed period_end.");
  if (validDateRange && !comparablePeriods) limitations.push("Current and previous reporting periods are not equal duration.");

  const healthStatuses = model.health.map(item => item.status);
  const freshness = healthStatuses.includes("failed") ? "failed" : healthStatuses.includes("stale") ? "stale" : healthStatuses.length ? "fresh" : "unknown";
  if (freshness === "failed") limitations.push("At least one required source collection failed.");
  if (freshness === "stale") limitations.push("At least one source is stale; actions must be qualified.");

  const metrics = [...model.kpis, ...model.contentPerformance.flatMap(asset => asset.metrics)];
  const snapshots = metrics.filter(metric => metricSemantics(metric) !== "period_activity");
  const snapshotSemanticsValid = snapshots.every(metric => metric.previous === null && metric.absoluteChange === null && metric.percentageChange === null);
  if (!snapshotSemanticsValid) limitations.push("Snapshot metrics contain period-comparison fields and cannot be used for WoW/MoM decisions.");

  const denominatorMetrics = metrics.filter(metric => ["search_ctr", "search_average_position"].includes(metric.metric) && metric.current !== null);
  const missingDenominator = denominatorMetrics.filter(metric => metric.currentDenominator == null);
  const denominatorAvailability = denominatorMetrics.length === 0 ? "not_applicable" : missingDenominator.length === 0 ? "available" : "partial";
  if (denominatorAvailability === "partial") limitations.push("A rate/average metric is missing its denominator.");

  const identities = model.contentPerformance;
  const resolved = identities.filter(row => ["linked", "standalone", "mapped"].includes(row.mappingStatus)).length;
  const identityCoverage = identities.length ? resolved / identities.length : null;
  if (identityCoverage !== null && identityCoverage < 0.8) limitations.push("Canonical content identity coverage is below 80%.");

  const seoMigration = marketingMigrationContext(model);
  if (seoMigration === "combined") limitations.push("SEO evidence spans ccpun.com and legacy blog.ccpun.com; current-domain and combined conclusions must remain separate.");
  const traffic = trafficClassification(model);
  const trafficAnomalies = model.qualitySignals?.anomalies ?? [];
  if (traffic === "unknown") limitations.push("Traffic is not fully classifiable as production/internal/qa from the stored dimensions; raw evidence remains preserved.");
  if (trafficAnomalies.length) limitations.push("Potential internal/QA contamination remains unresolved for " + trafficAnomalies.map(item => item.date).join(", ") + "; mirrored CI/FHC event evidence is preserved and excluded from AI decisioning until classified.");

  const hasUsableEvidence = metrics.some(metric => metric.current !== null);
  let status: MarketingDataQualityStatus = "ready";
  const searchEvidence = metrics.some(metric => metric.metric.startsWith("search_"));
  if (!validDateRange || !comparablePeriods || !snapshotSemanticsValid || denominatorAvailability === "partial" || (seoMigration === "combined" && searchEvidence) || trafficAnomalies.length > 0) status = "blocked_by_data_quality";
  else if (!hasUsableEvidence || (identityCoverage !== null && identityCoverage < 0.5)) status = "insufficient_data";
  else if (freshness === "failed") status = "blocked_by_data_quality";
  else if (freshness === "stale") status = "stale";

  return { status, validDateRange, comparablePeriods, freshness, snapshotSemanticsValid, denominatorAvailability, identityCoverage, migrationContext: seoMigration, trafficClassification: traffic, limitations };
}

export function marketingSourceManifestHash(manifest: MarketingManifest[]) {
  return createHash("sha256").update(JSON.stringify(manifest.map(item => ({
    batchId: item.batchId, report: item.report, rawHash: item.rawHash, periodStart: item.periodStart, periodEnd: item.periodEnd,
    sourceAsOf: item.sourceAsOf, collectedAt: item.collectedAt, resourceScope: item.resourceScope ?? null,
  })).sort((a, b) => (a.batchId + a.report).localeCompare(b.batchId + b.report)))).digest("hex");
}
