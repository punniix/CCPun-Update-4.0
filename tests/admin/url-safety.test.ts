import assert from "node:assert/strict";
import test from "node:test";
import {
  getArticleCanonical,
  getArticlePath,
  getArticlePreviewPath,
  getArticleSourceSlugForRoute,
  getLegacyCategoryRedirectPath,
  getMovedArticleRedirectPath,
  isArticleCanonicalAligned,
} from "../../lib/content/url";

test("health insurance and critical illness are reviewed physical URL categories", () => {
  const health = { slug: "example", category: "ประกันสุขภาพ", categorySlug: "health-insurance" };
  assert.equal(getArticlePath(health), "/blog/health-insurance/example/");
  assert.equal(getArticleCanonical(health), "https://ccpun.com/blog/health-insurance/example/");
  assert.equal(isArticleCanonicalAligned(health), true);

  const critical = { slug: "example", category: "ประกันโรคร้ายแรง", categorySlug: "critical-illness" };
  assert.equal(getArticlePath(critical), "/blog/critical-illness-insurance/example/");
  assert.equal(getArticleCanonical(critical), "https://ccpun.com/blog/critical-illness-insurance/example/");
  assert.equal(isArticleCanonicalAligned(critical), true);
});

test("motor insurance uses its referenced Sanity category slug without a code allowlist", () => {
  const motor = { slug: "car-insurance-types", category: "ประกันรถยนต์", categorySlug: "motor-insurance" };
  assert.equal(getArticlePath(motor), "/blog/motor-insurance/car-insurance-types/");
  assert.equal(getArticleCanonical(motor), "https://ccpun.com/blog/motor-insurance/car-insurance-types/");
  assert.equal(isArticleCanonicalAligned(motor), true);
  assert.equal(getArticlePath({ ...motor, category: "Updated display title" }), "/blog/motor-insurance/car-insurance-types/");
});

test("protected health winner pages resolve to Health even while published Sanity references are still Life", () => {
  for (const slug of ["aia-health-happy-describe", "aia-health-ci-hero-guide"]) {
    const article = { slug, category: "ประกันชีวิต", categorySlug: "life-insurance" };
    assert.equal(getArticlePath(article), `/blog/health-insurance/${slug}/`);
    assert.equal(getArticleCanonical(article), `https://ccpun.com/blog/health-insurance/${slug}/`);
    assert.equal(isArticleCanonicalAligned(article), true);
  }
});

test("critical illness public owner can move without publishing the unrelated Sanity draft", () => {
  const article = {
    slug: "critical-illness-insurance",
    category: "ประกันชีวิต",
    categorySlug: "life-insurance",
    canonical: "https://ccpun.com/blog/life-insurance/critical-illness-insurance/",
  };
  const final = "/blog/critical-illness-insurance/what-is-critical-illness-insurance/";
  assert.equal(getArticlePath(article), final);
  assert.equal(getArticleCanonical(article), `https://ccpun.com${final}`);
  assert.equal(isArticleCanonicalAligned(article), true);
  assert.equal(getArticleSourceSlugForRoute("what-is-critical-illness-insurance"), "critical-illness-insurance");
  assert.equal(getArticleSourceSlugForRoute("aia-vitality"), "aia-vitality");
});

test("controlled article moves are locked to one-hop final paths", () => {
  const finalCritical = "/blog/critical-illness-insurance/what-is-critical-illness-insurance/";
  assert.equal(getMovedArticleRedirectPath("life-insurance", "aia-health-happy-describe"), "/blog/health-insurance/aia-health-happy-describe/");
  assert.equal(getMovedArticleRedirectPath("life-insurance", "aia-health-ci-hero-guide"), "/blog/health-insurance/aia-health-ci-hero-guide/");
  assert.equal(getMovedArticleRedirectPath("health-insurance", "aia-health-happy-describe"), null);
  assert.equal(getMovedArticleRedirectPath("health-insurance", "aia-health-ci-hero-guide"), null);
  assert.equal(getMovedArticleRedirectPath("life-insurance", "critical-illness-insurance"), finalCritical);
  assert.equal(getMovedArticleRedirectPath("critical-illness", "critical-illness-insurance"), finalCritical);
  assert.equal(getMovedArticleRedirectPath("critical-illness-insurance", "critical-illness-insurance"), finalCritical);
  assert.equal(getMovedArticleRedirectPath("critical-illness-insurance", "what-is-critical-illness-insurance"), null);
  assert.equal(getMovedArticleRedirectPath("life-insurance", "aia-vitality"), null);
});

test("legacy category landing paths redirect without colliding with final category owners", () => {
  assert.equal(getLegacyCategoryRedirectPath("health-insurance"), "/blog/?tag=%E0%B8%9B%E0%B8%A3%E0%B8%B0%E0%B8%81%E0%B8%B1%E0%B8%99%E0%B8%AA%E0%B8%B8%E0%B8%82%E0%B8%A0%E0%B8%B2%E0%B8%9E");
  assert.equal(getLegacyCategoryRedirectPath("critical-illness"), "/blog/critical-illness-insurance/");
  assert.equal(getLegacyCategoryRedirectPath("critical-illness-insurance"), null);
});

test("protected health canonical ignores the old Life canonical during the transition", () => {
  const protectedHealth = {
    slug: "aia-health-ci-hero-guide",
    category: "ประกันชีวิต",
    categorySlug: "life-insurance",
    canonical: "https://ccpun.com/blog/life-insurance/aia-health-ci-hero-guide/",
  };
  assert.equal(getArticleCanonical(protectedHealth), "https://ccpun.com/blog/health-insurance/aia-health-ci-hero-guide/");
  assert.equal(isArticleCanonicalAligned(protectedHealth), true);
});

test("an explicit stale or decorated canonical fails the release alignment check for non-protected articles", () => {
  const base = { slug: "example", category: "ประกันชีวิต", categorySlug: "life-insurance" };
  assert.equal(isArticleCanonicalAligned({ ...base, canonical: "https://ccpun.com/blog/health-insurance/example/" }), false);
  assert.equal(isArticleCanonicalAligned({ ...base, canonical: "https://ccpun.com/blog/life-insurance/example/?ref=old" }), false);
  assert.equal(isArticleCanonicalAligned({ ...base, canonical: "https://ccpun.com/blog/life-insurance/example/" }), true);
});

test("dynamic registry category slugs are accepted while known title/slug conflicts still fail closed", () => {
  assert.equal(
    getArticlePath({ slug: "example", category: "ประกันเดินทาง", categorySlug: "travel-insurance" }),
    "/blog/travel-insurance/example/",
  );
  assert.throws(
    () => getArticlePath({ slug: "example", category: "ประกันสุขภาพ", categorySlug: "personal-finance" }),
    /Unsupported article category/,
  );
});

test("draft preview uses the same safe category slug contract while public exposure is enforced by provider/registry state", () => {
  const draftOnly = { slug: "travel-insurance-draft", category: "ประกันเดินทาง", categorySlug: "travel-insurance" };
  assert.equal(getArticlePreviewPath(draftOnly), "/blog/travel-insurance/travel-insurance-draft/");
  assert.equal(getArticlePath(draftOnly), "/blog/travel-insurance/travel-insurance-draft/");
  assert.throws(
    () => getArticlePreviewPath({ slug: "bad", category: "Unknown", categorySlug: "../admin" }),
    /Unsupported article preview category/,
  );
  assert.throws(
    () => getArticlePath({ slug: "bad", category: "Unknown", categorySlug: "../admin" }),
    /Unsupported article category/,
  );
});
