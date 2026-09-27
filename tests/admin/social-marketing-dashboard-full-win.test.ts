import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildInsights,
  buildMarketingCsv,
  buildWinners,
  filterMarketingPosts,
  goalMetric,
  median,
  percentile,
  qualityBucket,
  type MarketingFilters,
  type MarketingPost,
} from "../../lib/admin/social/marketing-dashboard-model";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

function post(overrides: Partial<MarketingPost> = {}): MarketingPost {
  return {
    contentId: "content-default",
    publicationId: null,
    provider: "meta",
    platform: "facebook",
    providerObjectId: "provider-default",
    permalink: "https://www.facebook.com/example",
    thumbnail: null,
    text: "ตัวอย่างคอนเทนต์",
    providerMediaType: "mobile_status_update",
    formatStandard: "text",
    publishedAtUtc: "2026-08-25T10:00:00.000Z",
    publishedAtBkk: "2026-08-25 17:00:00",
    publishDateBkk: "2026-08-25",
    publishDayOfWeek: 2,
    publishHourBkk: 17,
    snapshotAt: "2026-09-02T10:00:00.000Z",
    postAgeHours: 190,
    metricWindow: "latest",
    reactionsTotal: 20,
    likes: null,
    commentsTotal: 4,
    shares: 2,
    saves: null,
    reach: null,
    impressions: null,
    views: 200,
    clicks: 20,
    totalInteractions: null,
    reactionLike: 18,
    reactionLove: 2,
    reactionCare: null,
    reactionWow: null,
    reactionHaha: null,
    reactionSad: null,
    reactionAngry: null,
    reelTotalWatchTimeMs: null,
    reelAverageWatchTimeMs: null,
    knownEngagementTotal: 26,
    knownDeepEngagementTotal: 6,
    knownEngagementRateByReach: null,
    knownDeepEngagementRateByReach: null,
    clicksPerView: 0.1,
    expectedCoreMetricCount: 5,
    availableCoreMetricCount: 5,
    metricCoverageRate: 1,
    engagementComponentsComplete: true,
    commentAttributionStatus: "not_collected",
    facebookShareQualityStatus: "unreviewed",
    facebookShareQualityNote: null,
    facebookReactionDefinitionStatus: "observed_consistent",
    instagramInteractionDefinitionStatus: "not_applicable",
    dataQualityStatus: "usable_with_limitations",
    analysisStatus: "exposure_ready_without_reach",
    ...overrides,
  };
}

function instagramPost(overrides: Partial<MarketingPost> = {}): MarketingPost {
  return post({
    contentId: "ig-default",
    platform: "instagram",
    providerObjectId: "ig-provider-default",
    permalink: "https://www.instagram.com/p/example/",
    providerMediaType: "IMAGE",
    formatStandard: "image",
    reactionsTotal: null,
    likes: 20,
    commentsTotal: 3,
    shares: 4,
    saves: 2,
    reach: 200,
    views: 240,
    clicks: null,
    totalInteractions: 29,
    reactionLike: null,
    reactionLove: null,
    knownEngagementTotal: 29,
    knownDeepEngagementTotal: 9,
    knownEngagementRateByReach: 0.145,
    knownDeepEngagementRateByReach: 0.045,
    clicksPerView: null,
    expectedCoreMetricCount: 7,
    availableCoreMetricCount: 7,
    metricCoverageRate: 1,
    facebookShareQualityStatus: null,
    facebookReactionDefinitionStatus: "not_applicable",
    instagramInteractionDefinitionStatus: "observed_consistent",
    analysisStatus: "exposure_normalized_with_comment_limit",
    ...overrides,
  });
}

test("marketing statistics use robust median and interpolated percentiles", () => {
  assert.equal(median([100, 1, 10]), 10);
  assert.equal(median([1, 3, 5, 7]), 4);
  assert.equal(percentile([0, 10, 20, 30, 40], 0.25), 10);
  assert.equal(percentile([0, 10, 20, 30, 40], 0.9), 36);
  assert.equal(median([]), null);
  assert.equal(percentile([], 0.5), null);
});

test("global filters apply period, platform, format, quality and search without mutating source posts", () => {
  const posts = [
    post({ contentId: "recent-fb", text: "ประกันสุขภาพ", publishedAtUtc: "2026-08-25T10:00:00.000Z" }),
    instagramPost({ contentId: "older-ig", text: "เกษียณ", publishedAtUtc: "2026-07-01T10:00:00.000Z" }),
    post({
      contentId: "review-fb",
      text: "AIA Vitality",
      formatStandard: "image",
      publishedAtUtc: "2026-08-20T10:00:00.000Z",
      dataQualityStatus: "needs_review",
      facebookShareQualityStatus: "needs_review",
    }),
  ];
  const reference = new Date("2026-09-02T10:00:00.000Z");
  const base: MarketingFilters = { period: "30d", platform: "all", format: "all", quality: "all", search: "" };
  assert.deepEqual(filterMarketingPosts(posts, base, reference).map((item) => item.contentId), ["recent-fb", "review-fb"]);
  assert.deepEqual(filterMarketingPosts(posts, { ...base, platform: "facebook", format: "image", quality: "needs_review" }, reference).map((item) => item.contentId), ["review-fb"]);
  assert.deepEqual(filterMarketingPosts(posts, { ...base, search: "vitality" }, reference).map((item) => item.contentId), ["review-fb"]);
  assert.equal(posts.length, 3);
});

test("goal metrics stay platform-specific and do not combine Facebook Reach with Instagram Clicks", () => {
  const facebook = post({ views: 400, clicks: 40, clicksPerView: 0.1, knownDeepEngagementTotal: 8 });
  const instagram = instagramPost({ reach: 250, saves: 5, shares: 10, knownDeepEngagementRateByReach: 0.06 });

  assert.deepEqual(goalMetric(facebook, "awareness"), { label: "จำนวนครั้งที่ดู", shortLabel: "ครั้งที่ดู", unit: "count", value: 400 });
  assert.deepEqual(goalMetric(facebook, "intent"), { label: "อัตราคลิกต่อการดู", shortLabel: "อัตราคลิก", unit: "percent", value: 0.1 });
  assert.deepEqual(goalMetric(facebook, "deep"), { label: "คอมเมนต์และแชร์", shortLabel: "คอมเมนต์และแชร์", unit: "count", value: 8 });
  assert.deepEqual(goalMetric(instagram, "awareness"), { label: "บัญชีที่เข้าถึง", shortLabel: "เข้าถึง", unit: "count", value: 250 });
  assert.deepEqual(goalMetric(instagram, "intent"), { label: "อัตราบันทึกและแชร์", shortLabel: "บันทึกและแชร์", unit: "percent", value: 0.06 });
  assert.deepEqual(goalMetric(instagram, "deep"), { label: "อัตราการมีส่วนร่วมเชิงลึก", shortLabel: "อัตราเชิงลึก", unit: "percent", value: 0.06 });
});

test("winner ranking compares within the same platform and format before raw magnitude", () => {
  const posts = [
    post({ contentId: "text-low", formatStandard: "text", views: 100 }),
    post({ contentId: "text-high", formatStandard: "text", views: 200 }),
    post({ contentId: "image-only", formatStandard: "image", views: 1_000 }),
    instagramPost({ contentId: "ig-separate", reach: 9_999 }),
  ];
  const winners = buildWinners(posts, "awareness", "facebook", 3);
  assert.equal(winners[0]?.post.contentId, "text-high");
  assert.equal(winners[0]?.percentile, 75);
  assert.equal(winners.find((item) => item.post.contentId === "image-only")?.cohortSize, 1);
  assert.equal(winners.some((item) => item.post.platform === "instagram"), false);
});

test("quality buckets retain provider truth and separate review from partial coverage", () => {
  assert.equal(qualityBucket(post()), "ready");
  assert.equal(qualityBucket(post({ dataQualityStatus: "needs_review" })), "needs_review");
  assert.equal(qualityBucket(post({ metricCoverageRate: 0.6, analysisStatus: "partial" })), "partial");
});

test("deterministic insights identify hidden gems and high-awareness low-intent posts", () => {
  const posts = [
    post({ contentId: "a", views: 1_000, clicksPerView: 0.01, knownDeepEngagementTotal: 1 }),
    post({ contentId: "b", views: 800, clicksPerView: 0.02, knownDeepEngagementTotal: 2 }),
    post({ contentId: "c", views: 100, clicksPerView: 0.2, knownDeepEngagementTotal: 50 }),
    post({ contentId: "d", views: 120, clicksPerView: 0.18, knownDeepEngagementTotal: 40 }),
  ];
  const ids = buildInsights(posts, "awareness").map((insight) => insight.id);
  assert.equal(ids.includes("facebook-high-awareness-low-intent"), true);
  assert.equal(ids.includes("facebook-hidden-gems"), true);
});

test("CSV export preserves zero, leaves unavailable metrics empty and neutralizes spreadsheet formulas", () => {
  const csv = buildMarketingCsv([post({ text: "=DANGER", reach: null, clicks: 0 })]);
  const [headerLine, dataLine] = csv.replace(/^\uFEFF/, "").split("\r\n");
  assert.ok(headerLine && dataLine);
  const headers = headerLine.split(",");
  const values = dataLine.split(",");
  assert.equal(values[headers.indexOf("text")], "'=DANGER");
  assert.equal(values[headers.indexOf("reach")], "");
  assert.equal(values[headers.indexOf("clicks")], "0");
  assert.equal(csv.includes("null"), false);
  assert.equal(csv.includes("undefined"), false);
});

test("server loader is pinned to the clean mart, exact migrations and read-only Social runtime", () => {
  const service = read("lib/admin/social/marketing-dashboard.ts");
  assert.match(service, /import "server-only"/);
  assert.match(service, /resolveSocialRuntime/);
  assert.match(service, /runtime\.neonIdentity/);
  assert.match(service, /20260902_social_marketing_mart_p2_full_backfill_clean/);
  assert.match(service, /20260902_social_marketing_mart_p2_metric_provenance/);
  assert.match(service, /FROM ccpun_social\.post_performance_clean/);
  assert.match(service, /FROM ccpun_social\.post_metric_coverage_summary/);
  assert.match(service, /WHERE provider='meta'/);
  assert.doesNotMatch(service, /\bINSERT\s+INTO\b|\bUPDATE\s+ccpun_social\.|\bDELETE\s+FROM\b|\bTRUNCATE\b|providerWriteAllowed:\s*true/i);
  assert.doesNotMatch(service, /sanity|access.?token|client.?secret|refresh.?token/i);
});

test("Marketing Dashboard Preview is branch-gated, read-only, and falls back to UAT raw rows without requiring the Production mart", () => {
  const service = read("lib/admin/social/marketing-dashboard.ts");
  const page = read("features/admin/social/analytics-page.tsx");
  assert.match(service, /SOCIAL_MARKETING_DASHBOARD_PREVIEW_BRANCH = "feat\/marketing-dashboard-full-win-20260902"/);
  assert.match(service, /uatBranches: \[WEBSITE_42_SOCIAL_ANALYTICS_BRANCH, SOCIAL_MARKETING_DASHBOARD_PREVIEW_BRANCH\]/);
  assert.match(service, /cleanMartRequired = runtime\.lane === "production"/);
  assert.match(service, /if \(runtime\.lane === "uat"\)/);
  assert.match(service, /fallbackPostsFromRaw/);
  assert.match(service, /sourceMode: "raw-fallback"/);
  assert.match(service, /safeProviderUrl/);
  assert.doesNotMatch(service, /providerWriteAllowed:\s*true|backgroundSyncAllowed:\s*true/);
  assert.match(page, /getSocialMarketingDashboardRuntimeStatus\(\)\.enabled/);
});

test("Marketing Dashboard keeps Raw Stats, non-dev export paths and explicit data-quality guidance", () => {
  const page = read("features/admin/social/analytics-page.tsx");
  const dashboard = read("features/admin/social/SocialMarketingDashboard.tsx");
  const visuals = read("features/admin/social/MarketingDashboardVisuals.tsx");
  const layout = read("apps/admin/app/(control-plane)/layout.tsx");

  assert.match(page, /view === "raw"/);
  assert.match(page, /getSocialMarketingDashboard/);
  assert.match(page, /fallbackPostsFromRaw/);
  assert.match(page, /โดยไม่ต้องเปิดฐานข้อมูลเอง/);
  for (const label of ["ภาพรวม", "คอนเทนต์", "เทียบกับกลุ่มเดียวกัน", "คุณภาพข้อมูล", "ดาวน์โหลด CSV", "สร้าง Google Sheets", "ข้อมูลต้นทาง"]) {
    assert.match(dashboard, new RegExp(label));
  }
  assert.match(dashboard, /ข้อมูลที่ขาดไม่เท่ากับศูนย์/);
  assert.match(dashboard, /ช่วงเวลาที่เลือกหมายถึง/);
  assert.match(dashboard, /เทียบกับโพสต์แบบเดียวกัน/);
  assert.match(dashboard, /เลือกได้สูงสุด 4 โพสต์/);
  assert.match(dashboard, /buildMarketingCsv/);
  assert.match(dashboard, /executiveSummary/);
  assert.match(visuals, /<svg/);
  assert.match(visuals, /useState<string \| null>\(null\)/);
  assert.match(visuals, /failedUrl === url/);
  assert.match(visuals, /onError=\{\(\) => setFailedUrl\(url\)\}/);
  assert.match(visuals, /key=\{url\}/);
  assert.doesNotMatch(dashboard + visuals, /recharts|chart\.js|echarts|highcharts|localStorage|sessionStorage/);
  assert.match(layout, /href: "\/analytics\/social\/", label: "ผลลัพธ์โซเชียล"/);
});


test("Raw metric selector disambiguates duplicate labels by platform and filters metrics with the selected platform", () => {
  const raw = read("features/admin/social/SocialStatsDashboard.tsx");
  assert.equal(raw.includes("platform: AnalyticsPlatform"), true);
  assert.equal(raw.includes("visibleMetrics = useMemo(() => platform === \"all\" ? metrics : metrics.filter"), true);
  assert.equal(raw.includes("platformLabel[metric.platform]"), true);
  assert.equal(raw.includes("selected.platform !== nextPlatform"), true);
});

test("Content explorer is one continuous mobile list and sortable by content, date, values, and coverage", () => {
  const dashboard = read("features/admin/social/SocialMarketingDashboard.tsx");
  for (const value of [
    'type ContentSort = "content" | "published" | "awareness" | "intent" | "deep" | "coverage"',
    "ตัวอักษร / เนื้อหา",
    "A → Z",
    "Z → A",
    "ใหม่ → เก่า",
    "เก่า → ใหม่",
    "มาก → น้อย",
    "น้อย → มาก",
    'SortHeader field="content"',
    'SortHeader field="published"',
    'SortHeader field="awareness"',
    'SortHeader field="intent"',
    'SortHeader field="deep"',
    'SortHeader field="coverage"',
    "รายการคอนเทนต์สำหรับวิเคราะห์บนมือถือ",
  ]) assert.equal(dashboard.includes(value), true, value);
  assert.equal(dashboard.includes("space-y-3 lg:hidden"), false);
});
