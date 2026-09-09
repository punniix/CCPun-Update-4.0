import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { installAccordionMotion } from '../features/website-43-uat/accordionMotion.ts';

function fixture(t, reduced = false) {
  const dom = new JSDOM('<div id="root"><details class="faq"><summary>Question <span>+</span></summary><p>Answer</p></details></div>');
  const previous = { Element: globalThis.Element, HTMLDetailsElement: globalThis.HTMLDetailsElement };
  globalThis.Element = dom.window.Element;
  globalThis.HTMLDetailsElement = dom.window.HTMLDetailsElement;
  const root = dom.window.document.getElementById('root');
  const details = root.querySelector('details');
  const summary = root.querySelector('summary');
  details.getBoundingClientRect = () => ({ height: details.open ? 166 : 66 });
  const animations = [];
  details.animate = (frames, options) => {
    const animation = { frames, options, onfinish: null, oncancel: null, cancel() { this.oncancel?.(); }, finish() { this.onfinish?.(); } };
    animations.push(animation);
    return animation;
  };
  const preference = new dom.window.EventTarget();
  preference.matches = reduced;
  const destroy = installAccordionMotion(root, '.faq', preference);
  t.after(() => { destroy(); Object.assign(globalThis, previous); dom.window.close(); });
  return { details, summary, animations, preference, dom, destroy };
}

test('FAQ opens and closes, then returns to auto height', (t) => {
  const { details, summary, animations } = fixture(t);
  summary.click();
  assert.equal(details.open, true);
  assert.equal(details.dataset.w43AccordionMotion, 'opening');
  assert.equal(animations[0].options.duration, 240);
  animations[0].finish();
  assert.equal(details.style.height, '');
  summary.click();
  assert.equal(details.open, true, 'answer stays present during closing animation');
  animations[1].finish();
  assert.equal(details.open, false);
  assert.equal(details.style.height, '');
  assert.equal(details.style.overflow, '');
});

test('rapid repeated activation reverses safely without stuck height', (t) => {
  const { details, summary, animations } = fixture(t);
  summary.click(); summary.click(); summary.click();
  animations.at(-1).finish();
  assert.equal(details.open, true);
  assert.equal(details.hasAttribute('data-w43-accordion-motion'), false);
  assert.equal(details.style.height, '');
});

test('Reduced Motion preserves native disclosure with no animation', (t) => {
  const { details, summary, animations } = fixture(t, true);
  summary.click();
  assert.equal(details.open, true);
  summary.click();
  assert.equal(details.open, false);
  assert.equal(animations.length, 0);
});

test('changing Reduced Motion mid-animation settles the requested state', (t) => {
  const { details, summary, preference, dom } = fixture(t);
  summary.click(); summary.click();
  preference.matches = true;
  preference.dispatchEvent(new dom.window.Event('change'));
  assert.equal(details.open, false);
  assert.equal(details.style.height, '');
});

test('unmount removes listeners and releases transient styles', (t) => {
  const { details, summary, animations, destroy } = fixture(t);
  summary.click(); destroy();
  assert.equal(details.open, true);
  assert.equal(details.style.height, '');
  summary.click();
  assert.equal(details.open, false);
  assert.equal(animations.length, 1);
});

test('unsupported Web Animations keeps native FAQ behavior', (t) => {
  const { details, summary } = fixture(t);
  details.animate = undefined;
  summary.click(); assert.equal(details.open, true);
  summary.click(); assert.equal(details.open, false);
});

test('nested summary link retains its own action', (t) => {
  const { summary, animations, dom } = fixture(t);
  const link = dom.window.document.createElement('a');
  link.href = '#reference'; summary.append(link); link.click();
  assert.equal(animations.length, 0);
});

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
test('motion is mounted only by noindex UAT layout, never public layout', () => {
  assert.match(read('app/preview/website-4-3/layout.tsx'), /Website43MotionBoundary/);
  assert.match(read('app/preview/website-4-3/layout.tsx'), /index: false, follow: false/);
  assert.doesNotMatch(read('app/layout.tsx'), /Website43MotionBoundary/);
  for (const file of ['features/financial-health-check/components/LifeCoverageWizard.tsx', 'features/ci-planning/components/CIWizard.tsx']) {
    assert.match(read(file), /subtleMotion = false/);
  }
  assert.match(read('app/preview/website-4-3/tools/financial-health-check/page.tsx'), /LifeCoverageWizard subtleMotion/);
  assert.match(read('app/preview/website-4-3/ci-planning/page.tsx'), /CIWizard subtleMotion/);
});
test('enhancement adds no layout boxes or initially hidden content', () => {
  const boundary = read('features/website-43-uat/Website43MotionBoundary.tsx');
  const css = read('features/website-43-uat/Website43Motion.module.css');
  assert.match(css, /display: contents/);
  assert.match(boundary, /reducedMotion="user"/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(css, /opacity:\s*0\s*[;}]/);
  assert.doesNotMatch(boundary, /setInterval|fetch\(|gtag|fbq|localStorage/);
});

test('featured carousel respects Reduce Motion only when preview opts in', () => {
  const blog = read('features/website-43-uat/Website43Blog.tsx');
  assert.match(blog, /subtleMotion = false/);
  assert.match(blog, /reduceMotion \? 'instant' : behavior/);
  assert.match(read('app/preview/website-4-3/blog/page.tsx'), /subtleMotion/);
});
