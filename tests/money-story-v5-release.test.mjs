import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {JSDOM} from 'jsdom';
import {loadFixtureModule} from '../qa/phase1-fixture-loader.mjs';
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
