import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { assertProductionCmsOwner, cmsSha, productionCmsOwners, v5ProductionSourcePredecessor } from '../qa/production-cms-source-proof.mjs';
import { loadFixtureModule } from '../qa/phase1-fixture-loader.mjs';

const require = createRequire(import.meta.url);
require('tsx/cjs');
require.extensions['.css'] = (mod) => {
  mod.exports = { __esModule: true, default: new Proxy({}, { get: (_obj, name) => String(name) }) };
};
const css = readFileSync('components/ui/health-happy/HealthHappyCountdown.module.css', 'utf8');
const countdownFile='components/ui/health-happy/HealthHappyCountdown.tsx';
const currentSource=readFileSync(countdownFile,'utf8');
const legacyPreloadSource=v5ProductionSourcePredecessor(countdownFile,currentSource);
const legacyImport=legacyPreloadSource.match(/import countdownArtwork from ['"]@\/(public\/[^'"]+)['"]/);
assert.ok(legacyImport,'historical exact source retains its reviewed artwork import');
const cssArtworkPath=resolve(legacyImport[1]);
const artworkUrl = '/_next/static/media/countdown-artwork.build-hash.webp';
require.extensions['.webp'] = (mod, filename) => {
  assert.equal(filename, cssArtworkPath, 'preload and CSS import the same source artwork');
  mod.exports = { __esModule: true, default: { src: artworkUrl } };
};
const Countdown = require('../components/ui/health-happy/HealthHappyCountdown.tsx').default;
const render = (placement) => renderToStaticMarkup(createElement(Countdown, { placement }));

test('flat native SSR never requests decorative artwork while preserving placement context', () => {
  assert.doesNotMatch(css,/background(?:-image)?:\s*url\(/);
  for(const placement of ['home','blog','article']){
    const html=render(placement);
    assert.doesNotMatch(html,/rel="preload"|<img\b/);
    assert.ok(html.includes(`data-campaign-placement="${placement}"`));
  }
  assert.equal(render('blog').replace('data-campaign-placement="blog"','data-campaign-placement="home"'),render('home'));
});

test('Home, Article and repeated Blog SSR have no redundant countdown preload', () => {
  for(const placement of ['home','article'])assert.doesNotMatch(render(placement),/rel="preload"/);
  const html=renderToStaticMarkup([createElement(Countdown,{placement:'blog',key:'one'}),createElement(Countdown,{placement:'blog',key:'two'})]);
  assert.equal((html.match(/rel="preload"/g)??[]).length,0);
});

test('flat successor retains original74 preload identity and complete prior SSR while denying unrelated drift', () => {
  const file=countdownFile,source=currentSource;
  assertProductionCmsOwner(file,source);
  const prior=legacyPreloadSource.replace("import { preload } from 'react-dom';\n",'')
    .replace(/import countdownArtwork[^\n]+\n/,'')
    .replace(/  if \(placement === 'blog'\) \{\n    preload[^\n]+\n  \}\n/,'')
    .replace(/\b(t|text|copyText)\.node\((["'])/g,'$1($2');
  assert.equal(cmsSha(prior),productionCmsOwners[file].after,'original full74 identity remains frozen');
  for(const mutant of [
    prior,legacyPreloadSource,
    legacyPreloadSource.replace("placement === 'blog'","placement === 'home'"),
    legacyPreloadSource.replace("fetchPriority: 'high'","fetchPriority: 'low'"),
    legacyPreloadSource.replace('article.lossless.webp','article.png'),
    source.replace('2026-11-30T23:59:59+07:00','2026-11-29T23:59:59+07:00'),
    source.replace('site.extra.headline','site.extra.date'),
    source.replace('splitDigits = false','splitDigits = true'),
    source+"\nimport { preload } from 'react-dom';\n",source+'\n// unrelated\n',
  ]) {assert.notEqual(mutant,source);assert.throws(()=>assertProductionCmsOwner(file,mutant));}
  const before=loadFixtureModule(file,{sources:new Map([[file,prior]])}).default;
  const after=loadFixtureModule(file).default;
  const beforeHtml=renderToStaticMarkup(createElement(before,{placement:'blog'}));
  const afterHtml=renderToStaticMarkup(createElement(after,{placement:'blog'}));
  assert.equal(afterHtml,beforeHtml,'default banner markup, public copy and click attributes remain byte-exact without artwork');
  const virtual='tests/virtual-public-artwork.ts';
  assert.throws(()=>loadFixtureModule(virtual,{sources:new Map([
    [virtual,"import artwork from '@/public/../outside.webp'; export default artwork;"],
    ['public/../outside.webp','virtual bytes must never be evaluated'],
  ])}),/Fixture asset must remain public/);
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
