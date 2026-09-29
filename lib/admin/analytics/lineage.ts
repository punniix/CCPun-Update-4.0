import { createHash } from "node:crypto";
import type { OwnerExportLineage } from "../agent-os/export-datasets";
import type { AnalyticsDataset } from "./model";

export function buildAnalyticsExportLineage(
  datasets: AnalyticsDataset[],
  generatedAt: string,
  analysisVersion: string | null = null,
): OwnerExportLineage {
  const invalidRange = datasets.some(data => data.windowStart && data.windowEnd && data.windowStart > data.windowEnd);
  const failedAttempt = datasets.some(data => data.lastAttemptStatus === "failed");
  const noRows = !datasets.some(data => data.rows.length);
  const semantics = new Set<OwnerExportLineage["metricSemantics"][number]>();
  for (const data of datasets) {
    if (data.report === "social-performance") semantics.add("lifetime_snapshot");
    else if (data.source === "ubersuggest" && !data.windowStart) semantics.add("point_in_time_snapshot");
    else semantics.add("period_activity");
  }
  const manifest = datasets.map(data => ({
    batchId: data.batchId,
    report: data.report,
    rawHash: data.rawHash,
    resourceScope: data.resourceScope ?? null,
    sourceAsOf: data.sourceAsOf,
    windowStart: data.windowStart,
    windowEnd: data.windowEnd,
    collectedAt: data.collectedAt,
  })).sort((a, b) => (a.batchId + a.report).localeCompare(b.batchId + b.report));
  const currentHost = datasets.some(data => data.rows.some(row => Object.values(row).some(value => typeof value === "string" && /https?:\/\/(?:www\.)?ccpun\.com\//i.test(value))));
  const legacyHost = datasets.some(data => data.rows.some(row => Object.values(row).some(value => typeof value === "string" && /https?:\/\/blog\.ccpun\.com\//i.test(value))));
  const limitations = [
    "Deterministic export from stored Analytics datasets; no provider request occurs during file generation.",
    ...(invalidRange ? ["At least one stored dataset has an invalid reporting window and must not be used for period comparison."] : []),
    ...(currentHost && legacyHost ? ["SEO evidence contains both current ccpun.com and legacy blog.ccpun.com URLs; combined and current-domain conclusions must remain separate."] : []),
    ...(datasets.some(data => data.report === "social-performance") ? ["Meta/social native counters are snapshots; they are not WoW/MoM period activity unless a historical snapshot delta is explicitly computed."] : []),
  ];
  return {
    generatedAt,
    cutoff: generatedAt,
    sourceDataAvailableThrough: datasets.map(data => data.sourceAsOf).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null,
    dataQualityStatus: invalidRange ? "blocked_by_data_quality" : failedAttempt ? "stale" : noRows ? "insufficient_data" : "ready",
    sourceManifestHash: createHash("sha256").update(JSON.stringify(manifest)).digest("hex"),
    modelSchemaVersion: "analytics-export-v2",
    analysisVersion,
    aiAnalysisId: null,
    pipelineCorrelationId: null,
    metricSemantics: semantics.size ? [...semantics] : ["point_in_time_snapshot"],
    limitations,
  };
}
