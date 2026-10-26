// Candidate local production build only. All non-local requests are aborted; no LINE message is sent.
import assert from 'node:assert/strict';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import jsQR from 'jsqr';
import sharp from 'sharp';

const origin = process.env.LINE_QA_ORIGIN || 'http://127.0.0.1:3003';
assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(origin).hostname));
const output = path.resolve('qa/artifacts/c3b-line-desktop-20261026');
const chunkRoot = 'apps/web/.next/static/chunks';
const chunks = [];
for (const name of await readdir(chunkRoot)) if (name.endsWith('.js')) {
  const bytes = await readFile(path.join(chunkRoot,name));
  if (bytes.includes(Buffer.from('code length overflow'))) chunks.push({name,bytes:bytes.length,gzipBytes:gzipSync(bytes).length});
}
assert.equal(chunks.length,1,'the pinned encoder is emitted as one identifiable lazy chunk');
const { chromium, devices } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({channel:'chrome',headless:true});
const results = [];
await mkdir(output,{recursive:true});
async function contextFor(consent, options={}, failQr=false) {
  const context = await browser.newContext(options);
  await context.route('**/*', route => new URL(route.request().url()).origin === new URL(origin).origin && !(failQr && route.request().url().includes(chunks[0].name)) ? route.continue() : route.abort());
  if (consent !== 'unset') await context.addInitScript(consent => localStorage.setItem('ccpun_cookie_consent', JSON.stringify({status:consent==='accept'?'accepted_all':'custom',essential:true,performance:false,analytics:consent==='accept',social:false,timestamp:new Date().toISOString(),expires:Date.now()+86400000})),consent);
  return context;
}
try {
  for (const theme of ['light','dark']) for (const consent of ['unset','reject','accept']) {
    const context = await contextFor(consent,{viewport:{width:1440,height:1000},colorScheme:theme});
    const page = await context.newPage();
    const requested = [];
    page.on('request', request => requested.push(request.url()));
    await page.goto(origin,{waitUntil:'networkidle'});
    await page.evaluate(theme => document.documentElement.setAttribute('data-theme',theme),theme);
    assert.ok(!requested.some(url=>url.includes(chunks[0].name)),'encoder not downloaded on page load');
    await page.locator('[data-v5-chat-dock] > a').click();
    const panel = page.locator('#v5-chat-panel');
    await panel.waitFor();
    assert.equal(await panel.locator('svg[role="img"]').count(),0,'no encoder/QR before topic choice');
    assert.ok(!requested.some(url=>url.includes(chunks[0].name)),'opening panel does not download encoder');
    const topics = panel.locator('[data-chat-topic]');
    const decoded = [];
    for (const index of [0,1]) {
      const href = await topics.nth(index).getAttribute('href');
      await topics.nth(index).click();
      const qr = panel.locator('svg[role="img"]');
      await qr.waitFor();
      await qr.scrollIntoViewIfNeeded();
      assert.equal(await panel.locator('[data-chat-desktop-open],[data-chat-qr-fallback]').count(),0,'successful desktop view has no PC-open/fallback link');
      assert.equal(await panel.getByRole('link',{name:'เปิด LINE บนคอมพิวเตอร์',exact:true}).count(),0);
      assert.equal(await panel.locator('#v5-chat-note').textContent(),'เลือกหัวข้อเพื่อแสดง QR');
      assert.equal(await panel.locator('section').textContent(),'สแกนด้วยมือถือเพื่อส่งข้อความนี้ทาง LINE');
      const box = await qr.boundingBox();
      assert.ok(box.width>=224&&box.height>=224);
      const image = await qr.screenshot();
      const pixels = await sharp(image).ensureAlpha().raw().toBuffer({resolveWithObject:true});
      const value = jsQR(new Uint8ClampedArray(pixels.data),pixels.info.width,pixels.info.height)?.data;
      assert.equal(value,href,'rendered QR decodes to exactly the chosen topic URL');
      decoded.push(value);
      assert.equal(await qr.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)');
    }
    assert.notEqual(decoded[0],decoded[1]);
    assert.ok(requested.some(url=>url.includes(chunks[0].name)),'encoder downloaded only after selection');
    await page.screenshot({path:path.join(output,`desktop-${theme}-${consent}-1440.png`),fullPage:true});
    await page.keyboard.press('Escape');
    await panel.waitFor({state:'detached'});
    results.push({device:'desktop',theme,consent,decodedTopics:decoded.length,encoderInitial:false});
    await context.close();
  }
  // Actual module-load failure, not a source assertion: the encoder chunk request is aborted.
  for (const theme of ['light','dark']) for (const consent of ['unset','reject','accept']) {
    const context = await contextFor(consent,{viewport:{width:1440,height:1000},colorScheme:theme},true);
    const page = await context.newPage();
    await page.goto(origin,{waitUntil:'networkidle'});
    await page.evaluate(theme=>document.documentElement.setAttribute('data-theme',theme),theme);
    await page.locator('[data-v5-chat-dock] > a').click();
    const panel=page.locator('#v5-chat-panel');
    const topic=panel.locator('[data-chat-topic]').first();
    const href=await topic.getAttribute('href');
    await topic.click();
    const fallback=panel.locator('[data-chat-qr-fallback]');
    await fallback.waitFor();
    assert.equal(await panel.locator('svg[role="img"]').count(),0);
    assert.equal(await panel.locator('[data-chat-desktop-open]').count(),0);
    assert.match(await panel.getByRole('status').textContent(),/แสดง QR ไม่สำเร็จ/);
    assert.equal(await fallback.getAttribute('href'),href,'failure fallback keeps the exact selected topic URL');
    assert.equal(await fallback.getAttribute('target'),'_blank');
    assert.ok(await fallback.evaluate(el=>parseFloat(getComputedStyle(el).fontSize)<=14),'fallback stays small text');
    await fallback.focus();
    assert.equal(await fallback.evaluate(el=>document.activeElement===el),true);
    await page.keyboard.press('Tab');
    assert.equal(await panel.getByRole('button',{name:'ปิด',exact:true}).evaluate(el=>document.activeElement===el),true,'Tab wraps within the dialog');
    await page.screenshot({path:path.join(output,`failure-${theme}-${consent}-1440.png`),fullPage:true});
    await page.keyboard.press('Escape');
    await panel.waitFor({state:'detached'});
    results.push({device:'desktop-failure',theme,consent,fallbackExact:true,keyboard:true});
    await context.close();
  }
  for (const consent of ['unset','reject','accept']) {
    const context = await contextFor(consent,{...devices['iPhone 13'],viewport:{width:390,height:844}});
    const page = await context.newPage();
    const requested = [];
    page.on('request',request=>requested.push(request.url()));
    await page.goto(origin,{waitUntil:'networkidle'});
    await page.locator('[data-v5-chat-dock] > a').click();
    const panel=page.locator('#v5-chat-panel');
    const topic=panel.locator('[data-chat-topic]').first();
    const href=await topic.getAttribute('href');
    assert.equal(await topic.getAttribute('target'),null,'phone opens LINE in same tab');
    assert.equal(await panel.locator('[data-chat-desktop-open],[data-chat-qr-fallback]').count(),0);
    await page.screenshot({path:path.join(output,`mobile-${consent}-390.png`),fullPage:true});
    await topic.evaluate(el=>el.addEventListener('click',event=>event.preventDefault(),{once:true}));
    await topic.click();
    await panel.waitFor({state:'detached'});
    assert.ok(!requested.some(url=>url.includes(chunks[0].name)),'phone never downloads encoder');
    results.push({device:'mobile',consent,href,sameTab:true,encoderLoaded:false});
    await context.close();
  }
  const context=await contextFor('reject',{javaScriptEnabled:false,viewport:{width:390,height:844}});
  const page=await context.newPage();
  await page.goto(origin,{waitUntil:'load'});
  assert.match(await page.locator('[data-v5-chat-dock] > a').getAttribute('href'),/^https:\/\/line\.me\/R\/(?:oaMessage|ti\/p)\/%40ccpun/);
  assert.equal(await page.locator('[data-chat-desktop-open]').count(),0);
  results.push({device:'no-js',fallback:true});
  await context.close();
} finally {
  await browser.close();
  await writeFile(path.join(output,'results.json'),JSON.stringify({chunks,results},null,2)+'\n');
}
console.log(`C3b browser: ${results.length} cases PASS; encoder ${chunks[0].bytes} bytes / ${chunks[0].gzipBytes} gzip bytes`);
