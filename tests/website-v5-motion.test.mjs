// Website v5 motion round (owner-approved ideas #1, #2, #4; UAT prototype only).
// Contracts: transform/opacity only, reduced motion shows the final state, no-JS keeps full content,
// flip cards are native buttons with aria-pressed, counted numbers expose the final value at once.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { JSDOM } from 'jsdom';

const require = createRequire(import.meta.url);
require('tsx/cjs');
require.extensions['.css'] = module => { module.exports = { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) }; };
const { renderToStaticMarkup } = require('react-dom/server');
const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

const countUp = require('../components/ui/useCountUp.ts');
const MoneyComparison = require('../components/ui/MoneyComparison.tsx').default;
const Flip = require('../components/layout/v5/V5LicenceFlip.tsx');
const copy = require('../components/layout/v5/licence-flip-copy.ts');
const vt = require('../components/layout/v5/V5ViewTransition.tsx');

function withDom(run, { reduce = false, raf = null } = {}) {
  const dom = new JSDOM('<div id="app"></div>', { url: 'https://test.ccpun.com/' });
  // jsdom has no matchMedia, which the hook treats as reduced motion; give it one when a test needs motion.
  if (reduce || raf !== null) dom.window.matchMedia = query => ({ matches: reduce && query.includes('reduce'), media: query, addEventListener() {}, removeEventListener() {} });
  if (raf) { dom.window.requestAnimationFrame = raf.request; dom.window.cancelAnimationFrame = raf.cancel; }
  const names = ['window', 'document', 'navigator', 'IS_REACT_ACT_ENVIRONMENT'];
  const before = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  Object.defineProperties(globalThis, {
    window: { value: dom.window, configurable: true }, document: { value: dom.window.document, configurable: true },
    navigator: { value: dom.window.navigator, configurable: true }, IS_REACT_ACT_ENVIRONMENT: { value: true, configurable: true },
  });
  const restore = () => { for (const [name, descriptor] of before) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; } };
  return Promise.resolve(run(dom)).finally(restore);
}

test('count-up math: 0 before the delay, the exact final value at the end, never past it', () => {
  assert.equal(countUp.countUpValue(1_500_000, 0), 0);
  assert.equal(countUp.countUpValue(1_500_000, countUp.COUNT_UP_DELAY_MS), 0);
  assert.equal(countUp.countUpValue(1_500_000, countUp.COUNT_UP_DELAY_MS + countUp.COUNT_UP_DURATION_MS), 1_500_000);
  assert.equal(countUp.countUpValue(1_500_000, 99_999), 1_500_000);
  let last = -1;
  for (let ms = 0; ms <= 1500; ms += 50) { const value = countUp.countUpValue(630_000, ms); assert.ok(value >= last && value <= 630_000); last = value; }
  assert.equal(countUp.countUpValue(0, 900), 0);
  assert.equal(countUp.prefersReducedMotion(undefined), true, 'no window or matchMedia counts as reduced motion');
  assert.equal(countUp.prefersReducedMotion({ matchMedia: () => ({ matches: true }) }), true);
  assert.equal(countUp.prefersReducedMotion({ matchMedia: () => ({ matches: false }) }), false);
});

test('result comparison: server/no-JS markup carries the final amounts and an accessible final gap value', () => {
  const html = renderToStaticMarkup(React.createElement(MoneyComparison, { need: 2_400_000, resources: 900_000, title: 'เปรียบเทียบ' }));
  const gapText = (1_500_000).toLocaleString('th-TH');
  assert.match(html, new RegExp(`<span class="sr-only">${gapText} `), 'final gap value is in an accessible node');
  assert.equal((html.match(new RegExp(gapText, 'g')) ?? []).length >= 3, true, 'reserve, visible and accessible copies all show the final value without JS');
  assert.match(html, /class="ccpun-money-gap"/, 'gold gap segment is rendered');
  assert.doesNotMatch(html, /transition-\[width\]/, 'no width transition: the bar width is set once');
  const balanced = renderToStaticMarkup(React.createElement(MoneyComparison, { need: 900_000, resources: 900_000, title: 't' }));
  assert.doesNotMatch(balanced, /ccpun-money-gap/, 'no gap segment when nothing is missing');
});

test('result comparison: reduced motion shows the final number at once; otherwise it counts up to the exact value', async () => {
  const gapText = `${(1_500_000).toLocaleString('th-TH')}`;
  const { createRoot } = require('react-dom/client');
  await withDom(async dom => {
    const root = createRoot(dom.window.document.getElementById('app'));
    await React.act(async () => { root.render(React.createElement(MoneyComparison, { need: 2_400_000, resources: 900_000, title: 't' })); });
    const live = dom.window.document.querySelector('dd span[aria-hidden] > span:last-child');
    assert.match(live.textContent, new RegExp(gapText), 'reduced motion: final value immediately');
    await React.act(async () => root.unmount());
  }, { reduce: true });

  const frames = [];
  const raf = { request: callback => { frames.push(callback); return frames.length; }, cancel: () => {} };
  await withDom(async dom => {
    const root = createRoot(dom.window.document.getElementById('app'));
    await React.act(async () => { root.render(React.createElement(MoneyComparison, { need: 2_400_000, resources: 900_000, title: 't' })); });
    const live = dom.window.document.querySelector('dd span[aria-hidden] > span:last-child');
    assert.match(live.textContent, /^0 /, 'count starts at 0 before the first paint');
    assert.match(dom.window.document.querySelector('.sr-only').textContent, new RegExp(gapText), 'assistive tech keeps the final value while counting');
    let now = 0;
    while (frames.length && now < 5000) { const next = frames.shift(); next(now); now += 100; }
    assert.match(live.textContent, new RegExp(`^${gapText} `), 'count ends on the exact final value');
    await React.act(async () => root.unmount());
  }, { raf });
});

test('result motion CSS animates transform/opacity only and is removed for reduced motion', () => {
  const tool = read('components/layout/v5/V5Tool.module.css');
  const motion = tool.slice(tool.indexOf('v5 motion round (owner-approved idea #1'));
  for (const [label, css] of [['V5Tool motion block', motion], ['IA', read('features/investment-allocation/InvestmentAllocation.module.css')], ['flip', read('components/layout/v5/V5LicenceFlip.module.css')]]) {
    for (const [, body] of css.matchAll(/@keyframes\s+[\w-]+\s*\{([\s\S]*?\})\s*\}/g)) assert.doesNotMatch(body, /\b(?:width|height|left|top|margin|padding)\s*:/, `${label}: keyframes move transform/opacity only`);
    assert.match(css, /prefers-reduced-motion: reduce/, `${label}: reduced-motion branch`);
  }
  for (const [, value] of read('components/layout/v5/V5LicenceFlip.module.css').matchAll(/transition:\s*([^;]+);/g)) assert.match(value, /^(?:transform|opacity|none)\b/);
  assert.match(motion, /animation: none; \}/);
  assert.match(read('features/investment-allocation/InvestmentAllocation.module.css'), /prefers-reduced-motion: reduce\) \{ \.barFill \{ animation: none; \} \}/);
  assert.doesNotMatch(read('components/ui/MoneyComparison.tsx'), /from "[^"]*\.css"|className="[^"]*(?:transition-\[width\]|duration-500)/, 'shared widget imports no stylesheet and has no width transition');
});

test('licence and AFPT™ cards: native buttons with aria-pressed, back text reachable, no-JS fallback', () => {
  const licence = renderToStaticMarkup(React.createElement(Flip.default, { term: 'ตัวแทนประกันชีวิต', detail: '6801064783', hint: copy.V5_LICENCE_FLIP_HINT, back: [{ label: copy.V5_LICENCE_NUMBER_LABEL, value: '6801064783', repeatsFront: true }], note: copy.V5_LICENCE_VERIFY_PLACEHOLDER }));
  assert.match(licence, /<button type="button" class="card" aria-pressed="false">/);
  assert.match(licence, new RegExp(copy.V5_LICENCE_VERIFY_PLACEHOLDER), 'back note is in the markup (accessibility tree)');
  assert.match(licence, /<span class="line" aria-hidden="true">/, 'the repeated number on the back is hidden from assistive tech');
  assert.doesNotMatch(licence, /https?:\/\//, 'no invented verification URL');
  assert.match(licence, /<noscript><style>\.card:is\(:hover,:focus-visible\) \.inner\{transform:rotateY\(180deg\)\}<\/style><\/noscript>/);

  const production = renderToStaticMarkup(React.createElement(Flip.default, { term: 'ตัวแทนประกันชีวิต', detail: '6801064783', hint: copy.V5_LICENCE_FLIP_HINT, back: [{ label: copy.V5_LICENCE_NUMBER_LABEL, value: '6801064783', repeatsFront: true }], note: null }));
  assert.doesNotMatch(production, /<button|aria-pressed|ดูวิธีตรวจสอบ/, 'without approved verification text the licence card is static');
  assert.match(production, /6801064783/);

  const afpt = renderToStaticMarkup(React.createElement(Flip.default, { term: copy.V5_AFPT_CARD.term, detail: copy.V5_AFPT_CARD.detail, hint: copy.V5_CREDENTIAL_FLIP_HINT, back: copy.V5_AFPT_CARD.back }));
  assert.match(afpt, /aria-pressed="false"/);
  const afptText = afpt.replace(/<[^>]+>/g, '');
  for (const fact of ['AFPT™', 'Associate Financial Planner (Thailand)', 'สมาคมนักวางแผนการเงินไทย (TFPA)', 'AFPT260195', '31 ธ.ค. 2571']) assert.ok(afptText.includes(fact), fact);
  // Integration fix (2026-10-25): the TFPA name stays on one line on the card back instead of splitting mid-phrase.
  assert.ok(afpt.includes('<span class="keep">สมาคมนักวางแผนการเงินไทย</span> (TFPA)'), 'TFPA name is held together');
  assert.doesNotMatch(afpt, /<span class="line" aria-hidden/, 'AFPT™ back facts are all readable');
  const cardCopy = read('components/layout/v5/licence-flip-copy.ts').replace(/\/\/[^\n]*/g, '');
  assert.doesNotMatch(cardCopy, /\bAFPT(?![™0-9])|ฟรี|…|\.\.\./, 'AFPT™ always carries the mark; no banned copy');
  assert.doesNotMatch(read('features/home/v5/V5Home.tsx') + cardCopy, /เป็น AFPT/, 'AFPT™ is never used as a noun');
});

test('flip card toggles aria-pressed on click (Enter/Space are native button activation)', async () => {
  const { createRoot } = require('react-dom/client');
  await withDom(async dom => {
    const root = createRoot(dom.window.document.getElementById('app'));
    await React.act(async () => { root.render(React.createElement(Flip.default, { term: copy.V5_AFPT_CARD.term, detail: copy.V5_AFPT_CARD.detail, hint: copy.V5_CREDENTIAL_FLIP_HINT, back: copy.V5_AFPT_CARD.back })); });
    const button = dom.window.document.querySelector('button');
    assert.equal(button.getAttribute('aria-pressed'), 'false');
    await React.act(async () => { button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    assert.equal(button.getAttribute('aria-pressed'), 'true');
    await React.act(async () => { button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    assert.equal(button.getAttribute('aria-pressed'), 'false');
    await React.act(async () => root.unmount());
  });
  const css = read('components/layout/v5/V5LicenceFlip.module.css');
  assert.match(css, /\.face \{\s*grid-area: 1 \/ 1;/, 'faces share one grid cell: flipping never changes layout');
  assert.match(css, /prefers-reduced-motion: reduce\) \{\s*\.inner \{ transition: none; \}/);
  assert.match(css, /min-height: 44px/);
});

test('page transition: shared names are unique per page, shared pair only, reduced motion and no-JS untouched', () => {
  assert.equal(vt.v5ArticleTransitionName('cover', 'drafts.abc 1'), 'ccpun-article-cover-drafts-abc-1');
  const claimed = new Set();
  assert.equal(vt.claimV5TransitionName('ccpun-article-cover-a', claimed), true);
  assert.equal(vt.claimV5TransitionName('ccpun-article-cover-a', claimed), false, 'a second card for the same article gets no name');
  assert.match(vt.V5_VIEW_TRANSITION_CSS, /@media \(prefers-reduced-motion:reduce\)\{::view-transition-group\(\*\),::view-transition-old\(\*\),::view-transition-new\(\*\)\{animation:none!important\}\}/);
  assert.match(vt.V5_VIEW_TRANSITION_CSS, /::view-transition\{pointer-events:none\}/);
  const source = read('components/layout/v5/V5ViewTransition.tsx');
  assert.match(source, /default="none"/, 'only the shared pair animates');
  assert.doesNotMatch(source, /startViewTransition|addTransitionType|"use client"/, 'React drives the browser API; no client JS added');
  const card = read('components/layout/v5/V5Primitives.tsx');
  assert.match(card, /<V5SharedTransition part="cover" articleId=\{article\.id\}><Image/);
  assert.match(card, /<V5SharedTransition part="title" articleId=\{article\.id\}><Heading/);
  assert.match(card, /<Link href=\{article\.href\}>/, 'the card keeps its real link (no-JS and unsupported browsers navigate normally)');
  const page = read('features/blog/v5/V5Article.tsx');
  assert.match(page, /<V5SharedTransition part="title" articleId=\{article\.id\}><h1/);
  assert.match(page, /<V5SharedTransition part="cover" articleId=\{article\.id\}><Image/);
  for (const file of ['package.json', 'apps/web/package.json']) assert.doesNotMatch(read(file), /framer-motion|"motion"|gsap|lottie|three|@splinetool|rive-/, `${file}: no animation library`);
});
