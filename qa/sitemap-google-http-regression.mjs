import assert from 'node:assert/strict';

const ORIGIN = process.env.SEO_TEST_ORIGIN || 'http://127.0.0.1:3000';

async function request(path) {
  const response = await fetch(new URL(path, ORIGIN));
  return { response, text: await response.text() };
}

function assertStatus(actual, expected, path) {
  assert.equal(actual, expected, `${path} expected HTTP ${expected}, got ${actual}`);
}

function extractLocations(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
}

function extractUrlEntries(xml) {
  return [...xml.matchAll(/<url><loc>([^<]+)<\/loc>(?:<lastmod>([^<]+)<\/lastmod>)?<\/url>/g)].map((match) => ({
    loc: match[1],
    lastmod: match[2] || null,
  }));
}

const root = await request('/sitemap.xml');
assertStatus(root.response.status, 200, '/sitemap.xml');
for (const child of [
  'https://ccpun.com/sitemaps/core.xml',
  'https://ccpun.com/sitemaps/tools.xml',
  'https://ccpun.com/sitemaps/blog.xml',
]) {
  assert.ok(root.text.includes(`<loc>${child}</loc>`), `/sitemap.xml missing ${child}`);
}

const core = await request('/sitemaps/core.xml');
assertStatus(core.response.status, 200, '/sitemaps/core.xml');
assert.ok(!core.text.includes('<lastmod>'), 'core sitemap must omit unverifiable hard-coded lastmod values');
assert.ok(!core.text.includes('<loc>https://ccpun.com/blog/</loc>'), 'blog root must be owned by the dynamic blog sitemap');

const approvedCore = [
  'https://ccpun.com/',
  'https://ccpun.com/about/',
  'https://ccpun.com/tools/',
  'https://ccpun.com/play/money-story/',
  'https://ccpun.com/privacy/',
];
assert.deepEqual(extractLocations(core.text), approvedCore, 'only the five approved static canonicals belong in Core Sitemap');
for (const target of approvedCore) {
  const pathname = new URL(target).pathname;
  const page = await request(pathname);
  assertStatus(page.response.status, 200, pathname);
  assert.ok(page.text.includes(`href="${target}"`), `${pathname} must use its own canonical URL`);
  assert.ok(!/<meta[^>]+name="robots"[^>]+content="noindex/.test(page.text), `${pathname} must be indexable`);
}


const tools = await request('/sitemaps/tools.xml');
assertStatus(tools.response.status, 200, '/sitemaps/tools.xml');
assert.ok(!tools.text.includes('<lastmod>'), 'tools sitemap must omit unverifiable hard-coded lastmod values');

const blog = await request('/sitemaps/blog.xml');
assertStatus(blog.response.status, 200, '/sitemaps/blog.xml');
const entries = extractUrlEntries(blog.text);
assert.ok(entries.length > 0, 'blog sitemap must contain at least the blog root');
assert.ok(entries.some((entry) => entry.loc === 'https://ccpun.com/blog/'), 'blog sitemap must contain the blog root');
assert.equal(new Set(entries.map((entry) => entry.loc)).size, entries.length, 'blog sitemap must not contain duplicate URLs');

for (const entry of entries) {
  const url = new URL(entry.loc);
  assert.equal(url.protocol, 'https:', `${entry.loc} must use HTTPS`);
  assert.equal(url.hostname, 'ccpun.com', `${entry.loc} must use the canonical host`);
  assert.equal(url.search, '', `${entry.loc} must not contain a query string`);
  assert.equal(url.hash, '', `${entry.loc} must not contain a fragment`);
  if (entry.lastmod) {
    const timestamp = Date.parse(entry.lastmod);
    assert.ok(Number.isFinite(timestamp), `${entry.loc} has invalid lastmod ${entry.lastmod}`);
    assert.ok(timestamp <= Date.now() + 300_000, `${entry.loc} has a future lastmod ${entry.lastmod}`);
  }
}

const articleEntries = entries.filter(({ loc }) => new URL(loc).pathname.split('/').filter(Boolean).length === 3);
assert.ok(articleEntries.length > 0, 'blog sitemap must contain published article URLs');
for (const entry of articleEntries) {
  assert.ok(entry.lastmod, `${entry.loc} must have a meaningful lastmod`);
  const canonicalUrl = new URL(entry.loc);
  const page = await request(canonicalUrl.pathname);
  assertStatus(page.response.status, 200, canonicalUrl.pathname);
  assert.ok(page.text.includes(`href="${entry.loc}"`), `${canonicalUrl.pathname} missing self canonical`);
  const schemaModified = page.text.match(/"dateModified":"([^"]+)"/)?.[1];
  assert.ok(schemaModified, `${canonicalUrl.pathname} missing dateModified in Article schema`);
  assert.equal(
    Date.parse(schemaModified),
    Date.parse(entry.lastmod),
    `${canonicalUrl.pathname} sitemap lastmod and Article schema dateModified must match`,
  );
}

assert.deepEqual(extractLocations(root.text).sort(), [
  'https://ccpun.com/sitemaps/blog.xml',
  'https://ccpun.com/sitemaps/core.xml',
  'https://ccpun.com/sitemaps/tools.xml',
]);

console.log('PASS: Google sitemap HTTP regression');
