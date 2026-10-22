import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {
  signatureEditorialSchema,signatureStructuredTableSchema,signaturePlanExplorerSchema,
  simpleTableSchema,bodyItemSchema,
} from '../lib/content/sanity-schema.ts';

const root=process.cwd();
const read=(path)=>readFileSync(join(root,path),'utf8');
const entry={label:'เงื่อนไขตัวอย่าง',value:'เป็นตัวอย่างเพื่อทดสอบ',detail:'ดูข้อมูลเพิ่มเติม'};

test('Sanity editor: eight signature purposes accept structured safe examples',()=>{
  const kinds=['insight','limit','beforeAfter','timeline','checklist','calculation','glossary','sources'];
  for(const kind of kinds){
    const result=signatureEditorialSchema.safeParse({_type:'signatureEditorial',title:'หัวข้อตัวอย่างสำหรับคนอ่าน',kind,
      firstLabel:'ก่อน',secondLabel:'หลัง',limit:100000,used:20000,monthlyAmount:30000,months:6,existingAmount:0,
      entries:[entry],takeaway:'ตรวจสอบเงื่อนไขเพิ่มเติม'});
    assert.equal(result.success,true,kind);
    assert.equal(bodyItemSchema.safeParse(result.data).success,true);
  }
});
test('Data guard rejects invalid negative and oversized financial inputs',()=>{
  assert.equal(signatureEditorialSchema.safeParse({_type:'signatureEditorial',kind:'limit',title:'วงเงินตัวอย่าง',limit:-100}).success,false);
  assert.equal(signatureEditorialSchema.safeParse({_type:'signatureEditorial',kind:'calculation',title:'ทดลองคำนวณ',months:0}).success,false);
});
test('Mobile table accepts typed rows, keeps the legacy table shape untouched',()=>{
  const next={_type:'signatureStructuredTable',title:'เปรียบเทียบรายการตัวอย่าง',headers:['รายการ','A','B'],
    rows:[{_type:'tableRow',cells:['สมมติฐาน','100','200']}]};
  assert.equal(signatureStructuredTableSchema.safeParse(next).success,true);
  assert.equal(bodyItemSchema.safeParse(next).success,true);
  assert.equal(simpleTableSchema.safeParse({_type:'simpleTable',headers:['A','B'],rows:[['หนึ่ง','สอง']]}).success,true);
  assert.equal(signatureStructuredTableSchema.safeParse({...next,headers:['only']}).success,false);
});
test('Dynamic Plan Explorer accepts several plans, rejects single-plan fake comparisons',()=>{
  const plan=name=>({name,headline:'ตัวเลขสมมติ',benefits:[{label:'วงเงิน',value:'100 หน่วย',category:'medical'}]});
  const base={_type:'signaturePlanExplorer',title:'แผนเพื่อทดลองระบบ',plans:[plan('แผน A'),plan('แผน B'),plan('แผน C')]};
  assert.equal(signaturePlanExplorerSchema.safeParse(base).success,true);
  assert.equal(bodyItemSchema.safeParse(base).success,true);
  assert.equal(signaturePlanExplorerSchema.safeParse({...base,plans:[plan('แผน A')]}).success,false);
});
test('UAT-only article route is noindex and rejects non-UAT deployments',()=>{
  const s=read('apps/web/app/blog/signature-article-preview/page.tsx');
  assert.match(s,/index:false,follow:false/);
  assert.match(s,/web-uat/);
  assert.match(s,/notFound\(\)/);
  assert.match(s,/preview=\{true\}/);
  assert.doesNotMatch(s,/NEXT_PUBLIC_SANITY_PROJECT_ID/);
});
test('CSS follows CCPun lock and applies backdrop blur only to dropdown',()=>{
  const s=read('features/blog/website-43/SignatureArticle.module.css');
  for(const v of ['#352727','#4A3A3A','#5B4848','#E0C985','#FAF9F9','#BAABAB'])
    assert.ok(s.includes(v),'Missing CCPun token '+v);
  assert.match(s,/prefers-reduced-motion/);
  assert.match(s,/\.optionList\{background:rgba\(74,58,58,\.93\);backdrop-filter:blur\(8px\)/);
  assert.match(s,/min-height:48px/);
});
test('Article editor authoring is discoverable through Portable Text',()=>{
  const s=read('cms/sanity/schema/objects/portable-text.ts');
  for(const kind of ['signatureEditorial','signatureStructuredTable','signaturePlanExplorer'])
    assert.ok(s.includes('type: "'+kind+'"'));
  const adapter=read('lib/content/sanity.ts');
  assert.match(adapter,/entries\[\]\{/);
  assert.match(adapter,/plans\[\]\{/);
});

test('Editorial interactions are ephemeral and lightweight motion respects reduced-motion',()=>{
  const css=read('features/blog/website-43/SignatureArticle.module.css');
  const jsx=read('features/blog/website-43/SignatureArticle.tsx');
  assert.match(css,/@keyframes ccpunArticleEnter/);
  assert.match(css,/@keyframes ccpunDropdownEnter/);
  assert.match(css,/animation-duration: 160ms/);
  assert.match(css,/prefers-reduced-motion: no-preference/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(css,/animation:none!important/);
  assert.match(css,/animation-timeline: view\(block\)/);
  assert.doesNotMatch(jsx,/localStorage|sessionStorage|indexedDB|document\.cookie/);
  assert.doesNotMatch(css,/animation-iteration-count:\s*infinite|animation:\s*[^;]*infinite/);
});
