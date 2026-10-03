import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../components/layout/website-43/Website43.module.css', import.meta.url), 'utf8');
const selector = '.prose :is(p, li, h2, h3, blockquote) a';
const rule = (suffix = '') => {
  const start = css.indexOf(`${selector}${suffix} {`);
  assert.ok(start >= 0, `missing inline article link rule ${suffix}`);
  return css.slice(start, css.indexOf('}', start));
};
assert.match(rule(), /color: var\(--w43-gold\)/);
assert.match(rule(), /text-decoration: underline/);
assert.match(rule(), /text-underline-offset: 4px/);
assert.match(rule(':hover'), /color: var\(--w43-gold-bright\)/);
assert.match(rule(':focus-visible'), /outline: 2px solid var\(--w43-gold\)/);
assert.match(rule(':focus-visible'), /outline-offset: 3px/);
console.log('PASS article inline links: gold, underline, hover and keyboard focus');
