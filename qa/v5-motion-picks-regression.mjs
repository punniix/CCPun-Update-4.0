// C8: real local built-Web interactions. No CMS/provider calls or external navigation.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const origin = process.env.C8_ORIGIN || 'http://127.0.0.1:3018';
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname));
const { chromium, devices } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const output = path.resolve('qa/artifacts/c8-motion-20261026');
await mkdir(output, { recursive: true });
const results = [];
async function contextFor(width, theme, reducedMotion = 'no-preference', javaScriptEnabled = true) {
  const context = await browser.newContext({ ...(width === 390 ? devices['iPhone 13'] : {}), viewport: { width, height: width === 390 ? 844 : 1000 }, colorScheme: theme, reducedMotion, javaScriptEnabled });
  await context.route('**/*', route => new URL(route.request().url()).origin === new URL(origin).origin ? route.continue() : route.abort());
  await context.addInitScript(theme => {
    localStorage.setItem('ccpun-theme', theme);
    localStorage.setItem('ccpun_cookie_consent', JSON.stringify({ status: 'custom', essential: true, performance: false, analytics: false, social: false, timestamp: new Date().toISOString(), expires: Date.now() + 86400000 }));
  }, theme);
  return context;
}
async function resultFor(page, tool) {
  await page.goto(origin + (tool === 'ci' ? '/ci-planning/' : '/tools/financial-health-check/'), { waitUntil: 'networkidle' });
  if (tool === 'ci') {
    await page.locator('#ci-monthly-income').fill('50000');
    await page.locator('#ci-household').fill('20000');
    await page.getByRole('button', { name: 'ถัดไป', exact: true }).click();
    await page.getByRole('button', { name: 'ดูผลคำนวณ', exact: true }).click();
  } else {
    await page.locator('#householdMonthly').fill('20000');
    await page.locator('#debt').fill('500000');
    await page.getByRole('button', { name: 'ถัดไป', exact: true }).click();
    await page.locator('#existingLifeCoverage').fill('100000');
    await page.getByRole('button', { name: 'ดูผลการคำนวณ', exact: true }).click();
  }
  await page.locator('[data-v5-result-tick]').waitFor();
}
try {
  for (const width of [390, 1440]) for (const theme of ['light', 'dark']) {
    const context = await contextFor(width, theme);
    const page = await context.newPage();
    await page.goto(origin + '/ci-planning/', { waitUntil: 'networkidle' });
    assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
    const dock = page.locator('[data-v5-chat-dock] > a');
    await dock.click();
    const panel = page.locator('#v5-chat-panel');
    await panel.waitFor();
    await page.waitForTimeout(280);
    await page.screenshot({ path: path.join(output, `after-chat-${width}-${theme}.png`) });
    // The close event releases hit testing and focus synchronously, while the exit is still mounted.
    const exit = await panel.evaluate(node => {
      window.__c8OldPanel = node;
      node.querySelector('button').click();
      const dock = document.querySelector('[data-v5-chat-dock] > a');
      const rect = dock.getBoundingClientRect();
      return { state: node.dataset.chatState, inert: node.inert, pointer: getComputedStyle(node).pointerEvents, backdrop: getComputedStyle(document.querySelector('[data-chat-state].' + node.previousElementSibling.className)).pointerEvents, focused: document.activeElement === dock, hitDock: dock.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)), duration: getComputedStyle(node).animationDuration, frames: node.getAnimations().map(animation => animation.effect.getKeyframes().map(frame => frame.transform)) };
    });
    assert.deepEqual({ state: exit.state, inert: exit.inert, pointer: exit.pointer, backdrop: exit.backdrop, focused: exit.focused, hitDock: exit.hitDock }, { state: 'closing', inert: true, pointer: 'none', backdrop: 'none', focused: true, hitDock: true });
    assert.equal(exit.duration, '0.12s');
    assert.ok(exit.frames.flat().some(transform => transform === `translateY(${width === 390 ? 24 : 8}px)`), JSON.stringify(exit.frames));
    // A real pointer click reaches the dock during or immediately after the exit and creates a fresh instance.
    const bounds = await dock.boundingBox();
    await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await panel.waitFor();
    await page.waitForTimeout(200);
    assert.equal(await panel.evaluate(node => node !== window.__c8OldPanel && node.dataset.chatState === 'open'), true, 'stale timer cannot dismiss a rapid reopen');
    await page.keyboard.press('Escape');
    await panel.waitFor({ state: 'detached' });
    assert.equal(await dock.evaluate(node => document.activeElement === node), true);
    await dock.click(); await panel.waitFor();
    await page.mouse.click(8, 100);
    await panel.waitFor({ state: 'detached' });
    assert.equal(await dock.evaluate(node => document.activeElement === node), true, 'outside click returns focus');
    // Suppress animationend to prove the micro-token fallback unmounts even if animation is cancelled.
    await page.addStyleTag({ content: '[data-chat-state="closing"] { animation: none !important; }' });
    await dock.click(); await panel.waitFor();
    await panel.locator('button').click();
    await panel.waitFor({ state: 'detached' });
    results.push({ type: 'chat', width, theme, exit, rapidReopen: true, escape: true, outside: true, fallback: true });
    await context.close();
  }
  for (const width of [390, 1440]) for (const theme of ['light', 'dark']) for (const reduced of [false, true]) for (const tool of ['ci', 'fhc']) {
    const context = await contextFor(width, theme, reduced ? 'reduce' : 'no-preference');
    const page = await context.newPage();
    await resultFor(page, tool);
    const tick = page.locator('[data-v5-result-tick]');
    assert.equal(await tick.getAttribute('aria-hidden'), 'true');
    assert.equal(await tick.locator('path').getAttribute('pathLength'), '1');
    const motion = await tick.evaluate(node => ({ wrapper: getComputedStyle(node).animationName, stroke: getComputedStyle(node.querySelector('path')).animationName, offset: getComputedStyle(node.querySelector('path')).strokeDashoffset, opacity: getComputedStyle(node).opacity, iterations: getComputedStyle(node.querySelector('path')).animationIterationCount }));
    if (reduced) { assert.equal(motion.wrapper, 'none'); assert.equal(motion.stroke, 'none'); assert.equal(Number.parseFloat(motion.offset), 0); assert.equal(motion.opacity, '1'); }
    else { assert.notEqual(motion.wrapper, 'none'); assert.notEqual(motion.stroke, 'none'); assert.equal(motion.iterations, '1'); }
    await page.waitForTimeout(reduced ? 0 : 450);
    await page.screenshot({ path: path.join(output, `after-${tool}-${width}-${theme}-${reduced ? 'reduced' : 'motion'}.png`) });
    if (reduced && tool === 'ci') {
      const dock = page.locator('[data-v5-chat-dock] > a');
      await dock.scrollIntoViewIfNeeded(); await dock.click();
      const panel = page.locator('#v5-chat-panel'); await panel.waitFor();
      assert.equal(await panel.evaluate(node => getComputedStyle(node).animationName), 'none');
      await page.keyboard.press('Escape'); await panel.waitFor({ state: 'detached' });
      assert.equal(await dock.evaluate(node => document.activeElement === node), true);
    }
    results.push({ type: 'result', tool, width, theme, reduced, motion });
    await context.close();
  }
  for (const width of [390, 1440]) for (const reduced of [false, true]) {
    const context = await contextFor(width, 'light', reduced ? 'reduce' : 'no-preference', false);
    const page = await context.newPage();
    await page.goto(origin + '/ci-planning/', { waitUntil: 'networkidle' });
    const details = page.locator('[aria-labelledby="ci-faq-title"] details').nth(1);
    await details.locator('summary').click();
    assert.equal(await details.getAttribute('open'), '');
    const state = await details.locator('p').first().evaluate(node => ({ name: getComputedStyle(node).animationName, content: node.textContent, duration: getComputedStyle(node).animationDuration }));
    assert.ok(state.content.length > 10);
    if (reduced) assert.equal(state.name, 'none'); else { assert.match(state.name, /v5DetailsReveal/); assert.equal(state.duration, '0.16s'); }
    await page.screenshot({ path: path.join(output, `faq-no-js-${width}-${reduced ? 'reduced' : 'motion'}.png`) });
    await details.locator('summary').click(); assert.equal(await details.getAttribute('open'), null);
    results.push({ type: 'faq', width, javaScriptEnabled: false, reduced, state });
    await context.close();
  }
} finally {
  await browser.close();
  await writeFile(path.join(output, 'results.json'), JSON.stringify({ origin, results }, null, 2) + '\n');
}
console.log(`C8 local built-Web motion: ${results.length} interaction cases PASS`);
