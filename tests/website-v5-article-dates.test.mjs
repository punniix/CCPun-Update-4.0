import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { loadFixtureModule } from '../qa/phase1-fixture-loader.mjs';
const require = createRequire(import.meta.url);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { articleUpdatedOnLaterBangkokDay } = loadFixtureModule('features/blog/v5/article-dates.ts');
const { buildArticleSchemaGraph } = loadFixtureModule('lib/content/structured-data/article-schema.ts');
const registry = loadFixtureModule('lib/content/public-copy-registry.ts');
const base = { id: 'date-fixture', slug: 'date-fixture', title: 'บทความวันที่', excerpt: 'คำอธิบาย', category: 'การเงินส่วนบุคคล', categorySlug: 'personal-finance', status: 'published', tags: [], body: [] };
async function render(article, overrides = {}) {
  const css = { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) };
  const mocks = new Map([
    ['@/lib/content/public-copy', { getPublicCopy: async scope => ({ ...registry.parsePublicCopy(scope, null), ...overrides }) }],
    ['@/components/layout/v5/V5Page', { __esModule: true, default: ({ children }) => React.createElement('main', null, children) }],
    ['@/components/layout/v5/V5ChatDockServer', { getV5ChatFallbackHref: async () => 'https://lin.ee/fixture' }],
    ['@/lib/analytics', { trackEvent: () => assert.fail('SSR cannot send events') }],
    ['@/lib/cookie-consent', { getConsentData: () => null }],
    ['@/components/layout/v5/V5.module.css', css],
  ]);
  for (const id of ['./V5Blog.module.css', './V5Engagement.module.css', './ArticleWidgets.module.css', './Website43Blog.module.css', './Website43ArticleOverview.module.css', './Website43ArticleEngagement.module.css', './Website43ArticleShareActions.module.css', './ArticleEngagement.module.css', './ArticleShareActions.module.css', './V5LegacyBridge.module.css']) mocks.set(id, css);
  const { default: V5Article } = loadFixtureModule('features/blog/v5/V5Article.tsx', { mocks });
  return new JSDOM(renderToStaticMarkup(await V5Article({ article }))).window.document;
}
for (const [name, publishedAt, updatedAt, expected] of [
  ['same Thai day', '2026-10-01T17:00:00Z', '2026-10-02T16:59:00Z', false],
  ['one Thai calendar day, one minute elapsed', '2026-10-01T16:59:00Z', '2026-10-01T17:00:00Z', true],
  ['more than one day', '2026-10-01T00:00:00Z', '2026-10-03T00:00:00Z', true],
  ['out of order', '2026-10-03T00:00:00Z', '2026-10-01T00:00:00Z', false],
  ['invalid update', '2026-10-01T00:00:00Z', 'invalid', false],
]) test(`article dates: ${name}`, async () => {
  assert.equal(articleUpdatedOnLaterBangkokDay(publishedAt, updatedAt), expected);
  const article = { ...base, publishedAt, updatedAt, optimizedAt: '2026-12-25T00:00:00Z' };
  const doc = await render(article);
  const times = [...doc.querySelectorAll('header time')];
  assert.equal(times.length, expected ? 2 : 1);
  assert.equal(times[0].dateTime, publishedAt);
  if (expected) {
    const posting = buildArticleSchemaGraph(article)['@graph'].find(node => node['@type'] === 'BlogPosting');
    assert.equal(times[1].dateTime, posting.dateModified);
    assert.equal(times[1].textContent, new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok' }).format(new Date(updatedAt)));
    assert.equal(times[1].parentElement.textContent, `อัปเดต ${times[1].textContent}`);
  }
});
test('article dates reuse CMS copy literally, and only the approved About default changes', async () => {
  const doc = await render({ ...base, publishedAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-03T00:00:00Z' }, { 'blog.date.updated': 'วันที่เจ้าของแก้ไข' });
  assert.match(doc.querySelector('header').textContent, /วันที่เจ้าของแก้ไข/);
  assert.equal(registry.parsePublicCopy('site', null)['site.footer.about'], 'รู้จักปั้น');
  assert.equal(registry.parsePublicCopy('site', { _id: registry.publicCopyDocumentId('site'), _type: 'publicPageCopy', scope: 'site', locale: 'th', entries: [{ key: 'site.footer.about', text: 'เกี่ยวกับ Pun ฉบับเจ้าของ' }] })['site.footer.about'], 'เกี่ยวกับ Pun ฉบับเจ้าของ');
  const source = readFileSync('features/blog/v5/V5Article.tsx', 'utf8');
  assert.doesNotMatch(source, /article\.optimizedAt/);
  assert.match(source, /text.node\("blog.date.updated"\)/);
});
