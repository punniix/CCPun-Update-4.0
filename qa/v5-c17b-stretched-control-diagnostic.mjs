// Separate actual stretched-hit-area diagnostic. Standard anchor DOM bboxes remain in the main24 proof.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const origin = 'http://127.0.0.1:3037';
const output = 'qa/artifacts/c17b-stretched-controls-20261026';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [], radioFocus = [];
try {
  for (const width of [390, 834]) for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, colorScheme: theme, reducedMotion: 'reduce' });
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await context.addInitScript(theme => {
      localStorage.setItem('ccpun-theme', theme);
      localStorage.setItem('ccpun_cookie_consent', JSON.stringify({ status: 'custom', essential: true, analytics: false, expires: Date.now() + 86400000 }));
    }, theme);
    const page = await context.newPage(); await page.goto(origin + '/blog/', { waitUntil: 'domcontentloaded' }); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(400);
    assert.equal(await page.getAttribute('html', 'data-theme'), theme);
    const areas = await page.evaluate(() => {
      const dock = document.querySelector('[data-v5-chat-dock]'), trigger = dock.querySelector('a'), button = trigger.getBoundingClientRect();
      const plain = r => ({ x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom });
      const found = [];
      for (const anchor of document.querySelectorAll('a')) {
        const pseudo = getComputedStyle(anchor, '::after');
        if (pseudo.content === 'none' || pseudo.position !== 'absolute' || !['top', 'right', 'bottom', 'left'].every(edge => pseudo[edge] === '0px')) continue;
        let container = anchor;
        while (container && getComputedStyle(container).position === 'static' && getComputedStyle(container).transform === 'none') container = container.parentElement;
        if (!container) continue;
        const bounds = container.getBoundingClientRect(), style = getComputedStyle(container);
        const hit = { x: bounds.x + parseFloat(style.borderLeftWidth), y: bounds.y + parseFloat(style.borderTopWidth), right: bounds.right - parseFloat(style.borderRightWidth), bottom: bounds.bottom - parseFloat(style.borderBottomWidth) };
        if (hit.bottom <= 0 || hit.y >= innerHeight) continue;
        const overlap = button.x < hit.right && button.right > hit.x && button.y < hit.bottom && button.bottom > hit.y;
        let verification = null;
        if (overlap) {
          const x = (Math.max(button.x, hit.x) + Math.min(button.right, hit.right)) / 2, y = (Math.max(button.y, hit.y) + Math.min(button.bottom, hit.bottom)) / 2;
          const foreground = document.elementFromPoint(x, y), prior = dock.style.visibility;
          dock.style.visibility = 'hidden';
          const underlying = document.elementFromPoint(x, y);
          if (prior) dock.style.visibility = prior; else dock.style.removeProperty('visibility');
          verification = { x, y, triggerTakesHit: foreground === trigger || trigger.contains(foreground), actualUnderlyingAnchorHit: underlying === anchor || underlying?.closest('a') === anchor };
        }
        found.push({ text: anchor.textContent.trim(), anchorDOMBox: plain(anchor.getBoundingClientRect()), containingBlock: container.tagName, containingBlockClass: container.className, pseudoPosition: pseudo.position, pseudoInset: [pseudo.top, pseudo.right, pseudo.bottom, pseudo.left], actualStretchedHitBox: { ...hit, width: hit.right - hit.x, height: hit.bottom - hit.y }, overlapsButton: overlap, verification });
      }
      return { button: plain(button), areas: found };
    });
    results.push({ width, theme, pathname: '/blog/', ...areas });
    await page.screenshot({ path: `${output}/${width}-${theme}.png` }); await context.close();
  }
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await context.addInitScript(() => localStorage.setItem('ccpun_cookie_consent', JSON.stringify({ status: 'custom', essential: true, analytics: false, expires: Date.now() + 86400000 })));
    const page = await context.newPage(); await page.goto(origin + '/ci-planning/', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(400);
    await page.evaluate(() => { const input = document.createElement('input'); input.type = 'radio'; input.id = 'c17b-native-radio'; document.querySelector('main').append(input); input.focus({ preventScroll: true }); });
    const dock = page.locator('[data-v5-chat-dock]'); await page.waitForTimeout(80); assert.equal(await dock.getAttribute('data-state'), 'hidden');
    await page.locator('#c17b-native-radio').evaluate(el => el.blur()); await page.waitForTimeout(80); assert.equal(await dock.getAttribute('data-state'), 'shown');
    radioFocus.push({ width, radioFocusHides: true, blurReveals: true }); await context.close();
  }
} finally {
  await browser.close(); await writeFile(`${output}/evidence.json`, JSON.stringify({ kind: 'separate stretched-link hit-area and radio focus diagnostic; no claim of complete-control acceptance', results, radioFocus }, null, 2));
}
console.log(JSON.stringify({ cases: results.length, stretchedOverlaps: results.reduce((n, r) => n + r.areas.filter(a => a.overlapsButton).length, 0), radioFocus, output }, null, 2));
