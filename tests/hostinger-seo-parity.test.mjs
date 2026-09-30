import test from 'node:test';
import assert from 'node:assert/strict';
import { blockedRobotsErrors, parseRobots, robotsAllowed, runParity, trace } from '../scripts/hostinger-seo-parity.mjs';

const source = 'https://source.test', target = 'https://target.test';
const protectedHeader = 'noindex, nofollow, noarchive';

function fixture(defect = '', mode = 'candidate') {
  return async (url, options) => {
    const parsed = new URL(url), path = parsed.pathname, candidate = parsed.origin === target;
    const headers = { 'content-type': 'text/html', 'content-security-policy': "default-src 'self'; object-src 'none'" };
    if (candidate && mode !== 'production') headers['x-robots-tag'] = protectedHeader;
    const broken = candidate && defect;
    if (broken === 'timeout' && path === '/privacy/') {
      return new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('timeout failed to abort')), 100); options.signal.addEventListener('abort', () => { clearTimeout(timer); reject(options.signal.reason); }, { once: true }); });
    }
    if (path === '/robots.txt') {
      headers['content-type'] = 'text/plain';
      const body = candidate && mode !== 'production' ? 'User-agent: *\nDisallow: /\n' : 'User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: https://ccpun.com/sitemap.xml\n';
      if (broken === 'robots-groups') return new Response('User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nAllow: /\n', { headers });
      return new Response(body, { headers });
    }
    if (path.endsWith('.xml')) {
      headers['content-type'] = 'application/xml';
      if (broken === 'xml') return new Response('<urlset><url></urlset>', { headers });
      const child = '<loc>https://ccpun.com/sitemaps/core.xml</loc>';
      const leaf = broken === 'manifest-host' ? 'https://ccpun.com.evil.test/' : 'https://ccpun.com/';
      const body = path === '/sitemap.xml' ? `<sitemapindex><sitemap>${child}</sitemap></sitemapindex>` : `<urlset><url><loc>${leaf}</loc></url></urlset>`;
      if (broken === 'xml-header') delete headers['x-robots-tag'];
      return new Response(body, { headers });
    }
    if (['/llms.txt', '/.well-known/security.txt'].includes(path)) { headers['content-type'] = 'text/plain'; return new Response('public text', { headers }); }
    if (path === '/assets/test.css') { headers['content-type'] = 'text/css'; return new Response('@font-face{src:url("/fonts/test.woff2")}', { headers }); }
    if (path === '/fonts/test.woff2') { headers['content-type'] = 'font/woff2'; return new Response('font-bytes', { status: broken === 'font' ? 404 : 200, headers }); }
    if (path.includes('/_next/image') || /\.png$|\.ico$/.test(path)) {
      headers['content-type'] = broken === 'image-mime' ? 'text/html' : 'image/png';
      return new Response('image-bytes', { status: broken === 'image' ? 400 : 200, headers });
    }
    const legacy = [['/living-benefits', '/ci-planning/'], ['/tools/fhc', '/tools/financial-health-check/'], ['/financial-advisor', '/']].find(([prefix]) => path.startsWith(prefix));
    if (legacy || (path !== '/' && !path.endsWith('/'))) {
      const destination = legacy?.[1] || `${path}/`;
      headers.location = broken === 'host-escape' && path === '/blog' ? source + '/blog/' : broken === 'redirect' && path === '/blog' ? '/privacy/' : destination;
      if (broken === 'redirect-header') delete headers['x-robots-tag'];
      return new Response(null, { status: 308, headers });
    }
    const missing = path.includes('__ccpun_migration_missing__');
    let status = missing ? 404 : 200;
    if (broken === 'soft-404' && missing) status = 200;
    let html = `<html><head><title>Page ${path}</title>${missing ? '' : `<link rel="canonical" href="https://ccpun.com${path}">`}<meta name="robots" content="${candidate && mode !== 'production' ? 'noindex, nofollow' : 'index, follow'}"><link rel="stylesheet" href="/assets/test.css"></head><body><main><h1>Page ${path}</h1><p>Published text</p><img src="/_next/image?url=%2Fassets%2Ftest.png&w=640&q=75"></main><script type="application/ld+json">{"@type":"WebPage","@id":"https://ccpun.com${path}","author":{"name":"CCPun"}}</script></body></html>`;
    if (broken === 'schema') html = html.replace('"name":"CCPun"', '"name":"Wrong author"');
    if (broken === 'json') html = html.replace('"@type":"WebPage"', '"@type":');
    if (broken === 'canonical') html = html.replace('</head>', '<link rel="canonical" href="https://ccpun.com/wrong/"></head>');
    if (broken === 'title') html = html.replace(/<title>.*?<\/title>/, '<title></title>');
    if (broken === 'h1') html = html.replace(/<h1>.*?<\/h1>/, '<h1></h1>');
    if (broken === 'meta') html = html.replace('</head>', '<meta name="robots" content="index, follow"></head>');
    if (broken === 'body') html = html.replace('Published text', 'Changed published content');
    if (broken === 'challenge') html = html.replace(/<title>.*?<\/title>/, '<title>Just a moment...</title>');
    if (broken === 'csp') headers['content-security-policy'] = 'upgrade-insecure-requests';
    if (broken === 'html-header') delete headers['x-robots-tag'];
    if (broken === 'production-noindex') headers['x-robots-tag'] = protectedHeader;
    return new Response(html, { status, headers });
  };
}

test('robots group selection, merging, allow tie, wildcard/end anchors and percent encoding', () => {
  const wrong = 'User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nAllow: /';
  assert.ok(blockedRobotsErrors(wrong).length);
  assert.equal(robotsAllowed(parseRobots(wrong), 'OAI-SearchBot/1.0', '/api/'), true);
  assert.equal(robotsAllowed(parseRobots(wrong), 'Googlebot/2.1', '/'), false);
  assert.deepEqual(blockedRobotsErrors('User-agent: *\nDisallow: /'), []);
  const body = 'User-agent: *\nDisallow: /\n\nUser-agent: OAI-SearchBot\nDisallow: /private/\nAllow: /private/public/\nDisallow: /same\nAllow: /same\nDisallow: /*.pdf$\nDisallow: /a%62\nDisallow: /encoded%2F\n\nUser-agent: oai-searchbot\nDisallow: /second/';
  const robots = parseRobots(body);
  for (const [path, allowed] of [['/', true], ['/private/secret', false], ['/private/public/a', true], ['/same', true], ['/file.pdf', false], ['/file.pdf?x=1', true], ['/ab', false], ['/encoded%2f/a', false], ['/encoded/a', true], ['/second/a', false], ['/robots.txt', true]]) assert.equal(robotsAllowed(robots, 'OAI-SearchBot/1.0', path), allowed, path);
});

test('candidate checker positive control and focused negative release fixtures', async (t) => {
  const positive = await runParity({ source, target, targetMode: 'candidate', fetcher: fixture() });
  assert.deepEqual(positive.failures, []);
  assert.equal(positive.status, 'parity-ok');
  assert.equal(positive.actualCrawlerNetworkVerified, false);
  assert.equal(positive.sitemapUrls.target, 1);
  for (const [defect, failure] of [
    ['robots-groups', 'robots:'], ['redirect', ':redirect-chain'], ['host-escape', ':request'],
    ['schema', ':schema'], ['json', ':challenge-or-invalid-schema'], ['xml', ':xml'],
    ['manifest-host', ':canonical-host'], ['canonical', ':canonical'], ['title', ':html-shape'], ['h1', ':html-shape'],
    ['meta', ':meta-robots-conflict'], ['html-header', ':blocked-x-robots-tag'], ['xml-header', ':blocked-x-robots-tag'],
    ['redirect-header', ':blocked-x-robots-tag'], ['timeout', ':request'], ['soft-404', ':soft-404'],
    ['image', ':asset'], ['image-mime', ':image-mime'], ['font', ':css-asset'], ['body', ':text'],
    ['challenge', ':challenge-or-invalid-schema'], ['csp', ':csp-policy-lost'],
  ]) await t.test(defect, async () => {
    const result = await runParity({ source, target, targetMode: 'candidate', timeoutMs: 5, fetcher: fixture(defect) });
    assert.equal(result.status, 'blocked');
    assert.ok(result.failures.some((item) => item.name.includes(failure)), `${defect}: missing expected failure ${failure}`);
    assert.ok(result.observations.length, 'failure must retain structured observations');
  });
});

test('production boundary requires robots and noindex parity', async () => {
  assert.equal((await runParity({ source, target, targetMode: 'production', fetcher: fixture('', 'production') })).status, 'parity-ok');
  const rejected = await runParity({ source, target, targetMode: 'production', fetcher: fixture('production-noindex', 'production') });
  assert.equal(rejected.status, 'blocked');
  assert.ok(rejected.failures.some((item) => item.name.includes('production-indexability')));
});

test('shadow allows UAT content values to differ but candidate rejects that difference', async () => {
  const shadow = await runParity({ source, target, targetMode: 'shadow', fetcher: fixture('schema') });
  assert.equal(shadow.status, 'parity-ok');
  assert.equal(shadow.blockedTarget, true); assert.equal(shadow.fullContentParity, false);
  assert.equal((await runParity({ source, target, targetMode: 'candidate', fetcher: fixture('schema') })).status, 'blocked');
});

test('cross-host redirect is never followed and network errors stay structured', async () => {
  let calls = 0;
  const escaped = await trace(target + '/', { fetcher: async () => { calls++; return new Response(null, { status: 308, headers: { location: source + '/' } }); } });
  assert.equal(escaped.error, 'redirect-host-escape'); assert.equal(calls, 1);
  const network = await trace(target + '/', { fetcher: async () => { throw new TypeError('unreachable'); } });
  assert.match(network.error, /unreachable/); assert.deepEqual(network.chain, []);
});
