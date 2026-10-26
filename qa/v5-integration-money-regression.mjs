// C12 Money Story compiled local browser proof only; launch with the Node loopback fence.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const origin = process.env.MONEY_DOCK_QA_ORIGIN || 'http://127.0.0.1:3032';
assert.equal(new URL(origin).hostname, '127.0.0.1');
const output = path.resolve('qa/artifacts/v5-integration-money-20261027');
await mkdir(output, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [], errors = [], external = [];
async function hiddenDock(page, expected) {
  const dock = page.locator('[data-v5-chat-dock]');
  await page.waitForFunction(expected => document.querySelector('[data-v5-chat-dock]')?.hidden === expected, expected);
  assert.equal(await dock.evaluate(node => node.inert), expected);
  assert.equal(await dock.evaluate(node => node.getAttribute('aria-hidden')), expected ? 'true' : null);
  if (!expected) await dock.waitFor({ state: 'visible' });
  if (expected) {
    assert.equal(await dock.isVisible(), false);
    assert.equal(await dock.evaluate(node => { const previous = document.activeElement; node.querySelector('a').focus(); return node.contains(document.activeElement) && previous !== document.activeElement; }), false, 'hidden dock cannot take focus');
  }
}
try {
  for (const width of [390, 834, 1440]) for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme });
    await context.route('**/*', route => { const url = new URL(route.request().url()); if (url.origin === new URL(origin).origin || ['data:', 'blob:'].includes(url.protocol)) return route.continue(); external.push({ url: url.href, blocked: true }); return route.abort('blockedbyclient'); });
    await context.addInitScript(theme => {
      localStorage.setItem('ccpun_cookie_consent', JSON.stringify({ status: 'custom', essential: true, performance: false, analytics: false, social: false, timestamp: new Date().toISOString(), expires: Date.now() + 86400000 }));
      localStorage.setItem('ccpun-theme', theme);
      window.__dockShifts = [];
      new PerformanceObserver(list => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__dockShifts.push(entry.value); }).observe({ type: 'layout-shift', buffered: true });
    }, theme);
    const page = await context.newPage(); page.on('pageerror', error => errors.push({ width, theme, message: error.message })); page.on('dialog', dialog => dialog.accept());
    await page.goto(origin + '/play/money-story/', { waitUntil: 'networkidle' });
    await page.waitForFunction(theme => document.documentElement.dataset.theme === theme, theme);
    await hiddenDock(page, false);
    const dock = page.locator('[data-v5-chat-dock]');
    assert.equal(await dock.evaluate(node => getComputedStyle(node).position), 'fixed');
    await page.screenshot({ path: path.join(output, `${width}-${theme}-intro.png`), fullPage: true });
    const gameTop = await page.getByRole('heading', { name: 'เลือกชีวิตที่อยากลอง แล้วอยู่กับมัน 12 เดือน', exact: true }).evaluate(node => node.getBoundingClientRect().top + scrollY);
    const beforeHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.getByRole('button', { name: /^แก้ม/ }).click();
    await hiddenDock(page, true);
    // Native hidden acts on a fixed layer; it does not move the game's heading.
    const afterTop = await page.getByRole('heading', { name: 'เลือกชีวิตที่อยากลอง แล้วอยู่กับมัน 12 เดือน', exact: true }).evaluate(node => node.getBoundingClientRect().top + scrollY);
    assert.equal(afterTop, gameTop);
    await page.getByRole('button', { name: 'เริ่มชีวิตที่เลือก', exact: true }).click();
    await hiddenDock(page, true);
    assert.ok(await page.locator('aside').count() >= 2);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await page.screenshot({ path: path.join(output, `${width}-${theme}-playing.png`), fullPage: true });
    // Native field focus must not reveal a dock owned by the real mounted Money Story controller.
    await page.evaluate(() => { const input = document.createElement('input'); input.id='integration-money-field'; document.querySelector('main').append(input); input.focus({preventScroll:true}); });
    await hiddenDock(page, true);
    await page.locator('#integration-money-field').evaluate(el => el.blur());
    await hiddenDock(page, true);
    await page.locator('#integration-money-field').evaluate(el => el.remove());
    // First-month reset returns to the intro without a dialog.
    await page.getByRole('button', { name: 'กลับไปเลือกตัวละคร', exact: true }).click();
    await hiddenDock(page, false);
    await page.getByRole('button', { name: /^แก้ม/ }).click();
    await page.getByRole('button', { name: 'เริ่มชีวิตที่เลือก', exact: true }).click();
    // Execute real engine choices through the rendered UI until its result, never mutate engine state.
    let steps = 0;
    while (await page.getByRole('link', { name: 'เพิ่มเพื่อน LINE เพื่อคุยต่อ', exact: true }).count() === 0 && steps++ < 150) {
      const choices = page.locator('[data-money-choice]');
      const begin = page.getByRole('button', { name: /^เริ่มเดือน / });
      const next = page.getByRole('button', { name: /^(ไปเดือนถัดไป|ดูผล 12 เดือน)$/ });
      const recover = page.locator('button[class*="recoveryChoice"]');
      const danger = page.locator('button[class*="danger"]');
      if (await choices.count()) await choices.first().click();
      else if (await begin.count()) await begin.click();
      else if (await next.count()) await next.click();
      else if (await recover.count()) await recover.first().click();
      else if (await danger.count()) await danger.first().click();
      else throw new Error('No enabled game action at step ' + steps + ': ' + await page.locator('main').innerText());
      await hiddenDock(page, true);
    }
    const resultLine = page.getByRole('link', { name: 'เพิ่มเพื่อน LINE เพื่อคุยต่อ', exact: true });
    await resultLine.waitFor(); assert.equal(await resultLine.isVisible(), true); await hiddenDock(page, true);
    await page.screenshot({ path: path.join(output, `${width}-${theme}-result.png`), fullPage: true });
    await page.getByRole('button', { name: 'เลือกชีวิตใหม่', exact: true }).click(); await hiddenDock(page, false);
    await page.getByRole('button', { name: /^แก้ม/ }).click(); await page.getByRole('button', { name: 'เริ่มชีวิตที่เลือก', exact: true }).click(); await hiddenDock(page, true);
    // Same-origin client navigation unmounts the controller and restores the global dock.
    await page.locator('a[href="/about/"]:visible').last().click(); await page.waitForURL('**/about/'); await hiddenDock(page, false);
    assert.equal(await page.evaluate(() => document.documentElement.hasAttribute('data-money-story-dock-hidden')), false);
    const cls = await page.evaluate(() => window.__dockShifts.reduce((sum, value) => sum + value, 0));
    results.push({ width, theme, introVisible: true, selectionHidden: true, playHidden: true, finalHasSingleLineAction: true, resetRestores: true, unmountRestores: true, typingCannotResurrectMoneyHidden: true, initialHeight: beforeHeight, headingStable: true, cls, gameSteps: steps, pass: true });
    console.log('PASS ' + width + ' ' + theme + ': intro/selection/play/result/reset/unmount');
    await context.close();
  }
  await writeFile(path.join(output, 'evidence.json'), JSON.stringify({ origin, results, errors, external, allExternalBlocked: true }, null, 2) + '\n');
  assert.deepEqual(errors, []); assert.equal(results.length, 6); console.log(JSON.stringify({ cases: results.length, output }, null, 2));
} finally { await browser.close(); }
