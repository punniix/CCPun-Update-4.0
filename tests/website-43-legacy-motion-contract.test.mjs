// Run: node tests/website-43-legacy-motion-contract.test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import postcss from 'postcss';

const require = createRequire(import.meta.url);
require('tsx/cjs');
// Only CSS class names are stubbed; render the actual navbar and Next pathname context.
require.extensions['.css'] = module => {
  module.exports = { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) };
};
const { PathnameContext } = require('next/dist/shared/lib/hooks-client-context.shared-runtime');
const { Website43Navbar } = require('../features/website-43-uat/Website43Shared.tsx');
const base = '/preview/website-4-3';
for (const [suffix, currentHref, currentKind, toolsActive] of [
  ['', base, 'page', false],
  ['/', base, 'page', false],
  ['/blog/', `${base}/blog`, 'page', false],
  ['/blog/health-insurance/example/', `${base}/blog`, 'location', false],
  ['/blogger', null, null, false],
  ['/tools/financial-health-check/', null, null, true],
  ['/ci-planning', null, null, true],
  ['/privacy', null, null, false],
]) {
  const html = renderToStaticMarkup(React.createElement(PathnameContext.Provider,
    { value: base + suffix }, React.createElement(Website43Navbar)));
  const document = new JSDOM(html).window.document;
  const current = document.querySelector('nav [aria-current]');
  assert.equal(current?.getAttribute('href') ?? null, currentHref, suffix);
  assert.equal(current?.getAttribute('aria-current') ?? null, currentKind, suffix);
  assert.equal(document.querySelector('.navToolsButton').dataset.active, String(toolsActive), suffix);
}

const css = readFileSync(new URL('../features/website-43-uat/Website43.module.css', import.meta.url), 'utf8');
const parsed = postcss.parse(css);
parsed.walkRules(rule => {
  if (!rule.selector.includes(':hover')) return;
  assert.equal(rule.parent.name, 'media', rule.selector);
  assert.match(rule.parent.params, /\(hover: hover\) and \(pointer: fine\)/);
});
assert(!css.includes('backdrop-filter'), 'Website 4.3 glass must not sample the backdrop');
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
console.log('PASS: 8 actual navbar route renders; hover capability, reduced-motion and static-glass guards');
