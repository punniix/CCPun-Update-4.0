import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {JSDOM} from 'jsdom';
import {loadFixtureModule} from '../qa/phase1-fixture-loader.mjs';
import postcss from 'postcss';
const read=file=>readFileSync(file,'utf8');
const classes=new Proxy({},{get:(_,key)=>String(key)});
const css={__esModule:true,default:classes};
const element=React.createElement;
const mocks=new Map([
 ['@/components/layout/v5/V5.module.css',css],['./ToolsHub.module.css',css],['@/features/money-story/MoneyStory.module.css',css],
 ['@/components/layout/v5/V5Page',{__esModule:true,default:({children,current})=>element('main',{'data-current':current},children)}],
 ['@/components/layout/v5/V5PhillipAccount',{__esModule:true,default:()=>null}],
 ['@/components/layout/v5/V5Primitives',{v5Label:value=>value,V5Breadcrumbs:()=>null,V5SectionHeading:({id,title})=>element('h2',{id},title),V5ArticleCard:()=>null,v5CardGridSizes:()=>''}],
 ['@/components/layout/v5/V5ToolParts',{v5ToolStyles:classes,V5ToolHero:({id,title,lead})=>element('header',null,element('h1',{id},title),element('p',null,lead)),V5InfoCards:({items})=>element('div',null,items.map((item,index)=>element('article',{key:index},element('h3',null,item.title),element('p',null,item.body))))}],
 ['@/components/ui/PublicCopyProvider',{PublicCopyProvider:({children})=>children}],
 ['@/features/money-story/components/MoneyStoryGame',{__esModule:true,default:({showSeed,pyramidHref})=>element('div',{'data-game-seed':String(showSeed),'data-pyramid':pyramidHref},'Existing game')}],
 ['@/components/layout/v5/shell-data',{getPublishedArticles:async()=>[]}],
 ['@/lib/content/public-copy',{getPublicCopy:async()=>({})}],
 ['@/lib/deployment-environment',{IS_REVIEW_ENVIRONMENT:false}],
]);

test('3 approved tool owners reach the rendered Hub and its schema without activating funds',async()=>{
 const links=loadFixtureModule('components/layout/v5/constants.ts').V5_TOOL_LINKS;
 assert.deepEqual(links.map(tool=>tool.href).sort(),['/ci-planning/','/play/money-story/','/tools/financial-health-check/']);
 const api=loadFixtureModule('features/tools-hub/page.tsx',{mocks});
 const html=renderToStaticMarkup(await api.renderToolsHubPage({}, {'site.tools.moneyStory':'Owner Money Story'}, {'home.h32':'Owner FHC','home.h33':'Owner CI','home.moneyStory.description':'Owner game description'}));
 const doc=new JSDOM(html).window.document;
 assert.deepEqual([...doc.querySelectorAll('article h2 a')].map(a=>a.getAttribute('href')),['/ci-planning/','/tools/financial-health-check/','/play/money-story/']);
 assert.equal(doc.querySelectorAll('article').length,3);assert.ok(doc.body.textContent.includes('Owner game description'));assert.ok(doc.body.textContent.includes('Owner Money Story'));
 const schema=JSON.parse(doc.querySelector('script[type="application/ld+json"]').textContent);
 assert.equal(schema['@graph'].find(item=>item['@type']==='ItemList').itemListElement.length,3);
 assert.equal(api.metadata.alternates.canonical,'https://ccpun.com/tools/');
 assert.match(read('features/tools-hub/ToolsHub.module.css'),/@media \(min-width: 1100px\) \{ \.grid \{ grid-template-columns: repeat\(3,/);
 for(const file of ['V5Header.tsx','V5Footer.tsx'])assert.match(read('components/layout/v5/'+file),/V5_TOOL_LINKS\.map\(/);
 assert.match(read('apps/web/app/not-found.tsx'),/V5_TOOL_LINKS\.map\(/);
});

test('the real Money Story owner renders v5 in Production with existing copy keys, URL and seed policy',async()=>{
 const api=loadFixtureModule('features/money-story/page.tsx',{mocks});
 const page=await api.renderMoneyStoryPage({'moneyStory.title':'Owner game title','moneyStory.subtitle':'Owner introduction','moneyStory.h2':'Owner explanation'});
 const doc=new JSDOM(renderToStaticMarkup(await page.type(page.props))).window.document;
 assert.equal(doc.querySelector('main').dataset.current,'/play/money-story/');assert.equal(doc.querySelector('h1').textContent,'Owner game title');assert.ok(doc.body.textContent.includes('Owner explanation'));
 assert.equal(doc.querySelector('[data-game-seed]').dataset.gameSeed,'false');assert.equal(doc.querySelector('[data-pyramid]').dataset.pyramid,'/blog/personal-finance/financial-pyramid/');
 assert.equal(api.metadata.alternates.canonical,'https://ccpun.com/play/money-story/');assert.deepEqual(api.metadata.robots,{index:true,follow:true});
 const home=read('features/home/v5/V5Home.tsx');assert.match(home,/situation: "home.startHere.pyramid.situation", paired: "home.startHere.pyramid.paired"[^\n]+pairedHref: "\/play\/money-story\/"/);assert.match(home,/situation: "home.startHere.tax.situation"[^\n]+pairedHref: "\/tools\/financial-health-check\/"/);
});

test('the presentation port retains all 11 original Money Story engine/config/character/event/type/sidebar files byte-for-byte',()=>{
 const paths=["features/money-story/characters.ts", "features/money-story/components/MoneyStoryStatusSidebar.tsx", "features/money-story/config.ts", "features/money-story/engine-debt.ts", "features/money-story/engine-events.ts", "features/money-story/engine-recovery.ts", "features/money-story/engine-state.ts", "features/money-story/engine.ts", "features/money-story/events.ts", "features/money-story/financial-metrics.ts", "features/money-story/types.ts"];
 const hash=createHash('sha256');for(const file of paths)hash.update(file+'\0').update(readFileSync(file)).update('\0');
 assert.equal(hash.digest('hex'),'48b1e20138a479885f31bdb348fd45243e9660c4f623a5ea67c103f2be18e657');
});


test('portrait tablet Tools has three full-width rows and isolates the original 200px QR to its local page',async()=>{
 const source=read('features/tools-hub/ToolsHub.module.css'),media=postcss.parse(source).nodes.at(-1);
 assert.equal(media.params,'(min-width: 768px) and (max-width: 1023px)');
 const rules={};media.walkRules(rule=>{rules[rule.selector]=Object.fromEntries(rule.nodes.filter(n=>n.type==='decl').map(d=>[d.prop,d.value]));if(rule.selector.includes(':global('))assert.ok(rule.selector.includes(':has(.grid)'),'shared DOM rules are fenced by the page-local hashed grid');});
 assert.equal(rules['.grid']['grid-template-columns'],'minmax(0, 1fr)');assert.equal(rules['.grid'].gap,'24px');
 assert.equal(rules['.card']['grid-template-columns'],'minmax(0, 1fr) 160px');assert.equal(rules['.card h2']['font-size'],'20px');assert.equal(rules['.card p']['line-height'],'1.75');assert.equal(rules['.action']['min-height'],'48px');
 const marker='\n/* Approved native Tools 83618/83707:';
 assert.equal(createHash('sha256').update(source.slice(0,source.indexOf(marker))).digest('hex'),'d71c1c3574509eb526434fa0191db1e214b8cd85469a65247a7b1f96ed063909','all original phone and desktop rules remain byte-exact');
 const qrRule=Object.entries(rules).find(([selector])=>selector.endsWith('> div[aria-hidden="true"]'))?.[1];assert.ok(qrRule);assert.equal(qrRule.width,'312px');assert.equal(qrRule.padding,'24px 88px 24px 24px');
 const qrMocks=new Map([['./V5PhillipAccount.module.css',css],['./V5.module.css',css],['@/lib/content/public-copy',{getPublicCopy:()=>{throw new Error('unexpected content read');}}]]);
 const Account=loadFixtureModule('components/layout/v5/V5PhillipAccount.tsx',{mocks:qrMocks}).default;
 const doc=new JSDOM(renderToStaticMarkup(await Account({siteCopy:{}}))).window.document;
 const image=doc.querySelector('img');assert.equal(image.getAttribute('width'),'200');assert.equal(image.getAttribute('height'),'200');assert.equal(image.getAttribute('src'),'/assets/website-v5/phillip-account-qr-84935a14.png');
 const accountHtml=renderToStaticMarkup(await Account({siteCopy:{}}));
 const toolsDoc=new JSDOM('<main><div class="tools-grid-fixture"></div>'+accountHtml+'</main>').window.document;
 const blogDoc=new JSDOM('<main>'+accountHtml+'</main>').window.document;
 for(const selector of Object.keys(rules).filter(selector=>selector.includes('phillip-account'))){
   const query=selector.replace(':global(main)','main').replace(':has(.grid)',':has(.tools-grid-fixture)').replace(':global(section[aria-labelledby="phillip-account-title"])','section[aria-labelledby="phillip-account-title"]').replace(':global(#phillip-account-title)','#phillip-account-title');
   assert.ok(toolsDoc.querySelector(query),'actual Tools context matches '+selector);assert.equal(blogDoc.querySelector(query),null,'Blog never matches the Tools QR variant');
 }
 assert.match(read('components/layout/v5/V5PhillipAccount.module.css'),/\.desktopDescription, \.qr \{ display: none; \}/,'all pages retain their original phone/default QR visibility');
});


test('portrait tablet Money picker keeps all eight real characters in two readable columns without touching gameplay',()=>{
 const source=read('features/money-story/MoneyStory.module.css'),marker='\n/* Approved portrait tablet character picker;';
 assert.equal(createHash('sha256').update(source.slice(0,source.indexOf(marker))).digest('hex'),'c6ab64a3b945c443623214ba42fc949af830842b23ae28026f1424f3c011890a','all original styles and non-tablet states retained');
 let media;postcss.parse(source).walkAtRules('media',m=>{if(m.params==='(min-width: 768px) and (max-width: 1023px)'&&m.nodes.some(n=>n.type==='rule'&&n.selector==='.start > .characterPicker'))media=m;});assert.ok(media);const props={};media.walkRules(rule=>{props[rule.selector]=Object.fromEntries(rule.nodes.filter(n=>n.type==='decl').map(d=>[d.prop,d.value]));});
 assert.equal(props['.start > .characterPicker']['grid-template-columns'],'repeat(2, minmax(0, 1fr))');assert.equal(props['.start > .characterPicker'].gap,'20px');assert.equal(props['.characterPickCard']['min-height'],'180px');assert.equal(props['.characterPickCopy strong']['font-size'],'22px');assert.equal(props['.characterPickCopy > span']['font-size'],'16px');
 const characters=loadFixtureModule('features/money-story/characters.ts').MONEY_STORY_CHARACTERS;assert.equal(characters.length,8);
 for(const selector of Object.keys(props))assert.doesNotMatch(selector,/sideRight|sideLeft|result|choice|eventTitle/,'unapproved gameplay and sidebar layout is not ported');
});


test('portrait active Money keeps the three real siblings, complete lead and unchanged ending owner',async()=>{
 const source=read('features/money-story/MoneyStory.module.css');let media;postcss.parse(source).walkAtRules('media',m=>{if(m.params==='(min-width: 768px) and (max-width: 1023px)'&&m.nodes.some(n=>n.type==='rule'&&n.selector==='.game'))media=m;});assert.ok(media);const props={};media.walkRules(rule=>{props[rule.selector]=Object.fromEntries(rule.nodes.filter(n=>n.type==='decl').map(d=>[d.prop,d.value]));});
 assert.equal(props['.game']['grid-template-columns'],'minmax(0, 1fr) 248px');assert.equal(props['.game'].gap,'24px');assert.equal(props['.sideLeft']['grid-column'],'1 / -1');assert.equal(props['.center']['grid-row'],'2');assert.equal(props['.sideRight']['grid-column'],'2');assert.equal(props['.center .eventTitle']['font-size'],'28px');assert.equal(props['.center .eventText, .center .choice, .center .recoveryChoice']['font-size'],'18px');assert.equal(props['.sideRight']['font-size'],'16px');
 for(const selector of Object.keys(props))assert.doesNotMatch(selector,/result|snapshot|timeline/,'separate real ending owner remains full width');
 const controller=read('features/money-story/components/MoneyStoryGame.tsx');assert.ok(controller.indexOf('<MoneyStoryResult')<controller.indexOf('<div className={styles.game}>'));assert.match(controller,/styles.sideLeft/);assert.match(controller,/styles.center/);assert.match(controller,/<MoneyStoryStatusSidebar game=\{game\} bars=\{bars\} \/>/);
 const {reviewedV5PredecessorDigest}=await import('../qa/phase2-source-proof.mjs');const file='features/money-story/MoneyStory.module.css',old='40b39bf243365a0888163b8a3b7dfc2d53f8a37fb92e5802f8fc12e167917a61';assert.equal(reviewedV5PredecessorDigest(file,source,old),old);
 for(const mutant of [source.replace('248px; gap: 24px','200px; gap: 24px'),source.replace('.center .choice, .center .recoveryChoice { min-height: 44px','.center .choice, .center .recoveryChoice { min-height: 32px'),source+'\n/* unrelated */']){assert.notEqual(mutant,source);assert.throws(()=>reviewedV5PredecessorDigest(file,mutant,old));}
 assert.throws(()=>reviewedV5PredecessorDigest('unknown/MoneyStory.module.css',source,old));
});


test('portrait endings keep four actual metrics in two columns and preserve every separate outcome/action',async()=>{
 const source=read('features/money-story/MoneyStory.module.css');let media;postcss.parse(source).walkAtRules('media',m=>{if(m.params==='(min-width: 768px) and (max-width: 1023px)'&&m.nodes.some(n=>n.type==='rule'&&n.selector==='.resultNumbers'))media=m;});assert.ok(media);const props={};media.walkRules(rule=>{props[rule.selector]=Object.fromEntries(rule.nodes.filter(n=>n.type==='decl').map(d=>[d.prop,d.value]));});
 assert.equal(props['.resultNumbers']['grid-template-columns'],'repeat(2, minmax(0, 1fr))');assert.equal(props['.result'].padding,'24px');assert.equal(props['.resultHero h2']['font-size'],'32px');assert.equal(props['.resultGrid']['grid-template-columns'],'repeat(2, minmax(0, 1fr))');assert.equal(props['.resultWide']['grid-column'],'1 / -1');assert.equal(props['.result .resultActions > :is(a, button)'].flex,'0 1 224px');
 const owner=read('features/money-story/components/MoneyStoryScreens.tsx').split('export function MoneyStoryResult')[1];assert.ok(owner);assert.equal((owner.match(/className=\{styles.numberBox\}/g)??[]).length,4);for(const token of ['styles.resultPortrait','styles.resultLead','styles.resultCompare','styles.resultWide','canUndo ?','onClick={replay}','onClick={share}','href={pyramidHref}','moneyStory.h35','moneyStory.p5','onClick={onLineClick}'])assert.ok(owner.includes(token),token);
 for(const selector of Object.keys(props))assert.doesNotMatch(selector,/sideLeft|sideRight|game/);
 const {reviewedV5PredecessorDigest}=await import('../qa/phase2-source-proof.mjs');const file='features/money-story/MoneyStory.module.css',old='40b39bf243365a0888163b8a3b7dfc2d53f8a37fb92e5802f8fc12e167917a61';assert.equal(reviewedV5PredecessorDigest(file,source,old),old);const mutant=source.replace('.resultNumbers { grid-template-columns: repeat(2, minmax(0, 1fr))','.resultNumbers { grid-template-columns: repeat(4, minmax(0, 1fr))');assert.notEqual(mutant,source);assert.throws(()=>reviewedV5PredecessorDigest(file,mutant,old));
});
