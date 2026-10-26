// v5 click-journey regression (owner request 2026-10-26): every internal destination a rendered v5
// page links to must exist, render the v5 shell, resolve without a redirect hop and keep its #anchor.
// Read-only HTTP crawl of the server-rendered HTML (GET only, no cookies, no forms, no analytics).
//
// Usage: JOURNEY_ORIGIN=http://127.0.0.1:3000 node qa/v5-journey-link-regression.mjs
//   JOURNEY_EXTRA_PATHS="/tools/tax-deduction/,/tools/investment-allocation/"  extra seeds (UAT-only pages)
//   JOURNEY_MAX_PAGES=400                                                       crawl budget
import assert from 'node:assert/strict';

const ORIGIN = (process.env.JOURNEY_ORIGIN || 'http://127.0.0.1:3000').replace(/\/$/, '');
const SITE_ORIGINS = new Set([ORIGIN, 'https://ccpun.com', 'https://www.ccpun.com', 'https://test.ccpun.com']);
const MAX_PAGES = Number(process.env.JOURNEY_MAX_PAGES || 400);
const NOT_FOUND_PROBE = '/v5-journey-not-found-probe/';
const SEEDS = ['/', '/blog/', '/about/', '/ci-planning/', '/tools/', '/tools/financial-health-check/', '/play/money-story/', '/privacy/', '/cookie-policy/',
  ...String(process.env.JOURNEY_EXTRA_PATHS || '').split(',').map((path) => path.trim()).filter(Boolean)];
const SKIP = /^\/(?:api|_next|studio|snt-admin)(?:\/|$)/;

const decode = (value) => value.replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

/** Internal path (+ fragment) of an href on this site, or null for external/action links. */
function internalTarget(href, fromPath) {
  if (!href || /^(?:mailto:|tel:|javascript:|data:)/i.test(href)) return null;
  let url;
  try { url = new URL(href, ORIGIN + fromPath); } catch { return { invalid: href }; }
  if (!SITE_ORIGINS.has(url.origin)) return null;
  return { path: url.pathname, query: url.search, fragment: decodeURIComponent(url.hash.slice(1)) };
}

function parse(html) {
  // Only real attributes in the server HTML (the RSC payload uses JSON, not href="...").
  const tags = [...html.matchAll(/<a\b([^>]*)>/gi)].map((match) => match[1]);
  const links = tags.map((attributes) => ({
    href: decode((/\shref="([^"]*)"/i.exec(attributes) || [])[1] ?? ''),
    target: (/\starget="([^"]*)"/i.exec(attributes) || [])[1] ?? '',
    rel: (/\srel="([^"]*)"/i.exec(attributes) || [])[1] ?? '',
  })).filter((link) => link.href);
  const ids = new Set([...html.matchAll(/\s(?:id|name)="([^"]+)"/gi)].map((match) => decode(match[1])));
  const robots = [...html.matchAll(/<meta[^>]+name="robots"[^>]+content="([^"]+)"/gi)].map((match) => match[1].toLowerCase()).join(',');
  return { links, ids, robots, v5: html.includes('data-v5-chat-layer') && /<main[^>]+id="main-content"/.test(html) };
}

async function get(path) {
  const response = await fetch(ORIGIN + path, { redirect: 'manual', headers: { 'user-agent': 'ccpun-v5-journey-regression' } });
  const location = response.headers.get('location');
  const html = response.status === 200 && (response.headers.get('content-type') || '').includes('text/html') ? await response.text() : '';
  return { status: response.status, location: location ? new URL(location, ORIGIN + path) : null, html };
}

const pages = new Map(); // path -> { status, parsed, redirect }
const failures = [];
const edges = []; // { from, href, target }

async function visit(path) {
  if (pages.has(path)) return pages.get(path);
  const first = await get(path);
  const entry = { status: first.status, parsed: first.html ? parse(first.html) : null, hops: [] };
  // Follow redirects only to describe the chain (links must never need one).
  let current = first;
  let currentPath = path;
  while (current.status >= 300 && current.status < 400 && current.location && entry.hops.length < 5) {
    entry.hops.push(`${current.status} ${currentPath} -> ${current.location.pathname}`);
    if (!SITE_ORIGINS.has(current.location.origin)) break;
    currentPath = current.location.pathname;
    current = await get(currentPath);
    entry.finalStatus = current.status;
  }
  pages.set(path, entry);
  return entry;
}

const queue = [...SEEDS];
while (queue.length && pages.size < MAX_PAGES) {
  const path = queue.shift();
  if (pages.has(path)) continue;
  const entry = await visit(path);
  if (!entry.parsed) continue;
  for (const link of entry.parsed.links) {
    const target = internalTarget(link.href, path);
    if (!target) {
      if (/^https?:/i.test(link.href) && link.target === '_blank' && !/noopener|noreferrer/.test(link.rel)) failures.push(`${path}: external ${link.href} opens a new tab without rel=noopener`);
      if (/^http:\/\//i.test(link.href)) failures.push(`${path}: insecure external link ${link.href}`);
      continue;
    }
    if (target.invalid) { failures.push(`${path}: unparseable href ${target.invalid}`); continue; }
    if (SKIP.test(target.path)) continue;
    edges.push({ from: path, href: link.href, target });
    if (!pages.has(target.path) && !queue.includes(target.path)) queue.push(target.path);
  }
}

for (const { from, href, target } of edges) {
  const entry = pages.get(target.path) ?? await visit(target.path);
  if (entry.hops.length) failures.push(`${from}: "${href}" redirects (${entry.hops.join(' | ')}); link the final URL${entry.hops.length > 1 ? ' (redirect chain)' : ''}`);
  else if (entry.status !== 200) failures.push(`${from}: "${href}" returns HTTP ${entry.status}`);
  else if (!entry.parsed?.v5) failures.push(`${from}: "${href}" does not render the v5 page frame`);
  else if (target.fragment && !entry.parsed.ids.has(target.fragment)) failures.push(`${from}: "${href}" anchor #${target.fragment} is missing on ${target.path}`);
}

for (const [path, entry] of pages) {
  if (entry.status === 200 && entry.parsed && !entry.parsed.v5) failures.push(`${path}: page does not render the v5 page frame`);
}

// The real 404 is v5-styled, noindex and offers a way back.
const notFound = await get(NOT_FOUND_PROBE);
assert.equal(notFound.status, 404, `${NOT_FOUND_PROBE} must be a 404`);
const notFoundPage = parse(await (await fetch(ORIGIN + NOT_FOUND_PROBE)).text());
assert.ok(notFoundPage.v5, '404 renders the v5 page frame');
assert.match(notFoundPage.robots, /noindex/, '404 is noindex');
for (const back of ['/', '/blog/']) assert.ok(notFoundPage.links.some((link) => link.href === back), `404 links back to ${back}`);

// Planned (Coming Soon) pages stay noindex,follow and open the chat from "อยากให้เสร็จเร็ว".
for (const path of [...pages.keys()].filter((candidate) => candidate.startsWith('/tools/') && pages.get(candidate).status === 200)) {
  const response = await fetch(ORIGIN + path);
  const html = await response.text();
  if (!html.includes('หน้านี้กำลังสร้างอยู่')) continue;
  const parsed = parse(html);
  assert.match(parsed.robots, /noindex/, `${path}: Coming Soon page is noindex`);
  assert.match(parsed.robots, /(?:^|,\s*)follow/, `${path}: Coming Soon page keeps follow`);
  const interest = /<a\b([^>]*)>อยากให้เสร็จเร็ว<\/a>/.exec(html);
  assert.ok(interest, `${path}: "อยากให้เสร็จเร็ว" is a link, not a button that only changes local text`);
  assert.match(interest[1], /\shref="https:\/\/line\.me\/R\/(?:oaMessage|ti\/p)\/%40ccpun\//, `${path}: its no-JS fallback opens the @ccpun chat`);
  assert.match(interest[1], /\sdata-v5-chat-link=""/, `${path}: with JavaScript it opens the page's chat panel`);
  assert.doesNotMatch(html, /ที่ปุ่มด้านล่าง/, `${path}: no text that sends visitors to look for another button`);
}

console.log(`v5 journey: ${pages.size} destinations, ${edges.length} internal links checked`);
if (failures.length) {
  console.error(failures.map((failure) => `  - ${failure}`).join('\n'));
  assert.fail(`${failures.length} journey dead end(s)`);
}
console.log('v5 journey: no 404, missing anchor, redirect hop or non-v5 destination');
