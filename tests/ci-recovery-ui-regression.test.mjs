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

let root;
async function mount() {
  document.getElementById('root').replaceChildren();
  root = createRoot(document.getElementById('root'));
  await act(async () => root.render(createElement(CI)));
}
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
    await new Promise((resolve) => setTimeout(resolve, 5));
  });
}
async function close() {
  await act(async () => root.unmount());
}

async function fillRecoveryOneVisit() {
  const details = document.querySelector('[data-ui="ci-recovery-reserve"]');
  assert.ok(details);
  details.open = true;
  await fill('ci-recovery-treatment-visits', 1);
}

test('income-only + Recovery defaults to income total and does not expose an empty expense method', async () => {
  await mount();
  try {
    await fill('ci-monthly-income', 50000);
    await fillRecoveryOneVisit();
    await click('ถัดไป');
    await click('ดูผลคำนวณ');

    assert.equal(document.querySelector('.ccpun-calculator-result-amount').textContent.trim(), '3,002,578 บาท');
    assert.match(document.querySelector('.ccpun-calculator-result-title').textContent, /ทุนตามรายได้/);
    assert.equal(document.getElementById('ci-estimation-method-expense'), null);
    assert.equal(document.getElementById('ci-estimation-method-income'), null, 'single available method should not need a selector');
    assert.match(document.getElementById('ci-recovery-result-title').textContent, /2,578/);
  } finally { await close(); }
});

test('expense-only + Recovery defaults to expense total and does not create an income method', async () => {
  await mount();
  try {
    await fill('ci-household', 20000);
    await fillRecoveryOneVisit();
    await click('ถัดไป');
    await click('ดูผลคำนวณ');

    assert.equal(document.querySelector('.ccpun-calculator-result-amount').textContent.trim(), '1,202,578 บาท');
    assert.match(document.querySelector('.ccpun-calculator-result-title').textContent, /ทุนตามรายจ่าย/);
    assert.equal(document.getElementById('ci-estimation-method-income'), null);
    assert.match(document.getElementById('ci-recovery-result-title').textContent, /2,578/);
  } finally { await close(); }
});

test('when both bases exist, both method totals include the same Recovery exactly once', async () => {
  await mount();
  try {
    await fill('ci-monthly-income', 50000);
    await fill('ci-household', 20000);
    await fillRecoveryOneVisit();
    await click('ถัดไป');
    await click('ดูผลคำนวณ');

    assert.equal(document.querySelector('.ccpun-calculator-result-amount').textContent.trim(), '1,202,578 บาท');
    const expense = document.getElementById('ci-estimation-method-expense');
    const income = document.getElementById('ci-estimation-method-income');
    assert.ok(expense);
    assert.ok(income);
    await act(async () => income.click());
    assert.equal(document.querySelector('.ccpun-calculator-result-amount').textContent.trim(), '3,002,578 บาท');
    assert.match(document.getElementById('ci-recovery-result-title').textContent, /2,578/);
  } finally { await close(); }
});
