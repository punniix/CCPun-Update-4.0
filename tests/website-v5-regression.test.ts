// Website v5 Phase A contracts (UAT prototype): internal-linking template items,
// analytics/consent boundaries and the unchanged public URL layer.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import type { Article } from "../lib/content/types";
import { normalizeInternalHref } from "../features/blog/v5/internal-links";
import { selectRelatedArticles } from "../features/blog/v5/related";
import { resolveHubTools, resolveNextSteps } from "../features/blog/v5/next-step";
import { listFallbackTopics, listLinkableTopics, HOME_CORE_GUIDE_SLUGS, TOPIC_CLUSTER_PILLARS } from "../lib/content/topic-navigation";
import { buildCategoryRegistry } from "../lib/content/category-registry";

const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const v5Files = [
  ...readdirSync(new URL("../components/layout/v5/", import.meta.url)).map((name) => `components/layout/v5/${name}`),
  ...readdirSync(new URL("../features/blog/v5/", import.meta.url)).map((name) => `features/blog/v5/${name}`),
  ...readdirSync(new URL("../features/home/v5/", import.meta.url)).map((name) => `features/home/v5/${name}`),
];

function article(slug: string, categorySlug: string, semanticTopic: string, publishedAt: string, extra: Partial<Article> = {}): Article {
  return {
    id: `id-${slug}`, slug, title: slug, excerpt: slug, category: categorySlug, categorySlug, semanticTopic,
    authorName: "CCPun", status: "published", publishedAt, updatedAt: publishedAt,
    seoTitle: slug, seoDescription: slug, body: [], ...extra,
  };
}

const corpus = [
  article("copayment-vs-deductible-health-insurance", "health-insurance", "health-insurance", "2026-10-18T00:00:00Z"),
  article("personal-income-tax-calculation", "personal-finance", "personal-finance", "2026-10-07T00:00:00Z"),
  article("pension-insurance-guide", "life-insurance", "life-insurance", "2026-10-02T00:00:00Z"),
  article("tax-deduction", "personal-finance", "personal-finance", "2026-09-22T00:00:00Z"),
  article("car-insurance-types", "motor-insurance", "motor-insurance", "2026-09-15T00:00:00Z"),
  article("aia-senior-happy", "life-insurance", "life-insurance", "2026-09-14T00:00:00Z"),
  article("aia-vitality", "life-insurance", "health-insurance", "2026-08-04T00:00:00Z"),
  article("aia-health-ci-hero-guide", "health-insurance", "health-insurance", "2026-08-03T00:00:00Z"),
  article("critical-illness-insurance", "critical-illness-insurance", "critical-illness-insurance", "2026-05-22T00:00:00Z"),
  article("aia-health-happy-describe", "health-insurance", "health-insurance", "2026-04-06T00:00:00Z"),
  article("financial-pyramid", "personal-finance", "personal-finance", "2026-03-02T00:00:00Z"),
];
const bySlug = (slug: string) => corpus.find((item) => item.slug === slug)!;

test("T09: internal links render root-relative with a trailing slash; external links are untouched", () => {
  assert.equal(normalizeInternalHref("https://ccpun.com/blog/health-insurance/aia-health-ci-hero-guide/"), "/blog/health-insurance/aia-health-ci-hero-guide/");
  assert.equal(normalizeInternalHref("/blog/personal-finance/tax-deduction"), "/blog/personal-finance/tax-deduction/");
  assert.equal(normalizeInternalHref("https://www.ccpun.com/ci-planning?utm_source=line#top"), "/ci-planning/?utm_source=line#top");
  assert.equal(normalizeInternalHref("https://www.tcc.or.th/x.pdf"), "https://www.tcc.or.th/x.pdf");
  assert.equal(normalizeInternalHref("/assets/guide.pdf"), "/assets/guide.pdf");
  assert.equal(normalizeInternalHref("#faq"), "#faq");
  assert.equal(normalizeInternalHref("mailto:hello@example.com"), "mailto:hello@example.com");
  assert.equal(normalizeInternalHref("//evil.example/blog"), "//evil.example/blog");
  assert.equal(normalizeInternalHref("https://blog.ccpun.com/old-post"), "https://blog.ccpun.com/old-post", "legacy hosts are never rewritten silently");
});

test("T07: related articles follow topic → pillar → bridge → category and never use off-topic filler", () => {
  const ci = selectRelatedArticles(bySlug("critical-illness-insurance"), corpus).map((item) => item.slug);
  assert.deepEqual(ci, ["copayment-vs-deductible-health-insurance"], "CI owner: no same-topic siblings, so the bridge (Health pillar) only");
  const ciHero = selectRelatedArticles(bySlug("aia-health-ci-hero-guide"), corpus).map((item) => item.slug);
  assert.deepEqual(ciHero.slice(0, 2), ["copayment-vs-deductible-health-insurance", "aia-health-happy-describe"], "same semantic topic first, newest first");
  assert.ok(ciHero.length <= 4);
  assert.ok(ciHero.includes("critical-illness-insurance"), "health ⇄ CI bridge gives the CI owner related-card links");
  const car = selectRelatedArticles(bySlug("car-insurance-types"), corpus).map((item) => item.slug);
  assert.deepEqual(car, ["financial-pyramid"], "motor links only to the reserve-fund pillar, not to the newest articles");
  const pyramid = selectRelatedArticles(bySlug("financial-pyramid"), corpus).map((item) => item.slug);
  assert.deepEqual(pyramid.slice(0, 2), ["personal-income-tax-calculation", "tax-deduction"]);
  assert.ok(pyramid.includes("pension-insurance-guide"));
  for (const item of corpus) {
    const related = selectRelatedArticles(item, corpus);
    assert.ok(!related.some((candidate) => candidate.slug === item.slug), `${item.slug}: never self`);
    assert.ok(related.length <= 4);
  }
  assert.deepEqual(selectRelatedArticles(bySlug("tax-deduction"), [...corpus, article("hidden", "personal-finance", "personal-finance", "2026-10-20T00:00:00Z", { noindex: true })]).map((item) => item.slug).includes("hidden"), false);
});

test("T08: next-step targets are existing owners; CI Hero/health never route to /ci-planning/", () => {
  assert.deepEqual(resolveNextSteps("critical-illness-insurance", "critical-illness-insurance"), [{ kind: "tool", tool: "ci" }]);
  assert.deepEqual(resolveNextSteps("life-insurance", "pension-insurance-guide"), [{ kind: "tool", tool: "fhc" }]);
  assert.deepEqual(resolveNextSteps("personal-finance", "tax-deduction"), [{ kind: "tool", tool: "fhc" }, { kind: "tool", tool: "moneyStory" }]);
  assert.deepEqual(resolveNextSteps("health-insurance", "aia-health-ci-hero-guide"), [{ kind: "article", slug: "copayment-vs-deductible-health-insurance" }]);
  assert.deepEqual(resolveNextSteps("health-insurance", "copayment-vs-deductible-health-insurance"), [{ kind: "line" }]);
  assert.deepEqual(resolveNextSteps("motor-insurance", "car-insurance-types"), [{ kind: "line" }]);
  assert.deepEqual(resolveHubTools("critical-illness-insurance"), ["ci"]);
  assert.deepEqual(resolveHubTools("motor-insurance"), []);
});

test("T11: listings link only active categories that own indexable articles, in hub order", () => {
  const registry = buildCategoryRegistry(
    ["personal-finance", "life-insurance", "health-insurance", "critical-illness-insurance", "motor-insurance", "investment"].map((slug) => ({ _id: `ccpun-category-${slug}`, title: slug, slug, status: "active" })),
    { routeOwnerSlugs: [], canonicalOwnerUrls: [], referencedCategoryIds: [] },
  );
  const topics = listLinkableTopics(registry, corpus);
  assert.deepEqual(topics.map((topic) => topic.slug), ["personal-finance", "life-insurance", "health-insurance", "critical-illness-insurance", "motor-insurance"]);
  assert.ok(!topics.some((topic) => topic.slug === "investment"), "empty investment category is hidden from menus");
  assert.ok(topics.every((topic) => topic.href === `/blog/${topic.slug}/`));
  assert.deepEqual(listFallbackTopics([]), []);
});

test("T01/T04/T05: shell and home links are server-rendered and use the existing URL owners", () => {
  const header = read("components/layout/v5/V5Header.tsx");
  assert.doesNotMatch(header, /^'use client'/, "header markup is a server component");
  assert.match(header, /topics\.map\(/, "topic hubs are in the nav HTML");
  assert.match(header, /tools\.map\(/, "tool links are in the nav HTML");
  assert.doesNotMatch(header, /\?\s*\(\s*<(?:ul|div)[^>]*dropdown/i, "dropdown markup is never conditionally rendered");
  assert.match(header, /id="mobile-navigation"[^>]*hidden/, "mobile menu links stay in the HTML (hidden attribute only)");
  assert.match(header, /data-analytics-location="navbar"/);
  assert.match(header, /data-analytics-location="navbar_mobile"/);
  const footer = read("components/layout/v5/V5Footer.tsx");
  assert.match(footer, /site\.nav\.topics/, "footer has the topics column");
  assert.match(footer, /<CookieSettingsButton \/>/, "consent can be reopened from every v5 footer");
  assert.match(footer, /V5_TOOL_LINKS\.map/);
  assert.doesNotMatch(footer, /site\.nav\.tools"\)\}<\/Link>/, "the tools label no longer points at FHC");
  const home = read("features/home/v5/V5Home.tsx");
  assert.match(home, /HOME_CORE_GUIDE_SLUGS/);
  assert.deepEqual([...HOME_CORE_GUIDE_SLUGS], ["critical-illness-insurance", "aia-health-happy-describe", "tax-deduction", "financial-pyramid"]);
  assert.match(home, /id="about-ccpun"/, "the /#about-ccpun anchor used by author CTAs still resolves");
  assert.match(home, /id="home"/, "home hero keeps the #home analytics scope (home_hero)");
  assert.match(home, /data-analytics-location="home_faq"/);
  assert.match(home, /analyticsSection="contact"/, "home LINE band maps to the approved home_contact location");
  assert.equal(TOPIC_CLUSTER_PILLARS["health-insurance"], "copayment-vs-deductible-health-insurance");
  const constants = read("components/layout/v5/constants.ts");
  for (const href of ["/play/money-story/", "/tools/financial-health-check/", "/ci-planning/"]) assert.ok(constants.includes(`"${href}"`));
});

test("T02/T03: /blog/ and hubs keep every article in HTML without ?page= owners; CI hub renders featuredLink", () => {
  const index = read("features/blog/v5/V5BlogIndex.tsx");
  const pager = read("features/blog/v5/V5GroupPager.tsx");
  const category = read("features/blog/v5/V5Category.tsx");
  assert.match(index, /group\.cards\.map/, "all group cards are rendered on the server");
  assert.doesNotMatch(index + pager + category, /searchParams\.set\(["']page|href=\{?[`"'][^`"']*[?&]page=/, "no crawlable ?page= URLs are created");
  assert.match(pager, /data-pager-hidden/, "paging only toggles visibility");
  assert.match(category, /getTopicFeaturedLink\(slug\)/);
  assert.match(category, /featuredLink\.href/);
  assert.match(read("features/blog/pages/BlogArchivePage.tsx"), /buildBlogArchiveSchema\(articles/, "blog ItemList schema is unchanged");
  assert.match(read("features/blog/pages/BlogCategoryPage.tsx"), /buildBlogTopicHubSchema\(hub, relevantIndexableArticles\)/, "hub schema is unchanged");
});

test("Analytics/consent: v5 emits only through trackEvent with existing event names; no provider calls", () => {
  for (const file of v5Files.filter((name) => /\.(tsx?|css)$/.test(name))) {
    const source = read(file);
    assert.doesNotMatch(source, /\bgtag\s*\(|\bfbq\s*\(|dataLayer\.push|googletagmanager|connect\.facebook/, `${file}: no direct provider calls`);
    assert.doesNotMatch(source, /@\/(?:features\/admin|lib\/admin)\b|apps\/admin/, `${file}: public Web never imports Admin`);
  }
  const ci = read("features/blog/v5/NextStepCiLink.tsx");
  assert.match(ci, /trackEvent\("ci_calculator_cta_click", \{ tool_name: "ci_planning", cta_location: "blog_article", surface_group: "blog" \}\)/);
  const events = v5Files.flatMap((file) => [...read(file).matchAll(/trackEvent\("([a-z_]+)"/g)].map((match) => match[1]));
  assert.deepEqual([...new Set(events)], ["ci_calculator_cta_click"], "no new analytics event names");
  assert.match(read("lib/analytics.ts"), /eventName === 'ci_calculator_cta_click' && ci\) return \{ ga: \['ci_calculator_cta_click'\], meta: 'none' \}/, "existing GA4-only mapping is reused unchanged");
});

test("Protected URL layer is untouched by v5 routes", () => {
  for (const file of ["features/blog/pages/ArticlePage.tsx", "features/blog/pages/BlogCategoryPage.tsx", "features/blog/pages/BlogArchivePage.tsx"]) {
    const source = read(file);
    assert.match(source, /from "@\/lib\/content\/(?:url|category-registry)"|getArticleCanonical|getCategoryCanonical|BLOG_URL/, `${file}: canonical owners still come from lib/content`);
  }
  const article = read("features/blog/pages/ArticlePage.tsx");
  assert.match(article, /alternates: \{ canonical \}/);
  assert.match(article, /permanentRedirect\(getArticlePath\(article\)\)/);
  const categoryPage = read("features/blog/pages/BlogCategoryPage.tsx");
  assert.match(categoryPage, /robots: shouldIndex \? \{ index: true, follow: true \} : \{ index: false, follow: true \}/);
  for (const file of v5Files.filter((name) => name.endsWith(".tsx"))) {
    assert.doesNotMatch(read(file), /\/v2\/|href="https:\/\/ccpun\.com\//, `${file}: no /v2/ paths or absolute self links`);
  }
});
