// Playwright against a local production build, plus actual CMS page renderers with synthetic data.
// Usage: PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node qa/v5-responsive-regression.mjs
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { v5LayoutFixtures } from './v5-layout-fixtures.mjs';
import { loadFixtureModule } from './phase1-fixture-loader.mjs';

const origin = process.env.JOURNEY_ORIGIN || 'http://127.0.0.1:3001';
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname), 'responsive QA requires localhost');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const widths = [320, 360, 390, 430, 600, 768, 834, 1024, 1180, 1280, 1440, 1600];
const routes = ['/', '/blog/', '/about/', '/ci-planning/', '/tools/', '/tools/financial-health-check/', '/play/money-story/', '/tools/investment-allocation/', '/tools/aia-fund-allocation/', ...loadFixtureModule('lib/content/coming-soon.ts').listComingSoonPages('local-uat').map((page) => page.path), '/privacy/', '/cookie-policy/', '/v5-journey-not-found-probe/'];
const output = path.resolve(process.env.JOURNEY_OUTPUT || 'qa/artifacts/c1-responsive-20261026');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
const failures = [];
const inventory = [];
try {
  const context = await browser.newContext();
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    return ['data:', 'blob:'].includes(url.protocol) || url.origin === new URL(origin).origin ? route.continue() : route.abort();
  });
  await context.addInitScript(() => {
    // Stored denial removes the notice during layout measurements; explicit consent states are tested separately.
    localStorage.setItem('ccpun_cookie_consent', JSON.stringify({ status: 'custom', essential: true, performance: false, analytics: false, social: false, timestamp: new Date().toISOString(), expires: Date.now() + 86400000 }));
  });
  const page = await context.newPage();
  await page.goto(origin, { waitUntil: 'networkidle' });
  const baseStyles = await page.locator('link[rel="stylesheet"]').evaluateAll((links) => links.map((link) => link.href));
  const fixtures = await v5LayoutFixtures();
  const cases = [...routes.map((route) => ({ name: route, route })), ...fixtures];
  for (const item of cases) {
    for (const theme of ['light', 'dark']) {
      for (const width of widths) {
        await page.setViewportSize({ width, height: 900 });
        if (item.route) {
          const response = await page.goto(origin + item.route, { waitUntil: 'load' });
          const expected = item.route.includes('not-found-probe') ? 404 : 200;
          if (response.status() !== expected) failures.push(`${item.name}/${theme}/${width}: HTTP ${response.status()}`);
        } else {
          await page.setContent(`<!doctype html><html lang="th"><head><base href="${origin}/">${baseStyles.map((href) => `<link rel="stylesheet" href="${href}">`).join('')}<style>${item.css}</style></head><body>${item.html}</body></html>`, { waitUntil: 'load' });
        }
        await page.evaluate((theme) => document.documentElement.setAttribute('data-theme', theme), theme);
        await page.evaluate(() => document.fonts.ready);
        const evidence = await page.evaluate(() => {
          const visible = (node) => node.getBoundingClientRect().width > 0 && node.getBoundingClientRect().height > 0;
          const cards = [...document.querySelectorAll('article')].filter((node) => node.className.includes('articleCard')).map((card) => {
            const image = card.querySelector('img');
            if (!image) return null;
            const rect = image.getBoundingClientRect();
            const frame = card.getBoundingClientRect();
            const style = getComputedStyle(image);
            return { ratio: rect.width / rect.height, inside: rect.left >= frame.left && rect.right <= frame.right + 1 && rect.top >= frame.top && rect.bottom <= frame.bottom + 1, clip: getComputedStyle(card).overflow, radius: parseFloat(style.borderTopLeftRadius), direction: getComputedStyle(card).flexDirection };
          }).filter(Boolean);
          const controls = [...document.querySelectorAll('a,button,summary,input,select')].filter(visible).map((node) => ({ label: node.getAttribute('aria-label') || node.textContent.trim().replace(/\s+/g, ' ') || node.getAttribute('placeholder') || node.tagName, destination: node.getAttribute('href') || node.getAttribute('aria-controls') || node.tagName.toLowerCase() }));
          const clipped = [...document.querySelectorAll('a,button,summary,h1,h2,h3,p')].filter(visible).filter((node) => node.clientWidth > 0 && node.scrollWidth > node.clientWidth + 2 && !/excerpt|srOnly|sr-only/i.test(node.className)).map((node) => ({ tag: node.tagName, label: node.textContent.trim().slice(0, 70), client: node.clientWidth, scroll: node.scrollWidth }));
          return { documentWidth: document.documentElement.scrollWidth, viewport: innerWidth, main: Boolean(document.querySelector('#main-content')), cards, controls, clipped };
        });
        const label = `${item.name}/${theme}/${width}`;
        if (!evidence.main) failures.push(`${label}: missing main landmark`);
        if (evidence.documentWidth > width + 1) failures.push(`${label}: horizontal overflow ${evidence.documentWidth}`);
        for (const clipped of evidence.clipped) failures.push(`${label}: clipped ${clipped.tag} ${clipped.label} (${clipped.scroll}/${clipped.client})`);
        for (const card of evidence.cards) {
          if (Math.abs(card.ratio - 1200 / 630) > 0.015) failures.push(`${label}: cover distorted/cropped, ratio ${card.ratio}`);
          if (!card.inside || !['hidden', 'clip'].includes(card.clip) || card.radius < 12) failures.push(`${label}: cover is not clipped to the rounded card`);
        }
        results.push({ page: item.name, theme, width, documentWidth: evidence.documentWidth, cardCount: evidence.cards.length });
        if ([390, 1440].includes(width)) {
          inventory.push({ page: item.name, theme, width, controls: evidence.controls, mode: item.route ? 'production build; see separate interaction evidence' : 'synthetic SSR; layout only, no hydration' });
          const name = item.name === '/' ? 'home' : item.name.replaceAll('/', '-').replace(/^-|-$/g, '');
          await page.screenshot({ path: path.join(output, `${name}-${theme}-${width}.png`), fullPage: true });
        }
      }
    }
    console.log(`checked ${item.name}`);
  }
  assert.ok(results.filter((result) => result.page === 'blog-fixture').every((result) => result.cardCount >= 3), 'the fixture exercises actual blog cards');
} finally {
  await browser.close();
  await writeFile(path.join(output, 'responsive-results.json'), JSON.stringify({ results, failures }, null, 2) + '\n');
  await writeFile(path.join(output, 'interactive-inventory.json'), JSON.stringify(inventory, null, 2) + '\n');
}
console.log(`C1 responsive: ${results.length} page/theme/width cases, ${failures.length} failures`);
assert.deepEqual(failures, []);
