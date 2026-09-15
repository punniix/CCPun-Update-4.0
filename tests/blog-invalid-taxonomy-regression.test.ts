import assert from 'node:assert/strict';
import test from 'node:test';
import { toWebsite43ArticleItems } from '../features/blog/website-43/blogData';
import type { Article } from '../lib/content/types';

function article(overrides: Partial<Article> = {}): Article {
  return {
    slug: 'valid-article',
    title: 'Valid article',
    excerpt: 'Excerpt',
    category: 'ประกันชีวิต',
    categorySlug: 'life-insurance',
    tags: [],
    status: 'published',
    publishedAt: '2026-09-15T00:00:00.000Z',
    updatedAt: '2026-09-15T00:00:00.000Z',
    ...overrides,
  } as Article;
}

test('blog archive keeps valid articles when one published record has unsupported taxonomy', () => {
  const items = toWebsite43ArticleItems([
    article(),
    article({
      slug: 'bad-taxonomy',
      title: 'Bad taxonomy',
      category: 'หมวดใหม่ที่เว็บยังไม่รู้จัก',
      categorySlug: 'future-category',
    }),
  ]);

  assert.equal(items.length, 1);
  assert.equal(items[0]?.slug, 'valid-article');
  assert.equal(items[0]?.href, '/blog/life-insurance/valid-article/');
});

test('blog archive does not crash on blank or malformed category metadata', () => {
  const items = toWebsite43ArticleItems([
    article({ slug: 'blank-taxonomy', category: '', categorySlug: '' }),
    article({ slug: 'malformed-taxonomy', category: 'Unknown', categorySlug: 'Not A URL Segment' }),
    article({ slug: 'still-valid' }),
  ]);

  assert.deepEqual(items.map((item) => item.slug), ['still-valid']);
});
