import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
const require = createRequire(import.meta.url);
require('tsx/cjs');
require.extensions['.css'] = module => { module.exports = { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) }; };
const Toc = require('../features/blog/website-43/Website43ArticleToc.tsx').default;

test('native desktop/mobile disclosures retain all H2/H3/H4 anchors without duplicate ARIA targets', () => {
  const groups = [{ primary: { id: 'section-3', label: 'หัวข้อหลัก', level: 2 }, children: [{ id: 'section-25', label: 'หัวข้อย่อย', level: 3 }, { id: 'section-29', label: 'หัวข้อระดับสี่', level: 4 }] }];
  const toc = () => React.createElement(Toc, { groups });
  const doc = new JSDOM(renderToStaticMarkup(React.createElement('div', {}, React.createElement('details', { open: true }, React.createElement('summary', {}, 'หัวข้อเนื้อหา'), toc()), React.createElement('details', {}, React.createElement('summary', {}, 'หัวข้อเนื้อหา'), toc())))).window.document;
  assert.equal(doc.querySelectorAll('details[open]').length, 1, 'desktop/tablet starts expanded, mobile starts collapsed');
  assert.deepEqual([...doc.querySelectorAll('a')].map(a => a.getAttribute('href')), ['#section-3', '#section-25', '#section-29', '#section-3', '#section-25', '#section-29']);
  assert.equal(doc.querySelectorAll('a[data-level="4"]').length, 2);
  const ids = [...doc.querySelectorAll('[id]')].map(node => node.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const control of doc.querySelectorAll('[aria-controls]')) assert.ok(doc.getElementById(control.getAttribute('aria-controls')));
});
