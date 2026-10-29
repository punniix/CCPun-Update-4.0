import { INVESTMENT_COPY_DEFAULTS } from "../lib/content/investment-copy-defaults";
import "./v5-uat-collision.test.mjs";
import "./v5-eyebrow-cleanup.test.mjs";
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
import { v5CardGridSizes, V5_HORIZONTAL_CARD_SIZES } from "../components/layout/v5/card-sizes";
import { exemptFromInert, restoreInert, type InertRecord } from "../components/layout/v5/chat-layer";
import { createRequire } from "node:module";
import { buildSync, transformSync } from "esbuild";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { assertProductionCmsOwner } from "../qa/production-cms-source-proof.mjs";
import { isWebsiteV5ReviewedSuccessor, websiteV5PhaseASources, websiteV5PredecessorDigest } from "../qa/website-v5-phase-a-proof.mjs";
// v5 motion round (UAT): result motion, page transition and flip-card contracts.
import "./website-v5-motion.test.mjs";
import "./money-story-theme.test.mjs";
import "./about-father-story.test";
import "./website-v5-article-dates.test.mjs";

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
  // C11 (owner-approved 2026-10-26): the mobile LINE row opens the existing dock contract.
  assert.match(header, /<V5ChatLink href=\{LINE_OA_CHAT_URL\}[^>]*trigger="dock"/);
  assert.doesNotMatch(header, /data-analytics-location="navbar(?:_mobile)?"|window\.open|dispatchEvent/, "the shared chat link owns opening and tracking");
  const mobile = header.slice(header.indexOf('id="mobile-navigation"'));
  assert.equal((mobile.match(/<Link /g) ?? []).length, 4);
  assert.doesNotMatch(mobile, /topics\.map|tools\.map|mobileGroupTitle/);
  assert.match(mobile, /role="switch" aria-checked="true" data-v5-theme-system/);
  const footer = read("components/layout/v5/V5Footer.tsx");
  assert.match(footer, /site\.nav\.topics/, "footer has the topics column");
  assert.match(footer, /<CookieSettingsButton \/>/, "consent can be reopened from every v5 footer");
  assert.match(footer, /V5_TOOL_LINKS\.map/);
  assert.doesNotMatch(footer, /site\.nav\.tools"\)\}<\/Link>/, "the tools label no longer points at FHC");
  const home = read("features/home/v5/V5Home.tsx");
  assert.match(home, /HOME_CORE_GUIDE_SLUGS/);
  assert.deepEqual([...HOME_CORE_GUIDE_SLUGS], ["critical-illness-insurance", "aia-health-happy-describe", "tax-deduction", "financial-pyramid"]);
  assert.match(home, /id="about-ccpun"/, "the /#about-ccpun anchor used by author CTAs still resolves");
  assert.match(home, /id="home"/, "home hero keeps the #home anchor");
  // Owner decision 2026-10-25: the hero, About, FAQ and closing LINE buttons are gone; the dock is the one LINE element.
  assert.doesNotMatch(home, /V5_LINE_URL|lin\.ee|line\.me|home_faq|analyticsSection="contact"|V5ContactBand/, "no LINE button in home content");
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
  assert.deepEqual([...new Set(events)].sort(), ["ci_calculator_cta_click", "line_chat_panel_open", "line_chat_qr_view", "line_oa_click"], "only the approved chat events are new");
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
  assert.match(read("features/investment-allocation/page.tsx"), /<V5Page current="\/tools\/investment-allocation\/" siteCopy=\{siteCopy\}>/);
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
  const hub = read("features/tools-hub/page.tsx");
  assert.match(hub, /showInvestmentCards = INVESTMENT_ALLOCATION_ENABLED\) \{/);
  assert.match(hub, /export default function ToolsHubPage\(\) \{\n  return renderToolsHubPage\(\);/);
  const page = read("features/investment-allocation/page.tsx");
  assert.match(page, /if \(!INVESTMENT_ALLOCATION_ENABLED\) notFound\(\);/);
  assert.match(page, /robots: !INVESTMENT_ALLOCATION_ENABLED \|\| IS_REVIEW_ENVIRONMENT \? \{ index: false, follow: false \}/);
  // D9 (owner-approved 2026-10-25): under "เครื่องมือ" next to CI and FHC, behind the server flag.
  assert.match(read("components/layout/v5/constants.ts"), /V5_INVESTMENT_TOOL = \{ href: "\/tools\/investment-allocation\/"/);
  const header = read("components/layout/v5/V5Header.tsx");
  assert.match(header, /if \(INVESTMENT_ALLOCATION_ENABLED\) tools\.push\(\{ href: V5_INVESTMENT_TOOL\.href/);
  assert.match(read("components/layout/v5/V5Footer.tsx"), /\{INVESTMENT_ALLOCATION_ENABLED \? <li><Link href=\{V5_INVESTMENT_TOOL\.href\}>/);
  assert.match(read("features/tools-hub/page.tsx"), /\.\.\.\(showInvestmentCards \? \[\{/);
  for (const file of ["features/home/v5/V5Home.tsx", "apps/web/app/sitemaps/tools.xml/route.ts"]) {
    assert.doesNotMatch(read(file), /investment-allocation/, `${file}: never linked or listed unconditionally`);
  }
});

test("AIA fund tool (2026-10-26): same gate, robots, sitemap status and engine as the main tool, locked to บลจ. เอไอเอ", () => {
  const main = read("features/investment-allocation/page.tsx");
  const aia = read("features/investment-allocation/aia-page.tsx");
  assert.equal(read("apps/web/app/tools/aia-fund-allocation/page.tsx").trim(), 'export { metadata, default } from "@/features/investment-allocation/aia-page";');
  assert.match(read("components/layout/v5/constants.ts"), /V5_AIA_FUND_TOOL = \{ href: "\/tools\/aia-fund-allocation\/"/);
  // Gate and robots mirror the main tool exactly (noindex on UAT or while the flag is off).
  const robots = /robots: !INVESTMENT_ALLOCATION_ENABLED \|\| IS_REVIEW_ENVIRONMENT \? \{ index: false, follow: false \} : \{ index: true, follow: true \},/;
  for (const page of [main, aia]) {
    assert.match(page, /if \(!INVESTMENT_ALLOCATION_ENABLED\) notFound\(\);/);
    assert.match(page, robots);
  }
  assert.match(aia, /const URL = "https:\/\/ccpun\.com\/tools\/aia-fund-allocation\/";/);
  assert.match(aia, /alternates: \{ canonical: URL,/);
  assert.match(aia, /<V5Page current=\{V5_AIA_FUND_TOOL\.href\}>/);
  assert.match(aia, /"@type": "BreadcrumbList"/);
  assert.ok(aia.includes('breadcrumbs={<V5Breadcrumbs label={text("investment.aia.text265")} items={[{ href: "/", label: text("investment.aia.text264") }, { href: V5_TOOLS_HUB.href, label: V5_TOOLS_HUB.label }, { label: V5_AIA_FUND_TOOL.label }]} />}'));
  assert.equal(INVESTMENT_COPY_DEFAULTS["investment.aia.text265"], "เส้นทางของหน้า");
  assert.equal(INVESTMENT_COPY_DEFAULTS["investment.aia.text264"], "หน้าแรก");
  assert.match(aia, /<InvestmentAllocationTool scope="aia" \/>/, "same engine, AIA scope");
  assert.match(main, /<InvestmentAllocationTool \/>/, "main tool keeps the default scope");
  assert.doesNotMatch(aia + Object.entries(INVESTMENT_COPY_DEFAULTS).filter(([key]) => key.startsWith("investment.aia.")).map(([, value]) => value).join("\n"), /ฟรี|รับประกัน(?!ผลตอบแทนหรือเงินต้น)|ดีที่สุด|อันดับ ?1/, "no free/guarantee/superlative copy");
  assert.match(INVESTMENT_COPY_DEFAULTS["investment.aia.text269"], /กองทุนรวมที่บริหารโดย บลจ\. เอไอเอ/);
  assert.match(INVESTMENT_COPY_DEFAULTS["investment.aia.text269"], /เป็นไปตามเอกสารกรมธรรม์ของบริษัทประกัน/);
  // Static text LCP: the hero has no image.
  assert.doesNotMatch(aia, /<(?:img|Image|video)\b/);
  // Internal links: main -> AIA behind the exclusion constant, AIA -> main, hub card behind the flag.
  assert.match(main, /\{EXCLUDE_AIA_FROM_MAIN_TOOL \? \(\n\s+<p className=\{shell\.lead\}>\{text.node\("investment.main.text259"\)\}<Link className=\{shell\.textLink\} href=\{V5_AIA_FUND_TOOL\.href\}>\{text.node\("investment.main.text260"\)\}<\/Link><\/p>/);
  assert.equal(INVESTMENT_COPY_DEFAULTS["investment.main.text259"], "กองทุนของ บลจ. เอไอเอ แยกไว้อีกเครื่องมือหนึ่ง ");
  assert.equal(INVESTMENT_COPY_DEFAULTS["investment.main.text260"], "ดูเครื่องมือกองทุน บลจ. เอไอเอ");
  assert.ok(aia.includes('meta={text("investment.aia.text269")}'));
  assert.match(aia, /href=\{V5_INVESTMENT_TOOL\.href\}/);
  const hub = read("features/tools-hub/page.tsx");
  assert.match(hub, /\.\.\.\(showInvestmentCards \? \[\{[\s\S]*href: V5_INVESTMENT_TOOL\.href,[\s\S]*href: V5_AIA_FUND_TOOL\.href,[\s\S]*\}\] : \[\]\),/);
  // Sitemap membership matches the main tool: neither is listed in any sitemap; neither is in the header menu.
  for (const file of ["apps/web/app/sitemap.xml/route.ts", "apps/web/app/sitemaps/core.xml/route.ts", "apps/web/app/sitemaps/tools.xml/route.ts", "apps/web/app/sitemaps/blog.xml/route.ts", "apps/web/app/sitemaps/ai-search.xml/route.ts"]) {
    const sitemap = read(file);
    assert.equal(/investment-allocation/.test(sitemap), /aia-fund-allocation|V5_AIA_FUND_TOOL/.test(sitemap), `${file}: AIA tool sitemap status mirrors the main tool`);
    assert.doesNotMatch(sitemap, /aia-fund-allocation|V5_AIA_FUND_TOOL/, file);
  }
  for (const file of ["components/layout/v5/V5Header.tsx", "components/layout/v5/V5Footer.tsx", "features/home/v5/V5Home.tsx"]) {
    assert.doesNotMatch(read(file), /aia-fund-allocation|V5_AIA_FUND_TOOL/, `${file}: not in menus`);
  }
});

// ---------------------------------------------------------------------------
// Owner-approved 2026-10-25: D1 glass, D2 theme, D3 bottom bar, D4 blog de-duplication, T1 /tools/ hub.
// ---------------------------------------------------------------------------

test("D1/C17: glass is allowed only on the header; the mobile LINE control overrides its historical bar skin", () => {
  const sources = [...v5Files.filter((file) => file.endsWith(".css")), "features/tools-hub/ToolsHub.module.css"];
  const glass = sources.flatMap((file) => read(file).split("\n").filter((line) => /backdrop-filter:(?!\s*none)/.test(line)).map((line) => `${file}: ${line.trim().slice(0, 40)}`));
  assert.deepEqual([...new Set(glass.map((line) => line.split(":")[0]))].sort(), ["components/layout/v5/V5.module.css", "components/layout/v5/V5ChatDock.module.css"].sort());
  assert.match(read("components/layout/v5/V5.module.css"), /\.header \{[^}]*backdrop-filter: saturate/);
  assert.match(read("components/layout/v5/V5ChatDock.module.css"), /\.dock \{[^}]*backdrop-filter: saturate/);
  assert.match(read("components/layout/v5/V5ChatDock.module.css"), /@media \(max-width: 1023px\) \{\s*\.dock \{[^}]*inset: auto 16px calc\(16px \+ env\(safe-area-inset-bottom, 0px\)\) auto;[^}]*padding: 0; background: none; border: 0; backdrop-filter: none; -webkit-backdrop-filter: none;/);
  assert.match(read("components/layout/v5/V5.module.css"), /\.root :global\(:is\(\.glass-card, \.glass-button, \.glass-button-sm\)\) \{ backdrop-filter: none;/);
});

test("D2: system (default) / light / dark with a no-flash boot script and guarded storage", () => {
  const header = read("components/layout/v5/V5Header.tsx");
  assert.match(header, /prefers-color-scheme: light/);
  assert.match(header, /d\.setAttribute\("data-theme",t\);d\.setAttribute\("data-theme-choice",k\)/);
  assert.match(header, /try\{c=localStorage\.getItem/);
  assert.match(header, /<script dangerouslySetInnerHTML=\{\{ __html: THEME_BOOT \}\} \/>/);
  const enhancer = read("components/layout/v5/V5HeaderEnhancer.tsx");
  assert.match(header, /role="radiogroup" aria-label="ธีม"/);
  assert.equal((header.match(/role="radio"/g) ?? []).length, 3);
  assert.match(enhancer, /root\.getAttribute\("data-theme"\) === "light" \? "dark" : "light"/);
  assert.match(enhancer, /const onSystemClick = \(\) => selectTheme\(root\.getAttribute\("data-theme-choice"\) === "system" \? root\.getAttribute\("data-theme"\) \?\? "dark" : "system"\)/);
  assert.match(enhancer, /option\.tabIndex = checked \? 0 : -1/);
  assert.match(enhancer, /"ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End", " ", "Enter"/);
  assert.match(enhancer, /if \(next === "system"\) localStorage\.removeItem\(storageKey\); else localStorage\.setItem\(storageKey, next\);/);
  assert.match(enhancer, /\} catch \{ \/\* Storage is optional\. \*\/ \}/);
  assert.match(enhancer, /scheme\.addEventListener\("change", onSchemeChange\)/);
});

test("D3/L8 + one LINE button: the dock is visible from load, tucks away below the hero, sits above the cookie notice", () => {
  const dock = read("components/layout/v5/V5ChatDock.tsx");
  assert.match(dock, /const \[shown, setShown\] = useState\(true\);/, "server-rendered visible (no hide over the hero)");
  assert.doesNotMatch(dock, /consentDecided|getConsentData/, "no longer hidden until consent is decided");
  assert.match(dock, /document\.querySelector\("#main-content section"\)/);
  assert.match(dock, /Math\.min\(bottom, window\.innerHeight \* 1\.25\)/);
  assert.match(dock, /if \(y < heroBottom\) \{\n        \/\/ Visible from page load and over the hero\.\n        set\(true\);/);
  assert.match(dock, /delta < -SCROLL_DELTA/);
  assert.match(dock, /delta > SCROLL_DELTA && y > revealY \+ HIDE_AFTER/);
  assert.match(dock, /passive: true/);
  // Cookie-sheet offset (transform only, so no layout shift). Owner requirement 2026-10-26: the chat does not
  // depend on consent, so the dock no longer steps aside for a tall notice; the lift is capped to keep it on screen.
  assert.match(dock, /const COOKIE_DIALOG = '\[role="dialog"\]\[aria-labelledby\^="cookie"\]';/);
  assert.match(dock, /const offset = Math\.round\(Math\.max\(0, Math\.min\(height, room\)\)\);/);
  // Motion smoothing (2026-10-26): the same capped offset is also written onto the layer before the notice's first
  // paint (no frame with the dock behind the notice); React state carries the identical value for the render.
  assert.match(dock, /if \(offset > 0\) layerRef\.current\?\.style\.setProperty\("--v5-dock-offset", `\$\{offset\}px`\);\n      else layerRef\.current\?\.style\.removeProperty\("--v5-dock-offset"\);\n      setCookieOffset\(offset\);/);
  assert.match(dock, /new MutationObserver\(\(\) => \{ if \(document\.querySelector\(COOKIE_DIALOG\) !== observed\) measure\(\); else schedule\(\); \}\)/);
  assert.doesNotMatch(dock, /cookieCovers/);
  assert.match(dock, /const state = typing \? "hidden" : open \|\| shown \? "shown" : "hidden";/);
  // It never stays hidden: back on scroll up, at the page end, and when the panel closes.
  assert.match(dock, /y \+ window\.innerHeight >= document\.documentElement\.scrollHeight - 4/);
  // C8: release the dock immediately, retain the inert exit until animationend/token fallback.
  assert.match(dock, /setPanel\(current => current \? \{ \.\.\.current, closing: true \} : null\);\n    revealRef\.current\(\);/);
  assert.match(dock, /const finishClose = useCallback\(\(\) => setPanel\(current => current\?\.closing \? null : current\), \[\]\);/);
  assert.match(dock, /triggerRef\.current\?\.focus\(\{ preventScroll: true \}\);/);
  assert.match(read("components/layout/v5/V5ChatPanel.tsx"), /const timeout = window\.setTimeout\(onClosed, V5_MOTION_MS\.micro\);/);
  assert.match(dock, /"--v5-dock-offset": `\$\{cookieOffset\}px`/);
  // No-JS fallback: the dock is a real LINE OA link (this page's prefill), enhanced into the panel button.
  assert.match(dock, /href=\{fallbackHref\} target="_blank" rel="noopener noreferrer"/);
  assert.match(dock, /role=\{enhanced \? "button" : undefined\}/);
  assert.match(read("components/layout/v5/V5ChatDockServer.tsx"), /panel\.mode === "panel" \? panel\.topics\[0\]\?\.href \?\? LINE_OA_CHAT_URL : panel\.href/);
  assert.equal((read("components/layout/v5/V5Page.tsx").match(/<V5ChatDockServer/g) ?? []).length, 1, "exactly one bottom element per page");
  for (const file of v5Files.filter((name) => name.endsWith(".css") && !name.endsWith("V5ChatDock.module.css"))) {
    assert.doesNotMatch(read(file), /position:\s*fixed[^}]*bottom:\s*0/, `${file}: no second fixed bottom bar`);
  }
  assert.match(read("components/layout/v5/V5.module.css"), /@media \(prefers-reduced-motion: reduce\) \{\n  \.root \*, \.root \*::before, \.root \*::after \{ transition: none !important;/);
  const css = read("components/layout/v5/V5ChatDock.module.css");
  // Motion smoothing (2026-10-26): the notice lift is `translate` (instant, with the notice); only the tuck/return
  // `transform` animates, and hidden adds the lift back so the dock still leaves the screen fully. Both compositor-only.
  assert.match(css, /translate: 0 calc\(-1 \* var\(--v5-dock-offset, 0px\)\); transform: none;/);
  assert.match(css, /\.dock\[data-state="hidden"\] \{ transform: translateY\(calc\(110% \+ var\(--v5-dock-offset, 0px\)\)\); visibility: hidden;/);
  assert.match(css, /transition: transform var\(--v5-motion-base\) var\(--v5-ease-standard\), visibility 0s linear 0s;/);
  // One Compass: the dock is an outline control, so each viewport keeps gold for the page's own primary action.
  assert.match(css, /\.trigger \{[^}]*border: 1px solid var\(--v5-gold-text\); border-radius: var\(--v5-radius-button\); background: var\(--v5-card\);/);
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
  assert.doesNotMatch(hub, /lin\.ee|line\.me|shell\.band|data-analytics-location="tools_hub"/, "no closing LINE band (owner decision 2026-10-25)");
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
  // 2026-10-26: on phones the hero lead (18px / 2.0) out-paints the cookie notice description on CI, FHC and /tools/.
  const toolCss = read("components/layout/v5/V5Tool.module.css");
  assert.match(toolCss, /\.heroLead \{ color: var\(--v5-muted\); font-size: clamp\(17px, 1\.7vw, 19px\); line-height: 1\.75;/);
  assert.match(toolCss, /@media \(max-width: 639px\) \{ \.heroLead \{ font-size: 18px; line-height: 2; \} \}/, "phone hero lead stays the LCP candidate ahead of the cookie notice");
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
  assert.match(shellCss, /\.articleCardHorizontal \.articleCardImage \{ width: 100%; min-height: 0; aspect-ratio: auto; \}/);
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
  "features/investment-allocation/aia-page.tsx",
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
  // Historical calculator fallback guards remain; C15 callers use body/heading nodes and the Money Story body line stays visible.
  const tool = read("components/layout/v5/V5Tool.module.css");
  assert.match(tool, /\.calcScope :global\(\.ccpun-calculator-result-eyebrow\):has\(\+ :is\(h2, h3\)\) \{ display: none; \}/);
  assert.doesNotMatch(tool, /\.msWrap \[data-character\] \+ p:has\(\+ h2\)/, "C15 normal-colour character result line stays visible");
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
  const wrapper = read("components/layout/v5/V5HealthHappyCountdownLabels.tsx");
  for (const [unit, key] of [["days", "unitDays"], ["hours", "unitHours"], ["minutes", "unitMinutes"], ["seconds", "unitSeconds"]]) {
    assert.match(wrapper, new RegExp(`"site\\.campaign\\.${unit}": text\\("site\\.campaign\\.${key}"\\)`));
  }
  const defaults = read("lib/content/site-copy-defaults.ts");
  for (const line of ['"site.campaign.unitDays": "วัน"', '"site.campaign.unitHours": "ชั่วโมง"', '"site.campaign.unitMinutes": "นาที"', '"site.campaign.unitSeconds": "วินาที"']) assert.ok(defaults.includes(line), line);
  for (const file of ["features/home/v5/V5Home.tsx", "features/blog/v5/V5BlogIndex.tsx", "features/blog/v5/V5Article.tsx"]) {
    const source = read(file);
    assert.match(source, /<V5HealthHappyCountdown placement="(home|blog|article)"[^>]*\/>/, file);
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
  // Native Home EC7 uses these five exact declarations; every other declaration keeps the 4px rule.
  const approvedHomeSpacing = new Set(["margin-top: 10px", "padding: 8px 14px", "padding: 10px 0 10px 32px", "top: 10px", "gap: 10px"]);
  for (const file of sheets) {
    const source = read(file);
    if (file === "features/home/v5/V5Home.module.css") {
      for (const declaration of approvedHomeSpacing) assert.equal([...source.matchAll(spacing)].filter(([actual]) => actual.trim() === declaration).length, 1, `one approved native Home declaration: ${declaration}`);
    }
    for (const [declaration, value] of source.matchAll(spacing)) {
      if (file === "features/home/v5/V5Home.module.css" && approvedHomeSpacing.has(declaration.trim())) continue;
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
  // C9 removes the first-visit delay; storage call shapes and events stay unchanged.
  assert.match(consent, /if \(getConsentData\(\) === null\) \{\n      \/\/ eslint-disable-next-line react-hooks\/set-state-in-effect[^\n]*\n      setVisible\(true\);\n    \}/);
  assert.doesNotMatch(consent, /setTimeout|clearTimeout/);
  assert.match(consent, /status: 'accepted_all',\n      essential: true,\n      performance: true,\n      analytics: true,\n      social: true,/);
  assert.match(consent, /window\.dispatchEvent\(new CustomEvent\('ccpun:consent', \{ detail: 'accepted' \}\)\);/);
  assert.match(consent, /new CustomEvent\('ccpun:consent', \{ detail: analytics \? 'accepted' : 'rejected' \}\)/);
  assert.match(consent, /role="dialog"[\s\S]*aria-modal="true"/);
});

test("SEO: /about/ is the approved new owner: self canonical, core sitemap, ProfilePage + Person, linked from header, footer and home", async () => {
  const page = read("features/about/page.tsx");
  assert.equal(read("apps/web/app/about/page.tsx").trim(), 'export { default, metadata } from "@/features/about/page";');
  assert.match(page, /const URL = "https:\/\/ccpun\.com\/about\/";/);
  assert.match(page, /alternates: \{ canonical: URL \}/);
  assert.match(page, /robots: IS_REVIEW_ENVIRONMENT \? \{ index: false, follow: false \} : \{ index: true, follow: true \}/);
  assert.match(page, /"@type": "ProfilePage"/);
  assert.match(page, /mainEntity: \{ "@id": CCPUN_PERSON_ID \}/);
  assert.match(page, /"@type": "BreadcrumbList"/);
  // Owner-copy slots render only on UAT/preview, never in a Production build.
  assert.match(page, /function OwnerCopySlot[\s\S]*?if \(!IS_REVIEW_ENVIRONMENT\) return null;/);
  assert.ok(page.includes('slot="about-start-years"'), "Historical About slot remains in the unchanged Production renderer");
  assert.match(page, /IS_REVIEW_ENVIRONMENT \? \(\s*<section[^>]+aria-label="ประวัติและแนวทางการวางแผนการเงิน"/, "UAT-only Story V2 section");
  assert.match(page, /<OwnerStoryV2 text=\{text\} qualification=\{qualification\} licenceCards=\{licenceCards\} \/>/, "UAT renders reviewed story component");
  assert.match(page, /function FatherStory[\s\S]*?if \(!IS_REVIEW_ENVIRONMENT\) return null;/);
  assert.match(page, /<FatherStory text=\{text\} \/>/);
  assert.doesNotMatch(page, /ฟรี|รับประกัน|ที่สุด|…|\.\.\./, "About content rules: no free, guarantees, superlatives or ellipsis");
  assert.doesNotMatch(page, /lin\.ee|line\.me/, "the page's LINE path is the shared chat button only");
  const core = await import("../apps/web/app/sitemaps/core.xml/route");
  const xml = await core.GET().text();
  assert.ok(xml.includes("<loc>https://ccpun.com/about/</loc>"));
  assert.equal(xml.split("https://ccpun.com/about/").length, 2, "one sitemap entry");
  for (const file of ["components/layout/v5/V5Header.tsx", "components/layout/v5/V5Footer.tsx"]) {
    assert.match(read(file), /href="\/about\/"/, file);
    assert.doesNotMatch(read(file), /href="\/#about-ccpun"/, `${file}: no longer points at the home section`);
  }
  assert.match(read("features/home/v5/V5Home.tsx"), /<section id="about-ccpun"[\s\S]*href="\/about\/"/, "the home About section stays and links to /about/");
  // No historical About URL exists, so there is no redirect to keep in step.
  const ledger = read("qa/legacy-url-ledger.json");
  assert.doesNotMatch(ledger, /about/i);
});

test("UX: after the Health Happy deadline the countdown slot renders nothing, even on cached HTML", async () => {
  const slot = read("components/layout/v5/V5HealthHappyCountdown.tsx");
  const deadline = slot.match(/V5_HEALTH_HAPPY_DEADLINE = "([^"]+)"/)?.[1];
  assert.equal(deadline, "2026-11-30T23:59:59+07:00");
  assert.ok(read("components/ui/health-happy/HealthHappyCountdown.tsx").includes(`const TARGET = Date.parse('${deadline}');`), "same deadline as the countdown component");
  // The check runs before the slot paints (first child of the slot) and the CSS removes the whole slot.
  assert.match(slot, /data-v5-countdown-slot="">\n      <script dangerouslySetInnerHTML=\{\{ __html: V5_HEALTH_HAPPY_ENDED_CHECK \}\} \/>/);
  assert.match(read("components/layout/v5/V5.module.css"), /:global\(html\[data-v5-countdown-ended\]\) \.countdownSlot \{ display: none; \}/);
  const script = JSON.parse(`"${slot.match(/V5_HEALTH_HAPPY_ENDED_CHECK = `([^`]+)`/)![1].replace("${JSON.stringify(V5_HEALTH_HAPPY_DEADLINE)}", `\\"${deadline}\\"`).replace(/"/g, '\\"').replace(/\\\\"/g, '\\"')}"`);
  const { runInNewContext } = await import("node:vm");
  for (const [now, ended] of [["2026-11-30T23:59:58+07:00", false], ["2026-11-30T23:59:59+07:00", true], ["2026-12-01T09:00:00+07:00", true]] as const) {
    const attributes = new Set<string>();
    const RealDate = Date;
    const FakeDate = Object.assign(function () {}, { now: () => RealDate.parse(now), parse: RealDate.parse });
    runInNewContext(script, { Date: FakeDate, document: { documentElement: { setAttribute: (name: string) => attributes.add(name) } } });
    assert.equal(attributes.has("data-v5-countdown-ended"), ended, now);
  }
  // The countdown click event stays the component's own, unchanged.
  assert.match(read("components/ui/health-happy/HealthHappyCountdown.tsx"), /trackEvent\('health_happy_countdown_click'/);
});

test("One LINE dock per page, with the owner-approved category closing CTA exception and no gold closing band", () => {
  const surfaces = [
    "components/layout/v5/V5Header.tsx", "components/layout/v5/V5Footer.tsx", "components/layout/v5/V5Primitives.tsx",
    "features/home/v5/V5Home.tsx", "features/blog/v5/V5BlogIndex.tsx", "features/blog/v5/V5Category.tsx", "features/blog/v5/V5Article.tsx",
    "features/ci-planning/v5/V5CiPlanning.tsx", "features/financial-health-check/v5/V5Fhc.tsx", "features/money-story/v5/V5MoneyStory.tsx",
    "features/tools-hub/page.tsx", "features/about/page.tsx", "components/layout/v5/V5ToolParts.tsx",
  ];
  for (const file of surfaces) {
    const source = read(file);
    if (file === "features/blog/v5/V5Category.tsx") {
      assert.equal([...source.matchAll(/href=\{V5_LINE_URL\}/g)].length, 1, "one owner-approved category closing link, not repeated cards");
      assert.match(source, /slug === "investment"[\s\S]*V5_ACCOUNT_LINKS\.map/, "investment uses the two approved account destinations");
    } else {
      assert.doesNotMatch(source, /V5_LINE_URL|https:\/\/lin\.ee|https:\/\/line\.me/, `${file}: no LINE OA link besides the dock`);
    }
    assert.doesNotMatch(source, /V5ContactBand|shell\.band\b|styles\.band\b/, `${file}: no gold closing band`);
  }
  assert.doesNotMatch(read("components/layout/v5/V5.module.css"), /\.band \{|--v5-band/, "the gold band styles are gone");
  // The shared countdown keeps its LINE action for other surfaces; v5 does not render it.
  assert.doesNotMatch(read("components/layout/v5/V5.module.css"), /\.countdownSlot :global\(\[data-campaign-action="line"\]\) \{ display: none; \}/, "Owner 2026-10-29: every existing countdown action stays visible");
});

test("Article LINE CTAs open the dock's chat panel; no-JS falls back to the page's LINE link; panel_trigger is tracked", async () => {
  const { isLineOaContactHref } = await import("../components/layout/v5/chat-events");
  for (const href of ["https://lin.ee/tqLCs4f", "https://line.me/R/ti/p/%40ccpun", "https://line.me/R/oaMessage/%40ccpun/?hi", "https://page.line.me/ccpun", "line://ti/p/@ccpun"]) assert.ok(isLineOaContactHref(href), href);
  for (const href of ["https://social-plugins.line.me/lineit/share?url=x", "/blog/", "https://ccpun.com/about/", "", undefined]) assert.ok(!isLineOaContactHref(href), String(href));
  const body = read("features/blog/v5/V5ArticleBody.tsx");
  assert.match(body, /if \(isLineOaContactHref\(item\.url\)\) return <p key=\{key\}><V5ChatLink className=\{`\$\{shell\.textLink\} \$\{styles\.chatCta\}`\} href=\{chatHref\}>/, "LINE CTA blocks are link-styled, not gold");
  assert.match(body, /return <p key=\{key\}><a className=\{item\.style === "primary" \? shell\.button : shell\.buttonOutline\} \{\.\.\.props\}>/, "non-LINE CTA blocks are unchanged");
  assert.match(body, /isLineOaContactHref\(segment\.href\)\n      \? <V5ChatLink href=\{chatHref\}>/);
  // 2026-10-26 (LINE chat per page): the dock and the article CTAs share one chat context (path groups + logical id, title, semantic topic).
  assert.match(read("features/blog/v5/V5Article.tsx"), /const chatHref = await getV5ChatFallbackHref\(chatContext\);/);
  assert.match(read("features/blog/v5/V5Article.tsx"), /<V5Page current=\{path\} chat=\{chatContext\}>/);
  const link = read("components/layout/v5/V5ChatLink.tsx");
  assert.match(link, /<a\n      href=\{href\}/, "a real link first (no-JS fallback)");
  assert.match(link, /new CustomEvent<V5OpenChatDetail>\(V5_OPEN_CHAT_EVENT, \{ cancelable: true, detail \}\)\)\) event\.preventDefault\(\);/);
  assert.match(link, /trigger = "article_cta"/, "article-body CTAs report panel_trigger article_cta by default");
  assert.doesNotMatch(link, /trackEvent/, "the panel owns the tracking");
  const dock = read("components/layout/v5/V5ChatDock.tsx");
  assert.match(dock, /window\.addEventListener\(V5_OPEN_CHAT_EVENT, onOpenChat\)/);
  assert.match(dock, /setPanel\(\{ instance: \+\+panelSequence\.current, trigger: "dock", returnTo: null \}\)/, "C8: each reopening gets its own panel instance, so stale exits cannot dismiss it");
  const panel = read("components/layout/v5/V5ChatPanel.tsx");
  assert.match(panel, /trackEvent\("line_chat_panel_open", \{ page_group: panel\.pageGroup, panel_trigger: trigger, \.\.\.\(campaignCode \? \{ campaign_code: campaignCode \} : \{\}\) \}\);/);
  assert.match(panel, /trackEvent\("line_oa_click", \{\n\s+contact_channel: "line", cta_location: "chat_panel", chat_topic_id: topic\.id, page_group: panel\.pageGroup,/, "topic clicks keep line_oa_click unchanged");
  assert.match(read("lib/analytics.ts"), /panel_trigger: new Set\(\['dock', 'article_cta'\]\),/);
});

test("Buttons use 14px corners sitewide (DESIGN.md), including the countdown, calculators and cookie notice", () => {
  assert.match(read("components/layout/v5/V5.module.css"), /--v5-radius-button: 14px;/);
  assert.match(read("components/ui/health-happy/HealthHappyCountdown.module.css"), /border-radius: var\(--v5-radius-button, 14px\);/);
  assert.match(read("features/analytics/components/CookieConsent.module.css"), /--cc-radius-button: 14px;/);
  assert.match(read("DESIGN.md"), /- \*\*Shape:\*\* Gently curved \(14px radius\)/);
});

test("Covers retain their intrinsic shape: no cropping or tall artificial frame (owner correction 2026-10-29)", () => {
  const rules = (css: string) => [...css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({ selector: selector.trim(), body }));
  for (const file of ["components/layout/v5/V5.module.css", "features/blog/v5/V5Blog.module.css", "features/home/v5/V5Home.module.css"]) {
    for (const { selector, body } of rules(read(file))) {
      if (!/articleCardImage|featuredLead|\.feature\b/.test(selector)) continue;
      assert.ok(!(/aspect-ratio:\s*auto/.test(body) && /min-height:\s*100%/.test(body)), `${file}: ${selector} must not stretch a cover (aspect-ratio: auto + min-height: 100%)`);
      if (/aspect-ratio/.test(body)) assert.match(body, /aspect-ratio: (?:auto|1200 \/ 630)/, `${file}: ${selector} uses intrinsic dimensions (placeholder reserves the standard ratio)`);
    }
  }
  const shell = read("components/layout/v5/V5.module.css");
  assert.match(shell, /\.articleCardImage \{ display: block; width: 100%; height: auto; aspect-ratio: auto; object-fit: contain; object-position: top;/);
  // Owner bug report 2026-10-26: horizontal covers are centred (no empty block under them) with rounded outer corners.
  assert.match(shell, /\.articleCardHorizontal \.articleCardImage \{ width: 38%; height: auto; aspect-ratio: auto; align-self: flex-start; flex: none; border-radius: var\(--v5-card-image-radius\) 0 0 var\(--v5-card-image-radius\); \}/);
  assert.match(read("features/blog/v5/V5Blog.module.css"), /\.featuredLead > img \{ width: 50%; height: auto; aspect-ratio: auto; align-self: flex-start; flex: none; border-radius: var\(--v5-card-image-radius\) 0 0 var\(--v5-card-image-radius\); \}/);
  assert.match(shell, /--v5-card-image-radius: calc\(var\(--v5-radius\) - 1px\);/);
  assert.doesNotMatch(shell, /\.articleCardImage \{[^}]*object-fit: cover/, "informative image content is not cropped");
  assert.match(read("features/blog/v5/V5Blog.module.css"), /\.feature img \{ display: block; width: 100%; height: auto;/, "the article cover keeps its natural shape");
});

test("Owner photos (v5b set, 2026-10-25): About hero is photo 4 per theme, JSON-LD names it, the father photo stays in the UAT-only slot", () => {
  const page = read("features/about/page.tsx");
  assert.match(page, /const PORTRAIT_DARK = "\/assets\/ccpun-portrait-v5-about-dark\.webp";/);
  assert.match(page, /const PORTRAIT_LIGHT = "\/assets\/ccpun-portrait-v5-about-light\.webp";/);
  assert.match(page, /"@type": "Person", "@id": CCPUN_PERSON_ID, name: personSchema\.name, image: `https:\/\/ccpun\.com\$\{PORTRAIT_DARK\}`/);
  assert.doesNotMatch(page, /\/assets\/ccpun\.webp/);
  assert.doesNotMatch(page, /\bpreload\b|loading="eager"/, "two theme portraits stay lazy so only the visible one loads");
  assert.match(page, /function FatherPhotoSlot\(\{ text \}: \{ text: AboutText \}\) \{\n  if \(!IS_REVIEW_ENVIRONMENT\) return null;/);
  assert.doesNotMatch(page, /afpt-certificate/i, "no AFPT certificate image on the site (owner decision)");
  const css = read("features/about/About.module.css");
  assert.match(css, /:global\(html\[data-theme="light"\]\) \.portraitDark \{ display: none; \}/);
  assert.match(css, /:global\(html\[data-theme="light"\]\) \.portraitLight \{ display: block; \}/);
  const favicon = readFileSync(new URL("../public/favicon.png", import.meta.url));
  assert.ok(favicon.equals(readFileSync(new URL("../public/assets/ccpun-avatar-v5-256.png", import.meta.url))), "favicon.png is the plain-circle face avatar");
  assert.ok(favicon.equals(readFileSync(new URL("../public/assets/ccpun-favicon-v5-7253e60c.png", import.meta.url))), "the UAT cache-busting icon preserves the selected desktop portrait bytes");
});

// v5 polish (UAT, 2026-10-25): label wrapping, card cover widths, the late share count and the phone hero.
/** Width the browser reads from a `sizes` list at a viewport width (calc(Avw - Bpx) or Npx only). */
function sizesAt(sizes: string, vw: number): number {
  for (const part of sizes.split(/,\s*(?![^()]*\))/)) {
    const match = part.trim().match(/^(?:\(max-width: (\d+)px\)\s+)?(.+)$/);
    assert.ok(match, part);
    if (match[1] && vw > Number(match[1])) continue;
    const value = match[2];
    const calc = value.match(/^calc\(([\d.]+)vw - (\d+)px\)$/);
    if (calc) return Number(calc[1]) * vw / 100 - Number(calc[2]);
    const px = value.match(/^(\d+)px$/);
    assert.ok(px, value);
    return Number(px[1]);
  }
  throw new Error(`no default in ${sizes}`);
}

test("Polish: card cover sizes follow the adaptive grid, so next/image never picks a narrower file than the cover draws", () => {
  // Drawn cover width in .cardGrid / .cardGrid2 for a card count at a viewport width (V5.module.css rules).
  const content = (vw: number, narrow = false) => Math.min(vw < 768 ? vw - 40 : vw < 1200 ? vw - 64 : vw - 160, narrow ? 1028 : 1280);
  const drawn = (vw: number, count: number, grid: "cardGrid" | "cardGrid2", narrow = false) => {
    const w = content(vw, narrow); const gap = vw < 640 ? 16 : 20;
    if (vw < 640) return w;
    if (count === 1) return vw >= 1024 ? 0.4 * w : w;
    const cols = grid === "cardGrid"
      ? (vw >= 1024 && count !== 2 && count !== 4 ? 3 : 2)
      : (vw >= 1024 && count === 3 ? 3 : count % 2 === 1 ? 1 : 2);
    return (w - (cols - 1) * gap) / cols;
  };
  for (const vw of [320, 390, 479, 480, 639, 640, 700, 767, 768, 899, 900, 1023, 1024, 1100, 1199, 1200, 1279, 1280, 1366, 1439, 1440, 1920]) {
    for (const count of [1, 2, 3, 4, 5, 6, 9]) {
      assert.ok(sizesAt(v5CardGridSizes(count), vw) >= drawn(vw, count, "cardGrid") - 1, `cardGrid x${count} at ${vw}px`);
      assert.ok(sizesAt(v5CardGridSizes(), vw) >= drawn(vw, count, "cardGrid") - 1, `cardGrid (unknown count) x${count} at ${vw}px`);
      assert.ok(sizesAt(v5CardGridSizes(count, { grid: "cardGrid2", narrow: true }), vw) >= drawn(vw, count, "cardGrid2", true) - 1, `related cardGrid2 x${count} at ${vw}px`);
    }
    const horizontal = vw < 640 ? content(vw) : vw < 900 ? 0.38 * content(vw) : vw < 1280 ? (content(vw) - 20) / 2 : 0.38 * (content(vw) - 20) / 2;
    assert.ok(sizesAt(V5_HORIZONTAL_CARD_SIZES, vw) >= horizontal - 1, `horizontal card at ${vw}px`);
  }
  assert.equal(sizesAt(v5CardGridSizes(2), 1440), 630, "two cards at 1440 draw 630px wide, not 400px");
  assert.equal(sizesAt(v5CardGridSizes(3), 1440), 414);
  for (const file of ["features/home/v5/V5Home.tsx", "features/blog/v5/V5BlogIndex.tsx", "features/blog/v5/V5Category.tsx", "features/blog/v5/V5Article.tsx", "features/ci-planning/v5/V5CiPlanning.tsx", "features/financial-health-check/v5/V5Fhc.tsx", "features/money-story/v5/V5MoneyStory.tsx"]) {
    assert.doesNotMatch(read(file), /<V5ArticleCard[^>]*sizes="/, `${file}: card sizes come from the grid helper`);
  }
});

test("Polish: the late share count never moves the article header; Thai labels stay on one line; the phone hero is tighter", () => {
  const blog = read("features/blog/v5/V5Blog.module.css");
  assert.match(read("features/blog/v5/V5Article.tsx"), /<V5LegacyBridge className=\{styles\.metaSummary\}><ArticleEngagementSummary readingMinutes=\{readingMinutes\} \/><\/V5LegacyBridge>/);
  assert.match(blog, /\.metaSummary\.metaSummary \{ order: 1; flex-basis: 100%; min-height: 22px; \}/);
  assert.match(blog, /\.metaDates \{ flex: 1 1 320px; min-width: 0;/);
  assert.doesNotMatch(read("features/blog/v5/ArticleWidgets.module.css").replace(/\/\*[\s\S]*?\*\//g, ""), /articleReadingEstimate \{ flex-basis: 100%/, "the share count joins the reading-time line instead of adding one");
  assert.match(blog, /@media \(min-width: 1280px\) \{ \.readingGrid:has\(> \.tocAside\) \{ grid-template-columns: minmax\(260px, 392px\) minmax\(0, 720px\); \} \}/);
  assert.match(blog, /@media \(min-width: 1280px\) \{ \.tocMobile \{ display: none; \} \}/);
  const tool = read("components/layout/v5/V5Tool.module.css");
  assert.match(tool, /\.calcScope :global\(:is\(\.gold-button, \.glass-button\):not\(\.w-full\)\) \{ flex-shrink: 0; max-width: 100%; \}/);
  assert.match(tool, /\.calcScope :global\(\.justify-between:has\(> \.glass-button\)\) \{ flex-wrap: wrap; \}/);
  assert.match(tool, /@media \(max-width: 1023px\) \{ \.toc \{ padding: 16px;/);
  assert.match(tool, /\.legalGrid \{ grid-template-columns: 256px minmax\(0, 720px\);/);
  const home = read("features/home/v5/V5Home.module.css");
  assert.match(home, /\.heroGrid \{[^}]*min-height: 840px;[^}]*padding-block: 96px;/, "approved desktop cutout composition reserves its hero height");
  assert.match(home, /\.portrait \{ position: relative; order: -1; height: 320px;/, "approved mobile portrait leads the hero");
  assert.match(home, /\.credentials \{[^}]*grid-auto-flow: column;[^}]*overflow-x: auto;/, "all credential flip cards remain available in the native phone strip");
  assert.match(home, /\.homeSection\.homeSection \{ padding-block: 24px; \}/, "density is scoped to Home, not shared section tokens");
  assert.match(home, /\.portrait::before \{[^}]*border-radius: 999px 999px 0 0;[^}]*box-shadow: 0 10px 24px/, "approved arch keeps its shadow and reaches the portrait base");
  assert.match(read("components/layout/v5/V5LicenceFlip.module.css"), /\.line \{ display: flex; flex-wrap: wrap; align-items: baseline; column-gap: 8px; \}/);
});

test("LINE chat dock stays usable above the cookie notice: the notice's inert boundary skips the chat layer only (owner bug 2026-10-26)", () => {
  // The cookie notice (protected, not edited) makes every node outside itself inert. Its exact loop is run
  // here from its own source, so this test follows the real notice rather than a copy of it.
  const consent = read("features/analytics/components/CookieConsent.tsx");
  const loop = consent.match(/    const inerted: Array<[\s\S]*?\n      branch = branch\.parentElement;\n    \}\n/)?.[0];
  assert.ok(loop, "CookieConsent still inerts the page around the notice; re-check the dock's chat layer if this changes");
  const runNotice = new Function("dialog", "window", "document", `${transformSync(loop, { loader: "ts" }).code}\nreturn inerted;`) as (dialog: Element, window: unknown, document: unknown) => Array<{ node: HTMLElement; value: boolean }>;

  const { JSDOM } = createRequire(import.meta.url)("jsdom");
  const dom = new JSDOM(`<!doctype html><body><a class="skip" href="#main-content">skip</a><div class="root"><header><a href="/">home</a></header><main id="main-content"><a data-v5-chat-link href="https://lin.ee/x">LINE</a></main><footer></footer>
    <div data-v5-chat-layer><div data-v5-chat-dock><a id="trigger" href="https://line.me/R/oaMessage/%40ccpun/?x">LINE</a></div><div class="backdrop"></div><div id="v5-chat-panel" role="dialog"><button>close</button><a data-chat-topic href="https://line.me/R/oaMessage/%40ccpun/?a">a</a><a data-chat-topic href="https://line.me/R/oaMessage/%40ccpun/?b">b</a></div></div>
  </div><script></script><div role="dialog" aria-labelledby="cookie-title" aria-modal="true"><button>accept</button></div></body>`);
  const { window } = dom;
  // jsdom has no HTMLElement.inert; browsers reflect it to the inert attribute.
  Object.defineProperty(window.HTMLElement.prototype, "inert", { configurable: true, get(this: HTMLElement) { return this.hasAttribute("inert"); }, set(this: HTMLElement, value: boolean) { this.toggleAttribute("inert", Boolean(value)); } });
  const doc = window.document;
  const $ = (selector: string) => doc.querySelector(selector) as HTMLElement;
  const inInert = (selector: string) => Boolean($(selector).closest("[inert]"));
  const notice = $('[role="dialog"][aria-labelledby^="cookie"]');

  const noticeRecords = runNotice(notice, window, doc);
  assert.ok(inInert("[data-chat-topic]") && inInert("#trigger"), "baseline: the notice makes the dock and its panel inert (the reported bug)");

  const exempted: InertRecord[] = [];
  exemptFromInert($("[data-v5-chat-layer]"), exempted);
  for (const selector of ["#trigger", "#v5-chat-panel", "#v5-chat-panel button", "[data-chat-topic]", ".backdrop"]) assert.equal(inInert(selector), false, `${selector} is not inside an inert subtree`);
  for (const selector of ["header a", "main [data-v5-chat-link]", "footer", ".skip"]) assert.equal(inInert(selector), true, `${selector} stays inert behind the notice`);
  assert.equal(inInert('[role="dialog"][aria-labelledby^="cookie"] button'), false, "the notice itself stays usable");
  exemptFromInert($("[data-v5-chat-layer]"), exempted);
  assert.equal(exempted.length, 3, "idempotent: header, main and footer are recorded once");

  // Notice closes: it restores its own values, the dock restores the ones it set; nothing stays inert.
  for (const { node, value } of noticeRecords) node.inert = value;
  restoreInert(exempted);
  assert.equal(doc.querySelectorAll("[inert]").length, 0);

  // The dock applies this while the notice is open (watching inert as well as the notice), and undoes it after.
  const dock = read("components/layout/v5/V5ChatDock.tsx");
  assert.match(dock, /if \(dialog && layerRef\.current\) exemptFromInert\(layerRef\.current, exempted\);\n      else if \(!dialog\) restoreInert\(exempted\);/);
  assert.match(dock, /mutations\.observe\(document\.body, \{ childList: true, subtree: true, attributes: true, attributeFilter: \["inert"\] \}\);/);
  assert.equal((dock.match(/<div ref=\{layerRef\} className=\{styles\.layer\} style=\{style\} data-v5-chat-layer="">/g) ?? []).length, 2, "dock and panel share one chat layer, with or without the panel switched on");
  assert.match(dock, /\{panel \? <Suspense fallback=\{null\}><V5ChatPanel [^\n]*\n    <\/div>/, "the panel renders inside the chat layer");
  assert.doesNotMatch(consent, /exemptFromInert|data-v5-chat/, "the cookie notice itself is unchanged");

  // Stacking: the open panel (and its backdrop) sit above the notice; the closed dock stays below it.
  const css = read("components/layout/v5/V5ChatDock.module.css");
  const noticeZ = Number(consent.match(/fixed bottom-0 left-0 right-0 z-\[(\d+)\]/)?.[1]);
  const z = (selector: string) => Number(css.match(new RegExp(`\\.${selector} \\{[^}]*z-index: (\\d+)`))?.[1]);
  assert.ok(noticeZ > 0);
  assert.ok(z("panel") > noticeZ && z("backdrop") > noticeZ && z("panel") > z("backdrop"), "open panel above the cookie notice");
  assert.ok(z("dock") < noticeZ, "the closed dock never covers the notice");
  assert.match(css, /\.layer \{ display: contents; \}/);
  assert.match(css, /--v5-panel-lift: clamp\(0px, var\(--v5-dock-offset, 0px\), max\(0px, 100vh - 720px\)\);/, "desktop panel rises with the dock only as far as it still fits");

  // While open, the panel is the top layer: it keeps Escape, Tab and focus for its own controls.
  const panel = read("components/layout/v5/V5ChatPanel.tsx");
  assert.match(panel, /window\.addEventListener\("keydown", onKeyDown, true\);/);
  assert.match(panel, /const keepFocus = \(event: FocusEvent\) => \{ if \(dialog\.contains\(event\.target as Node\)\) event\.stopPropagation\(\); \};/);
  assert.match(panel, /if \(event\.key === "Escape"\) \{ event\.preventDefault\(\); event\.stopPropagation\(\); onClose\(\); return; \}/);

  // Owner requirement 2026-10-26: the chat never depends on consent. Topics are plain line.me links (same tab on
  // touch devices, where the LINE app takes over); analytics stay consent-gated inside trackEvent and are
  // fire-and-forget, so nothing in the dock or panel reads consent before opening the panel or the link.
  assert.match(panel, /const \[newTab\] = useState\(\(\) => !window\.matchMedia\("\(pointer: coarse\)"\)\.matches\);/);
  assert.match(panel, /href=\{topic\.href\} target=\{newTab \? "_blank" : undefined\} rel="noopener noreferrer"/);
  assert.match(panel, /try \{\n\s+trackEvent\("line_oa_click"/);
  assert.doesNotMatch(panel, /preventDefault\(\)[^\n]*\n[^\n]*trackEvent\("line_oa_click"|await trackEvent|trackEvent\([^)]*\)\.then/, "the topic link is never held back for analytics");
  assert.doesNotMatch(dock, /getConsentData|ccpun_cookie_consent/, "opening the panel does not read consent");
  assert.equal((panel.match(/getConsentData\(\)/g) ?? []).length, 1, "the panel reads consent only for the L3 campaign follow-through");
  assert.match(read("components/layout/v5/V5ChatDockServer.tsx"), /resolveChatPanel\(\{ \.\.\.context, config, now, consentGiven: false \}\)/, "the no-JS link carries the page prefill without consent");
});


test("C17: mobile LINE trigger is a named 56px circle with safe footer room; desktop and motion stay intact", () => {
  const css = read("components/layout/v5/V5ChatDock.module.css");
  const dock = read("components/layout/v5/V5ChatDock.tsx");
  assert.match(css, /@media \(max-width: 1023px\) \{[\s\S]*?\.trigger \{ width: 56px; height: 56px; min-height: 56px; padding: 0; border-radius: 50%; box-shadow: var\(--v5-shadow\); \}/);
  assert.match(css, /\.trigger svg \{ width: 24px; height: 24px; \}/);
  assert.match(css, /\.triggerLabel \{ position: absolute; width: 1px; height: 1px;[^}]*clip-path: inset\(50%\); white-space: nowrap;/);
  assert.equal((dock.match(/<ChatIcon \/><span className=\{styles.triggerLabel\}>\{LABEL\}<\/span>/g) ?? []).length, 2);
  assert.match(dock, /const LABEL = "คุยกับปั้นทาง LINE";/);
  assert.match(css, /@media \(min-width: 1024px\) \{\s*\.dock \{ inset: auto 32px 32px auto;/);
  assert.match(css, /\.trigger \{ width: auto; box-shadow: var\(--v5-shadow\); \}/);
  assert.match(read("components/layout/v5/V5.module.css"), /@media \(max-width: 1023px\) \{ \.footer \{ padding-bottom: calc\(80px \+ env\(safe-area-inset-bottom, 0px\)\); \} \}/);
});

// Reviewed UAT favicon admission must never admit unrelated SEO or Production metadata changes.
test("UAT favicon successor reconstructs both frozen owners and rejects metadata drift", () => {
  const sha = (source: string) => createHash("sha256").update(source).digest("hex");
  const fixtures = [
    {
      file: "apps/web/app/layout.tsx",
      prior: "9a7dceb0615ae610ecafe80a0937547b9a6c6c8b422688e443ba763970cc3ab8",
      current: `    ...(IS_WEB_REVIEW_ENVIRONMENT ? {
      icons: {
        icon: { url: "/assets/ccpun-favicon-v5-7253e60c.png", type: "image/png", sizes: "256x256" },
        apple: { url: "/assets/ccpun-favicon-v5-7253e60c.png", type: "image/png", sizes: "256x256" },
      },
    } : {}),
`,
      original: "",
    },
    {
      file: "apps/web/app/page.tsx",
      prior: "8869beb97ac0043193080c85a88b8c2374823f80874c2afee49259c0a1c3acbc",
      current: `  const defaults = buildSiteRootMetadata({ admin: false, review: IS_WEB_REVIEW_ENVIRONMENT });
  if (IS_WEB_REVIEW_ENVIRONMENT) delete defaults.icons;
  return resolvePageSeoMetadata("/", defaults, parent);`,
      original: `  return resolvePageSeoMetadata("/", buildSiteRootMetadata({ admin: false, review: IS_WEB_REVIEW_ENVIRONMENT }), parent);`,
    },
  ] as const;
  for (const { file, prior, current, original } of fixtures) {
    const source = read(file);
    assert.equal(source.split(current).length, 2, "one exact approved metadata-only transition");
    assert.equal(sha(source.replace(current, original)), prior, "all predecessor source bytes retained");
    assert.equal(websiteV5PhaseASources[file].after, prior, "historical v5 pin stays frozen");
    assert.equal(isWebsiteV5ReviewedSuccessor(file, source), true);
    assert.equal(websiteV5PredecessorDigest(file, source), websiteV5PhaseASources[file].before);
    assert.equal(assertProductionCmsOwner(file, source), true, "existing Production CMS proof admits only this reviewed successor");
    for (const changed of [source + "\n", source.replace("IS_WEB_REVIEW_ENVIRONMENT", "true"), source.replace("https://ccpun.com", "https://example.org")]) {
      if (changed === source) continue;
      assert.equal(isWebsiteV5ReviewedSuccessor(file, changed), false);
      assert.throws(() => assertProductionCmsOwner(file, changed));
    }
  }
});


test("Owner review: v5 split countdown keeps all four units and accessible values; TOC disclosure preserves anchors", async () => {
  const require = createRequire(import.meta.url);
  const { createElement } = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const { JSDOM } = require("jsdom");
  const loadComponent = (file: string) => {
    const built = buildSync({ entryPoints: [fileURLToPath(new URL(`../${file}`, import.meta.url))], bundle: true, write: false, outfile: "/private/tmp/v5-component-check.cjs", platform: "node", format: "cjs", packages: "external", jsx: "automatic", loader: { ".css": "empty" }, logLevel: "silent" }).outputFiles[0].text;
    const compiledModule = { exports: {} as { default: unknown } };
    new Function("require", "module", "exports", built)(require, compiledModule, compiledModule.exports);
    return compiledModule.exports.default;
  };
  const render = (component: unknown, props: object) => new JSDOM(renderToStaticMarkup(createElement(component, props))).window.document;
  const countdown = loadComponent("components/ui/health-happy/HealthHappyCountdown.tsx");
  const tiles = render(countdown, { placement: "home", splitDigits: true });
  const legacy = render(countdown, { placement: "home" });
  assert.equal(tiles.querySelectorAll('[data-countdown-style="tiles"] [role="timer"] strong').length, 4);
  for (const value of tiles.querySelectorAll('[role="timer"] strong')) {
    assert.equal(value.firstElementChild?.textContent, "--", "one accessible SSR placeholder per unit");
    assert.equal(value.querySelector('[aria-hidden="true"]')?.children.length, 2, "each visual unit has two split tiles");
  }
  assert.equal(legacy.querySelector('[data-countdown-style="tiles"]'), null, "legacy placements do not opt into the new presentation");
  assert.deepEqual([...tiles.querySelectorAll('a')].map((a) => a.getAttribute("href")), [...legacy.querySelectorAll('a')].map((a) => a.getAttribute("href")), "actions and destinations remain identical");
  const toc = render(loadComponent("features/blog/v5/V5ArticleToc.tsx"), { groups: [{ primary: { id: "h2-a", label: "Main A" }, children: [{ id: "h3-a", label: "Child A" }, { id: "h3-b", label: "Child B" }] }, { primary: { id: "h2-b", label: "Main B" }, children: [] }] });
  assert.deepEqual([...toc.querySelectorAll('a')].map((a) => a.getAttribute("href")), ["#h2-a", "#h3-a", "#h3-b", "#h2-b"]);
  const toggle = toc.querySelector("button")!;
  assert.equal(toc.querySelectorAll("button").length, 1, "a heading without children has no empty control");
  assert.equal(toggle.getAttribute("aria-expanded"), "false");
  assert.equal(toc.getElementById(toggle.getAttribute("aria-controls")!)?.hasAttribute("hidden"), true);
  assert.equal(toc.querySelector("a button"), null, "the toggle is separate from the navigable H2 link");
  const dom = new JSDOM('<div id="toc-root"></div>', { url: 'https://test.ccpun.com/blog/health-insurance/example/#h3-a', pretendToBeVisual: true });
  const browserGlobals = { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true };
  const originals = new Map(Object.keys(browserGlobals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(browserGlobals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const { act } = require("react");
  const { createRoot } = require("react-dom/client");
  const mounted = createRoot(dom.window.document.getElementById("toc-root"));
  try {
    const groups = [{ primary: { id: "h2-a", label: "Main A" }, children: [{ id: "h3-a", label: "Child A" }] }, { primary: { id: "h2-b", label: "Main B" }, children: [] }];
    await act(async () => { mounted.render(createElement(loadComponent("features/blog/v5/V5ArticleToc.tsx"), { groups })); });
    const control = dom.window.document.querySelector('button')!;
    const childList = dom.window.document.getElementById(control.getAttribute('aria-controls')!)!;
    assert.equal(control.getAttribute('aria-expanded'), 'true', "arrival at an H3 hash reveals its branch");
    assert.equal(childList.hidden, false);
    assert.equal(dom.window.document.querySelector('a[aria-current="location"]')?.getAttribute('href'), '#h3-a');
    await act(async () => { control.click(); });
    assert.equal(control.getAttribute('aria-expanded'), 'false');
    assert.equal(childList.hidden, true);
    await act(async () => { control.click(); });
    assert.equal(childList.hidden, false, "the same native button opens and closes the navigation branch");
    assert.equal(dom.window.document.querySelector('a[href="#h2-a"]')?.getAttribute('href'), '#h2-a');
  } finally {
    await act(async () => { mounted.unmount(); });
    for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
    dom.window.close();
  }
});
