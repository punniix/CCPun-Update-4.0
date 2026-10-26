// Actual local-uat game, fixed test clock/randomness; no engine or production flags are replaced.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const origin = process.env.MONEY_STORY_ORIGIN || 'http://127.0.0.1:3005';
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname), 'Money Story QA requires localhost');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output = path.resolve(process.env.MONEY_STORY_OUTPUT || 'qa/artifacts/c5-money-story-light-20261026');
await mkdir(output, { recursive: true });
const reports = [];
const browser = await chromium.launch({ channel: 'chrome', headless: true });

function contrastAudit(root) {
  const rgba = (value) => {
    const numbers = value.match(/[\d.]+/g)?.map(Number) || [0, 0, 0, 0];
    return [numbers[0], numbers[1], numbers[2], numbers[3] ?? 1];
  };
  const over = (front, back) => [0, 1, 2].map((i) => front[i] * front[3] + back[i] * (1 - front[3])).concat(1);
  const luminance = (color) => color.slice(0, 3).map((channel) => channel / 255).map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4).reduce((sum, channel, i) => sum + channel * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
  if (ratio([255, 255, 255], [0, 0, 0]) !== 21 || ratio([80, 80, 80], [80, 80, 80]) !== 1) throw new Error('Invalid WCAG contrast calculation');
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const rows = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!node.textContent.trim()) continue;
    const element = node.parentElement;
    if (element.closest('script,style,[aria-hidden="true"]')) continue;
    const style = getComputedStyle(element);
    if (style.visibility !== 'visible') continue;
    const range = document.createRange(); range.selectNodeContents(node);
    if (![...range.getClientRects()].some((rect) => rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.left < innerWidth)) continue;
    const ancestors = []; for (let current = element; current; current = current.parentElement) ancestors.unshift(current);
    let backgrounds = [[255, 255, 255, 1]], opacity = 1;
    for (const ancestor of ancestors) {
      const css = getComputedStyle(ancestor);
      opacity *= Number(css.opacity);
      const fill = rgba(css.backgroundColor); fill[3] *= opacity;
      backgrounds = backgrounds.map((background) => over(fill, background));
      const stops = [...css.backgroundImage.matchAll(/rgba?\([^)]*\)/g)].map((match) => rgba(match[0]));
      if (stops.length) backgrounds = backgrounds.flatMap((background) => stops.map((stop) => over([stop[0], stop[1], stop[2], stop[3] * opacity], background)));
    }
    if (opacity === 0) continue;
    const foreground = rgba(style.color); foreground[3] *= opacity;
    const size = parseFloat(style.fontSize);
    const required = size >= 24 || size >= 18.6667 && Number(style.fontWeight) >= 700 ? 3 : 4.5;
    const contrast = Math.min(...backgrounds.map((background) => ratio(over(foreground, background), background)));
    rows.push({ text: node.textContent.trim(), size, contrast, required, disabled: Boolean(element.closest(':disabled,[aria-disabled="true"]')), className: element.className, color: style.color });
  }
  return { rows, overflow: document.documentElement.scrollWidth > innerWidth + 1 };
}

try {
  for (const width of [390, 1440]) for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    await context.route('**/*', (route) => new URL(route.request().url()).origin === new URL(origin).origin ? route.continue() : route.abort());
    await context.addInitScript((theme) => {
      localStorage.setItem('ccpun-theme', theme);
      localStorage.setItem('ccpun_cookie_consent', JSON.stringify({ status: 'custom', essential: true, analytics: false, performance: false, social: false, timestamp: new Date().toISOString(), expires: Date.now() + 86400000 }));
      Math.random = () => 0.5;
    }, theme);
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date('2026-10-26T08:00:00Z'));
    await page.goto(origin + '/play/money-story/', { waitUntil: 'networkidle' });
    await page.evaluate((theme) => document.documentElement.setAttribute('data-theme', theme), theme);
    await page.evaluate(() => document.fonts.ready);
    const root = page.locator('div[class*="MoneyStory_root"]');
    await root.waitFor();
    const capture = async (state) => {
      await root.evaluate(async (node) => {
        await new Promise(requestAnimationFrame);
        await Promise.all(node.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => undefined)));
      });
      const report = await root.evaluate(contrastAudit);
      reports.push({ width, theme, state, ...report });
      await root.screenshot({ path: path.join(output, `${width}-${theme}-${state}.png`) });
    };
    await capture('intro');
    await root.locator('button:has([data-character="win"])').click();
    await capture('character');
    await root.getByRole('button', { name: 'เริ่มชีวิตที่เลือก', exact: true }).click();
    await capture('month-start');
    await root.getByRole('button', { name: 'เริ่มเดือน 1', exact: true }).click();
    await capture('choice');
    let nextMonth = false, result = false;
    for (let step = 0; step < 100; step++) {
      if (await root.locator('[class*="resultSnapshot"]').count()) { await capture('result'); result = true; break; }
      const month = root.getByRole('button', { name: /^เริ่มเดือน / });
      if (await month.count()) {
        if (!nextMonth) { await capture('next-month'); nextMonth = true; }
        await month.click();
      } else if (await root.locator('[data-money-choice]').count()) await root.locator('[data-money-choice]').first().click();
      else if (await root.locator('button[class*="recoveryChoice"]').count()) await root.locator('button[class*="recoveryChoice"]').first().click();
      else if (await root.locator('button[class*="primary"]:not(:disabled)').count()) await root.locator('button[class*="primary"]:not(:disabled)').last().click();
      else throw new Error(`No next game action at ${width}/${theme}/${step}`);
    }
    assert.ok(nextMonth, `${width}/${theme}: reached a following month`);
    assert.ok(result, `${width}/${theme}: reached a real final result`);
    await context.close();
  }
} finally {
  await browser.close();
  await writeFile(path.join(output, 'contrast-results.json'), JSON.stringify(reports, null, 2) + '\n');
}
const failures = reports.flatMap((report) => report.rows.filter((row) => row.contrast < row.required || row.size < 14).map((row) => ({ ...row, width: report.width, theme: report.theme, state: report.state })));
console.log(JSON.stringify({ states: reports.length, checkedTextNodes: reports.reduce((sum, report) => sum + report.rows.length, 0), activeTextFailures: failures.filter((row) => !row.disabled).length, disabledTextNodes: reports.reduce((sum, report) => sum + report.rows.filter((row) => row.disabled).length, 0), failures }, null, 2));
assert.ok(reports.every((report) => !report.overflow), 'no horizontal overflow');
assert.deepEqual(failures, [], 'every visible game text meets the owner contrast requirement and 14px floor, including inactive controls');
