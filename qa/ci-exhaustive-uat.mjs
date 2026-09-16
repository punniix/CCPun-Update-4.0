import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = process.env.UAT_BASE_URL || 'http://127.0.0.1:3005';
const CDP_HTTP = process.env.CDP_HTTP || 'http://127.0.0.1:9342';
const ROUTE = '/ci-planning/';
const OUTPUT_DIR = path.resolve('qa/ci-exhaustive-uat');
const VIEWPORTS = [
  ['mobile-320', 320, 700, true], ['mobile-375', 375, 812, true],
  ['mobile-390', 390, 844, true], ['mobile-414', 414, 896, true],
  ['tablet-820', 820, 1100, false], ['tablet-1024', 1024, 1100, false],
  ['desktop-1440', 1440, 1000, false], ['desktop-1920', 1920, 1080, false],
].map(([name, width, height, mobile]) => ({ name, width, height, mobile }));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class CDP {
  constructor(url) { this.url = url; this.id = 1; this.pending = new Map(); this.listeners = new Map(); }
  async connect() {
    this.ws = new WebSocket(this.url);
    this.ws.addEventListener('message', ({ data }) => {
      const message = JSON.parse(data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        return message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result || {});
      }
      for (const listener of this.listeners.get(message.method) || []) listener(message.params || {});
    });
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
  }
  send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  on(method, callback) {
    const listeners = this.listeners.get(method) || [];
    listeners.push(callback);
    this.listeners.set(method, listeners);
  }
  once(method, timeout = 20_000) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve({}), timeout);
      const callback = (params) => {
        clearTimeout(timer);
        this.listeners.set(method, (this.listeners.get(method) || []).filter((item) => item !== callback));
        resolve(params);
      };
      this.on(method, callback);
    });
  }
  close() { this.ws?.close(); }
}

async function createTarget() {
  const response = await fetch(`${CDP_HTTP}/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' });
  if (!response.ok) throw new Error(`Chrome CDP unavailable: ${response.status}`);
  return response.json();
}

async function evaluate(client, expression) {
  const result = await client.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result?.value;
}

async function viewport(client, item) {
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: item.width, height: item.height, deviceScaleFactor: 1, mobile: item.mobile,
    screenWidth: item.width, screenHeight: item.height, dontSetVisibleSize: false,
  });
  await client.send('Emulation.setTouchEmulationEnabled', { enabled: item.mobile, maxTouchPoints: item.mobile ? 5 : 1 });
}

async function navigate(client) {
  const loaded = client.once('Page.loadEventFired');
  await client.send('Page.navigate', { url: `${BASE_URL}${ROUTE}` });
  await loaded;
  await evaluate(client, `document.fonts?.ready?.then(() => true) ?? true`);
  await sleep(300);
  await evaluate(client, `(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent?.trim()==='ยอมรับ'); if(b)b.click(); return true })()`);
  await sleep(80);
}

async function screenshot(client, name, selector = '#ci-calculator') {
  const box = await evaluate(client, `(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e)return null; const r=e.getBoundingClientRect(); return {x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height} })()`);
  if (!box) return null;
  const capture = await client.send('Page.captureScreenshot', {
    format: 'png', fromSurface: true, captureBeyondViewport: true,
    clip: { x: Math.max(0, box.x - 8), y: Math.max(0, box.y - 8), width: Math.ceil(box.width + 16), height: Math.ceil(box.height + 16), scale: 1 },
  });
  const file = path.join(OUTPUT_DIR, `${name}.png`);
  await writeFile(file, Buffer.from(capture.data, 'base64'));
  return path.relative(process.cwd(), file);
}

async function setRaw(client, id, raw, blur = false) {
  const result = await evaluate(client, `(() => {
    const e=document.getElementById(${JSON.stringify(id)}); if(!(e instanceof HTMLInputElement))return null;
    e.focus(); const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
    set.call(e,${JSON.stringify(String(raw))}); e.dispatchEvent(new Event('input',{bubbles:true}));
    if(${blur}) e.blur(); return true;
  })()`);
  if (!result) throw new Error(`Input not found: ${id}`);
  await sleep(60);
  return evaluate(client, `document.getElementById(${JSON.stringify(id)})?.value`);
}

async function click(client, text) {
  const found = await evaluate(client, `(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent?.replace(/\\s+/g,' ').trim()===${JSON.stringify(text)}); if(!b)return false; b.click(); return true })()`);
  if (!found) throw new Error(`Button not found: ${text}`);
  await sleep(160);
}

function assertion(section, name, pass, details = '', severity = 'normal') {
  section.push({ name, pass: Boolean(pass), details: String(details), severity });
}

async function openRecovery(client) {
  await evaluate(client, `(() => { const d=document.querySelector('[data-ui="ci-recovery-reserve"]'); if(d instanceof HTMLDetailsElement)d.open=true; return !!d })()`);
}

async function calculateKnown(client) {
  await navigate(client);
  await setRaw(client, 'ci-monthly-income', 50000);
  await setRaw(client, 'ci-household', 20000);
  await setRaw(client, 'ci-reserve-years', 5);
  await openRecovery(client);
  await setRaw(client, 'ci-recovery-treatment-visits', 4);
  await setRaw(client, 'ci-recovery-caregiver-days', 10);
  await setRaw(client, 'ci-recovery-rehab-sessions', 6);
  await setRaw(client, 'ci-recovery-home-rehab-sessions', 2);
  await setRaw(client, 'ci-recovery-equipment-home', 12000);
  await setRaw(client, 'ci-recovery-other', 3000);
  await click(client, 'ถัดไป');
  await setRaw(client, 'ci-lump-sum', 200000);
  await setRaw(client, 'ci-liquid-assets', 100000);
  await click(client, 'ดูผลคำนวณ');
  return evaluate(client, `(() => ({
    amount: document.querySelector('.ccpun-calculator-result-amount')?.textContent?.trim() || '',
    body: document.body.innerText,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    focused: document.activeElement?.tagName || '',
    recovery: document.querySelector('#ci-recovery-result-title')?.textContent || '',
    sourceLinks: [...document.querySelectorAll('#ci-recovery-result-title ~ details a')].map(a=>({href:a.href,target:a.target,rel:a.rel})),
    cta: (()=>{const a=[...document.querySelectorAll('a')].find(x=>x.textContent?.includes('คุยกับ CCPun ทาง LINE OA')); return a?{href:a.href,target:a.target,rel:a.rel,height:a.getBoundingClientRect().height}:null})(),
    download: (()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent?.includes('บันทึกภาพ')); return b?{height:b.getBoundingClientRect().height}:null})()
  }))()`);
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const report = { generatedAt: new Date().toISOString(), baseUrl: BASE_URL, route: ROUTE, browserAssertions: [], screenshots: [], networkMutations: [], consoleErrors: [], summary: {} };
  const target = await createTarget();
  const client = new CDP(target.webSocketDebuggerUrl);
  try {
    await client.connect();
    await client.send('Page.enable'); await client.send('Runtime.enable'); await client.send('Network.enable');
    client.on('Runtime.consoleAPICalled', (event) => {
      if (event.type === 'error') report.consoleErrors.push(event.args?.map((item) => item.value || item.description).join(' '));
    });
    client.on('Network.requestWillBeSent', ({ request }) => {
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) report.networkMutations.push({ method: request.method, url: request.url });
    });

    for (const item of VIEWPORTS) {
      await viewport(client, item); await navigate(client);
      const data = await evaluate(client, `(() => {
        const visible=x=>{const r=x.getBoundingClientRect(),s=getComputedStyle(x);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'};
        const controls=[...document.querySelectorAll('#ci-calculator input,#ci-calculator button')].filter(visible);
        const progress=document.querySelector('#ci-calculator [role="progressbar"]');
        return {
          h1:document.querySelectorAll('h1').length,
          active:!!document.querySelector('[data-ui="human-centered-ci-expenses"]'),
          overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,
          scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,
          fields:['ci-monthly-income','ci-household','ci-reserve-years'].map(id=>{const e=document.getElementById(id);return {id,exists:!!e,height:e?.getBoundingClientRect().height||0,label:e?.getAttribute('aria-label')||document.querySelector('label[for="'+id+'"]')?.textContent||''}}),
          buttons:controls.filter(x=>x.tagName==='BUTTON').map(x=>({text:x.textContent.trim(),height:x.getBoundingClientRect().height})),
          progress:progress?{now:progress.getAttribute('aria-valuenow'),min:progress.getAttribute('aria-valuemin'),max:progress.getAttribute('aria-valuemax')}:null,
          analyticsScripts:[...document.scripts].map(x=>x.src).filter(x=>/googletagmanager|facebook\.net/i.test(x)),
        };
      })()`);
      const prefix = item.name;
      assertion(report.browserAssertions, `${prefix}: one H1`, data.h1 === 1, data.h1);
      assertion(report.browserAssertions, `${prefix}: active CI wizard visible`, data.active);
      assertion(report.browserAssertions, `${prefix}: no horizontal overflow`, !data.overflow, `${data.scrollWidth}/${data.clientWidth}`);
      assertion(report.browserAssertions, `${prefix}: core controls exist and are labelled`, data.fields.every((field) => field.exists && field.label), JSON.stringify(data.fields));
      assertion(report.browserAssertions, `${prefix}: input touch targets >=44px`, data.fields.every((field) => field.height >= 44), JSON.stringify(data.fields), 'accessibility');
      assertion(report.browserAssertions, `${prefix}: action touch targets >=44px`, data.buttons.every((button) => button.height >= 44), JSON.stringify(data.buttons), 'accessibility');
      assertion(report.browserAssertions, `${prefix}: progress semantics step 1/2`, data.progress?.now === '1' && data.progress?.min === '1' && data.progress?.max === '2', JSON.stringify(data.progress));
      assertion(report.browserAssertions, `${prefix}: Preview has no GA/Meta scripts`, data.analyticsScripts.length === 0, JSON.stringify(data.analyticsScripts), 'privacy');
      if (['mobile-375', 'desktop-1920'].includes(item.name)) report.screenshots.push(await screenshot(client, `before-${item.name}`));
    }

    await viewport(client, VIEWPORTS.find((item) => item.name === 'desktop-1440'));
    await navigate(client); await click(client, 'ถัดไป');
    const blank = await evaluate(client, `(() => { const a=document.querySelector('[role="alert"]'); return {text:a?.textContent||'',focused:document.activeElement?.getAttribute('role')||document.activeElement?.id||document.activeElement?.tagName||''} })()`);
    assertion(report.browserAssertions, 'blank step shows Thai validation error', blank.text.includes('กรุณากรอก'), JSON.stringify(blank));
    assertion(report.browserAssertions, 'blank validation moves focus to alert', blank.focused === 'alert', JSON.stringify(blank), 'accessibility');

    const inputCases = [
      ['commas', '12,345', '12345'], ['spaces', '12 345', '12345'],
      ['letters around digits', 'abc123def', '123'], ['currency paste', '฿ 30,000 บาท', '30000'],
      ['negative fails closed', '-500', ''], ['decimal truncates safely', '123.45', '123'], ['Thai digits fail closed', '๑๒๓๔', ''],
    ];
    for (const [name, raw, expected] of inputCases) {
      await navigate(client); const actual = await setRaw(client, 'ci-monthly-income', raw);
      assertion(report.browserAssertions, `input: ${name}`, actual.replace(/,/g, '') === expected, `${raw} -> ${actual}`, 'data-integrity');
    }
    await navigate(client); await setRaw(client, 'ci-monthly-income', '9'.repeat(400), true);
    const infinity = await evaluate(client, `document.getElementById('ci-monthly-income').value`);
    assertion(report.browserAssertions, 'input: never renders Infinity', !/[∞]|Infinity/.test(infinity), infinity, 'data-integrity');

    await navigate(client);
    await setRaw(client, 'ci-monthly-income', 50000);
    await setRaw(client, 'ci-mortgage-payment', 15000);
    await setRaw(client, 'ci-mortgage-installments', 601);
    await click(client, 'ถัดไป');
    const mortgageError = await evaluate(client, `document.querySelector('[role="alert"]')?.textContent || ''`);
    assertion(report.browserAssertions, 'mortgage installments reject >600', mortgageError.includes('600'), mortgageError, 'data-integrity');

    await navigate(client);
    await setRaw(client, 'ci-monthly-income', 50000);
    await openRecovery(client);
    await setRaw(client, 'ci-recovery-rehab-sessions', 2);
    await setRaw(client, 'ci-recovery-home-rehab-sessions', 3);
    await click(client, 'ถัดไป');
    const rehabError = await evaluate(client, `document.querySelector('[role="alert"]')?.textContent || ''`);
    assertion(report.browserAssertions, 'home rehab cannot exceed total rehab', rehabError.includes('ไม่มากกว่า'), rehabError, 'data-integrity');

    const known = await calculateKnown(client);
    assertion(report.browserAssertions, 'known expense method = 1,229,822', known.amount.includes('1,229,822'), known.amount);
    assertion(report.browserAssertions, 'known Recovery Reserve = 29,822', known.recovery.includes('29,822'), known.recovery);
    assertion(report.browserAssertions, 'result keeps two methods separate', known.body.includes('ระบบแสดงสองวิธีแยกกันและไม่นำมาบวกกัน'));
    assertion(report.browserAssertions, 'result has no overflow', !known.overflow);
    assertion(report.browserAssertions, 'result heading receives focus', known.focused === 'H2', known.focused, 'accessibility');
    assertion(report.browserAssertions, 'LINE CTA contract is safe', known.cta?.href === 'https://lin.ee/tqLCs4f' && known.cta?.target === '_blank' && known.cta?.rel.includes('noopener') && known.cta?.rel.includes('noreferrer') && known.cta?.height >= 44, JSON.stringify(known.cta));
    assertion(report.browserAssertions, 'download control is present and >=44px', known.download?.height >= 44, JSON.stringify(known.download));
    report.screenshots.push(await screenshot(client, 'result-desktop-1440', '[data-ui="human-centered-ci-result"]'));

    await evaluate(client, `document.getElementById('ci-estimation-method-income')?.click()`); await sleep(80);
    const incomeMethod = await evaluate(client, `({amount:document.querySelector('.ccpun-calculator-result-amount')?.textContent||'',recovery:document.querySelector('#ci-recovery-result-title')?.textContent||''})`);
    assertion(report.browserAssertions, 'income method = 3,000,000', incomeMethod.amount.includes('3,000,000'), JSON.stringify(incomeMethod));
    assertion(report.browserAssertions, 'switching method does not alter Recovery Reserve', incomeMethod.recovery.includes('29,822'), JSON.stringify(incomeMethod));

    await click(client, 'แก้ไขข้อมูล');
    const preserved = await evaluate(client, `({income:document.getElementById('ci-monthly-income')?.value,household:document.getElementById('ci-household')?.value,reserve:document.getElementById('ci-reserve-years')?.value,recovery:document.getElementById('ci-recovery-treatment-visits')?.value})`);
    assertion(report.browserAssertions, 'edit preserves CI and Recovery inputs', preserved.income.replace(/,/g, '') === '50000' && preserved.household.replace(/,/g, '') === '20000' && preserved.reserve === '5' && preserved.recovery === '4', JSON.stringify(preserved));
    await click(client, 'ถัดไป'); await click(client, 'ดูผลคำนวณ'); await click(client, 'เริ่มใหม่');
    const reset = await evaluate(client, `({income:document.getElementById('ci-monthly-income')?.value,household:document.getElementById('ci-household')?.value,reserve:document.getElementById('ci-reserve-years')?.value,step:document.querySelector('#ci-calculator [role="progressbar"]')?.getAttribute('aria-valuenow')})`);
    assertion(report.browserAssertions, 'reset restores blank core inputs, 5 years, step 1', reset.income === '' && reset.household === '' && reset.reserve === '5' && reset.step === '1', JSON.stringify(reset));

    await viewport(client, VIEWPORTS.find((item) => item.name === 'mobile-375'));
    const mobile = await calculateKnown(client);
    assertion(report.browserAssertions, 'mobile result remains correct and overflow-free', mobile.amount.includes('1,229,822') && !mobile.overflow, mobile.amount);
    report.screenshots.push(await screenshot(client, 'result-mobile-375', '[data-ui="human-centered-ci-result"]'));

    assertion(report.browserAssertions, 'calculator causes no POST/PUT/PATCH/DELETE request', report.networkMutations.length === 0, JSON.stringify(report.networkMutations), 'privacy');
    assertion(report.browserAssertions, 'browser run has no console errors', report.consoleErrors.length === 0, JSON.stringify(report.consoleErrors));
  } finally {
    client.close();
    await fetch(`${CDP_HTTP}/json/close/${target.id}`, { method: 'PUT' }).catch(() => undefined);
  }

  report.summary.total = report.browserAssertions.length;
  report.summary.passed = report.browserAssertions.filter((item) => item.pass).length;
  report.summary.failed = report.browserAssertions.filter((item) => !item.pass).length;
  report.screenshots = report.screenshots.filter(Boolean);
  await writeFile(path.join(OUTPUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.summary));
  if (report.summary.failed) process.exitCode = 1;
}

main().catch(async (error) => {
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(path.join(OUTPUT_DIR, 'fatal-error.txt'), String(error.stack || error));
  console.error(error.stack || error);
  process.exitCode = 1;
});
