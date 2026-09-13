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
const FHC = require('../features/financial-health-check/components/LifeCoverageWizard.tsx').default;
const CI = require('../features/ci-planning/components/CIWizard.tsx').default;
const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
let root;
async function mount(Component) {
  root = createRoot(document.getElementById('root'));
  await act(async () => root.render(createElement(Component)));
}
async function fill(id, value) {
  const field = document.getElementById(id);
  assert.ok(field, id);
  await act(async () => { setValue.call(field, String(value)); field.dispatchEvent(new Event('input', { bubbles: true })); });
}
async function click(label) {
  const button = [...document.querySelectorAll('button')].find(el => el.textContent.trim() === label);
  assert.ok(button, label);
  await act(async () => { button.click(); await new Promise(resolve => setTimeout(resolve, 5)); });
}
async function close() { await act(async () => root.unmount()); }

test('FHC required error, next/back retention, zero resources, result focus, edit and reset', async () => {
  await mount(FHC);
  try {
    await click('ถัดไป');
    assert.equal(document.activeElement.id, 'householdMonthly');
    assert.equal(document.getElementById('householdMonthly').getAttribute('aria-invalid'), 'true');
    await fill('householdMonthly', 30000);
    await fill('debt', 200000);
    await click('ถัดไป');
    assert.equal(document.activeElement.tagName, 'H3');
    assert.match(document.activeElement.textContent, /ทรัพยากร/);
    await click('ย้อนกลับ');
    assert.equal(document.getElementById('householdMonthly').value, '30,000');
    await click('ถัดไป');
    await click('ดูผลการคำนวณ');
    assert.equal(document.activeElement.id, 'life-result-title');
    assert.match(document.activeElement.textContent, /3,800,000/);
    await click('แก้ไขข้อมูล');
    assert.equal(document.activeElement.tagName, 'H3');
    await click('ดูผลการคำนวณ');
    await click('เริ่มใหม่');
    assert.equal(document.getElementById('householdMonthly').value, '');
    assert.equal(document.activeElement.tagName, 'H3');
  } finally { await close(); }
});

test('CI errors, dependent field limits, preserved inputs, zero coverage, method radio, edit and reset', async () => {
  await mount(CI);
  try {
    await click('ถัดไป');
    assert.equal(document.activeElement.getAttribute('role'), 'alert');
    await fill('ci-monthly-income', 50000);
    await fill('ci-household', 30000);
    await fill('ci-mortgage-payment', 15000);
    await fill('ci-mortgage-installments', 601);
    await click('ถัดไป');
    assert.match(document.activeElement.textContent, /600/);
    await fill('ci-mortgage-installments', 60);
    await click('เพิ่มบุตร');
    await click('ถัดไป');
    assert.ok(document.querySelector('[role="alert"]'));
    await fill('ci-education-0-annual-cost', 60000);
    await fill('ci-education-0-years', 31);
    await click('ถัดไป');
    assert.match(document.activeElement.textContent, /30/);
    await fill('ci-education-0-years', 3);
    await click('ถัดไป');
    assert.equal(document.activeElement.tagName, 'H2');
    assert.match(document.activeElement.textContent, /เงินก้อน/);
    await click('ย้อนกลับ');
    assert.equal(document.getElementById('ci-household').value, '30,000');
    await click('ถัดไป');
    await click('ดูผลคำนวณ');
    assert.equal(document.querySelector('output').textContent.trim(), '2,880,000 บาท');
    assert.equal(document.activeElement.tagName, 'H2');
    await act(async () => document.getElementById('ci-estimation-method-income').click());
    assert.equal(document.querySelector('output').textContent.trim(), '3,000,000 บาท');
    await click('แก้ไขข้อมูล');
    assert.equal(document.getElementById('ci-household').value, '30,000');
    assert.equal(document.activeElement.tagName, 'H2');
    await click('ถัดไป');
    await click('ดูผลคำนวณ');
    await click('เริ่มใหม่');
    assert.equal(document.getElementById('ci-household').value, '');
  } finally { await close(); }
});
