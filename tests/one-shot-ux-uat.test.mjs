import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import ts from 'typescript';
import React, {act} from 'react';
import {JSDOM} from 'jsdom';
import {loadFixtureModule} from '../qa/phase1-fixture-loader.mjs';
const require=createRequire(import.meta.url);require('tsx/cjs');
const fixture=require('../lib/content/uat-tax-table-fixture.ts');
const urls=require('../lib/content/url.ts');
const snapshots=JSON.parse(readFileSync('lib/content/uat-public-article-snapshots.json','utf8'));
const uat={CCPUN_DEPLOYMENT_PROVIDER:'hostinger',CCPUN_DEPLOYMENT_ROLE:'web',CCPUN_APP_ENV:'web-uat',NEXT_PUBLIC_SANITY_PROJECT_ID:'ccb9lnw5',NEXT_PUBLIC_SANITY_DATASET:'uat'};

test('all ten approved public article routes resolve only in the exact UAT lane',()=>{
  assert.equal(snapshots.length,10);
  for(const article of snapshots){
    assert.ok(article.id.startsWith('uat-public-snapshot-'));
    assert.equal(article.noindex,true);
    assert.ok(article.body.length>0 && article.authorName && article.seoDescription);
    const [category,slug]=urls.getArticlePath(article).split('/').filter(Boolean).slice(1);
    assert.equal(fixture.getUatTaxTableFixture(category,slug,uat).id,article.id);
    for(const [key,value] of Object.entries({CCPUN_APP_ENV:'production',CCPUN_DEPLOYMENT_PROVIDER:'local',CCPUN_DEPLOYMENT_ROLE:'admin',NEXT_PUBLIC_SANITY_PROJECT_ID:'kyfxgjnq',NEXT_PUBLIC_SANITY_DATASET:'production'}))assert.equal(fixture.getUatTaxTableFixture(category,slug,{...uat,[key]:value}),null);
  }
  assert.ok(fixture.getUatTaxTableFixture('critical-illness-insurance','what-is-critical-illness-insurance',uat));
  assert.equal(fixture.getUatTaxTableFixture('critical-illness-insurance','critical-illness-insurance',uat),null);
  assert.equal(fixture.withUatTaxTableFixture([],uat).length,11);
  assert.equal(fixture.withUatTaxTableFixture(snapshots,uat).length,11);
});

test('exact public image paths are restricted to UAT and exclude other lanes',()=>{
  function config(env){
    const web=loadFixtureModule('lib/runtime/web-build-config.mjs',{globals:{process:{env}}});
    return loadFixtureModule('apps/web/next.config.ts',{globals:{process:{env,cwd:()=>process.cwd()}},mocks:new Map([
    ['../../lib/runtime/web-build-config.mjs',web],
    ['../../lib/runtime/security-headers.mjs',{buildNextSecurityHeaders:()=>[]}],
  ])}).default;}
  const extra=env=>config(env).images.remotePatterns.filter(p=>p.pathname.startsWith('/images/kyfxgjnq/production/'));
  const allowed=extra(uat);assert.equal(allowed.length,18);assert.equal(new Set(allowed.map(p=>p.pathname)).size,18);
  for(const p of allowed){assert.equal(p.hostname,'cdn.sanity.io');assert.equal(p.protocol,'https');assert.equal(p.search,'');assert.ok(!p.pathname.includes('*'));}
  for(const [key,value] of Object.entries({CCPUN_APP_ENV:'production',CCPUN_DEPLOYMENT_PROVIDER:'local',CCPUN_DEPLOYMENT_ROLE:'admin',NEXT_PUBLIC_SANITY_PROJECT_ID:'wrong',NEXT_PUBLIC_SANITY_DATASET:'wrong'}))assert.equal(extra({...uat,[key]:value}).length,0,key);
  assert.equal(extra({...uat,CCPUN_APP_ENV:'production',NEXT_PUBLIC_SANITY_PROJECT_ID:'kyfxgjnq',NEXT_PUBLIC_SANITY_DATASET:'production'}).length,1,'only pre-existing Production dataset pattern remains');
});

const dom=new JSDOM('<div id="root"></div>',{url:'https://test.ccpun.com/'});
for(const name of ['window','document','HTMLElement','Element','Event','MouseEvent'])Object.defineProperty(globalThis,name,{configurable:true,value:dom.window[name]});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const {createRoot}=await import('react-dom/client');
async function mount(Component,props){const root=createRoot(document.getElementById('root'));await act(async()=>root.render(React.createElement(Component,props)));return root;}

test('Money selection and result have real programmatic focus targets without extra Tab stops',async()=>{
  const screens=loadFixtureModule('features/money-story/components/MoneyStoryScreens.tsx');
  const engine=loadFixtureModule('features/money-story/engine.ts');
  const chars=loadFixtureModule('features/money-story/characters.ts').MONEY_STORY_CHARACTERS;
  const noop=()=>{};const ref=React.createRef();
  let root=await mount(screens.MoneyStorySelection,{rootRef:ref,selectedCharacterId:null,setSelectedCharacterId:noop,start:noop});
  ref.current.focus();assert.equal(document.activeElement,ref.current);assert.equal(ref.current.tabIndex,-1);assert.equal(document.querySelectorAll('[aria-pressed]').length,8);await act(async()=>root.unmount());
  const game={...engine.createGame('focus-fixture',chars[0].id),status:'survive',currentMonth:12};
  root=await mount(screens.MoneyStoryResult,{game,character:chars[0],bars:engine.statusBars(game),rootRef:ref,canUndo:false,undo:noop,replay:noop,share:noop,shareStatus:'',onPyramidClick:noop,onLineClick:noop});
  ref.current.focus();assert.equal(document.activeElement,ref.current);assert.equal(ref.current.tabIndex,-1);assert.ok(document.querySelector('h2'));await act(async()=>root.unmount());
});

test('Cookie switches expose unique category names and retain state semantics',async()=>{
  const {CategoryRow}=loadFixtureModule('features/analytics/components/CookieConsentPreferences.tsx');
  const root=await mount(()=>React.createElement(React.Fragment,null,...['Performance Cookies','Analytics Cookies','Social Cookies'].map((label,index)=>React.createElement(CategoryRow,{key:label,label,description:'Public category',checked:false,onChange:()=>{},toggleId:'category-'+index}))));
  const switches=[...document.querySelectorAll('[role="switch"]')];assert.equal(switches.length,3);assert.equal(new Set(switches.map(el=>el.getAttribute('aria-label'))).size,3);
  for(const el of switches){assert.equal(el.getAttribute('aria-checked'),'false');assert.match(el.getAttribute('aria-label'),/Cookies: ปิด/);}
  await act(async()=>root.unmount());
});

test('all parity article metadata and display bypass CMS and remain noindex without a canonical or schema',async()=>{
  const {renderToStaticMarkup}=await import('react-dom/server');
  const page=loadFixtureModule('features/blog/pages/ArticlePage.tsx',{mocks:new Map([
    ['@/lib/content/uat-tax-table-fixture',{getUatTaxTableFixture:(category,slug)=>fixture.getUatTaxTableFixture(category,slug,uat),withUatTaxTableFixture:items=>fixture.withUatTaxTableFixture(items,uat)}],
    ['@/lib/content/provider',{getContentProvider:()=>{throw Error('Parity display must not query CMS');}}],
    ['next/headers',{draftMode:()=>{throw Error('Parity display must not open draft mode');}}],
    ['@/features/blog/website-43/Website43Article',{__esModule:true,default:({article,relatedArticles})=>React.createElement('article',{'data-related':relatedArticles.length},article.title)}],
  ])});
  for(const article of snapshots){
    const [category,slug]=urls.getArticlePath(article).split('/').filter(Boolean).slice(1);
    const props={params:Promise.resolve({category,slug})};
    const metadata=await page.generateMetadata(props);
    assert.deepEqual(metadata.robots,{index:false,follow:false});assert.equal(metadata.alternates.canonical,null);assert.equal(metadata.openGraph.url,undefined);
    const html=renderToStaticMarkup(await page.default(props));assert.ok(html.includes(article.title));assert.ok(!html.includes('application/ld+json'));
  }
});

test('test-display category overlay never activates excluded categories or crosses lanes',()=>{
  const menu=[{slug:'investment',title:'การลงทุน'}];
  const visible=fixture.withUatSnapshotCategoryMenu(menu,['motor-insurance'],uat);
  assert.ok(visible.some(item=>item.slug==='investment'));assert.ok(!visible.some(item=>item.slug==='motor-insurance'));
  assert.equal(visible.length,5);assert.equal(new Set(visible.map(item=>item.slug)).size,visible.length);
  for(const [key,value] of Object.entries({CCPUN_APP_ENV:'production',CCPUN_DEPLOYMENT_ROLE:'admin',NEXT_PUBLIC_SANITY_DATASET:'production'}))assert.equal(fixture.withUatSnapshotCategoryMenu(menu,[],{...uat,[key]:value}),menu);
});

test('Home, Blog and calculator skip targets are focusable and follow navigation in actual markup',async()=>{
  const {renderToStaticMarkup}=await import('react-dom/server');
  const mocks=new Map([['@/lib/nav-config.json',JSON.parse(readFileSync('lib/nav-config.json','utf8'))],['next/navigation',{usePathname:()=>'/'}]]);
  for(const file of ['phillip-logo.svg','website-43/icon-protection-gap.svg','website-43/icon-tax.svg','website-43/icon-investment-risk.svg'])mocks.set('../../../public/assets/'+file,{__esModule:true,default:{src:'/assets/'+file,width:72,height:72}});
  mocks.set('next/image',{__esModule:true,default:props=>{const p={...props,src:typeof props.src==='object'?props.src.src:props.src};delete p.fill;delete p.preload;delete p.priority;return React.createElement('img',p);}});
  for(const [file,props] of [
    ['features/home/website-43/Website43Home.tsx',{}],
    ['features/blog/website-43/Website43Blog.tsx',{articles:[],featuredArticles:[]}],
    ['components/layout/website-43/Website43ToolHero.tsx',{image:'/synthetic.png',badge:'Tool',line1:'First',line2:'Second',description:'Description',ctaHref:'#calculator',ctaLabel:'Start'}],
  ]){
    const Component=loadFixtureModule(file,{mocks}).default;
    const doc=new JSDOM(renderToStaticMarkup(React.createElement(Component,props))).window.document;
    const target=doc.getElementById('main-content');assert.ok(target,file);assert.equal(target.tabIndex,-1);assert.equal(target.querySelector('nav'),null);
    const navs=doc.querySelectorAll('nav[aria-label="เมนูหลัก"],nav[aria-label="เมนูมือถือ"]');assert.ok(navs.length);
    for(const nav of navs)assert.ok(nav.compareDocumentPosition(target)&4,'skip destination follows primary navigation');
    target.focus();assert.equal(doc.activeElement,target);
  }
});


test('static SVG objects typecheck in the real Web program before generated Next declarations exist',()=>{
  const config=ts.readConfigFile('apps/web/tsconfig.json',ts.sys.readFile);
  assert.equal(config.error,undefined);
  const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,resolve('apps/web'));
  const files=parsed.fileNames.filter(file=>!file.endsWith('/next-env.d.ts')&&!file.includes('/.next/'));
  const program=ts.createProgram(files,{...parsed.options,incremental:false});
  const diagnostics=ts.getPreEmitDiagnostics(program);
  assert.deepEqual(diagnostics.map(d=>({code:d.code,message:ts.flattenDiagnosticMessageText(d.messageText,'\n')})),[]);
  const checker=program.getTypeChecker();
  const home=program.getSourceFile(resolve('features/home/website-43/Website43Home.tsx'));
  const imports=home.statements.filter(node=>ts.isImportDeclaration(node)&&node.moduleSpecifier.text.endsWith('.svg'));
  assert.equal(imports.length,4);
  for(const node of imports){
    const type=checker.getTypeAtLocation(node.importClause.name);
    assert.equal(type.flags&ts.TypeFlags.Any,0,node.moduleSpecifier.text);
    for(const [key,flag] of [['src',ts.TypeFlags.String],['width',ts.TypeFlags.Number],['height',ts.TypeFlags.Number]]){
      const property=type.getProperty(key);assert.ok(property,key);
      assert.ok(checker.getTypeOfSymbolAtLocation(property,node).flags&flag,key);
    }
  }
});
