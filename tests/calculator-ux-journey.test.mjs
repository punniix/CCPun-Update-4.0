import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import React, { act, createElement } from 'react';
import { loadFixtureModule } from '../qa/phase1-fixture-loader.mjs';

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
// Node executes the real calculator components; only their new native CSS boundary is synthetic.
const nativeToolCss = require.resolve('../components/layout/v5/V5Tool.module.css');
const previousCssLoader = require.extensions['.css'];
require.extensions['.css'] = (module, filename) => {
  assert.equal(filename,nativeToolCss,'unexpected stylesheet must not be silently ignored');
  module.exports = {__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})};
};
test.after(()=>{ if(previousCssLoader)require.extensions['.css']=previousCssLoader;else delete require.extensions['.css']; });

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
    assert.equal(document.activeElement.tagName, 'H3');
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
    assert.equal(document.activeElement.tagName, 'H3');
    await click('ถัดไป');
    await click('ดูผลคำนวณ');
    await click('เริ่มใหม่');
    assert.equal(document.getElementById('ci-household').value, '');
  } finally { await close(); }
});


test('result LINE chat restores its true opener after unmount, with removed-target and consent-modal safety',{timeout:10000},async()=>{
  for(const key of ['CustomEvent','MutationObserver','navigator'])Object.defineProperty(globalThis,key,{configurable:true,value:window[key]});
  const previousMatchMedia=window.matchMedia;
  const previousActEnvironment=globalThis.IS_REACT_ACT_ENVIRONMENT;globalThis.IS_REACT_ACT_ENVIRONMENT=false;
  const {flushSync}=require('react-dom');
  const settle=async check=>{const until=Date.now()+1000;while(!check()&&Date.now()<until)await new Promise(resolve=>setTimeout(resolve,5));assert.ok(check(),'real chat transition completes within one second');};
  window.matchMedia=query=>({matches:query.includes('prefers-reduced-motion')||query.includes('pointer: coarse'),media:query,addEventListener(){},removeEventListener(){}});
  window.cancelAnimationFrame=id=>window.clearTimeout(id);
  const mocks=new Map([
    ['./V5ChatDock.module.css',{__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})}],
    ['@/lib/analytics',{trackEvent(){}}],['@/lib/acquisition',{getAttribution:()=>null}],['@/lib/cookie-consent',{getConsentData:()=>null}],
  ]);
  const Dock=loadFixtureModule('components/layout/v5/V5ChatDock.tsx',{mocks}).default;
  const Link=loadFixtureModule('components/layout/v5/V5ChatLink.tsx',{mocks}).default;
  const {LINE_CHAT_DEFAULTS,chatContextForPath,resultChatHref}=loadFixtureModule('lib/line/chat-panel.ts');
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);let cookie,external;
  try{
    flushSync(()=>root.render(createElement(React.Fragment,null,createElement(Link,{href:resultChatHref('fhc'),resultTool:'fhc'},'Result LINE'),createElement(Dock,{config:LINE_CHAT_DEFAULTS,context:chatContextForPath('/tools/financial-health-check/'),fallbackHref:resultChatHref('fhc')}))));
    const opener=host.querySelector('[data-v5-chat-link]');
    for(const scenario of ['inline opener','removed opener','consent modal']){
      flushSync(()=>{
        if(scenario==='removed opener'){
          external=document.createElement('a');external.href=resultChatHref('fhc');external.textContent='Removed result';document.body.append(external);external.focus();
          window.dispatchEvent(new CustomEvent('ccpun:open-chat',{cancelable:true,detail:{trigger:'article_cta',returnTo:external,resultTool:'fhc'}}));
        }else{opener.focus();opener.click();}
      });
      await settle(()=>document.querySelector('#v5-chat-panel')?.contains(document.activeElement));
      const panel=document.querySelector('#v5-chat-panel');assert.ok(panel,scenario+': actual lazy panel mounted');assert.ok(panel.contains(document.activeElement),scenario+': panel owns focus');
      if(scenario==='removed opener')external.remove();
      if(scenario==='consent modal'){
        cookie=document.createElement('div');cookie.setAttribute('role','dialog');cookie.setAttribute('aria-labelledby','cookie-title');cookie.tabIndex=-1;document.body.append(cookie);
      }
      flushSync(()=>window.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
      const expected=scenario==='consent modal'?cookie:scenario==='removed opener'?host.querySelector('[data-v5-chat-dock] a'):opener;
      await settle(()=>!document.querySelector('#v5-chat-panel') && document.activeElement === expected);
      assert.equal(document.querySelector('#v5-chat-panel'),null,scenario+': actual close lifecycle fully unmounts');
      assert.ok(document.activeElement === expected,scenario+': correct connected/top-modal destination; actual='+document.activeElement?.outerHTML.slice(0,250)+' expected='+expected?.outerHTML.slice(0,250));
      cookie?.remove();cookie=null;external?.remove();external=null;
    }
  }finally{cookie?.remove();external?.remove();flushSync(()=>root.unmount());host.remove();window.matchMedia=previousMatchMedia;globalThis.IS_REACT_ACT_ENVIRONMENT=previousActEnvironment;}
});
