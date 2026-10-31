import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { assertProductionCmsOwner, cmsSha, productionCmsOwners, v5ProductionSourcePredecessor } from '../qa/production-cms-source-proof.mjs';
import { loadFixtureModule } from '../qa/phase1-fixture-loader.mjs';
import postcss from 'postcss';

const require = createRequire(import.meta.url);
require('tsx/cjs');
require.extensions['.css'] = (mod) => {
  mod.exports = { __esModule: true, default: new Proxy({}, { get: (_obj, name) => String(name) }) };
};
const css = readFileSync('components/ui/health-happy/HealthHappyCountdown.module.css', 'utf8');
const countdownFile='components/ui/health-happy/HealthHappyCountdown.tsx';
const currentSource=readFileSync(countdownFile,'utf8');
const legacyPreloadSource=v5ProductionSourcePredecessor(countdownFile,currentSource);
const legacyImport=legacyPreloadSource.match(/import countdownArtwork from ['"]@\/(public\/[^'"]+)['"]/);
assert.ok(legacyImport,'historical exact source retains its reviewed artwork import');
const cssArtworkPath=resolve(legacyImport[1]);
const artworkUrl = '/_next/static/media/countdown-artwork.build-hash.webp';
require.extensions['.webp'] = (mod, filename) => {
  assert.equal(filename, cssArtworkPath, 'preload and CSS import the same source artwork');
  mod.exports = { __esModule: true, default: { src: artworkUrl } };
};
const Countdown = require('../components/ui/health-happy/HealthHappyCountdown.tsx').default;
const render = (placement) => renderToStaticMarkup(createElement(Countdown, { placement }));

test('flat native SSR never requests decorative artwork while preserving placement context', () => {
  assert.doesNotMatch(css,/background(?:-image)?:\s*url\(/);
  for(const placement of ['home','blog','article']){
    const html=render(placement);
    assert.doesNotMatch(html,/rel="preload"|<img\b/);
    assert.ok(html.includes(`data-campaign-placement="${placement}"`));
  }
  assert.equal(render('blog').replace('data-campaign-placement="blog"','data-campaign-placement="home"'),render('home'));
});

test('Home, Article and repeated Blog SSR have no redundant countdown preload', () => {
  for(const placement of ['home','article'])assert.doesNotMatch(render(placement),/rel="preload"/);
  const html=renderToStaticMarkup([createElement(Countdown,{placement:'blog',key:'one'}),createElement(Countdown,{placement:'blog',key:'two'})]);
  assert.equal((html.match(/rel="preload"/g)??[]).length,0);
});

test('flat successor retains original74 preload identity and complete prior SSR while denying unrelated drift', () => {
  const file=countdownFile,source=currentSource;
  assertProductionCmsOwner(file,source);
  const prior=legacyPreloadSource.replace("import { preload } from 'react-dom';\n",'')
    .replace(/import countdownArtwork[^\n]+\n/,'')
    .replace(/  if \(placement === 'blog'\) \{\n    preload[^\n]+\n  \}\n/,'')
    .replace(/\b(t|text|copyText)\.node\((["'])/g,'$1($2');
  assert.equal(cmsSha(prior),productionCmsOwners[file].after,'original full74 identity remains frozen');
  for(const mutant of [
    prior,legacyPreloadSource,
    legacyPreloadSource.replace("placement === 'blog'","placement === 'home'"),
    legacyPreloadSource.replace("fetchPriority: 'high'","fetchPriority: 'low'"),
    legacyPreloadSource.replace('article.lossless.webp','article.png'),
    source.replace('2026-11-30T23:59:59+07:00','2026-11-29T23:59:59+07:00'),
    source.replace('site.extra.headline','site.extra.date'),
    source.replace('splitDigits = false','splitDigits = true'),
    source+"\nimport { preload } from 'react-dom';\n",source+'\n// unrelated\n',
  ]) {assert.notEqual(mutant,source);assert.throws(()=>assertProductionCmsOwner(file,mutant));}
  const before=loadFixtureModule(file,{sources:new Map([[file,prior]])}).default;
  const after=loadFixtureModule(file).default;
  const beforeHtml=renderToStaticMarkup(createElement(before,{placement:'blog'}));
  const afterHtml=renderToStaticMarkup(createElement(after,{placement:'blog'}));
  assert.equal(afterHtml,beforeHtml,'default banner markup, public copy and click attributes remain byte-exact without artwork');
  const virtual='tests/virtual-public-artwork.ts';
  assert.throws(()=>loadFixtureModule(virtual,{sources:new Map([
    [virtual,"import artwork from '@/public/../outside.webp'; export default artwork;"],
    ['public/../outside.webp','virtual bytes must never be evaluated'],
  ])}),/Fixture asset must remain public/);
});

test('expired client countdown still disappears after its existing clock effect', async (t) => {
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://example.test/' });
  const previous = { window: globalThis.window, document: globalThis.document, act: globalThis.IS_REACT_ACT_ENVIRONMENT };
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  t.mock.method(Date, 'now', () => Date.parse('2026-12-01T00:00:00+07:00'));
  const { createRoot } = require('react-dom/client');
  const container = dom.window.document.getElementById('root');
  const root = createRoot(container);
  try {
    await act(async () => root.render(createElement(Countdown, { placement: 'blog' })));
    assert.equal(container.innerHTML, '');
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    globalThis.window = previous.window;
    globalThis.document = previous.document;
    globalThis.IS_REACT_ACT_ENVIRONMENT = previous.act;
  }
});


test('Home tablet countdown retains full copy, eight split tiles, four labelled units and both safe actions',()=>{
  const html=renderToStaticMarkup(createElement(Countdown,{placement:'home',splitDigits:true}));
  assert.equal((html.match(/class="digit"/g)??[]).length,8);
  assert.equal((html.match(/class="timeLabel"/g)??[]).length,4);
  assert.equal((html.match(/data-campaign-action=/g)??[]).length,2);
  assert.match(html,/target="_blank" rel="noopener noreferrer"/);
  for(const className of ['brandAia','brandName','headline','date'])assert.match(html,new RegExp('class="'+className+'"[^>]*>[^<]+'));
  const marker='\n/* Home tablet card keeps full-width copy/timer;';
  assert.equal(cmsSha(css.slice(0,css.indexOf(marker))),'05b5e5726c6227036dbf0a18b63cc8a05420a51ec32464be4e0b713c9647e14c','original countdown CSS and every other breakpoint/placement remain byte-exact');
  let rules;postcss.parse(css).walkAtRules('media',media=>{if(media.params==='(min-width: 768px) and (max-width: 1023px)' && media.nodes.some(n=>n.type==='rule'&&n.selector==='.splitDigits[data-campaign-placement="home"] .frame'&&n.nodes.some(d=>d.type==='decl'&&d.prop==='grid-template-columns'))){assert.ok(!rules,'only one Home tablet frame block');rules=media;}});
  assert.ok(rules,'one exact Home tablet variant');
  assert.equal(rules.params,'(min-width: 768px) and (max-width: 1023px)');
  const props={};rules.walkRules(rule=>{assert.ok(rule.selector.startsWith('.splitDigits[data-campaign-placement="home"]'));props[rule.selector]=Object.fromEntries(rule.nodes.filter(n=>n.type==='decl').map(d=>[d.prop,d.value]));});
  assert.equal(props['.splitDigits[data-campaign-placement="home"] .timer']['grid-template-columns'],'repeat(4, minmax(0, 1fr))');
  assert.equal(props['.splitDigits[data-campaign-placement="home"] .actions']['padding-inline-end'],'64px');
  assert.equal(props['.splitDigits[data-campaign-placement="home"] .actions']['grid-template-columns'],'repeat(2, minmax(0, 1fr))');
  for(const selector of ['.frame','.timer'])assert.equal(props['.splitDigits[data-campaign-placement="home"] '+selector]['padding-inline-end'],undefined,'only actions reserve the dock strip');
});


test('Home tablet countdown proof rejects partial media changes, mutated timer and unknown owners',async()=>{
 const {reviewedV5PredecessorDigest}=await import('../qa/phase2-source-proof.mjs');
 const file='components/ui/health-happy/HealthHappyCountdown.module.css',before='73e39a9e3f17af98b25e9a12b706d0a9729260aced6bd47425e79dd9ec6e9766';
 assert.equal(reviewedV5PredecessorDigest(file,css,before),before);
 for(const mutant of [css.replace('data-campaign-placement="blog"','data-campaign-placement="article"'),css.replace('padding-inline-end: 64px','padding-inline-end: 0'),css.replace('repeat(4, minmax(0, 1fr))','repeat(2, minmax(0, 1fr))'),css.replace('font-size: 48px','font-size: 28px'),css.replace('min(620px, calc(100% - 80px))','100%'),css+'\n/* unrelated */']){
   assert.notEqual(mutant,css);assert.throws(()=>reviewedV5PredecessorDigest(file,mutant,before));
 }
 assert.throws(()=>reviewedV5PredecessorDigest('unknown/countdown.css',css,before));
});


test('native Tablet48 countdown centers both equal CTAs and clears the LINE dock at 768/820/834/1023',()=>{
  const tablet=[];
  postcss.parse(css).walkAtRules('media',media=>{
    if(media.params!=='(min-width: 768px) and (max-width: 1023px)')return;
    media.walkRules(rule=>{
      if(rule.selector.startsWith('.splitDigits:is('))tablet.push({selector:rule.selector,props:Object.fromEntries(rule.nodes.filter(n=>n.type==='decl').map(d=>[d.prop,d.value]))});
    });
  });
  assert.equal(tablet.length,3,'exactly the three native-first Tablet48 successor rules');
  for(const rule of tablet){
    for(const placement of ['home','blog','article'])assert.ok(rule.selector.includes('placement="'+placement+'"'));
  }
  const font=tablet.find(rule=>rule.selector.endsWith('.numeral'));
  const label=tablet.find(rule=>rule.selector.endsWith('.timeLabel'));
  const actions=tablet.find(rule=>rule.selector.endsWith('.actions'));
  assert.equal(font.props['font-size'],'48px');
  assert.equal(label.props['font-size'],'18px');
  assert.equal(actions.props.width,'min(620px, calc(100% - 80px))');
  assert.equal(actions.props['justify-self'],'center');
  assert.equal(actions.props['margin-inline'],'auto');
  assert.equal(actions.props['padding-inline-end'],'0');
  for(const width of [768,820,834,1023]){
    const frame=width-64,content=frame-48,actionWidth=Math.min(620,content-80);
    const right=width/2+actionWidth/2,dockLeft=width-80;
    assert.ok(dockLeft-right>=16,`tablet ${width}px: both balanced buttons end at least 16px before the LINE dock`);
  }
});


test('all three full-shell placements protect only actions across eight approved width contexts',()=>{
 const rules=[];postcss.parse(css).walkAtRules('media',media=>{media.walkRules(rule=>{if(rule.selector.startsWith('.splitDigits:is(') && media.params !== '(min-width: 768px) and (max-width: 1023px)')rules.push({media:media.params,selector:rule.selector,props:Object.fromEntries(rule.nodes.filter(n=>n.type==='decl').map(d=>[d.prop,d.value]))});});});
 assert.equal(rules.length,3);for(const rule of rules){assert.match(rule.selector,/placement="home"/);assert.match(rule.selector,/placement="blog"/);assert.match(rule.selector,/placement="article"/);}
 const mobile=rules.find(r=>r.media==='(max-width: 767px)');assert.equal(mobile.props['padding-inline-end'],'64px');
 const desktop=rules.find(r=>r.props['grid-column']==='1 / -1');assert.equal(desktop.props['grid-template-columns'],'repeat(2, minmax(0, 1fr))');assert.equal(desktop.props['padding-inline-end'],'max(168px, calc(248px - var(--v5-gutter) - 24px))');
 for(const placement of ['home','blog','article'])for(const theme of ['light','dark'])for(const width of [390,820,1440,1920]){
  const gutter=width>=1200?80:width>=768?32:20,card=Math.min(1280,width-2*gutter),left=(width-card)/2,padding=width<=650?16:24;
  const reserve=width<1024?64:Math.max(168,248-gutter-24),end=left+card-1-padding-reserve;
  const dockLeft=width<1024?width-80:width-248;
  assert.ok(end<dockLeft,`${theme}/${width}: full action target clears conservative fixed dock geometry`);
  const html=renderToStaticMarkup(createElement(Countdown,{placement,splitDigits:true}));assert.equal((html.match(/class="digit"/g)??[]).length,8);assert.equal((html.match(/class="timeLabel"/g)??[]).length,4);assert.equal((html.match(/data-campaign-action=/g)??[]).length,2);
 }
});
