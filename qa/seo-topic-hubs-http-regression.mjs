import assert from 'node:assert/strict';

const ORIGIN = process.env.SEO_TEST_ORIGIN || 'http://127.0.0.1:3000';

async function request(path, { redirect = 'follow' } = {}) {
  const response = await fetch(new URL(path, ORIGIN), { redirect });
  const text = redirect === 'manual' && response.status >= 300 && response.status < 400 ? '' : await response.text();
  return { response, text };
}

function assertStatus(actual, expected, path) {
  assert.equal(actual, expected, `${path} expected HTTP ${expected}, got ${actual}`);
}

function assertCanonical(html, expected, path) {
  const escaped = expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert.match(html, new RegExp(`<link[^>]+rel=["']canonical["'][^>]+href=["']${escaped}["']|<link[^>]+href=["']${escaped}["'][^>]+rel=["']canonical["']`, 'i'), `${path} missing self/article canonical ${expected}`);
}

function assertRobots(html, { index, follow }, path) {
  const matches = [...html.matchAll(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)["'][^>]*>/gi)];
  assert.ok(matches.length, `${path} missing robots meta`);
  const content = matches.map((match) => match[1].toLowerCase()).join(',');
  assert.equal(content.includes('noindex'), !index, `${path} robots indexability mismatch: ${content}`);
  assert.equal(content.includes('nofollow'), !follow, `${path} robots follow mismatch: ${content}`);
}

function assertContains(html, value, label) {
  assert.ok(html.includes(value), `${label} missing ${value}`);
}

const hubCases = [
  {
    path: '/blog/personal-finance/',
    canonical: 'https://ccpun.com/blog/personal-finance/',
    index: true,
    mustContain: ['/blog/personal-finance/financial-pyramid/'],
  },
  {
    path: '/blog/life-insurance/',
    canonical: 'https://ccpun.com/blog/life-insurance/',
    index: true,
    mustContain: ['/blog/life-insurance/aia-vitality/'],
  },
  {
    path: '/blog/health-insurance/',
    canonical: 'https://ccpun.com/blog/health-insurance/',
    index: true,
    mustContain: [
      '/blog/health-insurance/aia-health-happy-describe/',
      '/blog/health-insurance/aia-health-ci-hero-guide/',
      '"@type":"CollectionPage"',
      '"@type":"ItemList"',
    ],
  },
  {
    path: '/blog/critical-illness/',
    canonical: 'https://ccpun.com/blog/critical-illness/',
    index: true,
    mustContain: [
      '/blog/life-insurance/critical-illness-insurance/',
      '/ci-planning/',
      '"@type":"CollectionPage"',
      '"@type":"ItemList"',
    ],
  },
  {
    path: '/blog/investment/',
    canonical: 'https://ccpun.com/blog/investment/',
    index: false,
    mustContain: ['การลงทุน'],
  },
];

for (const hub of hubCases) {
  const { response, text } = await request(hub.path);
  assertStatus(response.status, 200, hub.path);
  assertCanonical(text, hub.canonical, hub.path);
  assertRobots(text, { index: hub.index, follow: true }, hub.path);
  assertContains(text, 'href="/"', `${hub.path} visible breadcrumb`);
  assertContains(text, 'href="/blog/"', `${hub.path} visible breadcrumb`);
  for (const value of hub.mustContain) assertContains(text, value, hub.path);
  if (!hub.index) {
    assert.ok(!text.includes('"@type":"ItemList"'), `${hub.path} should not emit ItemList while noindex/thin`);
  }
}

const canonicalArticles = [
  ['/blog/health-insurance/aia-health-happy-describe/', 'https://ccpun.com/blog/health-insurance/aia-health-happy-describe/', '/blog/health-insurance/', 'ประกันสุขภาพ'],
  ['/blog/health-insurance/aia-health-ci-hero-guide/', 'https://ccpun.com/blog/health-insurance/aia-health-ci-hero-guide/', '/blog/health-insurance/', 'ประกันสุขภาพ'],
  ['/blog/life-insurance/critical-illness-insurance/', 'https://ccpun.com/blog/life-insurance/critical-illness-insurance/', '/blog/critical-illness/', 'ประกันโรคร้ายแรง'],
  ['/blog/life-insurance/aia-vitality/', 'https://ccpun.com/blog/life-insurance/aia-vitality/', '/blog/life-insurance/', 'ประกันชีวิต'],
  ['/blog/personal-finance/financial-pyramid/', 'https://ccpun.com/blog/personal-finance/financial-pyramid/', '/blog/personal-finance/', 'การเงินส่วนบุคคล'],
];

for (const [path, canonical, topicPath, articleSection] of canonicalArticles) {
  const { response, text } = await request(path);
  assertStatus(response.status, 200, path);
  assertCanonical(text, canonical, path);
  assertContains(text, 'href="/"', `${path} visible breadcrumb`);
  assertContains(text, 'href="/blog/"', `${path} visible breadcrumb`);
  assertContains(text, `href="${topicPath}"`, `${path} semantic breadcrumb`);
  assertContains(text, `"articleSection":"${articleSection}"`, `${path} JSON-LD`);
  assertContains(text, `"mainEntityOfPage":"${canonical}"`, `${path} JSON-LD canonical`);
}

const oldRedirects = [
  ['/blog/life-insurance/aia-health-happy-describe/', '/blog/health-insurance/aia-health-happy-describe/'],
  ['/blog/life-insurance/aia-health-ci-hero-guide/', '/blog/health-insurance/aia-health-ci-hero-guide/'],
  ['/blog/critical-illness/critical-illness-insurance/', '/blog/life-insurance/critical-illness-insurance/'],
];

for (const [oldPath, finalPath] of oldRedirects) {
  const first = await request(oldPath, { redirect: 'manual' });
  assert.ok([301, 308].includes(first.response.status), `${oldPath} expected permanent redirect, got ${first.response.status}`);
  const location = first.response.headers.get('location');
  assert.ok(location, `${oldPath} missing Location header`);
  assert.equal(new URL(location, ORIGIN).pathname, finalPath, `${oldPath} must redirect directly to final current URL`);

  const final = await request(finalPath, { redirect: 'manual' });
  assertStatus(final.response.status, 200, finalPath);
}

const blog = await request('/blog/');
assertStatus(blog.response.status, 200, '/blog/');
assert.ok(!blog.text.includes('aria-label="หัวข้อบทความหลัก"'), '/blog/ must not render the removed topic-navigation section');
assert.ok(!blog.text.includes('เลือกหัวข้อที่ต้องการอ่าน'), '/blog/ must not render the removed topic-navigation heading');

const sitemap = await request('/sitemaps/blog.xml');
assertStatus(sitemap.response.status, 200, '/sitemaps/blog.xml');
for (const loc of [
  'https://ccpun.com/blog/personal-finance/',
  'https://ccpun.com/blog/life-insurance/',
  'https://ccpun.com/blog/health-insurance/',
  'https://ccpun.com/blog/critical-illness/',
  ...canonicalArticles.map(([, canonical]) => canonical),
]) {
  assertContains(sitemap.text, `<loc>${loc}</loc>`, '/sitemaps/blog.xml');
}
for (const staleLoc of [
  'https://ccpun.com/blog/life-insurance/aia-health-happy-describe/',
  'https://ccpun.com/blog/life-insurance/aia-health-ci-hero-guide/',
]) {
  assert.ok(!sitemap.text.includes(`<loc>${staleLoc}</loc>`), `/sitemaps/blog.xml must not contain stale Health Life URL ${staleLoc}`);
}
assert.equal(new Set([...sitemap.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1])).size, [...sitemap.text.matchAll(/<loc>([^<]+)<\/loc>/g)].length, 'blog sitemap must not contain duplicate URLs');
assert.ok(!sitemap.text.includes('https://ccpun.com/blog/investment/'), 'noindex investment hub must not be in sitemap');
assert.ok(!sitemap.text.includes('?category=') && !sitemap.text.includes('?tag='), 'filter URLs must not be in sitemap');

// This suite intentionally runs in Local Production read mode, which is a protected review lane.
// The live public robots contract (Sitemap + private-path disallows) is enforced statically and
// re-verified against ccpun.com after deployment. The review lane itself must remain fully blocked.
const robotsTxt = await request('/robots.txt');
assertStatus(robotsTxt.response.status, 200, '/robots.txt');
assertContains(robotsTxt.text, 'User-Agent: *', '/robots.txt');
assertContains(robotsTxt.text, 'Disallow: /', '/robots.txt');
assert.ok(!robotsTxt.text.includes('Sitemap: https://ccpun.com/sitemap.xml'), '/robots.txt review lane must not advertise the public sitemap');

console.log('PASS: SEO topic hub HTTP regression');
