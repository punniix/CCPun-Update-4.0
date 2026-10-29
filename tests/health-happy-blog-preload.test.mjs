import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { act, createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { assertProductionCmsOwner } from '../qa/production-cms-source-proof.mjs';
import { isWebsiteV5ReviewedSuccessor } from '../qa/website-v5-phase-a-proof.mjs';

const require = createRequire(import.meta.url);
require('tsx/cjs');
require.extensions['.css'] = (mod) => {
  mod.exports = { __esModule: true, default: new Proxy({}, { get: (_obj, name) => String(name) }) };
};
// Website v5 Phase B (reviewed, deliberate): the v5 countdown frame is flat, so the decorative 4.3
// artwork layer and its high-priority /blog/ preload were removed (it competed with the /blog/ LCP image).
// The banner markup, copy, deadline and analytics are unchanged; the predecessor digest stays recorded
// in qa/website-v5-phase-a-proof.mjs.
const css = readFileSync('components/ui/health-happy/HealthHappyCountdown.module.css', 'utf8');
const Countdown = require('../components/ui/health-happy/HealthHappyCountdown.tsx').default;
const render = (placement) => renderToStaticMarkup(createElement(Countdown, { placement }));

test('v5 countdown emits no image preload on any placement and keeps one banner markup', () => {
  for (const placement of ['home', 'blog', 'article']) assert.doesNotMatch(render(placement), /rel="preload"/);
  assert.equal(render('blog').replace('data-campaign-placement="blog"', 'data-campaign-placement="home"'), render('home'));
  assert.doesNotMatch(css, /background: url\(/, 'no decorative artwork layer in the v5 frame');
});

test('v5 countdown source is the exact reviewed successor; drift is denied', () => {
  const file = 'components/ui/health-happy/HealthHappyCountdown.tsx';
  const source = readFileSync(file, 'utf8');
  assert.equal(isWebsiteV5ReviewedSuccessor(file, source), true);
  assertProductionCmsOwner(file, source);
  for (const mutant of [source.replace("placement === 'article'", "placement === 'home'"), source.replace('site.extra.headline', 'site.extra.date'), source + "\nimport { preload } from 'react-dom';\n", source + '\n// unrelated\n']) {
    assert.notEqual(mutant, source);
    assert.throws(() => assertProductionCmsOwner(file, mutant));
  }
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
