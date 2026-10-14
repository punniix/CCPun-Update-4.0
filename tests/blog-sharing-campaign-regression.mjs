import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
require('tsx/cjs');
require.extensions['.css'] = (mod) => {
  mod.exports = { __esModule: true, default: new Proxy({}, { get: (_obj, name) => String(name) }) };
};
const { estimateArticleReadingMinutes } = require('../features/blog/website-43/articleReadingTime.ts');
const ArticleShareActions = require('../features/blog/website-43/ArticleShareActions.tsx').default;
const { sanitizeEventParams, resolveEventMapping } = require('../lib/analytics.ts');

test('reading estimate uses content not excerpt, counts Thai segmented words and table/FAQ', () => {
  assert.equal(estimateArticleReadingMinutes({ body: [] }), 1);
  const article = {
    body: [
      { type: 'heading', level: 2, text: 'คำนวณภาษี' },
      { type: 'paragraph', text: 'ignored duplicate', segments: [{ text: 'เงินเดือน' }, { text: 'ค่าลดหย่อน' }] },
      { type: 'table', headers: ['ฐานภาษี'], rows: [['ห้าหมื่นบาท', 'บาท']] },
      { type: 'bulletList', items: ['รายรับ', { text: 'expenses', segments: [{ text: 'ค่าใช้จ่าย' }] }] },
    ],
    faq: [{ question: 'ภาษีคืออะไร', answer: 'เงินที่ต้องจ่าย' }],
  };
  assert.ok(estimateArticleReadingMinutes(article) >= 1);
  const long = { body: [{ type: 'paragraph', text: Array(600).fill('ค่าใช้จ่าย').join(' ') }] };
  assert.ok(estimateArticleReadingMinutes(long) >= 2);
  assert.ok(estimateArticleReadingMinutes(long) > estimateArticleReadingMinutes(article));
});

test('brand vector share actions use public canonical URLs and accessible names', () => {
  const html = renderToStaticMarkup(createElement(ArticleShareActions, {
    path: '/blog/personal-finance/personal-income-tax-calculation/', title: 'คำนวณภาษี', placement: 'header',
  }));
  assert.match(html, /aria-label="แชร์บทความผ่าน LINE"/);
  assert.match(html, /aria-label="แชร์บทความผ่าน Facebook"/);
  assert.match(html, /aria-label="แชร์บทความผ่าน X"/);
  assert.match(html, /aria-label="คัดลอกลิงก์บทความ"/);
  assert.match(html, /social-plugins\.line\.me\/lineit\/share\?url=/);
  assert.match(html, /facebook\.com\/sharer\/sharer\.php/);
  assert.match(html, /twitter\.com\/intent\/tweet/);
  assert.match(html, /ccpun\.com%2Fblog%2Fpersonal-finance/);
  assert.doesNotMatch(html, /test\.ccpun\.com|localhost|<script/);
  assert.equal((html.match(/<svg/g) ?? []).length, 4, 'three genuine social logos and one link symbol');
  assert.ok((html.match(/width="21"/g) ?? []).length >= 3);
});

test('share dimensions are allowlisted and raw user data is dropped', () => {
  const safe = sanitizeEventParams({
    method: 'line', content_type: 'article', share_placement: 'footer',
    campaign_id: 'aia_health_happy_2026', campaign_placement: 'blog', campaign_action: 'line',
    cta_location: 'countdown',
    phone: '0811234567', email: 'private@example.com', article_title: 'sensitive title',
  });
  assert.deepEqual(safe, {
    cta_location: 'countdown', method: 'line', content_type: 'article', share_placement: 'footer',
    campaign_id: 'aia_health_happy_2026', campaign_placement: 'blog', campaign_action: 'line',
  });
  assert.deepEqual(sanitizeEventParams({ campaign_id: 'arbitrary', method: 'unknown' }), {});
  assert.deepEqual(resolveEventMapping('share', safe), { ga: ['share'], meta: 'none' });
  assert.deepEqual(resolveEventMapping('health_happy_countdown_view', safe), { ga: ['health_happy_countdown_view'], meta: 'none' });
});

test('Preview shares hidden and countdown view is once per intersection, not every second', () => {
  const source = readFileSync('features/blog/website-43/Website43Article.tsx', 'utf8');
  const countdown = readFileSync('components/ui/health-happy/HealthHappyCountdown.tsx', 'utf8');
  const consent = readFileSync('lib/analytics.ts', 'utf8');
  assert.equal((source.match(/!preview &&/g) || []).length, 2);
  assert.match(source, /ArticleShareActions path=\{sharePath\} title=\{article\.title\} placement="header"/);
  assert.match(source, /ArticleShareActions path=\{sharePath\} title=\{article\.title\} placement="footer"/);
  assert.match(countdown, /IntersectionObserver\(/);
  assert.match(countdown, /threshold: 0\.5/);
  assert.match(countdown, /observer\.disconnect\(\)/);
  assert.match(countdown, /health_happy_countdown_click/);
  assert.match(consent, /if \(!consent\) return;/);
});
