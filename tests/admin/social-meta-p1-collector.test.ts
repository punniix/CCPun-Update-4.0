import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CCPUN_VERCEL_PROJECT_IDS } from "../../lib/admin/environment";
import { WEBSITE_42_SOCIAL_PROVIDER_BRANCH } from "../../lib/admin/social/provider-readonly";
import { normalizeMetaAnalytics } from "../../lib/admin/social/provider-adapters";
import { fetchMetaInsights } from "../../lib/admin/social/providers/meta/insights-read";
import { fetchMetaReadOnlyDiscovery } from "../../lib/admin/social/providers/meta/read-only";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const version = "20260902_social_marketing_mart_p1_meta_insights";
const checksum = "sha256:7bdc2c2b80b59d7364d92ec88dd66ccd5472390291bf0bc3ba82ec424718f671";
const lane = {
  CCPUN_SOCIAL_PROVIDER_READS_ENABLED: "1",
  CCPUN_APP_ENV: "admin-uat",
  VERCEL_PROJECT_ID: CCPUN_VERCEL_PROJECT_IDS.adminProduction,
  VERCEL_GIT_COMMIT_REF: WEBSITE_42_SOCIAL_PROVIDER_BRANCH,
  NEXT_PUBLIC_SANITY_PROJECT_ID: "ccb9lnw5",
  NEXT_PUBLIC_SANITY_DATASET: "uat",
  CCPUN_META_ACCESS_TOKEN: "meta-system-token",
  CCPUN_META_GRAPH_VERSION: "v26.0",
  CCPUN_META_GRANTED_SCOPES: "pages_show_list,pages_read_engagement,instagram_basic,read_insights,instagram_manage_insights",
};

test("P1 Meta Insights migration is additive, checksum locked, and does not alter raw provider tables", () => {
  const migration = read("db/migrations/20260902_social_marketing_mart_p1_meta_insights.sql");
  const source = migration.split("-- checksum-source-begin\n")[1]?.split("-- checksum-source-end")[0];
  assert.ok(source);
  assert.equal(`sha256:${createHash("sha256").update(source).digest("hex")}`, checksum);
  assert.match(migration, new RegExp(version));
  assert.match(migration, /20260902_social_marketing_mart_p0/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS applies_to_format/);
  assert.match(migration, /'meta','instagram','reach','instagram\.reach','requested'/);
  assert.match(migration, /'meta','instagram','reel_total_watch_time_ms','instagram\.ig_reels_video_view_total_time','requested'/);
  assert.match(migration, /applies_to_format='video'|,'video'\)/);
  assert.match(migration, /capability\.applies_to_format[\s\S]*THEN 'unsupported'/);
  for (const destructive of [/DROP TABLE/i, /DELETE FROM/i, /TRUNCATE/i, /ALTER TABLE ccpun_social\.social_provider_content/i, /ALTER TABLE ccpun_social\.social_provider_metric_snapshot/i]) {
    assert.doesNotMatch(migration, destructive);
  }
  assert.doesNotMatch(source, /access.?token|refresh.?token|client.?secret/i);
});

test("Production bootstrap includes P1 and requires the current eleven Social migrations", () => {
  const cwd = new URL("../..", import.meta.url);
  const bootstrap = execFileSync(process.execPath, ["scripts/build-social-production-bootstrap.mjs"], { cwd, encoding: "utf8" });
  const readback = execFileSync(process.execPath, ["scripts/build-social-production-bootstrap.mjs", "--readback"], { cwd, encoding: "utf8" });
  assert.match(bootstrap, new RegExp(version));
  assert.match(bootstrap, new RegExp(checksum.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(readback, /count\(\*\) = 11/);
  assert.match(readback, new RegExp(version));
});

test("Meta Insights parser accepts numeric and reaction-object values and falls back from an invalid combined metric request", async () => {
  const requests: string[] = [];
  const result = await fetchMetaInsights({
    version: "v26.0", objectId: "post-1", token: "secret", metrics: ["post_media_view", "post_reactions_by_type_total"],
  }, async (input) => {
    const url = String(input);
    requests.push(url);
    const metric = new URL(url).searchParams.get("metric");
    if (metric?.includes(",")) return new Response(JSON.stringify({ error: { code: 100 } }), { status: 400 });
    if (metric === "post_media_view") return new Response(JSON.stringify({ data: [{ name: "post_media_view", values: [{ value: 123 }] }] }));
    return new Response(JSON.stringify({ data: [{ name: "post_reactions_by_type_total", values: [{ value: { like: 10, love: 2, care: 1 } }] }] }));
  });
  assert.equal(result.get("post_media_view"), 123);
  assert.deepEqual(result.get("post_reactions_by_type_total"), { like: 10, love: 2, care: 1 });
  assert.equal(requests.length, 3);
  assert.equal(requests.every((url) => !url.includes("secret")), true);
});

test("Normal discovery does not request Insights", async () => {
  const requests: string[] = [];
  await fetchMetaReadOnlyDiscovery(lane, async (input) => {
    const url = String(input); requests.push(url);
    if (url.includes("/me/accounts")) return new Response(JSON.stringify({ data: [{ id: "page-1", name: "CCPun", instagram_business_account: { id: "ig-1", username: "ccpun" } }] }));
    if (url.includes("/published_posts")) return new Response(JSON.stringify({ data: [] }));
    return new Response(JSON.stringify({ data: [] }));
  });
  assert.equal(requests.some((url) => url.includes("/insights")), false);
});

test("Manual analytics discovery enriches bounded Facebook and Instagram provider content with proven P1 metrics", async () => {
  const requests: Array<{ url: string; auth: string }> = [];
  const result = await fetchMetaReadOnlyDiscovery(lane, async (input, init) => {
    const url = String(input);
    requests.push({ url, auth: new Headers(init?.headers).get("authorization") ?? "" });
    if (url.includes("/me/accounts")) return new Response(JSON.stringify({ data: [{
      id: "page-1", name: "CCPun", access_token: "page-token", instagram_business_account: { id: "ig-1", username: "ccpun" },
    }] }));
    if (url.includes("/published_posts")) return new Response(JSON.stringify({ data: [{
      id: "fb-1", message: "FB", status_type: "added_photos", created_time: "2026-09-01T10:00:00+0000",
      reactions: { summary: { total_count: 15 } }, comments: { summary: { total_count: 3 } }, shares: { count: 2 },
    }] }));
    if (url.includes("/ig-1/media")) return new Response(JSON.stringify({ data: [
      { id: "ig-image", caption: "Image", media_type: "IMAGE", timestamp: "2026-08-05T10:00:00+0000", like_count: 20, comments_count: 4 },
      { id: "ig-video", caption: "Video", media_type: "VIDEO", media_product_type: "REELS", timestamp: "2026-08-04T10:00:00+0000", like_count: 30, comments_count: 5 },
    ] }));
    if (url.includes("/fb-1/insights")) return new Response(JSON.stringify({ data: [
      { name: "post_media_view", values: [{ value: 500 }] },
      { name: "post_clicks", values: [{ value: 12 }] },
      { name: "post_reactions_by_type_total", values: [{ value: { like: 10, love: 3, care: 1, wow: 1, haha: 0, sorry: 0, anger: 0 } }] },
    ] }));
    if (url.includes("/ig-image/insights")) return new Response(JSON.stringify({ data: [
      { name: "views", values: [{ value: 1000 }] }, { name: "reach", values: [{ value: 800 }] },
      { name: "saved", values: [{ value: 40 }] }, { name: "shares", values: [{ value: 20 }] },
      { name: "total_interactions", values: [{ value: 120 }] },
    ] }));
    if (url.includes("/ig-video/insights")) return new Response(JSON.stringify({ data: [
      { name: "views", values: [{ value: 2000 }] }, { name: "reach", values: [{ value: 1500 }] },
      { name: "saved", values: [{ value: 80 }] }, { name: "shares", values: [{ value: 50 }] },
      { name: "total_interactions", values: [{ value: 240 }] },
      { name: "ig_reels_video_view_total_time", values: [{ value: 450000 }] },
      { name: "ig_reels_avg_watch_time", values: [{ value: 8500 }] },
    ] }));
    throw new Error(`Unexpected request ${url}`);
  }, { since: "2026-08-19T00:00:00.000Z", includeInsights: true, insightsBackfillLimit: 25 });

  assert.equal(result.insightsCollected, true);
  assert.equal(result.insightBackfillLimit, 25);
  assert.equal(result.facebookPosts.length, 1);
  assert.deepEqual(result.facebookPosts[0]?.metrics, {
    likes: 15, comments: 3, shares: 2, views: 500, clicks: 12,
    reactionLike: 10, reactionLove: 3, reactionCare: 1, reactionWow: 1,
    reactionHaha: 0, reactionSad: 0, reactionAngry: 0,
  });
  assert.equal(result.instagramMedia.length, 2);
  assert.equal(result.instagramMedia.find((item) => item.id === "ig-image")?.metrics.reach, 800);
  assert.equal(result.instagramMedia.find((item) => item.id === "ig-image")?.metrics.saves, 40);
  assert.equal(result.instagramMedia.find((item) => item.id === "ig-video")?.metrics.reelTotalWatchTimeMs, 450000);
  assert.equal(result.instagramMedia.find((item) => item.id === "ig-video")?.metrics.reelAverageWatchTimeMs, 8500);
  assert.equal(requests.filter((item) => item.url.includes("/insights")).length, 3);
  assert.equal(requests.filter((item) => item.url.includes("/insights")).every((item) => item.auth === "Bearer page-token"), true);
  assert.equal(requests.every((item) => !item.url.includes("page-token") && !item.url.includes("meta-system-token")), true);

  const normalized = normalizeMetaAnalytics({ publicationId: "provider-content:test", platform: "instagram", fetchedAt: "2026-09-02T10:00:00.000Z", metrics: result.instagramMedia.find((item) => item.id === "ig-video")!.metrics });
  assert.deepEqual(normalized.nativeMetrics.map((metric) => [metric.key, metric.unit]), [
    ["instagram.views", "count"], ["instagram.reach", "count"], ["instagram.likes", "count"], ["instagram.comments", "count"],
    ["instagram.shares", "count"], ["instagram.saves", "count"], ["instagram.total_interactions", "count"],
    ["instagram.ig_reels_video_view_total_time", "milliseconds"], ["instagram.ig_reels_avg_watch_time", "milliseconds"],
  ]);
});

test("Analytics ingestion keeps P1 Insights bounded while historical Meta metadata refresh is batched", () => {
  const source = read("lib/admin/social/analytics-ingestion.ts");
  assert.match(source, /insightsBackfillLimit: metaPolicy\.insightsBackfillLimit/);
  assert.match(source, /fetchMetaContentMetadataByIds/);
  assert.match(source, /metadataRefreshBatchSize/);
  assert.match(source, /metadataRefreshDays/);
  assert.match(source, /published_at < \$1::timestamptz/);
  assert.match(source, /GREATEST\(last_seen_at,updated_at\) < now\(\) - \(\$2::int \* interval '1 day'\)/);
  assert.match(source, /metadataRefreshUnavailableTargets\.map[\s\S]*SET updated_at=now\(\)/);
  assert.match(source, /providerMetricContents: recentProviderContents/);
  assert.match(source, /matched: matchMetaHistoricalAnalytics\(refs, discovery\)/);
  assert.match(source, /providerMetricContents\.map/);
  assert.match(source, /function transientThumbnailIdentity[\s\S]*new URL\(value\)\.pathname/);
  assert.match(source, /transientThumbnailIdentity\(content\.thumbnailUrl\)/);
  assert.doesNotMatch(source, /fetchMetaReadOnlyDiscovery\(env, fetcher, \{ since: null, includeInsights: false \}\)/);
  assert.doesNotMatch(read("app/api/admin/social/providers/meta/discovery/route.ts"), /includeInsights/);
});

test("Metric schemas preserve Reel watch-time native milliseconds", () => {
  for (const source of [
    read("lib/admin/social/operations.ts"),
    read("lib/admin/social/analytics-ingestion.ts"),
    read("lib/admin/social/sheets-export.ts"),
  ]) assert.match(source, /"milliseconds"/);
  assert.match(read("lib/admin/social/provider-adapters.ts"), /ig_reels_video_view_total_time[\s\S]*"milliseconds"/);
});
