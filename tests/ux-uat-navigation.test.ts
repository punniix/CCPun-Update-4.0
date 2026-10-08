import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Blog, { type Website43BlogClientClassNames } from '../features/blog/website-43/Website43BlogInteractive';
import { BLOG_PAGE_SIZE, blogPage, blogPageHref, safeBlogReturn } from '../features/blog/website-43/BlogNavigation';
test('six cards per page without hiding remainder, fixtures 0/6/7/12/13', () => {
  for (const total of [0, 6, 7, 12, 13]) {
    const items = Array.from({ length: total }, (_, i) => i);
    const { pages } = blogPage('1', total);
    const rendered = Array.from({ length: pages }, (_, i) => items.slice(i * BLOG_PAGE_SIZE, (i + 1) * BLOG_PAGE_SIZE));
    assert.deepEqual(rendered.flat(), items);
    assert.ok(rendered.every(page => page.length <= 6));
    assert.equal(pages, Math.max(1, Math.ceil(total / 6)));
  }
});
test('invalid pages cannot produce an unreachable empty page', () => {
  for (const value of [null, '', '-1', '0', '1.5', 'x', 'Infinity', '9007199254740993']) assert.equal(blogPage(value, 13).page, 1);
  assert.equal(blogPage('99', 13).page, 3);
  assert.equal(blogPage('2', 13).page, 2);
  assert.equal(blogPage('3', 0).page, 1);
});
test('paging preserves query/category/tags and page one removes page', () => {
  const href = blogPageHref('/blog/life-insurance/?q=ภาษี&tag=เงิน&page=2', 3);
  const url = new URL(href, 'https://ccpun.com');
  assert.equal(url.pathname, '/blog/life-insurance/');
  assert.equal(url.searchParams.get('q'), 'ภาษี');
  assert.equal(url.searchParams.get('tag'), 'เงิน');
  assert.equal(url.searchParams.get('page'), '3');
  assert.equal(new URL(blogPageHref(href, 1), url.origin).searchParams.has('page'), false);
});
test('contextual return permits only same-site listing URLs', () => {
  assert.equal(safeBlogReturn('/blog/?q=x&page=2'), '/blog/?q=x&page=2');
  assert.equal(safeBlogReturn('/blog/life-insurance/?page=2'), '/blog/life-insurance/?page=2');
  for (const value of ['https://evil.test/blog/', '//evil.test/blog/', 'javascript:alert(1)', '/blog/life-insurance/article/', '/api/admin/', null]) assert.equal(safeBlogReturn(value), null);
});

test('actual Blog rendering paginates all cards and search uses the same six-card boundary', () => {
  const classNames = Object.fromEntries(['articleCard','articleImage','articleCardBody','articleCategory','articleTitle','articleExcerpt','articleMeta','blogContent','inner','eyebrow','featuredViewport','featuredScroller','featuredRail','featuredCard','carouselControls','carouselDotButton','carouselDotButtonActive','searchFilters','searchField','categoryMenu','categoryMenuButton','categoryMenuChevron','categoryMenuChevronOpen','categoryMenuPanel','categoryMenuOption','categoryMenuOptionActive','categoryMenuIndicator','articleListHeading','h2','articleGrid','emptyState','pagination','resultCount'].map(name => [name, name])) as Website43BlogClientClassNames;
  for (const total of [0, 6, 7, 12, 13]) {
    const articles = Array.from({ length: total }, (_, i) => ({ slug: String(i), category: 'หมวด', title: 'ตรงคำค้น ' + i, excerpt: '', meta: '', publishedAt: '', image: '/assets/pun.jpg', imageWidth: 400, imageHeight: 400, href: '/blog/fixture/' + i + '/', tags: [] }));
    for (let page = 1; page <= Math.max(1, Math.ceil(total / 6)); page++) {
      const html = renderToStaticMarkup(React.createElement(Blog, { articles, featuredArticles: [], initialQuery: 'ตรงคำค้น', initialPage: String(page), categories: [{ slug: null, title: 'ทั้งหมด' }], classNames }));
      assert.equal((html.match(/class="articleCard"/g) ?? []).length, Math.min(6, Math.max(0, total - (page - 1) * 6)));
      assert.equal(html.includes('aria-label="หน้าบทความ"'), total > 6);
      if (total > 6) assert.ok(html.includes('aria-current="page"'));
    }
  }
});
