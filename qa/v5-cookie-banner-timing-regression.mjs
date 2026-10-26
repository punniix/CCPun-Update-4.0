// Local compiled-app hydration proof. All nonlocal requests are aborted, including
// attempted provider bootstrap requests, which remain visible in the evidence.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { createServer } from 'node:net';
import { randomUUID } from 'node:crypto';
const origin = process.env.COOKIE_QA_ORIGIN || 'http://127.0.0.1:3019';
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(origin).hostname));
const output = path.resolve(process.env.COOKIE_QA_OUTPUT || 'qa/artifacts/c9-cookie-banner-20261026');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
await mkdir(output, { recursive: true });
await new Promise((resolve, reject) => {
  const probe = createServer();
  probe.once('error', reject);
  probe.listen(9349, '127.0.0.1', () => probe.close(resolve));
});
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--remote-debugging-port=9349'] });
const ownershipContext = await browser.newContext();
const ownershipPage = await ownershipContext.newPage();
const ownershipMarker = `data:text/html,c9-owned-${randomUUID()}`;
await ownershipPage.goto(ownershipMarker);
const results = [], errors = [];
const provider = /google-analytics|googletagmanager|facebook|fbevents/;
try {
  for (const [label, viewport] of [['mobile', { width: 412, height: 823 }], ['desktop', { width: 1440, height: 1000 }]]) {
    for (const choice of ['accept', 'reject']) {
      const context = await browser.newContext({ viewport });
      const requests = [];
      await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.origin === new URL(origin).origin || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
        requests.push({ url: url.href, blocked: true });
        return route.abort('blockedbyclient');
      });
      await context.addInitScript(() => {
        const proof = window.__cookieProof = { reads: [], notices: [] };
        const getItem = Storage.prototype.getItem;
        Storage.prototype.getItem = function (key) {
          const value = getItem.call(this, key);
          if (key === 'ccpun_cookie_consent') proof.reads.push({ time: performance.now(), empty: value === null });
          return value;
        };
        const seen = new WeakSet();
        const observe = () => {
          for (const notice of document.querySelectorAll('[aria-describedby="cookie-desc"]')) {
            if (!seen.has(notice)) { seen.add(notice); proof.notices.push({ time: performance.now(), text: notice.textContent }); }
          }
        };
        new MutationObserver(observe).observe(document, { childList: true, subtree: true });
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push({ label, choice, message: error.message }));
      await page.goto(origin + '/ci-planning/', { waitUntil: 'networkidle' });
      const dialog = page.getByRole('dialog');
      await dialog.waitFor({ state: 'visible' });
      const first = await page.evaluate(() => {
        const proof = window.__cookieProof, notice = proof.notices[0];
        const read = proof.reads.filter(read => read.empty && read.time <= notice.time).at(-1);
        return { deltaMs: notice.time - read.time, noticeCount: proof.notices.length, focused: document.querySelector('[role="dialog"]').contains(document.activeElement), bodyOverflow: document.body.style.overflow };
      });
      assert.ok(first.deltaMs < 250, `post-storage effect visibility took ${first.deltaMs}ms`);
      assert.equal(first.focused, true);
      assert.equal(first.bodyOverflow, 'hidden');
      await page.screenshot({ path: path.join(output, `${label}-${choice}-new-user.png`) });
      const beforeChoice = requests.filter(request => provider.test(request.url));
      if (choice === 'accept') await dialog.getByRole('button', { name: 'ยอมรับคุกกี้ทั้งหมด', exact: true }).click();
      else {
        await dialog.getByRole('button', { name: 'ตั้งค่าคุกกี้', exact: true }).click();
        await dialog.getByRole('button', { name: 'บันทึกการตั้งค่าคุกกี้', exact: true }).click();
      }
      await dialog.waitFor({ state: 'detached' });
      const consent = await page.evaluate(() => JSON.parse(localStorage.getItem('ccpun_cookie_consent')));
      assert.equal(consent.analytics, choice === 'accept');
      assert.equal(consent.social, choice === 'accept');
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
      const reload = await page.evaluate(() => ({ noticeCount: window.__cookieProof.notices.length, dialogs: document.querySelectorAll('[role="dialog"]').length, bodyOverflow: document.body.style.overflow }));
      assert.equal(reload.noticeCount, 0, 'saved preference must never insert a flashing notice');
      assert.equal(reload.dialogs, 0);
      assert.notEqual(reload.bodyOverflow, 'hidden');
      const footer = page.locator('footer').getByRole('button', { name: 'ตั้งค่าคุกกี้', exact: true });
      await footer.click();
      await dialog.waitFor({ state: 'visible' });
      assert.equal(await dialog.evaluate(node => node.contains(document.activeElement)), true);
      results.push({ label, viewport, choice, first, consent: { status: consent.status, analytics: consent.analytics, social: consent.social }, reload, footerReopen: true, preConsentProviderAttempts: beforeChoice, allBlockedExternalAttempts: requests });
      await writeFile(path.join(output, `${label}-${choice}.json`), JSON.stringify(results.at(-1), null, 2) + '\n');
      console.log(`PASS ${label} ${choice}: immediate focus, persisted reload without flash, footer reopen`);
      await context.close();
    }
  }
  // The existing suite clears browser storage: this is a freshly owned browser,
  // never a personal CDP session. Its historical GTM/Consent Mode assertions stand.
  const cdp = await chromium.connectOverCDP('http://127.0.0.1:9349');
  assert.ok(cdp.contexts().some(context => context.pages().some(page => page.url() === ownershipMarker)), 'CDP must be the browser created by this harness');
  await cdp.contexts()[0].route('**/*', route => {
    const url = new URL(route.request().url());
    return url.origin === new URL(origin).origin || ['data:', 'blob:'].includes(url.protocol) ? route.continue() : route.abort('blockedbyclient');
  });
  const tracking = await new Promise(resolve => {
    const child = spawn(process.execPath, ['--import', path.resolve('qa/v5-cookie-banner-timing-network.mjs'), 'qa/tracking-consent-regression.mjs'], {
      env: { PATH: process.env.PATH, CDP_HTTP: 'http://127.0.0.1:9349', TRACKING_BASE_URL: origin, NEXT_PUBLIC_GA_ID: 'G-5BMX2SKJLZ', NEXT_PUBLIC_META_PIXEL_ID: '123456789012345', NEXT_PUBLIC_SEMANTIC_EVENT_LAYER_ENABLED: 'true' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let log = '';
    child.stdout.on('data', data => { log += data; }); child.stderr.on('data', data => { log += data; });
    child.on('close', code => resolve({ code, log }));
  });
  await writeFile(path.join(output, 'tracking-regression.log'), tracking.log);
  const proof = { localOrigin: origin, isolation: 'Node preload permits only loopback HTTP/CDP; browser route interception aborts every nonlocal request; tracking also retains original provider URL blocks.', results, errors, trackingExitCode: tracking.code,
    noPreconsentProviderRequests: results.every(result => result.preConsentProviderAttempts.length === 0),
    limitation: 'GTM bootstrap is attempted under denied Consent Mode before a choice; C9 cannot satisfy zero GA/GTM/Meta requests without changing the protected existing tracking contract. All provider attempts were blocked locally.' };
  await writeFile(path.join(output, 'evidence.json'), JSON.stringify(proof, null, 2) + '\n');
  assert.deepEqual(errors, []);
  assert.equal(tracking.code, 0, 'existing tracking suite failed; see evidence log');
  console.log(JSON.stringify({ cases: results.length, timingFocusReloadFooter: 'PASS', tracking: 'PASS', zeroPreconsentRequests: proof.noPreconsentProviderRequests ? 'PASS' : 'BLOCKED_EXISTING_GTM_CONTRACT', output }, null, 2));
} finally { await browser.close(); }
