#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';

const CANONICAL_ORIGIN = 'https://ccpun.com';
const AI_BOTS = ['OAI-SearchBot/1.0', 'Claude-SearchBot/1.0', 'PerplexityBot/1.0'];
const BLOCKED_DIRECTIVES = ['noindex', 'nofollow', 'noarchive'];
const STATIC_PATHS = ['/', '/blog/', '/ci-planning/', '/tools/financial-health-check/', '/privacy/', '/cookie-policy/'];
const CONTENT_PATHS = ['/blog/personal-finance/financial-pyramid/', '/blog/health-insurance/aia-health-happy-describe/'];
const NOT_FOUND_PATHS = ['/__ccpun_migration_missing__/', '/blog/personal-finance/__ccpun_migration_missing__/'];
const LEGACY_PATHS = ['/living-benefits/', '/living-benefits/nested/', '/tools/fhc/', '/tools/fhc/nested/', '/financial-advisor/', '/financial-advisor/nested/'];
const PRIVATE_PATHS = ['/api/', '/login/', '/dashboard/', '/snt-admin/', '/studio/'];
const clean = (value = '') => value.replace(/\s+/g, ' ').trim();
const stable = (value) => Array.isArray(value) ? value.map(stable)
  : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort().map(([key, item]) => [key, stable(item)])) : value;
const equal = (a, b) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));
const directives = (value = '') => value.toLowerCase().split(',').map((item) => item.trim()).filter(Boolean);
function schemaTypes(value, types = new Set()) {
  if (value && typeof value === 'object') {
    if (value['@type']) for (const type of [value['@type']].flat()) types.add(type);
    for (const item of Object.values(value)) schemaTypes(item, types);
  }
  return [...types].sort();
}

export function parseRobots(body) {
  const groups = [], sitemaps = []; let group;
  for (const line of body.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const match = line.replace(/#.*/, '').trim().match(/^([^:]+):\s*(.*)$/);
    if (!match) continue;
    const key = match[1].trim().toLowerCase(), value = match[2].trim();
    if (key === 'sitemap') sitemaps.push(value);
    if (key === 'user-agent' && value) {
      if (!group || group.hasRules) { group = { agents: [], rules: [], hasRules: false }; groups.push(group); }
      group.agents.push(value.toLowerCase());
    } else if (group && ['allow', 'disallow'].includes(key)) {
      group.hasRules = true;
      if (value.startsWith('/')) group.rules.push({ kind: key, path: value });
    }
  }
  return { groups: groups.map(({ agents, rules }) => ({ agents, rules })), sitemaps: sitemaps.sort() };
}

function applicableRules(robots, userAgent) {
  const product = userAgent.split('/')[0].toLowerCase();
  const matches = robots.groups.filter((group) => group.agents.includes(product));
  return (matches.length ? matches : robots.groups.filter((group) => group.agents.includes('*'))).flatMap((group) => group.rules);
}

function normalizeOctets(value) {
  return value.replace(/[^\x00-\x7F]/gu, (char) => encodeURIComponent(char))
    .replace(/%[0-9a-f]{2}/gi, (encoded) => /^[A-Za-z0-9._~-]$/.test(String.fromCharCode(parseInt(encoded.slice(1), 16)))
      ? String.fromCharCode(parseInt(encoded.slice(1), 16)) : encoded.toUpperCase());
}

export function robotsAllowed(robots, userAgent, path) {
  if (path.split('?')[0] === '/robots.txt') return true; // RFC 9309: robots itself is implicitly allowed.
  const normalized = normalizeOctets(path);
  const rules = applicableRules(robots, userAgent).filter((rule) => {
    const pattern = normalizeOctets(rule.path).replace(/[.+?^{}()|[\]\\]/g, '\\$&').replaceAll('*', '.*');
    return new RegExp(`^${pattern.replace(/\$(?!$)/g, '\\$')}`).test(normalized);
  }).sort((a, b) => normalizeOctets(b.path).replaceAll('*', '').replace(/\$$/, '').length
    - normalizeOctets(a.path).replaceAll('*', '').replace(/\$$/, '').length || (a.kind === 'allow' ? -1 : 1));
  return !rules.length || rules[0].kind === 'allow';
}

export function blockedRobotsErrors(body, paths = ['/']) {
  const robots = parseRobots(body), errors = [];
  if (robots.sitemaps.length) errors.push('blocked target advertises sitemap');
  for (const ua of ['CCPun-Migration-Parity/1.0', ...AI_BOTS, ...robots.groups.flatMap((group) => group.agents).filter((agent) => agent !== '*')]) {
    const rules = applicableRules(robots, ua);
    if (!rules.some((rule) => rule.kind === 'disallow' && ['/', '/*'].includes(rule.path)) || rules.some((rule) => rule.kind === 'allow')) errors.push(`${ua}: selected group does not deny all paths`);
    for (const path of paths) if (path !== '/robots.txt' && robotsAllowed(robots, ua, path)) errors.push(`${ua}: allows ${path}`);
  }
  return [...new Set(errors)];
}

export function htmlFingerprint(body) {
  const window = new JSDOM(body).window, document = window.document;
  const schema = [...document.querySelectorAll('script[type="application/ld+json"]')].map((script) => {
    try { return stable(JSON.parse(script.textContent)); } catch { return '__INVALID_JSON_LD__'; }
  });
  const fingerprint = {
    title: clean(document.title),
    canonicals: [...document.querySelectorAll('link[rel~="canonical"]')].map((node) => node.getAttribute('href')),
    robots: [...document.querySelectorAll('meta[name="robots"],meta[name="googlebot"]')].map((node) => ({ name: node.name.toLowerCase(), content: node.content })),
    h1: [...document.querySelectorAll('h1')].map((node) => clean(node.textContent)), schema,
    placeholder: /Hostinger Website Builder|Your website is ready|Welcome to nginx|Checking your browser|Just a moment\.\.\./i.test(document.title + ' ' + document.body?.textContent.slice(0, 1000)),
    assets: [...document.querySelectorAll('script[src],link[rel="stylesheet"][href],link[rel~="icon"][href],link[rel="preload"][href],img[src]')].map((node) => node.getAttribute('src') || node.getAttribute('href')),
  };
  document.querySelectorAll('script,style,noscript').forEach((node) => node.remove());
  fingerprint.text = clean((document.querySelector('main') || document.body)?.textContent || '');
  window.close(); return fingerprint;
}

export function parseSitemap(body) {
  const window = new JSDOM('').window, document = new window.DOMParser().parseFromString(body, 'application/xml');
  const kind = document.documentElement.localName;
  if (document.querySelector('parsererror') || !['sitemapindex', 'urlset'].includes(kind)) { window.close(); throw new Error('malformed sitemap XML'); }
  const locations = [...document.querySelectorAll(kind === 'sitemapindex' ? 'sitemap > loc' : 'url > loc')].map((node) => node.textContent.trim());
  if (kind === 'sitemapindex' && !locations.length) { window.close(); throw new Error('empty sitemap index'); }
  if (new Set(locations).size !== locations.length) { window.close(); throw new Error('duplicate sitemap URL'); }
  window.close(); return { kind, locations: locations.sort() };
}

export async function trace(url, { fetcher = fetch, timeoutMs = 20000, userAgent = 'CCPun-Migration-Parity/2.0', allowedOrigins = [new URL(url).origin] } = {}) {
  const chain = []; let current = url;
  try {
    for (let index = 0; index < 8; index++) {
      const response = await fetcher(current, { redirect: 'manual', signal: AbortSignal.timeout(timeoutMs), headers: { 'user-agent': userAgent, accept: '*/*' } });
      const headers = Object.fromEntries(['content-type', 'x-robots-tag', 'content-security-policy', 'cache-control'].map((key) => [key, response.headers.get(key) || '']));
      const location = response.headers.get('location'); chain.push({ url: current, status: response.status, location, headers });
      if (response.status >= 300 && response.status < 400 && location) {
        await response.body?.cancel(); const next = new URL(location, current);
        if (!allowedOrigins.includes(next.origin)) return { chain, error: 'redirect-host-escape', escapedUrl: next.href };
        current = next.href; continue;
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      return { chain, finalUrl: current, status: response.status, headers, bytes: bytes.length, body: /text|xml|json|javascript/i.test(headers['content-type']) ? new TextDecoder().decode(bytes) : '' };
    }
    return { chain, error: 'redirect-hop-limit' };
  } catch (error) { return { chain, error: `${error.name}: ${error.message}` }; }
}

async function pool(items, action) {
  let index = 0;
  // ponytail: four concurrent public GETs; this is a parity crawl, not a load test.
  await Promise.all(Array.from({ length: 4 }, async () => { while (index < items.length) await action(items[index++]); }));
}

export async function runParity({ source, target, targetMode = 'shadow', timeoutMs = 20000, fetcher = fetch }) {
  for (const base of [source, target]) if (!['http:', 'https:'].includes(new URL(base).protocol) || new URL(base).username || new URL(base).password) throw new Error('base URL must be HTTP(S) without credentials');
  if (!['shadow', 'candidate', 'production'].includes(targetMode) || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120000) throw new Error('invalid mode or timeout');
  const blockedTarget = targetMode !== 'production', fullContentParity = targetMode !== 'shadow';
  const failures = [], observations = [], cache = new Map(), sourceOrigin = new URL(source).origin, targetOrigin = new URL(target).origin;
  const fail = (name, details = {}) => failures.push({ ...details, name });
  const compare = (name, a, b) => { if (!equal(a, b)) fail(name, { source: a, target: b }); };
  const publicResult = ({ body, ...result }) => result;
  async function request(base, path, ua) {
    const url = new URL(path, base).href, key = `${url}|${ua || ''}`;
    if (!cache.has(key)) cache.set(key, trace(url, { fetcher, timeoutMs, ...(ua ? { userAgent: ua } : {}) }));
    const result = await cache.get(key);
    if (result.error) fail(`${url}:request`, publicResult(result));
    if (base === target && blockedTarget) for (const hop of result.chain) {
      const missing = BLOCKED_DIRECTIVES.filter((directive) => !directives(hop.headers['x-robots-tag']).includes(directive));
      if (missing.length) fail(`${hop.url}:blocked-x-robots-tag`, { status: hop.status, missing });
    }
    return result;
  }
  function chainFingerprint(result, origin) {
    return result.chain.map((hop) => ({ status: hop.status, location: hop.location ? new URL(hop.location, hop.url).href.replace(origin, '{origin}') : null }));
  }
  async function manifest(base) {
    const queue = ['/sitemap.xml'], maps = [], pages = new Set(), seen = new Set();
    while (queue.length) {
      const path = queue.shift(); if (seen.has(path)) continue; seen.add(path);
      if (seen.size > 100) { fail(`${base}:sitemap-limit`, { limit: 100 }); break; }
      const result = await request(base, path);
      if (result.status !== 200) { fail(`${base}${path}:sitemap-status`, { status: result.status }); continue; }
      try {
        const parsed = parseSitemap(result.body); maps.push({ path, ...parsed, response: publicResult(result) });
        for (const location of parsed.locations) {
          const url = new URL(location);
          if (url.origin !== CANONICAL_ORIGIN || url.hash || url.search) { fail(`${base}${path}:canonical-host`, { location }); continue; }
          if (parsed.kind === 'sitemapindex') queue.push(url.pathname); else pages.add(url.pathname);
        }
      } catch (error) { fail(`${base}${path}:xml`, { error: error.message }); }
    }
    return { maps, paths: [...pages].sort() };
  }
  const [sourceManifest, targetManifest] = await Promise.all([manifest(source), manifest(target)]);
  for (const map of sourceManifest.maps) {
    const other = targetManifest.maps.find((item) => item.path === map.path);
    if (!other) fail(`${map.path}:missing-sitemap`);
    else if (fullContentParity || !map.path.includes('blog')) compare(`${map.path}:locs`, map.locations, other.locations);
  }
  if (fullContentParity) compare('sitemap:recursive-manifest', sourceManifest.paths, targetManifest.paths);
  else compare('sitemap:static-manifest', sourceManifest.paths.filter((path) => !path.startsWith('/blog/')), targetManifest.paths.filter((path) => !path.startsWith('/blog/')));
  const paths = [...new Set([...STATIC_PATHS, ...(fullContentParity ? [...CONTENT_PATHS, ...sourceManifest.paths, ...targetManifest.paths] : []), ...NOT_FOUND_PATHS])];
  const assets = { source: new Set(['/llms.txt', '/.well-known/security.txt', '/favicon.ico', '/favicon.png']), target: new Set(['/llms.txt', '/.well-known/security.txt', '/favicon.ico', '/favicon.png']) };
  function addAsset(lane, reference, pagePath) {
    if (!reference || /^(data:|blob:)/i.test(reference)) return;
    const base = lane === 'source' ? source : target, url = new URL(reference, new URL(pagePath, base));
    if (url.origin === new URL(base).origin) assets[lane].add(url.pathname + url.search);
    else if (lane === 'target' && url.origin === sourceOrigin && sourceOrigin !== targetOrigin) fail(`${pagePath}:production-asset-escape`, { url: url.href });
  }
  await pool(paths, async (path) => {
    const [a, b] = await Promise.all([request(source, path), request(target, path)]), sourceFp = htmlFingerprint(a.body || ''), targetFp = htmlFingerprint(b.body || '');
    compare(`${path}:status`, a.status, b.status); compare(`${path}:redirects`, chainFingerprint(a, sourceOrigin), chainFingerprint(b, targetOrigin));
    const expected404 = NOT_FOUND_PATHS.includes(path);
    if (expected404 && (a.status !== 404 || b.status !== 404)) fail(`${path}:soft-404`, { source: a.status, target: b.status });
    for (const [lane, result, fp] of [['source', a, sourceFp], ['target', b, targetFp]]) {
      if (!expected404 && (result.status !== 200 || !fp.title || fp.h1.length !== 1 || !fp.h1[0])) fail(`${lane}:${path}:html-shape`, { status: result.status, title: fp.title, h1: fp.h1 });
      if (!expected404 && (fp.canonicals.length !== 1 || fp.canonicals[0] !== CANONICAL_ORIGIN + path)) fail(`${lane}:${path}:canonical`, { values: fp.canonicals });
      if (fp.placeholder || fp.schema.includes('__INVALID_JSON_LD__')) fail(`${lane}:${path}:challenge-or-invalid-schema`);
      for (const name of ['robots', 'googlebot']) {
        const values = fp.robots.filter((meta) => meta.name === name).flatMap((meta) => directives(meta.content));
        if ((values.includes('index') && values.includes('noindex')) || (values.includes('follow') && values.includes('nofollow'))) fail(`${lane}:${path}:meta-robots-conflict`, { name, values });
      }
      fp.assets.forEach((reference) => addAsset(lane, reference, path));
    }
    for (const field of ['title', 'canonicals', 'h1', ...(fullContentParity ? ['schema', 'text'] : [])]) compare(`${path}:${field}`, sourceFp[field], targetFp[field]);
    if (!fullContentParity) compare(`${path}:schema-types`, schemaTypes(sourceFp.schema), schemaTypes(targetFp.schema));
    if (!blockedTarget) { compare(`${path}:robots`, sourceFp.robots, targetFp.robots); compare(`${path}:x-robots-tag`, a.headers?.['x-robots-tag'], b.headers?.['x-robots-tag']); }
    const sourceCsp = a.headers?.['content-security-policy'], targetCsp = b.headers?.['content-security-policy'];
    if (sourceCsp?.includes('default-src') && !targetCsp?.includes('default-src')) fail(`${path}:csp-policy-lost`, { source: sourceCsp, target: targetCsp });
    observations.push({ kind: 'html', path, source: publicResult(a), target: publicResult(b), canonical: targetFp.canonicals, title: targetFp.title, h1: targetFp.h1, schema: targetFp.schema });
  });
  const redirects = [...new Set([...paths.filter((path) => path !== '/' && !NOT_FOUND_PATHS.includes(path)).map((path) => path.replace(/\/$/, '')), ...LEGACY_PATHS])];
  await pool(redirects, async (path) => {
    const [a, b] = await Promise.all([request(source, path), request(target, path)]);
    compare(`${path}:redirect-chain`, chainFingerprint(a, sourceOrigin), chainFingerprint(b, targetOrigin));
    observations.push({ kind: 'redirect', path, source: publicResult(a), target: publicResult(b) });
  });
  for (const ua of ['CCPun-Migration-Parity/1.0', ...AI_BOTS]) {
    const [a, b] = await Promise.all([request(source, '/robots.txt', ua), request(target, '/robots.txt', ua)]);
    if (a.status !== 200 || b.status !== 200) fail(`robots:${ua}:status`, { source: a.status, target: b.status });
    const sourceRobots = parseRobots(a.body || ''), targetRobots = parseRobots(b.body || '');
    if (blockedTarget) for (const error of blockedRobotsErrors(b.body || '', [...paths, ...PRIVATE_PATHS])) fail(`robots:${ua}:blocked`, { error });
    else { compare(`robots:${ua}:groups`, sourceRobots, targetRobots); for (const path of [...paths, ...PRIVATE_PATHS]) compare(`robots:${ua}:${path}:effective`, robotsAllowed(sourceRobots, ua, path), robotsAllowed(targetRobots, ua, path)); }
    observations.push({ kind: 'robots', userAgent: ua, source: sourceRobots, target: targetRobots, sourceResponse: publicResult(a), targetResponse: publicResult(b) });
  }
  for (const ua of AI_BOTS) for (const path of fullContentParity ? ['/', CONTENT_PATHS[0]] : ['/', '/ci-planning/']) {
    const [a, b] = await Promise.all([request(source, path, ua), request(target, path, ua)]);
    if (a.status !== 200 || b.status !== 200) fail(`ai-crawler:${ua}:${path}:status`, { source: a.status, target: b.status });
    const sourceFp = htmlFingerprint(a.body || ''), targetFp = htmlFingerprint(b.body || '');
    for (const key of ['title', 'canonicals', 'h1', ...(fullContentParity ? ['schema'] : [])]) compare(`ai-crawler:${ua}:${path}:${key}`, sourceFp[key], targetFp[key]);
    if (!fullContentParity) compare(`ai-crawler:${ua}:${path}:schema-types`, schemaTypes(sourceFp.schema), schemaTypes(targetFp.schema));
    if (targetFp.placeholder || targetFp.schema.includes('__INVALID_JSON_LD__')) fail(`ai-crawler:${ua}:${path}:challenge-or-schema`);
    if (!blockedTarget && /noindex/i.test(b.headers?.['x-robots-tag'] || '')) fail(`ai-crawler:${ua}:${path}:production-indexability`);
    observations.push({ kind: 'simulated-ai-user-agent', userAgent: ua, path, source: publicResult(a), target: publicResult(b) });
  }
  // Every emitted local asset plus CSS font/image dependencies is fetched; JS bundles are not executed.
  for (const [lane, base] of [['source', source], ['target', target]]) {
    await pool([...assets[lane]], async (path) => {
      const result = await request(base, path), type = result.headers?.['content-type'] || '';
      if (result.status !== 200 || !result.bytes || /text\/html/i.test(type)) fail(`${lane}:${path}:asset`, { status: result.status, type, bytes: result.bytes });
      if (path.includes('/_next/image') && !type.startsWith('image/')) fail(`${lane}:${path}:image-mime`, { type });
      if (/\.css(?:\?|$)/.test(path)) for (const match of (result.body || '').matchAll(/url\(["']?([^\)"']+)/g)) addAsset(lane, match[1], path);
      observations.push({ kind: 'asset', lane, path, ...publicResult(result) });
    });
    const emitted = new Set(observations.filter((item) => item.kind === 'asset' && item.lane === lane).map((item) => item.path));
    await pool([...assets[lane]].filter((path) => !emitted.has(path)), async (path) => {
      const result = await request(base, path), type = result.headers?.['content-type'] || '';
      if (result.status !== 200 || !result.bytes || /text\/html/i.test(type)) fail(`${lane}:${path}:css-asset`, { status: result.status, type, bytes: result.bytes });
      observations.push({ kind: 'css-asset', lane, path, ...publicResult(result) });
    });
  }
  // Legacy WordPress ingress is a separate unchanged host, not a candidate-host redirect claim.
  const ledger = JSON.parse(readFileSync(new URL('../qa/legacy-url-ledger.json', import.meta.url), 'utf8'));
  for (const mapping of ledger.mappings.filter((item) => fullContentParity && item.state === 'live')) {
    const path = new URL(mapping.source).pathname;
    const [a, b] = await Promise.all([request(source, path), request(target, path)]);
    compare(`legacy-apex:${path}:chain`, chainFingerprint(a, sourceOrigin), chainFingerprint(b, targetOrigin));
    const destination = new URL(mapping.destination);
    if (destination.origin !== CANONICAL_ORIGIN) { fail(`legacy:${mapping.id}:destination-host`); continue; }
    const result = await request(target, destination.pathname);
    if (result.status !== mapping.destinationStatus) fail(`legacy:${mapping.id}:candidate-destination`, { status: result.status });
    observations.push({ kind: 'legacy-apex-and-destination', id: mapping.id, legacyIngress: mapping.source, expectedCanonical: mapping.destination, source: publicResult(a), target: publicResult(b), candidateDestination: publicResult(result) });
  }
  return { status: failures.length ? 'blocked' : 'parity-ok', source, target, targetMode, blockedTarget, fullContentParity, checkedPaths: paths.length, sitemapUrls: { source: sourceManifest.paths.length, target: targetManifest.paths.length }, manifests: { source: sourceManifest, target: targetManifest }, aiBots: AI_BOTS, actualCrawlerNetworkVerified: false, observations, failures };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; };
  try {
    const result = await runParity({ source: arg('--source'), target: arg('--target'), targetMode: arg('--target-mode') || 'shadow', timeoutMs: Number(arg('--timeout-ms') || 20000) });
    console.log(JSON.stringify(result, null, 2)); if (result.failures.length) process.exitCode = 1;
  } catch (error) { console.log(JSON.stringify({ status: 'blocked', failures: [{ name: 'checker-input-or-runtime', error: `${error.name}: ${error.message}` }] }, null, 2)); process.exitCode = 2; }
}
