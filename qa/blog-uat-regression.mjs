import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@sanity/client';
import { LEGACY_ARTICLES as LEGACY_FIXTURES, mergeLegacyArticles } from '../lib/content/legacy.ts';

const CDP_HTTP = 'http://127.0.0.1:9222';
// Preflight every entry path before CDP, filesystem output or Sanity secret creation.
function validateUatTarget() {
  const parse = (value, origin) => {
    try { return new URL(value, origin); }
    catch { throw new Error('Invalid Blog UAT URL; details redacted'); }
  };
  const base = parse(process.env.UAT_BASE_URL || 'http://localhost:3001');
  const local = ['localhost', '127.0.0.1'].includes(base.hostname);
  const remote = base.protocol === 'https:' && !base.port
    && (base.hostname === 'test.ccpun.com' || base.hostname.endsWith('.vercel.app'));
  if (!(remote || (local && ['http:', 'https:'].includes(base.protocol)))
    || base.username || base.password || base.search || base.hash || base.pathname !== '/') {
    throw new Error('Blog QA requires a canonical UAT, local or HTTPS Preview target');
  }
  if (process.env.CCPUN_UAT_MODE !== '1' || process.env.VERCEL_ENV === 'production'
    || [process.env.CCPUN_APP_ENV, process.env.NEXT_PUBLIC_CCPUN_APP_ENV]
      .some((value) => value !== undefined && !['web-uat', 'local-uat'].includes(value))
    || base.hostname.includes('-git-v4-production-')
    || ['ccpun-web.vercel.app', 'ccpun.vercel.app', 'ccpun-web-punniixs-projects.vercel.app'].includes(base.hostname)) {
    throw new Error('Production is not a Blog UAT QA target');
  }
  for (const [keys, expected] of [
    [['SANITY_API_PROJECT_ID', 'NEXT_PUBLIC_SANITY_PROJECT_ID'], 'ccb9lnw5'],
    [['SANITY_API_DATASET', 'NEXT_PUBLIC_SANITY_DATASET'], 'uat'],
  ]) {
    if (!keys.some((key) => process.env[key] === expected)
      || keys.some((key) => process.env[key] !== undefined && process.env[key] !== expected)) {
      throw new Error('Blog QA requires the exact isolated Sanity UAT lane');
    }
  }
  if (process.env.BLOG_UAT_PREVIEW_URL) {
    const supplied = parse(process.env.BLOG_UAT_PREVIEW_URL);
    const redirect = supplied.searchParams.get('sanity-preview-pathname');
    const destination = redirect ? parse(redirect, base) : base;
    if (supplied.origin !== base.origin || supplied.username || supplied.password || supplied.hash
      || !['/api/preview/enable', '/api/preview/enable/'].includes(supplied.pathname)
      || new Set(supplied.searchParams.keys()).size !== [...supplied.searchParams].length
      || !supplied.searchParams.get('sanity-preview-secret') || destination.origin !== base.origin
      || destination.username || destination.password || destination.hash) {
      throw new Error('Supplied Blog UAT preview URL is not valid for this target; details redacted');
    }
  }
  return base.origin;
}
const BASE_URL = validateUatTarget();
if (process.argv.includes('--check-target')) {
  console.log('BLOG_UAT_TARGET_OK');
  process.exit(0);
}
const OUTPUT_DIR = path.resolve('qa/blog-uat');
const ARTICLE_PATH = '/blog/uat-article-system/';
const VIEWPORTS = [
  { name: 'mobile-320', width: 320, height: 568, mobile: true },
  { name: 'mobile-375', width: 375, height: 812, mobile: true },
  { name: 'mobile-390', width: 390, height: 844, mobile: true },
  { name: 'mobile-414', width: 414, height: 896, mobile: true },
  { name: 'tablet-820', width: 820, height: 1180, mobile: false },
  { name: 'tablet-1024', width: 1024, height: 1366, mobile: false },
  { name: 'desktop-1440', width: 1440, height: 1000, mobile: false },
];
const LEGACY_ARTICLES = [
  ['aia-vitality', 'https://blog.ccpun.com/aia-vitality/'],
  ['aia-health-happy-describe', 'https://blog.ccpun.com/aia-health-happy-describe/'],
  ['critical-illness-insurance', 'https://blog.ccpun.com/critical-illness-insurance/'],
  ['aia-health-ci-hero-guide', 'https://blog.ccpun.com/aia-health-ci-hero-guide/'],
  ['financial-pyramid', 'https://blog.ccpun.com/financial-pyramid/'],
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function createSecurePreviewUrl() {
  if (process.env.BLOG_UAT_PREVIEW_URL) return process.env.BLOG_UAT_PREVIEW_URL;

  const projectId = process.env.SANITY_API_PROJECT_ID || process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset = process.env.SANITY_API_DATASET || process.env.NEXT_PUBLIC_SANITY_DATASET;
  const token = process.env.SANITY_API_WRITE_TOKEN;
  if (!projectId || !dataset || !token) throw new Error('Sanity UAT env is required for secure Draft Mode QA');

  // ponytail: use Sanity's installed secret generator; replace only if it gains a public package export.
  let secret;
  try {
    const { createPreviewSecret } = await import('../node_modules/sanity/node_modules/@sanity/preview-url-secret/dist/create-secret.js');
    const client = createClient({ projectId, dataset, token, apiVersion: '2026-08-18', useCdn: false });
    ({ secret } = await createPreviewSecret(client, 'ccpun/uat-qa', new URL('/studio/', BASE_URL).href));
  } catch {
    throw new Error('Sanity secure preview setup failed; request details redacted');
  }
  const url = new URL('/api/preview/enable', BASE_URL);
  url.searchParams.set('sanity-preview-secret', secret);
  url.searchParams.set('sanity-preview-pathname', ARTICLE_PATH);
  return url.href;
}

async function createTarget() {
  const response = await fetch(`${CDP_HTTP}/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' });
  if (!response.ok) throw new Error(`Unable to create Chrome target: ${response.status}`);
  return response.json();
}

async function closeTarget(id) {
  await fetch(`${CDP_HTTP}/json/close/${id}`, { method: 'PUT' }).catch(() => undefined);
}

class CDPClient {
  constructor(url) {
    this.url = url;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
  }
  async connect() {
    this.ws = new WebSocket(this.url);
    this.ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(`${pending.method}: ${message.error.message}`));
        else pending.resolve(message.result ?? {});
        return;
      }
      for (const callback of this.listeners.get(message.method) ?? []) callback(message.params ?? {});
    });
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
  }
  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  once(method, timeoutMs = 15000) {
    return new Promise((resolve) => {
      const callback = (params) => {
        clearTimeout(timeout);
        this.listeners.set(method, (this.listeners.get(method) ?? []).filter((item) => item !== callback));
        resolve(params);
      };
      const timeout = setTimeout(() => {
        this.listeners.set(method, (this.listeners.get(method) ?? []).filter((item) => item !== callback));
        resolve(undefined);
      }, timeoutMs);
      this.listeners.set(method, [...(this.listeners.get(method) ?? []), callback]);
    });
  }
  close() { this.ws?.close(); }
}

async function evaluate(client, expression) {
  const result = await client.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Runtime evaluation failed');
  return result.result?.value;
}

async function navigate(client, url) {
  const loaded = client.once('Page.loadEventFired');
  await client.send('Page.navigate', { url });
  await loaded;
  await evaluate(client, `document.fonts?.ready?.then(() => true) ?? true`);
  await sleep(250);
}

async function setViewport(client, viewport) {
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: viewport.mobile,
    screenWidth: viewport.width, screenHeight: viewport.height, dontSetVisibleSize: false,
  });
}

async function screenshot(client, filename) {
  const metrics = await client.send('Page.getLayoutMetrics');
  const size = metrics.cssContentSize ?? metrics.contentSize;
  const shot = await client.send('Page.captureScreenshot', {
    format: 'png', captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: Math.ceil(size.width), height: Math.ceil(size.height), scale: 1 },
  });
  await writeFile(path.join(OUTPUT_DIR, filename), Buffer.from(shot.data, 'base64'));
}

await mkdir(OUTPUT_DIR, { recursive: true });
const target = await createTarget();
const client = new CDPClient(target.webSocketDebuggerUrl);
const report = { generatedAt: new Date().toISOString(), baseUrl: BASE_URL, viewports: {}, summary: { passed: 0, failed: 0 } };

const publishedReplacement = { ...LEGACY_FIXTURES[0], id: 'cms-aia-vitality', legacyUrl: undefined };
const draftReplacement = { ...publishedReplacement, id: 'drafts.cms-aia-vitality', status: 'draft' };
const previewDraft = { ...draftReplacement, id: 'drafts.uat-article-system', slug: 'uat-article-system' };
const publishedMerge = mergeLegacyArticles([publishedReplacement]);
const draftMerge = mergeLegacyArticles([draftReplacement]);
const previewMerge = mergeLegacyArticles([previewDraft]);
const mergeChecks = [
  {
    name: 'published CMS slug suppresses its legacy card',
    pass: publishedMerge.filter((article) => article.slug === 'aia-vitality').length === 1
      && publishedMerge.find((article) => article.slug === 'aia-vitality')?.legacyUrl === undefined,
  },
  {
    name: 'draft CMS slug does not hide its published legacy card',
    pass: draftMerge.filter((article) => article.slug === 'aia-vitality').length === 2
      && draftMerge.some((article) => article.slug === 'aia-vitality' && article.legacyUrl),
  },
  {
    name: 'Preview composition includes five legacy cards plus its draft',
    pass: previewMerge.filter((article) => article.legacyUrl).length === 5
      && previewMerge.filter((article) => article.status === 'draft').length === 1,
  },
];
for (const check of mergeChecks) {
  if (check.pass) report.summary.passed++;
  else report.summary.failed++;
}
report.legacyMerge = { checks: mergeChecks };

try {
  await client.connect();
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Network.enable');

  const rejectedPreview = await fetch(`${BASE_URL}/api/preview/enable/`, { redirect: 'manual' });
  const rejectedPreviewLocation = rejectedPreview.headers.get('location') || '';
  const rejectedByVercelProtection = rejectedPreview.status === 302
    && /^https:\/\/vercel\.com\/sso-api\?/.test(rejectedPreviewLocation);
  const rejectedPreviewCheck = {
    name: 'unauthenticated preview handshake is rejected',
    pass: rejectedPreview.status === 401 || rejectedByVercelProtection,
    details: rejectedByVercelProtection ? 'HTTP 302 (Vercel Deployment Protection)' : `HTTP ${rejectedPreview.status}`,
  };
  if (rejectedPreviewCheck.pass) report.summary.passed++;
  else report.summary.failed++;
  report.previewSecurity = { checks: [rejectedPreviewCheck] };

  await navigate(client, `${BASE_URL}/blog/`);
  const normalLegacyCount = await evaluate(client, `document.querySelectorAll('[data-legacy-article="true"]').length`);
  for (let index = 0; index < normalLegacyCount; index++) {
    await evaluate(client, `document.querySelectorAll('[data-legacy-article="true"]')[${index}]?.scrollIntoView({ block: 'center' })`);
    await sleep(150);
  }
  await evaluate(client, `Promise.all([...document.querySelectorAll('[data-legacy-article="true"] img')].map((image) => {
    if (image.complete) return true;
    return new Promise((resolve) => {
      const done = () => resolve(true);
      image.addEventListener('load', done, { once: true });
      image.addEventListener('error', done, { once: true });
      setTimeout(done, 5000);
    });
  }))`);
  const normalState = await evaluate(client, `(() => ({
    totalCards: document.querySelectorAll('.blog-archive-grid article').length,
    draftCards: document.querySelectorAll('[data-article-slug="uat-article-system"]').length,
    legacyCards: [...document.querySelectorAll('[data-legacy-article="true"]')].map((card) => ({
      slug: card.getAttribute('data-article-slug'),
      href: card.querySelector('[data-article-link]')?.href || '',
      target: card.querySelector('[data-article-link]')?.getAttribute('target'),
      imageLoaded: Boolean(card.querySelector('img')?.complete && card.querySelector('img')?.naturalWidth > 0),
      legacyLabel: card.innerText.includes('คลังบทความเดิม'),
    })),
  }))()`);
  const sitemapResponse = await fetch(`${BASE_URL}/sitemaps/blog.xml/`);
  const sitemap = await sitemapResponse.text();
  const normalChecks = [
    {
      name: 'normal mode shows exactly five legacy cards and no draft',
      pass: normalState.totalCards === 5 && normalState.legacyCards.length === 5 && normalState.draftCards === 0,
      details: `${normalState.totalCards} total, ${normalState.legacyCards.length} legacy, ${normalState.draftCards} draft`,
    },
    {
      name: 'legacy cards use exact same-tab WordPress URLs',
      pass: LEGACY_ARTICLES.every(([slug, href]) => normalState.legacyCards.some((card) => card.slug === slug && card.href === href && card.target === null)),
    },
    {
      name: 'all legacy remote images and transition labels render',
      pass: normalState.legacyCards.every((card) => card.imageLoaded && card.legacyLabel),
    },
    {
      name: 'legacy WordPress cards never enter the Website 4.0 blog sitemap',
      pass: sitemapResponse.ok && !sitemap.includes('blog.ccpun.com') && LEGACY_ARTICLES.every(([slug]) => !sitemap.includes(`/blog/${slug}/`)),
      details: `HTTP ${sitemapResponse.status}`,
    },
  ];
  for (const check of normalChecks) {
    if (check.pass) report.summary.passed++;
    else report.summary.failed++;
  }
  report.normalMode = { checks: normalChecks, state: normalState };

  try { await navigate(client, await createSecurePreviewUrl()); }
  catch { throw new Error('Sanity secure preview navigation failed; request details redacted'); }

  for (const viewport of VIEWPORTS) {
    await setViewport(client, viewport);
    await navigate(client, `${BASE_URL}/blog/`);
    const hubState = await evaluate(client, `(() => {
      const hero = document.querySelector('.blog-hub-hero');
      const image = document.querySelector('[data-uat-role="blog-hub-background"] img');
      return {
        h1: document.querySelector('h1')?.textContent?.trim() || '',
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        imageLoaded: Boolean(image?.complete && image?.naturalWidth > 0),
        imageSource: image?.currentSrc || image?.src || '',
        heroHeight: hero?.getBoundingClientRect().height || 0,
        legacyCards: document.querySelectorAll('[data-legacy-article="true"]').length,
        draftCards: document.querySelectorAll('[data-article-slug="uat-article-system"]').length,
      };
    })()`);
    const hubChecks = [
      { name: 'Blog hub H1 remains present', pass: hubState.h1 === 'บทความ' },
      { name: 'Blog hub has no horizontal overflow', pass: !hubState.overflow },
      { name: 'CCPun finance hero image loads', pass: hubState.imageLoaded && hubState.imageSource.includes('blog-hub-hero-ccpun-v1') },
      { name: 'Blog hub hero retains responsive height', pass: hubState.heroHeight >= 304, details: `${Math.round(hubState.heroHeight)}px` },
      { name: 'Preview shows five legacy cards plus the CMS draft', pass: hubState.legacyCards === 5 && hubState.draftCards === 1 },
    ];
    for (const check of hubChecks) {
      if (check.pass) report.summary.passed++;
      else report.summary.failed++;
    }
    await screenshot(client, `index-${viewport.name}.png`);

    const controls = await evaluate(client, `({
      categoryButtons: document.querySelectorAll('[data-blog-category]').length,
      searchInput: Boolean(document.querySelector('#blog-search')),
      searchButton: Boolean(document.querySelector('form[role="search"] button[type="submit"]')),
    })`);
    await evaluate(client, `document.querySelector('[data-blog-category="การเงินส่วนบุคคล"]')?.click()`);
    await sleep(100);
    const categoryState = await evaluate(client, `({
      url: location.href,
      active: document.querySelector('[data-blog-category="การเงินส่วนบุคคล"]')?.getAttribute('aria-pressed'),
      resultCount: document.querySelectorAll('.blog-archive-grid article').length,
      resultSlugs: [...document.querySelectorAll('.blog-archive-grid article')].map((article) => article.getAttribute('data-article-slug')),
    })`);
    await evaluate(client, `document.querySelector('[data-blog-category="all"]')?.click()`);
    await sleep(100);
    await evaluate(client, `(() => {
      const input = document.querySelector('#blog-search');
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, 'zzzz-no-article-uat');
      input?.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await sleep(100);
    const emptyState = await evaluate(client, `document.body.innerText.includes('ไม่พบบทความที่ตรงกับตัวกรอง')`);
    await evaluate(client, `(() => {
      const input = document.querySelector('#blog-search');
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, 'AIA Vitality');
      input?.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await sleep(100);
    const legacySearchState = await evaluate(client, `({
      url: location.href,
      value: document.querySelector('#blog-search')?.value || '',
      resultCount: document.querySelectorAll('.blog-archive-grid article').length,
      resultSlug: document.querySelector('.blog-archive-grid article')?.getAttribute('data-article-slug') || '',
    })`);
    await evaluate(client, `(() => {
      const input = document.querySelector('#blog-search');
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, 'Sanity Draft CMS');
      input?.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await sleep(100);
    const searchState = await evaluate(client, `({
      url: location.href,
      value: document.querySelector('#blog-search')?.value || '',
      result: document.body.innerText.includes('ตัวอย่างบทความ UAT — Sanity Draft CMS'),
    })`);
    const interactionChecks = [
      { name: 'five category filters and search controls are interactive', pass: controls.categoryButtons === 5 && controls.searchInput && controls.searchButton },
      { name: 'category click updates active state and shareable URL', pass: categoryState.active === 'true' && categoryState.url.includes('category=') },
      { name: 'category filter includes the matching legacy article', pass: categoryState.resultSlugs.includes('financial-pyramid'), details: `${categoryState.resultCount} articles` },
      { name: 'empty search state gives useful feedback', pass: emptyState },
      { name: 'search filters legacy articles and updates shareable URL', pass: legacySearchState.value === 'AIA Vitality' && legacySearchState.resultCount === 1 && legacySearchState.resultSlug === 'aia-vitality' && legacySearchState.url.includes('q=AIA+Vitality') },
      { name: 'search filters CMS articles and updates shareable URL', pass: searchState.value === 'Sanity Draft CMS' && searchState.result && searchState.url.includes('q=Sanity+Draft+CMS') },
    ];
    for (const check of interactionChecks) {
      if (check.pass) report.summary.passed++;
      else report.summary.failed++;
    }

    await navigate(client, `${BASE_URL}${ARTICLE_PATH}`);
    const state = await evaluate(client, `(() => {
      const featuredImageWrapper = document.querySelector('[data-uat-role="article-featured-image"]');
      const featuredImage = featuredImageWrapper?.querySelector('img');
      const featuredImageBounds = featuredImageWrapper?.getBoundingClientRect();
      return {
        viewport: window.innerWidth,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        h1: document.querySelector('h1')?.textContent?.trim() || '',
        robots: document.querySelector('meta[name="robots"]')?.content || '',
        canonical: document.querySelector('link[rel="canonical"]')?.href || '',
        navbar: Boolean(document.querySelector('nav')),
        footer: Boolean(document.querySelector('footer')),
        draftBadge: document.body.innerText.includes('Draft UAT · noindex'),
        articleWidth: document.querySelector('.blog-content')?.getBoundingClientRect().width || 0,
        bodyFont: getComputedStyle(document.body).fontFamily,
        featuredImage: {
          present: Boolean(featuredImageWrapper && featuredImage),
          ratio: featuredImageBounds?.height ? featuredImageBounds.width / featuredImageBounds.height : 0,
          objectFit: featuredImage ? getComputedStyle(featuredImage).objectFit : '',
        },
        faqVisible: document.body.innerText.includes('คำถามที่พบบ่อย') && document.querySelectorAll('section details').length >= 2,
        articleSchemaPresent: [...document.querySelectorAll('script[type="application/ld+json"]')].some((script) => {
          const text = script.textContent || '';
          return text.includes('BlogPosting') || text.includes('#article') || text.includes('#faq');
        }),
      };
    })()`);

    const checks = [
      { name: 'viewport width matches', pass: Math.abs(state.viewport - viewport.width) <= 1, details: `${state.viewport} vs ${viewport.width}` },
      { name: 'no horizontal overflow', pass: !state.overflow },
      { name: 'Sanity draft H1 present', pass: state.h1.includes('Sanity Draft CMS') },
      { name: 'draft is noindex,nofollow', pass: state.robots.includes('noindex') && state.robots.includes('nofollow') },
      { name: 'canonical uses final CCPun path', pass: state.canonical === 'https://ccpun.com/blog/uat-article-system/' },
      { name: 'shared navbar present', pass: state.navbar },
      { name: 'shared footer present', pass: state.footer },
      { name: 'draft badge visible', pass: state.draftBadge },
      { name: 'article measure stays readable', pass: state.articleWidth > 0 && state.articleWidth <= 768, details: `${Math.round(state.articleWidth)}px` },
      {
        name: 'Draft Preview featured image matches Blog thumbnail 16:9 cover contract',
        pass: state.featuredImage.present
          && Math.abs(state.featuredImage.ratio - (16 / 9)) <= 0.02
          && state.featuredImage.objectFit === 'cover',
        details: `${state.featuredImage.ratio.toFixed(3)} ratio, ${state.featuredImage.objectFit || 'missing'} fit`,
      },
      { name: 'Kanit remains primary font', pass: state.bodyFont.toLowerCase().includes('kanit'), details: state.bodyFont },
      { name: 'visible FAQ renders from content model', pass: state.faqVisible },
      { name: 'draft emits no article structured data', pass: !state.articleSchemaPresent },
    ];

    for (const check of checks) {
      if (check.pass) report.summary.passed++;
      else report.summary.failed++;
    }
    report.viewports[viewport.name] = { hubChecks, interactionChecks, checks };
    await screenshot(client, `article-${viewport.name}.png`);
  }

  const disableResponse = await evaluate(client, `fetch('/api/preview/disable/', { method: 'POST' }).then((response) => ({ ok: response.ok, pathname: new URL(response.url).pathname }))`);
  if (!disableResponse?.ok || disableResponse.pathname !== '/blog/') {
    throw new Error('Preview disable POST did not complete successfully');
  }
  await navigate(client, `${BASE_URL}${ARTICLE_PATH}`);
  const disabled = await evaluate(client, `({title: document.title, robots: document.querySelector('meta[name="robots"]')?.content || ''})`);
  const disableChecks = [
    { name: 'draft disappears after preview disabled', pass: disabled.title.includes('ไม่พบหน้า') },
    { name: 'not-found remains noindex', pass: disabled.robots.includes('noindex') },
  ];
  for (const check of disableChecks) {
    if (check.pass) report.summary.passed++;
    else report.summary.failed++;
  }
  report.previewDisabled = { checks: disableChecks };

  await writeFile(path.join(OUTPUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.summary));
  if (report.summary.failed > 0) process.exitCode = 1;
} finally {
  client.close();
  await closeTarget(target.id);
}
