import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {createHash}from'node:crypto';
import test from 'node:test';
import {eyebrowPredecessor,eyebrowSourceSuccessors}from'../qa/v5-eyebrow-proof.mjs';
import {inverseEyebrowMoneyTree,moneyTreeDigest,eyebrowMoneyTreePins}from'../qa/v5-eyebrow-money-tree.mjs';
import {loadFixtureModule}from'../qa/phase1-fixture-loader.mjs';
const read=file=>readFileSync(file,'utf8');
const sha=x=>createHash('sha256').update(x).digest('hex');
test('C15 exact reviewed source inverses preserve old pins and reject every unrelated byte',()=>{
 for(const[file,pin]of Object.entries(eyebrowSourceSuccessors)){
  const current=read(file);assert.equal(sha(current),pin.after,file);
  const prior=eyebrowPredecessor(file,current);assert.equal(sha(prior),pin.before,file);
  assert.equal(eyebrowPredecessor(file,prior),prior);
  for(const changed of [current+'\n',current.replace(/\S/,'X')])assert.equal(eyebrowPredecessor(file,changed),changed,'unknown source is never normalized');
 }
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
 assert.match(read('features/investment-allocation/PortfolioBuilder.tsx'),/<h2>สรุประหว่างจัดพอร์ต<\/h2>/);
 assert.match(read('features/investment-allocation/aia-page.tsx'),/subtitle=\{<span className=\{shell.lead\}>เลือกเอง แล้วดูว่าเงินอยู่ตรงไหน<\/span>\}/);
 assert.match(read('features/coming-soon/page.tsx'),/<p className=\{shell.lead\}>หน้านี้กำลังสร้างอยู่<\/p>/);
 assert.doesNotMatch(read('features/money-story/components/MoneyStoryScreens.tsx'),/styles.kicker/);
 assert.doesNotMatch(read('features/investment-allocation/InvestmentAllocationTool.tsx'),/styles.modeBadge/, 'mode cards keep their real option headings without eyebrow labels');
});
