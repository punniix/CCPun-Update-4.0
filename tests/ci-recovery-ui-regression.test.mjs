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
  const button = [...document.querySelectorAll('button')].find((el) => el.textContent.replace(/\s+/g, ' ').trim() === label);
  assert.ok(button, label);
  await act(async () => {
    button.click();
    await new Promise((resolve) => setTimeout(resolve, 5));
  });
}
async function choose(id) {
  const input = document.getElementById(id);
  assert.ok(input, id);
  await act(async () => {
    input.click();
    await new Promise((resolve) => setTimeout(resolve, 5));
  });
}
async function close() {
  await act(async () => root.unmount());
}

test('income-only + basic Recovery defaults to income total and keeps expense method unavailable', async () => {
  await mount();
  try {
    await fill('ci-monthly-income', 50000);
    await choose('ci-recovery-choice-basic');
    await click('ถัดไป');
    await click('ดูผลคำนวณ');

    assert.equal(document.querySelector('.ccpun-calculator-result-amount').textContent.trim(), '3,100,000 บาท');
    assert.match(document.querySelector('.ccpun-calculator-result-title').textContent, /ทุนตามรายได้/);
    assert.equal(document.getElementById('ci-estimation-method-expense'), null);
    assert.equal(document.getElementById('ci-estimation-method-income'), null);
    assert.match(document.getElementById('ci-recovery-result-title').textContent, /เผื่อช่วงพักฟื้น/);
  } finally { await close(); }
});

test('expense-only + basic Recovery defaults to expense total', async () => {
  await mount();
  try {
    await fill('ci-household', 20000);
    await choose('ci-recovery-choice-basic');
    await click('ถัดไป');
    await click('ดูผลคำนวณ');

    assert.equal(document.querySelector('.ccpun-calculator-result-amount').textContent.trim(), '1,300,000 บาท');
    assert.match(document.querySelector('.ccpun-calculator-result-title').textContent, /ทุนตามรายจ่าย/);
    assert.equal(document.getElementById('ci-estimation-method-income'), null);
    assert.match(document.getElementById('ci-recovery-result-title').textContent, /เผื่อช่วงพักฟื้น/);
  } finally { await close(); }
});

test('when both bases exist, both method totals include the same Recovery exactly once', async () => {
  await mount();
  try {
    await fill('ci-monthly-income', 50000);
    await fill('ci-household', 20000);
    await choose('ci-recovery-choice-continued');
    await click('ถัดไป');
    await click('ดูผลคำนวณ');

    assert.equal(document.querySelector('.ccpun-calculator-result-amount').textContent.trim(), '1,700,000 บาท');
    const expense = document.getElementById('ci-estimation-method-expense');
    const income = document.getElementById('ci-estimation-method-income');
    assert.ok(expense);
    assert.ok(income);
    await act(async () => income.click());
    assert.equal(document.querySelector('.ccpun-calculator-result-amount').textContent.trim(), '3,500,000 บาท');
    assert.match(document.getElementById('ci-recovery-result-title').textContent, /ฟื้นฟูต่อเนื่อง/);
  } finally { await close(); }
});

test('custom reserve accepts a headline amount and lets the calculator build editable detail', async () => {
  await mount();
  try {
    await fill('ci-monthly-income', 50000);
    await choose('ci-recovery-choice-custom');
    await fill('ci-recovery-custom-target', 800000);
    await click('จัดตัวอย่างรายการตามยอดนี้');

    assert.equal(document.getElementById('ci-recovery-custom-target').value.replace(/,/g, ''), '800000');
    assert.ok(document.getElementById('ci-recovery-caregiver-days'));
    assert.ok(document.getElementById('ci-recovery-majorHousing'));

    await click('ถัดไป');
    await click('ดูผลคำนวณ');
    assert.equal(document.querySelector('.ccpun-calculator-result-amount').textContent.trim(), '3,800,000 บาท');
    assert.match(document.getElementById('ci-recovery-result-title').textContent, /กำหนดเงินสำรองเอง/);
  } finally { await close(); }
});

test('edit result preserves selected Recovery choice', async () => {
  await mount();
  try {
    await fill('ci-household', 20000);
    await choose('ci-recovery-choice-longTerm');
    await click('ถัดไป');
    await click('ดูผลคำนวณ');
    await click('แก้ไขข้อมูล');

    const selected = document.getElementById('ci-recovery-choice-longTerm');
    assert.ok(selected);
    assert.equal(selected.checked, true);
  } finally { await close(); }
});
