import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = process.env.UAT_BASE_URL || 'http://127.0.0.1:3005';
const CDP_HTTP = process.env.CDP_HTTP || 'http://127.0.0.1:9342';
const ROUTE = '/ci-planning/';
const OUTPUT_DIR = path.resolve('qa/ci-recovery-additive-uat');
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
  await sleep(180);
}

async function openRecovery(client) {
  const opened = await evaluate(client, `(() => { const d=document.querySelector('[data-ui="ci-recovery-reserve"]'); if(!(d instanceof HTMLDetailsElement))return false; d.open=true; return true })()`);
  if (!opened) throw new Error('Recovery Reserve details not found');
}

async function capture(client, name) {
  const data = await client.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: true });
  const file = path.join(OUTPUT_DIR, `${name}.png`);
  await writeFile(file, Buffer.from(data.data, 'base64'));
  return path.relative(process.cwd(), file);
}

function check(report, name, pass, details = '', severity = 'normal') {
  report.checks.push({ name, pass: Boolean(pass), details: String(details), severity });
}

async function fillKnownScenario(client) {
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
}

async function resultState(client) {
  return evaluate(client, `(() => ({
    amount: document.querySelector('.ccpun-calculator-result-amount')?.textContent?.trim() || '',
    body: document.body.innerText,
    recovery: document.querySelector('#ci-recovery-result-title')?.textContent || '',
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    focused: document.activeElement?.tagName || '',
    progress: document.querySelector('#ci-calculator [role="progressbar"]')?.getAttribute('aria-valuenow') || null
  }))()`);
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const report = { generatedAt: new Date().toISOString(), checks: [], consoleErrors: [], networkMutations: [], screenshots: [], summary: {} };
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
      const state = await evaluate(client, `(() => {
        const visible=x=>{const r=x.getBoundingClientRect(),s=getComputedStyle(x);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'};
        const controls=[...document.querySelectorAll('#ci-calculator input,#ci-calculator button')].filter(visible);
        return {
          active: !!document.querySelector('[data-ui="human-centered-ci-expenses"]'),
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          touch: controls.every(x=>x.getBoundingClientRect().height>=44),
          progress: document.querySelector('#ci-calculator [role="progressbar"]')?.getAttribute('aria-valuenow') || null
        };
      })()`);
      check(report, `${item.name}: wizard visible`, state.active);
      check(report, `${item.name}: no horizontal overflow`, !state.overflow);
      check(report, `${item.name}: visible controls >=44px`, state.touch, JSON.stringify(state), 'accessibility');
      check(report, `${item.name}: starts step 1`, state.progress === '1', JSON.stringify(state));
    }

    await viewport(client, VIEWPORTS.find((item) => item.name === 'desktop-1440'));
    await navigate(client); await click(client, 'ถัดไป');
    const blank = await evaluate(client, `({alert:document.querySelector('[role="alert"]')?.textContent||'',focus:document.activeElement?.getAttribute('role')||''})`);
    check(report, 'blank step validates and focuses alert', blank.alert.includes('กรุณากรอก') && blank.focus === 'alert', JSON.stringify(blank), 'accessibility');

    await navigate(client); await setRaw(client, 'ci-monthly-income', 50000); await openRecovery(client);
    await setRaw(client, 'ci-recovery-rehab-sessions', 2); await setRaw(client, 'ci-recovery-home-rehab-sessions', 3); await click(client, 'ถัดไป');
    const rehabError = await evaluate(client, `document.querySelector('[role="alert"]')?.textContent || ''`);
    check(report, 'home rehab cannot exceed total rehab', rehabError.includes('ไม่มากกว่า'), rehabError, 'data-integrity');

    for (const [name, raw, expected] of [
      ['negative fails closed', '-500', ''],
      ['decimal truncates safely', '123.45', '123'],
      ['currency paste normalizes', '฿ 30,000 บาท', '30000'],
      ['Thai digits fail closed', '๑๒๓๔', ''],
    ]) {
      await navigate(client);
      const actual = await setRaw(client, 'ci-monthly-income', raw);
      check(report, `input: ${name}`, actual.replace(/,/g, '') === expected, `${raw} -> ${actual}`, 'data-integrity');
    }

    await fillKnownScenario(client);
    let result = await resultState(client);
    check(report, 'expense base 1,200,000 + Recovery 29,822 = total 1,229,822', result.amount.includes('1,229,822'), result.amount);
    check(report, 'Recovery stays visibly separate at 29,822', result.recovery.includes('29,822'), result.recovery);
    check(report, 'result explains Recovery is added once', result.body.includes('Recovery Reserve เพียง 1 ครั้ง') || result.body.includes('บวกเพิ่ม 1 ครั้ง'), 'copy contract');
    check(report, 'result says the two methods are not added together', result.body.includes('สองวิธีไม่ถูกนำมาบวกกัน') || result.body.includes('ไม่ได้นำสองวิธีมาบวกเข้าหากัน'), 'copy contract');
    check(report, 'expense result is overflow-free and focused', !result.overflow && result.focused === 'H2', JSON.stringify(result), 'accessibility');
    report.screenshots.push(await capture(client, 'expense-desktop-1440'));

    await evaluate(client, `document.getElementById('ci-estimation-method-income')?.click()`); await sleep(100);
    result = await resultState(client);
    check(report, 'income base 3,000,000 + same Recovery 29,822 = total 3,029,822', result.amount.includes('3,029,822'), result.amount);
    check(report, 'switching method keeps Recovery 29,822 unchanged', result.recovery.includes('29,822'), result.recovery);

    await click(client, 'แก้ไขข้อมูล');
    const preserved = await evaluate(client, `({income:document.getElementById('ci-monthly-income')?.value,household:document.getElementById('ci-household')?.value,recovery:document.getElementById('ci-recovery-treatment-visits')?.value})`);
    check(report, 'edit preserves base and Recovery inputs', preserved.income.replace(/,/g, '') === '50000' && preserved.household.replace(/,/g, '') === '20000' && preserved.recovery === '4', JSON.stringify(preserved));

    await click(client, 'ถัดไป'); await click(client, 'ดูผลคำนวณ'); await click(client, 'เริ่มใหม่');
    const reset = await evaluate(client, `({income:document.getElementById('ci-monthly-income')?.value,household:document.getElementById('ci-household')?.value,step:document.querySelector('#ci-calculator [role="progressbar"]')?.getAttribute('aria-valuenow')})`);
    check(report, 'reset restores step 1 and blank core values', reset.income === '' && reset.household === '' && reset.step === '1', JSON.stringify(reset));

    await viewport(client, VIEWPORTS.find((item) => item.name === 'mobile-375'));
    await fillKnownScenario(client);
    result = await resultState(client);
    check(report, 'mobile expense total is correct and overflow-free', result.amount.includes('1,229,822') && !result.overflow, JSON.stringify(result));
    report.screenshots.push(await capture(client, 'expense-mobile-375'));

    check(report, 'calculator makes no mutating network request', report.networkMutations.length === 0, JSON.stringify(report.networkMutations), 'privacy');
    check(report, 'browser run has no console errors', report.consoleErrors.length === 0, JSON.stringify(report.consoleErrors));
  } finally {
    client.close();
    await fetch(`${CDP_HTTP}/json/close/${target.id}`, { method: 'PUT' }).catch(() => undefined);
  }

  report.summary.total = report.checks.length;
  report.summary.passed = report.checks.filter((item) => item.pass).length;
  report.summary.failed = report.checks.filter((item) => !item.pass).length;
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
