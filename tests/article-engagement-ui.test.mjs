import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { reviewedArticleCardProjection, reviewedThaiWrapProjection, articleOverviewSourceProjection } from '../qa/phase2-source-proof.mjs';
import { createRequire } from 'node:module';
import React from 'react';
import { JSDOM } from 'jsdom';
const require = createRequire(import.meta.url);
require('tsx/cjs');
require.extensions['.css'] = module => { module.exports = { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) }; };
require.cache[require.resolve('../lib/analytics.ts')] = { exports: { trackEvent() {} } };
const { renderToStaticMarkup } = require('react-dom/server');
const { ArticleEngagementProvider, ArticleEngagementSummary, useArticleEngagement } = require('../features/blog/website-43/ArticleEngagement.tsx');
const Actions = require('../features/blog/website-43/ArticleShareActions.tsx').default;
const { default: CardEngagement, ArticleCardEngagementControls } = require('../features/blog/website-43/ArticleCardEngagement.tsx');

test('actual Article controls read verified metrics, gate analytics consent and update both hearts only after server success', async () => {
  const pending = renderToStaticMarkup(React.createElement(ArticleEngagementSummary, { readingMinutes: 11 }));
  assert.doesNotMatch(pending, /—|เปิดอ่าน|แชร์|GA4|ย้อนหลัง/);
  assert.match(pending, /ใช้เวลาอ่านประมาณ <b>11<\/b> นาที/);
  const dom = new JSDOM('<div id="app"></div>', { url: 'https://ccpun.com/blog/personal-finance/fixture/' });
  const names = ['window', 'document', 'navigator', 'localStorage', 'fetch', 'IS_REACT_ACT_ENVIRONMENT'];
  const before = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const requests = [];
  const metrics = { available: true, views: 2, shares: 0, hearts: null, liked: false, activatedAt: '2026-10-19T00:00:00Z' };
  let rejectHeart = false;
  let deferShare = false;
  let releaseShare;
  Object.defineProperty(dom.window.navigator, 'clipboard', { value: { writeText: async () => {} }, configurable: true });
  Object.defineProperties(globalThis, {
    window: { value: dom.window, configurable: true }, document: { value: dom.window.document, configurable: true },
    navigator: { value: dom.window.navigator, configurable: true },
    localStorage: { value: dom.window.localStorage, configurable: true }, IS_REACT_ACT_ENVIRONMENT: { value: true, configurable: true },
    fetch: { value: async (url, init = {}) => {
      const body = init.body ? JSON.parse(init.body) : null;
      requests.push({ url, body });
      if (body?.type === 'heart' && rejectHeart) return Response.json({ available: false }, { status: 503 });
      if (body?.type === 'view') metrics.views += 1;
      if (body?.type === 'share') metrics.shares += 1;
      if (body?.type === 'heart') { metrics.liked = body.liked; metrics.hearts = body.liked ? 1 : null; }
      const response = Response.json(metrics);
      if (body?.type === 'share' && deferShare) await new Promise(resolve => { releaseShare = resolve; });
      return response;
    }, configurable: true },
  });
  const { createRoot } = require('react-dom/client');
  const root = createRoot(dom.window.document.getElementById('app'));
  const settle = async () => { await new Promise(resolve => setTimeout(resolve, 0)); };
  try {
    await React.act(async () => {
      root.render(React.createElement(ArticleEngagementProvider, { articleId: 'published-fixture' },
        React.createElement(ArticleEngagementSummary, { readingMinutes: 11 }),
        React.createElement(Actions, { path: '/blog/personal-finance/fixture/', title: 'ทดสอบ', placement: 'header' }),
        React.createElement(Actions, { path: '/blog/personal-finance/fixture/', title: 'ทดสอบ', placement: 'footer' }),
        React.createElement(ArticleCardEngagementControls, { title:'บทความตัวอย่าง', dateLabel: 'เผยแพร่ 7 ต.ค. 2569', publishedAt:'2026-10-07' }),
        React.createElement(ArticleCardEngagementControls, { title:'บทความตัวอย่าง', dateLabel: 'เผยแพร่ 7 ต.ค. 2569', publishedAt:'2026-10-07' })));
      await settle();
    });
    assert.equal(requests.filter(request => request.body).length, 0, 'no view/share write without existing analytics consent');
    assert.ok(dom.window.document.querySelector('[aria-label="เปิดอ่านที่บันทึกได้ 2 ครั้ง"]'));
    assert.ok(dom.window.document.querySelector('[aria-label="การแชร์ที่บันทึกได้ 0 ครั้ง"]'), 'known zero remains visible');
    assert.doesNotMatch(dom.window.document.querySelector('.articleReadingTime').outerHTML, /GA4|—|ย้อนหลัง/);
    assert.equal(dom.window.document.querySelectorAll('button[aria-pressed="false"]').length, 2);
    assert.equal(dom.window.document.querySelectorAll('.articleShareButtons > *').length, 8, 'four functional share controls at each placement');
    const controls = [...dom.window.document.querySelector('.articleShareButtons').children];
    assert.deepEqual(controls.map(node => node.getAttribute('aria-label')), ['แชร์บทความผ่าน LINE', 'แชร์บทความผ่าน Facebook', 'แชร์บทความผ่าน X', 'คัดลอกลิงก์บทความ']);
    assert.equal(dom.window.document.querySelectorAll('.articleReadingTime svg').length, 0, 'approved metadata uses plain text only');
    const heart = () => dom.window.document.querySelector('button[aria-pressed]');
    await React.act(async () => { heart().click(); await settle(); });
    assert.equal(dom.window.document.querySelectorAll('button[aria-pressed="true"]').length, 2, 'server-confirmed heart state is shared across header/footer');
    rejectHeart = true;
    await React.act(async () => { heart().click(); await settle(); });
    assert.equal(dom.window.document.querySelectorAll('button[aria-pressed="true"]').length, 2, 'failed write must not fake a changed total or heart state');
    dom.window.localStorage.setItem('ccpun_cookie_consent', JSON.stringify({ status: 'accepted_all', analytics: true, expires: Date.now() + 60000 }));
    await React.act(async () => { dom.window.dispatchEvent(new dom.window.CustomEvent('ccpun:consent')); await settle(); });
    await React.act(async () => { dom.window.dispatchEvent(new dom.window.CustomEvent('ccpun:consent')); await settle(); });
    assert.equal(requests.filter(request => request.body?.type === 'view').length, 1, 'one view nonce per article mount even after repeated consent notifications');
    const copy = dom.window.document.querySelector('[aria-label="คัดลอกลิงก์บทความ"]');
    await React.act(async () => { copy.click(); await settle(); });
    const share = requests.find(request => request.body?.type === 'share');
    assert.equal(share.body.analyticsConsent, true);
    assert.doesNotMatch(dom.window.document.querySelector('.articleReadingTime').textContent, /เปิดอ่าน|ถูกใจ/);
    assert.ok([...dom.window.document.querySelectorAll('button[aria-pressed]')].every(button=>button.textContent==='1'),'known server-confirmed card heart total visible');
    deferShare = true;
    await React.act(async () => { copy.click(); await settle(); });
    rejectHeart = false;
    await React.act(async () => { heart().click(); await settle(); });
    assert.equal(dom.window.document.querySelectorAll('button[aria-pressed="false"]').length, 2);
    await React.act(async () => { releaseShare(); await settle(); });
    assert.equal(dom.window.document.querySelectorAll('button[aria-pressed="false"]').length, 2, 'late share response must preserve latest acknowledged heart state');
    assert.doesNotMatch(dom.window.document.querySelector('.articleReadingTime').textContent, /ถูกใจ/);
    assert.ok(dom.window.document.querySelector('[aria-label="การแชร์ที่บันทึกได้ 2 ครั้ง"]'), 'verified share total remains monotonic');
    assert.match(share.body.eventId, /^[0-9a-f-]{36}$/);
    assert.ok(requests.every(request => request.url === '/api/article-engagement/published-fixture/'));
  } finally {
    await React.act(async () => root.unmount());
    for (const [name, descriptor] of before) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; }
    dom.window.close();
  }
});


test('actual Article shows latest information date only for a valid explicit optimize timestamp', () => {
  require.cache[require.resolve('../components/layout/website-43/Website43Shared.tsx')] = { exports: {
    Website43Navbar: () => null, Website43Footer: () => null, SectionHeading: () => null,
  } };
  require.cache[require.resolve('../components/ui/health-happy/HealthHappyCountdown.tsx')] = { exports: { __esModule: true, default: () => null } };
  const Article = require('../features/blog/website-43/Website43Article.tsx').default;
  const fixture = {
    id: 'published-fixture', slug: 'fixture', title: 'บทความตัวอย่าง', excerpt: 'ตัวอย่าง', category: 'การเงินส่วนบุคคล',
    categorySlug: 'personal-finance', authorName: 'ผู้เขียน', status: 'published', publishedAt: '2026-10-07T00:00:00Z',
    updatedAt: '2026-10-20T00:00:00Z', seoTitle: 'ตัวอย่าง', seoDescription: 'ตัวอย่าง',
    body: [{ type: 'paragraph', text: 'อ่านข้อมูลจากกรมสรรพากร', segments: [{ text: 'กรมสรรพากร', href: 'https://www.rd.go.th/' }] }],
    sources: [{ label: 'กรมสรรพากร', url: 'https://www.rd.go.th/' }],
    faq: [{ question: 'คำถามตัวอย่าง', answer: 'บรรทัดแรก\nบรรทัดถัดไป' }],
  };
  const render = (optimizedAt) => new JSDOM(renderToStaticMarkup(React.createElement(Article, { article: { ...fixture, optimizedAt } })));
  for (const value of [undefined, 'not-a-date']) {
    const dom = render(value);
    assert.doesNotMatch(dom.window.document.querySelector('header').textContent, /อัปเดต/);
    assert.equal(dom.window.document.querySelectorAll('[data-uat-section="article-sources"]').length, 0);
    assert.ok(dom.window.document.querySelector('.prose a[href="https://www.rd.go.th/"]'), 'inline evidence remains available in the article');
    dom.window.close();
  }
  const dom = render('2026-10-19T00:00:00Z');
  assert.match(dom.window.document.querySelector('header').textContent, /อัปเดตข้อมูลล่าสุด/);
  assert.equal(dom.window.document.querySelector('.articleUpdatedDate time').dateTime, '2026-10-19T00:00:00Z');
  assert.equal(dom.window.document.querySelector('.articleDateLabel').textContent, 'เผยแพร่');
  assert.equal(dom.window.document.querySelectorAll('header button[aria-pressed]').length,0,'Article has no heart action');
  assert.equal(dom.window.document.querySelectorAll('header .articleShareButtons > *').length,4,'Article retains three social shares and copy');
  assert.equal(dom.window.document.querySelector('.faqAnswer').style.whiteSpace, 'pre-line', 'retain the native Production FAQ newline fix');
  assert.match(dom.window.document.querySelector('.faqAnswer').textContent, /บรรทัดแรก\nบรรทัดถัดไป/);
  dom.window.close();
});

test('Sanity accepts only a valid explicit optimization timestamp and ignores malformed optional values', () => {
  const { baseArticleSchema } = require('../lib/content/sanity-schema.ts');
  const fixture = { _id: 'fixture', slug: 'fixture', title: 'ตัวอย่าง', category: 'การเงิน', updatedAt: '2026-10-20T00:00:00Z' };
  for (const value of [undefined, null, '', 'not-a-date', 1]) {
    assert.equal(baseArticleSchema.parse({ ...fixture, contentOptimizedAt: value }).contentOptimizedAt, undefined);
  }
  assert.equal(baseArticleSchema.parse({ ...fixture, contentOptimizedAt: '2026-10-19T00:00:00Z' }).contentOptimizedAt, '2026-10-19T00:00:00Z');
});

test('cards GET known totals without recording views on mount, consent or manual view; heart is explicit and server-confirmed', async () => {
  const pending=renderToStaticMarkup(React.createElement(CardEngagement,{articleId:'actual-sanity-id',title:'ภาษีบทความนี้',dateLabel:'เผยแพร่ 7 ต.ค. 2569',publishedAt:'2026-10-07'}));
  const pendingDom=new JSDOM(pending);
  assert.equal(pendingDom.window.document.querySelector('button[aria-pressed]').textContent,'','unknown total is not a fake zero');
  assert.equal(pendingDom.window.document.querySelector('[aria-label^="เปิดอ่านที่บันทึกได้"]'),null);
  pendingDom.window.close();
  const dom=new JSDOM('<div id="app"></div>',{url:'https://ccpun.com/blog/'});
  const names=['window','document','navigator','localStorage','fetch','IS_REACT_ACT_ENVIRONMENT'];
  const before=new Map(names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
  const requests=[];let unavailable=false;
  const metrics={available:true,views:0,hearts:0,shares:0,liked:false};
  Object.defineProperties(globalThis,{
    window:{value:dom.window,configurable:true},document:{value:dom.window.document,configurable:true},navigator:{value:dom.window.navigator,configurable:true},localStorage:{value:dom.window.localStorage,configurable:true},IS_REACT_ACT_ENVIRONMENT:{value:true,configurable:true},
    fetch:{value:async(url,init={})=>{const body=init.body?JSON.parse(init.body):null;requests.push({url,body});if(unavailable)return Response.json({available:false},{status:503});if(body?.type==='heart'){metrics.liked=body.liked;metrics.hearts=body.liked?1:0;}return Response.json(metrics);},configurable:true},
  });
  dom.window.localStorage.setItem('ccpun_cookie_consent',JSON.stringify({status:'accepted_all',analytics:true,expires:Date.now()+60000}));
  const {createRoot}=require('react-dom/client');const root=createRoot(dom.window.document.getElementById('app'));
  const settle=()=>new Promise(resolve=>setTimeout(resolve,0));
  function ManualViewProbe(){const {record}=useArticleEngagement();return React.createElement('button',{'data-probe':'view',onClick:()=>void record('view')},'probe');}
  try{
    await React.act(async()=>{root.render(React.createElement(CardEngagement,{articleId:'actual-sanity-id',title:'ภาษีบทความนี้',dateLabel:'เผยแพร่ 7 ต.ค. 2569',publishedAt:'2026-10-07'}));await settle();});
    assert.equal(dom.window.document.querySelector('button[aria-pressed]').getAttribute('aria-label'),'ถูกใจบทความ: ภาษีบทความนี้');
    assert.equal(requests.length,1);assert.equal(requests[0].body,null,'actual Card wrapper mounts GET only');
    assert.equal(dom.window.document.querySelector('[aria-label="เปิดอ่านที่บันทึกได้ 0 ครั้ง"]').textContent,'0');
    assert.equal(dom.window.document.querySelector('button[aria-pressed]').textContent,'0','API-confirmed zero visible');
    await React.act(async()=>{dom.window.dispatchEvent(new dom.window.CustomEvent('ccpun:consent'));await settle();});
    assert.ok(requests.every(request=>request.body===null),'consent never records card impressions as Article views');
    await React.act(async()=>{dom.window.document.querySelector('button[aria-pressed]').click();await settle();});
    assert.equal(requests.filter(request=>request.body?.type==='heart').length,1);
    assert.equal(dom.window.document.querySelector('button[aria-pressed]').getAttribute('aria-pressed'),'true');
    assert.equal(dom.window.document.querySelector('button[aria-pressed]').textContent,'1');
    assert.equal(dom.window.document.querySelector('button[aria-pressed]').getAttribute('aria-label'),'ยกเลิกถูกใจบทความ: ภาษีบทความนี้');
    unavailable=true;await React.act(async()=>{dom.window.document.querySelector('button[aria-pressed]').click();await settle();});
    assert.equal(dom.window.document.querySelector('button[aria-pressed]').getAttribute('aria-pressed'),'true','failure retains acknowledged state');
    assert.match(dom.window.document.querySelector('[role="status"]').textContent,/บันทึกถูกใจไม่สำเร็จ/);
    await React.act(async()=>{root.render(React.createElement(ArticleEngagementProvider,{articleId:'guard-id',recordView:false},React.createElement(ManualViewProbe)));await settle();});
    await React.act(async()=>{dom.window.document.querySelector('[data-probe="view"]').click();dom.window.dispatchEvent(new dom.window.CustomEvent('ccpun:consent'));await settle();});
    assert.equal(requests.filter(request=>request.body?.type==='view').length,0,'manual context record and consent both honor recordView=false');
    assert.ok(requests.every(request=>request.body===null||request.body.type==='heart'));
  }finally{await React.act(async()=>root.unmount());for(const[name,descriptor]of before){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}dom.window.close();}
});


test('card/byline/intro admissions reconstruct every complete original owner and reject unrelated changes', () => {
  const pins={
    'features/blog/website-43/Website43Article.tsx':'c808e31c1e6e43e6c8ca7bb2b41efe7c82c36c696c1b0a1ee0eb6363dfaea3ae',
    'features/blog/website-43/Website43BlogInteractive.tsx':'229035fb264ee95052543622aee9211f18d4badd314af8accbba72f78b14ad80',
    'features/blog/website-43/Website43ArticleBody.tsx':'a6e73b3fe0e67d728be2e4d26083ae08be17ad4493c31431145b8d74297dba07',
    'features/blog/website-43/blogData.ts':'638ad83c50a55ad09816327d22d63447679c417be3dd58e0680c27ef8a6fc886',
  };
  for(const [file,digest]of Object.entries(pins)){
    const source=readFileSync(file,'utf8');
    const check=value=>{let original=reviewedThaiWrapProjection(file,reviewedArticleCardProjection(file,value));if(file.endsWith('/Website43Article.tsx'))original=articleOverviewSourceProjection(original);assert.equal(createHash('sha256').update(original).digest('hex'),digest);};
    check(source);assert.throws(()=>check(source+'\n// unknown change'));
    const change=file.endsWith('/blogData.ts')?source.replace('id: article.id','id: article.slug'):file.endsWith('/Website43ArticleBody.tsx')?source.replace('fontSize: 19','fontSize: 20'):file.endsWith('/Website43BlogInteractive.tsx')?source.replace('articleId={article.id}','articleId={article.slug}'):source.replace("author.name.replaceAll('™', '')","'invented AFPT'");
    assert.notEqual(change,source);assert.throws(()=>check(change));
  }
});
