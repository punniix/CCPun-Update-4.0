import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { FATHER_STORY_HEADING, FATHER_STORY_PARAGRAPHS, FATHER_STORY_QUESTIONS, FATHER_PHOTO_CAPTION, FATHER_STORY_KEEP } from '../features/about/father-story-copy.ts';

// Existing local Playwright installation; no package install and no external browser requests.
const { chromium } = await import(pathToFileURL(process.env.C13_PLAYWRIGHT || '/Users/punnii/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const base = process.env.C13_BASE_URL || 'http://127.0.0.1:3033';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'local-only target');
const output = resolve('qa/artifacts/c13-about-father');
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
try {
  for (const width of [320, 390, 1279, 1280, 1440]) for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme });
    const denied = [];
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin === new URL(base).origin || ['data:', 'blob:'].includes(url.protocol)) await route.continue();
      else { denied.push(url.origin); await route.abort(); }
    });
    await context.addInitScript((value) => { localStorage.setItem('ccpun-theme', value); }, theme);
    const page = await context.newPage();
    await page.goto(`${base}/about/`, { waitUntil: 'networkidle' });
    await page.waitForFunction((value) => document.documentElement.dataset.theme === value, theme);
    await page.locator('[data-uat-trial="about-father-story"]').scrollIntoViewIfNeeded();
    await page.evaluate(() => document.fonts.ready);
    const result = await page.evaluate(() => {
      const story = document.querySelector('[data-uat-trial="about-father-story"]');
      const caption = story.querySelector('figcaption');
      const figure = story.querySelector('figure');
      const first = story.querySelector(':scope > p');
      const body = story.querySelector(':scope > div');
      const bounds = (node) => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
      const rgba = (value) => { const m = value.match(/[\d.]+/g).map(Number); return [...m.slice(0, 3), m[3] ?? 1]; };
      const composite = (fg, bg) => { const a = fg[3] + bg[3] * (1 - fg[3]); return [...fg.slice(0, 3).map((v, i) => (v * fg[3] + bg[i] * bg[3] * (1 - fg[3])) / a), a]; };
      let bg = [255, 255, 255, 1];
      const ancestors = []; for (let n = caption; n; n = n.parentElement) ancestors.push(n);
      for (const node of ancestors.reverse()) bg = composite(rgba(getComputedStyle(node).backgroundColor), bg);
      const computed = getComputedStyle(caption), fg = composite(rgba(computed.color), bg);
      const luminance = (color) => color.slice(0, 3).map((v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
      const values = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
      const phrase = story.querySelector('[class*="fatherPhrase"]');
      const terms = [...phrase.children].map(node => ({ text: node.textContent, ...bounds(node) }));
      const keeps = [...story.querySelectorAll('[class*="keep"]')].map((node) => ({ text: node.textContent, caption: !!node.closest('figcaption'), whiteSpace: getComputedStyle(node).whiteSpace, ...bounds(node) }));
      return { theme: document.documentElement.dataset.theme, heading: story.querySelector('h3').textContent, paragraphText: [...story.querySelectorAll('p')].map((node) => node.textContent), questionText: [...story.querySelectorAll('ul > li')].map((node) => node.textContent), captionColor: computed.color, background: bg, contrast: (values[0] + .05) / (values[1] + .05), font: computed.fontFamily, captionText: caption.innerText, captionBreaks: caption.querySelectorAll('br').length, story: bounds(story), figure: bounds(figure), first: bounds(first), body: bounds(body), children: [...story.children].map((node) => node.tagName), bodyChildren: [...body.children].map((node) => node.tagName), paragraphs: story.querySelectorAll('p').length, questions: story.querySelectorAll('ul > li').length, imageLoaded: figure.querySelector('img').complete && figure.querySelector('img').naturalWidth > 0, keeps, phraseText: phrase.textContent, terms, overflow: document.documentElement.scrollWidth > innerWidth, robots: document.querySelector('meta[name="robots"]')?.content };
    });
    assert.equal(result.theme, theme);
    assert.equal(result.heading, FATHER_STORY_HEADING);
    assert.deepEqual(result.paragraphText, [...FATHER_STORY_PARAGRAPHS]);
    assert.deepEqual(result.questionText, [...FATHER_STORY_QUESTIONS]);
    assert.equal(result.captionText, FATHER_PHOTO_CAPTION);
    assert.ok(result.contrast >= 4.5, JSON.stringify(result));
    assert.deepEqual(result.children, ['H3', 'P', 'FIGURE', 'DIV']);
    assert.deepEqual(result.bodyChildren, ['P', 'P', 'P', 'P', 'P', 'UL', 'P']);
    assert.equal(result.paragraphs, 7); assert.equal(result.questions, 3);
    assert.equal(result.captionBreaks, 1); assert.equal(result.imageLoaded, true);
    assert.ok(result.robots.includes('noindex'));
    assert.equal(result.overflow, false, 'no horizontal overflow');
    assert.equal(result.keeps.length, 4);
    assert.equal(result.phraseText, FATHER_STORY_KEEP);
    assert.deepEqual(result.terms.map(term => term.text), FATHER_STORY_KEEP.split(' '));
    assert.deepEqual(result.keeps.filter(phrase => phrase.caption).map(phrase => phrase.text), [FATHER_STORY_KEEP]);
    for (const term of result.terms) assert.ok(term.x >= result.first.x - 1 && term.right <= result.first.right + 1, 'a complete term fits the reading column');
    for (const phrase of result.keeps) { assert.equal(phrase.whiteSpace, 'nowrap'); assert.ok(phrase.x >= 0 && phrase.right <= width, 'kept phrase fits viewport'); }
    if (width < 1280) { assert.ok(result.figure.y >= result.first.bottom - 1); assert.ok(result.body.y >= result.figure.bottom - 1); }
    else { assert.ok(result.first.right <= result.figure.x - 63, 'Native text-left/photo-right gap'); assert.ok(Math.abs((result.figure.x - result.first.right) - 64) < 2, 'Native 64px gap'); assert.ok(Math.abs(result.first.width / result.figure.width - 5 / 3) < .02, 'Native 760:456 columns'); assert.ok(Math.abs(result.figure.y - result.story.y - 20) < 2, 'Native 20px story inset'); assert.ok(result.body.right <= result.figure.x - 63, 'Story body stays in the left text column'); }
    // Verify actual data-theme again immediately before each screenshot.
    assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
    await page.screenshot({ path: `${output}/about-${width}-${theme}.png`, fullPage: true });
    await page.locator('[data-uat-trial="about-father-story"] figcaption').scrollIntoViewIfNeeded();
    assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
    await page.screenshot({ path: `${output}/caption-${width}-${theme}.png` });
    results.push({ width, theme, ...result, deniedExternalOrigins: [...new Set(denied)] });
    console.log(`PASS ${width} ${theme}: caption contrast ${result.contrast.toFixed(3)}:1`);
    await context.close();
  }
} finally { await browser.close(); writeFileSync(`${output}/browser-results.json`, JSON.stringify(results, null, 2)); }
