// Local-only C11 acceptance. Set CCPUN_PLAYWRIGHT_MODULE to an installed Playwright entrypoint.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const { chromium } = await import(process.env.CCPUN_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.CCPUN_C11_BASE_URL || 'http://127.0.0.1:3021';
assert.equal(new URL(base).hostname, '127.0.0.1', 'C11 QA only targets the isolated loopback preview');
const out = path.resolve('qa/artifacts/c11-menu-theme');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
const theme = page => page.locator('html').getAttribute('data-theme');
const choice = page => page.locator('html').getAttribute('data-theme-choice');
try {
  for (const width of [390, 834, 1024, 1440]) for (const initial of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, colorScheme: initial });
    await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
    await context.addInitScript(() => {
      // Synthetic essential-only consent keeps the existing notice from making the header inert.
      localStorage.setItem('ccpun_cookie_consent', JSON.stringify({ status: 'custom', essential: true, performance: false, analytics: false, social: false, timestamp: new Date().toISOString(), expires: Date.now() + 86400000 }));
      window.c11FirstPaint = new Promise(resolve => {
        const inspectHeader = () => {
          if (document.querySelector('[data-v5-header]')) resolve({ theme: document.documentElement.dataset.theme, choice: document.documentElement.dataset.themeChoice });
          else requestAnimationFrame(inspectHeader);
        };
        requestAnimationFrame(inspectHeader);
      });
    });
    const page = await context.newPage();
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.querySelector('[data-v5-theme-status]')?.textContent === 'ธีมตามเครื่อง');
    assert.equal(await theme(page), initial);
    assert.equal(await choice(page), 'system');
    await page.screenshot({ path: `${out}/after-${width}-${initial}.png` });
    const header = page.locator('[data-v5-header]');
    assert.ok(await header.evaluate(el => el.scrollWidth <= el.clientWidth), 'header does not overflow');
    const menuButton = page.locator('[data-v5-menu-toggle]');
    if (width < 1024) {
      await menuButton.click();
      const menu = page.locator('#mobile-navigation');
      assert.equal(await menu.locator('li a').count(), 4);
      assert.deepEqual(await menu.locator('li a').evaluateAll(links => links.map(a => a.getAttribute('href'))), ['/', '/blog/', '/tools/', '/about/']);
      assert.equal(await menu.locator('a[aria-current="page"]').count(), 1);
      assert.equal(await menu.locator('a[data-v5-chat-link]').count(), 1);
      const metrics = await menu.evaluate(el => ({ overflow: getComputedStyle(el).overflowY, height: el.clientHeight, scroll: el.scrollHeight, bottom: el.getBoundingClientRect().bottom }));
      assert.ok(!['auto', 'scroll'].includes(metrics.overflow), 'menu has no inner scroll container');
      assert.ok(metrics.scroll <= metrics.height + 1, 'menu content fits panel');
      assert.ok(metrics.bottom <= 844, 'menu fits 844px viewport');
      await page.screenshot({ path: `${out}/after-${width}-${initial}-menu.png` });
      await menu.locator('[data-v5-chat-link]').focus(); await page.keyboard.press('Tab');
      assert.equal(await menuButton.evaluate(el => document.activeElement === el), true, 'Tab wraps to menu control');
      await page.keyboard.press('Shift+Tab');
      assert.equal(await menu.locator('[data-v5-chat-link]').evaluate(el => document.activeElement === el), true, 'Shift+Tab wraps to LINE');
      await page.keyboard.press('Escape'); assert.equal(await menu.isHidden(), true);
      assert.equal(await menuButton.evaluate(el => document.activeElement === el), true);
      await menuButton.click();
      const system = menu.locator('[role="switch"]');
      await system.click(); assert.equal(await choice(page), initial, 'system OFF saves displayed theme');
      assert.equal(await system.getAttribute('aria-checked'), 'false');
      await system.click(); assert.equal(await choice(page), 'system');
      assert.equal(await system.getAttribute('aria-checked'), 'true');
      await page.emulateMedia({ colorScheme: initial === 'light' ? 'dark' : 'light' });
      await page.waitForFunction(expected => document.documentElement.dataset.theme === expected, initial === 'light' ? 'dark' : 'light');
      await system.click(); assert.equal(await choice(page), initial === 'light' ? 'dark' : 'light');
      await page.emulateMedia({ colorScheme: initial });
      assert.equal(await theme(page), initial === 'light' ? 'dark' : 'light', 'explicit choice ignores OS change');
      await menu.locator('a[href="/"]').click(); assert.equal(await menu.isHidden(), true, 'link closes menu');
      if (width < 834) {
        const toggle = page.locator('[data-v5-theme-toggle]');
        for (let i = 0; i < 3; i++) { const before = await theme(page); await toggle.click(); assert.equal(await theme(page), before === 'light' ? 'dark' : 'light'); assert.equal(await choice(page), await theme(page)); }
      }
      // Cancel the shared event in QA to prove the menu uses the dock's existing contract without opening LINE.
      await page.evaluate(() => window.addEventListener('ccpun:open-chat', e => { window.c11Chat = { trigger: e.detail.trigger, returnTo: e.detail.returnTo === null }; e.preventDefault(); }, { once: true }));
      await menuButton.click(); await menu.locator('[data-v5-chat-link]').click();
      assert.deepEqual(await page.evaluate(() => window.c11Chat), { trigger: 'dock', returnTo: true });
      assert.equal(await menu.isHidden(), true);
      const chat = page.locator('[role="dialog"][aria-modal="true"]');
      await chat.waitFor({ state: 'visible' });
      await page.keyboard.press('Escape');
      await chat.waitFor({ state: 'hidden' });
      await page.waitForFunction(() => document.querySelector('[data-v5-chat-dock] a') === document.activeElement);
      assert.equal(await page.locator('[data-v5-chat-dock] a').isVisible(), true, 'chat closes back to the visible dock control');
    }
    if (width >= 834) {
      const group = page.getByRole('radiogroup', { name: 'ธีม' });
      assert.equal(await group.isVisible(), true);
      for (const mode of ['light', 'system', 'dark']) {
        const radio = group.locator(`[data-v5-theme-choice="${mode}"]`); await radio.click();
        assert.equal(await choice(page), mode); assert.equal(await radio.getAttribute('aria-checked'), 'true');
        assert.equal(await group.locator('[tabindex="0"]').count(), 1);
        assert.equal(await group.evaluate(el => getComputedStyle(el, '::before').transitionDuration), '0.16s');
        const box = await radio.boundingBox(); assert.ok(box.width >= 44 && box.height >= 44);
      }
      assert.equal(await group.locator('span').first().isVisible(), width >= 1024, 'tablet is icons-only');
      await group.locator('[data-v5-theme-choice="dark"]').focus(); await page.keyboard.press('ArrowRight'); assert.equal(await choice(page), 'light');
      await page.keyboard.press('ArrowDown'); assert.equal(await choice(page), 'system');
      await page.keyboard.press('ArrowLeft'); assert.equal(await choice(page), 'light');
      await page.keyboard.press('End'); assert.equal(await choice(page), 'dark');
      await page.keyboard.press('Home'); assert.equal(await choice(page), 'light');
      await page.keyboard.press('Space'); assert.equal(await choice(page), 'light');
      await page.keyboard.press('Enter'); assert.equal(await choice(page), 'light');
      if (width >= 1024) {
        const tools = page.locator('[aria-controls="v5-nav-tools"]'); await tools.click();
        await page.locator('#v5-nav-tools').waitFor({ state: 'visible' }); await page.keyboard.press('Escape');
      }
    }
    // Persisted explicit choice and first animation frame must agree, even against the OS preference.
    const saved = initial === 'light' ? 'dark' : 'light';
    await page.evaluate(saved => localStorage.setItem('ccpun-theme', saved), saved);
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await theme(page), saved); assert.equal(await choice(page), saved);
    assert.deepEqual(await page.evaluate(() => window.c11FirstPaint), { theme: saved, choice: saved });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    if (width >= 834) {
      await page.locator('[data-v5-theme-choice="system"]').click();
      assert.equal(await page.locator('[data-v5-theme-group]').evaluate(el => getComputedStyle(el, '::before').transitionDuration), '0s');
    }
    if (width === 390 && initial === 'light') {
      const mobileToggle = page.locator('[data-v5-theme-toggle]');
      await mobileToggle.focus(); await page.setViewportSize({ width: 834, height: 844 });
      await page.waitForFunction(() => document.activeElement?.getAttribute('role') === 'radio');
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForFunction(() => document.activeElement?.hasAttribute('data-v5-theme-toggle'));
      await menuButton.click(); await page.locator('#mobile-navigation a[href="/tools/"]').focus();
      await page.setViewportSize({ width: 1024, height: 844 });
      await page.waitForFunction(() => document.activeElement?.getAttribute('role') === 'radio');
      assert.equal(await page.locator('#mobile-navigation').isHidden(), true);
      await page.locator('[aria-controls="v5-nav-tools"]').focus();
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForFunction(() => document.activeElement?.hasAttribute('data-v5-menu-toggle'));
      await menuButton.click(); await page.locator('#mobile-navigation [data-v5-chat-link]').click();
      await page.locator('#v5-chat-panel').waitFor({ state: 'visible' });
      await page.setViewportSize({ width: 1024, height: 844 }); await page.keyboard.press('Escape');
      await page.locator('#v5-chat-panel').waitFor({ state: 'hidden' });
      await page.waitForFunction(() => document.querySelector('[data-v5-chat-dock] a') === document.activeElement);
      assert.equal(await page.locator('[data-v5-chat-dock] a').isVisible(), true, 'chat resize-close returns to the visible dock');
      await page.setViewportSize({ width: 390, height: 844 });
      await menuButton.click();
      // Opening the existing cookie dialog programmatically reproduces a competing focus owner.
      await page.evaluate(() => window.dispatchEvent(new Event('ccpun:openCookieSettings')));
      const consent = page.locator('[role="dialog"][aria-labelledby^="cookie"]');
      await consent.waitFor({ state: 'visible' });
      await page.waitForFunction(() => document.querySelector('#mobile-navigation').hidden);
      await page.keyboard.press('Tab');
      assert.equal(await consent.evaluate(el => el.contains(document.activeElement)), true, 'menu never steals consent dialog focus');
    }
    results.push({ width, initial, screenshotsActualTheme: initial, menu: width < 1024, radio: width >= 834, persisted: saved, firstPaint: saved, reducedMotion: true });
    await context.close();
  }
  await writeFile(`${out}/browser-results.json`, JSON.stringify({ results, passed: results.length }, null, 2));
  console.log(JSON.stringify({ passed: results.length, results }, null, 2));
} finally { await browser.close(); }
