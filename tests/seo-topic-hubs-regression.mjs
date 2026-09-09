import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const taxonomy = await read('lib/content/taxonomy.ts');
const types = await read('lib/content/types.ts');
const sanity = await read('lib/content/sanity.ts');
const urls = await read('lib/content/url.ts');
const schema = await read('lib/content/structured-data/article-schema.ts');
const blogPage = await read('features/blog/pages/BlogArchivePage.tsx');
const categoryPage = await read('features/blog/pages/BlogCategoryPage.tsx');
const articlePage = await read('features/blog/pages/ArticlePage.tsx');
const articlePresentation = await read('features/blog/website-43/Website43Article.tsx');
const blogPresentation = await read('features/blog/website-43/Website43Blog.tsx');
const sitemap = await read('app/sitemaps/blog.xml/route.ts');

const card = await read('features/blog/components/ArticleCard.tsx');

for (const slug of ['personal-finance', 'life-insurance', 'health-insurance', 'critical-illness', 'investment']) {
  assert.match(taxonomy, new RegExp(`slug: ["']${slug}["']`));
}
assert.match(taxonomy, /slug: "investment"[\s\S]*?indexable: false/);
assert.match(taxonomy, /"aia-health-happy-describe": "health-insurance"/);
assert.match(taxonomy, /"aia-health-ci-hero-guide": "health-insurance"/);
assert.match(taxonomy, /"critical-illness-insurance": "critical-illness"/);
assert.match(taxonomy, /"aia-vitality": "life-insurance"/);

// Foundation cutover: Health is now a real physical article category. Critical Illness
// remains semantic-only until a separate physical URL migration is approved.
const activeCategoryBlock = taxonomy.match(/ACTIVE_ARTICLE_CATEGORIES = \[[\s\S]*?\] as const/)?.[0] ?? '';
for (const slug of ['personal-finance', 'life-insurance', 'health-insurance', 'investment']) {
  assert.match(activeCategoryBlock, new RegExp(slug));
}
assert.doesNotMatch(activeCategoryBlock, /critical-illness/);

// Explicit Semantic Topic is carried from Sanity into the public semantic layer, but protected
// slug overrides must win so winner-page semantics cannot be changed accidentally in the CMS.
assert.match(types, /semanticTopic\?: string/);
assert.match(sanity, /semanticTopic: z\.string\(\)\.min\(1\)\.nullish\(\)/);
assert.match(sanity, /semanticTopic: raw\.seo\?\.semanticTopic \?\? undefined/);
assert.match(taxonomy, /semanticTopic\?: string \| null/);
const overrideResolution = taxonomy.indexOf('const override = articleSlug');
const explicitResolution = taxonomy.indexOf('const explicitTopic = semanticTopic');
assert.ok(overrideResolution >= 0 && explicitResolution > overrideResolution, 'protected slug semantic overrides must precede editable CMS Semantic Topic');
for (const surface of [blogPage, categoryPage, articlePresentation, card, schema, sitemap]) {
  assert.match(surface, /semanticTopic: article\.semanticTopic/);
}

// Health winner pages now move old Life paths directly to their final Health owners.
assert.match(urls, /"life-insurance\/aia-health-happy-describe": "\/blog\/health-insurance\/aia-health-happy-describe\/"/);
assert.match(urls, /"life-insurance\/aia-health-ci-hero-guide": "\/blog\/health-insurance\/aia-health-ci-hero-guide\/"/);
assert.match(urls, /"critical-illness\/critical-illness-insurance": "\/blog\/life-insurance\/critical-illness-insurance\/"/);
assert.doesNotMatch(urls, /"health-insurance\/aia-health-happy-describe": "\/blog\/life-insurance/);
assert.doesNotMatch(urls, /"health-insurance\/aia-health-ci-hero-guide": "\/blog\/life-insurance/);

// Hub routing happens before the legacy one-segment redirect fallback.
assert.match(categoryPage, /const hub = getBlogTopicHub\(slug\);[\s\S]*if \(!hub\) \{[\s\S]*getLegacyCategoryRedirectPath/);
assert.match(categoryPage, /alternates: \{ canonical \}/);
assert.match(categoryPage, /const shouldIndexHub = hub\.indexable && relevantIndexableArticles\.length > 0/);
assert.match(categoryPage, /!isEnabled && shouldIndexHub \? \{ index: true, follow: true \} : \{ index: false, follow: true \}/);
assert.match(categoryPage, /const schema = shouldIndexHub \? buildBlogTopicHubSchema\(hub, relevantIndexableArticles\) : null/);
assert.match(categoryPage, /hub\.featuredLink\.href/);

// Article routing/canonical functions stay intact while visible topic navigation is semantic.
assert.match(articlePage, /getMovedArticleRedirectPath\(category, slug\)/);
assert.match(articlePage, /getArticleCategorySlug\(article\)/);
assert.match(articlePresentation, /getArticleSemanticTopic/);
assert.match(articlePresentation, /href=\{topicHref\}/);
assert.doesNotMatch(articlePage, /\/blog\/\?category=/);
assert.match(card, /const href = getArticlePath\(article\)/);
assert.match(card, /getArticleSemanticTopic/);

// JSON-LD uses semantic hub but mainEntityOfPage remains canonical.
assert.match(schema, /mainEntityOfPage: canonical/);
assert.match(schema, /articleSection: sectionName/);
assert.match(schema, /item: sectionUrl/);
assert.doesNotMatch(schema, /\/blog\/\?category=/);
assert.match(schema, /"@type": "CollectionPage"/);
assert.match(schema, /"@type": "ItemList"/);

// Sitemap includes useful canonical hubs/articles only, dedupes final URLs, and never exposes filters.
assert.match(sitemap, /if \(!hub\.indexable\) return \[\]/);
assert.match(sitemap, /if \(!relevant\.length\) return \[\]/);
assert.match(sitemap, /https:\/\/ccpun\.com\/blog\/\$\{hub\.slug\}\//);
assert.match(sitemap, /uniqueSortedEntries/);
assert.doesNotMatch(sitemap, /\?category=|\?tag=/);

// Main Blog page exposes indexable topic hubs as server-rendered internal links.
assert.match(blogPage, /const navigableHubs = BLOG_TOPIC_HUBS\.filter/);
assert.match(blogPage, /isArticleCanonicalAligned\(article\)/);
assert.match(blogPage, /href=\{`\/blog\/\$\{hub\.slug\}\/`\}/);
assert.match(blogPage, /navigableHubs\.map/);

// Query-string filters remain a client-side UX convenience, not an SEO breadcrumb node.
assert.match(blogPresentation, /window\.history\.replaceState/);
assert.match(blogPresentation, /url\.searchParams\.set\('q'/);
assert.match(blogPage, /filters\.category/);
assert.match(blogPage, /filters\.tag/);
assert.match(blogPresentation, /activeCategorySlug/);
assert.match(categoryPage, /<Website43Blog/);
assert.match(blogPage, /<Website43Blog/);

console.log('PASS: SEO topic hub routing regression');
