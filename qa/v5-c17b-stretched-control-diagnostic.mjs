// Separate actual stretched-hit-area diagnostic. Standard anchor DOM bboxes remain in the main24 proof.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const origin = 'http://127.0.0.1:3037';
const output = 'qa/artifacts/v5-dock-overlap-stretched-20261026';
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
        const insets = Object.fromEntries(['top', 'right', 'bottom', 'left'].map(edge => [edge, parseFloat(pseudo[edge])]));
        if (pseudo.content === 'none' || pseudo.position !== 'absolute' || !Object.values(insets).every(Number.isFinite)) continue;
        let container = anchor;
        while (container && getComputedStyle(container).position === 'static' && getComputedStyle(container).transform === 'none') container = container.parentElement;
        if (!container) continue;
        const bounds = container.getBoundingClientRect(), style = getComputedStyle(container);
        const hit = { x: bounds.x + parseFloat(style.borderLeftWidth) + insets.left, y: bounds.y + parseFloat(style.borderTopWidth) + insets.top, right: bounds.right - parseFloat(style.borderRightWidth) - insets.right, bottom: bounds.bottom - parseFloat(style.borderBottomWidth) - insets.bottom };
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
        // Independently hit-test the old excluded strip; computed nonzero insets alone cannot prove clearance.
        const cx = button.x + button.width / 2, cy = button.y + button.height / 2;
        const previous = dock.style.visibility; dock.style.visibility = 'hidden';
        const underneath = document.elementFromPoint(cx, cy);
        const centerUnderlyingAnchorHit = underneath === anchor || underneath?.closest('a') === anchor;
        if (previous) dock.style.visibility = previous; else dock.style.removeProperty('visibility');
        const kx = (hit.x + hit.right) / 2, ky = (Math.max(0, hit.y) + Math.min(innerHeight, hit.bottom)) / 2;
        const kept = document.elementFromPoint(kx, ky);
        const keptRegionAnchorHit = kept === anchor || kept?.closest('a') === anchor;
        found.push({ centerUnderlyingAnchorHit, keptRegionAnchorHit, computedInsets: insets, text: anchor.textContent.trim(), anchorDOMBox: plain(anchor.getBoundingClientRect()), containingBlock: container.tagName, containingBlockClass: container.className, pseudoPosition: pseudo.position, pseudoInset: [pseudo.top, pseudo.right, pseudo.bottom, pseudo.left], actualStretchedHitBox: { ...hit, width: hit.right - hit.x, height: hit.bottom - hit.y }, overlapsButton: overlap, verification });
      }
      return { button: plain(button), areas: found };
    });
    results.push({ width, theme, pathname: '/blog/', ...areas });
    assert.ok(areas.areas.length > 0, 'stretched anchors must still be measured with nonzero insets');
    assert.ok(areas.areas.every(a => !a.overlapsButton && !a.centerUnderlyingAnchorHit && a.keptRegionAnchorHit), 'actual reserved strip is clear and remaining expanded link still takes hits');
    await page.screenshot({ path: `${output}/${width}-${theme}.png` });
    const headline = page.locator('article h3 a').first(); await headline.focus();
    const headlineProof = await headline.evaluate(anchor => {
      const range = document.createRange(); range.selectNodeContents(anchor); const box = [...range.getClientRects()].find(r => r.width > 0 && r.height > 0);
      const target = box ? document.elementFromPoint(box.x + Math.min(8, box.width / 2), box.y + box.height / 2) : null;
      return { href: anchor.getAttribute('href'), focused: document.activeElement === anchor, actualHeadlineHit: target === anchor || target?.closest('a') === anchor };
    });
    assert.ok(headlineProof.href && headlineProof.focused && headlineProof.actualHeadlineHit, 'full native headline link remains usable');
    results.at(-1).headlineProof = headlineProof; await context.close();
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
  await browser.close(); await writeFile(`${output}/evidence.json`, JSON.stringify({ kind: 'computed real-inset stretched-link clearance with independent native hit tests and headline usability', results, radioFocus }, null, 2));
}
console.log(JSON.stringify({ cases: results.length, stretchedOverlaps: results.reduce((n, r) => n + r.areas.filter(a => a.overlapsButton).length, 0), radioFocus, output }, null, 2));
