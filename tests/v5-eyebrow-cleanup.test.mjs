import {websiteV5InvestmentCopyPredecessor,websiteV5InvestmentC15Digest} from '../qa/website-v5-phase-a-proof.mjs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {renderToStaticMarkup}=require('react-dom/server');
import {c17CurrentUatSourcePredecessor} from '../qa/v5-c17-current-uat-successor.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {createHash}from'node:crypto';
import test from 'node:test';
import {eyebrowPredecessor,eyebrowSourceSuccessors}from'../qa/v5-eyebrow-proof.mjs';
import {inverseEyebrowMoneyTree,moneyTreeDigest,eyebrowMoneyTreePins}from'../qa/v5-eyebrow-money-tree.mjs';
import {loadFixtureModule}from'../qa/phase1-fixture-loader.mjs';
import {c15SourceFromMerge,c14SourceFromMerge}from'../qa/v5-c15-c14-merge-successor.mjs';
const read=file=>readFileSync(file,'utf8');
const sha=x=>createHash('sha256').update(x).digest('hex');
test('C15 exact reviewed source inverses preserve old pins and reject every unrelated byte',()=>{
 for(const[file,pin]of Object.entries(eyebrowSourceSuccessors)){
  const raw=read(file),reviewed=websiteV5InvestmentC15Digest(file,raw);
  if(reviewed!==null){
   assert.equal(reviewed,pin.before,file+': exact reviewed frontend digest');
   const call=raw.match(/text(?:\.node)?\("(investment\.[^"\n]+)"\)/);assert.ok(call);
   const defaults=loadFixtureModule('lib/content/investment-copy-defaults.ts').INVESTMENT_COPY_DEFAULTS;
   const changedKey=call[1]==='investment.main.text252'?'investment.main.text253':'investment.main.text252';
   for(const changed of [raw+' ',raw+'\n// unreviewed',raw.replace(/\S/,'X'),raw.replace(call[0],JSON.stringify(defaults[call[1]])),raw.replace(call[0],call[0]+call[0]),raw.replace(call[1],changedKey)]){
    assert.notEqual(changed,raw);assert.equal(websiteV5InvestmentC15Digest(file,changed),null,'partial, duplicate and wrong-key changes are never admitted');
    const historical=c15SourceFromMerge(file,c17CurrentUatSourcePredecessor(file,websiteV5InvestmentCopyPredecessor(file,changed)));
    assert.notEqual(sha(eyebrowPredecessor(file,historical)),pin.before,'unreviewed input still follows the old rejecting chain');
   }
   continue;
  }
  // Historical inputs and all other owners retain the original C17/C14/C15 chain.
  const current=c15SourceFromMerge(file,c17CurrentUatSourcePredecessor(file,websiteV5InvestmentCopyPredecessor(file,raw)));assert.equal(sha(current),pin.after,file);
  const prior=eyebrowPredecessor(file,current);assert.equal(sha(prior),pin.before,file);
  assert.equal(eyebrowPredecessor(file,prior),prior);
  for(const changed of [current+'\n',current.replace(/\S/,'X')])assert.equal(eyebrowPredecessor(file,changed),changed,'unknown source is never normalized');
 }
 assert.equal(websiteV5InvestmentC15Digest('unowned.ts','body'),null);
 assert.equal(eyebrowPredecessor('unowned.ts','body'),'body');
 assert.equal(sha(eyebrowPredecessor('tests/money-story-presentation-parity.test.mjs',read('tests/money-story-presentation-parity.test.mjs'))),'2fab8aac076c4fe2f2dbe4a1acfbfe1dc0c19beab4f714495b55324bb5644b5b');
});
test('C15 character result inverse restores only prefix/class and rejects moved, duplicate, copy and unrelated tree changes',()=>{
 const raw=read('qa/v5-eyebrow-money-result.json');
 const tree=JSON.parse(raw);assert.equal(moneyTreeDigest(tree),eyebrowMoneyTreePins[0].after);
 assert.equal(moneyTreeDigest(inverseEyebrowMoneyTree(tree)),eyebrowMoneyTreePins[0].before);
 assert.equal(moneyTreeDigest(inverseEyebrowMoneyTree(inverseEyebrowMoneyTree(tree))),eyebrowMoneyTreePins[0].before);
 const visit=(node,predicate)=>{if(Array.isArray(node))for(const x of node){const found=visit(x,predicate);if(found)return found;}if(!node||typeof node!=='object')return null;if(predicate(node))return node;return visit(node.props?.children,predicate);};
 for(const mutate of [
  x=>{x.props.className+=' changed';},
  x=>{visit(x,n=>n.type==='p'&&n.props.className==='muted').props.children[0]='ข้อความ CMS';},
  x=>{const hero=visit(x,n=>n.props?.className==='resultHero');hero.props.children.reverse();},
  x=>{const hero=visit(x,n=>n.props?.className==='resultHero');hero.props.children.push(hero.props.children[1]);},
 ]){const changed=JSON.parse(raw);mutate(changed);assert.throws(()=>inverseEyebrowMoneyTree(changed),/unknown full Money Story/);}
});
test('C15 exact defaults retain all stable persisted keys and owner overrides',()=>{
 const registry=loadFixtureModule('lib/content/public-copy-registry.ts');
 for(const [scope,key,value]of[
 ['home','home.website43Hometitle5','คำถามก่อนเริ่มวางแผนกับ CCPun'],
 ['ci','ci.landing.heading3','ทุนสำรองช่วงพักฟื้น (Recovery Reserve) แยกให้เห็นที่มาและกรอกตามสถานการณ์จริง'],
 ['fhc','fhc.landing.calculatorHeading.heading','คำนวณทุนประกันชีวิต เริ่มจากภาระที่คนข้างหลังต้องดูแล'],
 ['moneyStory','moneyStory.kicker3','ชีวิตของ'],
 ]){assert.equal(registry.PUBLIC_COPY_SCOPES[scope].defaults[key],value);assert.equal(registry.publicCopyText({[key]:'ข้อความเจ้าของ'})(key),'ข้อความเจ้าของ');}
 const writes=Object.keys(eyebrowSourceSuccessors);assert.ok(writes.every(x=>!x.startsWith('cms/')&&!x.includes('sanity.ts')&&!x.includes('analytics')&&!x.includes('cookie-consent')));
 assert.match(read('features/blog/v5/V5Article.tsx'),/<h2 className=\{shell.h2\}>\{text.node\("blog.nextStep.eyebrow"\)\}<\/h2>/);
 assert.match(read('features/ci-planning/components/result/CIResult.tsx'),/<p className="ccpun-calculator-result-body">\{t.node\("ci.recovery.description"\)\}/);
 assert.match(read('features/investment-allocation/PortfolioBuilder.tsx'),/<h2>\{text.node\("investment.portfolio.text204"\)\}<\/h2>/);
 assert.match(read('features/investment-allocation/aia-page.tsx'),/subtitle=\{<span className=\{shell.lead\}>\{text.node\("investment.aia.text267"\)\}<\/span>\}/);
 for(const [key,value] of [['investment.portfolio.text204','สรุประหว่างจัดพอร์ต'],['investment.aia.text267','เลือกเอง แล้วดูว่าเงินอยู่ตรงไหน']]){assert.equal(renderToStaticMarkup(registry.publicCopyText({}).node(key)),value);assert.equal(registry.publicCopyText({[key]:'ข้อความเจ้าของ'})(key),'ข้อความเจ้าของ');}
 assert.match(read('features/coming-soon/page.tsx'),/<p className=\{shell.lead\}>หน้านี้กำลังสร้างอยู่<\/p>/);
 assert.doesNotMatch(read('features/money-story/components/MoneyStoryScreens.tsx'),/styles.kicker/);
 assert.doesNotMatch(read('features/investment-allocation/InvestmentAllocationTool.tsx'),/styles.modeBadge/, 'mode cards keep their real option headings without eyebrow labels');
});
test('C15-on-C14 merge admits only the exact merged V5Article and reconstructs both reviewed sides',()=>{
 const file='features/blog/v5/V5Article.tsx';const merged=read(file);
 assert.equal(sha(c15SourceFromMerge(file,merged)),eyebrowSourceSuccessors[file].after);
 assert.equal(sha(c14SourceFromMerge(file,merged)),'cc3e24a3a59e91ecf7c41fee41a64782a8844add2d13228aa5f8d8ffb355af74');
 for(const changed of [merged+'\n',merged.replace(/\S/,'X')]){assert.equal(c15SourceFromMerge(file,changed),changed);assert.equal(c14SourceFromMerge(file,changed),changed);}
 assert.equal(c15SourceFromMerge('unowned.ts','body'),'body');
});


test('Investment CMS defaults retain actual hero, breadcrumb, scoped tool and internal links; default site copy stays absent', async () => {
 const React=require('react'),{JSDOM}=require('jsdom');
 const provider=loadFixtureModule('components/ui/PublicCopyProvider.tsx');
 const cases=[['features/investment-allocation/page.tsx','main',{}],['features/investment-allocation/aia-page.tsx','aia',{}],['features/investment-allocation/aia-page.tsx','aia',{'investment.aia.text266':'ข้อความเจ้าของ'}]];
 for(const[file,scope,copy]of cases){
  const reads=[],siteProps=[];
  const mocks=new Map([
   ['@/components/ui/PublicCopyProvider',provider],
   ['@/lib/runtime/investment-availability',{INVESTMENT_ALLOCATION_ENABLED:true}],
   ['@/lib/content/public-copy',{getPublicCopy:async requested=>{reads.push(requested);return copy;}}],
   ['@/components/layout/v5/V5Header',{__esModule:true,default:({siteCopy})=>{siteProps.push(siteCopy);return React.createElement('header');}}],
   ['@/components/layout/v5/V5Footer',{__esModule:true,default:({siteCopy})=>{siteProps.push(siteCopy);return React.createElement('footer');}}],
   ['@/components/layout/v5/V5ChatDockServer',{__esModule:true,default:()=>null}],
   ['./InvestmentAllocationTool',{__esModule:true,default:({scope='main'})=>React.createElement('div',{'data-tool-scope':scope})}],
  ]);
  async function resolve(node){if(Array.isArray(node))return Promise.all(node.map(resolve));if(!React.isValidElement(node))return node;if(typeof node.type==='function'&&node.type.name==='V5Page')return resolve(await node.type(node.props));const children=await resolve(node.props.children);return React.cloneElement(node,{},...(Array.isArray(children)?children:[children]));}
  const page=loadFixtureModule(file,{mocks});const html=renderToStaticMarkup(await resolve(await page.default()));const dom=new JSDOM(html);
  try{
   const document=dom.window.document;
   assert.deepEqual(reads,['investment']);assert.deepEqual(siteProps,[undefined,undefined]);
   assert.equal(document.querySelectorAll('main#main-content').length,1);assert.equal(document.querySelectorAll('header').length,1);assert.equal(document.querySelectorAll('footer').length,1);
   assert.equal(document.querySelector('[data-tool-scope]').getAttribute('data-tool-scope'),scope);
   if(scope==='aia'){
    assert.equal(document.querySelector('h1').textContent,copy['investment.aia.text266']??'กองทุนของ บลจ. เอไอเอ');
    const breadcrumb=document.querySelector('nav[aria-label="เส้นทางของหน้า"]');assert.ok(breadcrumb);
    assert.equal(breadcrumb.querySelector('a[href="/"]').textContent,'หน้าแรก');assert.equal(breadcrumb.querySelector('a[href="/tools/"]').textContent,loadFixtureModule('components/layout/v5/constants.ts').V5_TOOLS_HUB.label);
    assert.match(document.body.textContent,/กองทุนรวมที่บริหารโดย บลจ\. เอไอเอ/);assert.match(document.body.textContent,/เป็นไปตามเอกสารกรมธรรม์ของบริษัทประกัน/);
    assert.ok(document.querySelector('a[href="/tools/investment-allocation/"]'));
   }else{
    assert.equal(document.querySelector('a[href="/tools/aia-fund-allocation/"]').textContent,'ดูเครื่องมือกองทุน บลจ. เอไอเอ');
   }
  }finally{dom.window.close();}
 }
});
