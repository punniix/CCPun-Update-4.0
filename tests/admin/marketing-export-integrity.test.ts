import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { normalizeMarketingDashboardSemantics, selectComparableMarketingDashboard } from "../../lib/admin/marketing/integrity";
import { assessMarketingDataQuality, marketingSeoScopeBreakdown } from "../../lib/admin/marketing/quality";
import { buildMarketingWorkspace, marketingWorkspaceCsv } from "../../lib/admin/marketing/export";
import type { MarketingDashboard } from "../../lib/admin/marketing/model";

function model(key: "this_week" | "last_week" | "this_month" | "last_month" | "rolling_7" | "rolling_28"): MarketingDashboard {
  const week = key.includes("week") || key === "rolling_7";
  const currentStart = week ? "2026-09-21" : "2026-09-01";
  const currentEnd = week ? "2026-09-25" : "2026-09-25";
  const previousStart = week ? "2026-09-14" : "2026-08-01";
  const previousEnd = week ? "2026-09-18" : "2026-08-25";
  const metric = { metric: "organic_sessions", metricSemantics: "period_activity" as const, current: 10, previous: 8, absoluteChange: 2, percentageChange: 25, sampleStatus: "low" as const, coverageStatus: "complete" as const, freshnessStatus: "fresh", threshold: 20, unit: "sessions", evidenceRef: "kpi:organic_sessions" };
  return {
    state: "ready",
    version: "marketing-v1",
    generatedAt: "2026-09-29T03:00:00Z",
    window: { key, currentStart, currentEnd, previousStart, previousEnd, availability: "mature_data", calendarPolicy: "equal mature periods" },
    kpis: [metric],
    contentPerformance: [{ assetId: "sanity:article", title: "Article", url: "https://ccpun.com/blog/article", category: null, topic: null, publishedAt: null, mappingStatus: "mapped", lifecycle: "mature", metrics: [metric] }],
    campaigns: [],
    benchmarks: [],
    leaderboards: [],
    trend: [],
    funnel: { mode: "activity-only", steps: [], limitation: "repeatable activity" },
    health: [{ source: "ga4", report: "ga4-daily-organic", sourceAsOf: "2026-09-25", collectedAt: "2026-09-29T03:00:00Z", lastSuccess: "2026-09-29T03:00:00Z", lastError: null, expectedLagDays: 1, status: "fresh", coverageStart: currentStart, coverageEnd: currentEnd, timezone: "Asia/Bangkok", limitations: ["Scope: hostName ccpun.com/www.ccpun.com only; blog excluded"] }],
    opportunities: [],
    actions: [],
    manifest: [{ batchId: "00000000-0000-4000-8000-000000000001", report: "ga4-daily-organic", rawHash: "a".repeat(64), resourceScope: "219719845", periodStart: currentStart, periodEnd: currentEnd, sourceAsOf: currentEnd, collectedAt: "2026-09-29T03:00:00Z", timezone: "Asia/Bangkok", limitations: [] }],
    notes: [],
  };
}

test("invalid current-week window falls back to latest mature equal-duration period", () => {
  const invalid = model("this_week");
  invalid.window = { ...invalid.window, currentStart: "2026-09-28", currentEnd: "2026-09-25", previousStart: "2026-09-21", previousEnd: "2026-09-18", availability: "no_mature_data" };
  const fallback = model("last_week");
  const selected = selectComparableMarketingDashboard("this_week", [
    { key: "this_week", model: invalid },
    { key: "last_week", model: fallback },
  ]);
  assert.equal(selected.window.key, "this_week");
  assert.equal(selected.window.currentStart, "2026-09-21");
  assert.equal(selected.window.currentEnd, "2026-09-25");
  assert.equal(selected.window.previousStart, "2026-09-14");
  assert.equal(selected.window.previousEnd, "2026-09-18");
  assert.equal(selected.window.availability, "latest_mature_period");
});

test("native social snapshot is standalone and never exposed as WoW/MoM activity", () => {
  const dashboard = model("this_week");
  const socialMetric = { metric: "social_views", current: 123, previous: 100, absoluteChange: 23, percentageChange: 23, sampleStatus: "sufficient" as const, coverageStatus: "native_snapshot_not_period_activity" as const, freshnessStatus: "fresh", threshold: 100, unit: "views", evidenceRef: "social:facebook:123", snapshotAt: "2026-09-29T03:00:00Z" };
  dashboard.contentPerformance.push({
    assetId: "social:Facebook:123",
    contentEntityId: "social-content:provider-content:abc",
    providerObjectId: "123",
    textContent: "Actual Facebook caption",
    title: "123",
    url: "https://facebook.com/post/123",
    category: "post",
    topic: null,
    publishedAt: "2026-09-20T00:00:00Z",
    mappingStatus: "unmapped",
    lifecycle: "new",
    metrics: [socialMetric],
  });
  const normalized = normalizeMarketingDashboardSemantics(dashboard);
  const social = normalized.contentPerformance.at(-1)!;
  assert.equal(social.mappingStatus, "standalone");
  assert.equal(social.metrics[0]!.metricSemantics, "lifetime_snapshot");
  assert.equal(social.metrics[0]!.previous, null);
  assert.equal(social.metrics[0]!.absoluteChange, null);
  assert.equal(social.metrics[0]!.percentageChange, null);
});

test("traffic anomaly blocks AI decisioning without deleting raw evidence", () => {
  const dashboard = model("this_week");
  dashboard.window = { ...dashboard.window, currentStart: "2026-09-14", currentEnd: "2026-09-18", previousStart: "2026-09-07", previousEnd: "2026-09-11" };
  dashboard.qualitySignals = {
    trafficClassification: "production",
    supportedClassifications: ["production", "internal", "qa", "unknown"],
    rawEvidencePreserved: true,
    anomalies: [{
      date: "2026-09-16",
      classification: "unknown",
      reason: "mirrored_ci_fhc_event_pattern",
      evidenceRef: "ga4-content-events:2026-09-16",
      ci: { landing: 27, start: 18, complete: 9 },
      fhc: { landing: 27, start: 18, complete: 9 },
    }],
  };
  const quality = assessMarketingDataQuality(dashboard);
  assert.equal(quality.status, "blocked_by_data_quality");
  assert.match(quality.limitations.join(" "), /2026-09-16/);
  assert.equal(dashboard.qualitySignals.rawEvidencePreserved, true);
});

test("performance CSV carries deterministic lineage and snapshot semantics", () => {
  const weekly = model("this_week"), monthly = model("this_month");
  const workspace = buildMarketingWorkspace(weekly, monthly);
  assert.match(workspace.lineage.sourceManifestHash, /^[a-f0-9]{64}$/);
  assert.equal(workspace.lineage.modelSchemaVersion, "marketing-workspace-v1");
  assert.ok(workspace.lineage.metricSemantics.includes("period_activity"));
  const csv = marketingWorkspaceCsv(workspace, "Performance Overview");
  assert.match(csv, /__data_quality_status/);
  assert.match(csv, /__source_manifest_sha256/);
  assert.match(csv, /__metric_semantics/);
});

test("additive migrations pin social caption identity, traffic evidence and least-privilege read functions", () => {
  const integrity = readFileSync("db/migrations/20260929_marketing_export_integrity_v3.sql", "utf8");
  const traffic = readFileSync("db/migrations/20260929_marketing_traffic_quality_v1.sql", "utf8");
  assert.match(integrity, /admin_read_marketing_v3/);
  assert.match(integrity, /textContent/);
  assert.match(integrity, /providerObjectId/);
  assert.match(integrity, /standalone/);
  assert.match(integrity, /lifetime_snapshot/);
  assert.match(integrity, /resourceScope/);
  assert.doesNotMatch(integrity, /DELETE FROM|TRUNCATE TABLE/i);
  assert.match(integrity, /GRANT EXECUTE ON FUNCTION ccpun_admin\.admin_read_marketing_v3/);
  assert.doesNotMatch(integrity, /GRANT SELECT ON ccpun_admin\.marketing_social_unified/);

  assert.match(traffic, /mirrored_ci_fhc_event_pattern/);
  assert.match(traffic, /rawEvidencePreserved/);
  assert.match(traffic, /'classification','unknown'/);
  assert.doesNotMatch(traffic, /DELETE FROM|TRUNCATE TABLE/i);
  assert.match(traffic, /GRANT EXECUTE ON FUNCTION ccpun_admin\.admin_marketing_traffic_quality/);
});

test("SEO migration scope separates current, legacy and combined without hiding the raw facts", () => {
  const dashboard = model("this_week");
  const search = (current: number, previous: number, ref: string) => ({ metric: "search_clicks", metricSemantics: "period_activity" as const, current, previous, absoluteChange: current - previous, percentageChange: previous ? (current - previous) * 100 / previous : null, sampleStatus: "sufficient" as const, coverageStatus: "complete" as const, freshnessStatus: "fresh", threshold: 10, unit: "clicks", evidenceRef: ref });
  dashboard.contentPerformance = [
    { assetId: "sanity:current", title: "Current", url: "https://ccpun.com/blog/current", category: null, topic: null, publishedAt: null, mappingStatus: "linked", lifecycle: "mature", metrics: [search(12, 10, "current")] },
    { assetId: "legacy:old", title: "Legacy", url: "https://blog.ccpun.com/old", category: null, topic: null, publishedAt: null, mappingStatus: "linked", lifecycle: "mature", metrics: [search(3, 8, "legacy")] },
  ];
  const rows = marketingSeoScopeBreakdown(dashboard).filter(row => row.metric === "search_clicks");
  assert.deepEqual(rows, [
    { scope: "current", metric: "search_clicks", current: 12, previous: 10 },
    { scope: "legacy", metric: "search_clicks", current: 3, previous: 8 },
    { scope: "combined", metric: "search_clicks", current: 15, previous: 18 },
  ]);
  const quality = assessMarketingDataQuality(dashboard);
  assert.equal(quality.migrationContext, "combined");
  assert.equal(quality.status, "blocked_by_data_quality");
});

test("Google Sheet lineage accepts a real pipeline correlation ID while direct files remain deterministic", () => {
  const correlationId = "00000000-0000-4000-8000-000000000099";
  const workspace = buildMarketingWorkspace(model("this_week"), model("this_month"), {}, { pipelineCorrelationId: correlationId });
  assert.equal(workspace.lineage.pipelineCorrelationId, correlationId);
  assert.match(marketingWorkspaceCsv(workspace, "Performance Overview"), new RegExp(correlationId));
});

test("Owner Export and Daily AI remain one 77-node source workflow with two independent roots", () => {
  const workflow = JSON.parse(readFileSync("workers/local-ai/n8n/owner-export-google-sheet.direct.json", "utf8"));
  assert.equal(workflow.nodes.length, 77);
  assert.equal(workflow.nodes.some((node: { name: string }) => node.name === "Admin · Export Google Sheet"), true);
  assert.equal(workflow.nodes.some((node: { name: string }) => node.name === "Daily · เก็บข้อมูล 06:00"), true);
  assert.equal(workflow.settings.availableInMCP, true);
  assert.equal(workflow.settings.timezone, "Asia/Bangkok");
  assert.equal(workflow.nodes.filter((node: { type: string }) => node.type === "n8n-nodes-base.scheduleTrigger").length, 1);
});
