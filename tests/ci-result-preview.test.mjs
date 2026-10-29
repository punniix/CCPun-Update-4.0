import { ciPreviewSourcePins, ciPreviewSourcePredecessor, ciPreviewLocationsPredecessor } from '../qa/ci-result-preview-successor.mjs';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

// The actual mounted component runs; only image generation and analytics are isolated.
test('CI preview owns the prepared file and revokes stale URLs without changing download/share', async () => {
  const require = createRequire(import.meta.url);
  const { JSDOM } = require('jsdom');
  const { createElement, act } = require('react');
  const rootPath = fileURLToPath(new URL('../', import.meta.url));
  const built = await build({
    entryPoints: [rootPath + 'features/ci-planning/components/ResultImageDownloadButton.tsx'],
    absWorkingDir: rootPath, bundle: true, write: false, outfile: '/private/tmp/ci-preview-check.cjs',
    platform: 'node', format: 'cjs', packages: 'external', jsx: 'automatic', loader: { '.css': 'empty' }, logLevel: 'silent',
    plugins: [{ name: 'local-result-fixture', setup(builder) {
      builder.onResolve({ filter: /^@\/features\/ci-planning\/result-image$/ }, () => ({ path: 'image', namespace: 'fixture' }));
      builder.onResolve({ filter: /^@\/lib\/analytics$/ }, () => ({ path: 'analytics', namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({ contents: path === 'image'
        ? 'export const createCIResultImageSummary=(result,method)=>({result,method});export const renderCIResultImage=(summary)=>globalThis.__ciPreview.render(summary);'
        : 'export const trackEvent=(name,props)=>globalThis.__ciPreview.events.push({name,props});' }));
    } }],
  });
  const compiled = { exports: {} };
  new Function('require', 'module', 'exports', built.outputFiles[0].text)(require, compiled, compiled.exports);
  const Component = compiled.exports.default;
  const dom = new JSDOM('<main><div id="root"></div></main>', { url: 'https://test.ccpun.com/ci-planning/', pretendToBeVisual: true });
  const pending = [], urls = [], revoked = [], downloads = [], shares = [], events = [];
  const browserGlobals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, File: dom.window.File, URL: dom.window.URL,
    DOMException: dom.window.DOMException, IS_REACT_ACT_ENVIRONMENT: true,
    __ciPreview: { events, render: summary => new Promise((resolve, reject) => pending.push({ summary, resolve, reject })) } };
  const originals = new Map(Object.keys(browserGlobals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(browserGlobals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  dom.window.URL.createObjectURL = file => { const url = `blob:ci-fixture-${urls.length}`; urls.push({ url, file }); return url; };
  dom.window.URL.revokeObjectURL = url => revoked.push(url);
  dom.window.navigator.canShare = ({ files }) => files.length === 1;
  dom.window.navigator.share = async ({ files }) => { shares.push(files[0]); };
  dom.window.HTMLAnchorElement.prototype.click = function () { downloads.push({ href: this.href, name: this.download }); };
  // jsdom lacks native dialog behavior: Escape/focus/scroll are checked in the real-browser run.
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  dom.window.HTMLDialogElement.prototype.close = function () { if (this.open) { this.open = false; this.dispatchEvent(new dom.window.Event('close')); } };
  const mounted = require('react-dom/client').createRoot(dom.window.document.getElementById('root'));
  const tick = () => new Promise(resolve => setTimeout(resolve, 0));
  const button = label => [...dom.window.document.querySelectorAll('button')].find(node => node.textContent.includes(label));
  const render = async (result, selectedMethod = 'expense') => { await act(async () => { mounted.render(createElement(Component, { result, selectedMethod })); await tick(); }); };
  const ready = async () => { const task = pending.shift(); assert(task, 'one pending preparation'); await act(async () => { task.resolve(new Blob(['local-png'], { type: 'image/png' })); await tick(); }); return task; };
  let unmounted = false;
  try {
    const resultA = { fixture: 'A' }, resultB = { fixture: 'B' };
    await render(resultA);
    assert.equal(button('ตัวอย่างภาพสรุป').disabled, true);
    assert.equal(button('ตัวอย่างภาพสรุป').getAttribute('aria-busy'), 'true');
    await ready();
    assert.equal(button('ตัวอย่างภาพสรุป').disabled, false);
    await act(async () => { button('ตัวอย่างภาพสรุป').click(); });
    const dialog = dom.window.document.querySelector('dialog');
    assert.equal(dialog.open, true);
    assert.equal(dom.window.document.querySelector('dialog img').src, urls[0].url);
    assert.equal(pending.length, 0, 'preview never starts another renderer');
    await act(async () => { button('ปิดตัวอย่างภาพ').click(); });
    assert.equal(dialog.open, false);
    assert.equal(dom.window.document.querySelector('dialog img'), null);
    assert.deepEqual(revoked, [urls[0].url]);
    await act(async () => { button('บันทึกภาพสรุป').click(); await tick(); });
    assert.equal(urls[1].file, urls[0].file, 'download uses the exact preview File');
    assert.equal(downloads[0].name, urls[0].file.name);
    assert.equal(downloads[0].href, urls[1].url);
    await act(async () => { button('แชร์ภาพผลลัพธ์').click(); await tick(); });
    assert.equal(shares[0], urls[0].file, 'Web Share uses that same File');
    assert.deepEqual(events.map(event => event.name), ['result_image_download']);
    assert.deepEqual(Object.keys(events[0].props).sort(), ['assessment_version', 'cta_location', 'destination', 'tool_name']);
    await act(async () => { button('ตัวอย่างภาพสรุป').click(); });
    const staleUrl = urls.at(-1).url;
    await render(resultB);
    assert.equal(dialog.open, false, 'new result closes an old preview');
    assert.equal(dom.window.document.querySelector('dialog img'), null, 'stale data is not displayed');
    assert(revoked.includes(staleUrl));
    await ready();
    await act(async () => { button('ตัวอย่างภาพสรุป').click(); });
    const methodUrl = urls.at(-1).url;
    await render(resultB, 'income');
    assert.equal(dialog.open, false, 'changing the method closes the old preview');
    assert(revoked.includes(methodUrl));
    const failed = pending.shift();
    await act(async () => { failed.reject(new Error('fixture failure')); await tick(); });
    assert.equal(button('ตัวอย่างภาพสรุป').disabled, true);
    assert.equal(button('ตัวอย่างภาพสรุป').getAttribute('aria-busy'), 'false');
    assert(dom.window.document.getElementById('ci-result-image-status').textContent.includes('ดำเนินการไม่สำเร็จ'));
    await act(async () => { button('บันทึกภาพสรุป').click(); await tick(); });
    await ready();
    assert.equal(downloads.length, 2, 'download fallback remains usable after failed background preparation');
    assert(dom.window.document.getElementById('ci-result-image-status').textContent.includes('เริ่มดาวน์โหลดภาพสรุปแล้ว'), 'A successful download must not keep the old preparation error');
    await render({ fixture: 'C' }); await ready();
    // Leaving immediately after a click must clean up even before React commits preview state.
    let unmountUrl;
    await act(async () => { button('ตัวอย่างภาพสรุป').click(); unmountUrl = urls.at(-1).url; mounted.unmount(); }); unmounted = true;
    assert(revoked.includes(unmountUrl));
  } finally {
    if (!unmounted) await act(async () => { mounted.unmount(); });
    dom.window.close();
    for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});


test('CI preview source and generated copy admissions retain original bytes and reject unknown or partial edits', () => {
  const sha = source => createHash('sha256').update(source).digest('hex');
  for (const [file, pin] of Object.entries(ciPreviewSourcePins)) {
    const source = readFileSync(file, 'utf8');
    assert.equal(sha(source), pin.after);
    const prior = ciPreviewSourcePredecessor(file, source);
    assert.equal(sha(prior), pin.before);
    assert.equal(ciPreviewSourcePredecessor(file, prior), prior);
    const [current, old] = pin.edits[0];
    for (const changed of [source+' ', source.replace(/\S/,'X'), source.replace(current,old), source.replace(current,current+current)]) {
      assert.notEqual(changed, source);
      assert.equal(ciPreviewSourcePredecessor(file, changed), changed);
    }
  }
  assert.equal(ciPreviewSourcePredecessor('unowned.ts','body'),'body');
  const source = readFileSync('lib/content/public-copy-locations.json','utf8');
  const prior = ciPreviewLocationsPredecessor(source);
  assert.notEqual(prior, source);
  assert.equal(Object.keys(JSON.parse(source).ci.entries).length,307);
  assert.equal(Object.keys(JSON.parse(prior).ci.entries).length,305);
  assert.equal(ciPreviewLocationsPredecessor(prior), prior);
  for (const changed of [source+' ',source.replace('ci.download.preview','ci.download.altered')]) assert.equal(ciPreviewLocationsPredecessor(changed),changed);
});
