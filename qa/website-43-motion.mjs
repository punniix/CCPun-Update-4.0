import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.WEBSITE43_BASE_URL || 'http://127.0.0.1:3113';
const CDP = process.env.WEBSITE43_CDP_HTTP || 'http://127.0.0.1:9333';
for (const url of [BASE, CDP]) if (!['localhost', '127.0.0.1'].includes(new URL(url).hostname)) throw new Error('Local-only QA: remote hosts require separate review');
const output = path.resolve('qa/screenshots/website43-motion');
await mkdir(output, { recursive: true });
const checks = [];
const check = (name, pass, detail = null) => { checks.push({ name, pass: Boolean(pass), detail }); console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`); };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const target = await (await fetch(`${CDP}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map(); let id = 0;
ws.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  const request = pending.get(message.id);
  if (!request) return;
  pending.delete(message.id); clearTimeout(request.timer);
  if (message.error) request.reject(new Error(message.error.message)); else request.resolve(message.result);
});
await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const key = ++id;
  const timer = setTimeout(() => { pending.delete(key); reject(new Error(`Timeout: ${method}`)); }, 35000);
  pending.set(key, { resolve, reject, timer }); ws.send(JSON.stringify({ id: key, method, params }));
});
const evaluate = async (expression) => {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result?.value;
};
async function waitFor(expression) {
  for (let count = 0; count < 100; count++) { if (await evaluate(expression)) return; await sleep(200); }
  throw new Error(`DOM timeout: ${expression}`);
}
async function navigate(route) {
  await send('Page.navigate', { url: `${BASE}${route}` });
  await waitFor(`document.readyState === 'complete' && !!document.querySelector('[data-w43-motion-ready="true"]') && location.pathname === ${JSON.stringify(route + (route.endsWith('/') ? '' : '/'))}`);
  await evaluate('document.fonts.ready.then(() => true)'); await sleep(400);
}
async function viewport(width, reduce = false) {
  await send('Emulation.setDeviceMetricsOverride', { width, height: 950, deviceScaleFactor: 1, mobile: width < 640 });
  await send('Emulation.setTouchEmulationEnabled', { enabled: width < 640 });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' }] });
}
async function snap(name) {
  const capture = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(path.join(output, name + '.png'), Buffer.from(capture.data, 'base64'));
}
async function layout(name) {
  const result = await evaluate(`({width:innerWidth,scroll:document.documentElement.scrollWidth,heroVisible:[...document.querySelectorAll('h1')].some(n=>getComputedStyle(n).opacity==='1'),scope:getComputedStyle(document.querySelector('[data-w43-motion-root]')).display,robots:document.querySelector('meta[name="robots"]')?.content})`);
  check(name + ' no horizontal overflow', result.scroll <= result.width + 1, result);
  check(name + ' hero visible / no layout wrapper / noindex', result.heroVisible && result.scope === 'contents' && result.robots.includes('noindex'));
}
async function key(key, code) {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key, windowsVirtualKeyCode: code, ...(key === 'Enter' ? { text: '\r', unmodifiedText: '\r' } : {}) });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key, windowsVirtualKeyCode: code });
}
async function faq(name, reduced = false) {
  const start = await evaluate(`(()=>{const d=document.querySelector('details[class*="faqItem"],[class*="faqDetails"] details'); if(!d)return null; d.open=false; d.querySelector('summary').scrollIntoView({block:'center'}); d.querySelector('summary').focus(); d.querySelector('summary').click();return {open:d.open,motion:d.dataset.w43AccordionMotion}})()`);
  check(name + ' FAQ activation', start?.open && (reduced ? !start.motion : start.motion === 'opening'), start);
  await sleep(350);
  check(name + ' FAQ auto height restored', await evaluate(`(()=>{const d=document.querySelector('details[class*="faqItem"],[class*="faqDetails"] details');return d.open && !d.style.height && !d.dataset.w43AccordionMotion})()`));
  const focus = await evaluate(`({tag:document.activeElement?.tagName,text:document.activeElement?.textContent?.slice(0,80),focused:document.hasFocus()})`);
  check(name + ' FAQ keeps summary focus', focus.tag === 'SUMMARY', focus);
  await key('Enter', 13); await sleep(350);
  check(name + ' FAQ keyboard close', await evaluate(`!document.querySelector('details[class*="faqItem"],[class*="faqDetails"] details').open`));
  await evaluate(`(()=>{const s=document.querySelector('details[class*="faqItem"],[class*="faqDetails"] details').querySelector('summary');s.click();s.click();s.click();})()`); await sleep(350);
  check(name + ' FAQ rapid reversal', await evaluate(`(()=>{const d=document.querySelector('details[class*="faqItem"],[class*="faqDetails"] details');return d.open&&!d.style.height})()`));
}
async function menu(name, width) {
  await evaluate('window.scrollTo(0,0)');
  const selector = width < 1024 ? 'button[aria-label="เปิดเมนู"]' : 'nav[aria-label="เมนูหลัก"] button';
  await evaluate(`(()=>{const b=document.querySelector(${JSON.stringify(selector)});b.focus();b.click();})()`); await sleep(300);
  const value = await evaluate(`(()=>{const n=document.querySelector(${JSON.stringify(width < 1024 ? 'nav[aria-label="เมนูมือถือ"]' : '[role="menu"]')});const r=n?.getBoundingClientRect();return {visible:!!r&&r.width>0,inside:!!r&&r.left>=0&&r.right<=innerWidth+1}})()`);
  check(name + ' menu visible and inside viewport', value.visible && value.inside, value);
  await key('Escape', 27); await sleep(50);
  check(name + ' Escape closes menu', await evaluate(`!document.querySelector('nav[aria-label="เมนูมือถือ"],nav[aria-label="เมนูหลัก"] [role="menu"]')`));
}
async function setInput(id, value) {
  await evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});if(!e)throw Error('missing input');const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
}
async function clickText(text) {
  await evaluate(`(()=>{const b=[...document.querySelectorAll('#calculator button')].find(b=>b.textContent.trim()===${JSON.stringify(text)});if(!b)throw Error('missing action');b.click();})()`);
}
try {
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.bringToFront');
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await viewport(390); await navigate('/preview/website-4-3'); await sleep(900);
  // Use the real settings UI and keep all optional consent off in this isolated QA profile.
  await evaluate(`document.querySelector('button[aria-label="ตั้งค่าคุกกี้"]')?.click()`);
  await sleep(100);
  await evaluate(`document.querySelector('button[aria-label="บันทึกการตั้งค่าคุกกี้"]')?.click()`);
  await sleep(100);
  for (const width of [390, 640, 820, 1024, 1440]) {
    await viewport(width); await navigate('/preview/website-4-3');
    await layout(`Home ${width}`); await menu(`Home ${width}`, width); await faq(`Home ${width}`);
    if ([390,1440].includes(width)) { await snap(`home-faq-${width}`); await evaluate('window.scrollTo(0,0)'); await snap(`home-${width}`); }
    await navigate('/preview/website-4-3/blog'); await layout(`Blog ${width}`);
    check(`Blog ${width} clickable cards enhanced`, await evaluate(`document.querySelectorAll('[data-w43-motion-card]').length>0`));
    await navigate('/preview/website-4-3/tools/financial-health-check'); await layout(`FHC ${width}`);
    await navigate('/preview/website-4-3/ci-planning'); await layout(`CI ${width}`);
  }
  for (const width of [390,1440]) {
    await viewport(width); await navigate('/preview/website-4-3/tools/financial-health-check');
    await clickText('ถัดไป');
    await waitFor(`!!document.querySelector('#life-calculator-error') && document.activeElement.id === 'householdMonthly'`);
    check(`FHC ${width} required validation preserved`, await evaluate(`!!document.querySelector('#life-calculator-error') && document.activeElement.id==='householdMonthly'`));
    await setInput('householdMonthly','30000'); await clickText('ถัดไป'); await sleep(350);
    check(`FHC ${width} step two + heading focus`, await evaluate(`document.querySelector('[data-w43-motion-step="2"]')!==null && document.activeElement.tagName==='H3'`));
    await setInput('existingLifeCoverage','500000'); await setInput('liquidAssets','100000');
    await clickText('ย้อนกลับ'); await sleep(350);
    check(`FHC ${width} values preserved on back`, await evaluate(`document.getElementById('householdMonthly').value.replace(/,/g,'')==='30000'`));
    await clickText('ถัดไป'); await sleep(350); await clickText('ดูผลการคำนวณ'); await sleep(100);
    check(`FHC ${width} exact result unchanged`, await evaluate(`document.getElementById('life-result-title').textContent.includes('3,000,000')`));
    await evaluate(`document.getElementById('life-result-title').scrollIntoView({block:'start'})`); await snap(`fhc-result-${width}`);
    await viewport(width,true); await navigate('/preview/website-4-3'); await faq(`Reduced ${width}`,true);
    check(`Reduced ${width} no active animation`, await evaluate(`document.getAnimations().filter(a=>a.playState==='running').length===0`));
  }
  for (const width of [390,1440]) for (const reduced of [false,true]) {
    const label = `CI ${width} ${reduced ? 'reduced' : 'normal'}`;
    await viewport(width,reduced); await navigate('/preview/website-4-3/ci-planning');
    await clickText('ถัดไป'); await waitFor(`!!document.querySelector('#calculator [role="alert"]')`);
    check(label + ' validation retained', await evaluate(`!!document.querySelector('#ci-household')`));
    await setInput('ci-household','20000');
    const years = await evaluate(`Number(document.getElementById('ci-reserve-years').value)`);
    await clickText('ถัดไป'); await waitFor(`!!document.querySelector('#ci-lump-sum')`); await sleep(350);
    check(label + ' reaches second step',await evaluate(`!!document.querySelector('[data-w43-motion-step="2"]')`));
    await setInput('ci-lump-sum','100000'); await clickText('ย้อนกลับ');
    await waitFor(`!!document.querySelector('#ci-household')`); await sleep(350);
    check(label + ' retains entered values',await evaluate(`document.getElementById('ci-household').value.replace(/,/g,'')==='20000'`));
    await clickText('ถัดไป'); await waitFor(`!!document.querySelector('#ci-lump-sum')`); await sleep(350);
    await clickText('ดูผลคำนวณ'); await sleep(350);
    const expected = new Intl.NumberFormat('th-TH').format(Math.max(20000*12*years-100000,0));
    check(label + ' exact expense-method result',await evaluate(`document.querySelector('#calculator').textContent.includes(${JSON.stringify(expected)}) && [...document.querySelectorAll('#calculator h2')].some(n=>n.textContent.includes('ประมาณการทุนเบื้องต้น'))`),expected);
  }
  await viewport(1440); await navigate('/preview/website-4-3/blog');
  const rect = await evaluate(`(()=>{const c=document.querySelector('a[class*="articleCard"]');c.scrollIntoView({block:'center',behavior:'instant'});const r=c.getBoundingClientRect();return {x:r.x+20,y:r.y+20}})()`);
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:rect.x,y:rect.y}); await sleep(220);
  check('Desktop card has restrained hover lift',await evaluate(`getComputedStyle(document.querySelector('a[class*="articleCard"]')).translate.includes('-3px')`));
  await evaluate(`document.querySelector('button[class*="categoryMenuButton"]').click()`); await sleep(220);
  check('Blog category dropdown keeps existing choices',await evaluate(`document.querySelectorAll('[role="menuitemradio"]').length>1`));
  await evaluate(`document.querySelectorAll('[role="menuitemradio"]')[1].click()`); await sleep(220);
  check('Blog category selection closes dropdown and keeps results',await evaluate(`!document.querySelector('[role="menuitemradio"]')&&document.querySelectorAll('a[class*="articleCard"]').length>0`));
  await viewport(1440,true); await navigate('/preview/website-4-3/blog');
  const reducedScroll = await evaluate(`(()=>{const rail=document.querySelector('[class*="featuredScroller"]');const before=rail.scrollLeft;document.querySelectorAll('button[class*="carouselDotButton"]')[1].click();return {before,after:rail.scrollLeft}})()`);
  await sleep(250);
  check('Reduced Motion carousel changes immediately without smooth scroll', Math.abs(reducedScroll.after-reducedScroll.before)>1 && await evaluate(`Math.abs(document.querySelector('[class*="featuredScroller"]').scrollLeft-${reducedScroll.after})<1`),reducedScroll);
  await viewport(1440,false);
  const article = await evaluate(`document.querySelector('[data-w43-motion-card]')?.getAttribute('href')`);
  if (article?.startsWith('/preview/website-4-3/')) { await navigate(article.replace(/\/$/,'')); await layout('Article 1440'); if(await evaluate(`!!document.querySelector('details[class*="faqItem"],[class*="faqDetails"] details')`))await faq('Article 1440'); }
  await send('Emulation.setScriptExecutionDisabled',{value:true});
  await send('Page.navigate',{url:BASE+'/preview/website-4-3/'}); await sleep(2000);
  await snap('home-no-javascript-1440');
  await send('Emulation.setScriptExecutionDisabled',{value:false});
  check('No-JS server-rendered hero and FAQ retained', await evaluate(`!!document.querySelector('h1')&&document.querySelectorAll('details').length>0`));
} catch (error) {
  check('QA runtime completed',false,error.message); console.error(error.message);
} finally {
  const summary={createdAt:new Date().toISOString(),base:BASE,passed:checks.filter(c=>c.pass).length,failed:checks.filter(c=>!c.pass).length,checks};
  await writeFile(path.join(output,'report.json'),JSON.stringify(summary,null,2)+'\n');
  console.log(JSON.stringify({passed:summary.passed,failed:summary.failed,report:path.join(output,'report.json')}));
  ws.close(); await fetch(`${CDP}/json/close/${target.id}`,{method:'PUT'}).catch(()=>{});
  if(summary.failed)process.exitCode=1;
}
