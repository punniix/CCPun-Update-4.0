import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  fetchValidatedImage,
  MAX_IMAGE_BYTES,
  parseApprovedImageUrl,
} from '../scripts/prepare-wordpress-published-migration.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temp = await mkdtemp(path.join(os.tmpdir(), 'ccpun-wp-migration-'));

const exporter = await readFile(path.join(root, 'scripts/export-wordpress-published.mjs'), 'utf8');
assert.match(exporter, /response\.redirected \|\| response\.url !== url/);

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
const imageUrl = 'https://blog.ccpun.com/wp-content/uploads/2026/08/test.png';
const response = (overrides = {}) => ({
  ok: true,
  status: 200,
  redirected: false,
  url: imageUrl,
  headers: new Headers({ 'content-type': 'image/png', 'content-length': String(png.length) }),
  body: new ReadableStream({ start(controller) { controller.enqueue(png); controller.close(); } }),
  ...overrides,
});

for (const unsafe of [
  'http://blog.ccpun.com/wp-content/uploads/test.png',
  'https://user:pass@blog.ccpun.com/wp-content/uploads/test.png',
  'https://blog.ccpun.com:443/wp-content/uploads/test.png',
  'https://evil.example/wp-content/uploads/test.png',
  'https://blog.ccpun.com/not-uploads/test.png',
  'https://blog.ccpun.com/wp-content/uploads/test.svg',
]) assert.throws(() => parseApprovedImageUrl(unsafe), /approved WordPress uploads origin/);

let requestOptions;
const validImage = await fetchValidatedImage(imageUrl, async (_url, options) => {
  requestOptions = options;
  return response();
});
assert.equal(validImage.metadata.width, 1);
assert.equal(requestOptions.redirect, 'manual');
assert.ok(requestOptions.signal instanceof AbortSignal);
await assert.rejects(() => fetchValidatedImage(imageUrl, async () => response({ status: 302, ok: false })), /redirected migration image/);
await assert.rejects(() => fetchValidatedImage(imageUrl, async () => response({ headers: new Headers({ 'content-type': 'text/html' }) })), /content type/);
await assert.rejects(() => fetchValidatedImage(imageUrl, async () => response({ headers: new Headers({ 'content-type': 'image/png', 'content-length': String(MAX_IMAGE_BYTES + 1) }) })), /maximum size/);
await assert.rejects(() => fetchValidatedImage(imageUrl, async () => response({
  headers: new Headers({ 'content-type': 'image/png' }),
  body: new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(MAX_IMAGE_BYTES + 1)); controller.close(); } }),
})), /maximum size/);
await assert.rejects(() => fetchValidatedImage(imageUrl, async () => response({
  headers: new Headers({ 'content-type': 'image/png' }),
  body: new ReadableStream({ start(controller) { controller.enqueue(Buffer.from('not an image')); controller.close(); } }),
})), /Input buffer/);

try {
  const input = path.join(temp, 'input.json');
  const output = path.join(temp, 'output.json');
  const ndjson = path.join(temp, 'output.ndjson');
  const posts = [
    ['413', 'aia-vitality', 'ประกันชีวิต'],
    ['359', 'aia-health-ci-hero-guide', 'ประกันสุขภาพและโรคร้ายแรง'],
    ['233', 'critical-illness-insurance', 'ประกันสุขภาพและโรคร้ายแรง'],
    ['196', 'aia-health-happy-describe', 'ประกันสุขภาพและโรคร้ายแรง'],
    ['95', 'financial-pyramid', 'การเงินส่วนบุคคล'],
  ].map(([wpId, slug, category], index) => ({
    wpId: Number(wpId),
    slug,
    category,
    title: slug,
    excerpt: slug,
    sourceUrl: `https://blog.ccpun.com/${slug}/`,
    canonical: `https://blog.ccpun.com/${slug}/`,
    publishedAt: '2026-08-01T00:00:00.000Z',
    modifiedAt: '2026-08-01T00:00:00.000Z',
    tags: [],
    bodyImages: [],
    contentTextLength: 1,
    contentHtml: index === 0 ? [
      '<p>',
      '<a href="https://blog.ccpun.com/critical-illness-insurance/?utm=wp#compare">known</a>',
      '<a href="https://blog.ccpun.com/not-migrated/?x=1#keep">unknown</a>',
      '<a href="https://example.com/path?x=1#keep">external</a>',
      '<a href="javascript:alert(1)">unsafe-script</a>',
      '<a href="data:text/html,bad">unsafe-data</a>',
      '<a href="https://user:pass@example.com/private">unsafe-credentials</a>',
      '</p>',
    ].join('') : `<p>${slug}</p>`,
  }));
  await writeFile(input, JSON.stringify({
    source: 'https://blog.ccpun.com',
    status: 'published',
    count: 5,
    posts,
  }));

  const result = spawnSync(process.execPath, [
    path.join(root, 'scripts/prepare-wordpress-published-migration.mjs'),
    input,
    output,
    ndjson,
  ], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const prepared = JSON.parse(await readFile(output, 'utf8'));
  assert.deepEqual(prepared.mappings.map(({ slug, newUrl }) => [slug, newUrl]), [
    ['aia-vitality', 'https://ccpun.com/blog/life-insurance/aia-vitality/'],
    ['aia-health-ci-hero-guide', 'https://ccpun.com/blog/health-insurance/aia-health-ci-hero-guide/'],
    ['critical-illness-insurance', 'https://ccpun.com/blog/critical-illness-insurance/what-is-critical-illness-insurance/'],
    ['aia-health-happy-describe', 'https://ccpun.com/blog/health-insurance/aia-health-happy-describe/'],
    ['financial-pyramid', 'https://ccpun.com/blog/personal-finance/financial-pyramid/'],
  ]);
  const expectedCategoryRefs = new Map([
    ['aia-vitality', 'ccpun-category-life-insurance'],
    ['aia-health-ci-hero-guide', 'ccpun-wp-category-127'],
    ['critical-illness-insurance', 'ccpun-category-critical-illness'],
    ['aia-health-happy-describe', 'ccpun-wp-category-127'],
    ['financial-pyramid', 'ccpun-category-personal-finance'],
  ]);
  for (const article of prepared.documents.filter((document) => document._type === 'article')) {
    assert.equal(article.category._ref, expectedCategoryRefs.get(article.slug.current));
    assert.equal(article.author._ref, 'ccpun-prod-mirror-author-ccpun');
  }
  const vitality = prepared.documents.find((document) => document.slug?.current === 'aia-vitality');
  const hrefs = vitality.body.flatMap((block) => block.markDefs || []).map((mark) => mark.href);
  assert.deepEqual(hrefs, [
    'https://ccpun.com/blog/critical-illness-insurance/what-is-critical-illness-insurance/?utm=wp#compare',
    'https://blog.ccpun.com/not-migrated/?x=1#keep',
    'https://example.com/path?x=1#keep',
  ]);
  assert.match(vitality.body.flatMap((block) => block.children || []).map((child) => child.text).join(''), /unsafe-scriptunsafe-dataunsafe-credentials/);

  const invalidInput = path.join(temp, 'invalid-input.json');
  await writeFile(invalidInput, JSON.stringify({
    source: 'https://blog.ccpun.com',
    status: 'published',
    count: 5,
    posts: [{ ...posts[0], wpId: 999 }, ...posts.slice(1)],
  }));
  const rejected = spawnSync(process.execPath, [
    path.join(root, 'scripts/prepare-wordpress-published-migration.mjs'),
    invalidInput,
    output,
    ndjson,
  ], { cwd: root, encoding: 'utf8' });
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.stderr, /published WordPress inventory mismatch/);

  await writeFile(invalidInput, JSON.stringify({
    source: 'https://blog.ccpun.com',
    status: 'published',
    count: 5,
    posts: [...posts, posts[0]],
  }));
  const duplicate = spawnSync(process.execPath, [
    path.join(root, 'scripts/prepare-wordpress-published-migration.mjs'),
    invalidInput,
    output,
    ndjson,
  ], { cwd: root, encoding: 'utf8' });
  assert.notEqual(duplicate.status, 0);
  assert.match(duplicate.stderr, /published WordPress inventory mismatch/);
} finally {
  await rm(temp, { recursive: true, force: true });
}

console.log('wordpress published migration link parity: PASS');
