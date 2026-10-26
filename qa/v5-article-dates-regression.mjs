// Actual compiled local page, with the separate offline transport preloads on its server.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const origin = 'http://127.0.0.1:3034';
const path = '/blog/personal-finance/c14-local-fixture/';
const output = new URL('./artifacts/c14-article-dates-20261026/', import.meta.url);
await mkdir(output, { recursive: true });
const response = await fetch(origin + path);
assert.equal(response.status, 200);
const html = await response.text();
const document = new JSDOM(html).window.document;
const schemas = [...document.querySelectorAll('script[type="application/ld+json"]')].map(node => JSON.parse(node.textContent));
const nodes = schemas.flatMap(schema => schema['@graph'] ?? [schema]);
const posting = nodes.find(node => node['@type'] === 'BlogPosting');
assert.ok(posting);
assert.equal(posting.dateModified, '2026-10-03T00:00:00Z');
assert.equal(posting.datePublished, '2026-10-01T00:00:00Z');
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-background-networking', '--disable-component-update', '--disable-sync', '--no-first-run'] });
const results = [];
try {
  for (const width of [390, 1440]) for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme, reducedMotion: 'reduce' });
    const denied = [];
    await context.route('**/*', route => {
      if (new URL(route.request().url()).origin === origin) return route.continue();
      denied.push(new URL(route.request().url()).origin);
      return route.abort();
    });
    await context.addInitScript(value => {
      localStorage.setItem('ccpun-theme', value);
      localStorage.setItem('ccpun_cookie_consent', JSON.stringify({ status: 'custom', essential: true, performance: false, analytics: false, social: false, timestamp: new Date().toISOString(), expires: Date.now() + 86400000 }));
    }, theme);
    const page = await context.newPage();
    assert.equal((await page.goto(origin + path)).status(), 200);
    await page.locator('h1').waitFor();
    await page.waitForFunction(value => document.documentElement.dataset.theme === value, theme);
    await page.evaluate(() => document.fonts.ready);
    const data = await page.evaluate(() => {
      const header = document.querySelector('main header');
      const times = [...header.querySelectorAll('time')].map(time => ({ raw: time.dateTime, text: time.textContent, label: time.parentElement.textContent, box: time.parentElement.getBoundingClientRect().toJSON(), scrollWidth: time.parentElement.scrollWidth, clientWidth: time.parentElement.clientWidth }));
      const about = [...document.querySelectorAll('header a[href="/about/"],footer a[href="/about/"]')].map(link => ({ text: link.textContent, href: link.getAttribute('href') }));
      return { theme: document.documentElement.dataset.theme, width: innerWidth, pageWidth: document.documentElement.scrollWidth, times, about };
    });
    assert.equal(data.theme, theme);
    assert.equal(data.pageWidth, width);
    assert.equal(data.times.length, 2);
    assert.equal(data.times[0].raw, posting.datePublished);
    assert.equal(data.times[1].raw, posting.dateModified);
    assert.equal(data.times[0].text, '1 ตุลาคม 2569');
    assert.equal(data.times[1].text, '3 ตุลาคม 2569');
    assert.equal(data.times[1].label, 'อัปเดต 3 ตุลาคม 2569');
    assert.equal(data.about.length, 3);
    assert.ok(data.about.every(link => link.text === 'รู้จักปั้น' && link.href === '/about/'));
    assert.ok(data.times.every(time => time.scrollWidth <= time.clientWidth));
    if (width === 390) {
      assert.ok(data.times[1].box.top >= data.times[0].box.bottom, 'phone stacks dates in complete lines');
      await page.locator('[data-v5-menu-toggle]').click();
      await page.locator('#mobile-navigation a[href="/about/"]').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#mobile-navigation a[href="/about/"]').textContent(), 'รู้จักปั้น');
      await page.locator('[data-v5-menu-toggle]').click();
    }
    const screenshot = `${width}-${theme}.png`;
    await page.screenshot({ path: fileURLToPath(new URL(screenshot, output)), fullPage: false });
    results.push({ ...data, deniedExternalOrigins: [...new Set(denied)], screenshot });
    await context.close();
  }
} finally { await browser.close(); }
await writeFile(new URL('results.json', output), JSON.stringify({ syntheticLocalOnly: true, path, posting, results }, null, 2));
console.log(`PASS C14 compiled Article HTTP200, raw dates equal real JSON-LD, 4 verified themes/screenshots, 390px stacked dates, all About labels/URLs, zero page overflow`);
