import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Run after a Web build, using an already-installed Playwright package and browser; never installs tools.
// node qa/v5-countdown-full-details.mjs <runtime/package.json> <browser executable> [result.json]
const root = fileURLToPath(new URL('../', import.meta.url));
const [browserPackage, executablePath, output = '/private/tmp/v5-countdown-composed-20261029.json'] = process.argv.slice(2);
assert.ok(browserPackage && executablePath, 'Provide the existing Playwright package.json and browser executable');
const require = createRequire(new URL('../package.json', import.meta.url));
const { buildSync } = require('esbuild');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { chromium } = createRequire(path.resolve(browserPackage))('playwright');
const built = buildSync({
  stdin: { contents: `import Countdown from './components/layout/v5/V5HealthHappyCountdown';
import Dock from './components/layout/v5/V5ChatDock';
import styles from './components/ui/health-happy/HealthHappyCountdown.module.css';
import shell from './components/layout/v5/V5.module.css';
import home from './features/home/v5/V5Home.module.css';
import blog from './features/blog/v5/V5Blog.module.css';
export {Countdown,Dock,styles,shell,home,blog};`, resolveDir: root, loader: 'tsx' },
  bundle: true, write: false, outfile: '/private/tmp/v5-countdown-composed.cjs', platform: 'node',
  format: 'cjs', packages: 'external', jsx: 'automatic', logLevel: 'silent',
});
const fixture = { exports: {} };
new Function('require', 'module', 'exports', built.outputFiles.find(file => file.path.endsWith('.cjs')).text)(require, fixture, fixture.exports);
const { Countdown, Dock, styles, shell, home, blog } = fixture.exports;
const css = built.outputFiles.find(file => file.path.endsWith('.css')).text;
const cssDirectory = path.join(root, 'apps/web/.next/static/css');
const fontFaces = readdirSync(cssDirectory).filter(file => file.endsWith('.css')).flatMap(file =>
  [...readFileSync(path.join(cssDirectory, file), 'utf8').matchAll(/@font-face\{[^}]*\}/g)].map(match => match[0])
).filter(face => /font-family:Kanit;/.test(face) && /font-weight:(400|500);/.test(face));
assert.ok(fontFaces.length >= 2, 'Use the existing Web build Kanit fonts, not an unverified fallback');
const fontCss = [...new Set(fontFaces)].join('\n').replace(/url\(\/_next\/static\/media\/([^/)]+)\)/g, (_, name) =>
  `url(data:font/ttf;base64,${readFileSync(path.join(root, 'apps/web/.next/static/media', name)).toString('base64')})`);
const rows = [], failures = [];
const browser = await chromium.launch({ headless: true, executablePath });
try {
  for (const placement of ['home', 'blog', 'article']) for (const theme of ['light', 'dark']) for (const width of [320, 360, 390, 430, 768, 820, 1024, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    await page.route('**/*', route => route.abort());
    const countdown = React.createElement(Countdown, { placement, ...(placement === 'article' ? { className: blog.countdownSlot } : {}) });
    const widget = placement === 'home' ? React.createElement('div', { className: home.countdownFrame }, countdown) : countdown;
    const dock = React.createElement(Dock, { config: { enabled: true, topics: [], placements: [], campaigns: [] }, context: { pageGroup: placement === 'home' ? 'home' : 'blog' }, fallbackHref: 'https://lin.ee/tqLCs4f' });
    const markup = renderToStaticMarkup(React.createElement(React.Fragment, null, widget, dock));
    await page.setContent(`<html data-theme="${theme}"><style>*{box-sizing:border-box}body{margin:0}html{--font-kanit:Kanit;--font-kanit-critical:Kanit}${fontCss}${css}</style><body class="${shell.root}"><header data-v5-header=""></header><main><div style="height:1200px"></div>${markup}<div style="height:1500px"></div></main></body></html>`);
    await page.evaluate(() => document.fonts.ready);
    const result = await page.evaluate(({ styles }) => {
      const visible = element => { const style = getComputedStyle(element), box = element.getBoundingClientRect(); return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0 && box.width > 0 && box.height > 0; };
      const fields = ['brandAia', 'brandName', 'headline', 'date', 'timeLabel', 'primaryButton', 'outlineButton'].flatMap(key => [...document.querySelectorAll('.' + styles[key])].map(element => ({ key, text: element.textContent, visible: visible(element), font: getComputedStyle(element).fontFamily, size: parseFloat(getComputedStyle(element).fontSize), overflow: element.scrollWidth > element.clientWidth + 1 })));
      const slot = document.querySelector('[data-v5-countdown-slot]');
      const frame = slot.querySelector('.' + styles.frame).getBoundingClientRect();
      const tiles = [...slot.querySelectorAll('.' + styles.digit)].map(element => { const box = element.getBoundingClientRect(); return { left: box.left, right: box.right, top: box.top, bottom: box.bottom }; });
      const tileOverlap = tiles.some((a, index) => tiles.slice(index + 1).some(b => Math.min(a.right, b.right) > Math.max(a.left, b.left) + .5 && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top) + .5));
      const tileOverflow = tiles.some(box => box.left < frame.left - 1 || box.right > frame.right + 1);
      const digitFontSizes = [...slot.querySelectorAll('.' + styles.digit)].map(element => parseFloat(getComputedStyle(element).fontSize));
      const digitCenters = tiles.map(box => (box.top + box.bottom) / 2);
      const unitCenters = [...slot.querySelectorAll('.' + styles.timeUnit)].map(element => { const box = element.getBoundingClientRect(); return (box.top + box.bottom) / 2; });
      const oneRowDigits = Math.max(...digitCenters) - Math.min(...digitCenters) <= 1;
      const oneRowUnits = unitCenters.length === 4 && Math.max(...unitCenters) - Math.min(...unitCenters) <= 1;
      const actions = [...slot.querySelectorAll('a')].map(element => ({ text: element.textContent, href: element.getAttribute('href'), visible: visible(element) }));
      return { fields, actions, tileOverlap, tileOverflow, oneRowDigits, oneRowUnits, digitFontSizes, tileBoxes: tiles, tiles: slot.querySelectorAll('.' + styles.digit).length, units: slot.querySelectorAll('.' + styles.timeLabel).length, overflow: document.documentElement.scrollWidth > innerWidth + 1 };
    }, { styles });
    const coveredActions = [];
    for (let index = 0; index < 2; index++) {
      await page.evaluate(index => {
        const action = document.querySelectorAll('[data-v5-countdown-slot] a')[index], dock = document.querySelector('[data-v5-chat-dock] a');
        const a = action.getBoundingClientRect(), d = dock.getBoundingClientRect();
        scrollTo(0, scrollY + a.top + a.height / 2 - d.top - d.height / 2);
      }, index);
      const covered = await page.evaluate(index => {
        const action = document.querySelectorAll('[data-v5-countdown-slot] a')[index], box = action.getBoundingClientRect(), y = box.top + box.height / 2;
        return [box.left + 2, box.left + box.width / 4, box.left + box.width / 2, box.left + box.width * .75, box.right - 2].filter(x => x >= 0 && x < innerWidth).some(x => document.elementsFromPoint(x, y)[0]?.closest('[data-v5-chat-dock]'));
      }, index);
      if (covered) coveredActions.push(index);
    }
    const expiry = await page.evaluate(() => {
      document.documentElement.setAttribute('data-v5-countdown-ended', '');
      const slot = document.querySelector('[data-v5-countdown-slot]');
      const hidden = getComputedStyle(slot).display === 'none' && slot.getBoundingClientRect().height === 0;
      document.documentElement.removeAttribute('data-v5-countdown-ended');
      return hidden;
    });
    const negative = await page.evaluate(slotClass => {
      const style = document.createElement('style');
      style.textContent = `.${slotClass} [data-campaign-action="line"]{display:none}`;
      document.head.append(style);
      const hidden = getComputedStyle(document.querySelector('[data-campaign-action="line"]')).display === 'none';
      style.remove();
      return hidden;
    }, shell.countdownSlot);
    const pass = result.fields.length === 10 && result.fields.every(field => field.visible && field.size >= 14 && !field.overflow) && result.tiles === 8 && result.units === 4 && result.actions.length === 2 && result.actions.every(action => action.visible) && !result.overflow && !result.tileOverlap && !result.tileOverflow && result.oneRowDigits && result.oneRowUnits && result.digitFontSizes.every(size => size >= 18) && coveredActions.length === 0 && expiry && negative;
    const row = { placement, theme, width, pass, ...result, coveredActions, expiry, negative };
    rows.push(row); if (!pass) failures.push(row);
    await page.close();
  }
} finally { await browser.close(); }
writeFileSync(output, JSON.stringify({ target: 'Actual candidate slot + legacy bridge + widget + fixed dock + compiled CSS + existing Kanit fonts; no deployed-page substitution', cases: rows.length, passed: rows.length - failures.length, failed: failures.length, rows }, null, 2) + '\n');
console.log(JSON.stringify({ cases: rows.length, passed: rows.length - failures.length, failed: failures.map(({ placement, theme, width, coveredActions }) => ({ placement, theme, width, coveredActions })), output }));
assert.equal(failures.length, 0, 'Full composed countdown content and both actions must remain visible, uncovered and unclipped');
