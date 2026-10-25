import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import React, { act, createElement } from 'react';

const dom = new JSDOM('<div id="root"></div>', { url: 'https://preview.example.test/' });
for (const key of ['window', 'document', 'HTMLElement', 'Element', 'Event', 'MouseEvent', 'localStorage']) {
  Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] });
}
globalThis.React = React;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
window.requestAnimationFrame = (fn) => window.setTimeout(fn, 0);
Element.prototype.scrollIntoView = function () {};
const { createRoot } = await import('react-dom/client');
const require = createRequire(import.meta.url);
const CI = require('../features/ci-planning/components/CIWizard.tsx').default;
const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;

async function fill(id, value) {
  const field = document.getElementById(id);
  assert.ok(field, id);
  await act(async () => {
    setValue.call(field, String(value));
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function click(label) {
  const button = [...document.querySelectorAll('button')].find((el) => el.textContent.trim() === label);
  assert.ok(button, label);
  await act(async () => {
    button.click();
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

test('CI surfaces arithmetic overflow as a focused Thai error instead of crashing', async () => {
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(createElement(CI)));
  try {
    await fill('ci-monthly-income', Number.MAX_SAFE_INTEGER);
    const previewWarning = document.querySelector('#ci-preview-range-warning');
    assert.ok(previewWarning, 'unsafe preview must fail soft instead of crashing during render');
    assert.match(previewWarning.textContent, /สูงเกินช่วง/);

    await click('ถัดไป');
    assert.match(document.activeElement.textContent, /เงินก้อน/);
    await click('ดูผลคำนวณ');

    const alert = document.querySelector('#ci-calculation-error');
    assert.ok(alert, 'calculation range error must be visible');
    assert.match(alert.textContent, /ตัวเลขสูงเกินช่วง/);
    assert.equal(document.querySelector('[data-ui="human-centered-ci-result"]'), null, 'unsafe result must never render');
    assert.equal(document.activeElement.id, 'ci-calculation-error', 'range error should receive focus');
  } finally {
    await act(async () => root.unmount());
  }
});
