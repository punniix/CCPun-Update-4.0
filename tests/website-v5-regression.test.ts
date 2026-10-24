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
import { listToolGuides, TOOL_GUIDE_TOPICS } from "../components/layout/v5/tool-guides";

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
  assert.deepEqual(ci, ["copayment-vs-deductible-health-insurance", "aia-health-ci-hero-guide", "aia-health-happy-describe"], "CI owner: bridge pillar, then the paired Health cluster (CI ⇄ CI Hero disambiguation) up to 3 cards");
  const ciHero = selectRelatedArticles(bySlug("aia-health-ci-hero-guide"), corpus).map((item) => item.slug);
  assert.deepEqual(ciHero.slice(0, 2), ["copayment-vs-deductible-health-insurance", "aia-health-happy-describe"], "same semantic topic first, newest first");
  assert.ok(ciHero.length <= 4);
  assert.ok(ciHero.includes("critical-illness-insurance"), "health ⇄ CI bridge gives the CI owner related-card links");
  const car = selectRelatedArticles(bySlug("car-insurance-types"), corpus).map((item) => item.slug);
  assert.deepEqual(car, ["financial-pyramid"], "motor links only to the reserve-fund pillar, never to the newest off-topic articles");
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

// ---------------------------------------------------------------------------
// Website v5 Phase B: tool, legal and Investment pages, single shell, performance budget.
// ---------------------------------------------------------------------------

// Phase B keeps every route file and metadata owner; the existing render owners render v5.
const phaseBOwners: Record<string, [string, string]> = {
  "features/ci-planning/page.tsx": ["renderCiPlanningPage", "@/features/ci-planning/v5/V5CiPlanning"],
  "features/financial-health-check/page.tsx": ["renderFinancialHealthCheckPage", "@/features/financial-health-check/v5/V5Fhc"],
  "features/money-story/page.tsx": ["renderMoneyStoryPage", "./v5/V5MoneyStory"],
  "features/legal/pages/PrivacyPage.tsx": ["renderPrivacyPage", "@/features/legal/v5/V5Privacy"],
  "features/legal/pages/CookiePolicyPage.tsx": ["renderCookiePolicyPage", "@/features/legal/v5/V5CookiePolicy"],
};

test("Phase B: every public page renders the single v5 shell and none imports Website 4.3 code or styles", () => {
  for (const [owner, [render, renderer]] of Object.entries(phaseBOwners)) {
    const source = read(owner);
    assert.equal((source.match(new RegExp(`export async function ${render}\\(`, "g")) ?? []).length, 1, `${owner}: one reusable render owner (also used by the Admin preview)`);
    assert.ok(source.includes(`from '${renderer}'`) || source.includes(`from "${renderer}"`), `${owner} renders ${renderer}`);
    assert.doesNotMatch(source, /website-43|Website43/, `${owner}: no 4.3 shell, footer or stylesheet`);
    assert.match(source, /metadata: Metadata = \{/, `${owner}: metadata stays with its existing owner`);
    const rendererSource = read(`${renderer.replace("@/", "").replace("./", owner.replace(/page\.tsx$/, ""))}.tsx`);
    assert.match(rendererSource, /<V5Page\b/, `${renderer} uses the shared v5 page frame (header + one footer)`);
    assert.doesNotMatch(rendererSource, /website-43|Website43/, `${renderer}: no 4.3 shell, footer or stylesheet`);
  }
  for (const route of ["apps/web/app/ci-planning/page.tsx", "apps/web/app/tools/financial-health-check/page.tsx", "apps/web/app/play/money-story/page.tsx"]) {
    assert.match(read(route), /resolvePageSeoMetadata\(/, `${route}: route-level SEO resolution is unchanged`);
  }
  assert.match(read("features/investment-allocation/page.tsx"), /<V5Page>/);
  assert.doesNotMatch(read("apps/web/app/layout.tsx"), /Website43ResponsiveStyles|website-43/, "the 4.3 stylesheet no longer ships in the root layout");
  for (const widget of ["components/ui/health-happy/HealthHappyCountdown.tsx", "features/blog/website-43/ArticleShareActions.tsx", "features/blog/website-43/ArticleEngagement.tsx", "features/blog/website-43/ArticleDetailAccess.tsx", "components/layout/v5/V5LegacyBridge.tsx"]) {
    assert.doesNotMatch(read(widget), /website-43\/Website43\.module\.css/, `${widget}: widget styles no longer pull the 68 KB 4.3 module into every v5 page`);
  }
});

test("Phase B: tool pages keep calculators, JSON-LD and analytics owners; CI links to its guides", () => {
  const ci = read("features/ci-planning/v5/V5CiPlanning.tsx");
  for (const marker of ["<CIWizard />", "<CiLandingViewTracker />", "'@type': 'FAQPage'", "'@type': 'WebApplication'", "'@type': 'BreadcrumbList'", "id=\"ci-calculator\"", "listToolGuides('ci'"]) assert.ok(ci.includes(marker), `CI v5 keeps ${marker}`);
  const tracker = read("features/ci-planning/v5/CiLandingViewTracker.tsx");
  assert.match(tracker, /landingTrackedRef\.current \|\| !getConsentData\(\)\?\.analytics/);
  assert.match(tracker, /trackEvent\('ci_landing_view', \{\n\s+tool_name: 'ci_planning',\n\s+cta_location: 'ci_landing',\n\s+calculator_version: CI_ASSESSMENT_VERSION,\n\s+\}\)/);
  const fhc = read("features/financial-health-check/v5/V5Fhc.tsx");
  for (const marker of ["<LifeCoverageWizard />", "getFhcFaqs(t)", "id=\"fhc-calculator\"", "href=\"/ci-planning/\""]) assert.ok(fhc.includes(marker), `FHC v5 keeps ${marker}`);
  assert.match(read("features/money-story/v5/V5MoneyStory.tsx"), /<MoneyStoryGame showSeed=\{IS_REVIEW_ENVIRONMENT\}/);

  const guides = listToolGuides("ci", corpus).map((item) => item.slug);
  assert.deepEqual(guides, ["critical-illness-insurance"], "CI tool lists CI owners only; AIA Health CI Hero (health) is never a CI guide");
  assert.equal(listToolGuides("fhc", corpus)[0].slug, "pension-insurance-guide", "life pillar first");
  assert.ok(listToolGuides("fhc", corpus).every((item) => ["life-insurance", "personal-finance"].includes(item.semanticTopic ?? "")));
  assert.equal(listToolGuides("moneyStory", corpus)[0].slug, "financial-pyramid", "personal-finance pillar first");
  assert.ok(listToolGuides("fhc", corpus).length <= 3);
  assert.deepEqual([...TOOL_GUIDE_TOPICS.ci], ["critical-illness-insurance"]);
  assert.deepEqual(listToolGuides("ci", [...corpus, article("ci-hidden", "critical-illness-insurance", "critical-illness-insurance", "2026-10-21T00:00:00Z", { noindex: true })]).map((item) => item.slug), ["critical-illness-insurance"], "noindex articles are never linked");
});

test("Phase B: legal pages keep their copy scope, anchors and trailing-slash links; consent stays reachable", () => {
  const privacy = read("features/legal/v5/V5Privacy.tsx");
  const cookies = read("features/legal/v5/V5CookiePolicy.tsx");
  assert.match(privacy, /getPublicCopy\("privacy"\)/);
  assert.match(cookies, /getPublicCopy\("cookies"\)/);
  assert.match(privacy, /href="\/cookie-policy\/"/);
  assert.match(cookies, /href="\/privacy\/"/);
  assert.match(cookies, /ccpun_cookie_consent \(localStorage\)/, "cookie inventory names are unchanged");
  for (const source of [privacy, cookies]) assert.match(source, /SECTIONS\.map\(\(\[id, key\]\) => <li key=\{id\}><a href=\{`#\$\{id\}`\}>/, "table of contents links to in-page anchors");
});

test("Phase B: Investment Allocation stays gated, noindex outside an enabled non-review lane, and out of the v5 nav", () => {
  const page = read("features/investment-allocation/page.tsx");
  assert.match(page, /if \(!INVESTMENT_ALLOCATION_ENABLED\) notFound\(\);/);
  assert.match(page, /robots: !INVESTMENT_ALLOCATION_ENABLED \|\| IS_REVIEW_ENVIRONMENT \? \{ index: false, follow: false \}/);
  for (const file of ["components/layout/v5/V5Header.tsx", "components/layout/v5/V5Footer.tsx", "components/layout/v5/constants.ts", "features/home/v5/V5Home.tsx"]) {
    assert.doesNotMatch(read(file), /investment-allocation/, `${file}: the flag-gated tool is not linked while Production keeps it off`);
  }
});

test("Phase B performance budget: three Kanit weights, one preloaded LCP face, text-first tool heroes", () => {
  const layout = read("apps/web/app/layout.tsx");
  assert.match(layout, /subsets: \["thai", "latin"\],\n  weight: \["400", "500", "600"\],\n  variable: "--font-kanit",\n  display: "swap",\n  preload: false,/);
  assert.match(layout, /subsets: \["thai"\],\n  weight: \["500"\],\n  variable: "--font-kanit-critical",\n  display: "swap",\n  preload: true,/);
  assert.equal((layout.match(/preload: true/g) ?? []).length, 1, "exactly one preloaded font face");
  const parts = read("components/layout/v5/V5ToolParts.tsx");
  assert.doesNotMatch(parts, /next\/image|<img/, "tool heroes have no image, so the H1 is the LCP element");
  const countdown = read("components/ui/health-happy/HealthHappyCountdown.tsx");
  assert.doesNotMatch(countdown, /preload\(/, "the decorative countdown artwork no longer competes with the /blog/ LCP image");
  assert.match(countdown, /trackEvent\('health_happy_countdown_view'/);
  assert.match(countdown, /trackEvent\('health_happy_countdown_click'/);
});
