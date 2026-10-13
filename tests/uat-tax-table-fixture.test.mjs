import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { loadFixtureModule } from '../qa/phase1-fixture-loader.mjs';

const require = createRequire(import.meta.url);
require('tsx/cjs');
require.extensions['.css'] = css => { css.exports = { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) }; };
if (existsSync(new URL('../lib/runtime/investment-availability.ts', import.meta.url))) {
  const path = require.resolve('../lib/runtime/investment-availability.ts');
  require.cache[path] = { exports: { INVESTMENT_ALLOCATION_ENABLED: false } };
}
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { JSDOM } = require('jsdom');
const ts = require('typescript');
const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const source = JSON.parse(read('qa/uat-tax-table-source-20261012.json'));
const article = JSON.parse(read('lib/content/uat-tax-table-fixture.json'));
const fixtureApi = require('../lib/content/uat-tax-table-fixture.ts');
const Article = require('../features/blog/website-43/Website43Article.tsx').default;
const variables = { CCPUN_DEPLOYMENT_PROVIDER: 'hostinger', CCPUN_DEPLOYMENT_ROLE: 'web', CCPUN_APP_ENV: 'web-uat', NEXT_PUBLIC_SANITY_PROJECT_ID: 'ccb9lnw5', NEXT_PUBLIC_SANITY_DATASET: 'uat' };
const params = Promise.resolve({ category: 'personal-finance', slug: 'uat-ux-tax-table-20261011' });

test('the exact authorized public snapshot retains all 21 table rows, inline references and byline', () => {
  assert.equal(source.document._id, 'uat-ux-tax-table-20261011');
  assert.equal(source.document._rev, 'ZyCtDHZ6hF8ekrdxXOF4DQ');
  const parser = ts.createSourceFile('sanity.ts', read('lib/content/sanity.ts'), ts.ScriptTarget.Latest, true);
  const fn = parser.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'portableTextToArticleBlocks');
  const exports = {};
  new Function('exports', ts.transpileModule(fn.getText(parser), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(exports);
  assert.deepEqual(article.body, JSON.parse(JSON.stringify(exports.portableTextToArticleBlocks(source.document.body))), 'JSON snapshot omits only undefined optional link flags');
  assert.equal(article.title, source.document.title);
  assert.equal(article.excerpt, source.document.excerpt);
  assert.equal(article.seoTitle, source.document.seo.title);
  assert.equal(article.seoDescription, source.document.seo.description);
  assert.equal(article.authorName, source.publicDisplay.find(row => row._id === source.document.author._ref).name);
  const dom = new JSDOM(renderToStaticMarkup(React.createElement(Article, { article, preview: false, relatedArticles: [] }))).window.document;
  assert.equal(dom.querySelectorAll('tbody tr').length, 21);
  assert.ok(dom.body.textContent.includes('CCPun UAT Author'));
  assert.ok(dom.querySelector('a[href="https://www.rd.go.th/5937.html"]'));
});

test('fixture and card fallback fail closed outside the exact Hostinger Web UAT dataset and never duplicate the card', () => {
  const get = vars => fixtureApi.getUatTaxTableFixture('personal-finance', article.slug, vars);
  assert.deepEqual(get(variables), article);
  for (const [key, values] of Object.entries({ CCPUN_APP_ENV: ['production', 'production-admin', 'admin-uat', 'local-uat', 'unknown', undefined], CCPUN_DEPLOYMENT_PROVIDER: ['vercel', 'local', undefined], CCPUN_DEPLOYMENT_ROLE: ['admin', undefined], NEXT_PUBLIC_SANITY_PROJECT_ID: ['kyfxgjnq', 'wrong', undefined], NEXT_PUBLIC_SANITY_DATASET: ['production', 'wrong', undefined], VERCEL_PROJECT_ID: ['prj_other'] })) {
    for (const value of values) assert.equal(get({ ...variables, [key]: value }), null, key + ':' + value);
  }
  assert.equal(fixtureApi.getUatTaxTableFixture('life-insurance', article.slug, variables), null);
  assert.equal(fixtureApi.getUatTaxTableFixture('personal-finance', 'other', variables), null);
  assert.deepEqual(fixtureApi.withUatTaxTableFixture([], variables), [article]);
  assert.deepEqual(fixtureApi.withUatTaxTableFixture([article], variables), [article]);
  const empty = [];
  assert.equal(fixtureApi.withUatTaxTableFixture(empty, { ...variables, CCPUN_APP_ENV: 'production' }), empty);
});

test('anonymous mock keeps exact article UI after unpublish while removing canonical/article schema and every CMS/draft dependency', async () => {
  const path = 'features/blog/pages/ArticlePage.tsx';
  async function render(old) {
    const calls = [];
    const mocks = new Map([
      ['next/headers', { draftMode: async () => { calls.push('draft'); return { isEnabled: false }; } }],
      ['@/lib/deployment-environment', { IS_DRAFT_PREVIEW_ALLOWED: true, IS_REVIEW_ENVIRONMENT: true }],
      ['@/lib/content/provider', { getContentProvider: () => { calls.push('provider'); return { getArticleBySlug: async () => { calls.push('article'); return article; }, listArticles: async () => { calls.push('list'); return []; } }; } }],
      ['@/lib/content/uat-tax-table-fixture', { getUatTaxTableFixture: (category, slug) => fixtureApi.getUatTaxTableFixture(category, slug, variables) }],
      ['@/features/blog/website-43/Website43Article', { __esModule: true, default: Article }],
      ['@/lib/content/url', require('../lib/content/url.ts')],
      ['@/lib/content/structured-data/article-schema', { buildArticleSchemaGraph: () => ({ '@type': 'Article', name: article.title }) }],
    ]);
    const page = loadFixtureModule(path, { sources: old ? new Map([[path, source.originalArticlePageSource]]) : new Map(), mocks });
    return { metadata: await page.generateMetadata({ params }), html: renderToStaticMarkup(await page.default({ params })), calls };
  }
  const before = await render(true), after = await render(false);
  assert.deepEqual(after.calls, [], 'unpublished fixture must not read CMS, token or Draft Mode');
  assert.equal(after.html, before.html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, ''));
  assert.deepEqual(after.metadata.robots, { index: false, follow: false });
  assert.deepEqual(after.metadata.alternates, { canonical: null });
  const previousOpenGraph = { ...before.metadata.openGraph }; delete previousOpenGraph.url;
  assert.deepEqual(after.metadata, { ...before.metadata, alternates: { canonical: null }, openGraph: previousOpenGraph });
  assert.equal(new JSDOM(after.html).window.document.querySelectorAll('script[type="application/ld+json"]').length, 0);
});

test('only Blog/category UI opt in; sitemap, related-article and provider publication data stay separate', () => {
  assert.match(read('features/blog/pages/BlogArchivePage.tsx'), /withUatTaxTableFixture\(cmsArticles\)/);
  assert.match(read('features/blog/pages/BlogCategoryPage.tsx'), /getContentProvider\(\)\.listArticles\(\{ includeDrafts \}\)\.then\(withUatTaxTableFixture\)/);
  for (const file of ['lib/content/provider.ts', 'lib/content/sitemap.ts']) assert.doesNotMatch(read(file), /uat-tax-table-fixture|withUatTaxTableFixture/);
  assert.match(read('features/blog/pages/ArticlePage.tsx'), /if \(fixture\) return <Website43Article preview=\{false\} article=\{fixture\} relatedArticles=\{\[\]\}/);
  assert.equal(article.noindex, true);
});

test('ordinary routes and Production metadata/provider behavior remain byte-equivalent to the original page', async () => {
  const path = 'features/blog/pages/ArticlePage.tsx';
  for (const slug of [article.slug, 'ordinary-test-article']) {
    async function observe(old) {
      const record = { ...article, slug, noindex: slug === article.slug };
      const calls = [];
      const mocks = new Map([
        ['next/headers', { draftMode: async () => { calls.push('draft'); return { isEnabled: false }; } }],
        ['@/lib/deployment-environment', { IS_DRAFT_PREVIEW_ALLOWED: false, IS_REVIEW_ENVIRONMENT: false }],
        ['@/lib/content/provider', { getContentProvider: () => { calls.push('provider'); return { getArticleBySlug: async () => { calls.push('article'); return record; }, listArticles: async () => { calls.push('list'); return []; } }; } }],
        ['@/lib/content/uat-tax-table-fixture', { getUatTaxTableFixture: (category, key) => fixtureApi.getUatTaxTableFixture(category, key, { ...variables, CCPUN_APP_ENV: 'production' }) }],
        ['@/features/blog/website-43/Website43Article', { __esModule: true, default: Article }],
        ['@/lib/content/url', require('../lib/content/url.ts')],
        ['@/lib/content/structured-data/article-schema', { buildArticleSchemaGraph: () => ({ '@type': 'Article', name: record.title }) }],
      ]);
      const page = loadFixtureModule(path, { sources: old ? new Map([[path, source.originalArticlePageSource]]) : new Map(), mocks });
      const input = { params: Promise.resolve({ category: 'personal-finance', slug }) };
      return { metadata: await page.generateMetadata(input), html: renderToStaticMarkup(await page.default(input)), calls };
    }
    assert.deepEqual(await observe(false), await observe(true), slug);
  }
});

test('real Blog/category page data flow preserves the sole card when the published CMS list becomes empty', async () => {
  const categoryApi = require('../lib/content/category-registry.ts');
  const registry = categoryApi.buildCategoryRegistry([{ _id: 'ccpun-category-personal-finance', title: 'การเงินส่วนบุคคล', slug: 'personal-finance', status: 'active' }]);
  for (const [file, original] of [['features/blog/pages/BlogArchivePage.tsx', source.originalArchivePageSource], ['features/blog/pages/BlogCategoryPage.tsx', source.originalCategoryPageSource]]) {
    async function observe(old) {
      let cardProps;
      const mocks = new Map([
        ['next/headers', { draftMode: async () => ({ isEnabled: false }) }],
        ['@/lib/deployment-environment', { IS_DRAFT_PREVIEW_ALLOWED: true, IS_REVIEW_ENVIRONMENT: true }],
        ['@/lib/content/provider', { getContentProvider: () => ({ listArticles: async () => old ? [article] : [] }) }],
        ['@/lib/content/uat-tax-table-fixture', { withUatTaxTableFixture: articles => fixtureApi.withUatTaxTableFixture(articles, variables) }],
        ['@/lib/content/category-registry', categoryApi],
        ['@/lib/content/category-registry-sanity', { listCategoryRegistry: async () => registry }],
        ['@/lib/content/blog-featured-sanity', { listBlogFeaturedArticleIds: async () => [] }],
        ['@/features/blog/website-43/blogData', require('../features/blog/website-43/blogData.ts')],
        ['@/features/blog/website-43/Website43Blog', { __esModule: true, default: props => { cardProps = props; return React.createElement('main'); } }],
        ['@/lib/content/url', require('../lib/content/url.ts')],
        ['@/lib/content/featured-articles', require('../lib/content/featured-articles.ts')],
        ['@/lib/content/taxonomy', require('../lib/content/taxonomy.ts')],
        ['@/lib/content/structured-data/article-schema', { buildBlogArchiveSchema: () => ({}), buildBlogTopicHubSchema: () => ({}) }],
      ]);
      const page = loadFixtureModule(file, { sources: old ? new Map([[file, original]]) : new Map(), mocks });
      renderToStaticMarkup(await page.default({ params: Promise.resolve({ category: 'personal-finance' }), searchParams: Promise.resolve({}) }));
      assert.ok(cardProps, file + ': actual card component must render');
      return cardProps;
    }
    assert.deepEqual(await observe(false), await observe(true), file + ': existing card/filter/featured props');
  }
});
