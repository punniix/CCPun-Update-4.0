import assert from "node:assert/strict";
import test from "node:test";
import {
  getArticleCanonical,
  getArticlePath,
  getArticlePreviewPath,
  getLegacyCategoryRedirectPath,
  getMovedArticleRedirectPath,
  isArticleCanonicalAligned,
} from "../../lib/content/url";

test("health insurance is a physical URL category while critical illness keeps the existing life path", () => {
  const health = { slug: "example", category: "ประกันสุขภาพ", categorySlug: "health-insurance" };
  assert.equal(getArticlePath(health), "/blog/health-insurance/example/");
  assert.equal(getArticleCanonical(health), "https://ccpun.com/blog/health-insurance/example/");
  assert.equal(isArticleCanonicalAligned(health), true);

  const critical = { slug: "example", category: "ประกันโรคร้ายแรง", categorySlug: "critical-illness" };
  assert.equal(getArticlePath(critical), "/blog/life-insurance/example/");
  assert.equal(getArticleCanonical(critical), "https://ccpun.com/blog/life-insurance/example/");
  assert.equal(isArticleCanonicalAligned(critical), true);
});

test("protected health winner pages resolve to Health even while published Sanity references are still Life", () => {
  for (const slug of ["aia-health-happy-describe", "aia-health-ci-hero-guide"]) {
    const article = { slug, category: "ประกันชีวิต", categorySlug: "life-insurance" };
    assert.equal(getArticlePath(article), `/blog/health-insurance/${slug}/`);
    assert.equal(getArticleCanonical(article), `https://ccpun.com/blog/health-insurance/${slug}/`);
    assert.equal(isArticleCanonicalAligned(article), true);
  }
});

test("controlled article moves are locked to one-hop final paths", () => {
  assert.equal(getMovedArticleRedirectPath("life-insurance", "aia-health-happy-describe"), "/blog/health-insurance/aia-health-happy-describe/");
  assert.equal(getMovedArticleRedirectPath("life-insurance", "aia-health-ci-hero-guide"), "/blog/health-insurance/aia-health-ci-hero-guide/");
  assert.equal(getMovedArticleRedirectPath("health-insurance", "aia-health-happy-describe"), null);
  assert.equal(getMovedArticleRedirectPath("health-insurance", "aia-health-ci-hero-guide"), null);
  assert.equal(getMovedArticleRedirectPath("critical-illness", "critical-illness-insurance"), "/blog/life-insurance/critical-illness-insurance/");
  assert.equal(getMovedArticleRedirectPath("life-insurance", "aia-vitality"), null);
});

test("legacy category landing paths redirect to tag filters without colliding with article slugs", () => {
  assert.equal(getLegacyCategoryRedirectPath("health-insurance"), "/blog/?tag=%E0%B8%9B%E0%B8%A3%E0%B8%B0%E0%B8%81%E0%B8%B1%E0%B8%99%E0%B8%AA%E0%B8%B8%E0%B8%82%E0%B8%A0%E0%B8%B2%E0%B8%9E");
  assert.equal(getLegacyCategoryRedirectPath("critical-illness"), "/blog/?tag=%E0%B8%9B%E0%B8%A3%E0%B8%B0%E0%B8%81%E0%B8%B1%E0%B8%99%E0%B9%82%E0%B8%A3%E0%B8%84%E0%B8%A3%E0%B9%89%E0%B8%B2%E0%B8%A2%E0%B9%81%E0%B8%A3%E0%B8%87");
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

test("unknown categories fail closed instead of silently becoming personal-finance", () => {
  assert.throws(() => getArticlePath({ slug: "example", category: "Unknown", categorySlug: "unknown" }), /Unsupported article category/);
  assert.throws(
    () => getArticlePath({ slug: "example", category: "ประกันสุขภาพ", categorySlug: "personal-finance" }),
    /Unsupported article category/,
  );
});


test("draft preview may use a safe non-public category segment without changing public taxonomy", () => {
  const draftOnly = { slug: "car-insurance-types", category: "ประกันรถยนต์", categorySlug: "motor-insurance" };
  assert.equal(getArticlePreviewPath(draftOnly), "/blog/motor-insurance/car-insurance-types/");
  assert.throws(() => getArticlePath(draftOnly), /Unsupported article category/);
  assert.throws(
    () => getArticlePreviewPath({ slug: "bad", category: "Unknown", categorySlug: "../admin" }),
    /Unsupported article preview category/,
  );
});
