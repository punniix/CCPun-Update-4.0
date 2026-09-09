import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const CDP_HTTP = 'http://127.0.0.1:9222';
const BASE_URL = process.env.WEBSITE43_BASE_URL || 'http://127.0.0.1:3100';
const ROUTE_FILTER = process.env.WEBSITE43_ROUTE;
const OUTPUT_DIR = path.resolve('qa/website-43-preview-2026-09-03');
const VIEWPORTS = [
  { name: 'mobile-390', width: 390, height: 844, mobile: true },
  { name: 'intermediate-600', width: 600, height: 900, mobile: false },
  { name: 'tablet-820', width: 820, height: 1180, mobile: false },
  { name: 'intermediate-1100', width: 1100, height: 1000, mobile: false },
  { name: 'desktop-1440', width: 1440, height: 1000, mobile: false },
];
const ROUTES = [
  ['home', '/preview/website-4-3'],
  ['blog', '/preview/website-4-3/blog'],
  ['article', '/preview/website-4-3/blog/personal-finance/financial-pyramid'],
  ['fhc', '/preview/website-4-3/tools/financial-health-check'],
  ['ci', '/preview/website-4-3/ci-planning'],
  ['privacy', '/preview/website-4-3/privacy'],
  ['cookie', '/preview/website-4-3/cookie-policy'],
  ['not-found', '/preview/website-4-3/404'],
];
const EXPECTED_ABOUT_PARAGRAPHS = [
  'จากคนที่โฟกัสแต่เพียงเรื่องการลงทุน จนเจอเหตุไม่คาดฝัน และสูญเสียในครอบครัวในเวลาต่อมา ผมจึงเริ่มเห็นความสำคัญของประกันชีวิต และกลับมาจัดแผนการเงินใหม่จากระดับรากฐาน',
  'และเลือกเดินต่อในบทบาทตัวแทนประกันชีวิต นายหน้าประกันวินาศภัย และผู้วางแผนการลงทุน เพื่อช่วยเหลือผู้คนให้มีฐานการเงินที่ดีขึ้น',
  'โดยนำประสบการณ์ด้านการเงินและการลงทุนจากการทำงานกว่า 5 ปี มาแนะนำ และช่วยตัดสินใจเลือกผลิตภัณฑ์ทางการเงินที่ตอบโจทย์เฉพาะบุคคล เพื่อสร้างทั้งความมั่นคงและความมั่งคั่งได้ในระยะสั้น กลางและยาว',
];
const EXPECTED_ABOUT_QUOTE = 'เป้าหมายไม่ใช่การเลือกเพียงแค่ผลิตภัณฑ์ใดผลิตภัณฑ์หนึ่ง แต่วางองค์รวม และเลือกสิ่งที่ดีที่สุด เหมาะสม ตอบโจทย์กับลูกค้าที่สุด';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function createTarget() {
  const response = await fetch(`${CDP_HTTP}/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' });
  if (!response.ok) throw new Error(`Unable to create Chrome target: ${response.status}`);
  return response.json();
}
async function closeTarget(id) { await fetch(`${CDP_HTTP}/json/close/${id}`, { method: 'PUT' }).catch(() => undefined); }

class CDPClient {
  constructor(url) { this.url = url; this.ws = null; this.nextId = 1; this.pending = new Map(); this.listeners = new Map(); }
  async connect() {
    this.ws = new WebSocket(this.url);
    this.ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id); if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(`${pending.method}: ${message.error.message}`)); else pending.resolve(message.result ?? {});
        return;
      }
      for (const callback of this.listeners.get(message.method) ?? []) callback(message.params ?? {});
    });
    await new Promise((resolve, reject) => { this.ws.addEventListener('open', resolve, { once: true }); this.ws.addEventListener('error', reject, { once: true }); });
  }
  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject, method }); this.ws.send(JSON.stringify({ id, method, params })); });
  }
  once(method, timeoutMs = 20000) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Timeout waiting for ${method}`)), timeoutMs);
      const callback = (params) => { clearTimeout(timeout); this.listeners.set(method, (this.listeners.get(method) ?? []).filter((item) => item !== callback)); resolve(params); };
      this.listeners.set(method, [...(this.listeners.get(method) ?? []), callback]);
    });
  }
  close() { this.ws?.close(); }
}

async function evaluate(client, expression) {
  const result = await client.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'Runtime evaluation failed');
  return result.result?.value;
}
async function setViewport(client, viewport) {
  await client.send('Emulation.setDeviceMetricsOverride', { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: viewport.mobile, screenWidth: viewport.width, screenHeight: viewport.height, positionX: 0, positionY: 0, dontSetVisibleSize: false });
  await client.send('Emulation.setTouchEmulationEnabled', { enabled: viewport.mobile, maxTouchPoints: viewport.mobile ? 5 : 1 });
}
async function navigate(client, url) {
  const loaded = client.once('Page.loadEventFired').catch(() => undefined);
  await client.send('Page.navigate', { url }); await loaded;
  await evaluate(client, `document.fonts?.ready?.then(() => true) ?? true`); await sleep(300);
}
async function screenshot(client, filePath) {
  await evaluate(client, 'window.scrollTo(0,0); true');
  const metrics = await client.send('Page.getLayoutMetrics');
  const size = metrics.cssContentSize ?? metrics.contentSize;
  const capture = await client.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: true, clip: { x: 0, y: 0, width: Math.ceil(size.width), height: Math.ceil(size.height), scale: 1 } });
  await writeFile(filePath, Buffer.from(capture.data, 'base64'));
  return { width: Math.ceil(size.width), height: Math.ceil(size.height) };
}

async function inspect(client, routeKey, viewport) {
  const base = await evaluate(client, `(() => {
    const doc = document.documentElement;
    const footer = document.querySelector('footer');
    const footerRect = footer?.getBoundingClientRect();
    const hamburger = document.querySelector('button[aria-label="เปิดเมนู"]');
    const hamburgerRect = hamburger?.getBoundingClientRect();
    const desktopNav = document.querySelector('nav[aria-label="เมนูหลัก"]');
    const desktopNavLinks = [...(desktopNav?.querySelectorAll('a') ?? [])].map(a => ({text:a.textContent?.trim(), rect:a.getBoundingClientRect().toJSON()}));
    const desktopToolsButton = [...(desktopNav?.querySelectorAll('button') ?? [])].find(b => b.textContent?.includes('เครื่องมือ'));
    const desktopToolsRect = desktopToolsButton?.getBoundingClientRect();
    return {
      innerWidth,
      clientWidth: doc.clientWidth,
      scrollWidth: doc.scrollWidth,
      scrollHeight: doc.scrollHeight,
      horizontalOverflow: doc.scrollWidth > doc.clientWidth + 1,
      footer: footerRect ? { top: footerRect.top + scrollY, bottom: footerRect.bottom + scrollY, height: footerRect.height } : null,
      hamburgerVisible: Boolean(hamburgerRect && hamburgerRect.width > 0 && getComputedStyle(hamburger).display !== 'none'),
      desktopNavLinks,
      desktopToolsVisible: Boolean(desktopToolsRect && desktopToolsRect.width > 0 && getComputedStyle(desktopToolsButton).display !== 'none'),
      bodyText: document.body.innerText,
    };
  })()`);
  const checks = [];
  const expect = (name, pass, details = '') => checks.push({ name, pass: Boolean(pass), details });
  expect('viewport width matches target', base.innerWidth === viewport.width, `${base.innerWidth} vs ${viewport.width}`);
  expect('no root horizontal overflow', !base.horizontalOverflow, `${base.scrollWidth} vs ${base.clientWidth}`);
  expect('footer rendered', Boolean(base.footer), JSON.stringify(base.footer));
  if (base.footer) expect('footer ends inside document', base.footer.bottom <= base.scrollHeight + 1, `${base.footer.bottom} vs ${base.scrollHeight}`);
  if (viewport.width < 1024) expect('responsive hamburger visible', base.hamburgerVisible);
  else expect('desktop nav visible', base.desktopNavLinks.length >= 2 && base.desktopToolsVisible, JSON.stringify({links:base.desktopNavLinks,tools:base.desktopToolsVisible}));

  if (routeKey === 'home') {
    const home = await evaluate(client, `(() => {
      const detail = (node) => {
        const rect = node?.getBoundingClientRect();
        const style = node ? getComputedStyle(node) : null;
        return rect && style ? { x:rect.x, y:rect.y, w:rect.width, h:rect.height, fontSize:parseFloat(style.fontSize), lineHeight:parseFloat(style.lineHeight) } : null;
      };
      const portrait = document.querySelector('img[alt="CCPun"]');
      const stage = portrait?.parentElement;
      const sr = stage?.getBoundingClientRect();
      const pr = portrait?.getBoundingClientRect();
      const hero = document.querySelector('section[aria-labelledby="home-hero-title"]');
      const heroRect = hero?.getBoundingClientRect();
      const title = document.querySelector('#home-hero-title');
      const body = title?.nextElementSibling;
      const actions = body?.nextElementSibling;
      const proof = actions?.nextElementSibling;
      const buttons = actions ? [...actions.children].map(detail) : [];
      const heroLinks = actions ? [...actions.querySelectorAll('a')].map((link) => ({ text:link.textContent?.trim(), href:link.getAttribute('href') })) : [];
      const trustStripGone = !document.body.innerText.includes('วางแผนประกัน\\nวางแผนการลงทุน\\nวางแผนการเงิน');
      const partnerLogos = [...document.querySelectorAll('img')].filter((img) => ['AIA','Fairdee','Maybank','PhillipCapital','Webull','Finnomena'].includes(img.alt));
      const partnerLogoPadding = partnerLogos.map((img) => { const style=getComputedStyle(img); return { top:parseFloat(style.paddingTop), bottom:parseFloat(style.paddingBottom) }; });
      const partnerCardPadding = partnerLogos.map((img) => { const style=getComputedStyle(img.parentElement?.parentElement); return { top:parseFloat(style.paddingTop), bottom:parseFloat(style.paddingBottom) }; });
      const partnerCardBreathingRoom = partnerLogos.map((img) => { const frame=img.parentElement; const card=frame?.parentElement; const frameRect=frame?.getBoundingClientRect(); const cardRect=card?.getBoundingClientRect(); return { top:frameRect && cardRect ? frameRect.top-cardRect.top : 0, bottom:frameRect && cardRect ? cardRect.bottom-frameRect.bottom : 0 }; });
      const fairdeeRole = document.querySelector('img[alt="Fairdee"]')?.parentElement?.parentElement?.querySelector('span')?.textContent?.trim();
      const license = document.querySelector('[class*="license"]');
      const licenseText = license?.textContent?.trim();
      const licenseLines = license ? [...license.querySelectorAll('span:not([aria-hidden="true"])')].map((line) => ({ text: line.textContent?.trim(), display: getComputedStyle(line).display })) : [];
      const learningSection = [...document.querySelectorAll('section')].find((section) => section.textContent?.includes('ไม่รู้จะเริ่มอย่างไร เริ่มจากบทความและเครื่องมือก่อน'));
      const toolCards = learningSection ? [...learningSection.querySelectorAll('a')].filter((a) => a.getAttribute('href')?.includes('/tools/financial-health-check') || a.getAttribute('href')?.includes('/ci-planning')).map(detail) : [];
      const learningCards = learningSection ? [detail(learningSection.querySelector('article')),...toolCards] : [];
      const faqSection = document.querySelector('[data-uat-section="home-faq"]');
      const learningSectionBox = learningSection?.getBoundingClientRect();
      const faqSectionBox = faqSection?.getBoundingClientRect();
      const voiceCites = [...document.querySelectorAll('cite')].map((cite) => cite.getBoundingClientRect().top);
      const faqQuestions = faqSection ? [...faqSection.querySelectorAll('summary')].map((summary) => summary.textContent?.replace('+','').trim()) : [];
      const faqCtas = faqSection ? [...faqSection.querySelectorAll('a')].map((link) => ({ text:link.textContent?.trim(), href:link.getAttribute('href') })) : [];
      const aboutParagraphs = [...document.querySelectorAll('[class*="aboutParagraphs"] p')].map((paragraph) => paragraph.textContent?.trim());
      const aboutQuote = document.querySelector('[class*="advisorNote"]')?.textContent?.trim();
      return {
        stage: sr && {w:sr.width,h:sr.height},
        portrait: pr && {top:pr.top-(sr?.top||0),w:pr.width,h:pr.height},
        heroHeight:heroRect?.height||0,
        heroBodyHasHardBreak: Boolean(body?.querySelector('br')),
        heroContent: { eyebrow:detail(title?.previousElementSibling), title:detail(title), body:detail(body), actions:detail(actions), proof:detail(proof), buttons },
        heroLinks,
        heroFitsViewport: [title?.previousElementSibling,title,body,actions,proof].every((node) => { const rect=node?.getBoundingClientRect(); return rect && rect.left >= 0 && rect.right <= innerWidth && rect.bottom <= (heroRect?.bottom ?? 0); }),
        trustStripGone,
        partnerLogoPadding,
        partnerCardPadding,
        partnerCardBreathingRoom,
        fairdeeRole,
        licenseText,
        licenseLines,
        toolCards,
        learningCards,
        faqQuestions,
        faqCtas,
        learningFaqGap: learningSectionBox && faqSectionBox ? faqSectionBox.top-learningSectionBox.bottom : null,
        voiceCites,
        duplicateContactCtaRemoved: !document.querySelector('[data-uat-section="contact"]'),
        removedPlanSection: !document.body.innerText.includes('ไม่มีคำตอบเดียวสำหรับทุกคน'),
        aboutParagraphs,
        aboutQuote,
      };
    })()`);
    const expectedPortrait = viewport.width <= 639 ? 318 : viewport.width < 1024 ? 260 : 400;
    if (viewport.width >= 1024) {
      if (viewport.width === 1440) {
        await setViewport(client, { ...viewport, width: 820 });
        await sleep(80);
        await evaluate(client, `(() => { document.querySelector('button[aria-label="เปิดเมนู"]')?.click(); return true; })()`);
        await setViewport(client, viewport);
        await sleep(80);
        const mobileMenuVisible = await evaluate(client, `(() => { const menu=document.querySelector('nav[aria-label="เมนูมือถือ"]'); return Boolean(menu && getComputedStyle(menu).display !== 'none'); })()`);
        expect('Mobile navigation stays hidden after resizing to desktop', !mobileMenuVisible, String(mobileMenuVisible));
      }
      await evaluate(client, `(() => { const b=[...document.querySelectorAll('nav[aria-label="เมนูหลัก"] button')].find(x=>x.textContent?.includes('เครื่องมือ')); b?.click(); return !!b; })()`);
      await sleep(80);
      const submenu = await evaluate(client, `(() => { const menu=document.querySelector('[role="menu"]'); return { visible:Boolean(menu && getComputedStyle(menu).visibility !== 'hidden' && getComputedStyle(menu).display !== 'none'), links:menu?[...menu.querySelectorAll('a')].map(a=>a.getAttribute('href')):[] }; })()`);
      expect('Desktop tools submenu opens', submenu.visible, JSON.stringify(submenu));
      expect('Desktop tools submenu has both UAT links', submenu.links.length === 2 && submenu.links.every(href => href?.startsWith('/preview/website-4-3/')), JSON.stringify(submenu.links));
      await evaluate(client, `(() => { const b=[...document.querySelectorAll('nav[aria-label="เมนูหลัก"] button')].find(x=>x.textContent?.includes('เครื่องมือ')); if (b?.getAttribute('aria-expanded')==='true') b.click(); return true; })()`);
    } else {
      await evaluate(client, `(() => { const b=document.querySelector('button[aria-label="เปิดเมนู"]'); b?.click(); return !!b; })()`);
      await sleep(80);
      await evaluate(client, `(() => { const b=[...document.querySelectorAll('nav[aria-label="เมนูมือถือ"] button')].find(x=>x.textContent?.includes('เครื่องมือ')); b?.click(); return !!b; })()`);
      await sleep(80);
      const submenu = await evaluate(client, `(() => { const nav=document.querySelector('nav[aria-label="เมนูมือถือ"]'); const b=nav?[...nav.querySelectorAll('button')].find(x=>x.textContent?.includes('เครื่องมือ')):null; const links=nav?[...nav.querySelectorAll('a')].filter(a=>a.textContent?.includes('ตรวจสุขภาพ')||a.textContent?.includes('โรคร้ายแรง')).map(a=>a.getAttribute('href')):[]; return { expanded:b?.getAttribute('aria-expanded')==='true', links }; })()`);
      expect('Mobile tools submenu expands', submenu.expanded, JSON.stringify(submenu));
      expect('Mobile tools submenu has both UAT links', submenu.links.length === 2 && submenu.links.every(href => href?.startsWith('/preview/website-4-3/')), JSON.stringify(submenu.links));
      await evaluate(client, `(() => { document.querySelector('button[aria-label="ปิดเมนู"]')?.click(); return true; })()`);
      await sleep(40);
    }
    expect('Home removed Trust Strip', home.trustStripGone);
    expect('Home removed plan-category section', home.removedPlanSection);
    expect('Home copy matches the approved problem framing', base.bodyText.includes('ถ้าเรื่องเงินยังเป็นเรื่องที่คุณกังวล') && base.bodyText.includes('เริ่มจากปัญหาที่เจอ ดูแผนการเงินในภาพรวม และหาผลิตภัณฑ์ที่เหมาะสม') && base.bodyText.includes('มีความคุ้มครองอยู่ แต่ไม่แน่ใจว่าที่มีอยู่นั้น เพียงพอหรือไม่ ต้องเตรียมหรือปรับเพิ่มลดอย่างไร'), base.bodyText);
    expect('Home partner copy matches the approved labels', base.bodyText.includes('6 แพลตฟอร์มการเงิน') && base.bodyText.includes('ทางเลือกที่หลากหลาย ตอบโจทย์ลูกค้า') && base.bodyText.includes('พาร์ทเนอร์ทั้งหมดที่ร่วมงาน'), base.bodyText);
    expect('Home removes the trust heading copy', !base.bodyText.includes('TRUST & VERIFICATION') && !base.bodyText.includes('ตรวจสอบได้ ก่อนตัดสินใจ'), base.bodyText);
    expect('Home About heading matches the approved copy', base.bodyText.includes('รู้จักที่ปรึกษาทางการเงิน CCPun') && base.bodyText.includes('จากคนที่โฟกัสแต่เรื่องการลงทุน สู่ที่ปรึกษาทางการเงินแบบครบลูป'), base.bodyText);
    expect('Home uses exact updated About copy', JSON.stringify(home.aboutParagraphs) === JSON.stringify(EXPECTED_ABOUT_PARAGRAPHS) && home.aboutQuote === EXPECTED_ABOUT_QUOTE, JSON.stringify({ paragraphs:home.aboutParagraphs, quote:home.aboutQuote }));
    expect('Fairdee role is insurance broker', home.fairdeeRole === 'นายหน้าประกันวินาศภัย', String(home.fairdeeRole));
    expect('Home license line uses the updated roles and numbers', home.licenseText === 'ใบอนุญาต: ตัวแทนประกันชีวิต 6801064783 · ผู้วางแผนการลงทุน 106654 · นายหน้าประกันวินาศภัย 6904009841', String(home.licenseText));
    if (viewport.width < 640) expect('Home license entries use one line each on mobile', home.licenseLines.length === 3 && home.licenseLines.every((line) => line.display === 'block'), JSON.stringify(home.licenseLines));
    expect('Home learning and FAQ copy matches the approved updates', base.bodyText.includes('ไม่รู้จะเริ่มอย่างไร เริ่มจากบทความและเครื่องมือก่อน') && base.bodyText.includes('บทความการเงิน') && base.bodyText.includes('เข้าใจเรื่องการเงินได้ แม้จะเริ่มจาก 0') && base.bodyText.includes('Financial Health Check') && base.bodyText.includes('เช็กทุนประกันชีวิตที่ควรมีก่อนตัดสินใจทำประกันผ่านการตรวจสุขภาพทางการเงิน') && base.bodyText.includes('วางแผนการเงินเมื่อเจอโรคร้ายแรง') && base.bodyText.includes('เตรียมเงินก้อนรับมือภาระค่าใช้จ่าย เมื่อเจอโรคร้ายแรง') && base.bodyText.includes('CCPun ช่วยให้คำแนะนำทางการเงินด้านใดได้บ้าง'), base.bodyText);
    expect('Partner logos have balanced vertical padding', home.partnerLogoPadding.length === 6 && home.partnerLogoPadding.every(({top,bottom}) => top > 0 && Math.abs(top-bottom) < .1), JSON.stringify(home.partnerLogoPadding));
    expect('Partner cards leave space above and below the logo', home.partnerCardPadding.length === 6 && home.partnerCardPadding.every(({top,bottom}) => top >= 20 && Math.abs(top-bottom) < .1) && home.partnerCardBreathingRoom.every(({top}) => top >= 20), JSON.stringify({ padding:home.partnerCardPadding, room:home.partnerCardBreathingRoom }));
    if (viewport.width >= 1024) expect('Home review names share a baseline', home.voiceCites.length === 2 && Math.abs(home.voiceCites[0]-home.voiceCites[1]) < 1, JSON.stringify(home.voiceCites));
    expect('Home tool cards have equal dimensions', home.toolCards.length === 2 && Math.abs(home.toolCards[0].w-home.toolCards[1].w) < 1 && Math.abs(home.toolCards[0].h-home.toolCards[1].h) < 1, JSON.stringify(home.toolCards));
    expect('Home learning cards have equal dimensions', home.learningCards.length === 3 && home.learningCards.every((card) => Math.abs(card.w-home.learningCards[0].w) < 1 && Math.abs(card.h-home.learningCards[0].h) < 1), JSON.stringify(home.learningCards));
    expect('Home FAQ questions match the approved updates', JSON.stringify(home.faqQuestions) === JSON.stringify(['CCPun คือใคร?', 'CCPun ช่วยให้คำแนะนำทางการเงินด้านใดได้บ้าง']), JSON.stringify(home.faqQuestions));
    expect('Home FAQ has one LINE consultation CTA', home.faqCtas.length === 1 && home.faqCtas[0].text === 'ปรึกษากับ CCPun' && home.faqCtas[0].href === 'https://lin.ee/tqLCs4f', JSON.stringify(home.faqCtas));
    expect('Home removes the duplicate CTA after FAQ', home.duplicateContactCtaRemoved, String(home.duplicateContactCtaRemoved));
    expect('Home keeps a compact gap between learning cards and FAQ', home.learningFaqGap !== null && home.learningFaqGap <= 48, String(home.learningFaqGap));
    expect('About portrait stage is square', home.stage && Math.abs(home.stage.w - home.stage.h) < 1, JSON.stringify(home.stage));
    if ([390,820,1440].includes(viewport.width)) expect('About portrait stage matches Figma target', home.stage && Math.abs(home.stage.w - expectedPortrait) < 1.5, JSON.stringify(home.stage));
    if (viewport.width < 640) expect('Mobile portrait begins flush with its card', home.portrait && Math.abs(home.portrait.top) < 1.5, JSON.stringify(home.portrait));
    else expect('Portrait subject is shifted down inside square', home.portrait && home.portrait.top >= 14, JSON.stringify(home.portrait));
    const targetHero = viewport.width <= 639 ? 740 : viewport.width < 1024 ? 820 : 800;
    if ([390,820,1440].includes(viewport.width)) expect('Home hero height matches Figma target', Math.abs(home.heroHeight-targetHero)<1.5, `${home.heroHeight} vs ${targetHero}`);
    expect('Home hero content stays inside its frame', home.heroFitsViewport, JSON.stringify(home.heroContent));
    expect('Home hero routes profile and LINE CTAs correctly', JSON.stringify(home.heroLinks) === JSON.stringify([{text:'รู้จัก CCPun',href:'#about-ccpun'},{text:'ปรึกษากับ CCPun',href:'https://lin.ee/tqLCs4f'}]), JSON.stringify(home.heroLinks));
    if (viewport.width < 640) expect('Mobile hero text uses Thai browser line breaking and clears its buttons', !home.heroBodyHasHardBreak && home.heroContent.body && home.heroContent.actions && home.heroContent.body.y + home.heroContent.body.h + 8 <= home.heroContent.actions.y, JSON.stringify(home.heroContent));
    const targets = {
      390: { eyebrow:[24,104,undefined,14], title:[24,140,342,30,39], body:[24,583,342,14], actions:[24,633], proof:[24,693,undefined,12], buttons:[[165,48],[165,48]] },
      820: { eyebrow:[40,390,undefined,14], title:[40,426,490,38,48], body:[40,594,440,16], actions:[40,663], proof:[40,731,undefined,12], buttons:[[176,48],[116,48]] },
      1440: { eyebrow:[80,196,undefined,15], title:[80,240,760,44,60], body:[80,440,610,18], actions:[80,512], proof:[80,584,undefined,14], buttons:[[220,52],[160,52]] },
    }[viewport.width];
    if (targets) {
      const close = (actual, expected, tolerance=2) => Math.abs(actual-expected) <= tolerance;
      const rect = home.heroContent;
      for (const [key, values] of Object.entries(targets)) {
        if (key === 'buttons') continue;
        const [x,y,w,fontSize,lineHeight] = values;
        expect(`Home hero ${key} matches Figma`, rect[key] && close(rect[key].x,x) && close(rect[key].y,y) && (w === undefined || close(rect[key].w,w)) && (fontSize === undefined || close(rect[key].fontSize,fontSize,.1)) && (lineHeight === undefined || close(rect[key].lineHeight,lineHeight,.1)), JSON.stringify({actual:rect[key],target:values}));
      }
      expect('Home hero buttons match Figma', targets.buttons.every(([w,h],index) => rect.buttons[index] && close(rect.buttons[index].w,w) && close(rect.buttons[index].h,h)), JSON.stringify({actual:rect.buttons,target:targets.buttons}));
    }
  }
  if (routeKey === 'blog') {
    const cards = await evaluate(client, `(() => {
      const all = [...document.querySelectorAll('a')].filter(a => a.querySelector('img[src*="blog-migration"]') && a.querySelector('h2'));
      return all.map(a => { const r=a.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}; });
    })()`);
    expect('Blog has five article cards', cards.length === 5, JSON.stringify(cards));
    if (cards.length === 5) {
      const maxY = Math.max(...cards.map(c=>Math.round(c.y)));
      const last = cards.filter(c=>Math.abs(Math.round(c.y)-maxY)<3);
      const firstRowX = Math.min(...cards.filter(c=>Math.abs(Math.round(c.y)-Math.min(...cards.map(item=>Math.round(item.y))))<3).map(c=>c.x));
      const lastRowX = Math.min(...last.map(c=>c.x));
      expect('Blog wrapped final row stays left-anchored like Figma', Math.abs(lastRowX-firstRowX) < 4, `${lastRowX} vs ${firstRowX}; ${JSON.stringify(last)}`);
    }
  }
  if (routeKey === 'article') {
    expect('Article has Figma title', base.bodyText.includes('พีระมิดทางการเงิน คืออะไร? วางรากฐานก่อนลงทุน'));
    expect('Article production-source body present', base.bodyText.includes('พีระมิดทางการเงินมีองค์ประกอบหลัก 4 ชั้น'));
  }
  if (routeKey === 'fhc' || routeKey === 'ci') {
    const imageName = routeKey === 'fhc' ? 'fhc-hero' : 'ci-hero';
    const tool = await evaluate(client, `(() => {
      const box = (node) => { const rect=node?.getBoundingClientRect(); return rect ? { top:rect.top+scrollY, bottom:rect.bottom+scrollY, height:rect.height } : null; };
      const image = document.querySelector('img[src*="${imageName}"]');
      const hero = image?.closest('section');
      const intro = document.querySelector('[data-uat-section="tool-intro"]');
      const calculator = document.querySelector('[data-uat-section="calculator"]');
      const faq = document.querySelector('[data-uat-section="tool-faq"]');
      const details = faq ? [...faq.querySelectorAll('details')] : [];
      return {
        hero:box(hero), image:box(image), intro:box(intro), calculator:box(calculator), faq:box(faq),
        introParagraphs:intro?.querySelectorAll('p').length ?? 0,
        faqCount:details.length,
        openFaqCount:details.filter((detail) => detail.open).length,
      };
    })()`);
    expect('Tool layout follows hero, intro, calculator, FAQ order', tool.hero && tool.intro && tool.calculator && tool.faq && tool.hero.bottom <= tool.intro.top + 1 && tool.intro.bottom <= tool.calculator.top + 1 && tool.calculator.bottom <= tool.faq.top + 1, JSON.stringify(tool));
    expect('Tool intro stays brief', tool.introParagraphs >= 2 && tool.introParagraphs <= 4, String(tool.introParagraphs));
    expect('Tool FAQ is below calculator and collapsed', tool.faqCount > 0 && tool.openFaqCount === 0, JSON.stringify({ faqCount:tool.faqCount, openFaqCount:tool.openFaqCount }));
    if (viewport.width >= 640) expect('Tool hero image fills top and bottom without letterbox', tool.hero && tool.image && Math.abs(tool.image.top-tool.hero.top) < 1 && Math.abs(tool.image.bottom-tool.hero.bottom) < 1, JSON.stringify({ hero:tool.hero, image:tool.image }));
  }
  if (routeKey === 'fhc') expect('FHC live calculator reused', base.bodyText.includes('เครื่องคำนวณทุนประกันชีวิต') && base.bodyText.includes('ค่าใช้จ่ายครัวเรือนต่อเดือนที่ยังต้องดูแล'));
  if (routeKey === 'ci') expect('CI live calculator reused', base.bodyText.includes('2 ขั้นตอน เพื่อเห็นส่วนต่างที่ต้องเตรียม') && base.bodyText.includes('รายได้ต่อเดือน'));
  if (routeKey === 'privacy') expect('Privacy has all nine sections', base.bodyText.includes('9. ติดต่อเราและการเปลี่ยนแปลง'));
  if (routeKey === 'cookie') {
    expect('Cookie policy has four public categories', ['คุกกี้ที่จำเป็น','คุกกี้วิเคราะห์','คุกกี้ฟังก์ชัน','คุกกี้การตลาด'].every(v=>base.bodyText.includes(v)));
    expect('Non-public cookie design specs are not rendered', !base.bodyText.includes('ตัวอย่างหน้าต่างการตั้งค่าคุกกี้'));
  }
  if (routeKey === 'not-found') {
    expect('404 recovery copy matches Figma', base.bodyText.includes('ไม่พบหน้าที่คุณกำลังหา') && base.bodyText.includes('ดูบทความ'));
    const notFound = await evaluate(client, `(() => {
      const main = document.querySelector('main');
      const nav = main?.previousElementSibling;
      const recovery = main?.querySelector('section');
      const code = recovery?.querySelector('p');
      const heading = recovery?.querySelector('h1');
      const description = heading?.nextElementSibling;
      const actions = description?.nextElementSibling;
      const footer = main?.nextElementSibling;
      const compactNav = footer?.querySelector('nav[aria-label="เมนูส่วนท้าย"]');
      const compact = compactNav?.parentElement;
      const full = compact?.previousElementSibling;
      const box = (node) => { const rect=node?.getBoundingClientRect(); const style=node?getComputedStyle(node):null; return rect&&style?{x:rect.x,y:rect.y,w:rect.width,h:rect.height,padding:[parseFloat(style.paddingTop),parseFloat(style.paddingRight),parseFloat(style.paddingBottom),parseFloat(style.paddingLeft)],fontSize:parseFloat(style.fontSize),lineHeight:parseFloat(style.lineHeight),display:style.display}:null; };
      return {
        nav:box(nav), recovery:box(recovery), code:box(code), heading:box(heading), description:box(description), actions:box(actions), footer:box(footer),
        buttons:actions?[...actions.children].map(box):[],
        compact:box(compact), full:box(full),
        compactRows:compact&&getComputedStyle(compact).display!=='none'?[...compact.children].length:0,
        compactText:compactNav?.innerText.replace(/\\s+/g,' ').trim()||'',
      };
    })()`);
    const targets = {
      390: { nav:104, recovery:[426,48,24,40], code:[48,86,72,86.4], heading:[154,36,28,35.84], description:[210,48,15,24], actions:[278,108], footer:[530,137,24,24,24], buttons:[[160,48],[342,48]], compact:true },
      820: { nav:112, recovery:[405,72,40,48], code:[72,115,96,115.2], heading:[207,36,28,35.84], description:[263,26,16,25.6], actions:[309,48], footer:[517,169,40,40,40], buttons:[[160,48],[244,48]], compact:true },
      1440: { nav:144, recovery:[446,88,80,40], code:[88,144,120,144], heading:[252,40,32,40], description:[312,26,16,25.6], actions:[358,48], footer:[590,490,40,80,40], buttons:[[160,48],[244,48]], compact:false },
    }[viewport.width];
    if (targets) {
      const close = (actual, expected, tolerance=2) => Math.abs(actual-expected) <= tolerance;
      const [height,top,right,bottom] = targets.recovery;
      expect('404 nav wrapper matches Figma', notFound.nav && close(notFound.nav.h,targets.nav), JSON.stringify(notFound.nav));
      expect('404 recovery frame matches Figma', notFound.recovery && close(notFound.recovery.h,height) && close(notFound.recovery.padding[0],top) && close(notFound.recovery.padding[1],right) && close(notFound.recovery.padding[2],bottom), JSON.stringify(notFound.recovery));
      for (const key of ['code','heading','description','actions']) {
        const [y,h,fontSize,lineHeight] = targets[key];
        const actual = notFound[key];
        expect(`404 ${key} matches Figma`, actual && close(actual.y-notFound.recovery.y,y) && close(actual.h,h) && (fontSize===undefined || close(actual.fontSize,fontSize,.1)) && (lineHeight===undefined || close(actual.lineHeight,lineHeight,.1)), JSON.stringify({actual,target:targets[key],recoveryY:notFound.recovery?.y}));
      }
      expect('404 action buttons match Figma', targets.buttons.every(([width,height],index)=>notFound.buttons[index]&&close(notFound.buttons[index].w,width)&&close(notFound.buttons[index].h,height)), JSON.stringify(notFound.buttons));
      const [footerY,footerHeight,...footerPadding] = targets.footer;
      expect('404 footer frame matches Figma', notFound.footer && close(notFound.footer.y,footerY) && close(notFound.footer.h,footerHeight) && footerPadding.every((value,index)=>close(notFound.footer.padding[index],value)), JSON.stringify(notFound.footer));
      expect('404 footer variant matches Figma', targets.compact ? notFound.compact?.display==='flex' && notFound.compactRows===2 && notFound.compactText==='หน้าแรก · บทความ · Privacy · Cookie' : notFound.full?.display!=='none' && notFound.compact?.display==='none', JSON.stringify(notFound));
    }
  }
  return { checks, metrics: base };
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const target = await createTarget(); const client = new CDPClient(target.webSocketDebuggerUrl);
  const report = { generatedAt:new Date().toISOString(), baseUrl:BASE_URL, viewports:{}, summary:{passed:0,failed:0} };
  try {
    await client.connect(); await client.send('Page.enable'); await client.send('Runtime.enable'); await client.send('Network.enable');
    for (const viewport of VIEWPORTS) {
      await setViewport(client, viewport); const vr={routes:{}}; report.viewports[viewport.name]=vr;
      for (const [routeKey, routePath] of ROUTES.filter(([routeKey]) => !ROUTE_FILTER || routeKey === ROUTE_FILTER)) {
        await navigate(client, `${BASE_URL}${routePath}`);
        const inspected=await inspect(client,routeKey,viewport);
        const file=path.join(OUTPUT_DIR,`${routeKey}-${viewport.name}.png`); const image=await screenshot(client,file);
        vr.routes[routeKey]={...inspected,screenshot:path.relative(process.cwd(),file),image};
        for(const check of inspected.checks){ if(check.pass)report.summary.passed++; else report.summary.failed++; }
      }
    }
    await writeFile(path.join(OUTPUT_DIR,'report.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify(report.summary));
    if(report.summary.failed) process.exitCode=1;
  } finally { client.close(); await closeTarget(target.id); }
}
main().catch((error)=>{console.error(error.stack||error.message||error);process.exitCode=1;});
