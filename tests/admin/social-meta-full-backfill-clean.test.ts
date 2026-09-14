import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { __test, META_INSIGHTS_BACKFILL_BATCH_SIZE, META_INSIGHTS_BACKFILL_PROFILE } from "../../lib/admin/social/providers/meta/full-backfill";
import { fetchMetaInsightsDetailed } from "../../lib/admin/social/providers/meta/insights-read";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const version = "20260902_social_marketing_mart_p2_full_backfill_clean";
const checksum = "sha256:1dfbe426656ada42fa59f4b0d0727a39c293534abf964690bbbe0d8c6294727f";

test("P2 clean-mart migration is additive, checksum-locked, and preserves raw truth", () => {
  const migration = read("db/migrations/20260902_social_marketing_mart_p2_full_backfill_clean.sql");
  const source = migration.split("-- checksum-source-begin\n")[1]?.split("-- checksum-source-end")[0];
  assert.ok(source);
  assert.equal(`sha256:${createHash("sha256").update(source).digest("hex")}`, checksum);
  assert.match(migration, new RegExp(version));
  assert.match(migration, /20260902_social_marketing_mart_p1_meta_insights/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS ccpun_social\.social_provider_metric_collection_attempt/);
  assert.match(migration, /CREATE OR REPLACE VIEW ccpun_social\.post_performance_latest/);
  assert.match(migration, /CREATE OR REPLACE VIEW ccpun_social\.post_metric_status_latest/);
  assert.match(migration, /CREATE OR REPLACE VIEW ccpun_social\.post_metric_coverage_summary/);
  assert.match(migration, /CREATE OR REPLACE VIEW ccpun_social\.post_performance_clean/);
  for (const destructive of [
    /DROP TABLE/i,
    /TRUNCATE/i,
    /DELETE FROM ccpun_social\.social_provider_/i,
    /ALTER TABLE ccpun_social\.social_provider_content/i,
    /ALTER TABLE ccpun_social\.social_provider_metric_snapshot/i,
    /UPDATE ccpun_social\.social_provider_metric_snapshot/i,
  ]) assert.doesNotMatch(migration, destructive);
  assert.doesNotMatch(source, /access.?token|refresh.?token|client.?secret/i);
});

test("P2 clean view uses one latest snapshot, explicit coverage, NULL comment attribution, and provider-definition QA", () => {
  const migration = read("db/migrations/20260902_social_marketing_mart_p2_full_backfill_clean.sql");
  assert.match(migration, /SELECT DISTINCT ON \(performance\.content_id\)/);
  assert.match(migration, /ORDER BY performance\.content_id, performance\.snapshot_at DESC/);
  assert.match(migration, /NULL::numeric AS creator_comments/);
  assert.match(migration, /NULL::numeric AS audience_comments/);
  assert.match(migration, /known_engagement_total/);
  assert.match(migration, /known_deep_engagement_total/);
  assert.match(migration, /engagement_components_complete/);
  assert.match(migration, /metric_coverage_rate/);
  assert.match(migration, /clicks_per_view/);
  assert.match(migration, /facebook_reaction_definition_status/);
  assert.match(migration, /instagram_interaction_definition_status/);
  assert.match(migration, /data_quality_status/);
  assert.match(migration, /analysis_status/);
  assert.match(migration, /WHEN base\.views IS NULL OR base\.views = 0 OR base\.clicks IS NULL THEN NULL/);
  assert.doesNotMatch(migration, /COALESCE\([^\n]*creator_comments[^\n]*0/i);
});

test("Latest metric status separates not-fetched, not-returned, unsupported and provider failures", () => {
  const migration = read("db/migrations/20260902_social_marketing_mart_p2_full_backfill_clean.sql");
  for (const status of ["not_fetched", "not_returned", "unsupported", "permission_denied", "rate_limited", "fetch_error"]) {
    assert.match(migration, new RegExp(status));
  }
  assert.match(migration, /WHEN observation\.native_metric_key IS NOT NULL THEN 'available'/);
  assert.match(migration, /WHEN attempted\.metric_status IS NOT NULL THEN attempted\.metric_status/);
  assert.match(migration, /metric_value_stale/);
  assert.match(migration, /WHEN capability\.collection_state = 'requested' THEN 'not_fetched'/);
  assert.doesNotMatch(migration, /COALESCE\(observation\.metric_value,\s*0\)/i);
});

test("Restricted runtime can append collection evidence and read clean views but cannot mutate prior attempts", () => {
  const migration = read("db/migrations/20260902_social_marketing_mart_p2_full_backfill_clean.sql");
  const readback = read("db/migrations/20260902_social_marketing_mart_p2_full_backfill_clean_readback.sql");
  assert.match(migration, /GRANT SELECT, INSERT ON ccpun_social\.social_provider_metric_collection_attempt TO ccpun_social_runtime/);
  assert.doesNotMatch(migration, /GRANT (?:UPDATE|DELETE)[^;]*social_provider_metric_collection_attempt TO ccpun_social_runtime/i);
  assert.match(readback, /runtime_attempt_unsafe_grants_denied/);
  assert.match(readback, /runtime_clean_performance_read_ok/);
});

test("Production bootstrap includes P2 and requires the current eleven Social migrations", () => {
  const cwd = new URL("../..", import.meta.url);
  const bootstrap = execFileSync(process.execPath, ["scripts/build-social-production-bootstrap.mjs"], { cwd, encoding: "utf8" });
  const readback = execFileSync(process.execPath, ["scripts/build-social-production-bootstrap.mjs", "--readback"], { cwd, encoding: "utf8" });
  assert.match(bootstrap, new RegExp(version));
  assert.match(bootstrap, new RegExp(checksum.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(readback, /count\(\*\) = 11/);
  assert.match(readback, new RegExp(version));
});

test("Detailed Insights parser preserves missing-vs-zero and isolates unsupported metrics", async () => {
  const observations = await fetchMetaInsightsDetailed({
    version: "v26.0",
    objectId: "ig-1",
    token: "secret",
    metrics: ["views", "saved", "plays"],
  }, async (input) => {
    const metric = new URL(String(input)).searchParams.get("metric");
    if (metric?.includes(",")) return new Response(JSON.stringify({ error: { code: 100 } }), { status: 400 });
    if (metric === "views") return new Response(JSON.stringify({ data: [{ name: "views", values: [{ value: 0 }] }] }));
    if (metric === "saved") return new Response(JSON.stringify({ data: [] }));
    return new Response(JSON.stringify({ error: { code: 100 } }), { status: 400 });
  });
  assert.deepEqual(observations, [
    { metric: "views", status: "available", value: 0 },
    { metric: "saved", status: "not_returned" },
    { metric: "plays", status: "unsupported" },
  ]);
});

test("Full-backfill result merges new metrics with existing native truth deterministically", () => {
  const result = __test.buildCollectionResult({
    content_id: "provider-content:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    platform: "instagram",
    provider_object_id: "ig-1",
    media_type: "VIDEO",
    latest_native_metrics: [
      { key: "instagram.likes", label: "Likes", value: 4, unit: "count", dimension: "engagement" },
      { key: "instagram.comments", label: "Comments", value: 1, unit: "count", dimension: "engagement" },
    ],
  }, [
    { metric: "views", status: "available", value: 100 },
    { metric: "reach", status: "available", value: 80 },
    { metric: "saved", status: "available", value: 0 },
    { metric: "shares", status: "not_returned" },
    { metric: "total_interactions", status: "available", value: 6 },
    { metric: "ig_reels_video_view_total_time", status: "available", value: 12345 },
    { metric: "ig_reels_avg_watch_time", status: "available", value: 4567 },
  ], "2026-09-02T08:00:00.000Z");

  assert.equal(result.outcome, "partial");
  assert.equal(result.availableCount, 6);
  assert.equal(result.statuses.find((status) => status.key === "shares")?.status, "not_returned");
  assert.deepEqual(result.mergedMetrics.map((metric) => metric.key), [...result.mergedMetrics.map((metric) => metric.key)].sort());
  assert.equal(result.mergedMetrics.find((metric) => metric.key === "instagram.saves")?.value, 0);
  assert.equal(result.mergedMetrics.find((metric) => metric.key === "instagram.shares"), undefined);
  assert.equal(result.mergedMetrics.find((metric) => metric.key === "instagram.ig_reels_video_view_total_time")?.unit, "milliseconds");
  assert.notEqual(result.mergedMetricsHash, result.previousMetricsHash);
});

test("Facebook reaction absence stays not-returned rather than becoming zero", () => {
  const result = __test.buildCollectionResult({
    content_id: "provider-content:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    platform: "facebook",
    provider_object_id: "fb-1",
    media_type: "mobile_status_update",
    latest_native_metrics: [
      { key: "facebook.likes", label: "Likes", value: 2, unit: "count", dimension: "engagement" },
    ],
  }, [
    { metric: "post_media_view", status: "available", value: 20 },
    { metric: "post_clicks", status: "available", value: 0 },
    { metric: "post_reactions_by_type_total", status: "available", value: { like: 2 } },
  ], "2026-09-02T08:00:00.000Z");
  assert.equal(result.statuses.find((status) => status.key === "reaction_like")?.status, "available");
  assert.equal(result.statuses.find((status) => status.key === "reaction_love")?.status, "not_returned");
  assert.equal(result.mergedMetrics.find((metric) => metric.key === "facebook.reaction_like")?.value, 2);
  assert.equal(result.mergedMetrics.find((metric) => metric.key === "facebook.reaction_love"), undefined);
});

test("Terminal not-returned observations remove stale P1 values while transient failures preserve retry evidence", () => {
  const previous = [
    { key: "instagram.views", label: "Views", value: 100, unit: "count" as const, dimension: "discovery" as const },
    { key: "instagram.reach", label: "Reach", value: 80, unit: "count" as const, dimension: "discovery" as const },
    { key: "instagram.shares", label: "Shares", value: 9, unit: "count" as const, dimension: "deep-engagement" as const },
  ];
  const retained = __test.retainPreviousMetrics(previous, "instagram", [
    { key: "views", status: "available" },
    { key: "reach", status: "rate_limited" },
    { key: "shares", status: "not_returned" },
  ]);
  assert.equal(retained.some((metric) => metric.key === "instagram.views"), false);
  assert.equal(retained.some((metric) => metric.key === "instagram.shares"), false);
  assert.equal(retained.find((metric) => metric.key === "instagram.reach")?.value, 80);
});

test("Backfill service is resumable in fixed batches and retries failed attempts only", () => {
  const source = read("lib/admin/social/providers/meta/full-backfill.ts");
  assert.equal(META_INSIGHTS_BACKFILL_BATCH_SIZE, 50);
  assert.equal(META_INSIGHTS_BACKFILL_PROFILE, "meta-p1-insights-v1");
  assert.match(source, /LIMIT \$2/);
  assert.match(source, /attempt\.outcome IN \('complete','partial'\)/);
  assert.match(source, /ORDER BY \(previous_attempt\.outcome IS NOT NULL\)/);
  assert.doesNotMatch(source, /attempt\.outcome IN \('complete','partial','failed'\)/);
  assert.match(source, /mapWithConcurrency\(batch, 5/);
  assert.match(source, /ON CONFLICT \(content_id,metrics_hash\) DO NOTHING/);
  assert.match(source, /social_provider_metric_collection_attempt/);
  assert.match(source, /providerWriteAllowed: false/);
  assert.match(source, /backgroundSyncAllowed: false/);
});

test("Full-backfill HTTP route is owner-only, same-origin, bounded and has no provider-write action", () => {
  const route = read("app/api/admin/social/analytics/backfill/meta-insights/route.ts");
  assert.match(route, /export const maxDuration = 60/);
  assert.match(route, /getAdminIdentity\(\)/);
  assert.match(route, /identity\.actorType !== "human" \|\| identity\.role !== "owner"/);
  assert.match(route, /isConfiguredAdminOrigin/);
  assert.match(route, /isSameOriginAdminMutation/);
  assert.match(route, /export async function POST\(request: Request\)/);
  assert.doesNotMatch(route, /export async function (GET|PUT|PATCH|DELETE)/);
  assert.match(route, /backfillMetaInsightsBatch/);
  assert.doesNotMatch(route, /publish|execute|providerWriteAllowed:\s*true/);
});
