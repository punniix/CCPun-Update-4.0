import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { transpileModule, ModuleKind } = require('typescript') as typeof import('typescript');
type Fixture = { noindex?: boolean; status?: string; aligned?: boolean; preview?: boolean; empty?: boolean; active?: boolean; hubIndexable?: boolean };

function metadata(page: 'ArticlePage' | 'BlogCategoryPage', review: boolean, fixture: Fixture = {}, semanticHub = false) {
  const article = { status: fixture.status ?? 'published', noindex: fixture.noindex ?? false, slug: 'synthetic-article', seoTitle: 'Synthetic', seoDescription: 'Synthetic description' };
  const category = { slug: 'synthetic-category', title: 'Synthetic category', status: fixture.active === false ? 'hidden' : 'active' };
  const hub = { slug: category.slug, title: category.title, seoTitle: 'Synthetic hub', description: 'Synthetic hub description', indexable: fixture.hubIndexable !== false };
  const dependencies: Record<string, unknown> = {
    react: { cache: (fn: unknown) => fn },
    'next/headers': { draftMode: async () => ({ isEnabled: fixture.preview ?? false }) },
    'next/navigation': {},
    '@/lib/deployment-environment': { IS_REVIEW_ENVIRONMENT: review, IS_DRAFT_PREVIEW_ALLOWED: true },
    '@/lib/content/provider': { getContentProvider: () => ({ getArticleBySlug: async () => article, listArticles: async () => fixture.empty ? [] : [article] }) },
    '@/lib/content/category-registry-sanity': { listCategoryRegistry: async () => [] },
    '@/lib/content/category-registry': {
      resolveCategoryRoute: () => semanticHub ? { kind: 'missing' } : { kind: 'category', category },
      getCategoryCanonical: (slug: string) => 'https://ccpun.com/blog/' + slug + '/',
      articleBelongsToPhysicalCategory: () => true,
    },
    '@/lib/content/taxonomy': { getBlogTopicHub: () => hub, isArticleInSemanticTopic: () => true },
    '@/lib/content/url': {
      getArticleSourceSlugForRoute: (slug: string) => slug,
      getArticleCategorySlug: () => category.slug,
      getArticlePreviewCategorySlug: () => category.slug,
      getArticlePath: () => '/blog/' + category.slug + '/' + article.slug + '/',
      getArticlePreviewPath: () => '/blog/' + category.slug + '/' + article.slug + '/',
      getArticleCanonical: () => 'https://ccpun.com/blog/' + category.slug + '/' + article.slug + '/',
      isArticleCanonicalAligned: () => fixture.aligned !== false,
    },
  };
  const exports: Record<string, unknown> = {};
  const source = readFileSync(new URL('../features/blog/pages/' + page + '.tsx', import.meta.url), 'utf8');
  runInNewContext(transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS, jsx: 4, target: 9 } }).outputText, {
    exports,
    require: (name: string) => {
      if (name in dependencies) return dependencies[name];
      if (name === 'react/jsx-runtime') return require(name);
      if (name.endsWith('.module.css')) return { default: {} };
      if (name.startsWith('@/features/') || name.startsWith('@/lib/content/structured-data/') || name === '@/lib/content/featured-articles') return {};
      throw new Error('Unexpected dependency: ' + name);
    },
  });
  const generate = exports.generateMetadata as (props: { params: Promise<{ category: string; slug: string }> }) => Promise<{ robots: { index: boolean }; alternates?: { canonical: string } }>;
  return generate({ params: Promise.resolve({ category: category.slug, slug: article.slug }) });
}

test('Published article cannot override review noindex, even when the document permits indexing', async () => {
  for (const review of [true, false]) {
    const result = await metadata('ArticlePage', review);
    assert.equal(result.robots.index, !review);
    assert.equal(result.alternates?.canonical, 'https://ccpun.com/blog/synthetic-category/synthetic-article/');
  }
  for (const fixture of [{ noindex: true }, { aligned: false }, { preview: true }, { status: 'draft' }]) {
    assert.equal((await metadata('ArticlePage', false, fixture)).robots.index, false);
  }
});

test('Review categories and semantic hubs remain noindex without changing Production eligibility', async () => {
  for (const semanticHub of [false, true]) {
    for (const review of [true, false]) {
      assert.equal((await metadata('BlogCategoryPage', review, {}, semanticHub)).robots.index, !review);
    }
    for (const fixture of [{ empty: true }, { noindex: true }, { aligned: false }, { preview: true }]) {
      assert.equal((await metadata('BlogCategoryPage', false, fixture, semanticHub)).robots.index, false);
    }
  }
  assert.equal((await metadata('BlogCategoryPage', false, { active: false })).robots.index, false);
  assert.equal((await metadata('BlogCategoryPage', false, { hubIndexable: false }, true)).robots.index, false);
});
