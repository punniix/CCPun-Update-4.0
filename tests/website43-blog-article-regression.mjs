import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';

const require = createRequire(import.meta.url);
require('tsx/cjs');
require.extensions['.css'] = (module) => {
  module.exports = { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) };
};
const { toWebsite43ArticleItem } = require('../features/blog/website-43/blogData.ts');
const Article = require('../features/blog/website-43/Website43Article.tsx').default;
const article = {
  id: 'published-fixture', slug: 'fixture-article', category: 'ประกันชีวิต', categorySlug: 'life-insurance',
  title: 'บทความทดสอบ', excerpt: 'ข้อมูลทดสอบ', authorName: 'ผู้เขียนจากเนื้อหา', status: 'published',
  publishedAt: '2026-06-01T17:43:56Z', updatedAt: '2026-06-02T00:00:00Z',
  seoTitle: 'หัวข้อ SEO', seoDescription: 'คำอธิบาย SEO', tags: [],
  featuredImage: { src: '/assets/pun.jpg', alt: 'ภาพเปิด', width: 400, height: 400, caption: 'คำบรรยายภาพเปิด' },
  body: [
    { type: 'paragraph', text: 'บทนำ', segments: [{ text: 'ลิงก์อ้างอิง', href: 'https://example.com/reference', strong: true, emphasis: true, nofollow: true, sponsored: true }] },
    { type: 'heading', level: 2, text: 'หัวข้อหลัก' },
    { type: 'heading', level: 3, text: 'หัวข้อย่อย' },
    { type: 'image', src: '/assets/pun.jpg', alt: 'ภาพเนื้อหา', width: 400, height: 400, credit: 'เจ้าของภาพเดี่ยว' },
    { type: 'gallery', images: [{ src: '/assets/pun.jpg', alt: 'ภาพแกลเลอรี', width: 400, height: 400, caption: 'คำบรรยายแกลเลอรี', credit: 'เจ้าของแกลเลอรี' }] },
    { type: 'bulletList', items: ['รายการหนึ่ง', { text: 'รายการสอง', segments: [{ text: 'ตัวหนา', strong: true }] }] },
    { type: 'numberList', items: ['ขั้นตอนหนึ่ง'] },
    { type: 'quote', text: 'ข้อความอ้าง' },
    { type: 'callout', title: 'ข้อควรรู้', text: 'ข้อความเพิ่มเติม' },
    { type: 'cta', url: 'https://example.com/action', label: 'อ่านเพิ่มเติม', style: 'primary' },
    { type: 'pdf', title: 'เอกสารทดสอบ', description: 'คำอธิบายเอกสาร', url: 'https://example.com/file.pdf', size: 2097152 },
    { type: 'details', summary: 'รายละเอียดเพิ่มเติม', text: 'เนื้อหาซ่อน' },
    { type: 'table', headers: ['หัวตาราง'], rows: [['ข้อมูลตาราง']] },
    { type: 'divider' },
  ],
  sources: [{ label: 'แหล่งต้นทาง', url: 'https://example.com/source' }],
  faq: [{ question: 'คำถามทดสอบ', answer: 'คำตอบทดสอบ' }],
};
const doc = (element) => new JSDOM(renderToStaticMarkup(element)).window.document;
const rendered = doc(React.createElement(Article, { article }));
assert.equal(rendered.querySelectorAll('h1').length, 1);
assert.ok(rendered.querySelector('h2#section-2'), 'preserve legacy block-index + 1 heading IDs');
assert.ok(rendered.querySelector('a[href="#section-2"]'));
for (const text of ['คำบรรยายภาพเปิด', 'เครดิต: เจ้าของภาพเดี่ยว', 'คำบรรยายแกลเลอรี · เครดิต: เจ้าของแกลเลอรี', 'ผู้เขียนจากเนื้อหา', '(2.0 MB)', 'ผลิตภัณฑ์ประกันไม่ใช่เงินฝาก', 'คำถามทดสอบ', 'แหล่งต้นทาง']) assert.ok(rendered.body.textContent.includes(text), text);
for (const selector of ['ul li', 'ol li', 'blockquote', 'aside', 'details', 'table th', 'table td', 'hr', 'em strong']) assert.ok(rendered.querySelector(selector), selector);
const external = rendered.querySelector('a[href="https://example.com/reference"]');
assert.equal(external.target, '_blank');
for (const rel of ['noopener', 'noreferrer', 'nofollow', 'sponsored']) assert.ok(external.rel.split(' ').includes(rel));
assert.equal(rendered.querySelector('a[href="https://example.com/action"]').target, '_blank');
assert.ok(rendered.querySelector('a[href="/#about-ccpun"]'));
assert.ok([...rendered.querySelectorAll('button')].some((button) => button.textContent.includes('ตั้งค่าคุกกี้')));
assert.equal([...rendered.querySelectorAll('a')].filter((a) => !a.getAttribute('href') || a.getAttribute('href').startsWith('/preview/')).length, 0);
const profile = doc(React.createElement(Article, { article: { ...article, author: { name: 'ชื่อ CMS', profileName: 'ชื่อโปรไฟล์', profileCtaUrl: '#about-ccpun' } } }));
assert.ok(profile.body.textContent.includes('ชื่อโปรไฟล์'));
assert.ok(profile.querySelector('a[href="/#about-ccpun"]'));
const item = toWebsite43ArticleItem(article);
assert.match(item.meta, /2 มิ\.ย\. 2569/, 'Bangkok midnight date stays identical in SSR and hydration');
assert.equal(item.href, '/blog/life-insurance/fixture-article/');
assert.doesNotThrow(() => toWebsite43ArticleItem({ ...article, publishedAt: 'invalid' }));

// Exercise real route compositions with a provider that deliberately includes a Draft.
const health = { ...article, id: 'health', slug: 'aia-health-happy-describe', category: 'ประกันสุขภาพ', categorySlug: 'health-insurance', title: 'บทความสุขภาพ', body: [] };
const draft = { ...article, id: 'draft', slug: 'draft-only', title: 'DRAFT MUST NOT LEAK', status: 'draft' };
const calls = [];
const mock = (path, exports) => { require.cache[require.resolve(path)] = { exports }; };
mock('../lib/content/provider.ts', { getContentProvider: () => ({
  listArticles: async (options) => { calls.push(options); return [article, health, draft]; },
  getArticleBySlug: async (slug, options) => { calls.push(options); return [article, health, draft].find((entry) => entry.slug === slug) ?? null; },
}) });
mock('next/headers', { draftMode: async () => ({ isEnabled: true }) });
mock('../lib/deployment-environment.ts', { IS_DRAFT_PREVIEW_ALLOWED: false });
const overview = require('../features/blog/pages/BlogArchivePage.tsx').default;
const category = require('../features/blog/pages/BlogCategoryPage.tsx');
const articleRoute = require('../features/blog/pages/ArticlePage.tsx');
for (const [slug, label, expected] of [['health-insurance', 'ประกันสุขภาพ', 'บทความสุขภาพ'], ['investment', 'การลงทุน', null]]) {
  const markup = doc(await category.default({ params: Promise.resolve({ category: slug }) }));
  assert.equal(markup.querySelector('.categoryMenuButton').textContent.trim().startsWith(label), true);
  assert.equal(markup.querySelectorAll('h1').length, 1);
  assert.equal(markup.querySelector('h1').textContent, label);
  if (expected) assert.ok(markup.body.textContent.includes(expected));
  assert.ok(!markup.body.textContent.includes('DRAFT MUST NOT LEAK'));
  assert.ok(!markup.querySelector('a[href="/blog/life-insurance/fixture-article/"]'), 'category list stays filtered');
  const metadata = await category.generateMetadata({ params: Promise.resolve({ category: slug }) });
  assert.equal(metadata.alternates.canonical, `https://ccpun.com/blog/${slug}/`);
  if (slug === 'investment') assert.equal(metadata.robots.index, false);
}
const archive = doc(await overview({ searchParams: Promise.resolve({ q: 'ข้อมูล' }) }));
assert.equal(archive.querySelector('input[type="search"]').getAttribute('value'), 'ข้อมูล');
assert.ok(!archive.body.textContent.includes('DRAFT MUST NOT LEAK'));
assert.ok([...archive.querySelectorAll('nav[aria-label="หัวข้อบทความหลัก"] a')].some((link) => link.getAttribute('href').replace(/\/$/, '') === '/blog/health-insurance'));
await assert.rejects(articleRoute.default({ params: Promise.resolve({ category: 'life-insurance', slug: 'draft-only' }) }), /NEXT_HTTP_ERROR_FALLBACK;404/);
await assert.rejects(articleRoute.default({ params: Promise.resolve({ category: 'life-insurance', slug: health.slug }) }), /NEXT_REDIRECT/);
const draftMetadata = await articleRoute.generateMetadata({ params: Promise.resolve({ category: 'life-insurance', slug: 'draft-only' }) });
assert.equal(draftMetadata.robots.index, false);
assert.equal(draftMetadata.title, 'ไม่พบหน้า | CCPun');
assert.equal(draftMetadata.alternates.canonical, null);
assert.equal((await category.generateMetadata({ params: Promise.resolve({ category: 'missing-category' }) })).alternates.canonical, null);
await articleRoute.generateMetadata({ params: Promise.resolve({ category: 'life-insurance', slug: article.slug }) });
assert.ok(calls.length > 0 && calls.every((call) => call.includeDrafts === false), 'stale draft cookie cannot cross public Production read gate');
const shared = readFileSync(new URL('../components/layout/website-43/Website43Shared.tsx', import.meta.url), 'utf8');
assert.ok(shared.includes('Website43TransitionStyles') && shared.includes('Website43FinalPolishStyles'));
// Render the client list as a cached route remount after popstate already fired.
const browserDom = new JSDOM('<div id="app"></div>', { url: 'https://ccpun.com/blog/?q=สุขภาพ' });
const savedGlobals = new Map(['window', 'document', 'requestAnimationFrame', 'cancelAnimationFrame', 'IS_REACT_ACT_ENVIRONMENT'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
Object.defineProperties(globalThis, {
  window: { value: browserDom.window, configurable: true },
  document: { value: browserDom.window.document, configurable: true },
  requestAnimationFrame: { value: () => 0, configurable: true },
  cancelAnimationFrame: { value: () => {}, configurable: true },
  IS_REACT_ACT_ENVIRONMENT: { value: true, configurable: true },
});
mock('../components/layout/website-43/Website43Shared.tsx', { Website43Navbar: () => null, Website43Footer: () => null });
mock('next/link', { __esModule: true, default: ({ children, href, ...props }) => React.createElement('a', { ...props, href }, children) });
mock('next/image', { __esModule: true, default: ({ src, alt }) => React.createElement('img', { src, alt }) });
delete require.cache[require.resolve('../features/blog/website-43/Website43Blog.tsx')];
const BlogClient = require('../features/blog/website-43/Website43Blog.tsx').default;
const { createRoot } = require('react-dom/client');
const root = createRoot(browserDom.window.document.getElementById('app'));
await React.act(async () => root.render(React.createElement(BlogClient, { articles: [toWebsite43ArticleItem(article), toWebsite43ArticleItem(health)], initialQuery: '' })));
const input = browserDom.window.document.querySelector('input[type="search"]');
assert.equal(input.value, 'สุขภาพ', 'cached stale initial props must read the restored browser URL on mount');
assert.equal(browserDom.window.document.querySelectorAll('.articleGrid > a').length, 1);
await React.act(async () => {
  browserDom.window.history.replaceState(null, '', '/blog/');
  browserDom.window.dispatchEvent(new browserDom.window.PopStateEvent('popstate'));
});
assert.equal(input.value, '');
assert.equal(browserDom.window.document.querySelectorAll('.articleGrid > a').length, 2);
await React.act(async () => root.unmount());
for (const [key, descriptor] of savedGlobals) {
  if (descriptor) Object.defineProperty(globalThis, key, descriptor);
  else delete globalThis[key];
}
browserDom.window.close();
console.log('PASS: actual Article block/credit/anchor/profile renderer, Bangkok date, public route/filter/metadata/redirect, stale Draft cookie and cached browser query restoration');
