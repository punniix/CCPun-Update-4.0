import type { MarketingDashboard, MarketingWindow } from "./model";

const DAY_MS = 86_400_000;

function day(value: string) {
  const parsed = Date.parse(value + "T00:00:00Z");
  return Number.isFinite(parsed) ? parsed : null;
}

export function comparableWindow(model: MarketingDashboard) {
  const currentStart = day(model.window.currentStart);
  const currentEnd = day(model.window.currentEnd);
  const previousStart = day(model.window.previousStart);
  const previousEnd = day(model.window.previousEnd);
  if ([currentStart, currentEnd, previousStart, previousEnd].some(value => value === null)) return false;
  return currentStart! <= currentEnd!
    && previousStart! <= previousEnd!
    && (currentEnd! - currentStart!) / DAY_MS === (previousEnd! - previousStart!) / DAY_MS;
}

function relabel(requested: MarketingWindow, source: MarketingDashboard, sourceKey: MarketingWindow): MarketingDashboard {
  return {
    ...source,
    window: {
      ...source.window,
      key: requested,
      availability: sourceKey === requested ? (source.window.availability ?? "mature_data") : "latest_mature_period",
      calendarPolicy: sourceKey === requested
        ? source.window.calendarPolicy
        : `Requested ${requested}; using latest mature comparable ${sourceKey}. ${source.window.calendarPolicy}`,
    },
    notes: sourceKey === requested
      ? source.notes
      : [`Requested ${requested} was not mature/comparable; facts use ${sourceKey} without relabelling provider dates.`, ...source.notes],
  };
}

export function selectComparableMarketingDashboard(
  requested: MarketingWindow,
  candidates: Array<{ key: MarketingWindow; model: MarketingDashboard | null | undefined }>,
): MarketingDashboard {
  const ordered = candidates.filter((candidate) => candidate.model?.state === "ready") as Array<{ key: MarketingWindow; model: MarketingDashboard }>;
  const exact = ordered.find(candidate => candidate.key === requested && comparableWindow(candidate.model) && candidate.model.window.availability !== "no_mature_data");
  if (exact) return relabel(requested, exact.model, exact.key);
  const fallback = ordered.find(candidate => comparableWindow(candidate.model) && candidate.model.window.availability !== "no_mature_data");
  if (!fallback) throw new Error("MARKETING_COMPARABLE_WINDOW_NOT_READY");
  return relabel(requested, fallback.model, fallback.key);
}

export function normalizeMarketingDashboardSemantics(model: MarketingDashboard): MarketingDashboard {
  const normalizeMetric = (metric: MarketingDashboard["kpis"][number]) => {
    const snapshot = metric.metric.startsWith("social_") || metric.coverageStatus === "native_snapshot_not_period_activity";
    return {
      ...metric,
      metricSemantics: metric.metricSemantics ?? (snapshot ? "lifetime_snapshot" : "period_activity"),
      ...(snapshot ? { previous: null, absoluteChange: null, percentageChange: null } : {}),
    };
  };
  const mapping = (assetId: string, status: string) => status === "linked" || status === "standalone" || status === "unresolved"
    ? status
    : assetId.startsWith("social:") || assetId.startsWith("social-content:")
      ? "standalone"
      : status === "mapped" ? "linked" : "unresolved";
  return {
    ...model,
    kpis: model.kpis.map(normalizeMetric),
    contentPerformance: model.contentPerformance.map(asset => ({
      ...asset,
      mappingStatus: mapping(asset.assetId, asset.mappingStatus),
      contentEntityId: asset.contentEntityId ?? asset.assetId,
      metrics: asset.metrics.map(normalizeMetric),
    })),
    leaderboards: model.leaderboards.map(board => ({
      ...board,
      rows: board.rows.map(row => ({
        ...row,
        mappingStatus: mapping(row.assetId, row.mappingStatus),
        contentEntityId: row.contentEntityId ?? row.assetId,
        ...normalizeMetric(row),
      })),
    })),
  };
}
