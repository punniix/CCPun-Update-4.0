// Website v5 hearts/views on blog cards and the article header (owner-approved 2026-10-25).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { JSDOM } from 'jsdom';

const require = createRequire(import.meta.url);
require('tsx/cjs');
require.extensions['.css'] = module => { module.exports = { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) }; };
require.cache[require.resolve('../lib/analytics.ts')] = { exports: { trackEvent() {} } };
const { renderToStaticMarkup } = require('react-dom/server');
const { VIEW_COUNT_DISPLAY_MIN, CARD_METRICS_BATCH_MAX, displayedViews, displayedHearts } = require('../features/blog/v5/engagement-display.ts');
const { default: V5CardEngagement, V5CardMetricsProvider, parseCardMetrics } = require('../features/blog/v5/V5ArticleCardEngagement.tsx');
const { default: V5ArticleEngagementMeta } = require('../features/blog/v5/V5ArticleEngagementMeta.tsx');
const { ArticleEngagementProvider } = require('../features/blog/website-43/ArticleEngagement.tsx');
const { cardDate, toV5Card, newestFirst } = require('../components/layout/v5/article-card-data.ts');
const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

function withDom(fetchImpl) {
  const dom = new JSDOM('<div id="app"></div>', { url: 'https://ccpun.com/blog/' });
  const names = ['window', 'document', 'navigator', 'localStorage', 'fetch', 'IS_REACT_ACT_ENVIRONMENT', 'IntersectionObserver'];
  const before = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  Object.defineProperties(globalThis, {
    window: { value: dom.window, configurable: true }, document: { value: dom.window.document, configurable: true },
    navigator: { value: dom.window.navigator, configurable: true }, localStorage: { value: dom.window.localStorage, configurable: true },
    IS_REACT_ACT_ENVIRONMENT: { value: true, configurable: true }, fetch: { value: fetchImpl, configurable: true },
    IntersectionObserver: { value: undefined, configurable: true },
  });
  const restore = () => { for (const [name, descriptor] of before) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; } };
  return { dom, restore };
}
const settle = () => new Promise(resolve => setTimeout(resolve, 120));

test('one constant hides views below 50 everywhere; hearts show from the first one', () => {
  assert.equal(VIEW_COUNT_DISPLAY_MIN, 50);
  assert.equal(CARD_METRICS_BATCH_MAX, 24);
  assert.deepEqual([null, undefined, 0, 49].map(displayedViews), [null, null, null, null]);
  assert.equal(displayedViews(50), '50');
  assert.equal(displayedViews(12345), '12,345');
  assert.deepEqual([null, undefined, 0, -1, 1.5].map(displayedHearts), [null, null, null, null, null]);
  assert.equal(displayedHearts(1), '1');
  for (const file of ['features/blog/v5/V5ArticleCardEngagement.tsx', 'features/blog/v5/V5ArticleEngagementMeta.tsx']) {
    const source = read(file);
    assert.match(source, /displayedViews\(/, `${file} uses the shared view rule`);
    assert.doesNotMatch(source, /\b50\b/, `${file} has no second threshold`);
  }
});

test('card date: explicit optimisation shows อัปเดต, otherwise เผยแพร่; updatedAt is never shown; order unchanged', () => {
  const base = { id: 'a', slug: 'tax-deduction', title: 'T', excerpt: 'E', category: 'personal-finance', categorySlug: 'personal-finance', semanticTopic: 'personal-finance', authorName: 'CCPun', status: 'published', seoTitle: 'T', seoDescription: 'E', body: [] };
  const optimized = { ...base, publishedAt: '2026-01-10T03:00:00Z', optimizedAt: '2026-10-20T03:00:00Z', updatedAt: '2026-10-24T03:00:00Z' };
  const plain = { ...base, id: 'b', publishedAt: '2026-02-10T03:00:00Z', updatedAt: '2026-10-24T03:00:00Z' };
  const malformed = { ...plain, id: 'c', optimizedAt: 'not-a-date' };
  const neither = { ...base, id: 'd', publishedAt: undefined, updatedAt: '2026-10-24T03:00:00Z' };
  assert.equal(cardDate(optimized).key, 'blog.date.updated');
  assert.equal(cardDate(optimized).at.toISOString(), '2026-10-20T03:00:00.000Z');
  assert.equal(cardDate(plain).key, 'blog.date.published');
  assert.equal(cardDate(malformed).key, 'blog.date.published', 'a malformed optimisation timestamp is ignored');
  assert.equal(cardDate(neither), null, 'updatedAt alone never becomes a card date');
  assert.equal(toV5Card(optimized).meta, 'อัปเดต 20 ต.ค. 2569');
  assert.equal(toV5Card(plain).meta, 'เผยแพร่ 10 ก.พ. 2569');
  assert.equal(toV5Card(neither).meta, undefined);
  assert.deepEqual(newestFirst([optimized, plain, neither]).map(article => article.id), ['d', 'b', 'a'], 'list order still follows publishedAt (then updatedAt) as before');
  assert.doesNotMatch(read('components/layout/v5/article-card-data.ts').slice(0, read('components/layout/v5/article-card-data.ts').indexOf('export function newestFirst')), /article\.updatedAt/);
});

test('card list batches visible cards (max 24 per request), hides small view counts and keeps hearts server-confirmed', async () => {
  const requests = [];
  let rejectHeart = false;
  const { dom, restore } = withDom(async (url, init = {}) => {
    const body = init.body ? JSON.parse(init.body) : null;
    requests.push({ url: String(url), method: init.method ?? 'GET', body });
    if (String(url).startsWith('/api/article-engagement/?ids=')) {
      const ids = decodeURIComponent(String(url).split('=')[1]).split(',');
      return Response.json({ available: true, degraded: false, items: Object.fromEntries(ids.map((id, index) => [id, { views: index === 0 ? 49 : 1200, shares: 0, hearts: index === 1 ? null : 3 }])) });
    }
    if (body?.type === 'heart') return rejectHeart ? Response.json({ available: false }, { status: 503 }) : Response.json({ available: true, views: 1200, shares: 0, hearts: body.liked ? 4 : 3, liked: body.liked, activatedAt: '2026-10-19T00:00:00Z' });
    return Response.json({ available: false }, { status: 404 });
  });
  const { createRoot } = require('react-dom/client');
  const root = createRoot(dom.window.document.getElementById('app'));
  const ids = Array.from({ length: 30 }, (_, index) => `card-${index}`);
  try {
    await React.act(async () => {
      root.render(React.createElement(V5CardMetricsProvider, null, ids.map(id => React.createElement(V5CardEngagement, { key: id, articleId: id, title: `บทความ ${id}` }))));
    });
    // Passive effects flush when the render act exits; the 80 ms batch window runs after that.
    await React.act(async () => { await settle(); });
    const reads = requests.filter(request => request.method === 'GET');
    assert.equal(reads.length, 2, '30 cards -> 2 batch reads, never one request per card');
    assert.ok(reads.every(request => request.url.startsWith('/api/article-engagement/?ids=')));
    assert.deepEqual(reads.map(request => decodeURIComponent(request.url.split('=')[1]).split(',').length), [24, 6]);
    assert.equal(requests.filter(request => request.body).length, 0, 'cards never record views');
    const cards = [...dom.window.document.querySelectorAll('button[aria-pressed]')];
    assert.equal(cards.length, 30);
    const text = index => cards[index].parentElement.textContent;
    assert.doesNotMatch(text(0), /49|เปิดอ่าน/, 'views below 50 stay hidden');
    assert.match(text(0), /ถูกใจ 3 ครั้ง/, 'hearts show from 1 with a screen-reader label');
    assert.match(text(2), /1,200/);
    assert.equal(cards[2].parentElement.querySelector('.views').getAttribute('aria-label'), 'เปิดอ่านที่บันทึกได้ 1,200 ครั้ง');
    assert.equal(cards[0].parentElement.querySelector('.views').getAttribute('aria-label'), null);
    assert.doesNotMatch(text(1), /ถูกใจ \d/, 'no heart count when there are none yet');
    assert.equal(cards[2].getAttribute('aria-label'), 'ถูกใจบทความ: บทความ card-2');
    assert.ok(cards[2].getAttribute('aria-describedby'));
    await React.act(async () => { cards[2].click(); await settle(); });
    const write = requests.at(-1);
    assert.deepEqual([write.url, write.method, write.body], ['/api/article-engagement/card-2/', 'POST', { type: 'heart', liked: true }]);
    assert.equal(cards[2].getAttribute('aria-pressed'), 'true', 'liked only after the server confirms');
    assert.equal(cards[2].getAttribute('aria-label'), 'ยกเลิกถูกใจบทความ: บทความ card-2');
    assert.match(text(2), /ถูกใจ 4 ครั้ง/);
    rejectHeart = true;
    await React.act(async () => { cards[3].click(); await settle(); });
    assert.equal(cards[3].getAttribute('aria-pressed'), 'false', 'a failed write never shows as liked');
    assert.match(text(3), /บันทึกถูกใจไม่สำเร็จ/);
  } finally {
    await React.act(async () => root.unmount());
    restore();
  }
});

test('card markup reserves its slots before counts load; malformed batch answers are dropped', () => {
  const markup = renderToStaticMarkup(React.createElement(V5CardMetricsProvider, null, React.createElement(V5CardEngagement, { articleId: 'x', title: 'บทความ' })));
  assert.match(markup, /class="cardMetrics"><span class="views"><\/span><button type="button" class="heart" aria-pressed="false" aria-label="ถูกใจบทความ: บทความ">/);
  assert.match(markup, /<span class="heartCount" aria-hidden="true"><\/span>/);
  assert.deepEqual(parseCardMetrics({ available: false, items: { a: { views: 1, hearts: 1 } } }), {});
  assert.deepEqual(parseCardMetrics({ available: true, items: { a: { views: -1, hearts: 1 }, b: { views: '9', hearts: 1 }, c: { views: 60, hearts: null } } }), { c: { views: 60, hearts: null } });
});

test('article header shows views (from 50) and a heart beside the reading time using the page provider', async () => {
  const requests = [];
  let metrics = { available: true, views: 49, shares: 0, hearts: 2, liked: false, activatedAt: '2026-10-19T00:00:00Z' };
  const { dom, restore } = withDom(async (url, init = {}) => {
    const body = init.body ? JSON.parse(init.body) : null;
    requests.push({ url: String(url), method: init.method ?? 'GET', body });
    if (body?.type === 'heart') metrics = { ...metrics, liked: body.liked, hearts: metrics.hearts + (body.liked ? 1 : -1) };
    return Response.json(metrics);
  });
  const { createRoot } = require('react-dom/client');
  const root = createRoot(dom.window.document.getElementById('app'));
  try {
    const pending = renderToStaticMarkup(React.createElement(V5ArticleEngagementMeta));
    assert.match(pending, /^<span class="articleMetrics"><button type="button" class="heart" aria-pressed="false" aria-label="ถูกใจบทความ">/, 'the heart box renders before metrics load');
    await React.act(async () => {
      root.render(React.createElement(ArticleEngagementProvider, { articleId: 'published-fixture' }, React.createElement(V5ArticleEngagementMeta)));
      await settle();
    });
    const box = dom.window.document.querySelector('.articleMetrics');
    assert.doesNotMatch(box.textContent, /49|เปิดอ่าน/);
    assert.match(box.textContent, /ถูกใจ 2 ครั้ง/);
    const heart = box.querySelector('button');
    await React.act(async () => { heart.click(); await settle(); });
    assert.deepEqual(requests.at(-1).body, { type: 'heart', liked: true });
    assert.equal(heart.getAttribute('aria-pressed'), 'true');
    assert.equal(heart.getAttribute('aria-label'), 'ยกเลิกถูกใจบทความ');
    assert.equal(requests.filter(request => request.body?.type === 'view').length, 0, 'no view write without analytics consent');
  } finally {
    await React.act(async () => root.unmount());
    restore();
  }
  const article = read('features/blog/v5/V5Article.tsx');
  assert.match(article, /<ArticleEngagementSummary readingMinutes=\{readingMinutes\} \/><\/V5LegacyBridge>\n\s*\{!preview && <V5ArticleEngagementMeta \/>\}/, 'next to the reading time; hidden in preview');
});

test('v5 heart styling: 44px target, neutral tokens (not gold), per-mode focus; lists wire the batch provider', () => {
  const css = read('features/blog/v5/V5Engagement.module.css');
  assert.match(css, /\.heart \{[^}]*min-width: 44px; min-height: 44px;/);
  assert.match(css, /\.articleMetrics \{[^}]*min-height: 44px;/);
  assert.doesNotMatch(css, /--v5-gold|--v5-band|#e0c985/i, 'the heart is never the gold primary');
  assert.doesNotMatch(css, /outline:/, 'focus uses the shared per-mode ring');
  assert.match(css, /\.cardMetrics \{ position: relative; z-index: 1;/, 'the heart sits above the whole-card link');
  assert.match(css, /\.views \{[^}]*min-width: 8ch;/, 'the view slot is reserved');
  for (const file of ['features/blog/v5/V5BlogIndex.tsx', 'features/blog/v5/V5Category.tsx']) {
    const source = read(file);
    assert.match(source, /<V5CardMetricsProvider>/, `${file}: one batch provider per list`);
    assert.match(source, /metaEnd=\{<V5CardEngagement articleId=\{card\.id\} title=\{card\.title\} \/>\}/, `${file}: cards carry heart + views`);
  }
  assert.equal((read('features/blog/v5/V5BlogIndex.tsx').match(/<V5CardEngagement /g) ?? []).length, 2, 'featured and group cards');
  const copy = read('lib/content/blog-copy-defaults.ts');
  assert.ok(copy.includes('"blog.engagement.hearts": "ถูกใจ {0} ครั้ง"'));
});
