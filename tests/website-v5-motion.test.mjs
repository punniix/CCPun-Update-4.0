import { eyebrowPredecessor } from "../qa/v5-eyebrow-proof.mjs";
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
  // No-JS hover/focus follows the same face timing as the tap (shown face at once, hidden face after the turn).
  assert.match(licence, /<noscript><style>\.card:is\(:hover,:focus-visible\) \.inner\{transform:rotateY\(180deg\)\}\.card:is\(:hover,:focus-visible\) \.back\{opacity:1;transition-delay:0s\}\.card:is\(:hover,:focus-visible\) \.front\{opacity:0;transition-delay:var\(--v5-motion-slow\)\}<\/style><\/noscript>/);

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
  assert.match(css, /prefers-reduced-motion: reduce\) \{\s*\.inner \{ transition: none; \}\s*\.front, \.back \{ transition: none; \}/);
  // Integration fix (Hallmark gate 73): the turned-away face is transparent, so back text is never painted under the front.
  // Motion smoothing (2026-10-26): the face turning toward the viewer is opaque at once, the face turning away goes
  // transparent only after the whole turn, so no frame shows a blank card (normal tap or a second tap mid-turn).
  assert.match(css, /\.front, \.back \{ transition: opacity 0s linear 0s; \}\n\.back \{ opacity: 0; transition-delay: var\(--v5-motion-slow\); \}\n\.card\[aria-pressed="true"\] \.back \{ opacity: 1; transition-delay: 0s; \}\n\.card\[aria-pressed="true"\] \.front \{ opacity: 0; transition-delay: var\(--v5-motion-slow\); \}/);
  assert.match(css, /\.inner \{[^}]*transition: transform var\(--v5-motion-slow\) var\(--v5-ease-standard\);/, 'the hide delay equals the turn duration (same token)');
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

// ---------------------------------------------------------------------------------------------------------------
// v5 motion smoothing pass (UAT, 2026-10-26): shared tokens, reduced-motion coverage, transform/opacity only.
// ---------------------------------------------------------------------------------------------------------------
const tokens = require('../components/layout/v5/motion-tokens.ts');

// Every CSS module the v5 shell renders that may carry motion. A file that animates must remove that motion for
// reduced motion itself, or be listed here as covered by the .root rule in V5.module.css (asserted below).
const V5_MOTION_CSS = [
  'components/layout/v5/V5.module.css', 'components/layout/v5/V5ChatDock.module.css', 'components/layout/v5/V5LicenceFlip.module.css',
  'components/layout/v5/V5Tool.module.css', 'components/ui/FunctionalMotion.module.css', 'components/ui/health-happy/HealthHappyCountdown.module.css',
  'features/blog/v5/ArticleWidgets.module.css', 'features/blog/v5/V5Blog.module.css', 'features/blog/v5/V5Engagement.module.css',
  'features/home/v5/V5Home.module.css', 'features/investment-allocation/InvestmentAllocation.module.css',
];
// Frozen by a source proof and rendered only inside the v5 .root, whose reduced-motion rule removes its colour transitions.
const COVERED_BY_ROOT_RULE = new Set(['components/ui/health-happy/HealthHappyCountdown.module.css']);
const LAYOUT_PROPS = /\b(?:width|height|min-width|min-height|max-width|max-height|top|right|bottom|left|inset|margin(?:-[a-z]+)?|padding(?:-[a-z]+)?|font-size|line-height|flex(?:-[a-z]+)?|grid(?:-[a-z]+)?|gap|border-width|background-position)\b/;
const strip = css => css.replace(/\/\*[\s\S]*?\*\//g, '');

test('motion tokens: CSS custom properties, view-transition CSS and the count-up all use the same values', () => {
  const root = strip(read('components/layout/v5/V5.module.css'));
  for (const [name, ms] of Object.entries(tokens.V5_MOTION_MS)) assert.match(root, new RegExp(`--v5-motion-${name}: ${ms}ms;`), `--v5-motion-${name}`);
  assert.match(root, new RegExp(`--v5-ease-standard: ${tokens.cssCubicBezier(tokens.V5_EASE_STANDARD).replace(/[().]/g, '\\$&')};`));
  assert.match(root, new RegExp(`--v5-ease-emphasized: ${tokens.cssCubicBezier(tokens.V5_EASE_EMPHASIZED).replace(/[().]/g, '\\$&')};`));
  assert.ok(vt.V5_VIEW_TRANSITION_CSS.includes(`animation-duration:${tokens.V5_MOTION_MS.slow}ms;animation-timing-function:cubic-bezier(0.2,0,0,1)`), 'morph = slow + standard');
  assert.ok(vt.V5_VIEW_TRANSITION_CSS.includes(`::view-transition-new(root){animation-duration:${tokens.V5_MOTION_MS.base}ms}`), 'page crossfade = base');
  assert.equal(countUp.COUNT_UP_DELAY_MS, tokens.V5_MOTION_MS.slow);
  assert.equal(countUp.COUNT_UP_DURATION_MS, tokens.V5_MOTION_MS.reveal);
  // The gold gap bar runs on exactly the count-up's delay, duration and curve, so number and bar land together.
  const tool = strip(read('components/layout/v5/V5Tool.module.css'));
  assert.match(tool, /\.ccpun-money-gap\) \{ transform-origin: left center; animation: moneyGrow var\(--v5-motion-reveal\) var\(--v5-ease-emphasized\) var\(--v5-motion-slow\) both; \}/);
  // No raw millisecond durations left in the motion-owning v5 files (hover, dock, flip, reveal all use tokens).
  for (const file of ['components/layout/v5/V5ChatDock.module.css', 'components/layout/v5/V5LicenceFlip.module.css', 'features/blog/v5/V5Engagement.module.css']) {
    for (const [, value] of strip(read(file)).matchAll(/(?:transition|animation):\s*([^;]+);/g)) assert.doesNotMatch(value.replace(/var\([^)]*\)/g, ''), /\b[1-9]\d*m?s\b/, `${file}: ${value}`);
  }
});

test('cubicBezierAt follows the CSS curve: endpoints, monotonic, known midpoints', () => {
  for (const curve of [tokens.V5_EASE_STANDARD, tokens.V5_EASE_EMPHASIZED]) {
    assert.equal(tokens.cubicBezierAt(curve, 0), 0);
    assert.equal(tokens.cubicBezierAt(curve, 1), 1);
    let last = -1;
    for (let x = 0; x <= 1.0001; x += 0.02) { const y = tokens.cubicBezierAt(curve, x); assert.ok(y >= last - 1e-9 && y <= 1 + 1e-9); last = y; }
  }
  // Linear curve maps to itself; ease-out curves run ahead of linear.
  assert.ok(Math.abs(tokens.cubicBezierAt([0, 0, 1, 1], 0.37) - 0.37) < 1e-4);
  assert.ok(tokens.cubicBezierAt(tokens.V5_EASE_EMPHASIZED, 0.5) > 0.9, 'emphasized is mostly done by half time');
  assert.ok(countUp.countUpValue(1_000_000, countUp.COUNT_UP_DELAY_MS + countUp.COUNT_UP_DURATION_MS / 2) > 900_000);
});

test('result reveal waits until the comparison is on screen, then bars and count start together', async () => {
  const { createRoot } = require('react-dom/client');
  const frames = [];
  const raf = { request: callback => { frames.push(callback); return frames.length; }, cancel: () => {} };
  const observers = [];
  await withDom(async dom => {
    dom.window.IntersectionObserver = globalThis.IntersectionObserver = class { constructor(cb, opts) { this.cb = cb; this.opts = opts; this.off = false; observers.push(this); } observe(el) { this.el = el; } disconnect() { this.off = true; } };
    try {
      const root = createRoot(dom.window.document.getElementById('app'));
      await React.act(async () => { root.render(React.createElement(MoneyComparison, { need: 2_400_000, resources: 900_000, title: 't' })); });
      const figure = dom.window.document.querySelector('figure');
      const live = dom.window.document.querySelector('dd span[aria-hidden] > span:last-child');
      assert.equal(figure.getAttribute('data-reveal'), 'wait', 'below the fold: bars hold their first frame');
      assert.equal(frames.length, 0, 'the count does not run while waiting');
      assert.match(live.textContent, /^0 /);
      assert.deepEqual(observers[0].opts.threshold, [countUp.REVEAL_VISIBLE_RATIO]);
      observers[0].cb([{ isIntersecting: true, intersectionRatio: 0.2 }]);
      assert.equal(figure.getAttribute('data-reveal'), 'wait', 'a sliver on screen is not enough');
      observers[0].cb([{ isIntersecting: true, intersectionRatio: 0.6 }]);
      assert.equal(figure.hasAttribute('data-reveal'), false, 'on screen: bars play');
      assert.equal(observers[0].off, true);
      let now = 0;
      while (frames.length && now < 5000) { const next = frames.shift(); next(now); now += 16; }
      assert.match(live.textContent, new RegExp(`^${(1_500_000).toLocaleString('th-TH')} `), 'count ends on the exact final value');
      assert.ok(now >= countUp.COUNT_UP_DELAY_MS + countUp.COUNT_UP_DURATION_MS);
      await React.act(async () => root.unmount());
    } finally { delete globalThis.IntersectionObserver; }
  }, { raf });
  const tool = strip(read('components/layout/v5/V5Tool.module.css'));
  assert.match(tool, /\[data-reveal="wait"\] :is\(\.ccpun-money-have, \.ccpun-money-gap, \.ccpun-money-divider\)\) \{ animation-play-state: paused; \}/);
  assert.match(tool, /@media print \{\n  \.calcScope :global\(\.ccpun-money-have\), \.calcScope :global\(\.ccpun-money-gap\), \.calcScope :global\(\.ccpun-money-divider\) \{ animation: none; \}/, 'print shows the final bars');
});

test('reduced motion is complete: every v5 motion stylesheet, the page transition, the count-up and the theme switch', () => {
  assert.match(read('components/layout/v5/V5.module.css'), /@media \(prefers-reduced-motion: reduce\) \{\n  \.root \*, \.root \*::before, \.root \*::after \{ transition: none !important; animation: none !important; scroll-behavior: auto !important; \}/);
  for (const file of V5_MOTION_CSS) {
    const css = strip(read(file));
    if (!/\b(?:transition|animation)\s*:/.test(css)) continue;
    if (COVERED_BY_ROOT_RULE.has(file)) continue;
    assert.match(css, /@media \(prefers-reduced-motion: ?reduce\)/, `${file}: has its own reduced-motion branch`);
  }
  const dock = strip(read('components/layout/v5/V5ChatDock.module.css'));
  assert.match(dock, /@media \(prefers-reduced-motion: reduce\) \{\n  \.dock, \.dock\[data-state="hidden"\] \{ transition: none; \}\n  \.backdrop, \.panel \{ animation: none; \}/);
  assert.match(vt.V5_VIEW_TRANSITION_CSS, /prefers-reduced-motion:reduce/);
  // Theme switch: one frame, no lingering hover transitions.
  assert.match(read('components/layout/v5/V5.module.css'), /:global\(html\[data-v5-theme-switching\]\) \.root \*[^{]*\{ transition: none !important; \}/);
  const enhancer = read('components/layout/v5/V5HeaderEnhancer.tsx');
  assert.match(enhancer, /root\.setAttribute\("data-v5-theme-switching", ""\);\n      applyTheme\(choice\);/);
  assert.match(enhancer, /requestAnimationFrame\(\(\) => root\.removeAttribute\("data-v5-theme-switching"\)\)/);
  assert.match(enhancer, /switchTheme\(next\);/);
  // C11: only the selected segment moves during a theme swap, using the existing fast token.
  assert.match(read('components/layout/v5/V5.module.css'), /:global\(html\[data-v5-theme-switching\]\) \.themeSegments::before \{ transition: transform var\(--v5-motion-fast\) var\(--v5-ease-standard\) !important; \}/);
  assert.match(read('components/layout/v5/V5.module.css'), /@media \(prefers-reduced-motion: reduce\) \{ :global\(html\[data-v5-theme-switching\]\) \.themeSegments::before \{ transition: none !important; \} \}/);
  // Client navigations start the next page at its top (Next 16 opt-in), instead of smooth-scrolling under the morph.
  assert.match(enhancer, /root\.dataset\.scrollBehavior = "smooth";/);
});

test('motion animates transform/opacity only: no layout properties, no `all`, no permanent will-change', () => {
  for (const file of V5_MOTION_CSS) {
    const css = strip(read(file));
    for (const [, name, body] of css.matchAll(/@keyframes\s+([\w-]+)\s*\{([\s\S]*?\})\s*\}/g)) {
      for (const [, decls] of body.matchAll(/\{([^}]*)\}/g)) {
        for (const decl of decls.split(';').map(d => d.trim()).filter(Boolean)) {
          const prop = decl.split(':')[0].trim();
          assert.ok(['transform', 'opacity', 'translate', 'scale', 'rotate'].includes(prop) || (file === 'components/layout/v5/V5Tool.module.css' && name === 'v5ResultTickDraw' && prop === 'stroke-dashoffset'), `${file} @keyframes ${name}: ${prop}`);
        }
      }
    }
    for (const [, value] of css.matchAll(/(?<![-\w])transition(?:-property)?:\s*([^;]+);/g)) {
      assert.doesNotMatch(value, /\ball\b/, `${file}: transition: all`);
      for (const part of value.split(',')) {
        const prop = part.trim().split(/\s+/)[0];
        assert.doesNotMatch(prop, LAYOUT_PROPS, `${file}: transition on a layout property (${prop})`);
      }
    }
    assert.doesNotMatch(css, /will-change\s*:/, `${file}: no permanent will-change (the browser promotes during the animation)`);
  }
  // The IA total bar slides inside its track instead of animating width.
  assert.match(read('features/investment-allocation/PortfolioBuilder.tsx'), /className=\{styles\.progressFill\} style=\{\{ transform: `translateX\(\$\{width - 100\}%\)` \}\}/);
});

test('chat panel enters with opacity/transform; the dock moves with the cookie notice in the same frame', () => {
  const css = strip(read('components/layout/v5/V5ChatDock.module.css'));
  assert.match(css, /\.panel \{[^}]*animation: v5ChatRise var\(--v5-motion-base\) var\(--v5-ease-standard\) both;/);
  assert.match(css, /\.backdrop \{[^}]*animation: v5ChatFade var\(--v5-motion-fast\) ease-out both;/);
  assert.match(css, /@media \(min-width: 1024px\) \{ \.panel \{ animation-name: v5ChatPop; \} \}/);
  const dock = read('components/layout/v5/V5ChatDock.tsx');
  assert.match(dock, /new ResizeObserver\(\(\) => measure\(\)\)/, 'size changes are applied before paint');
});


// C8: owner-approved bounded exit, native details and decorative result tick.
test('C8 uses existing tokens, native details, bounded transforms and immediate reduced-motion final states', () => {
  const dock = strip(read('components/layout/v5/V5ChatDock.module.css'));
  const shell = strip(read('components/layout/v5/V5.module.css'));
  const tool = strip(read('components/layout/v5/V5Tool.module.css'));
  assert.match(dock, /\.backdrop\[data-chat-state="closing"\], \.panel\[data-chat-state="closing"\] \{ pointer-events: none; \}/);
  assert.match(dock, /v5ChatRise var\(--v5-motion-micro\) var\(--v5-ease-standard\) reverse both/);
  assert.match(dock, /\.panel\[data-chat-state="closing"\] \{ animation-name: v5ChatPop;/);
  assert.match(dock, /prefers-reduced-motion: reduce\) \{\s*\.backdrop\[data-chat-state="closing"\][^}]*animation: none; opacity: 0;/);
  assert.match(shell, /\.root details\[open\] > :not\(summary\) \{ animation: v5DetailsReveal var\(--v5-motion-fast\) var\(--v5-ease-standard\) both; \}/);
  assert.match(shell, /@keyframes v5DetailsReveal \{ from \{ opacity: 0; transform: translateY\(-4px\);/);
  assert.doesNotMatch(read('components/layout/v5/V5ToolParts.tsx'), /use client|onToggle|onClick/, 'FAQ remains native server markup');
  for (const css of [dock, shell, tool]) {
    for (const [, value] of css.matchAll(/(?:animation|transition):\s*([^;]+);/g)) assert.doesNotMatch(value.replace(/var\([^)]*\)/g, ''), /\b[1-9]\d*ms\b/, 'no raw durations');
  }
  assert.match(tool, /scale\(\.96\)/);
  assert.match(tool, /v5ResultTickDraw var\(--v5-motion-slow\) var\(--v5-ease-emphasized\) both/);
  assert.match(tool, /prefers-reduced-motion: reduce\) \{ \.resultTick, \.resultTick path \{ animation: none;/);
  const Tick = require('../components/layout/v5/V5ResultTick.tsx').default;
  const markup = renderToStaticMarkup(React.createElement(Tick));
  assert.match(markup, /aria-hidden="true"/);
  assert.match(markup, /pathLength="1"/);
  assert.doesNotMatch(markup, /role="(?:status|alert)"|<title|<text/);
  assert.match(read('DESIGN.md'), /Toast motion pattern.*role="status".*aria-live="polite"/);
  assert.doesNotMatch(read('DESIGN.md'), /Framer Motion/);
});

test('C8 result successors reconstruct the frozen C6 pins exactly and reject unrelated edits', async () => {
  const { createHash } = await import('node:crypto');
  const { websiteV5MotionSources, websiteV5ResultLineSources, isWebsiteV5ReviewedSuccessor } = await import('../qa/website-v5-phase-a-proof.mjs');
  const sha = s => createHash('sha256').update(s).digest('hex');
  for (const [file, entry] of Object.entries(websiteV5MotionSources)) {
    const source = eyebrowPredecessor(file, read(file));
    assert.equal(entry.before, websiteV5ResultLineSources[file].after);
    assert.equal(sha(source), entry.after);
    const predecessor = source.replace("import V5ResultTick from '@/components/layout/v5/V5ResultTick';\n", '').replace('<V5ResultTick />', '');
    assert.equal(sha(predecessor), entry.before, 'only the tick import and insertion differ');
    assert.equal(isWebsiteV5ReviewedSuccessor(file, source), true);
    for (const mutation of [source + '\n', source.replace('resultChatHref', 'changedResultHref')]) assert.equal(isWebsiteV5ReviewedSuccessor(file, mutation), false);
  }
});

test('C8 panel closes on its own animationend or token fallback, cancels on reopen, and ends immediately for reduced motion', async () => {
  const { loadFixtureModule } = await import('../qa/phase1-fixture-loader.mjs');
  const { LINE_CHAT_DEFAULTS, chatContextForPath } = require('../lib/line/chat-panel.ts');
  const { createRoot } = require('react-dom/client');
  const mocks = new Map([
    ['./V5ChatDock.module.css', { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) }],
    ['@/lib/analytics', { trackEvent: () => {} }],
    ['@/lib/acquisition', { getAttribution: () => undefined }],
    ['@/lib/cookie-consent', { getConsentData: () => null }],
  ]);
  const Panel = loadFixtureModule('components/layout/v5/V5ChatPanel.tsx', { mocks }).default;
  await withDom(async dom => {
    let reduced = false, preferenceChange, timer, duration, cancelled = 0, ended = 0;
    dom.window.matchMedia = query => ({ get matches() { return query.includes('reduce') && reduced; }, addEventListener: (_, callback) => { preferenceChange = callback; }, removeEventListener() {} });
    dom.window.setTimeout = (callback, delay) => { timer = callback; duration = delay; return 7; };
    dom.window.clearTimeout = id => { assert.equal(id, 7); cancelled++; };
    const root = createRoot(dom.window.document.getElementById('app'));
    const onClose = () => {};
    const onClosed = () => { ended++; };
    const render = closing => React.act(async () => root.render(React.createElement(Panel, { config: LINE_CHAT_DEFAULTS, context: chatContextForPath('/'), trigger: 'dock', closing, onClose, onClosed })));
    await render(false);
    await render(true);
    const panel = dom.window.document.querySelector('#v5-chat-panel');
    assert.equal(panel.hasAttribute('inert'), true);
    assert.equal(panel.getAttribute('aria-hidden'), 'true');
    assert.equal(duration, tokens.V5_MOTION_MS.micro);
    await React.act(async () => panel.querySelector('svg').dispatchEvent(new dom.window.Event('animationend', { bubbles: true })));
    assert.equal(ended, 0, 'child animations cannot unmount the closing panel');
    await React.act(async () => panel.dispatchEvent(new dom.window.Event('animationend', { bubbles: true })));
    assert.equal(ended, 1, 'the panel animation ends the close');
    await React.act(async () => timer());
    assert.equal(ended, 2, 'fallback also ends the close without an animation event');
    await render(false);
    assert.ok(cancelled > 0, 'reopening cancels the old fallback');
    await render(true);
    reduced = true;
    await React.act(async () => preferenceChange());
    assert.equal(ended, 3, 'preference changed mid-exit: finish immediately');
    await render(false);
    await render(true);
    assert.equal(ended, 4, 'already reduced: finish immediately without waiting');
    await React.act(async () => root.unmount());
    dom.window.close();
  });
});


test('About verification links enter focus flow only on the back; the button returns to its front', async () => {
  const { createRoot } = require('react-dom/client');
  await withDom(async dom => {
    const root = createRoot(dom.window.document.getElementById('app'));
    const props = { term: 'ผู้วางแผนการลงทุน', detail: '106654', hint: copy.V5_LICENCE_FLIP_HINT, back: [], verification: { href: 'https://market.sec.or.th/LicenseCheck/Search', label: 'ตรวจสอบกับ ก.ล.ต.', backLabel: 'กลับด้านหน้า' } };
    await React.act(async () => root.render(React.createElement(Flip.default, props)));
    const button = dom.window.document.querySelector('button');
    const link = dom.window.document.querySelector('.verifiedCard > a.verifyLink');
    assert.equal(button.querySelector('a'), null);
    assert.equal(link.hidden, true);
    await React.act(async () => button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })));
    assert.equal(button.getAttribute('aria-pressed'), 'true');
    assert.equal(link.hidden, false);
    assert.equal(button.getAttribute('aria-label'), null, 'Accessible facts are not replaced by an action-only name');
    assert.ok(button.textContent.includes('106654'));
    assert.ok(button.textContent.includes('กลับด้านหน้า'));
    link.focus(); assert.equal(dom.window.document.activeElement, link);
    await React.act(async () => button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })));
    assert.equal(link.hidden, true);
    assert.equal(button.getAttribute('aria-pressed'), 'false');
    await React.act(async () => root.unmount());
  });
});
