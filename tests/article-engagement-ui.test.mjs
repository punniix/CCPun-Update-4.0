import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import React from 'react';
import { JSDOM } from 'jsdom';
const require = createRequire(import.meta.url);
require('tsx/cjs');
require.extensions['.css'] = module => { module.exports = { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) }; };
require.cache[require.resolve('../lib/analytics.ts')] = { exports: { trackEvent() {} } };
const { renderToStaticMarkup } = require('react-dom/server');
const { ArticleEngagementProvider, ArticleEngagementSummary } = require('../features/blog/website-43/ArticleEngagement.tsx');
const Actions = require('../features/blog/website-43/ArticleShareActions.tsx').default;

test('actual Article controls read verified metrics, gate analytics consent and update both hearts only after server success', async () => {
  const pending = renderToStaticMarkup(React.createElement(ArticleEngagementSummary, { readingMinutes: 11 }));
  assert.doesNotMatch(pending, /—|เปิดอ่าน|แชร์|GA4|ย้อนหลัง/);
  assert.match(pending, /อ่าน/);
  const dom = new JSDOM('<div id="app"></div>', { url: 'https://ccpun.com/blog/personal-finance/fixture/' });
  const names = ['window', 'document', 'navigator', 'localStorage', 'fetch', 'IS_REACT_ACT_ENVIRONMENT'];
  const before = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const requests = [];
  const metrics = { available: true, views: 2, shares: 0, hearts: null, liked: false, activatedAt: '2026-10-19T00:00:00Z' };
  let rejectHeart = false;
  let deferShare = false;
  let releaseShare;
  Object.defineProperty(dom.window.navigator, 'clipboard', { value: { writeText: async () => {} }, configurable: true });
  Object.defineProperties(globalThis, {
    window: { value: dom.window, configurable: true }, document: { value: dom.window.document, configurable: true },
    navigator: { value: dom.window.navigator, configurable: true },
    localStorage: { value: dom.window.localStorage, configurable: true }, IS_REACT_ACT_ENVIRONMENT: { value: true, configurable: true },
    fetch: { value: async (url, init = {}) => {
      const body = init.body ? JSON.parse(init.body) : null;
      requests.push({ url, body });
      if (body?.type === 'heart' && rejectHeart) return Response.json({ available: false }, { status: 503 });
      if (body?.type === 'view') metrics.views += 1;
      if (body?.type === 'share') metrics.shares += 1;
      if (body?.type === 'heart') { metrics.liked = body.liked; metrics.hearts = body.liked ? 1 : null; }
      const response = Response.json(metrics);
      if (body?.type === 'share' && deferShare) await new Promise(resolve => { releaseShare = resolve; });
      return response;
    }, configurable: true },
  });
  const { createRoot } = require('react-dom/client');
  const root = createRoot(dom.window.document.getElementById('app'));
  const settle = async () => { await new Promise(resolve => setTimeout(resolve, 0)); };
  try {
    await React.act(async () => {
      root.render(React.createElement(ArticleEngagementProvider, { articleId: 'published-fixture' },
        React.createElement(ArticleEngagementSummary, { readingMinutes: 11 }),
        React.createElement(Actions, { path: '/blog/personal-finance/fixture/', title: 'ทดสอบ', placement: 'header' }),
        React.createElement(Actions, { path: '/blog/personal-finance/fixture/', title: 'ทดสอบ', placement: 'footer' })));
      await settle();
    });
    assert.equal(requests.filter(request => request.body).length, 0, 'no view/share write without existing analytics consent');
    assert.ok(dom.window.document.querySelector('[aria-label="การเปิดบทความที่บันทึกได้ 2 ครั้ง"]'));
    assert.ok(dom.window.document.querySelector('[aria-label="การแชร์ที่บันทึกได้ 0 ครั้ง"]'), 'known zero remains visible');
    assert.doesNotMatch(dom.window.document.querySelector('.articleReadingTime').outerHTML, /GA4|—|ย้อนหลัง/);
    assert.equal(dom.window.document.querySelectorAll('button[aria-pressed="false"]').length, 2);
    assert.equal(dom.window.document.querySelectorAll('.articleShareButtons > *').length, 10, 'five functional controls at each placement');
    const controls = [...dom.window.document.querySelector('.articleShareButtons').children];
    assert.deepEqual(controls.map(node => node.getAttribute('aria-label')), ['แชร์บทความผ่าน LINE', 'แชร์บทความผ่าน Facebook', 'แชร์บทความผ่าน X', 'คัดลอกลิงก์บทความ', 'ถูกใจบทความ']);
    assert.equal(dom.window.document.querySelectorAll('.articleReadingTime svg').length, 0, 'approved metadata uses plain text only');
    const heart = () => dom.window.document.querySelector('button[aria-pressed]');
    await React.act(async () => { heart().click(); await settle(); });
    assert.equal(dom.window.document.querySelectorAll('button[aria-pressed="true"]').length, 2, 'server-confirmed heart state is shared across header/footer');
    rejectHeart = true;
    await React.act(async () => { heart().click(); await settle(); });
    assert.equal(dom.window.document.querySelectorAll('button[aria-pressed="true"]').length, 2, 'failed write must not fake a changed total or heart state');
    dom.window.localStorage.setItem('ccpun_cookie_consent', JSON.stringify({ status: 'accepted_all', analytics: true, expires: Date.now() + 60000 }));
    await React.act(async () => { dom.window.dispatchEvent(new dom.window.CustomEvent('ccpun:consent')); await settle(); });
    await React.act(async () => { dom.window.dispatchEvent(new dom.window.CustomEvent('ccpun:consent')); await settle(); });
    assert.equal(requests.filter(request => request.body?.type === 'view').length, 1, 'one view nonce per article mount even after repeated consent notifications');
    const copy = dom.window.document.querySelector('[aria-label="คัดลอกลิงก์บทความ"]');
    await React.act(async () => { copy.click(); await settle(); });
    const share = requests.find(request => request.body?.type === 'share');
    assert.equal(share.body.analyticsConsent, true);
    assert.match(dom.window.document.querySelector('.articleReadingTime').textContent, /ถูกใจ 1 ครั้ง/);
    deferShare = true;
    await React.act(async () => { copy.click(); await settle(); });
    rejectHeart = false;
    await React.act(async () => { heart().click(); await settle(); });
    assert.equal(dom.window.document.querySelectorAll('button[aria-pressed="false"]').length, 2);
    await React.act(async () => { releaseShare(); await settle(); });
    assert.equal(dom.window.document.querySelectorAll('button[aria-pressed="false"]').length, 2, 'late share response must preserve latest acknowledged heart state');
    assert.doesNotMatch(dom.window.document.querySelector('.articleReadingTime').textContent, /ถูกใจ/);
    assert.ok(dom.window.document.querySelector('[aria-label="การแชร์ที่บันทึกได้ 2 ครั้ง"]'), 'verified share total remains monotonic');
    assert.match(share.body.eventId, /^[0-9a-f-]{36}$/);
    assert.ok(requests.every(request => request.url === '/api/article-engagement/published-fixture/'));
  } finally {
    await React.act(async () => root.unmount());
    for (const [name, descriptor] of before) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; }
    dom.window.close();
  }
});
