import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { assertProductionCmsOwner, cmsSha, productionCmsOwners } from '../qa/production-cms-source-proof.mjs';
import { loadFixtureModule } from '../qa/phase1-fixture-loader.mjs';

const require = createRequire(import.meta.url);
require('tsx/cjs');
require.extensions['.css'] = (mod) => {
  mod.exports = { __esModule: true, default: new Proxy({}, { get: (_obj, name) => String(name) }) };
};
const css = readFileSync('components/ui/health-happy/HealthHappyCountdown.module.css', 'utf8');
const cssArtworkPath = resolve('components/ui/health-happy', css.match(/background: url\('([^']+)'\)/)[1]);
const artworkUrl = '/_next/static/media/countdown-artwork.build-hash.webp';
require.extensions['.webp'] = (mod, filename) => {
  assert.equal(filename, cssArtworkPath, 'preload and CSS import the same source artwork');
  mod.exports = { __esModule: true, default: { src: artworkUrl } };
};
const Countdown = require('../components/ui/health-happy/HealthHappyCountdown.tsx').default;
const render = (placement) => renderToStaticMarkup(createElement(Countdown, { placement }));

test('Blog SSR emits one high-priority artwork hint before the unchanged banner', () => {
  const blog = render('blog');
  const hint = `<link rel="preload" href="${artworkUrl}" as="image" fetchPriority="high"/>`;
  assert.ok(blog.startsWith(hint));
  assert.equal((blog.match(/rel="preload"/g) ?? []).length, 1);
  assert.equal(blog.slice(hint.length).replace('data-campaign-placement="blog"', 'data-campaign-placement="home"'), render('home'));
});

test('Home and Article SSR emit no countdown preload; repeated Blog renders deduplicate it', () => {
  for (const placement of ['home', 'article']) assert.doesNotMatch(render(placement), /rel="preload"/);
  const html = renderToStaticMarkup([createElement(Countdown, { placement: 'blog', key: 'one' }), createElement(Countdown, { placement: 'blog', key: 'two' })]);
  assert.equal((html.match(/rel="preload"/g) ?? []).length, 1);
});

test('exact preload admission preserves complete prior SSR and denies predecessor or unrelated drift', () => {
  const file = 'components/ui/health-happy/HealthHappyCountdown.tsx';
  const source = readFileSync(file, 'utf8');
  assertProductionCmsOwner(file, source);
  const prior = source.replace("import { preload } from 'react-dom';\n", '')
    .replace(/import countdownArtwork[^\n]+\n/, '')
    .replace(/  if \(placement === 'blog'\) \{\n    preload[^\n]+\n  \}\n/, '')
    // Reviewed sized-copy successor: `text.node("key")` is the same CMS lookup as `text("key")`.
    .replace(/\b(t|text|copyText)\.node\((["'])/g, '$1($2');
  assert.equal(cmsSha(prior), productionCmsOwners[file].after);
  for (const mutant of [prior, source.replace("placement === 'blog'", "placement === 'home'"), source.replace("fetchPriority: 'high'", "fetchPriority: 'low'"), source.replace('article.lossless.webp', 'article.png'), source.replace('site.extra.headline', 'site.extra.date'), source + "\nimport { preload } from 'react-dom';\n", source + '\n// unrelated\n']) {
    assert.notEqual(mutant, source);
    assert.throws(() => assertProductionCmsOwner(file, mutant));
  }
  const before = loadFixtureModule(file, { sources: new Map([[file, prior]]) }).default;
  const after = loadFixtureModule(file).default;
  const beforeHtml = renderToStaticMarkup(createElement(before, { placement: 'blog' }));
  const afterHtml = renderToStaticMarkup(createElement(after, { placement: 'blog' }));
  const hint = `<link rel="preload" href="${css.match(/public([^']+)'\)/)[1]}" as="image" fetchPriority="high"/>`;
  assert.ok(afterHtml.startsWith(hint));
  assert.equal(afterHtml.slice(hint.length), beforeHtml, 'complete banner markup and public copy remain byte-exact');
  const virtual = 'tests/virtual-public-artwork.ts';
  assert.throws(() => loadFixtureModule(virtual, { sources: new Map([
    [virtual, "import artwork from '@/public/../outside.webp'; export default artwork;"],
    ['public/../outside.webp', 'virtual bytes must never be evaluated'],
  ]) }), /Fixture asset must remain public/);
});

test('expired client countdown still disappears after its existing clock effect', async (t) => {
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://example.test/' });
  const previous = { window: globalThis.window, document: globalThis.document, act: globalThis.IS_REACT_ACT_ENVIRONMENT };
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  t.mock.method(Date, 'now', () => Date.parse('2026-12-01T00:00:00+07:00'));
  const { createRoot } = require('react-dom/client');
  const container = dom.window.document.getElementById('root');
  const root = createRoot(container);
  try {
    await act(async () => root.render(createElement(Countdown, { placement: 'blog' })));
    assert.equal(container.innerHTML, '');
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    globalThis.window = previous.window;
    globalThis.document = previous.document;
    globalThis.IS_REACT_ACT_ENVIRONMENT = previous.act;
  }
});
