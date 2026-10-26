// C12 compiled local app only. Node must preload the loopback fence; every browser external request is aborted.
import assert from 'node:assert/strict';
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
const origin = process.env.QR_QA_ORIGIN || 'http://127.0.0.1:3032';
assert.equal(new URL(origin).hostname, '127.0.0.1');
const output = path.resolve('qa/artifacts/v5-integration-qr-20261027');
await mkdir(output, { recursive: true });
const { chromium, devices } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const chunks = [];
for (const name of await readdir('apps/web/.next/static/chunks')) if (name.endsWith('.js') && (await readFile('apps/web/.next/static/chunks/' + name)).includes(Buffer.from('code length overflow'))) chunks.push(name);
assert.equal(chunks.length, 1);
await new Promise((resolve, reject) => { const server = createServer(); server.once('error', reject); server.listen(9352, '127.0.0.1', () => server.close(resolve)); });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--remote-debugging-port=9352'] });
const owned = await browser.newContext();
const marker = 'data:text/html,c12-owned-' + randomUUID();
await (await owned.newPage()).goto(marker);
const results = [], external = [], errors = [];
const consentValue = (analytics, social = false) => ({ status: 'custom', essential: true, performance: false, analytics, social, timestamp: new Date().toISOString(), expires: Date.now() + 86400000 });
async function fixture({ consent = 'accept', mobile = false, fail = false, delay = false } = {}) {
  const context = await browser.newContext(mobile ? { ...devices['iPhone 13'] } : { viewport: { width: 1440, height: 1000 } });
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let chunkSeen;
  const requested = new Promise(resolve => { chunkSeen = resolve; });
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== new URL(origin).origin && !['data:', 'blob:'].includes(url.protocol)) { external.push({ url: url.href, blocked: true, consent }); return route.abort('blockedbyclient'); }
    if (url.pathname.includes(chunks[0])) { chunkSeen(); if (fail) return route.abort('blockedbyclient'); if (delay) await gate; }
    return route.continue();
  });
  if (consent !== 'unset') await context.addInitScript(value => { try { localStorage.setItem('ccpun_cookie_consent', JSON.stringify(value)); } catch { /* the blocked mobile destination is an opaque browser error document */ } }, consentValue(consent === 'accept', consent === 'social'));
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin, { waitUntil: 'networkidle' });
  const rows = () => page.evaluate(() => (window.dataLayer || []).filter(row => row?.event_name === 'line_chat_qr_view'));
  await page.locator('[data-v5-chat-dock] > a').click();
  const panel = page.locator('#v5-chat-panel'); await panel.waitFor();
  return { page, panel, context, rows, requested, release };
}
async function select(f, index) { await f.panel.locator('[data-chat-topic]').nth(index).click(); await f.panel.locator('svg[role="img"] path').waitFor(); }
try {
  const f = await fixture();
  await select(f, 0); await f.page.waitForTimeout(50);
  let rows = await f.rows(); assert.equal(rows.length, 1);
  assert.equal(rows[0].panel_trigger, 'dock'); assert.equal(rows[0].cta_location, 'chat_panel'); assert.equal(rows[0].page_type, 'home'); assert.equal(rows[0].topic, 'check-existing-policy');
  assert.deepEqual(Object.keys(rows[0]).filter(key => rows[0][key] !== null).sort(), ['analytics_consent', 'cta_location', 'event', 'event_name', 'event_schema_version', 'page_type', 'panel_trigger', 'site_version', 'social_consent', 'topic'].sort());
  await select(f, 0); await select(f, 1); await select(f, 0); await f.page.waitForTimeout(50); assert.equal((await f.rows()).length, 2, 'once per topic per opening');
  assert.equal(await f.page.evaluate(() => (window.dataLayer || []).filter(row => row?.event_name === 'line_oa_click').length), 0, 'QR view is not an outbound click');
  await f.page.keyboard.press('Escape'); await f.panel.waitFor({ state: 'detached' });
  await f.page.locator('[data-v5-chat-dock] > a').click(); await select(f, 0); await f.page.waitForTimeout(50); assert.equal((await f.rows()).length, 3, 'reopening resets dedupe');
  await f.page.screenshot({ path: path.join(output, 'desktop-consented.png') });
  results.push({ name: 'desktop-success-switch-repeat-reopen', count: 3, payload: rows[0], pass: true }); await f.context.close();
  for (const consent of ['unset', 'reject', 'social']) {
    const f = await fixture({ consent }); await select(f, 0); await f.page.waitForTimeout(50); assert.equal((await f.rows()).length, 0);
    await f.page.evaluate(value => { localStorage.setItem('ccpun_cookie_consent', JSON.stringify(value)); window.dispatchEvent(new Event('ccpun:consent')); }, consentValue(true));
    await f.page.waitForTimeout(50); await select(f, 0); assert.equal((await f.rows()).length, 0, 'grant does not replay already rendered topic');
    await select(f, 1); await f.page.waitForTimeout(50); assert.equal((await f.rows()).length, 1, 'new permitted topic counts');
    results.push({ name: consent + '-grant-no-replay', pass: true }); await f.context.close();
  }
  {
    const f = await fixture({ fail: true }); await f.panel.locator('[data-chat-topic]').first().click(); await f.panel.locator('[data-chat-qr-fallback]').waitFor(); assert.equal((await f.rows()).length, 0);
    results.push({ name: 'failed-encoder-no-event', pass: true }); await f.context.close();
  }
  {
    const f = await fixture({ delay: true }); await f.panel.locator('[data-chat-topic]').first().click(); await f.requested; await f.panel.locator('[data-chat-topic]').nth(1).click(); f.release(); await f.panel.locator('svg[role="img"] path').waitFor(); await f.page.waitForTimeout(50);
    const rows = await f.rows(); assert.equal(rows.length, 1); assert.equal(rows[0].topic, 'health-plan'); results.push({ name: 'stale-async-choice-no-event', pass: true }); await f.context.close();
  }
  {
    const f = await fixture({ delay: true }); await f.panel.locator('[data-chat-topic]').first().click(); await f.requested; await f.page.keyboard.press('Escape'); f.release(); await f.panel.waitFor({ state: 'detached' }); await f.page.waitForTimeout(50); assert.equal((await f.rows()).length, 0);
    results.push({ name: 'closing-async-no-event', pass: true }); await f.context.close();
  }
  {
    const f = await fixture({ mobile: true });
    // Keep this fixture document inspectable while exercising the real mobile handler; no LINE navigation is allowed.
    await f.page.evaluate(() => document.addEventListener('click', event => { if (event.target.closest('[data-chat-topic]')) event.preventDefault(); }, { capture: true }));
    assert.equal(await f.panel.locator('svg[role="img"]').count(), 0);
    await f.panel.locator('[data-chat-topic]').first().click(); await f.page.waitForTimeout(100); assert.equal((await f.rows()).length, 0);
    assert.equal(await f.page.evaluate(() => (window.dataLayer || []).filter(row => row?.event_name === 'line_oa_click').length), 1, 'mobile retains outbound LINE meaning');
    results.push({ name: 'mobile-no-qr-event', outboundLineEvent: true, pass: true }); await f.context.close();
  }
  await writeFile(path.join(output, 'evidence.json'), JSON.stringify({origin,results,errors,external,allExternalBlocked:true,consent:'Synthetic stored consent only in owned local contexts; Accept UI never clicked; no provider delivery claim'}, null, 2)+'\n');
  assert.deepEqual(errors, []); assert.equal(results.length,8); console.log(JSON.stringify({qrCases:results.length,result:'PASS',output},null,2));
} finally { await browser.close(); }
