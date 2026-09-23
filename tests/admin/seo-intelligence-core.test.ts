import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CCPUN_VERCEL_PROJECT_IDS } from "../../lib/admin/environment";
import {
  ga4QueryInputSchema,
  gscQueryInputSchema,
  joinGa4DashboardRows,
  joinGscDashboardRows,
  normalizeGa4LandingPageReport,
  normalizeGa4OrganicTotalsReport,
  normalizeGscSearchAnalyticsPage,
  normalizeGscSearchAnalyticsTotals,
  previousEqualDateRange,
} from "../../lib/admin/seo-intelligence/contracts";
import { assembleGscObservations, buildGscObservationContexts } from "../../lib/admin/seo-intelligence/gsc-observations";
import {
  detectSeoOpportunities,
  getSyntheticSeoIntelligenceSnapshot,
  isBrandedQuery,
  isSeoIntelligenceEnabled,
  SYNTHETIC_SEO_OBSERVATIONS,
  WEBSITE_42_GOOGLE_PROVIDER_BRANCH,
  WEBSITE_42_SEO_PRODUCTION_BRANCH,
  WEBSITE_42_SEO_PRODUCTION_SANITY_DATASET,
  WEBSITE_42_SEO_PRODUCTION_SANITY_PROJECT_ID,
  WEBSITE_42_SEO_BRANCH,
  WEBSITE_42_SEO_SANITY_DATASET,
  WEBSITE_42_SEO_SANITY_PROJECT_ID,
} from "../../lib/admin/seo-intelligence/foundation";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const enabledInput = {
  flag: "1",
  environment: "admin-uat" as const,
  vercelEnvironment: "preview",
  projectId: CCPUN_VERCEL_PROJECT_IDS.adminProduction,
  productionAdminProjectId: undefined,
  gitBranch: WEBSITE_42_SEO_BRANCH,
  sanityProjectId: WEBSITE_42_SEO_SANITY_PROJECT_ID,
  sanityDataset: WEBSITE_42_SEO_SANITY_DATASET,
};

test("SEO Intelligence retains exact Admin UAT branches and adds only the exact Production lane", () => {
  assert.equal(isSeoIntelligenceEnabled(enabledInput), true);
  assert.equal(isSeoIntelligenceEnabled({ ...enabledInput, gitBranch: WEBSITE_42_GOOGLE_PROVIDER_BRANCH }), true);
  for (const change of [
    { flag: "true" },
    { environment: "production-admin" as const },
    { projectId: CCPUN_VERCEL_PROJECT_IDS.web },
    { gitBranch: "v4-production" },
    { gitBranch: "codex/unapproved-preview" },
    { sanityProjectId: "kyfxgjnq" },
    { sanityDataset: "production" },
  ]) assert.equal(isSeoIntelligenceEnabled({ ...enabledInput, ...change }), false, JSON.stringify(change));

  const productionInput = {
    flag: "1",
    environment: "production-admin" as const,
    vercelEnvironment: "production",
    projectId: CCPUN_VERCEL_PROJECT_IDS.adminProduction,
    productionAdminProjectId: CCPUN_VERCEL_PROJECT_IDS.adminProduction,
    gitBranch: WEBSITE_42_SEO_PRODUCTION_BRANCH,
    sanityProjectId: WEBSITE_42_SEO_PRODUCTION_SANITY_PROJECT_ID,
    sanityDataset: WEBSITE_42_SEO_PRODUCTION_SANITY_DATASET,
  };
  assert.equal(isSeoIntelligenceEnabled(productionInput), true);
  for (const change of [
    { flag: "true" },
    { environment: "admin-uat" as const },
    { vercelEnvironment: "preview" },
    { vercelEnvironment: undefined },
    { projectId: CCPUN_VERCEL_PROJECT_IDS.web },
    { productionAdminProjectId: CCPUN_VERCEL_PROJECT_IDS.web },
    { productionAdminProjectId: undefined },
    { gitBranch: WEBSITE_42_GOOGLE_PROVIDER_BRANCH },
    { sanityProjectId: WEBSITE_42_SEO_SANITY_PROJECT_ID },
    { sanityDataset: WEBSITE_42_SEO_SANITY_DATASET },
  ]) assert.equal(isSeoIntelligenceEnabled({ ...productionInput, ...change }), false, JSON.stringify(change));
});

test("Four deterministic detectors find intended fixtures and suppress known false positives", () => {
  const opportunities = detectSeoOpportunities(SYNTHETIC_SEO_OBSERVATIONS);
  assert.equal(opportunities.length, 4);
  assert.deepEqual(new Set(opportunities.map((item) => item.type)), new Set(["ctr-underperformance", "position-4-15", "content-decay", "cannibalization"]));
  assert.equal(opportunities.filter((item) => item.type === "cannibalization").length, 1);
  assert.equal(opportunities.find((item) => item.type === "cannibalization")?.affectedPages.length, 2);
  for (const suppressedId of ["position-18", "recent-change", "seasonal-tax", "brand"]) {
    assert.equal(opportunities.some((item) => item.id.endsWith(`:${suppressedId}`)), false, suppressedId);
  }
  assert.equal(isBrandedQuery("CC Pun ที่ปรึกษาการเงิน"), true);
  assert.equal(isBrandedQuery("วางแผนเกษียณ"), false);
});

test("Priority is explainable, bounded and synthetic limitations are explicit", () => {
  const snapshot = getSyntheticSeoIntelligenceSnapshot();
  assert.equal(snapshot.mode, "synthetic-uat");
  assert.ok(snapshot.opportunities.length >= 4);
  for (const opportunity of snapshot.opportunities) {
    assert.ok(opportunity.priority >= 0 && opportunity.priority <= 100);
    assert.equal(Object.keys(opportunity.priorityComponents).length, 5);
    assert.ok(opportunity.protectedFields.includes("publish"));
    assert.ok(opportunity.evidence.length >= 3);
  }
  assert.match(snapshot.limitations.join(" "), /ไม่ใช่ตัวเลขของ ccpun\.com/);
});

test("GSC normalization follows requested dimension order and rejects malformed provider rows", () => {
  const rows = normalizeGscSearchAnalyticsPage({ rows: [{
    keys: ["ประกันสุขภาพ", "https://ccpun.com/blog/health-insurance/example/", "MOBILE", "tha"],
    clicks: 12,
    impressions: 600,
    ctr: 0.02,
    position: 7.5,
  }] }, ["query", "page", "device", "country"]);
  assert.deepEqual(rows[0]?.dimensions, {
    query: "ประกันสุขภาพ",
    page: "https://ccpun.com/blog/health-insurance/example/",
    device: "MOBILE",
    country: "tha",
  });
  assert.equal(gscQueryInputSchema.safeParse({ siteUrl: "sc-domain:ccpun.com", token: "fixture", startDate: "2026-08-28", endDate: "2026-08-01", dimensions: ["query"] }).success, false);
  assert.equal(gscQueryInputSchema.safeParse({ siteUrl: "sc-domain:ccpun.com", token: "fixture", startDate: "2026-02-30", endDate: "2026-03-01", dimensions: ["query"] }).success, false);
  assert.deepEqual(previousEqualDateRange("2026-08-01", "2026-08-28"), { startDate: "2026-07-04", endDate: "2026-07-31" });
  assert.throws(() => normalizeGscSearchAnalyticsPage({ rows: [{ keys: ["only-one"], clicks: 1, impressions: 10, ctr: 0.1, position: 2 }] }, ["query", "page"]), /GSC_DIMENSION_MISMATCH/);
});

test("GSC dashboard uses no-dimension totals and exact query/page joins", () => {
  assert.deepEqual(normalizeGscSearchAnalyticsTotals({ rows: [{ clicks: 20, impressions: 500, ctr: 0.99, position: 6.5 }] }), {
    clicks: 20,
    impressions: 500,
    ctr: 0.04,
    position: 6.5,
  });
  assert.deepEqual(normalizeGscSearchAnalyticsTotals({ rows: [] }), { clicks: 0, impressions: 0, ctr: 0, position: null });
  const current = normalizeGscSearchAnalyticsPage({ rows: [{ keys: ["query", "/page/"], clicks: 10, impressions: 200, ctr: 0.05, position: 7 }] }, ["query", "page"]);
  const exactPrevious = normalizeGscSearchAnalyticsPage({ rows: [{ keys: ["query", "/page/"], clicks: 8, impressions: 160, ctr: 0.05, position: 8 }] }, ["query", "page"]);
  const nearPrevious = normalizeGscSearchAnalyticsPage({ rows: [{ keys: ["Query", "/page/"], clicks: 99, impressions: 999, ctr: 0.1, position: 1 }] }, ["query", "page"]);
  assert.equal(joinGscDashboardRows(current, exactPrevious)[0]?.previous?.clicks, 8);
  assert.equal(joinGscDashboardRows(current, nearPrevious)[0]?.previous, null);
  assert.throws(() => normalizeGscSearchAnalyticsTotals({ rows: [{ clicks: -1, impressions: 1, ctr: 0, position: 1 }] }));
});

test("GSC observation assembly joins exact current/previous dimensions and preserves provenance", () => {
  const currentRows = normalizeGscSearchAnalyticsPage({ rows: [{
    keys: ["ประกันสุขภาพ", "https://ccpun.com/blog/health-insurance/example/", "MOBILE", "tha"],
    clicks: 12,
    impressions: 600,
    ctr: 0.02,
    position: 7.5,
  }] }, ["query", "page", "device", "country"]);
  const previousRows = normalizeGscSearchAnalyticsPage({ rows: [{
    keys: ["ประกันสุขภาพ", "https://ccpun.com/blog/health-insurance/example/", "MOBILE", "tha"],
    clicks: 20,
    impressions: 900,
    ctr: 0.031,
    position: 5,
  }] }, ["query", "page", "device", "country"]);
  const result = assembleGscObservations({
    currentRows,
    previousRows,
    contexts: [{
      id: "fixture-exact",
      page: "https://ccpun.com/blog/health-insurance/example/",
      query: "ประกันสุขภาพ",
      device: "mobile",
      country: "tha",
      queryCluster: "ประกันสุขภาพ",
      searchIntent: "informational",
      intentAligned: true,
      indexable: true,
      businessValue: 4,
      lastRelevantContentChangeAt: "2026-05-01T00:00:00.000Z",
      seasonality: "none",
    }],
    fetchedAt: "2026-08-29T00:00:00.000Z",
    comparisonFetchedAt: "2026-08-29T00:00:01.000Z",
    dateRange: { start: "2026-08-01", end: "2026-08-28" },
    comparisonDateRange: { start: "2026-07-04", end: "2026-07-31" },
    currentLimitations: ["GSC may omit anonymized queries."],
  });

  assert.equal(result.skipped.length, 0);
  assert.equal(result.observations[0]?.country, "tha");
  assert.deepEqual(result.observations[0]?.previous, { clicks: 20, impressions: 900, position: 5 });
  assert.deepEqual(result.observations[0]?.comparisonDateRange, { start: "2026-07-04", end: "2026-07-31" });
  assert.equal(result.observations[0]?.comparisonFetchedAt, "2026-08-29T00:00:01.000Z");
  assert.deepEqual(detectSeoOpportunities(result.observations).map((item) => item.type), ["content-decay"]);
});

test("GSC observation assembly fails closed instead of guessing URL or editorial context", () => {
  const currentRows = normalizeGscSearchAnalyticsPage({ rows: [
    { keys: ["ประกันสุขภาพ", "https://ccpun.com/exact/", "MOBILE", "tha"], clicks: 1, impressions: 600, ctr: 0.002, position: 5 },
    { keys: ["ไม่มี context", "https://ccpun.com/missing/", "DESKTOP", "tha"], clicks: 1, impressions: 600, ctr: 0.002, position: 5 },
  ] }, ["query", "page", "device", "country"]);
  const result = assembleGscObservations({
    currentRows,
    previousRows: [],
    contexts: [{
      id: "wrong-url-shape",
      page: "/exact/",
      query: "ประกันสุขภาพ",
      device: "mobile",
      country: "tha",
      queryCluster: "ประกันสุขภาพ",
      searchIntent: "informational",
      intentAligned: true,
      indexable: true,
      businessValue: 4,
      lastRelevantContentChangeAt: "2026-05-01T00:00:00.000Z",
      seasonality: "none",
    }],
    fetchedAt: "2026-08-29T00:00:00.000Z",
    comparisonFetchedAt: "2026-08-29T00:00:01.000Z",
    dateRange: { start: "2026-08-01", end: "2026-08-28" },
    comparisonDateRange: { start: "2026-07-04", end: "2026-07-31" },
  });

  assert.equal(result.observations.length, 0);
  assert.deepEqual(result.skipped.map((item) => item.reason), ["missing-context", "missing-context"]);
  assert.throws(() => assembleGscObservations({ currentRows: [], previousRows: [], contexts: [], fetchedAt: "2026-08-29", comparisonFetchedAt: "2026-08-29T00:00:01.000Z", dateRange: { start: "2026-02-30", end: "2026-03-01" }, comparisonDateRange: { start: "2026-01-31", end: "2026-02-27" } }), /GSC_OBSERVATION_INVALID_PROVENANCE/);
});

test("GSC editorial context accepts only exact governed keywords and canonical article URLs", () => {
  const rows = normalizeGscSearchAnalyticsPage({ rows: [
    { keys: ["ประกันสุขภาพ", "https://ccpun.com/blog/health-insurance/example/", "MOBILE", "tha"], clicks: 1, impressions: 600, ctr: 0.002, position: 5 },
    { keys: ["คำที่ไม่ได้กำกับ", "https://ccpun.com/blog/health-insurance/example/", "MOBILE", "tha"], clicks: 1, impressions: 600, ctr: 0.002, position: 5 },
  ] }, ["query", "page", "device", "country"]);
  const contexts = buildGscObservationContexts(rows, [{
    id: "article-1",
    slug: "example",
    category: "ประกันสุขภาพ",
    categorySlug: "health-insurance",
    focusKeyword: "ประกันสุขภาพ",
    secondaryKeywords: [],
    searchIntent: "informational",
    noindex: false,
    publishedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
  }]);
  assert.equal(contexts.length, 1);
  assert.equal(contexts[0]?.page, "https://ccpun.com/blog/health-insurance/example/");
  assert.equal(contexts[0]?.businessValue, 3);
  assert.equal(contexts[0]?.seasonality, "unknown");
});

test("GSC provider is server-only, paginated, bounded and never logs credentials", () => {
  const provider = read("lib/admin/seo-intelligence/providers/gsc.ts");
  assert.match(provider, /import "server-only"/);
  assert.match(provider, /const MAX_PAGES = 2/);
  assert.match(provider, /rowLimit: input\.rowLimit/);
  assert.match(provider, /startRow: page \* input\.rowLimit/);
  assert.match(provider, /AbortSignal\.timeout\(TIMEOUT_MS\)/);
  assert.match(provider, /response\.status === 429/);
  assert.match(provider, /GSC_AUTH_REQUIRED/);
  assert.match(provider, /GSC_TIMEOUT/);
  assert.match(provider, /fetchGscSearchAnalyticsTotals/);
  assert.match(provider, /rowLimit: 1/);
  assert.match(provider, /normalizeGscSearchAnalyticsTotals/);
  assert.doesNotMatch(provider, /console\./);
});

test("GSC manual sync is human-only, exact-origin, bounded and read-only", () => {
  const route = read("app/api/admin/seo/opportunities/sync/gsc/route.ts");
  const control = read("features/admin/seo/opportunities/GscManualSync.tsx");
  assert.match(route, /identity\.actorType !== "human"/);
  assert.match(route, /research:provider-query/);
  assert.match(route, /isConfiguredAdminOrigin/);
  assert.match(route, /isSameOriginAdminMutation/);
  assert.match(route, /getSeoIntelligenceRuntimeStatus\(\)\.enabled/);
  assert.match(route, /fetchGscSearchAnalyticsTotals/);
  assert.match(route, /joinGscDashboardRows/);
  assert.match(route, /dimensions = \["query", "page"\]/);
  assert.doesNotMatch(route, /assembleGscObservations|detectSeoOpportunities|listPublishedSeoObservationArticles/);
  assert.match(route, /provider-auth-required/);
  assert.match(route, /provider-rate-limited/);
  assert.match(route, /provider-timeout/);
  assert.match(route, /provider-invalid-response/);
  assert.match(route, /getGoogleDataAccessToken/);
  assert.match(route, /CCPUN_GSC_SITE_URL/);
  assert.match(route, /export async function POST\(request: Request\)/);
  assert.doesNotMatch(route, /export async function (?:GET|PUT|PATCH|DELETE)/);
  assert.doesNotMatch(route, /createClient|\.(?:mutate|create|patch|delete)\(|console\./i);
  assert.match(control, /type="date"/);
  assert.match(control, /กำลังดึงข้อมูล/);
  assert.match(control, /role="alert"/);
  assert.match(control, /ไม่เก็บสำเนาถาวร/);
  assert.match(control, /ดึงข้อมูลล่าสุดเมื่อ/);
  assert.match(control, /result\.current\.clicks/);
  assert.match(control, /result\.comparison\?\.clicks/);
  assert.match(control, /result\?\.rows\.slice\(0, 10\)/);
  assert.doesNotMatch(control, /totalRows|comparisonRows|observationCount|skippedRows|opportunityCount/);
});

test("GA4 landing-page normalization derives engagement and exposes report limitations", () => {
  const report = normalizeGa4LandingPageReport({
    dimensionHeaders: [{ name: "landingPage" }],
    metricHeaders: [{ name: "sessions" }, { name: "engagedSessions" }],
    rows: [
      { dimensionValues: [{ value: "/blog/example/" }], metricValues: [{ value: "20" }, { value: "8" }] },
      { dimensionValues: [{ value: "(not set)" }], metricValues: [{ value: "3" }, { value: "1" }] },
      { dimensionValues: [{ value: "/zero/" }], metricValues: [{ value: "0" }, { value: "0" }] },
    ],
    rowCount: 3,
    metadata: { samplingMetadatas: [{}], subjectToThresholding: true, dataLossFromOtherRow: true, timeZone: "Asia/Bangkok" },
  });
  assert.equal(report.rows.length, 2);
  assert.equal(report.rows[0]?.engagementRate, 0.4);
  assert.equal(report.rows[1]?.engagementRate, 0);
  assert.equal(report.timeZone, "Asia/Bangkok");
  assert.equal(report.limitations.length, 3);
  assert.equal(ga4QueryInputSchema.safeParse({ propertyId: "not-a-number", token: "fixture", startDate: "2026-08-01", endDate: "2026-08-28" }).success, false);
  assert.throws(() => normalizeGa4LandingPageReport({ dimensionHeaders: [{ name: "landingPage" }], metricHeaders: [{ name: "sessions" }], rows: [] }), /GA4_HEADER_MISMATCH/);
  assert.throws(() => normalizeGa4LandingPageReport({ dimensionHeaders: [{ name: "landingPage" }], metricHeaders: [{ name: "sessions" }, { name: "engagedSessions" }], rows: [{ dimensionValues: [{ value: "/" }], metricValues: [{ value: "1" }, { value: "2" }] }] }), /GA4_VALUE_MISMATCH/);
});

test("GA4 dashboard uses Organic totals and exact landing-page joins", () => {
  const aggregate = normalizeGa4OrganicTotalsReport({
    metricHeaders: [{ name: "sessions" }, { name: "engagedSessions" }],
    rows: [{ metricValues: [{ value: "50" }, { value: "20" }] }],
    metadata: { timeZone: "Asia/Bangkok" },
  });
  assert.deepEqual(aggregate.totals, { sessions: 50, engagedSessions: 20, engagementRate: 0.4 });
  assert.equal(aggregate.timeZone, "Asia/Bangkok");
  assert.deepEqual(normalizeGa4OrganicTotalsReport({ metricHeaders: [{ name: "sessions" }, { name: "engagedSessions" }], rows: [] }).totals, { sessions: 0, engagedSessions: 0, engagementRate: 0 });
  assert.throws(() => normalizeGa4OrganicTotalsReport({ metricHeaders: [{ name: "sessions" }, { name: "engagedSessions" }], rows: [{ metricValues: [{ value: "1" }, { value: "2" }] }] }), /GA4_VALUE_MISMATCH/);
  const current = [{ landingPage: "/exact/", sessions: 10, engagedSessions: 4, engagementRate: 0.4 }];
  const previous = [{ landingPage: "/Exact/", sessions: 100, engagedSessions: 50, engagementRate: 0.5 }];
  assert.equal(joinGa4DashboardRows(current, previous)[0]?.previous, null);
});

test("GA4 provider requests bounded Organic Search landing outcomes without credential logging", () => {
  const provider = read("lib/admin/seo-intelligence/providers/ga4.ts");
  const contracts = read("lib/admin/seo-intelligence/contracts.ts");
  assert.match(provider, /import "server-only"/);
  assert.match(provider, /sessionDefaultChannelGroup/);
  assert.match(provider, /value: "Organic Search"/);
  assert.match(provider, /metrics: \[\{ name: "sessions" \}, \{ name: "engagedSessions" \}\]/);
  assert.match(contracts, /max\(10_000\)/);
  assert.match(provider, /AbortSignal\.timeout\(TIMEOUT_MS\)/);
  assert.match(provider, /returnPropertyQuota: true/);
  assert.match(provider, /fetchGa4OrganicTotals/);
  assert.match(provider, /normalizeGa4OrganicTotalsReport/);
  assert.doesNotMatch(provider, /console\.|eventCount|activeUsers|keyEvents/);
});

test("GA4 manual sync is human-only, exact-origin, branch-gated and read-only", () => {
  const route = read("app/api/admin/seo/opportunities/sync/ga4/route.ts");
  const control = read("features/admin/seo/opportunities/Ga4ManualSync.tsx");
  assert.match(route, /identity\.actorType !== "human"/);
  assert.match(route, /research:provider-query/);
  assert.match(route, /isConfiguredAdminOrigin/);
  assert.match(route, /isSameOriginAdminMutation/);
  assert.match(route, /getSeoIntelligenceRuntimeStatus\(\)\.enabled/);
  assert.match(route, /getGoogleDataAccessToken/);
  assert.match(route, /CCPUN_GA4_PROPERTY_ID/);
  assert.match(route, /fetchGa4OrganicTotals/);
  assert.match(route, /joinGa4DashboardRows/);
  assert.match(route, /state: comparison && comparisonTotals \? "ready" : "partial"/);
  assert.match(route, /export async function POST\(request: Request\)/);
  assert.doesNotMatch(route, /export async function (?:GET|PUT|PATCH|DELETE)/);
  assert.doesNotMatch(route, /createClient|sanity|mutate|publish|console\./i);
  assert.match(control, /type="date"/);
  assert.match(control, /ผู้เข้าชมจากผลค้นหา/);
  assert.match(control, /ไม่เก็บสำเนาถาวร/);
  assert.match(control, /ดึงข้อมูลล่าสุดเมื่อ/);
  assert.match(control, /result\.current\.sessions/);
  assert.match(control, /result\.comparison\?\.sessions/);
  assert.match(control, /result\?\.rows\.slice\(0, 10\)/);
  assert.doesNotMatch(control, /current\.rows|Landing Pages<\/div>/);
});

test("Organic Search page removes synthetic and operational telemetry", () => {
  const page = read("features/admin/seo/opportunities/page.tsx");
  const gscControl = read("features/admin/seo/opportunities/GscManualSync.tsx");
  const ga4Control = read("features/admin/seo/opportunities/Ga4ManualSync.tsx");
  assert.match(page, /ผลลัพธ์จากการค้นหาธรรมชาติ/);
  assert.match(page, /runtime\.environment === "production-admin" \? "ระบบจริง" : "UAT"/);
  assert.match(page, /laneLabel=\{laneLabel\}/);
  assert.doesNotMatch(page, /Performance UAT|READ-ONLY UAT/);
  assert.match(gscControl, /ยังไม่ได้เชื่อม Search Console สำหรับ \$\{laneLabel\}/);
  assert.match(ga4Control, /ยังไม่ได้เชื่อม GA4 สำหรับ \$\{laneLabel\}/);
  assert.doesNotMatch(page, /getSyntheticSeoIntelligenceSnapshot|Market provider states|snapshot\.opportunities|Observations/);
});

test("SEO opportunities API is authenticated, exact-origin and GET-only", () => {
  const route = read("app/api/admin/seo/opportunities/route.ts");
  const page = read("app/(control-plane)/seo/opportunities/page.tsx");
  assert.match(route, /getAdminIdentity\(\)/);
  assert.match(route, /hasAdminPermission\(identity\.role, "seo:read"\)/);
  assert.match(route, /isConfiguredAdminOrigin\(request\.url, process\.env\.AUTH_URL\)/);
  assert.match(route, /export async function GET\(request: Request\)/);
  assert.doesNotMatch(route, /export async function (?:POST|PUT|PATCH|DELETE)/);
  assert.doesNotMatch(route, /createClient|fetch\(|publish|mutate/);
  assert.equal(page.trim(), 'export { metadata, default } from "@/features/admin/seo/opportunities/page";');
});
