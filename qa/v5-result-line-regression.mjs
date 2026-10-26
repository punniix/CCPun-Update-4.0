// Local production-build journeys with owned synthetic calculator inputs. No external requests or messages.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const origin=process.env.RESULT_LINE_ORIGIN||'http://127.0.0.1:3006';
assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(origin).hostname));
const { chromium,devices }=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
const output=path.resolve('qa/artifacts/c6-result-line-20261026');
await mkdir(output,{recursive:true});
const results=[];
try {
  for(const tool of ['ci','fhc'])for(const width of [390,1440])for(const consent of ['unset','reject','accept']) {
    const context=await browser.newContext(width===390?{...devices['iPhone 13'],viewport:{width,height:844}}:{viewport:{width,height:1000}});
    await context.route('**/*',route=>new URL(route.request().url()).origin===new URL(origin).origin?route.continue():route.abort());
    await context.addInitScript(({consent})=>{
      localStorage.setItem('ccpun_cookie_consent',JSON.stringify({status:consent==='accept'?'accepted_all':'custom',essential:true,performance:false,analytics:consent==='accept',social:false,timestamp:new Date().toISOString(),expires:Date.now()+86400000}));
      window.__resultLineEvents=[];window.__resultLineDetails=[];
      window.gtag=(...args)=>window.__resultLineEvents.push(args);
      window.fbq=(...args)=>window.__resultLineEvents.push(args);
      window.addEventListener('ccpun:open-chat',event=>{
        const {trigger,resultTool,returnTo}=event.detail;
        window.__resultLineDetails.push({trigger,resultTool,keys:Object.keys(event.detail).sort(),returnTo:returnTo?.outerHTML});
      });
    },{consent});
    const page=await context.newPage();
    const url=tool==='ci'?'/ci-planning/':'/tools/financial-health-check/';
    await page.goto(origin+url,{waitUntil:'networkidle'});
    if(tool==='ci') {
      await page.locator('#ci-monthly-income').fill('654321');
      await page.locator('#ci-household').fill('12345');
      await page.getByRole('button',{name:'ถัดไป',exact:true}).click();
      await page.getByRole('button',{name:'ดูผลคำนวณ',exact:true}).click();
    } else {
      await page.locator('#householdMonthly').fill('12345');
      await page.locator('#debt').fill('3434343');
      await page.getByRole('button',{name:'ถัดไป',exact:true}).click();
      await page.locator('#existingLifeCoverage').fill('456789');
      await page.getByRole('button',{name:'ดูผลการคำนวณ',exact:true}).click();
    }
    const cta=page.locator('.ccpun-calculator-result-cta [data-v5-chat-link]');
    await cta.waitFor();
    assert.equal(await cta.textContent(),await page.locator('[data-v5-chat-dock] > a').textContent(),'result label equals the existing dock label');
    const fallback=await cta.getAttribute('href');
    assert.match(fallback,/^https:\/\/line\.me\/R\/oaMessage\/%40ccpun\/\?/);
    const fallbackText=decodeURIComponent(fallback.split('/?')[1]);
    assert.match(fallbackText,/ใช้เครื่องมือ.+มาครับ/);
    assert.doesNotMatch(fallbackText,/\d|รหัส|ref:|topic|campaign/);
    await cta.scrollIntoViewIfNeeded();
    if(consent==='unset') {
      // Reopen the real cookie notice while the result is already visible, with no stored choice.
      await page.evaluate(()=>{localStorage.removeItem('ccpun_cookie_consent');window.dispatchEvent(new CustomEvent('ccpun:openCookieSettings'));});
      await page.locator('[role="dialog"][aria-labelledby^="cookie"]').waitFor();
    }
    const lineControls=await page.locator('a[href]').evaluateAll(nodes=>nodes.filter(node=>{
      const rect=node.getBoundingClientRect();return rect.width>0&&rect.height>0&&getComputedStyle(node).visibility!=='hidden'&&/^https?:\/\/(?:lin\.ee|line\.me)\//.test(node.href);
    }).length);
    assert.ok(lineControls<=2,`only dock+result CTA are visible (${lineControls})`);
    assert.equal(await page.locator('[data-v5-chat-dock]').count(),1);
    await cta.click();
    const panel=page.locator('#v5-chat-panel');
    await panel.waitFor();
    assert.equal(await page.locator('#v5-chat-panel').count(),1);
    const first=panel.locator('[data-chat-topic]').first();
    assert.equal(await first.textContent(),tool==='ci'?'ขอคุยเรื่องผลที่คำนวณได้':'คุยต่อเรื่องผลตรวจการเงิน');
    assert.equal(await first.getAttribute('href'),fallback,'first topic URL and raw-link fallback have the same generic result intent');
    const trace=await page.evaluate(()=>({details:window.__resultLineDetails,events:window.__resultLineEvents,dataLayer:window.dataLayer||[]}));
    assert.equal(trace.details.length,1);
    assert.equal(trace.details[0].trigger,'article_cta');
    assert.equal(trace.details[0].resultTool,tool);
    assert.deepEqual(trace.details[0].keys,['resultTool','returnTo','trigger']);
    assert.doesNotMatch(JSON.stringify(trace),/654321|654,321|12345|12,345|3434343|3,434,343|456789|456,789/,'calculator inputs never enter the event detail, prefill or analytics');
    if(consent!=='accept') assert.ok(!trace.events.some(row=>row[0]==='event'||row[0]==='track'||row[0]==='trackCustom'),'denied/unset consent emits no analytics events');
    await page.screenshot({path:path.join(output,`${tool}-${width}-${consent}.png`),fullPage:false});
    await first.focus();
    await page.keyboard.press('Escape');
    await panel.waitFor({state:'detached'});
    await page.waitForTimeout(60);
    const focus=await cta.evaluate(()=>document.activeElement===document.querySelector('[data-v5-chat-dock] > a')||Boolean(document.activeElement?.closest('[role="dialog"][aria-labelledby^="cookie"]')));
    assert.equal(focus,true,'C8 close restores the dock or the still-open cookie dialog');
    results.push({tool,width,consent,firstTopic:true,privacy:true,singlePanel:true,lineControls,focusRestored:true});
    await context.close();
  }
} finally {
  await browser.close();
  await writeFile(path.join(output,'results.json'),JSON.stringify({results},null,2)+'\n');
}
console.log(`C6 result LINE: ${results.length} tool/width/consent journeys PASS`);
