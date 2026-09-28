import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const CDP_HTTP = 'http://127.0.0.1:9222';
const BASE_URL = process.env.UAT_BASE_URL || 'http://127.0.0.1:62426';
const OUTPUT_DIR = path.resolve('qa/uat-text-responsive-2026-08-17');
const VIEWPORTS = [
  { name: 'mobile-320', width: 320, height: 568, mobile: true },
  { name: 'mobile-375', width: 375, height: 812, mobile: true },
  { name: 'mobile-390', width: 390, height: 844, mobile: true },
  { name: 'mobile-414', width: 414, height: 896, mobile: true },
  { name: 'tablet-820', width: 820, height: 1180, mobile: false },
  { name: 'tablet-1024', width: 1024, height: 1366, mobile: false },
  { name: 'desktop-1440', width: 1440, height: 1000, mobile: false },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function createTarget() {
  const response = await fetch(`${CDP_HTTP}/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' });
  if (!response.ok) throw new Error(`Unable to create Chrome target: ${response.status}`);
  return response.json();
}

async function closeTarget(id) {
  await fetch(`${CDP_HTTP}/json/close/${id}`, { method: 'PUT' }).catch(() => undefined);
}

class CDPClient {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.url);
    this.ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(`${pending.method}: ${message.error.message}`));
        else pending.resolve(message.result ?? {});
        return;
      }
      const callbacks = this.listeners.get(message.method) ?? [];
      for (const callback of callbacks) callback(message.params ?? {});
    });
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  once(method, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Timeout waiting for ${method}`)), timeoutMs);
      const callback = (params) => {
        clearTimeout(timeout);
        const callbacks = this.listeners.get(method) ?? [];
        this.listeners.set(method, callbacks.filter((item) => item !== callback));
        resolve(params);
      };
      const callbacks = this.listeners.get(method) ?? [];
      callbacks.push(callback);
      this.listeners.set(method, callbacks);
    });
  }

  close() {
    this.ws?.close();
  }
}

async function evaluate(client, expression, awaitPromise = true) {
  const result = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise,
    returnByValue: true,
    userGesture: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'Runtime evaluation failed');
  }
  return result.result?.value;
}

async function navigate(client, url) {
  const loaded = client.once('Page.loadEventFired', 20000).catch(() => undefined);
  await client.send('Page.navigate', { url });
  await loaded;
  await evaluate(client, `document.fonts?.ready?.then(() => true) ?? true`);
  await sleep(350);
}

async function setViewport(client, viewport) {
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: viewport.mobile,
    screenWidth: viewport.width,
    screenHeight: viewport.height,
    positionX: 0,
    positionY: 0,
    dontSetVisibleSize: false,
  });
  await client.send('Emulation.setTouchEmulationEnabled', {
    enabled: viewport.mobile,
    maxTouchPoints: viewport.mobile ? 5 : 1,
  });
}

async function saveFullPageScreenshot(client, filePath) {
  await evaluate(client, `window.scrollTo(0, 0); true`);
  const metrics = await client.send('Page.getLayoutMetrics');
  const size = metrics.cssContentSize ?? metrics.contentSize;
  const capture = await client.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: Math.ceil(size.width), height: Math.ceil(size.height), scale: 1 },
  });
  await writeFile(filePath, Buffer.from(capture.data, 'base64'));
  return { width: Math.ceil(size.width), height: Math.ceil(size.height) };
}

async function saveElementScreenshot(client, selector, filePath) {
  const box = await evaluate(client, `(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return { x: rect.left + window.scrollX, y: rect.top + window.scrollY, width: rect.width, height: rect.height };
  })()`);
  if (!box || box.width <= 0 || box.height <= 0) throw new Error(`Element not found or hidden: ${selector}`);
  const capture = await client.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: true,
    clip: {
      x: Math.max(0, box.x - 12),
      y: Math.max(0, box.y - 12),
      width: Math.ceil(box.width + 24),
      height: Math.ceil(box.height + 24),
      scale: 1,
    },
  });
  await writeFile(filePath, Buffer.from(capture.data, 'base64'));
}

async function acceptCookieBanner(client) {
  await evaluate(client, `(() => {
    const button = [...document.querySelectorAll('button')].find((item) => item.textContent?.trim() === 'ยอมรับ');
    if (button) { button.click(); return true; }
    return false;
  })()`);
  await sleep(150);
}

async function setInput(client, id, value) {
  const success = await evaluate(client, `(() => {
    const input = document.getElementById(${JSON.stringify(id)});
    if (!(input instanceof HTMLInputElement)) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, ${JSON.stringify(String(value))});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  if (!success) throw new Error(`Unable to set input #${id}`);
  await sleep(80);
}

async function clickButtonByText(client, text) {
  const success = await evaluate(client, `(() => {
    const button = [...document.querySelectorAll('button')].find((item) => item.textContent?.replace(/\\s+/g, ' ').trim() === ${JSON.stringify(text)});
    if (!button) return false;
    button.click();
    return true;
  })()`);
  if (!success) throw new Error(`Button not found: ${text}`);
  await sleep(420);
}

async function openMobileMenuAndCheck(client) {
  const available = await evaluate(client, `(() => {
    const trigger = document.querySelector('button[aria-label="เปิดเมนู"]');
    if (!trigger) return false;
    trigger.click();
    return true;
  })()`);
  if (!available) return { available: false, visibleContact: false };
  await sleep(180);
  const visibleContact = await evaluate(client, `(() => {
    const links = [...document.querySelectorAll('a')];
    return links.some((item) => {
      const label = item.textContent?.replace(/\s+/g, ' ').trim();
      const rect = item.getBoundingClientRect();
      const style = getComputedStyle(item);
      return label === 'ติดต่อเรา' && style.display !== 'none' && style.visibility !== 'hidden' && rect.height > 0 && rect.width > 0;
    });
  })()`);
  await evaluate(client, `(() => { document.querySelector('button[aria-label="ปิดเมนู"]')?.click(); return true; })()`);
  await sleep(100);
  return { available: true, visibleContact };
}

async function runAssertions(client, routeKey, viewport) {
  const common = await evaluate(client, `(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    bodyText: document.body.innerText,
  }))()`);

  const checks = [];
  const expect = (name, condition, details = '') => checks.push({ name, pass: Boolean(condition), details });
  expect('viewport width matches', common.innerWidth === viewport.width, `${common.innerWidth} vs ${viewport.width}`);
  expect('no horizontal overflow', !common.horizontalOverflow, `${common.scrollWidth} vs ${common.clientWidth}`);

  if (routeKey === 'privacy') {
    expect('navbar CTA revised', common.bodyText.includes('ติดต่อเรา'));
    expect('old contact name removed', !common.bodyText.includes('CCPun (ที่ปรึกษาการเงินอิสระ)'));
    expect('Facebook contact row removed', !common.bodyText.includes('Facebook:'));
    expect('data controller name corrected', common.bodyText.includes('ชนาธิป ชิตประเสริฐ'));
  }
  if (routeKey === 'cookie') {
    const marketing = await evaluate(client, `(() => {
      const heading = [...document.querySelectorAll('p')].find((item) => item.textContent?.trim() === 'คุกกี้การตลาด (Marketing Cookies)');
      const card = heading?.closest('div.rounded-xl');
      const rows = card ? [...card.querySelectorAll('tbody tr')].map((row) => row.innerText.replace(/\\s+/g, ' ').trim()) : [];
      return rows;
    })()`);
    expect('marketing card uses five-row format', marketing.length === 5, JSON.stringify(marketing));
    expect('marketing provider row present', marketing.some((row) => row.startsWith('ผู้ให้บริการ')));
    expect('marketing duration row present', marketing.some((row) => row.startsWith('ระยะเวลา')));
  }
  if (routeKey === 'not-found') {
    const notFound = await evaluate(client, `(() => {
      const paragraph = [...document.querySelectorAll('main section p')].find((item) => item.textContent?.includes('ลิงก์นี้อาจถูกย้าย'));
      const spans = paragraph ? [...paragraph.querySelectorAll(':scope > span')] : [];
      return {
        spanCount: spans.length,
        separateLines: spans.length === 2 && spans[1].getBoundingClientRect().top > spans[0].getBoundingClientRect().top,
        actionCount: document.querySelectorAll('main section a').length,
        hasOldAction: document.body.innerText.includes('ตรวจสุขภาพการเงิน'),
      };
    })()`);
    expect('404 message split into two blocks', notFound.spanCount === 2 && notFound.separateLines, JSON.stringify(notFound));
    expect('404 has one action', notFound.actionCount === 1, `${notFound.actionCount}`);
    expect('old secondary action removed', !notFound.hasOldAction);
  }
  if (routeKey === 'fhc') {
    expect('FHC hero copy revised', common.bodyText.includes('เริ่มจากภาระและหนี้สินที่คนข้างหลังต้องดูแล'));
    expect('FHC explanatory copy revised', common.bodyText.includes('ทุนประกันชีวิตที่มี ไม่ได้บอกว่า “พอ”'));
    expect('FHC CTA revised', common.bodyText.includes('เริ่มประเมินทุนประกันชีวิต'));
    expect('FHC pre-calculation label removed', !common.bodyText.includes('ก่อนเริ่มคำนวณทุนประกันชีวิต'));
    expect('FHC family purpose copy is explicit', common.bodyText.includes('ทุนประกันชีวิตช่วยให้ครอบครัวมีเวลาตั้งหลัก'));
    expect('FHC method copy is explicit', common.bodyText.includes('ประเมินเงินก้อนที่ครอบครัวอาจต้องใช้จากข้อมูลของคุณ') && !common.bodyText.includes('ไม่ได้หาเลขที่ “ถูกต้องที่สุด”'));
    const heroBreak = await evaluate(client, `(() => {
      const h1 = document.querySelector('h1');
      const spans = h1 ? [...h1.querySelectorAll(':scope > span')] : [];
      return spans.length >= 2 ? spans[1].getBoundingClientRect().top > spans[0].getBoundingClientRect().top : false;
    })()`);
    expect('FHC hero title uses controlled line break', heroBreak);
    const alignedInputs = await evaluate(client, `(() => {
      const card = document.querySelector('#fhc-calculator .form-glass');
      const fields = ['householdMonthly', 'supportYears', 'debt', 'education'];
      return Boolean(card && fields.every((id) => card.querySelector('#' + id)) && card.querySelector('h3') && card.querySelector('svg'));
    })()`);
    expect('FHC input area matches CI form language', alignedInputs);
    const educationAndSlider = await evaluate(client, `(() => {
      const image = document.querySelector('img[src*="planning-protection-v1"]');
      const slider = document.querySelector('#supportYears');
      const output = slider?.closest('fieldset')?.querySelector('output');
      return {
        imageLoaded: Boolean(image?.complete && image?.naturalWidth > 0),
        sliderType: slider?.getAttribute('type') || '',
        min: slider?.getAttribute('min') || '',
        max: slider?.getAttribute('max') || '',
        value: slider?.value || '',
        height: slider?.getBoundingClientRect().height || 0,
        output: output?.textContent?.trim() || '',
      };
    })()`);
    expect('FHC education section includes meaningful illustration', educationAndSlider.imageLoaded, JSON.stringify(educationAndSlider));
    expect('FHC support years uses accessible CI-style slider', educationAndSlider.sliderType === 'range' && educationAndSlider.min === '1' && educationAndSlider.max === '20' && educationAndSlider.value === '10' && educationAndSlider.height >= 44 && educationAndSlider.output === '10 ปี', JSON.stringify(educationAndSlider));
  }
  if (routeKey === 'ci') {
    expect('duplicated method section removed', !common.bodyText.includes('วิธีคิดของคุณ: รายได้'));
    expect('walkthrough removed for separate article', !common.bodyText.includes('ดูตัวอย่าง 3 ขั้นตอนก่อนเริ่มกรอกข้อมูล'));
  }

  if (viewport.mobile) {
    const menu = await openMobileMenuAndCheck(client);
    expect('mobile menu contact CTA revised', menu.available && menu.visibleContact, JSON.stringify(menu));
  }

  return checks;
}

async function prepareFHCResult(client) {
  await navigate(client, `${BASE_URL}/tools/financial-health-check/`);
  await acceptCookieBanner(client);
  await setInput(client, 'householdMonthly', 30000);
  await setInput(client, 'supportYears', 10);
  await setInput(client, 'debt', 100000);
  await setInput(client, 'education', 100000);
  await clickButtonByText(client, 'ถัดไป');
  await setInput(client, 'existingLifeCoverage', 100000);
  await setInput(client, 'liquidAssets', 50000);
  await clickButtonByText(client, 'ดูผลการคำนวณ');
  const text = await evaluate(client, 'document.body.innerText');
  return [
    { name: 'FHC result heading revised', pass: text.includes('ทุนประกันชีวิตที่ต้องการเพิ่ม') },
    { name: 'FHC formula unchanged after slider conversion', pass: text.includes('3,650,000 บาท') },
    { name: 'FHC family expense label revised', pass: text.includes('ค่าใช้จ่ายในครอบครัวตามจำนวนปีที่ต้องการให้เงินก้อนรองรับ') },
    { name: 'FHC debt and education label revised', pass: text.includes('หนี้รวมและทุนการศึกษาบุตร') },
    { name: 'FHC compact contact CTA revised', pass: text.includes('คุยต่อกับ CCPun ทาง LINE OA') && text.includes('คุยกับ CCPun ทาง LINE OA') },
    { name: 'FHC old result heading removed', pass: !text.split('\n').some((line) => line.trim() === 'ส่วนต่างทุนประกันชีวิต') },
  ];
}

async function prepareCIResult(client) {
  await navigate(client, `${BASE_URL}/ci-planning/`);
  await acceptCookieBanner(client);
  await setInput(client, 'ci-monthly-income', 100000);
  await setInput(client, 'ci-household', 30000);
  await clickButtonByText(client, 'ถัดไป');
  await setInput(client, 'ci-lump-sum', 1000000);
  await setInput(client, 'ci-liquid-assets', 150000);
  await clickButtonByText(client, 'ดูผลคำนวณ');
  const text = await evaluate(client, 'document.body.innerText');
  return [
    { name: 'CI result next-step CTA names CCPun', pass: text.includes('คุยกับ CCPun ทาง LINE OA @ccpun') },
    { name: 'CI result consultation heading revised', pass: text.includes('คุยต่อกับ CCPun ทาง LINE OA') },
    { name: 'CI result button revised', pass: text.includes('คุยกับ CCPun ทาง LINE OA') },
    { name: 'CI old consultation heading removed', pass: !text.includes('หากต้องการคุยต่อกับที่ปรึกษา') },
  ];
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const target = await createTarget();
  const client = new CDPClient(target.webSocketDebuggerUrl);
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    viewports: {},
    summary: { passed: 0, failed: 0 },
  };

  try {
    await client.connect();
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Network.enable');

    for (const viewport of VIEWPORTS) {
      await setViewport(client, viewport);
      const viewportReport = { routes: {}, results: {} };
      report.viewports[viewport.name] = viewportReport;

      const routes = [
        ['privacy', '/privacy/'],
        ['cookie', '/cookie-policy/'],
        ['not-found', '/this-page-does-not-exist-uat/'],
        ['fhc', '/tools/financial-health-check/'],
        ['ci', '/ci-planning/'],
      ];

      for (const [routeKey, routePath] of routes) {
        await navigate(client, `${BASE_URL}${routePath}`);
        await acceptCookieBanner(client);
        const checks = await runAssertions(client, routeKey, viewport);
        const filePath = path.join(OUTPUT_DIR, `${routeKey}-${viewport.name}.png`);
        const image = await saveFullPageScreenshot(client, filePath);
        viewportReport.routes[routeKey] = { checks, screenshot: path.relative(process.cwd(), filePath), image };
      }

      const fhcChecks = await prepareFHCResult(client);
      const fhcOverflow = await evaluate(client, `document.documentElement.scrollWidth > document.documentElement.clientWidth + 1`);
      fhcChecks.push({ name: 'FHC result has no horizontal overflow', pass: !fhcOverflow });
      const fhcFile = path.join(OUTPUT_DIR, `fhc-result-${viewport.name}.png`);
      await saveElementScreenshot(client, 'main section[aria-labelledby="life-result-title"]', fhcFile);
      viewportReport.results.fhc = { checks: fhcChecks, screenshot: path.relative(process.cwd(), fhcFile) };

      const ciChecks = await prepareCIResult(client);
      const ciOverflow = await evaluate(client, `document.documentElement.scrollWidth > document.documentElement.clientWidth + 1`);
      ciChecks.push({ name: 'CI result has no horizontal overflow', pass: !ciOverflow });
      const ciFile = path.join(OUTPUT_DIR, `ci-result-${viewport.name}.png`);
      await saveElementScreenshot(client, '#ci-calculator', ciFile);
      viewportReport.results.ci = { checks: ciChecks, screenshot: path.relative(process.cwd(), ciFile) };
    }

    for (const viewport of Object.values(report.viewports)) {
      for (const route of Object.values(viewport.routes)) {
        for (const check of route.checks) { if (check.pass) report.summary.passed++; else report.summary.failed++; }
      }
      for (const result of Object.values(viewport.results)) {
        for (const check of result.checks) { if (check.pass) report.summary.passed++; else report.summary.failed++; }
      }
    }

    await writeFile(path.join(OUTPUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report.summary));
    if (report.summary.failed > 0) process.exitCode = 1;
  } finally {
    client.close();
    await closeTarget(target.id);
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
