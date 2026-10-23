import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { main as audit } from '../scripts/audit-monorepo-boundaries.mjs';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { loadFixtureModule } from '../qa/phase1-fixture-loader.mjs';
import { buildNextSecurityHeaders } from '../lib/runtime/security-headers.mjs';

const require = createRequire(import.meta.url);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { JSDOM } = require('jsdom');
const widget = loadFixtureModule('features/ai-search/CCPunAiSearchWidgets.tsx');
const host = 'https://f687f126-71f5-49d5-8193-ac2313dd8e3e.search.ai.cloudflare.com';
const chunk = (number = '01') => ({ text: '<script>bad()</script> [unsafe](javascript:bad())', item: { key: `ccpun-uat-qa-20261023-${number}.md`, metadata: {
  url: `https://test.ccpun.com/blog/${Number(number) % 2 ? 'personal-finance' : 'health-insurance'}/uat-qa-20261023-${number}/`,
  title: '<img src=x onerror=bad()>', document_id: `ccpun-uat-qa-article-20261023-${number}`,
} } });

const envelope = chunks => ({ success: true, result: { chunks } });

const read = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');

test('AI Search has no public Web consumer or query route; indexing and private boundaries stay separate', async () => {
  for (const file of ['apps/web/app/search/page.tsx', 'features/ai-search/SearchPage.tsx', 'features/ai-search/SearchPage.module.css']) {
    assert.equal(existsSync(new URL('../' + file, import.meta.url)), false, 'No dedicated search page is requested');
  }
  for (const file of ['app/layout.tsx', 'apps/web/app/layout.tsx', 'components/layout/website-43/Website43Navbar.tsx']) {
    assert.doesNotMatch(read(file), /CCPunAiSearch|href=.*\/search/);
  }
  assert.doesNotMatch(read('apps/web/next.config.ts'), /search\.ai\.cloudflare\.com/);
  const report = await audit({ log: false });
  assert.ok(!report.compatibilityMirrors.some(({ legacy }) => legacy === 'app/search/page.tsx'));
  assert.ok(!report.sharedRuntimeFiles.some((file) => file.startsWith('features/ai-search/')), 'Admin must not import public search');
  assert.deepEqual(report.crossWorkspaceImports, { webToAdmin: [], adminToWeb: [] });
  assert.equal(report.dependencies.some(({ name }) => name === '@cloudflare/ai-search-snippet'), false, 'No source imports the SDK, including dormant files');
  assert.doesNotMatch(read('features/ai-search/CCPunAiSearchWidgets.tsx'), /@cloudflare\/|search-.*-snippet|chat-bubble|dangerouslySetInnerHTML|innerHTML|eval\(/);
  assert.match(read('features/blog/website-43/Website43Blog.tsx'), /<Website43BlogInteractive/);
  assert.doesNotMatch(read('features/blog/website-43/Website43Blog.tsx'), /features\/ai-search/);
  const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' }).split('\0');
  const consumers = files.filter(file => /^(?:app|apps\/web|features|components|lib)\//.test(file)
    && /\.[cm]?[jt]sx?$/.test(file) && !file.startsWith('features/ai-search/') && existsSync(file));
  for (const file of consumers) {
    assert.doesNotMatch(read(file), /(?:from\s*|import\s*\(|require\s*\()\s*['"][^'"]*(?:features\/ai-search|ai-search-snippet)/, file);
    assert.doesNotMatch(read(file), /searchEnhancement|https:\/\/[^'"\s]*\.search\.ai\.cloudflare\.com/, file);
  }
  assert.deepEqual(files.filter(file => /^(?:app|apps\/web\/app)\/(?:search\/|api\/(?:[^/]+\/)*(?:ai-search|search)\/)/.test(file)), []);
  assert.ok(existsSync(new URL('../apps/web/app/sitemaps/ai-search.xml/route.ts', import.meta.url)), 'Published-only indexing feed remains');
});

test('actual Blog route never imports or mounts AI Search in any environment and retains local search params', async () => {
  for (const environment of ['web-uat', 'local-uat', 'production', 'local-production', 'admin-uat', 'production-admin', 'development', 'unknown', undefined]) {
    const calls = [];
    const route = loadFixtureModule('apps/web/app/blog/page.tsx', { globals: { process: { env: { CCPUN_APP_ENV: environment } } }, mocks: new Map([
      ['@/features/ai-search/CCPunAiSearchWidgets', { CCPunAiSearchBar: () => { throw new Error('Public AI Search must never mount'); } }],
      ['@/features/blog/pages/BlogArchivePage', { metadata: {}, renderBlogPage: props => { calls.push(props); return props.searchEnhancement ?? 'ORIGINAL BLOG'; } }],
      ['@/lib/seo/page-seo', { resolvePageSeoMetadata() {} }],
    ]) });
    const params = Promise.resolve({ q: 'original-local-query' });
    const result = await route.default({ searchParams: params });
    assert.equal(calls[0].searchParams, params);
    assert.equal(result, 'ORIGINAL BLOG');
    assert.deepEqual(calls, [{ searchParams: params }]);
  }
});

test('actual Blog shell ignores the removed AI slot while retaining the ordinary article search', async () => {
  const shell = loadFixtureModule('features/blog/website-43/Website43Blog.tsx', { mocks: new Map([
    ['@/lib/content/public-copy', { getPublicCopy: async () => ({}) }],
    ['@/components/ui/health-happy/availability', { isHealthHappyCampaignAvailable: async () => false }],
    ['@/components/ui/health-happy/HealthHappyCountdown', { __esModule: true, default: () => null }],
    ['@/components/layout/website-43/Website43Shared', { Website43Navbar: () => null, Website43Footer: () => null }],
    ['./ArticleCardEngagement', { __esModule: true, default: () => null }],
  ]) });
  const html = renderToStaticMarkup(await shell.default({ articles: [], searchEnhancement: React.createElement('aside', null, 'FORBIDDEN_AI_WIDGET') }));
  assert.doesNotMatch(html, /FORBIDDEN_AI_WIDGET|Cloudflare|search\.ai\.cloudflare\.com/);
  const dom = new JSDOM(html);
  assert.equal(dom.window.document.querySelectorAll('input[type="search"]').length, 1, 'ordinary local article filter stays');
  assert.equal(dom.window.document.querySelectorAll('h1').length, 1);
  dom.window.close();
});

test('preserved dormant prototype validation admits only the eleven exact UAT identities', () => {
  assert.equal(widget.parseAiSearchResults(envelope(Array.from({ length: 11 }, (_, i) => chunk(String(i + 1).padStart(2, '0'))))).length, 5);
  for (let i = 1; i <= 11; i++) assert.equal(widget.parseAiSearchResults(envelope([chunk(String(i).padStart(2, '0'))])).length, 1);
  for (const value of [null, {}, envelope(null), envelope({})]) assert.throws(() => widget.parseAiSearchResults(value), /unavailable/);
  for (const value of [{ chunks: [chunk()] }, { success: false, result: { chunks: [chunk()] } }, { success: true }, { success: true, result: null }, { success: true, result: [] }, { success: true, result: {} }, { success: 'true', result: { chunks: [chunk()] } }]) assert.throws(() => widget.parseAiSearchResults(value), /unavailable/);
  const hostileUrls = ['javascript:alert(1)', 'https://ccpun.com/blog/personal-finance/uat-qa-20261023-01/',
    'https://test.ccpun.com.evil.test/blog/personal-finance/uat-qa-20261023-01/', 'http://test.ccpun.com/blog/personal-finance/uat-qa-20261023-01/',
    'https://test.ccpun.com/admin/', 'https://test.ccpun.com/blog/personal-finance/uat-qa-20261023-01/?draft=1',
    'https://test.ccpun.com/blog/personal-finance/uat-qa-20261023-01/#drafts', 'https://test.ccpun.com/blog/health-insurance/uat-qa-20261023-01/'];
  for (const url of hostileUrls) { const item = chunk(); item.item.metadata.url = url; assert.deepEqual(widget.parseAiSearchResults(envelope([item])), []); }
  for (const [field, bad] of [['document_id', 'drafts.ccpun-uat-qa-article-20261023-01'], ['document_id', 'versions.release.article'], ['title', null]]) {
    const item = chunk(); item.item.metadata[field] = bad; assert.deepEqual(widget.parseAiSearchResults(envelope([item])), []);
  }
  const wrongKey = chunk(); wrongKey.item.key = 'ccpun-uat-qa-20261023-02.md';
  assert.deepEqual(widget.parseAiSearchResults(envelope([null, {}, { item: 'bad' }, wrongKey])), []);
  assert.equal(widget.parseAiSearchResults(envelope([chunk(), chunk()])).length, 1);
});

test('preserved dormant prototype request retains fixed retrieval settings and cancellation', async () => {
  let calls = 0;
  const controller = new AbortController();
  const request = async (url, options) => {
    calls++;
    assert.equal(url, host + '/search');
    assert.equal(options.method, 'POST'); assert.equal(options.credentials, 'omit'); assert.equal(options.redirect, 'error');
    assert.equal(options.referrerPolicy, 'no-referrer'); assert.equal(options.signal, controller.signal);
    assert.deepEqual(JSON.parse(options.body), { query: 'qa-marker-01', ai_search_options: { query_rewrite: { enabled: false }, reranking: { enabled: false }, retrieval: { retrieval_type: 'hybrid', max_num_results: 5, match_threshold: 0.2 } } });
    return { ok: true, json: async () => (envelope([chunk()])) };
  };
  assert.equal((await widget.searchUatArticles(' qa-marker-01 ', controller.signal, request)).length, 1);
  for (const query of ['', ' ', 'x'.repeat(201)]) await assert.rejects(widget.searchUatArticles(query, controller.signal, request), /query/);
  assert.equal(calls, 1);
  for (const status of [429, 500]) await assert.rejects(widget.searchUatArticles('test', controller.signal, async () => ({ ok: false, status })), status === 429 ? /rate-limit/ : /unavailable/);
  await assert.rejects(widget.searchUatArticles('test', controller.signal, async () => { throw new Error('offline'); }), /offline/);
  const aborted = widget.searchUatArticles('test', controller.signal, async (_, options) => new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))));
  controller.abort();
  await assert.rejects(aborted, { name: 'AbortError' });
});

test('backend-only AI Search restores frozen browser CSP in every Web and Admin environment', () => {
  // Complete, ordered header-array digests captured from reviewed source 1a56f1d6.
  // Keep these historical values independent of current output and Git history:
  // CI checks out shallow source and must still verify every header/directive.
  const baselineHashes = {
    production: 'b2aa6cd10eba7a8b49597ba2c03abef8fd5c253fea4ab8e009b3f169e330063b',
    'local-production': 'da04fcebf8d19afa3167a9c88d1c4f7245bb82fb6f01b18c3b325183ad998fab',
    'production-admin': 'b2aa6cd10eba7a8b49597ba2c03abef8fd5c253fea4ab8e009b3f169e330063b',
    'admin-uat': '1ed601dc29a1dd248f667df727195c479aedd68392e2eaebdec944673b580fd4',
    development: 'b2aa6cd10eba7a8b49597ba2c03abef8fd5c253fea4ab8e009b3f169e330063b',
    unknown: 'b2aa6cd10eba7a8b49597ba2c03abef8fd5c253fea4ab8e009b3f169e330063b',
    'web-uat': '1ed601dc29a1dd248f667df727195c479aedd68392e2eaebdec944673b580fd4',
    'local-uat': 'f91357f06695300091041b3d19a88bff15f3f106988e9d597c960ebd8b7f3227',
  };
  const digest = headers => createHash('sha256').update(JSON.stringify(headers)).digest('hex');
  const preservesBaseline = (headers, environment) => digest(headers) === baselineHashes[environment];
  for (const appEnvironment of ['production', 'local-production', 'production-admin', 'admin-uat', 'development', 'unknown', 'web-uat', 'local-uat']) {
    const options = { appEnvironment, nodeEnv: 'production', isReviewEnvironment: appEnvironment.includes('uat'), sanityProjectId: 'ccb9lnw5' };
    const actual = buildNextSecurityHeaders(options);
    const comparable = actual;
    assert.doesNotMatch(JSON.stringify(actual), /search\.ai\.cloudflare\.com/);
    assert.equal(preservesBaseline(comparable, appEnvironment), true, appEnvironment);
    const publicSearch = actual.map(header => header.key === 'Content-Security-Policy' ? { ...header, value: header.value.replace("connect-src 'self'", "connect-src 'self' " + host) } : header);
    assert.equal(preservesBaseline(publicSearch, appEnvironment), false, 'Public AI Search connection must fail');
    const changedHeader = comparable.map((header, index) => index ? header : { ...header, value: header.value + ' tampered' });
    assert.equal(preservesBaseline(changedHeader, appEnvironment), false, 'Unrelated header mutation must fail');
    assert.equal(preservesBaseline(comparable.filter(header => header.key !== 'Content-Security-Policy'), appEnvironment), false, 'Missing CSP must fail');
    assert.equal(preservesBaseline([...comparable, { key: 'X-Unreviewed', value: '1' }], appEnvironment), false, 'Extra header must fail');
  }
});

test('preserved dormant prototype form sends nothing on typing, escapes results and handles abort/failure', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://test.ccpun.com/blog/' });
  const saved = new Map(['window', 'document', 'navigator', 'IS_REACT_ACT_ENVIRONMENT', 'fetch', 'setTimeout', 'clearTimeout'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.defineProperties(globalThis, { window: { value: dom.window, configurable: true }, document: { value: dom.window.document, configurable: true }, navigator: { value: dom.window.navigator, configurable: true }, IS_REACT_ACT_ENVIRONMENT: { value: true, configurable: true, writable: true } });
  const { createRoot } = require('react-dom/client');
  const root = createRoot(dom.window.document.querySelector('#root'));
  let calls = 0;
  let response = async () => ({ ok: true, json: async () => (envelope([chunk()])) });
  globalThis.fetch = async (...args) => { calls++; return response(...args); };
  let timeout;
  const realSetTimeout = globalThis.setTimeout;
  const realClearTimeout = globalThis.clearTimeout;
  globalThis.setTimeout = (callback, delay, ...args) => delay === widget.AI_SEARCH_TIMEOUT_MS ? (timeout = callback, -1) : realSetTimeout(callback, delay, ...args);
  globalThis.clearTimeout = timer => { if (timer !== -1) realClearTimeout(timer); };
  try {
    await React.act(async () => root.render(React.createElement(widget.CCPunAiSearchBar)));
    const details = dom.window.document.querySelector('details');
    assert.equal(details.open, false); assert.equal(calls, 0);
    await React.act(async () => { details.open = true; details.dispatchEvent(new dom.window.Event('toggle')); });
    const input = dom.window.document.querySelector('input');
    await React.act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(input, 'qa-marker-01');
      input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
    assert.equal(calls, 0, 'typing never submits');
    const submit = async () => React.act(async () => dom.window.document.querySelector('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })));
    await submit();
    assert.equal(calls, 1);
    assert.equal(dom.window.document.querySelectorAll('script,img').length, 0);
    assert.equal(dom.window.document.querySelector('li a').textContent, '<img src=x onerror=bad()>');
    assert.match(dom.window.document.querySelector('li p').textContent, /<script>/);
    for (const [makeResponse, message] of [
      [async () => ({ ok: true, json: async () => (envelope([])) }), 'ไม่พบบทความทดสอบ'],
      [async () => ({ ok: false, status: 429 }), 'ค้นหาถี่เกินไป'],
      [async () => { throw new Error('offline'); }, 'ยังค้นหาไม่ได้'],
      [async () => ({ ok: true, json: async () => ({ unexpected: true }) }), 'ยังค้นหาไม่ได้'],
    ]) { response = makeResponse; await submit(); assert.ok(dom.window.document.querySelector('[role="status"]').textContent.includes(message)); }
    let pendingSignal;
    response = async (_, options) => new Promise((_, reject) => { pendingSignal = options.signal; options.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))); });
    await submit();
    assert.equal(pendingSignal.aborted, false);
    await React.act(async () => timeout());
    assert.equal(pendingSignal.aborted, true);
    assert.match(dom.window.document.querySelector('[role="status"]').textContent, /ใช้เวลานาน/);
    await submit();
    await React.act(async () => details.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    assert.equal(pendingSignal.aborted, true);
    assert.equal(details.open, false);
    assert.equal(dom.window.document.activeElement.tagName, 'SUMMARY');
    assert.equal(dom.window.document.querySelector('[role="status"]').textContent, '');
  } finally {
    await React.act(async () => root.unmount());
    for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
    dom.window.close();
  }
});
