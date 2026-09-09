import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildArticleSchemaGraph, buildBlogTopicHubSchema } from "../../lib/content/structured-data/article-schema";
import {
  BLOG_TOPIC_HUBS,
  getArticleSemanticTopic,
  getBlogTopicHub,
  isArticleInSemanticTopic,
} from "../../lib/content/taxonomy";
import type { Article } from "../../lib/content/types";
import { getArticleCanonical, getArticlePath, getMovedArticleRedirectPath } from "../../lib/content/url";

function article(overrides: Partial<Article>): Article {
  return {
    id: "article-test",
    slug: "example",
    title: "Example",
    excerpt: "Example excerpt",
    category: "ประกันชีวิต",
    categorySlug: "life-insurance",
    tags: [],
    authorName: "CCPun",
    status: "published",
    publishedAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-23T00:00:00.000Z",
    seoTitle: "Example | CCPun",
    seoDescription: "Example description",
    noindex: false,
    body: [],
    ...overrides,
  };
}

function source(relativePath: string) {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}

test("Phase 1 exposes five real topic hubs while investment remains non-indexable", () => {
  assert.deepEqual(BLOG_TOPIC_HUBS.map(({ slug }) => slug), [
    "personal-finance",
    "life-insurance",
    "health-insurance",
    "critical-illness",
    "investment",
  ]);
  assert.equal(getBlogTopicHub("health-insurance")?.indexable, true);
  assert.equal(getBlogTopicHub("critical-illness")?.indexable, true);
  assert.equal(getBlogTopicHub("investment")?.indexable, false);
  assert.equal(getBlogTopicHub("unknown"), null);
});

test("Health winner pages use Health as both semantic topic and physical canonical owner", () => {
  const healthHappy = article({ slug: "aia-health-happy-describe", tags: ["ประกันสุขภาพ"] });
  const healthCiHero = article({ slug: "aia-health-ci-hero-guide", tags: ["ประกันชีวิต", "ประกันสุขภาพ", "ประกันโรคร้ายแรง"] });
  const critical = article({ slug: "critical-illness-insurance", tags: ["ประกันชีวิต", "ประกันสุขภาพ", "ประกันโรคร้ายแรง"] });
  const vitality = article({ slug: "aia-vitality", tags: ["ประกันชีวิต", "ประกันสุขภาพ", "ประกันโรคร้ายแรง"] });

  assert.equal(getArticleSemanticTopic({ articleSlug: healthHappy.slug, categoryTitle: healthHappy.category, categorySlug: healthHappy.categorySlug, tags: healthHappy.tags })?.slug, "health-insurance");
  assert.equal(getArticleSemanticTopic({ articleSlug: healthCiHero.slug, categoryTitle: healthCiHero.category, categorySlug: healthCiHero.categorySlug, tags: healthCiHero.tags })?.slug, "health-insurance");
  assert.equal(getArticleSemanticTopic({ articleSlug: critical.slug, categoryTitle: critical.category, categorySlug: critical.categorySlug, tags: critical.tags })?.slug, "critical-illness");
  assert.equal(getArticleSemanticTopic({ articleSlug: vitality.slug, categoryTitle: vitality.category, categorySlug: vitality.categorySlug, tags: vitality.tags })?.slug, "life-insurance");

  assert.equal(getArticlePath(healthHappy), "/blog/health-insurance/aia-health-happy-describe/");
  assert.equal(getArticlePath(healthCiHero), "/blog/health-insurance/aia-health-ci-hero-guide/");
  assert.equal(getArticlePath(critical), "/blog/life-insurance/critical-illness-insurance/");
  assert.equal(getArticleCanonical(healthHappy), "https://ccpun.com/blog/health-insurance/aia-health-happy-describe/");
});

test("controlled moved article redirects point one hop to their approved terminal owner", () => {
  const moved = [
    ["life-insurance", "aia-health-happy-describe", "/blog/health-insurance/aia-health-happy-describe/"],
    ["life-insurance", "aia-health-ci-hero-guide", "/blog/health-insurance/aia-health-ci-hero-guide/"],
    ["critical-illness", "critical-illness-insurance", "/blog/life-insurance/critical-illness-insurance/"],
  ] as const;

  for (const [category, slug, target] of moved) {
    assert.equal(getMovedArticleRedirectPath(category, slug), target);
    const segments = target.split("/").filter(Boolean);
    assert.equal(getMovedArticleRedirectPath(segments[1]!, segments[2]!), null, `${target} must be a terminal redirect target`);
  }

  assert.equal(getMovedArticleRedirectPath("health-insurance", "aia-health-happy-describe"), null);
  assert.equal(getMovedArticleRedirectPath("health-insurance", "aia-health-ci-hero-guide"), null);
  assert.equal(getMovedArticleRedirectPath("life-insurance", "critical-illness-insurance"), null);
});

test("article schema uses Health canonical and semantic topic for Health winner pages", () => {
  const healthHappy = article({ slug: "aia-health-happy-describe", title: "AIA Health Happy", tags: ["ประกันสุขภาพ"] });
  const schema = buildArticleSchemaGraph(healthHappy);
  assert.ok(schema);
  const graph = schema["@graph"] as Array<Record<string, unknown>>;
  const posting = graph.find((node) => node["@type"] === "BlogPosting")!;
  const breadcrumb = graph.find((node) => node["@type"] === "BreadcrumbList")!;
  const items = breadcrumb.itemListElement as Array<Record<string, unknown>>;

  assert.equal(posting.mainEntityOfPage, "https://ccpun.com/blog/health-insurance/aia-health-happy-describe/");
  assert.equal(posting.articleSection, "ประกันสุขภาพ");
  assert.equal(items[2]?.name, "ประกันสุขภาพ");
  assert.equal(items[2]?.item, "https://ccpun.com/blog/health-insurance/");
  assert.equal(items[3]?.item, "https://ccpun.com/blog/health-insurance/aia-health-happy-describe/");
});

test("hub ItemList links to the final Health canonical URL", () => {
  const hub = getBlogTopicHub("health-insurance")!;
  const healthHappy = article({ slug: "aia-health-happy-describe", title: "AIA Health Happy", tags: ["ประกันสุขภาพ"] });
  assert.equal(isArticleInSemanticTopic({ articleSlug: healthHappy.slug, categoryTitle: healthHappy.category, categorySlug: healthHappy.categorySlug, tags: healthHappy.tags }, "health-insurance"), true);

  const schema = buildBlogTopicHubSchema(hub, [healthHappy]);
  const graph = schema["@graph"] as Array<Record<string, unknown>>;
  const itemList = graph.find((node) => node["@type"] === "ItemList")!;
  const items = itemList.itemListElement as Array<Record<string, unknown>>;
  assert.equal(items[0]?.url, "https://ccpun.com/blog/health-insurance/aia-health-happy-describe/");
});

test("hub route resolves real hubs before any legacy one-segment redirect fallback", () => {
  const categoryPage = source("features/blog/pages/BlogCategoryPage.tsx");
  const hubLookup = categoryPage.indexOf("const hub = getBlogTopicHub(slug)");
  const legacyFallback = categoryPage.indexOf("getLegacyCategoryRedirectPath(slug)");
  assert.ok(hubLookup >= 0, "topic hub lookup is missing");
  assert.ok(legacyFallback > hubLookup, "topic hubs must be resolved before legacy redirect fallback");
  assert.match(categoryPage, /alternates:\s*\{ canonical \}/);
  assert.match(categoryPage, /robots:\s*!isEnabled && shouldIndexHub/);
  assert.match(categoryPage, /buildBlogTopicHubSchema\(hub, relevantIndexableArticles\)/);
  assert.match(categoryPage, /href=\{hub\.featuredLink\.href\}/);
});

test("visible and JSON-LD article breadcrumbs never use query-filter URLs as SEO nodes", () => {
  const articlePage = source("features/blog/pages/ArticlePage.tsx");
  const schemaSource = source("lib/content/structured-data/article-schema.ts");
  assert.doesNotMatch(articlePage, /\/blog\/\?category=/);
  assert.doesNotMatch(schemaSource, /\/blog\/\?category=/);
  assert.match(source("features/blog/website-43/Website43Article.tsx"), /href=\{topicHref\}/);
  assert.match(articlePage, /getMovedArticleRedirectPath\(category, slug\)/);
  assert.match(schemaSource, /articleSection:\s*sectionName/);
  assert.match(schemaSource, /item:\s*sectionUrl/);
});

test("Blog sitemap and navigation expose only useful indexable hub nodes", () => {
  const sitemap = source("app/sitemaps/blog.xml/route.ts");
  const blogPage = source("features/blog/pages/BlogArchivePage.tsx");
  const blogArchive = source("features/blog/components/BlogArchive.tsx");
  const articleCard = source("features/blog/components/ArticleCard.tsx");

  assert.match(sitemap, /articles\.filter\(isArticleCanonicalAligned\)/);
  assert.match(sitemap, /canonicalArticles\.filter/);
  assert.match(sitemap, /article\.status === "published"/);
  assert.match(sitemap, /article\.noindex !== true/);
  assert.match(sitemap, /if \(!hub\.indexable\) return \[\]/);
  assert.doesNotMatch(sitemap, /\?category=|\?tag=/);

  assert.match(blogPage, /BLOG_TOPIC_HUBS\.filter/);
  assert.match(blogPage, /hub\.indexable/);
  assert.match(blogPage, /isArticleCanonicalAligned\(article\)/);
  assert.match(blogPage, /aria-label="หัวข้อบทความหลัก"/);
  assert.doesNotMatch(blogArchive, /BLOG_TOPIC_HUBS/, "SEO hub navigation should be server-rendered by features/blog/pages/BlogArchivePage.tsx, not owned by the client filter component");

  assert.match(articleCard, /const href = getArticlePath\(article\)/);
  assert.match(articleCard, /getArticleSemanticTopic/);
});
