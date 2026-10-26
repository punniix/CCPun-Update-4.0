import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { FATHER_STORY_HEADING, FATHER_STORY_PARAGRAPHS, FATHER_STORY_QUESTIONS, FATHER_PHOTO_CAPTION } from '../features/about/father-story-copy.ts';

// Run after an offline local production-lane webpack build and Next start, never against a provider.
const base = process.env.C13_BASE_URL || 'http://127.0.0.1:3033';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'local-only compiled Production guard');
const { chromium } = await import(pathToFileURL(process.env.C13_PLAYWRIGHT || '/Users/punnii/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const output = resolve('qa/artifacts/c13-about-father');
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const denied = [];
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(base).origin || ['data:', 'blob:'].includes(url.protocol)) await route.continue();
    else { denied.push(url.origin); await route.abort(); }
  });
  const page = await context.newPage();
  const response = await page.goto(`${base}/about/`, { waitUntil: 'networkidle' });
  assert.equal(response.status(), 200);
  const html = await response.text();
  writeFileSync(`${output}/compiled-production-about.html`, html);
  const rendered = await page.evaluate(() => ({
    title: document.title,
    heading: document.querySelector('h1')?.textContent,
    canonical: document.querySelector('link[rel="canonical"]')?.href,
    robots: document.querySelector('meta[name="robots"]')?.content,
    text: document.body.textContent,
    storyCount: document.querySelectorAll('[data-uat-trial="about-father-story"]').length,
    fatherFigureCount: document.querySelectorAll('[data-uat-placeholder="about-father-photo"]').length,
    fatherImageCount: [...document.images].filter((image) => `${image.src} ${image.srcset}`.includes('ccpun-father')).length,
    uatPlaceholderCount: document.querySelectorAll('[data-uat-placeholder]').length,
  }));
  assert.ok(rendered.heading?.includes('รู้จัก'), 'actual About page, not an error shell');
  assert.equal(rendered.canonical, 'https://ccpun.com/about/');
  assert.ok(!rendered.robots.includes('noindex') && rendered.robots.includes('index'), 'compiled Production robots branch');
  for (const key of ['storyCount', 'fatherFigureCount', 'fatherImageCount', 'uatPlaceholderCount']) assert.equal(rendered[key], 0, key);
  const texts = [FATHER_STORY_HEADING, ...FATHER_STORY_PARAGRAPHS, ...FATHER_STORY_QUESTIONS, ...FATHER_PHOTO_CAPTION.split('\n')];
  for (const text of texts) {
    assert.ok(!rendered.text.includes(text), `no rendered trial text: ${text}`);
    assert.ok(!html.includes(text), `no trial text in compiled SSR/RSC HTML: ${text}`);
  }
  assert.ok(!html.includes('ccpun-father-v5-colour'), 'no father asset reference in compiled HTML');
  const result = { status: 'PASS', target: `${base}/about/`, buildMode: 'local compiled production configuration; no real Production request', responseStatus: response.status(), ...rendered, text: undefined, excludedTextCount: texts.length, deniedExternalOrigins: [...new Set(denied)] };
  writeFileSync(`${output}/compiled-production-guard.json`, JSON.stringify(result, null, 2));
  console.log(`PASS local compiled Production About: ${texts.length} trial strings + father figure/image absent; all external browser requests denied`);
  await context.close();
} finally { await browser.close(); }
