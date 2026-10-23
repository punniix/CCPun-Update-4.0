import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadFixtureModule } from '../qa/phase1-fixture-loader.mjs';
import { assertReviewedMasterUatOwner, reviewedMasterUatOwners } from '../qa/phase2-source-proof.mjs';
const read = path => readFileSync(path,'utf8');
const path = 'features/blog/website-43/Website43Article.tsx';
const summary = 'บทความอธิบายวิธีแยกรายได้ ค่าใช้จ่าย และค่าลดหย่อน เพื่อเห็นภาพลำดับการคำนวณภาษี\nยกตัวอย่างข้อมูลที่ต้องเตรียมและข้อควรตรวจสอบ ก่อนนำไปคำนวณตามบทความ';
const Overview = loadFixtureModule('features/blog/website-43/Website43ArticleOverview.tsx').default;

test('native default-open overview renders full SSR text, two points, and no empty box or legacy truncation', () => {
  for (const blank of [null, undefined, '', ' \n\t ']) assert.equal(renderToStaticMarkup(React.createElement(Overview,{summary:blank})), '');
  const html = renderToStaticMarkup(React.createElement(Overview,{summary}));
  assert.match(html, /<details[^>]*open=""[^>]*lang="th"/); assert.match(html, /<summary[^>]*>สรุปบทความนี้/);
  assert.equal((html.match(/<li/g)||[]).length,2);
  for (const point of summary.split('\n')) assert.ok(html.includes(point));
  const legacy = 'สรุปเดิมที่ได้รับอนุมัติและเผยแพร่แล้ว '.repeat(20);
  const legacyHtml = renderToStaticMarkup(React.createElement(Overview,{summary:legacy}));
  assert.ok(legacyHtml.includes(legacy)); assert.equal((legacyHtml.match(/<li>/g)||[]).length,1);
  const editorialPoints = ['สรุปเดิมข้อแรกยังอยู่ครบ', 'สรุปเดิมข้อสองยังอยู่ครบ', 'สรุปเดิมข้อสามยังอยู่ครบ'];
  const editorialHtml = renderToStaticMarkup(React.createElement(Overview,{summary:editorialPoints.join('\r\n\r\n')}));
  assert.equal((editorialHtml.match(/<li>/g)||[]).length,3);
  for (const point of editorialPoints) assert.ok(editorialHtml.includes(point));
  for (const markup of [html,legacyHtml,editorialHtml]) { assert.match(markup, /<ul>/); assert.doesNotMatch(markup, /<p[\s>]/); }
  assert.doesNotMatch(html, /aria-hidden="true"[^>]*>[^<]*บทความ|fetch\(|loading=|placeholder/);
});

test('actual Article composition hides Draft/preview/empty and places overview after mobile TOC before body', async () => {
  const component = (tag, label='') => function FixtureComponent({children}) { return React.createElement(tag,null,label,children); };
  const mocks = new Map([
    ['@/lib/content/public-copy', { getPublicCopy: async () => ({}) }],
    ['@/components/layout/website-43/Website43Shared', { Website43Navbar:()=>null, Website43Footer:()=>null, SectionHeading:()=>null }],
    ['./ArticleEngagement', { ArticleEngagementProvider:component('div'), ArticleEngagementSummary:()=>null }],
    ['./ArticleShareActions', { __esModule:true,default:()=>null }],
    ['./Website43ArticleToc', { __esModule:true,default:()=>React.createElement('nav',null,'TOC-FIXTURE') }],
    ['./Website43ArticleBody', { renderWebsite43ArticleBody:()=>React.createElement('p',null,'BODY-FIXTURE') }],
    ['./Website43ArticleOverview', {__esModule:true,default:Overview}],
  ]);
  const Article = loadFixtureModule(path,{mocks}).default;
  const article = {id:'article',slug:'overview-test',title:'บทความ',category:'การเงินส่วนบุคคล',categorySlug:'personal-finance',status:'published',body:[{type:'heading',level:2,text:'หัวข้อ'}],geo:{summary},featuredImage:{src:'/image.webp',alt:'IMAGE-FIXTURE',width:720,height:400}};
  const html = renderToStaticMarkup(await Article({article}));
  assert.ok(html.indexOf('IMAGE-FIXTURE')<html.lastIndexOf('TOC-FIXTURE'));
  assert.ok(html.lastIndexOf('TOC-FIXTURE')<html.indexOf('สรุปบทความนี้'));
  assert.ok(html.indexOf('สรุปบทความนี้')<html.indexOf('BODY-FIXTURE'));
  assert.ok(renderToStaticMarkup(await Article({article:{...article,status:'draft'},preview:true})).includes('สรุปบทความนี้'),'authorized Draft Preview renders the current draft summary');
  for (const props of [{article:{...article,status:'draft'}},{article:{...article,geo:{summary:' '}}},{article:{...article,status:'draft',geo:{summary:' '}},preview:true}]) assert.ok(!renderToStaticMarkup(await Article(props)).includes('สรุปบทความนี้'));
});

test('reviewed editable Article source rejects status, overview and unrelated drift', () => {
  const source = read(path), digest = reviewedMasterUatOwners[path].before;
  const check = value => assertReviewedMasterUatOwner(path, digest, value);
  check(source);
  for (const mutant of [source.replace("article.status === 'published'", "article.status !== 'published'"), source.replace('summary={article.geo?.summary}', 'summary={article.excerpt}'), source + "\n// unknown change\n"]) {
    assert.notEqual(mutant, source); assert.throws(() => check(mutant));
  }
});

test('overview uses native Thai wrapping, unconstrained height and reduced-motion-safe disclosure', () => {
  const css=read('features/blog/website-43/Website43ArticleOverview.module.css');
  assert.match(css,/word-break: normal/); assert.match(css,/text-wrap: pretty/); assert.match(css,/@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css,/\.content ul \{[^}]*list-style-type: disc;[^}]*list-style-position: outside;/);
  assert.doesNotMatch(css,/(?:^|[;{]\s*)(?:max-)?height:\s*\d|word-break:\s*break-all|display:\s*none[^}]*content|overflow:\s*hidden/);
  assert.doesNotMatch(read('features/blog/website-43/Website43ArticleOverview.tsx'),/\u200b|<br\b|\.slice\(|dangerouslySetInnerHTML|fetch\(/);
});


test('editable Thai-wrap owners admit exact reviewed source and reject content/font/unknown drift', () => {
  for (const file of ['features/blog/website-43/Website43Article.tsx','features/blog/website-43/Website43BlogInteractive.tsx','features/blog/website-43/Website43ArticleToc.tsx']) {
    const source = read(file), digest = reviewedMasterUatOwners[file].before;
    assertReviewedMasterUatOwner(file, digest, source);
    assert.match(source, /textWrap: 'pretty'/);
    for (const changed of [source + '\n// unrelated', source.replace("textWrap: 'pretty'", "textWrap: 'nowrap'")]) {
      assert.notEqual(changed, source); assert.throws(() => assertReviewedMasterUatOwner(file, digest, changed));
    }
  }
});

test('native typing advances only complete Thai/emoji graphemes and cleans only owned ranges; fallbacks stay full', () => {
  const saved = new Map();
  const put=(key,value)=>{if(!saved.has(key))saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});};
  const effects=[],refs=[],observers=[],timers=new Map(),ranges=[];
  const motion=Object.assign(new EventTarget(),{matches:false});
  let timerId=0,walkIndex=0;
  const document=Object.assign(new EventTarget(),{hidden:false,getSelection:()=>({anchorNode:null}),createTreeWalker:content=>{walkIndex=0;return{nextNode:()=>content.nodes[walkIndex++]??null};}});
  class FakeRange { setStart(node,offset){this.start={node,offset};this.offsets??=[];this.offsets.push(offset);} setEnd(node,offset){this.end={node,offset};} constructor(){ranges.push(this);} }
  class FakeHighlight extends Set {}
  class FakeObserver { constructor(callback){this.callback=callback;observers.push(this);} observe(){} disconnect(){this.disconnected=true;} }
  put('CSS',{highlights:new Map()});put('Highlight',FakeHighlight);put('Range',FakeRange);put('IntersectionObserver',FakeObserver);
  put('NodeFilter',{SHOW_TEXT:4});put('document',document);put('window',new EventTarget());put('innerHeight',800);put('matchMedia',()=>motion);
  put('setTimeout',fn=>{const id=++timerId;timers.set(id,fn);return id;});put('clearTimeout',id=>timers.delete(id));
  try {
    const overviewModule=loadFixtureModule('features/blog/website-43/Website43ArticleOverview.tsx',{mocks:new Map([['@/components/ui/PublicCopyProvider', {usePublicCopy: defaults => key => defaults[key]}], ['react',{...React,useRef:()=>({current:refs.shift()}),useEffect:effect=>effects.push(effect)}]])});
    const text='กิ้👩‍💻ไทยอ่านได้ครบประโยคและคงรูปสระทุกตัว';
    const ends=overviewModule.overviewGraphemeEnds(text);assert.deepEqual(ends.slice(0,2),[3,8]);
    const mount=(options={})=>{
      const details=Object.assign(new EventTarget(),{open:true});
      const node={data:text}; const content={nodes:[node],contains:()=>false,getBoundingClientRect:()=>({top:options.visible?10:1000,bottom:1100})};
      refs.push(details,content);overviewModule.default({summary:options.summary??text});const cleanup=effects.shift()();return{details,content,cleanup};
    };
    const a=mount(),b=mount();assert.equal(CSS.highlights.size,0,'SSR/base text remains visible before first view');
    observers[0].callback([{isIntersecting:true}]);observers[1].callback([{isIntersecting:true}]);
    const highlight=CSS.highlights.get('ccpun-overview-pending');assert.equal(highlight.size,2);
    a.details.open=false;a.details.dispatchEvent(new Event('toggle'));assert.equal(highlight.size,1,'collapse removes only its own Range');assert.equal(CSS.highlights.get('ccpun-overview-pending'),highlight);
    for(let i=0;timers.size&&i<100;i++){const [id,fn]=timers.entries().next().value;timers.delete(id);fn();}
    assert.equal(CSS.highlights.size,0);assert.ok(observers.every(observer=>observer.disconnected));
    for(const range of ranges)for(const offset of range.offsets)assert.ok(offset===0||ends.includes(offset),'Range never splits Thai combining marks or emoji');
    observers[0].callback([{isIntersecting:true}]);assert.equal(CSS.highlights.size,0,'collapse/re-entry never restarts');a.cleanup();b.cleanup();
    const before=observers.length;motion.matches=true;mount().cleanup?.();motion.matches=false;
    mount({summary:'บทความเดิม '.repeat(100)}).cleanup?.();mount({visible:true}).cleanup?.();
    assert.equal(observers.length,before,'reduced motion, legacy long text and already-visible text stay fully static');
    const foreign=new FakeHighlight();CSS.highlights.set('ccpun-overview-pending',foreign);const c=mount();observers.at(-1).callback([{isIntersecting:true}]);c.cleanup();assert.equal(CSS.highlights.get('ccpun-overview-pending'),foreign,'foreign registry entries are not overwritten or deleted');CSS.highlights.clear();
    const d=mount();observers.at(-1).callback([{isIntersecting:true}]);document.hidden=true;document.dispatchEvent(new Event('visibilitychange'));assert.equal(CSS.highlights.size,0);assert.equal(timers.size,0);d.cleanup();document.hidden=false;
    put('Highlight',undefined);const prior=observers.length;mount().cleanup?.();assert.equal(observers.length,prior,'unsupported API keeps complete text');
  } finally { for(const [key,descriptor] of saved) { if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]; } }
});
