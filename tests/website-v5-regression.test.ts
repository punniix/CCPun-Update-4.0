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
  // Owner-approved 2026-10-25 (L5): the LINE chat button adds line_chat_panel_open and reuses the
  // existing line_oa_click; no other event name is introduced.
  assert.deepEqual([...new Set(events)].sort(), ["ci_calculator_cta_click", "line_chat_panel_open", "line_oa_click"], "only the approved chat events are new");
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
  assert.match(read("features/investment-allocation/page.tsx"), /<V5Page current="\/tools\/investment-allocation\/">/);
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

test("Phase B + D9: Investment Allocation stays gated and noindex; the v5 nav lists it only where its flag is on", () => {
  const page = read("features/investment-allocation/page.tsx");
  assert.match(page, /if \(!INVESTMENT_ALLOCATION_ENABLED\) notFound\(\);/);
  assert.match(page, /robots: !INVESTMENT_ALLOCATION_ENABLED \|\| IS_REVIEW_ENVIRONMENT \? \{ index: false, follow: false \}/);
  // D9 (owner-approved 2026-10-25): under "เครื่องมือ" next to CI and FHC, behind the server flag.
  assert.match(read("components/layout/v5/constants.ts"), /V5_INVESTMENT_TOOL = \{ href: "\/tools\/investment-allocation\/"/);
  const header = read("components/layout/v5/V5Header.tsx");
  assert.match(header, /if \(INVESTMENT_ALLOCATION_ENABLED\) tools\.push\(\{ href: V5_INVESTMENT_TOOL\.href/);
  assert.match(read("components/layout/v5/V5Footer.tsx"), /\{INVESTMENT_ALLOCATION_ENABLED \? <li><Link href=\{V5_INVESTMENT_TOOL\.href\}>/);
  assert.match(read("features/tools-hub/page.tsx"), /\.\.\.\(INVESTMENT_ALLOCATION_ENABLED \? \[\{/);
  for (const file of ["features/home/v5/V5Home.tsx", "apps/web/app/sitemaps/tools.xml/route.ts"]) {
    assert.doesNotMatch(read(file), /investment-allocation/, `${file}: never linked or listed unconditionally`);
  }
});

// ---------------------------------------------------------------------------
// Owner-approved 2026-10-25: D1 glass, D2 theme, D3 bottom bar, D4 blog de-duplication, T1 /tools/ hub.
// ---------------------------------------------------------------------------

test("D1: backdrop-filter glass only on the header and the bottom LINE bar", () => {
  const sources = [...v5Files.filter((file) => file.endsWith(".css")), "features/tools-hub/ToolsHub.module.css"];
  const glass = sources.flatMap((file) => read(file).split("\n").filter((line) => /backdrop-filter:(?!\s*none)/.test(line)).map((line) => `${file}: ${line.trim().slice(0, 40)}`));
  assert.deepEqual([...new Set(glass.map((line) => line.split(":")[0]))].sort(), ["components/layout/v5/V5.module.css", "components/layout/v5/V5ChatDock.module.css"].sort());
  assert.match(read("components/layout/v5/V5.module.css"), /\.header \{[^}]*backdrop-filter: saturate/);
  assert.match(read("components/layout/v5/V5ChatDock.module.css"), /\.dock \{[^}]*backdrop-filter: saturate/);
  assert.match(read("components/layout/v5/V5.module.css"), /\.root :global\(:is\(\.glass-card, \.glass-button, \.glass-button-sm\)\) \{ backdrop-filter: none;/);
});

test("D2: system (default) / light / dark with a no-flash boot script and guarded storage", () => {
  const header = read("components/layout/v5/V5Header.tsx");
  assert.match(header, /prefers-color-scheme: light/);
  assert.match(header, /d\.setAttribute\("data-theme",t\);d\.setAttribute\("data-theme-choice",k\)/);
  assert.match(header, /try\{c=localStorage\.getItem/);
  assert.match(header, /<script dangerouslySetInnerHTML=\{\{ __html: THEME_BOOT \}\} \/>/);
  const enhancer = read("components/layout/v5/V5HeaderEnhancer.tsx");
  assert.match(enhancer, /current === "system" \? "light" : current === "light" \? "dark" : "system"/);
  assert.match(enhancer, /if \(next === "system"\) localStorage\.removeItem\(storageKey\); else localStorage\.setItem\(storageKey, next\);/);
  assert.match(enhancer, /\} catch \{ \/\* Storage is optional\. \*\/ \}/);
  assert.match(enhancer, /scheme\.addEventListener\("change", onSchemeChange\)/);
});

test("D3/L8: one bottom LINE element shown after the hero, hidden on scroll down, back on scroll up, reduced motion respected", () => {
  const dock = read("components/layout/v5/V5ChatDock.tsx");
  assert.match(dock, /document\.querySelector\("#main-content section"\)/);
  assert.match(dock, /Math\.min\(bottom, window\.innerHeight \* 1\.25\)/);
  assert.match(dock, /delta < -SCROLL_DELTA/);
  assert.match(dock, /delta > SCROLL_DELTA && y > revealY \+ HIDE_AFTER/);
  assert.match(dock, /passive: true/);
  assert.equal((read("components/layout/v5/V5Page.tsx").match(/<V5ChatDockServer/g) ?? []).length, 1, "exactly one bottom element per page");
  for (const file of v5Files.filter((name) => name.endsWith(".css") && !name.endsWith("V5ChatDock.module.css"))) {
    assert.doesNotMatch(read(file), /position:\s*fixed[^}]*bottom:\s*0/, `${file}: no second fixed bottom bar`);
  }
  assert.match(read("components/layout/v5/V5.module.css"), /@media \(prefers-reduced-motion: reduce\) \{\n  \.root \*, \.root \*::before, \.root \*::after \{ transition: none !important;/);
  const css = read("components/layout/v5/V5ChatDock.module.css");
  assert.match(css, /\.dock\[data-state="hidden"\] \{ transform: translateY\(110%\); visibility: hidden;/);
});

test("D4: /blog/ shows each article once; featured and start-here cards stay searchable", () => {
  const index = read("features/blog/v5/V5BlogIndex.tsx");
  assert.match(index, /const shown = new Set\(\[\.\.\.featuredArticles, \.\.\.startHereArticles\]/);
  assert.match(index, /members\.filter\(\(article\) => !shown\.has\(article\.id\)\)/);
  assert.match(index, /!grouped\.has\(article\.id\) && !shown\.has\(article\.id\)/);
  assert.match(index, /data-v5-search=\{searchById\.get\(card\.id\)\}/);
  assert.doesNotMatch(index, /data-v5-group="" aria-labelledby="v5-featured"[\s\S]*data-v5-search-hide="" aria-labelledby="v5-featured"/);
});

test("T1: /tools/ is an indexable hub with canonical, sitemap entry, nav, footer and home links", () => {
  assert.equal(read("apps/web/app/tools/page.tsx"), 'export { default, metadata } from "@/features/tools-hub/page";\n');
  const hub = read("features/tools-hub/page.tsx");
  assert.match(hub, /alternates: \{ canonical: URL \}/);
  assert.match(hub, /const URL = "https:\/\/ccpun\.com\/tools\/";/);
  assert.match(hub, /robots: IS_REVIEW_ENVIRONMENT \? \{ index: false, follow: false \} : \{ index: true, follow: true \}/);
  for (const href of ["/ci-planning/", "/tools/financial-health-check/", "/play/money-story/"]) assert.ok(hub.includes(`href: "${href}"`), href);
  assert.match(hub, /data-analytics-location="tools_hub"/);
  assert.doesNotMatch(hub, /ฟรี|ดีที่สุด|การันตี|…/);
  assert.ok(!hub.split("\n").filter((line) => /[\u0E00-\u0E7F]/.test(line)).some((line) => line.includes("...")), "no ellipsis in Thai copy");
  assert.match(read("apps/web/app/sitemaps/tools.xml/route.ts"), /\{ loc: "https:\/\/ccpun\.com\/tools\/" \}/);
  // Owner-approved 2026-10-25 (v5 only): Money Story is listed at its unchanged canonical, still indexable outside review lanes.
  assert.match(read("apps/web/app/sitemaps/tools.xml/route.ts"), /\{ loc: "https:\/\/ccpun\.com\/play\/money-story\/" \}/);
  const moneyStory = read("features/money-story/page.tsx");
  assert.match(moneyStory, /alternates: \{ canonical: 'https:\/\/ccpun\.com\/play\/money-story\/' \}/);
  assert.match(moneyStory, /: \{ index: true, follow: true \}/);
  assert.match(read("components/layout/v5/constants.ts"), /V5_TOOLS_HUB = \{ href: "\/tools\/", label: "เครื่องมือทั้งหมด" \}/);
  for (const file of ["components/layout/v5/V5Header.tsx", "components/layout/v5/V5Footer.tsx", "features/home/v5/V5Home.tsx"]) assert.match(read(file), /V5_TOOLS_HUB\.href/, file);
});

test("Phase B performance budget: three Kanit weights, one preloaded LCP face, text-first tool heroes", () => {
  const layout = read("apps/web/app/layout.tsx");
  assert.match(layout, /subsets: \["thai", "latin"\],\n  weight: \["400", "500", "600"\],\n  variable: "--font-kanit",\n  display: "swap",\n  preload: false,/);
  assert.match(layout, /subsets: \["thai", "latin"\],\n  weight: \["500"\],\n  variable: "--font-kanit-critical",\n  display: "swap",\n  preload: true,/);
  assert.equal((layout.match(/preload: true/g) ?? []).length, 1, "exactly one preloaded font face (500), Thai + Latin subset files");
  const parts = read("components/layout/v5/V5ToolParts.tsx");
  assert.doesNotMatch(parts, /next\/image|<img/, "tool heroes have no image, so the H1 is the LCP element");
  const countdown = read("components/ui/health-happy/HealthHappyCountdown.tsx");
  assert.doesNotMatch(countdown, /preload\(/, "the decorative countdown artwork no longer competes with the /blog/ LCP image");
  assert.match(countdown, /trackEvent\('health_happy_countdown_view'/);
  assert.match(countdown, /trackEvent\('health_happy_countdown_click'/);
});

// ---------------------------------------------------------------------------
// Design QA 2026-10-25 (owner request): Thai readability floor, one rhythm/radius scale, phone card fix.
// ---------------------------------------------------------------------------

test("QA: v5 text never drops below 13px; the meta token is 14px; rhythm and radius are central tokens", () => {
  const sheets = [
    ...v5Files.filter((file) => file.endsWith(".css")),
    "features/tools-hub/ToolsHub.module.css",
    "components/ui/health-happy/HealthHappyCountdown.module.css",
  ];
  for (const file of sheets) {
    for (const [, size] of read(file).matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)) {
      assert.ok(Number(size) >= 13, `${file}: font-size ${size}px is below the 13px floor`);
    }
  }
  const shellCss = read("components/layout/v5/V5.module.css");
  for (const token of ["--v5-text-meta: 14px;", "--v5-radius: 14px;", "--v5-section-y: 56px;", "--v5-card-gap: 16px;", "--v5-head-gap: 24px;"]) {
    assert.ok(shellCss.includes(token), token);
  }
  assert.match(shellCss, /\.section \{ padding-block: var\(--v5-section-y\); \}/);
  assert.match(shellCss, /\.articleCardTopic \{[^}]*font-size: var\(--v5-text-meta\)/);
  assert.match(shellCss, /\.articleCardMeta \{[^}]*font-size: var\(--v5-text-meta\)/);
  // Phones stack the horizontal card; the image must not keep the full-height rule that hid the title.
  assert.match(shellCss, /\.articleCardHorizontal \.articleCardImage \{ width: 100%; min-height: 0; aspect-ratio: 1200 \/ 630; \}/);
  const home = read("features/home/v5/V5Home.module.css");
  assert.match(home, /\.credentials dd \{[^}]*font-size: var\(--v5-text-meta\)/);
  assert.doesNotMatch(read("features/blog/v5/V5Blog.module.css"), /radial-gradient/, "no decorative glow panels");
  assert.match(read("components/layout/v5/V5Tool.module.css"), /\.calcScope :global\(\.text-xs\) \{ font-size: 14px; line-height: 1\.6; \}/);
});

// ---------------------------------------------------------------------------
// UX fixes 2026-10-25 (owner decisions): no eyebrows on any v5 page.
// ---------------------------------------------------------------------------

const v5PageSources = [
  ...v5Files.filter((file) => file.endsWith(".tsx")),
  "features/ci-planning/v5/V5CiPlanning.tsx",
  "features/financial-health-check/v5/V5Fhc.tsx",
  "features/money-story/v5/V5MoneyStory.tsx",
  "features/legal/v5/V5Privacy.tsx",
  "features/legal/v5/V5CookiePolicy.tsx",
  "features/tools-hub/page.tsx",
  "features/investment-allocation/page.tsx",
  "features/investment-allocation/InvestmentAllocationTool.tsx",
  "features/investment-allocation/PortfolioBuilder.tsx",
  "features/investment-allocation/SingleFundBuilder.tsx",
];

test("UX: no v5 page renders an eyebrow or a tool-hero kicker", () => {
  for (const file of v5PageSources) {
    const source = read(file);
    assert.doesNotMatch(source, /\beyebrow=\{/, `${file}: no eyebrow prop`);
    assert.doesNotMatch(source, /\bkicker=/, `${file}: no hero kicker`);
    assert.doesNotMatch(source, /className=\{(?:shell|styles)\.(?:eyebrow|heroKicker|heroEyebrow)\}/, `${file}: no eyebrow class`);
  }
  assert.doesNotMatch(read("components/layout/v5/V5Primitives.tsx"), /eyebrow\?:/, "V5SectionHeading has no eyebrow slot");
  assert.doesNotMatch(read("components/layout/v5/V5ToolParts.tsx"), /kicker\?:/, "V5ToolHero has no kicker slot");
  for (const css of ["components/layout/v5/V5.module.css", "components/layout/v5/V5Tool.module.css", "features/home/v5/V5Home.module.css"]) {
    assert.doesNotMatch(read(css), /\.(?:eyebrow|heroKicker|heroEyebrow) \{/, `${css}: no eyebrow style`);
  }
  // Protected calculator and game views keep their markup; the v5 scope stops rendering their heading eyebrows.
  const tool = read("components/layout/v5/V5Tool.module.css");
  assert.match(tool, /\.calcScope :global\(\.ccpun-calculator-result-eyebrow\):has\(\+ :is\(h2, h3\)\) \{ display: none; \}/);
  assert.match(tool, /\.msWrap \[data-character\] \+ p:has\(\+ h2\) \{ display: none; \}/);
});

test("UX: per-mode focus ring and field edge tokens; whole-card links show the ring on the card", () => {
  const shellCss = read("components/layout/v5/V5.module.css");
  const [dark, light] = [shellCss.slice(0, shellCss.indexOf(':global(html[data-theme="light"]) .root')), shellCss.slice(shellCss.indexOf(':global(html[data-theme="light"]) .root'))];
  assert.match(dark, /--v5-focus: #e0c985;/);
  assert.match(dark, /--v5-field-edge: #9a8585;/);
  assert.match(light, /--v5-focus: #7a5c14;/);
  assert.match(light, /--v5-field-edge: #8a7766;/);
  assert.match(shellCss, /\.root :focus-visible \{ outline: 3px solid var\(--v5-focus\);/);
  assert.match(shellCss, /\.articleCard:has\(\.articleCardTitle a:focus-visible\) \{ outline: 3px solid var\(--v5-focus\);/);
  assert.match(read("features/home/v5/V5Home.module.css"), /\.toolCard:has\(h3 a:focus-visible\) \{ outline: 3px solid var\(--v5-focus\);/);
  assert.match(read("features/blog/v5/V5Blog.module.css"), /\.search input \{[^}]*border: 1px solid var\(--v5-field-edge\)/);
  assert.match(read("components/layout/v5/V5Tool.module.css"), /\.calcScope select, \.calcScope textarea \{ border: 1px solid var\(--v5-field-edge\); \}/);
  for (const file of v5Files.filter((name) => name.endsWith(".css"))) {
    assert.doesNotMatch(read(file), /outline: 3px solid var\(--v5-gold\)/, `${file}: focus uses the per-mode token`);
  }
});

test("UX: the v5 Health Happy countdown shows Thai units, an accessible AIA red and room in the article", () => {
  const wrapper = read("components/layout/v5/V5HealthHappyCountdown.tsx");
  for (const [unit, key] of [["days", "unitDays"], ["hours", "unitHours"], ["minutes", "unitMinutes"], ["seconds", "unitSeconds"]]) {
    assert.match(wrapper, new RegExp(`"site\\.campaign\\.${unit}": text\\("site\\.campaign\\.${key}"\\)`));
  }
  const defaults = read("lib/content/site-copy-defaults.ts");
  for (const line of ['"site.campaign.unitDays": "วัน"', '"site.campaign.unitHours": "ชั่วโมง"', '"site.campaign.unitMinutes": "นาที"', '"site.campaign.unitSeconds": "วินาที"']) assert.ok(defaults.includes(line), line);
  for (const file of ["features/home/v5/V5Home.tsx", "features/blog/v5/V5BlogIndex.tsx", "features/blog/v5/V5Article.tsx"]) {
    const source = read(file);
    assert.match(source, /<V5HealthHappyCountdown placement="(home|blog|article)" \/>/, file);
    assert.doesNotMatch(source, /<HealthHappyCountdown /, `${file}: v5 never mounts the countdown without the Thai labels`);
  }
  const css = read("components/ui/health-happy/HealthHappyCountdown.module.css");
  assert.match(css, /\.brandAia \{ color: #f2687f;/);
  assert.match(css, /:global\(html\[data-theme="light"\]\) \.brandAia \{ color: #c8102e; \}/);
  assert.doesNotMatch(css, /#e0405c/);
  assert.match(read("features/blog/v5/V5Blog.module.css"), /\.countdownSlot \{ padding-bottom: 24px; \}/);
});

test("UX: tool heroes fill the wide screen and the calculator follows the hero; calculators use the site type and button scale", () => {
  const parts = read("components/layout/v5/V5ToolParts.tsx");
  assert.match(parts, /className=\{styles\.heroGrid\}/);
  assert.match(parts, /className=\{styles\.heroAside\}/);
  const tool = read("components/layout/v5/V5Tool.module.css");
  assert.match(tool, /\.heroGrid \{ display: grid; grid-template-columns: minmax\(0, 7fr\) minmax\(0, 5fr\);/);
  assert.match(tool, /\.calcScope :global\(\.text-sm\) \{ font-size: 16px;/);
  assert.match(tool, /\.calcScope :global\(:is\(\.gold-button, \.glass-button\)\) \{ min-height: 48px;/);
  assert.match(tool, /\.calcScope :global\(\.gold-button\) \{[^}]*border-radius: var\(--v5-radius-button\);/);
  for (const [file, hero, calc] of [["features/ci-planning/v5/V5CiPlanning.tsx", "<V5ToolHero", 'id="ci-calculator"'], ["features/financial-health-check/v5/V5Fhc.tsx", "<V5ToolHero", 'id="fhc-calculator"']]) {
    const source = read(file);
    const afterHero = source.slice(source.indexOf(hero));
    const firstSection = afterHero.indexOf("<section");
    assert.equal(afterHero.indexOf(calc), afterHero.indexOf(calc, firstSection), `${file}: the calculator is the first section after the hero`);
    assert.ok(afterHero.slice(firstSection, firstSection + 120).includes(calc), `${file}: the calculator is the first section after the hero`);
  }
  for (const [, size] of read("features/investment-allocation/InvestmentAllocation.module.css").matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)) {
    assert.ok(Number(size) >= 14, `Investment Allocation font-size ${size}px is below 14px`);
  }
});

test("UX: v5 spacing sits on the 4px scale, headings step up, short grids adapt and link text has no typed arrow", () => {
  const sheets = [
    ...v5Files.filter((file) => file.endsWith(".css")),
    "features/tools-hub/ToolsHub.module.css",
    "components/ui/health-happy/HealthHappyCountdown.module.css",
  ];
  const spacing = /(?<![-\w])(?:margin|padding|gap|row-gap|column-gap|top|right|bottom|left|inset)(?:-[a-z-]+)?\s*:\s*([^;{}]+)/g;
  for (const file of sheets) {
    for (const [, value] of read(file).matchAll(spacing)) {
      for (const [, px] of value.matchAll(/(\d+(?:\.\d+)?)px/g)) {
        assert.ok(Number(px) <= 1 || Number(px) % 4 === 0, `${file}: spacing ${px}px is off the 4px scale (${value.trim()})`);
      }
    }
  }
  const shellCss = read("components/layout/v5/V5.module.css");
  assert.match(shellCss, /\.h2 \{ font-size: clamp\(24px, 3vw, 40px\); line-height: 1\.3; \}/);
  assert.match(shellCss, /@media \(min-width: 1024px\) \{ \.root \{ --v5-section-y: 96px;/);
  assert.match(shellCss, /@media \(min-width: 1440px\) \{ \.root \{ --v5-section-y: 120px; \} \}/);
  assert.match(shellCss, /:is\(\.cardGrid, \.cardGrid2\):has\(> :only-child\) \{ grid-template-columns: minmax\(0, 1fr\); \}/);
  assert.match(shellCss, /\.cardGrid:has\(> :last-child:nth-child\(2\)\), \.cardGrid:has\(> :last-child:nth-child\(4\)\) \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/);
  assert.match(read("features/blog/v5/V5Blog.module.css"), /\.prose :is\(h2, h3, h4\) \+ \* \{ margin-top: 12px; \}/);
  for (const file of v5PageSources) assert.doesNotMatch(read(file), /→<\/Link>|→\s*<\/a>| →</, `${file}: no typed arrow in link text`);
  assert.match(read("components/layout/v5/V5Primitives.tsx"), /export function v5Label\(value: string\) \{\n  return value\.replace\(\/\\s\*→\\s\*\$\/u, ""\)\.trim\(\);/);
  // Copy keys that still carry a trailing arrow in Sanity are rendered through v5Label.
  for (const [file, key] of [["features/blog/v5/V5BlogIndex.tsx", "blog.group.viewAll"], ["features/home/v5/V5Home.tsx", "home.toolCtaAction"], ["features/tools-hub/page.tsx", "home.toolCtaAction2"], ["features/blog/v5/V5Article.tsx", "blog.articleCategory"]]) {
    assert.match(read(file), new RegExp(`v5Label\\((?:text|home|homeText|blog)\\("${key.replace(".", "\\.")}"\\)\\)`), `${file}: ${key} goes through v5Label`);
  }
});

test("UX: the cookie notice matches the site visually and keeps its consent behaviour", () => {
  const css = read("features/analytics/components/CookieConsent.module.css");
  assert.match(css, /:global\(html\[data-theme="light"\]\) \.dialog \{/);
  assert.match(css, /\.description \{[^}]*font-size: 15px;/);
  assert.match(css, /--cc-radius-button: 14px;/);
  assert.match(css, /\.button, \.buttonOutline \{[^}]*min-height: 48px;[^}]*border-radius: var\(--cc-radius-button\);/);
  for (const [, size] of css.matchAll(/font-size:\s*(\d+)px/g)) assert.ok(Number(size) >= 14, `cookie notice font-size ${size}px`);
  const consent = read("features/analytics/components/CookieConsent.tsx");
  const preferences = read("features/analytics/components/CookieConsentPreferences.tsx");
  assert.doesNotMatch(consent + preferences, /style=\{\{/, "visual rules live in the CSS module");
  assert.doesNotMatch(consent, /text-xs/, "no 12px body text");
  // Behaviour stays byte-for-byte the reviewed logic: same storage call shapes, timing and event.
  assert.match(consent, /setTimeout\(\(\) => setVisible\(true\), 800\)/);
  assert.match(consent, /status: 'accepted_all',\n      essential: true,\n      performance: true,\n      analytics: true,\n      social: true,/);
  assert.match(consent, /window\.dispatchEvent\(new CustomEvent\('ccpun:consent', \{ detail: 'accepted' \}\)\);/);
  assert.match(consent, /new CustomEvent\('ccpun:consent', \{ detail: analytics \? 'accepted' : 'rejected' \}\)/);
  assert.match(consent, /role="dialog"[\s\S]*aria-modal="true"/);
});
