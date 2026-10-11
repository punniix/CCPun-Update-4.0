import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import sharp from 'sharp';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url));

test('canonical portrait is genuine WebP with the current About photo pixels and dimensions', async () => {
  const source = read('public/assets/website-43/about-pun.png');
  const canonical = read('public/assets/ccpun.webp');
  assert.equal(canonical.subarray(0, 4).toString(), 'RIFF');
  assert.equal(canonical.subarray(8, 12).toString(), 'WEBP');
  assert.equal(canonical.readUInt32LE(4) + 8, canonical.length);
  const metadata = await sharp(canonical).metadata();
  assert.equal(metadata.format, 'webp');
  assert.equal(metadata.width, 1200);
  assert.equal(metadata.height, 1800);
  const sourcePixels = await sharp(source).raw().toBuffer();
  const canonicalPixels = await sharp(canonical).raw().toBuffer();
  assert.ok(sourcePixels.equals(canonicalPixels), 'portrait conversion must preserve decoded pixels');
});

test('legacy portrait URL has the exact canonical bytes and active fallback references use the current photo', () => {
  const canonical = read('public/assets/ccpun.webp');
  assert.ok(canonical.equals(read('public/assets/pun.webp')), 'cached portrait requests must resolve to the current photo');
  assert.ok(canonical.equals(read('apps/web/public/assets/ccpun.webp')), 'Web public mirror must contain the same portrait');
  const home = read('features/home/website-43/Website43Home.tsx').toString();
  const article = read('features/blog/website-43/Website43Article.tsx').toString();
  assert.match(home, /src="\/assets\/ccpun\.webp"/);
  assert.match(article, /avatar: article\.author\?\.profileAvatar \?\? \{ src: '\/assets\/ccpun\.webp'/);
  assert.doesNotMatch(home, /\/assets\/website-43\/about-pun\.png/);
  assert.doesNotMatch(article, /\/assets\/pun\.jpg/);
});
