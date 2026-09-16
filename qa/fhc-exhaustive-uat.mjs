import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = process.env.UAT_BASE_URL || 'http://127.0.0.1:3005';
const CDP_HTTP = process.env.CDP_HTTP || 'http://127.0.0.1:9342';
const ROUTE = '/tools/financial-health-check/';
const OUTPUT_DIR = path.resolve('qa/fhc-exhaustive-uat');
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
  await sleep(350);
  await evaluate(client, `(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent?.trim()==='ยอมรับ'); if(b)b.click(); return true })()`);
  await sleep(100);
}

async function screenshot(client, name, selector = '#fhc-calculator') {
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
  await sleep(70);
  return evaluate(client, `document.getElementById(${JSON.stringify(id)})?.value`);
}

async function click(client, text) {
  const found = await evaluate(client, `(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent?.replace(/\\s+/g,' ').trim()===${JSON.stringify(text)}); if(!b)return false; b.click(); return true })()`);
  if (!found) throw new Error(`Button not found: ${text}`);
  await sleep(180);
}

function assertion(section, name, pass, details = '', severity = 'normal') {
  section.push({ name, pass: Boolean(pass), details: String(details), severity });
}

async function calculate(client, values) {
  await navigate(client);
  await setRaw(client, 'householdMonthly', values.householdMonthly);
  await setRaw(client, 'supportYears', values.supportYears);
  await setRaw(client, 'debt', values.debt);
  await setRaw(client, 'education', values.education);
  await click(client, 'ถัดไป');
  await setRaw(client, 'existingLifeCoverage', values.existingLifeCoverage);
  await setRaw(client, 'liquidAssets', values.liquidAssets);
  await click(client, 'ดูผลการคำนวณ');
  await evaluate(client, `(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent?.trim()==='ยอมรับ'); if(b)b.click(); return true })()`);
  await sleep(80);
  return evaluate(client, `(() => ({
    body: document.body.innerText,
    title: document.querySelector('#life-result-title')?.innerText || '',
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    cta: (()=>{const a=[...document.querySelectorAll('a')].find(x=>x.textContent?.includes('คุยกับ CCPun ทาง LINE OA')); return a?{href:a.href,target:a.target,rel:a.rel,height:a.getBoundingClientRect().height}:null})(),
    download: (()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent?.includes('บันทึกภาพสรุป')); return b?{describedBy:b.getAttribute('aria-describedby'),height:b.getBoundingClientRect().height}:null})()
  }))()`);
}

function formula(values) {
  const familySupport = values.householdMonthly * 12 * values.supportYears;
  const need = familySupport + values.debt + values.education;
  const resources = values.existingLifeCoverage + values.liquidAssets;
  return { familySupport, need, resources, gap: Math.max(need - resources, 0) };
}

function seededFormulaCases(section) {
  let state = 0xCCF4C;
  const next = () => (state = (state * 1664525 + 1013904223) >>> 0);
  const edgeCases = [
    { householdMonthly: 0, supportYears: 1, debt: 0, education: 0, existingLifeCoverage: 0, liquidAssets: 0 },
    { householdMonthly: 30000, supportYears: 10, debt: 200000, education: 50000, existingLifeCoverage: 100000, liquidAssets: 100000 },
    { householdMonthly: 1, supportYears: 20, debt: 1, education: 1, existingLifeCoverage: 242, liquidAssets: 0 },
    { householdMonthly: 999999, supportYears: 20, debt: 9999999, education: 9999999, existingLifeCoverage: 9999999, liquidAssets: 9999999 },
  ];
  const cases = [...edgeCases];
  while (cases.length < 64) cases.push({
    householdMonthly: next() % 500001, supportYears: 1 + next() % 20,
    debt: next() % 20_000_001, education: next() % 20_000_001,
    existingLifeCoverage: next() % 50_000_001, liquidAssets: next() % 50_000_001,
  });
  cases.forEach((values, index) => {
    const actual = formula(values);
    const needIndependent = (values.householdMonthly * values.supportYears * 12) + values.debt + values.education;
    const resourceIndependent = values.liquidAssets + values.existingLifeCoverage;
    const expectedGap = needIndependent > resourceIndependent ? needIndependent - resourceIndependent : 0;
    const monotonic = formula({ ...values, debt: values.debt + 1 }).gap >= actual.gap;
    assertion(section, `formula property case ${String(index + 1).padStart(2, '0')}`,
      actual.need === needIndependent && actual.resources === resourceIndependent && actual.gap === expectedGap && actual.gap >= 0 && monotonic,
      JSON.stringify({ values, actual }));
  });
}

async function staticChecks(section) {
  const life = await readFile('features/financial-health-check/components/LifeCoverageWizard.tsx', 'utf8');
  const currency = await readFile('components/ui/CurrencyInput.tsx', 'utf8');
  const analytics = await readFile('lib/analytics.ts', 'utf8');
  assertion(section, 'active two-step wizard formula source present', life.includes('values.householdMonthly * 12 * values.supportYears') && life.includes('Math.max(need - resources, 0)'));
  assertion(section, 'legacy wizard not imported by active client', !(await readFile('features/financial-health-check/components/ClientFHC.tsx', 'utf8')).includes('FHCWizard'));
  assertion(section, 'currency input requests numeric keyboard', currency.includes('inputMode="numeric"'));
  assertion(section, 'analytics allowlist omits calculator money fields', !analytics.includes("'householdMonthly'") && !analytics.includes("'existingLifeCoverage'"));
  assertion(section, 'FHC event calls do not attach value object', !/trackEvent\([^\n]+(?:householdMonthly|debt|education|existingLifeCoverage|liquidAssets)/.test(life));
  assertion(section, 'result has estimate and insurance-not-deposit disclosure', life.includes('ไม่ใช่คำแนะนำเฉพาะบุคคล') && life.includes('ประกันไม่ใช่เงินฝาก'));
  assertion(section, 'result does not promise sufficiency', life.includes('ไม่รับรองว่าจำนวนเงินนี้จะเพียงพอในทุกกรณี'));
  assertion(section, 'LINE CTA has safe new-tab relation', life.includes('target="_blank"') && life.includes('rel="noreferrer"'));
  if (process.env.CLOUD_HTML_PATH && process.env.CLOUD_HEADERS_PATH && process.env.CLOUD_ROBOTS_PATH) {
    const [html, headers, robots] = await Promise.all([
      readFile(process.env.CLOUD_HTML_PATH, 'utf8'),
      readFile(process.env.CLOUD_HEADERS_PATH, 'utf8'),
      readFile(process.env.CLOUD_ROBOTS_PATH, 'utf8'),
    ]);
    assertion(section, 'cloud FHC returns active two-step contract', html.includes('เริ่มจากภาระที่คนข้างหลังต้องดูแล') && html.includes('2 ขั้นตอน') && !html.includes('ขั้นตอนที่ 1 จาก 5'));
    assertion(section, 'cloud Preview sends full X-Robots-Tag guard', /x-robots-tag:\s*noindex, nofollow, noarchive/i.test(headers), headers.match(/x-robots-tag:[^\r\n]*/i)?.[0] || 'missing');
    assertion(section, 'cloud robots blocks all crawlers', /User-Agent:\s*\*/i.test(robots) && /Disallow:\s*\//i.test(robots), robots.trim());
    assertion(section, 'cloud HTML has no production analytics scripts', !/googletagmanager\.com|connect\.facebook\.net/i.test(html));
    assertion(section, 'cloud HTML includes UAT noindex metadata', /name="robots" content="noindex, nofollow"/i.test(html));
  } else {
    section.push({ name: 'cloud integrity evidence supplied', pass: false, blocked: true, details: 'Set CLOUD_HTML_PATH, CLOUD_HEADERS_PATH, CLOUD_ROBOTS_PATH', severity: 'cloud' });
  }
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const report = {
    generatedAt: new Date().toISOString(), baseUrl: BASE_URL, route: ROUTE,
    browserAssertions: [], formulaProperties: [], staticChecks: [], screenshots: [],
    networkMutations: [], consoleErrors: [], notes: [], summary: {},
  };
  seededFormulaCases(report.formulaProperties);
  await staticChecks(report.staticChecks);

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
        const controls=[...document.querySelectorAll('#fhc-calculator input,#fhc-calculator button')].filter(visible);
        const progress=document.querySelector('[role="progressbar"]');
        return {
          h1:document.querySelectorAll('h1').length,
          activeTitle:document.body.innerText.includes('เริ่มจากภาระที่คนข้างหลังต้องดูแล'),
          legacy:document.body.innerText.includes('ขั้นตอนที่ 1 จาก 5'),
          overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,
          scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,
          fields:['householdMonthly','supportYears','debt','education'].map(id=>{const e=document.getElementById(id);const l=document.querySelector('label[for="'+id+'"],legend');return {id,exists:!!e,height:e?.getBoundingClientRect().height||0,labelled:id==='supportYears'?e?.getAttribute('aria-label'):l?.textContent}}),
          buttons:controls.filter(x=>x.tagName==='BUTTON').map(x=>({text:x.textContent.trim(),height:x.getBoundingClientRect().height})),
          progress:progress?{now:progress.getAttribute('aria-valuenow'),min:progress.getAttribute('aria-valuemin'),max:progress.getAttribute('aria-valuemax'),label:progress.getAttribute('aria-label')}:null,
          analyticsScripts:[...document.scripts].map(x=>x.src).filter(x=>/googletagmanager|facebook\.net/i.test(x)),
        };
      })()`);
      const prefix = item.name;
      assertion(report.browserAssertions, `${prefix}: one H1`, data.h1 === 1, data.h1);
      assertion(report.browserAssertions, `${prefix}: active LifeCoverageWizard visible`, data.activeTitle && !data.legacy);
      assertion(report.browserAssertions, `${prefix}: no horizontal overflow`, !data.overflow, `${data.scrollWidth}/${data.clientWidth}`);
      assertion(report.browserAssertions, `${prefix}: four step-one controls exist`, data.fields.every((field) => field.exists), JSON.stringify(data.fields));
      assertion(report.browserAssertions, `${prefix}: fields have accessible names`, data.fields.every((field) => Boolean(field.labelled)), JSON.stringify(data.fields));
      assertion(report.browserAssertions, `${prefix}: input touch targets >=44px`, data.fields.every((field) => field.height >= 44), JSON.stringify(data.fields));
      assertion(report.browserAssertions, `${prefix}: action touch targets >=44px`, data.buttons.every((button) => button.height >= 44), JSON.stringify(data.buttons));
      assertion(report.browserAssertions, `${prefix}: progress semantics step 1/2`, data.progress?.now === '1' && data.progress?.min === '1' && data.progress?.max === '2', JSON.stringify(data.progress));
      assertion(report.browserAssertions, `${prefix}: Preview has no GA/Meta scripts`, data.analyticsScripts.length === 0, JSON.stringify(data.analyticsScripts));
      if (['mobile-375', 'desktop-1920'].includes(item.name)) report.screenshots.push(await screenshot(client, `before-${item.name}`));
    }

    await viewport(client, VIEWPORTS.find((item) => item.name === 'desktop-1440'));
    await navigate(client); await click(client, 'ถัดไป');
    const error = await evaluate(client, `(() => { const a=document.querySelector('[role="alert"]'),i=document.getElementById('householdMonthly'); return {text:a?.textContent||'',invalid:i?.getAttribute('aria-invalid'),described:i?.getAttribute('aria-describedby'),active:document.activeElement?.id||document.activeElement?.tagName||''} })()`);
    assertion(report.browserAssertions, 'blank required amount shows Thai error', error.text.includes('กรอกค่าใช้จ่ายครัวเรือน'));
    assertion(report.browserAssertions, 'blank error marks input invalid and associates message', error.invalid === 'true' && error.described?.includes('error'), JSON.stringify(error), 'accessibility');
    assertion(report.browserAssertions, 'blank error moves focus to invalid input', error.active === 'householdMonthly', JSON.stringify(error), 'accessibility');
    report.screenshots.push(await screenshot(client, 'error-desktop-1440'));

    const inputCases = [
      ['commas', '12,345', '12345', true], ['spaces', '12 345', '12345', true],
      ['letters around digits', 'abc123def', '123', true], ['currency copy-paste', '฿ 30,000 บาท', '30000', true],
      ['leading zeros', '000123', '123', true], ['negative sign is not reinterpreted', '-500', '', false],
      ['decimal is not multiplied by digit concatenation', '123.45', '123', false], ['Thai digits fail closed', '๑๒๓๔', '', true],
    ];
    for (const [name, raw, expected, shouldPass] of inputCases) {
      await navigate(client); const actual = await setRaw(client, 'householdMonthly', raw);
      const normalizedActual = actual.replace(/,/g, '');
      assertion(report.browserAssertions, `input: ${name}`, normalizedActual === expected, `${raw} -> ${actual}`, shouldPass ? 'normal' : 'data-integrity');
    }
    await navigate(client); await setRaw(client, 'householdMonthly', '30000', true);
    const formatted = await evaluate(client, `document.getElementById('householdMonthly').value`);
    await evaluate(client, `document.getElementById('householdMonthly').focus()`); await sleep(80);
    const refocused = await evaluate(client, `document.getElementById('householdMonthly').value`);
    assertion(report.browserAssertions, 'input: formats comma on blur', formatted === '30,000', formatted);
    assertion(report.browserAssertions, 'input: refocus preserves semantic value', refocused.replace(/[^0-9]/g, '') === '30000', refocused);
    const deleted = await setRaw(client, 'householdMonthly', '', true);
    assertion(report.browserAssertions, 'input: deletion returns blank safely', deleted === '', deleted);

    await navigate(client);
    const hugeRaw = '9'.repeat(30); const huge = await setRaw(client, 'householdMonthly', hugeRaw, true);
    const hugeState = await evaluate(client, `(() => {const v=document.getElementById('householdMonthly').value;return {value:v,safe:Number.isSafeInteger(Number(v.replace(/,/g,'')))}})()`);
    assertion(report.browserAssertions, 'input: rejects values beyond safe integer', hugeState.safe === true && huge.length < 20, JSON.stringify(hugeState), 'data-integrity');
    await navigate(client); await setRaw(client, 'householdMonthly', '9'.repeat(400), true);
    const infinity = await evaluate(client, `document.getElementById('householdMonthly').value`);
    assertion(report.browserAssertions, 'input: never renders Infinity', !/[∞]|Infinity/.test(infinity), infinity, 'data-integrity');

    const known = await calculate(client, { householdMonthly: 30000, supportYears: 10, debt: 200000, education: 50000, existingLifeCoverage: 100000, liquidAssets: 100000 });
    assertion(report.browserAssertions, 'known formula browser result = 3,650,000', known.title.includes('3,650,000 บาท'), known.title);
    assertion(report.browserAssertions, 'result contains all breakdown rows', known.body.includes('3,600,000 บาท') && known.body.includes('250,000 บาท') && known.body.includes('200,000 บาท'));
    assertion(report.browserAssertions, 'result has no overflow', !known.overflow);
    assertion(report.browserAssertions, 'LINE CTA contract is safe', known.cta?.href === 'https://lin.ee/tqLCs4f' && known.cta?.target === '_blank' && known.cta?.rel.includes('noreferrer') && known.cta?.height >= 44, JSON.stringify(known.cta));
    assertion(report.browserAssertions, 'download control is present and described', known.download?.describedBy?.includes('fhc-image-privacy') && known.download?.height >= 44, JSON.stringify(known.download));
    report.screenshots.push(await screenshot(client, 'result-desktop-1440', 'main section[aria-labelledby="life-result-title"]'));

    const scenarios = [
      ['min years', { householdMonthly: 1, supportYears: 1, debt: 0, education: 0, existingLifeCoverage: 0, liquidAssets: 0 }, '12 บาท'],
      ['max years', { householdMonthly: 1, supportYears: 20, debt: 0, education: 0, existingLifeCoverage: 0, liquidAssets: 0 }, '240 บาท'],
      ['zero optional fields', { householdMonthly: 30000, supportYears: 10, debt: 0, education: 0, existingLifeCoverage: 0, liquidAssets: 0 }, '3,600,000 บาท'],
      ['resources equal need', { householdMonthly: 1000, supportYears: 1, debt: 500, education: 500, existingLifeCoverage: 5000, liquidAssets: 8000 }, '0 บาท'],
      ['resources above need', { householdMonthly: 1000, supportYears: 1, debt: 0, education: 0, existingLifeCoverage: 20000, liquidAssets: 1 }, '0 บาท'],
    ];
    for (const [name, values, expected] of scenarios) {
      const actual = await calculate(client, values);
      assertion(report.browserAssertions, `scenario: ${name}`, actual.title.includes(expected), actual.title);
    }

    await calculate(client, { householdMonthly: 1000, supportYears: 10, debt: 0, education: 0, existingLifeCoverage: 0, liquidAssets: 0 });
    await click(client, 'แก้ไขข้อมูล'); await click(client, 'ย้อนกลับ');
    const preserved = await evaluate(client, `({monthly:document.getElementById('householdMonthly')?.value,years:document.getElementById('supportYears')?.value})`);
    assertion(report.browserAssertions, 'edit/back preserves entered values', preserved.monthly.replace(/,/g, '') === '1000' && preserved.years === '10', JSON.stringify(preserved));
    await click(client, 'ถัดไป'); await click(client, 'ดูผลการคำนวณ'); await click(client, 'เริ่มใหม่');
    const reset = await evaluate(client, `({monthly:document.getElementById('householdMonthly')?.value,years:document.getElementById('supportYears')?.value,step:document.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')})`);
    assertion(report.browserAssertions, 'reset restores blank amount, 10 years, step 1', reset.monthly === '' && reset.years === '10' && reset.step === '1', JSON.stringify(reset));

    await navigate(client); await evaluate(client, `document.getElementById('householdMonthly').focus()`);
    const focusOrder = ['supportYears', 'debt', 'เพิ่มทุนการศึกษาบุตร (ถ้ามี)'];
    const observed = [];
    for (let i = 0; i < 3; i++) {
      await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
      await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
      observed.push(await evaluate(client, `(() => { const active=document.activeElement; return active?.id || active?.textContent?.replace(/\\s+/g,' ').trim() || active?.tagName || ''; })()`));
    }
    assertion(report.browserAssertions, 'keyboard focus order follows visible controls', JSON.stringify(observed) === JSON.stringify(focusOrder), JSON.stringify(observed));
    await evaluate(client, `document.getElementById('supportYears').focus()`);
    await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
    await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
    const slider = await evaluate(client, `({value:document.getElementById('supportYears').value,output:document.querySelector('output[for="supportYears"]').textContent})`);
    assertion(report.browserAssertions, 'slider keyboard increments 10 to 11', slider.value === '11' && slider.output.includes('11'), JSON.stringify(slider));

    await viewport(client, VIEWPORTS.find((item) => item.name === 'mobile-375'));
    const mobileResult = await calculate(client, { householdMonthly: 30000, supportYears: 10, debt: 200000, education: 50000, existingLifeCoverage: 100000, liquidAssets: 100000 });
    assertion(report.browserAssertions, 'mobile result formula and no overflow', mobileResult.title.includes('3,650,000') && !mobileResult.overflow, mobileResult.title);
    report.screenshots.push(await screenshot(client, 'result-mobile-375', 'main section[aria-labelledby="life-result-title"]'));

    assertion(report.browserAssertions, 'calculation causes no POST/PUT/PATCH/DELETE network request', report.networkMutations.length === 0, JSON.stringify(report.networkMutations), 'privacy');
  } finally {
    client.close();
    await fetch(`${CDP_HTTP}/json/close/${target.id}`, { method: 'PUT' }).catch(() => undefined);
  }

  for (const section of ['browserAssertions', 'formulaProperties', 'staticChecks']) {
    const checks = report[section];
    report.summary[section] = { total: checks.length, passed: checks.filter((item) => item.pass).length, failed: checks.filter((item) => !item.pass).length };
  }
  report.summary.total = Object.values(report.summary).reduce((sum, item) => sum + (item.total || 0), 0);
  report.summary.passed = Object.values(report.summary).reduce((sum, item) => sum + (item.passed || 0), 0);
  report.summary.failed = Object.values(report.summary).reduce((sum, item) => sum + (item.failed || 0), 0);
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
