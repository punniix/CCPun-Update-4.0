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
  constructor(url) {
    this.url = url;
    this.id = 1;
    this.pending = new Map();
    this.listeners = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.url);
    this.ws.addEventListener('message', ({ data }) => {
      const message = JSON.parse(data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        return message.error
          ? pending.reject(new Error(message.error.message))
          : pending.resolve(message.result || {});
      }
      for (const listener of this.listeners.get(message.method) || []) {
        listener(message.params || {});
      }
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
        this.listeners.set(
          method,
          (this.listeners.get(method) || []).filter((item) => item !== callback),
        );
        resolve(params);
      };
      this.on(method, callback);
    });
  }

  close() {
    this.ws?.close();
  }
}

async function createTarget() {
  const response = await fetch(
    `${CDP_HTTP}/json/new?${encodeURIComponent('about:blank')}`,
    { method: 'PUT' },
  );
  if (!response.ok) throw new Error(`Chrome CDP unavailable: ${response.status}`);
  return response.json();
}

async function evaluate(client, expression) {
  const result = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  }
  return result.result?.value;
}

async function viewport(client, item) {
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: item.width,
    height: item.height,
    deviceScaleFactor: 1,
    mobile: item.mobile,
    screenWidth: item.width,
    screenHeight: item.height,
    dontSetVisibleSize: false,
  });
  await client.send('Emulation.setTouchEmulationEnabled', {
    enabled: item.mobile,
    maxTouchPoints: item.mobile ? 5 : 1,
  });
}

async function navigate(client) {
  const loaded = client.once('Page.loadEventFired');
  await client.send('Page.navigate', { url: `${BASE_URL}${ROUTE}` });
  await loaded;
  await evaluate(client, `document.fonts?.ready?.then(() => true) ?? true`);
  await sleep(300);
  await evaluate(
    client,
    `(() => {
      const button = [...document.querySelectorAll('button')]
        .find((item) => item.textContent?.trim() === 'ยอมรับ');
      if (button) button.click();
      return true;
    })()`,
  );
  await sleep(80);
}

async function setRaw(client, id, raw, blur = false) {
  const result = await evaluate(client, `(() => {
    const input = document.getElementById(${JSON.stringify(id)});
    if (!(input instanceof HTMLInputElement)) return null;
    input.focus();
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    set.call(input, ${JSON.stringify(String(raw))});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    if (${blur}) input.blur();
    return true;
  })()`);

  if (!result) throw new Error(`Input not found: ${id}`);
  await sleep(80);
  return evaluate(
    client,
    `document.getElementById(${JSON.stringify(id)})?.value`,
  );
}

async function click(client, text) {
  const found = await evaluate(client, `(() => {
    const button = [...document.querySelectorAll('button')]
      .find((item) => item.textContent?.replace(/\\s+/g, ' ').trim() === ${JSON.stringify(text)});
    if (!button) return false;
    button.click();
    return true;
  })()`);

  if (!found) throw new Error(`Button not found: ${text}`);
  await sleep(200);
}

async function choose(client, id) {
  const selected = await evaluate(client, `(() => {
    const input = document.getElementById(${JSON.stringify(id)});
    if (!(input instanceof HTMLInputElement)) return false;
    input.click();
    return input.checked;
  })()`);

  if (!selected) throw new Error(`Choice not selectable: ${id}`);
  await sleep(120);
}

async function openDetailsBySummary(client, summaryText) {
  const opened = await evaluate(client, `(() => {
    const target = [...document.querySelectorAll('details')].find((details) => {
      const summary = details.querySelector(':scope > summary');
      return summary?.textContent?.replace(/\\s+/g, ' ').trim() === ${JSON.stringify(summaryText)};
    });
    if (!(target instanceof HTMLDetailsElement)) return false;
    target.open = true;
    return true;
  })()`);

  if (!opened) throw new Error(`Details not found: ${summaryText}`);
  await sleep(80);
}

async function capture(client, name) {
  const data = await client.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: true,
  });
  const file = path.join(OUTPUT_DIR, `${name}.png`);
  await writeFile(file, Buffer.from(data.data, 'base64'));
  return path.relative(process.cwd(), file);
}

function check(report, name, pass, details = '', severity = 'normal') {
  report.checks.push({
    name,
    pass: Boolean(pass),
    details: String(details),
    severity,
  });
}

async function fillKnownScenario(client) {
  await navigate(client);
  await setRaw(client, 'ci-monthly-income', 50000);
  await setRaw(client, 'ci-household', 20000);
  await choose(client, 'ci-recovery-choice-continued');
  await click(client, 'ถัดไป');
  await setRaw(client, 'ci-lump-sum', 200000);
  await setRaw(client, 'ci-liquid-assets', 100000);
  await click(client, 'ดูผลคำนวณ');
}

async function resultState(client) {
  return evaluate(client, `(() => {
    const recoveryTitle = document.getElementById('ci-recovery-result-title');
    const recoverySection = recoveryTitle?.closest('section');
    return {
      amount: document.querySelector('.ccpun-calculator-result-amount')?.textContent?.trim() || '',
      body: document.body.innerText,
      recovery: recoverySection?.innerText || '',
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      focused: document.activeElement?.tagName || '',
      progress: document.querySelector('#ci-calculator [role="progressbar"]')?.getAttribute('aria-valuenow') || null
    };
  })()`);
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const report = {
    generatedAt: new Date().toISOString(),
    checks: [],
    consoleErrors: [],
    networkMutations: [],
    screenshots: [],
    summary: {},
  };

  const target = await createTarget();
  const client = new CDP(target.webSocketDebuggerUrl);

  try {
    await client.connect();
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Network.enable');

    client.on('Runtime.consoleAPICalled', (event) => {
      if (event.type === 'error') {
        report.consoleErrors.push(
          event.args?.map((item) => item.value || item.description).join(' '),
        );
      }
    });

    client.on('Network.requestWillBeSent', ({ request }) => {
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
        report.networkMutations.push({ method: request.method, url: request.url });
      }
    });

    for (const item of VIEWPORTS) {
      await viewport(client, item);
      await navigate(client);

      const state = await evaluate(client, `(() => {
        const visible = (element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return rect.width > 0 && rect.height > 0
            && style.visibility !== 'hidden'
            && style.display !== 'none';
        };

        const controls = [
          ...document.querySelectorAll('#ci-calculator input, #ci-calculator button')
        ].filter(visible);

        const targetHeightOkay = controls.every((control) => {
          if (
            control instanceof HTMLInputElement
            && (control.type === 'radio' || control.type === 'checkbox')
          ) {
            const label = [...document.querySelectorAll('label')]
              .find((item) => item.htmlFor === control.id);
            return !!label && label.getBoundingClientRect().height >= 44;
          }
          return control.getBoundingClientRect().height >= 44;
        });

        const choices = [
          'ci-recovery-choice-basic',
          'ci-recovery-choice-continued',
          'ci-recovery-choice-longTerm',
          'ci-recovery-choice-custom',
        ].every((id) => document.getElementById(id) instanceof HTMLInputElement);

        return {
          active: !!document.querySelector('[data-ui="human-centered-ci-expenses"]'),
          recovery: !!document.querySelector('[data-ui="ci-recovery-reserve"]'),
          choices,
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          touch: targetHeightOkay,
          progress: document.querySelector('#ci-calculator [role="progressbar"]')?.getAttribute('aria-valuenow') || null,
        };
      })()`);

      check(report, `${item.name}: wizard visible`, state.active);
      check(report, `${item.name}: Recovery Reserve visible`, state.recovery);
      check(report, `${item.name}: all four Recovery choices exist`, state.choices);
      check(report, `${item.name}: no horizontal overflow`, !state.overflow);
      check(
        report,
        `${item.name}: interactive targets are at least 44px`,
        state.touch,
        JSON.stringify(state),
        'accessibility',
      );
      check(
        report,
        `${item.name}: starts step 1`,
        state.progress === '1',
        JSON.stringify(state),
      );
    }

    await viewport(client, VIEWPORTS.find((item) => item.name === 'desktop-1440'));

    await navigate(client);
    await click(client, 'ถัดไป');
    const blank = await evaluate(
      client,
      `({
        alert: document.querySelector('[role="alert"]')?.textContent || '',
        focus: document.activeElement?.getAttribute('role') || ''
      })`,
    );
    check(
      report,
      'blank step validates and focuses alert',
      blank.alert.includes('กรุณากรอก') && blank.focus === 'alert',
      JSON.stringify(blank),
      'accessibility',
    );

    for (const [name, raw, expected] of [
      ['negative fails closed', '-500', ''],
      ['decimal truncates safely', '123.45', '123'],
      ['currency paste normalizes', '฿ 30,000 บาท', '30000'],
      ['Thai digits fail closed', '๑๒๓๔', ''],
    ]) {
      await navigate(client);
      const actual = await setRaw(client, 'ci-monthly-income', raw);
      check(
        report,
        `input: ${name}`,
        actual.replace(/,/g, '') === expected,
        `${raw} -> ${actual}`,
        'data-integrity',
      );
    }

    await navigate(client);
    await setRaw(client, 'ci-monthly-income', 50000);
    await choose(client, 'ci-recovery-choice-custom');
    await setRaw(client, 'ci-recovery-custom-target', 800000);
    await click(client, 'จัดตัวอย่างรายการตามยอดนี้');
    await openDetailsBySummary(client, 'ดูและแก้ไขรายการย่อย');

    const customBefore = await evaluate(client, `(() => ({
      target: document.getElementById('ci-recovery-custom-target')?.value || '',
      caregiver: document.getElementById('ci-recovery-caregiver-days')?.value || '',
      majorHousing: document.getElementById('ci-recovery-majorHousing')?.value || '',
      text: document.querySelector('[data-ui="ci-recovery-reserve"]')?.innerText || ''
    }))()`);

    check(
      report,
      'custom 800,000 reserve builds editable detail',
      customBefore.target.replace(/,/g, '') === '800000'
        && customBefore.caregiver !== ''
        && customBefore.majorHousing !== '',
      JSON.stringify(customBefore),
      'data-integrity',
    );

    await setRaw(client, 'ci-recovery-majorHousing', 2500000);
    const customAfter = await evaluate(client, `(() => ({
      target: document.getElementById('ci-recovery-custom-target')?.value || '',
      text: document.querySelector('[data-ui="ci-recovery-reserve"]')?.innerText || ''
    }))()`);

    check(
      report,
      'editing a custom line item does not silently change the headline reserve',
      customAfter.target.replace(/,/g, '') === '800000',
      JSON.stringify(customAfter),
      'data-integrity',
    );
    check(
      report,
      'custom detail visibly reports when line items exceed the chosen reserve',
      customAfter.text.includes('สูงกว่าเงินก้อนที่ตั้งไว้'),
      'over-budget message',
      'data-integrity',
    );

    await fillKnownScenario(client);
    let result = await resultState(client);

    check(
      report,
      'expense base 1,200,000 + Recovery 500,000 = total 1,700,000',
      result.amount.includes('1,700,000'),
      result.amount,
    );
    check(
      report,
      'Recovery 500,000 remains a visibly separate planning block',
      result.recovery.includes('500,000')
        && result.recovery.includes('เผื่อฟื้นฟูต่อเนื่อง'),
      result.recovery,
    );
    check(
      report,
      'result explains Recovery is added once',
      result.body.includes('Recovery Reserve เพียง 1 ครั้ง')
        || result.body.includes('บวกเพิ่มเพียง 1 ครั้ง')
        || result.body.includes('บวก Recovery Reserve ก้อนเดียวกัน 1 ครั้ง'),
      'copy contract',
    );
    check(
      report,
      'result says the two methods are not added together',
      result.body.includes('สองวิธีแยกกันและไม่นำมาบวกกัน')
        || result.body.includes('ไม่ได้นำสองวิธีมาบวกเข้าหากัน'),
      'copy contract',
    );
    check(
      report,
      'expense result is overflow-free and focused',
      !result.overflow && result.focused === 'H2',
      JSON.stringify(result),
      'accessibility',
    );

    report.screenshots.push(await capture(client, 'expense-desktop-1440'));

    await evaluate(
      client,
      `document.getElementById('ci-estimation-method-income')?.click()`,
    );
    await sleep(100);

    result = await resultState(client);
    check(
      report,
      'income base 3,000,000 + same Recovery 500,000 = total 3,500,000',
      result.amount.includes('3,500,000'),
      result.amount,
    );
    check(
      report,
      'switching estimation method keeps the same Recovery block',
      result.recovery.includes('500,000'),
      result.recovery,
    );

    await click(client, 'แก้ไขข้อมูล');
    const preserved = await evaluate(client, `(() => ({
      income: document.getElementById('ci-monthly-income')?.value || '',
      household: document.getElementById('ci-household')?.value || '',
      continued: document.getElementById('ci-recovery-choice-continued')?.checked || false
    }))()`);

    check(
      report,
      'edit preserves base inputs and selected Recovery choice',
      preserved.income.replace(/,/g, '') === '50000'
        && preserved.household.replace(/,/g, '') === '20000'
        && preserved.continued === true,
      JSON.stringify(preserved),
    );

    await click(client, 'ถัดไป');
    await click(client, 'ดูผลคำนวณ');
    await click(client, 'เริ่มใหม่');

    const reset = await evaluate(client, `(() => ({
      income: document.getElementById('ci-monthly-income')?.value || '',
      household: document.getElementById('ci-household')?.value || '',
      basic: document.getElementById('ci-recovery-choice-basic')?.checked || false,
      continued: document.getElementById('ci-recovery-choice-continued')?.checked || false,
      longTerm: document.getElementById('ci-recovery-choice-longTerm')?.checked || false,
      custom: document.getElementById('ci-recovery-choice-custom')?.checked || false,
      step: document.querySelector('#ci-calculator [role="progressbar"]')?.getAttribute('aria-valuenow')
    }))()`);

    check(
      report,
      'reset restores step 1, blank core values and no Recovery choice',
      reset.income === ''
        && reset.household === ''
        && !reset.basic
        && !reset.continued
        && !reset.longTerm
        && !reset.custom
        && reset.step === '1',
      JSON.stringify(reset),
    );

    await viewport(client, VIEWPORTS.find((item) => item.name === 'mobile-375'));
    await fillKnownScenario(client);
    result = await resultState(client);

    check(
      report,
      'mobile expense total is correct and overflow-free',
      result.amount.includes('1,700,000') && !result.overflow,
      JSON.stringify(result),
    );
    report.screenshots.push(await capture(client, 'expense-mobile-375'));

    check(
      report,
      'calculator makes no mutating network request',
      report.networkMutations.length === 0,
      JSON.stringify(report.networkMutations),
      'privacy',
    );
    check(
      report,
      'browser run has no console errors',
      report.consoleErrors.length === 0,
      JSON.stringify(report.consoleErrors),
    );
  } finally {
    client.close();
    await fetch(`${CDP_HTTP}/json/close/${target.id}`, { method: 'PUT' })
      .catch(() => undefined);
  }

  report.summary.total = report.checks.length;
  report.summary.passed = report.checks.filter((item) => item.pass).length;
  report.summary.failed = report.checks.filter((item) => !item.pass).length;

  await writeFile(
    path.join(OUTPUT_DIR, 'report.json'),
    JSON.stringify(report, null, 2),
  );

  console.log(JSON.stringify(report.summary));
  if (report.summary.failed) process.exitCode = 1;
}

main().catch(async (error) => {
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(
    path.join(OUTPUT_DIR, 'fatal-error.txt'),
    String(error.stack || error),
  );
  console.error(error.stack || error);
  process.exitCode = 1;
});
