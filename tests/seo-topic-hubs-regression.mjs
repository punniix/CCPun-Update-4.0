import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const taxonomy = await read('lib/content/taxonomy.ts');
const categoryRegistry = await read('lib/content/category-registry.ts');
const categoryRegistrySanity = await read('lib/content/category-registry-sanity.ts');
const types = await read('lib/content/types.ts');
const sanity = await read('lib/content/sanity.ts');
const sanitySchema = await read('lib/content/sanity-schema.ts');
const urls = await read('lib/content/url.ts');
const schema = await read('lib/content/structured-data/article-schema.ts');
const articleSanitySchema = await read('cms/sanity/schema/documents/article.ts');
const categorySanitySchema = await read('cms/sanity/schema/documents/category.ts');
const blogPage = await read('features/blog/pages/BlogArchivePage.tsx');
const categoryPage = await read('features/blog/pages/BlogCategoryPage.tsx');
const articlePage = await read('features/blog/pages/ArticlePage.tsx');
const articlePresentation = await read('features/blog/website-43/Website43Article.tsx');
const blogPresentation = await read('features/blog/website-43/Website43Blog.tsx');
const blogInteractive = await read('features/blog/website-43/Website43BlogInteractive.tsx');
const blogData = await read('features/blog/website-43/blogData.ts');
const sitemap = await read('app/sitemaps/blog.xml/route.ts');

for (const slug of ['personal-finance', 'life-insurance', 'health-insurance', 'critical-illness-insurance', 'investment']) {
  assert.match(taxonomy, new RegExp(`slug: ["']${slug}["']`));
}
assert.match(taxonomy, /slug: "investment"[\s\S]*?indexable: false/);
assert.match(taxonomy, /"aia-health-happy-describe": "health-insurance"/);
assert.match(taxonomy, /"aia-health-ci-hero-guide": "health-insurance"/);
assert.match(taxonomy, /"critical-illness-insurance": "critical-illness-insurance"/);
assert.match(taxonomy, /"what-is-critical-illness-insurance": "critical-illness-insurance"/);
assert.match(taxonomy, /"aia-vitality": "life-insurance"/);
assert.match(taxonomy, /"critical-illness": "critical-illness-insurance"/);

// Physical categories are no longer enumerated in taxonomy/presentation. Sanity
// Category Registry owns public physical category activation and URL availability.
// The Critical Illness zero-downtime migration remains semantic/redirect policy
// until its future Sanity Category is actually activated.
assert.doesNotMatch(taxonomy, /ACTIVE_ARTICLE_CATEGORIES/);
assert.doesNotMatch(blogPresentation, /ACTIVE_ARTICLE_CATEGORIES|BLOG_TOPIC_HUBS/);
assert.match(categoryRegistry, /CATEGORY_STATUS_VALUES = \["draft", "active"\]/);
assert.match(categoryRegistry, /getCategoryCanonical/);
assert.match(categoryRegistry, /resolveCategoryRoute/);
assert.match(categoryRegistry, /redirect-loop/);
assert.match(categoryRegistrySanity, /_type == "category"/);
assert.match(categoryRegistrySanity, /listCategoryRegistry/);
assert.match(categorySanitySchema, /name: "status"/);
assert.match(categorySanitySchema, /value: "draft"/);
assert.match(categorySanitySchema, /value: "active"/);
assert.match(categorySanitySchema, /name: "redirectTo"/);
assert.match(articleSanitySchema, /filter: "status == 'active'"/);

// Explicit Semantic Topic remains a separate semantic/SEO layer. Protected slug
// overrides still win so winner-page semantics cannot be changed accidentally.
assert.match(types, /semanticTopic\?: string/);
assert.match(sanitySchema, /semanticTopic: z\.string\(\)\.min\(1\)\.nullish\(\)/);
assert.match(sanity, /semanticTopic: raw\.seo\?\.semanticTopic \?\? undefined/);
assert.match(taxonomy, /semanticTopic\?: string \| null/);
const overrideResolution = taxonomy.indexOf('const override = articleSlug');
const explicitResolution = taxonomy.indexOf('const explicitTopic = semanticTopic');
assert.ok(overrideResolution >= 0 && explicitResolution > overrideResolution, 'protected slug semantic overrides must precede editable CMS Semantic Topic');
assert.match(taxonomy, /CATEGORY_SLUG_ALIASES\[explicitTopic\] \?\? explicitTopic/);
for (const surface of [categoryPage, articlePresentation, blogData, schema, sitemap]) {
  assert.match(surface, /semanticTopic: article\.semanticTopic/);
}

// Winner-page migrations keep historical paths one-hop and gate the new Critical
// Illness article redirect on the final target actually being published.
assert.match(urls, /"life-insurance\/aia-health-happy-describe": "\/blog\/health-insurance\/aia-health-happy-describe\/"/);
assert.match(urls, /"life-insurance\/aia-health-ci-hero-guide": "\/blog\/health-insurance\/aia-health-ci-hero-guide\/"/);
assert.match(urls, /"life-insurance\/critical-illness-insurance": "\/blog\/critical-illness-insurance\/what-is-critical-illness-insurance\/"/);
assert.match(urls, /"critical-illness\/critical-illness-insurance": "\/blog\/critical-illness-insurance\/what-is-critical-illness-insurance\/"/);
assert.match(urls, /"critical-illness": "\/blog\/critical-illness-insurance\/"/);
assert.doesNotMatch(urls, /ADDITIONAL_PUBLIC_CATEGORIES/);
assert.match(articlePage, /getMovedArticleRedirectPath\(category, slug\)/);
assert.match(articlePage, /movedTargetArticle\?\.status === "published"/);

// Physical registry resolution happens before semantic-only hub fallback. Draft
// registry owners cannot accidentally fall through and become public semantic hubs.
assert.match(categoryPage, /resolveCategoryRoute\(registry, slug, \{ includeDrafts \}\)/);
assert.match(categoryPage, /if \(resolution\.kind === "hidden"\) notFound\(\)/);
assert.match(categoryPage, /if \(resolution\.kind === "category"\)/);
assert.match(categoryPage, /articleBelongsToPhysicalCategory\(article, category\)/);
assert.match(categoryPage, /const hub = getBlogTopicHub\(slug\);[\s\S]*getLegacyCategoryRedirectPath/);
assert.match(categoryPage, /getCategoryCanonical\(category\.slug\)/);
assert.match(categoryPage, /!includeDrafts[\s\S]*category\.status === "active"/);
assert.match(categoryPage, /const shouldIndexHub = !includeDrafts && hub\.indexable/);
assert.match(categoryPage, /activeCategorySlug=\{category\.slug\}/);
assert.match(categoryPage, /activeCategorySlug=\{hub\.slug\}/);
assert.match(categoryPage, /heroDescription=\{category\.description \?\? hub\?\.description\}/);
assert.match(categoryPage, /heroDescription=\{hub\.description\}/);
assert.match(categoryPage, /topicContent=\{buildTopicIntro\(hub\)\}/);
assert.match(categoryPage, /hub\.intro\.map/);
assert.match(categoryPage, /styles\.storyCopy/);
assert.match(blogPresentation, /heroDescription\?: string/);
assert.match(blogPresentation, /<p>\{heroDescription\}<\/p>/);
assert.match(categoryPage, /categories=\{categoryMenu\(registry, includeDrafts\)\}/);

// Article routing/canonical functions stay intact while visible topic navigation is semantic.
assert.match(articlePage, /getArticleCategorySlug\(article\)/);
assert.match(articlePresentation, /getArticleSemanticTopic/);
assert.match(articlePresentation, /href=\{topicHref\}/);
assert.doesNotMatch(articlePage, /\/blog\/\?category=/);
assert.match(blogData, /const articlePath = getArticlePath\(article\)/);
assert.match(blogData, /getArticleSemanticTopic/);

// JSON-LD uses semantic hub but mainEntityOfPage remains canonical.
assert.match(schema, /mainEntityOfPage: canonical/);
assert.match(schema, /articleSection: sectionName/);
assert.match(schema, /item: sectionUrl/);
assert.doesNotMatch(schema, /\/blog\/\?category=/);
assert.match(schema, /"@type": "CollectionPage"/);
assert.match(schema, /"@type": "ItemList"/);

// Sitemap reads the same physical registry, emits active physical categories
// only when they own an indexable article, then dedupes semantic hub URLs.
assert.match(sitemap, /listCategoryRegistry\(\{ includeDrafts: false \}\)/);
assert.match(sitemap, /categoryRegistry\.active\.flatMap/);
assert.match(sitemap, /articleBelongsToPhysicalCategory\(article, category\)/);
assert.match(sitemap, /getCategoryCanonical\(category\.slug\)/);
assert.match(sitemap, /if \(!hub\.indexable\) return \[\]/);
assert.match(sitemap, /uniqueSortedEntries/);
assert.doesNotMatch(sitemap, /\?category=|\?tag=/);

// Main Blog dropdown is injected from the server-side registry; query filters
// remain UX state and are never canonical SEO destinations.
assert.match(blogPage, /listCategoryRegistry/);
assert.match(blogPage, /listCategoryMenuEntries/);
assert.match(blogPage, /categories=\{categories\}/);
assert.doesNotMatch(blogPage, /BLOG_TOPIC_HUBS/);
assert.match(blogPresentation, /categories\?: Website43BlogCategoryItem\[\]/);
assert.match(blogPresentation, /ทุกหมวดหมู่/);
assert.match(blogInteractive, /nativeReplaceState\.call\(window\.history/);
assert.match(blogInteractive, /url\.searchParams\.set\('q'/);
assert.match(blogPage, /filters\.category/);
assert.match(blogPage, /filters\.tag/);

console.log('PASS: SEO topic hub + Sanity Category Registry regression');
