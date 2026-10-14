import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';

const navCss = readFileSync('components/layout/website-43/Website43Navbar.module.css', 'utf8');
const shellCss = readFileSync('components/layout/website-43/Website43.module.css', 'utf8');
const navSource = readFileSync('components/layout/website-43/Website43Navbar.tsx', 'utf8');
const sheet = postcss.parse(navCss);
function rule(selector) {
  let found;
  sheet.walkRules(r => { if (r.selector === selector) found = r; });
  assert.ok(found, 'missing ' + selector);
  return Object.fromEntries(found.nodes.filter(n => n.type === 'decl').map(n => [n.prop, n.value]));
}
test('mobile Tools button matches main nav link typography despite global button font shorthand', () => {
  assert.match(shellCss, /\.root button, \.root input, \.root select \{ font: inherit; \}/);
  const links = rule('.mobileMenu a');
  const button = rule('.mobileMenu .mobileTools > button');
  assert.equal(links['font-size'], '14px');
  assert.equal(links['font-weight'], '600');
  assert.equal(button['font-size'], links['font-size']);
  assert.equal(button['font-weight'], links['font-weight']);
  assert.equal(button['min-height'], links['min-height']);
  assert.equal(button['padding'], links['padding']);
  assert.equal(button['color'], 'var(--w43-ink)');
  assert.match(navSource, /<span>เครื่องมือ<\/span>.*styles\.navChevron/);
  assert.match(navSource, /aria-expanded=\{mobileToolsOpen\}/);
  assert.match(navSource, /setMobileToolsOpen\(\(v\) => !v\)/);
});
