// Compiled local C17 acceptance. Synthetic CMS only; every nonlocal browser request is aborted.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const origin = 'http://127.0.0.1:3037';
const output = path.resolve('qa/artifacts/c17b-line-dock-round-20261026');
await mkdir(output, { recursive: true });
const paths = ['/', '/blog/', '/blog/personal-finance/c10-local-fixture/', '/ci-planning/', '/tools/financial-health-check/', '/about/'];
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-background-networking', '--disable-component-update', '--disable-sync', '--no-first-run'] });
const results = [], behaviour = [], desktop = [], failures = [];
async function contextFor(width, theme, consent = true, reducedMotion = 'reduce') {
  const context = await browser.newContext({ viewport: { width, height: 844 }, colorScheme: theme, reducedMotion });
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await context.addInitScript(({ theme, consent }) => {
    localStorage.setItem('ccpun-theme', theme);
    if (consent) localStorage.setItem('ccpun_cookie_consent', JSON.stringify({ status: 'custom', essential: true, performance: false, analytics: false, social: false, timestamp: new Date().toISOString(), expires: Date.now() + 86400000 }));
  }, { theme, consent });
  return context;
}
async function load(page, pathname, theme) {
  const response = await page.goto(origin + pathname, { waitUntil: 'domcontentloaded' });
  assert.equal(response.status(), 200, pathname);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  await page.waitForFunction(t => document.documentElement.dataset.theme === t, theme);
  await page.locator('[data-v5-chat-dock] > a[role="button"]').waitFor();
}
function measure() {
  const node = document.querySelector('[data-v5-chat-dock] > a');
  const rect = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
  const button = rect(node), style = getComputedStyle(node), dockStyle = getComputedStyle(node.parentElement);
  const intersects = (a, b) => a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;
  const visible = el => {
    for (let p = el; p; p = p.parentElement) { const cs = getComputedStyle(p); if (cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse' || Number(cs.opacity) === 0 || cs.clipPath === 'inset(50%)') return false; }
    const r = rect(el); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.y < innerHeight && r.right > 0 && r.x < innerWidth;
  };
  const owners = [...document.querySelectorAll('h1,h2,h3,label,p')].filter(visible);
  const blockBoxes = owners.map(el => ({ tag: el.tagName, text: el.textContent.trim(), box: rect(el) }));
  const textGlyphRects = [];
  const segmenter = new Intl.Segmenter('th', { granularity: 'grapheme' });
  for (const owner of owners) {
    const walker = document.createTreeWalker(owner, NodeFilter.SHOW_TEXT);
    for (let text = walker.nextNode(); text; text = walker.nextNode()) {
      if (!text.textContent.trim() || !visible(text.parentElement)) continue;
      for (const segment of segmenter.segment(text.textContent)) {
        if (!/\S/u.test(segment.segment)) continue;
        const range = document.createRange(); range.setStart(text, segment.index); range.setEnd(text, segment.index + segment.segment.length);
        for (const raw of range.getClientRects()) {
          let x = Math.max(0, raw.x), y = Math.max(0, raw.y), right = Math.min(innerWidth, raw.right), bottom = Math.min(innerHeight, raw.bottom);
          for (let el = text.parentElement; el; el = el.parentElement) {
            const cs = getComputedStyle(el), bounds = el.getBoundingClientRect();
            if (cs.overflowX !== 'visible') { x = Math.max(x, bounds.x); right = Math.min(right, bounds.right); }
            if (cs.overflowY !== 'visible') { y = Math.max(y, bounds.y); bottom = Math.min(bottom, bounds.bottom); }
          }
          if (right > x && bottom > y) textGlyphRects.push({ tag: owner.tagName, owner: owner.textContent.trim(), text: segment.segment, box: { x, y, right, bottom, width: right - x, height: bottom - y }, rangeBox: { x: raw.x, y: raw.y, width: raw.width, height: raw.height } });
        }
      }
    }
  }
  const controlRects = [...document.querySelectorAll('input:not([type="hidden"]),select,textarea,button,a,[role="button"],[role="radio"],[role="checkbox"],label')].filter(el => {
    if (el.closest('[data-v5-chat-layer]') || !visible(el)) return false;
    if (el.tagName === 'LABEL') return ['radio', 'checkbox'].includes(el.control?.type) || Boolean(el.querySelector('input[type="radio"],input[type="checkbox"]'));
    return true;
  }).map(el => ({ tag: el.tagName, type: el.getAttribute('type'), role: el.getAttribute('role'), id: el.id, text: (el.textContent || el.getAttribute('aria-label') || el.getAttribute('name') || '').trim().slice(0, 160), box: rect(el) }));
  // Computed input surfaces use oklab() from color-mix(), so let the browser decode
  // all supported CSS color spaces before alpha compositing. Numeric regex parsing is invalid.
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
  const paint = canvas.getContext('2d', { willReadFrequently: true });
  const rgb = str => { paint.clearRect(0, 0, 1, 1); paint.fillStyle = str; paint.fillRect(0, 0, 1, 1); const c = [...paint.getImageData(0, 0, 1, 1).data]; return [...c.slice(0, 3), c[3] / 255]; };
  const over = (front, back) => { const a = front[3] ?? 1; return [0, 1, 2].map(i => front[i] * a + back[i] * (1 - a)); };
  const background = el => { const chain = []; for (let p = el; p; p = p.parentElement) chain.push(p); return chain.reverse().reduce((bg, p) => over(rgb(getComputedStyle(p).backgroundColor), bg), [255, 255, 255]); };
  const luminance = c => c.map(x => { const v = x / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((sum, x, i) => sum + x * [.2126, .7152, .0722][i], 0);
  const contrast = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  const fill = background(node), icon = over(rgb(getComputedStyle(node.querySelector('svg')).color), fill), edge = rgb(style.borderTopColor);
  const points = [[button.x - 2, button.y + button.height / 2], [button.right + 2, button.y + button.height / 2], [button.x + button.width / 2, button.y - 2], [button.x + button.width / 2, button.bottom + 2]];
  const surroundings = points.map(([x, y]) => { const el = document.elementFromPoint(x, y); const bg = background(el); return { x, y, element: el?.tagName, background: bg, ratio: contrast(over(edge, bg), bg) }; });
  const headerBottom = document.querySelector('[data-v5-header]')?.getBoundingClientRect().bottom ?? 0;
  const hit = document.elementFromPoint(button.x + button.width / 2, button.y + button.height / 2);
  const clickable = hit === node || node.contains(hit);
  return { theme: document.documentElement.dataset.theme, headerBottom, clickable, button, name: node.textContent, radius: style.borderRadius, padding: style.padding, icon: rect(node.querySelector('svg')), dock: { box: rect(node.parentElement), background: dockStyle.backgroundColor, borderTop: dockStyle.borderTopWidth, blur: dockStyle.backdropFilter, translate: dockStyle.translate, transition: dockStyle.transitionDuration }, blockBoxes, textGlyphRects, controlRects, glyphIntersections: textGlyphRects.filter(el => intersects(button, el.box)), controlIntersections: controlRects.filter(el => intersects(button, el.box)), contrast: { fill, icon, edge, iconRatio: contrast(icon, fill), surroundings, minimumEdgeRatio: Math.min(...surroundings.map(s => s.ratio)) } };
}
try {
  for (const width of [390, 834]) for (const theme of ['light', 'dark']) {
    const context = await contextFor(width, theme);
    for (const [index, pathname] of paths.entries()) {
      const page = await context.newPage();
      await load(page, pathname, theme);
      const result = { width, pathname, ...await page.evaluate(measure) };
      assert.equal(result.name, 'คุยกับปั้นทาง LINE');
      assert.equal(await page.getByRole('button', { name: 'คุยกับปั้นทาง LINE', exact: true }).count(), 1, 'accessible name remains unchanged');
      assert.equal(result.button.width, 56); assert.equal(result.button.height, 56);
      assert.equal(result.button.x, width - 72); assert.equal(result.button.y, 772, 'C17b fixed16px corner');
      assert.ok(result.button.y >= result.headerBottom && result.button.bottom <= 844); assert.equal(result.clickable, true);
      assert.equal(result.radius, '50%'); assert.equal(result.padding, '0px');
      assert.equal(result.icon.width, 24); assert.equal(result.icon.height, 24);
      assert.equal(result.dock.background, 'rgba(0, 0, 0, 0)'); assert.equal(result.dock.borderTop, '0px'); assert.equal(result.dock.blur, 'none');
      assert.ok(result.contrast.iconRatio >= 3); assert.ok(result.contrast.minimumEdgeRatio >= 3);
      // C17b owner explicitly replaced block-box acceptance with actual text ranges and complete controls.
      if (result.glyphIntersections.length || result.controlIntersections.length) failures.push({ width, theme, pathname, criterion: 'C17B_GLYPHS_AND_CONTROLS', button: result.button, glyphs: result.glyphIntersections, controls: result.controlIntersections });
      if (width === 834 && ['/ci-planning/', '/tools/financial-health-check/'].includes(pathname)) {
        const inputEdges = await page.locator('#main-content input:not([type="hidden"])').evaluateAll(els => els.filter(el => el.getBoundingClientRect().width > 0).map(el => el.getBoundingClientRect().right));
        assert.ok(inputEdges.every(edge => edge <= result.button.x - 8), 'tablet form right edge clears fixed button by8px'); result.inputEdges = inputEdges;
      }
      await page.screenshot({ path: path.join(output, `${width}-${theme}-${index + 1}.png`) });
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(100);
      const footer = await page.evaluate(() => {
        const a = document.querySelector('[data-v5-chat-dock] > a').getBoundingClientRect();
        const el = [...document.querySelectorAll('footer p')].find(el => el.textContent.includes('© 2026 CCPUN'));
        const r = el?.getBoundingClientRect();
        return { text: el?.textContent, box: r ? { x: r.x, y: r.y, right: r.right, bottom: r.bottom } : null, buttonTop: a.top, state: document.querySelector('[data-v5-chat-dock]').dataset.state, footerPadding: getComputedStyle(document.querySelector('footer')).paddingBottom };
      });
      assert.ok(footer.box, 'copyright present');
      if (footer.box.bottom > footer.buttonTop) failures.push({ width, theme, pathname, criterion: 'FOOTER_CLEARANCE', footer });
      assert.equal(footer.state, 'shown'); assert.equal(footer.footerPadding, '80px');
      result.footer = footer; results.push(result); await page.close();
    }
    await context.close();
  }
  for (const width of [1024, 1440]) for (const theme of ['light', 'dark']) {
    const context = await contextFor(width, theme);
    const page = await context.newPage(); await load(page, '/', theme);
    const candidate = await page.locator('[data-v5-chat-dock] > a').boundingBox();
    // At desktop the only DOM change is the label span; reconstruct the actual predecessor DOM.
    await page.locator('[data-v5-chat-dock] > a span').evaluate(el => el.replaceWith(document.createTextNode(el.textContent)));
    const predecessor = await page.locator('[data-v5-chat-dock] > a').boundingBox();
    assert.deepEqual(candidate, predecessor, 'desktop label wrapper preserves exact geometry');
    const geometry = await page.evaluate(() => { const el = document.querySelector('[data-v5-chat-dock]'); const r = el.getBoundingClientRect(); return { right: innerWidth - r.right, bottom: innerHeight - r.bottom }; });
    assert.deepEqual(geometry, { right: 32, bottom: 32 });
    desktop.push({ width, theme, candidate, predecessor, geometry }); await context.close();
  }
  for (const reducedMotion of ['reduce', 'no-preference']) {
    const context = await contextFor(390, 'light', true, reducedMotion);
    const page = await context.newPage(); await load(page, '/about/', 'light');
    const dock = page.locator('[data-v5-chat-dock]'), trigger = page.locator('[data-v5-chat-dock] > a');
    await page.evaluate(() => window.scrollTo(0, 1300)); await page.waitForTimeout(80);
    await page.evaluate(() => window.scrollTo(0, 1800)); await page.waitForTimeout(400);
    assert.equal(await dock.getAttribute('data-state'), 'hidden');
    await page.evaluate(() => window.scrollTo(0, 1700)); await page.waitForTimeout(400);
    assert.equal(await dock.getAttribute('data-state'), 'shown');
    await trigger.click(); const panel = page.locator('#v5-chat-panel'); await panel.waitFor();
    await page.keyboard.press('Escape'); await panel.waitFor({ state: 'detached' });
    assert.equal(await trigger.evaluate(el => el === document.activeElement), true);
    const transition = await dock.evaluate(el => getComputedStyle(el).transitionDuration);
    if (reducedMotion === 'reduce') assert.equal(transition, '0s');
    await page.screenshot({ path: path.join(output, `behaviour-${reducedMotion}.png`) });
    behaviour.push({ reducedMotion, tuck: 'PASS', up: 'PASS', openEscapeFocus: 'PASS', transition }); await context.close();
  }
  for (const width of [390, 1440]) {
    const context = await contextFor(width, 'light'); const page = await context.newPage(); await load(page, '/ci-planning/', 'light');
    const dock = page.locator('[data-v5-chat-dock]');
    await page.evaluate(() => window.scrollTo(0, 1300)); await page.waitForTimeout(80);
    await page.evaluate(() => window.scrollTo(0, 1800)); await page.waitForTimeout(400);
    assert.equal(await dock.getAttribute('data-state'), 'hidden');
    const fields = page.locator('input:not([type="hidden"])'); assert.ok(await fields.count() >= 2);
    await fields.nth(0).evaluate(el => el.focus({ preventScroll: true })); await page.waitForTimeout(50);
    assert.equal(await dock.getAttribute('data-state'), 'hidden');
    await dock.evaluate(el => { window.__c17bFocusStates = []; window.__c17bFocusObserver = new MutationObserver(() => window.__c17bFocusStates.push(el.dataset.state)); window.__c17bFocusObserver.observe(el, { attributes: true, attributeFilter: ['data-state'] }); });
    await fields.nth(1).evaluate(el => el.focus({ preventScroll: true })); await page.waitForTimeout(50);
    assert.equal(await dock.getAttribute('data-state'), 'hidden');
    const switching = await page.evaluate(() => { window.__c17bFocusObserver.disconnect(); return window.__c17bFocusStates; }); assert.ok(!switching.includes('shown'), 'field-to-field never briefly reveals');
    await page.screenshot({ path: path.join(output, `${width}-typing-hidden.png`) });
    await fields.nth(1).evaluate(el => el.blur()); await page.waitForTimeout(100);
    assert.equal(await dock.getAttribute('data-state'), 'shown', 'leaving fields reveals even from a scroll-hidden state');
    await page.evaluate(() => window.scrollTo(0, 2400)); await page.waitForTimeout(400); assert.equal(await dock.getAttribute('data-state'), 'hidden', 'normal scroll tuck still works after blur');
    await page.evaluate(() => {
      const wrap = document.createElement('div'); wrap.id = 'c17b-local-fields';
      for (const tag of ['select', 'textarea', 'input']) { const el = document.createElement(tag); if (tag === 'input') el.type = 'checkbox'; wrap.append(el); }
      document.querySelector('main').append(wrap);
    });
    const nativeTypes = [];
    for (const field of await page.locator('#c17b-local-fields > *').all()) {
      await field.evaluate(el => el.focus({ preventScroll: true })); await page.waitForTimeout(50); assert.equal(await dock.getAttribute('data-state'), 'hidden');
      nativeTypes.push(await field.evaluate(el => el.tagName + ':' + (el.type || '')));
    }
    await page.locator('#c17b-local-fields > *').last().evaluate(el => el.blur()); await page.waitForTimeout(100); assert.equal(await dock.getAttribute('data-state'), 'shown');
    await page.locator('#c17b-local-fields').evaluate(el => el.remove());
    behaviour.push({ width, typing: 'PASS', scrollHiddenFocusBlurReveals: 'PASS', fieldSwitchNoFlicker: switching, nativeTypes, scrollAfterBlur: 'PASS' }); await context.close();
  }
  for (const width of [390, 834]) {
    const context = await contextFor(width, 'dark', false);
    const page = await context.newPage(); await load(page, '/', 'dark');
    const notice = page.locator('[role="dialog"][aria-labelledby^="cookie"]'); await notice.waitFor();
    const button = await page.locator('[data-v5-chat-dock] > a').boundingBox(), cookie = await notice.boundingBox();
    assert.ok(button.y >= 0); assert.ok(button.y + button.height <= cookie.y - 15, '16px gap above cookie');
    await page.locator('[data-v5-chat-dock] > a').click(); await page.locator('#v5-chat-panel').waitFor();
    await page.screenshot({ path: path.join(output, `behaviour-cookie-${width}.png`) });
    behaviour.push({ width, cookieOffset: 'PASS', usableAboveCookie: 'PASS', button, cookie }); await context.close();
  }
} finally {
  await browser.close();
  await writeFile(path.join(output, 'evidence.json'), JSON.stringify({ origin, cms: 'offline C10 synthetic fixture only', results, desktop, behaviour, failures, c12: 'NOT IN BASE; Money hide/QR event integration pending owner merge' }, null, 2));
}
console.log(JSON.stringify({ captures: results.length, strictFailures: failures.length, desktop: desktop.length, behaviour: behaviour.length, output }, null, 2));
assert.equal(failures.length, 0, 'C17b actual glyph/control overlap acceptance (see evidence.json)');
