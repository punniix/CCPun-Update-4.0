// Optimized local candidate only. Original negative fixtures and criteria remain untouched.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
const origin='http://127.0.0.1:3037',output=path.resolve('qa/artifacts/v5-uat-collision-20261027');
await mkdir(output,{recursive:true});
const qa=await readFile('qa/v5-line-dock-round-regression.mjs','utf8');
const measureSource=qa.slice(qa.indexOf('function measure() {'),qa.indexOf('\ntry {',qa.indexOf('function measure() {')));
const measure=Function('return ('+measureSource+');')();
const inventory=JSON.parse(await readFile('qa/v5-uat-collision-routes.json','utf8'));
const results=[],failures=[];
function pseudo(){const a=document.querySelector('[data-v5-chat-dock]>a'),button=a?.getBoundingClientRect();if(!button)return null;const areas=[];for(const anchor of document.querySelectorAll('a')){const s=getComputedStyle(anchor,'::after'),insets=Object.fromEntries(['top','right','bottom','left'].map(k=>[k,parseFloat(s[k])]));if(s.content==='none'||s.position!=='absolute'||!Object.values(insets).every(Number.isFinite))continue;let container=anchor;while(container&&getComputedStyle(container).position==='static'&&getComputedStyle(container).transform==='none')container=container.parentElement;if(!container)continue;const r=container.getBoundingClientRect(),cs=getComputedStyle(container),hit={x:r.x+parseFloat(cs.borderLeftWidth)+insets.left,y:r.y+parseFloat(cs.borderTopWidth)+insets.top,right:r.right-parseFloat(cs.borderRightWidth)-insets.right,bottom:r.bottom-parseFloat(cs.borderBottomWidth)-insets.bottom};if(hit.bottom<=0||hit.y>=innerHeight)continue;const overlaps=button.x<hit.right&&button.right>hit.x&&button.y<hit.bottom&&button.bottom>hit.y;const x=(hit.x+hit.right)/2,y=(Math.max(0,hit.y)+Math.min(innerHeight,hit.bottom))/2,target=document.elementFromPoint(x,y);areas.push({href:anchor.getAttribute('href'),insets,hit,overlaps,keptHit:target===anchor||target?.closest('a')===anchor});}return{button:button.toJSON(),areas};}
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 await Promise.all([390,834,1440].map(async width=>{
  for (const theme of ['light','dark']) {
   const context=await browser.newContext({viewport:{width,height:844},colorScheme:theme,reducedMotion:'reduce'});
   await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
   await context.addInitScript(theme=>{localStorage.setItem('ccpun-theme',theme);localStorage.setItem('ccpun_cookie_consent',JSON.stringify({status:'custom',essential:true,performance:false,analytics:false,social:false,timestamp:new Date().toISOString(),expires:Date.now()+86400000}));},theme);
   const page=await context.newPage();
   for (const [index,pathname] of inventory.routes.entries()) {
    const errors=[]; const handler=error=>errors.push(error.message); page.on('pageerror',handler);
    const response=await page.goto(origin+pathname,{waitUntil:'domcontentloaded'});await page.evaluate(()=>document.fonts.ready);await page.waitForFunction(theme=>document.documentElement.dataset.theme===theme,theme);await page.locator('[data-v5-chat-dock]>a[role="button"]').waitFor();await page.waitForTimeout(180);
    assert.equal(response.status(),inventory.expected404.includes(pathname)?404:200,pathname);
    assert.equal(await page.getAttribute('html','data-theme'),theme);
    const metric=await page.evaluate(measure),expanded=await page.evaluate(pseudo);
    assert.equal(metric.clickable,true,pathname); assert.deepEqual(errors,[]);
    const screenshot=path.join(output,`${width}-${theme}-${index+1}.png`);await page.screenshot({path:screenshot});
    const overlap=metric.glyphIntersections.length||metric.controlIntersections.length||expanded.areas.some(a=>a.overlaps);
    if(overlap)failures.push({width,theme,pathname,glyphs:metric.glyphIntersections,controls:metric.controlIntersections,expanded:expanded.areas.filter(a=>a.overlaps)});
    if(width<1024){assert.equal(metric.button.x,width-72);assert.equal(metric.button.y,772);assert.equal(metric.button.width,56);assert.equal(metric.button.height,56);}
    assert.ok(metric.contrast.iconRatio>=3);assert.ok(metric.contrast.minimumEdgeRatio>=3);
    let moneyLayout=null;
    if(pathname==='/play/money-story/') {
      moneyLayout=await page.evaluate(()=>{const picker=document.querySelector('[class*="MoneyStory_characterPicker__"]'),hint=document.querySelector('[class*="MoneyStory_mobileSwipeHint__"]');return{display:getComputedStyle(picker).display,columns:getComputedStyle(picker).gridTemplateColumns,hint:getComputedStyle(hint).display,cards:[...picker.children].map(n=>n.getBoundingClientRect().toJSON())};});
      if(width===390){assert.equal(moneyLayout.display,'grid');assert.equal(moneyLayout.hint,'none');assert.ok(moneyLayout.cards.every(c=>c.right<=metric.button.x-8));}
    }
    const old=metric.button;
    // Native hit probes only for the known stretched-control surfaces. Focus the real heading
    // (not a text field), making C17 hide nothing; temporarily unpaint only the dock for hit testing.
    const native=await page.evaluate(({old,areas})=>{
      const dock=document.querySelector('[data-v5-chat-dock]');const prior=dock.style.visibility;dock.style.visibility='hidden';
      const hit=document.elementFromPoint(old.x+old.width/2,old.y+old.height/2)?.closest('a');
      const underlying=hit?.getAttribute('href')||null;dock.style.visibility=prior;
      return {underlyingCircleHref:underlying,retained:areas.map(a=>a.keptHit)};
    },{old,areas:expanded.areas});
    if(expanded.areas.length){
      assert.equal(native.underlyingCircleHref,null,'Native underlying circle point cannot hit an expanded link');
      for(const area of expanded.areas){
        const midpoint=(Math.max(0,area.hit.y)+Math.min(844,area.hit.bottom))/2;
        if(midpoint>metric.headerBottom)assert.equal(area.keptHit,true,'Retained visible expanded region still hits its original anchor');
      }
    }
    await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));await page.waitForTimeout(120);
    const footer=await page.evaluate(()=>{const dock=document.querySelector('[data-v5-chat-dock]');const p=[...document.querySelectorAll('footer p')].find(n=>n.textContent.includes('©'));return{state:dock.dataset.state,padding:getComputedStyle(document.querySelector('footer')).paddingBottom,box:p?.getBoundingClientRect().toJSON(),button:document.querySelector('[data-v5-chat-dock]>a').getBoundingClientRect().toJSON()};});
    assert.equal(footer.state,'shown');assert.ok(footer.box);if(width<1024)assert.ok(footer.box.bottom<=footer.button.y);
    results.push({width,theme,pathname,status:response.status(),metric,expanded,native,moneyLayout,screenshot,footer,errors});
    page.off('pageerror',handler);
   }
   await context.close();
  }
 }));
} finally {await browser.close();await writeFile(path.join(output,'evidence.json'),JSON.stringify({kind:'Actual optimized local compiled candidate; immutable published UAT data; all nonlocal requests denied',measureSHA256:createHash('sha256').update(measureSource).digest('hex'),results,failures},null,2));}
console.log(JSON.stringify({cases:results.length,failures:failures.length,output},null,2));
assert.equal(results.length,162);assert.equal(failures.length,0,'Full literal glyph/control and actual expanded-area acceptance');
