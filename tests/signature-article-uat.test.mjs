import { BLOG_COPY_DEFAULTS } from "../lib/content/blog-copy-defaults.ts";
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
  // Exactly two slow, purposefully looping gold indicators; no animated cards/backgrounds.
  const loops=[...css.matchAll(/animation:\s*([^;]+infinite)/g)].map(m=>m[1].trim());
  assert.equal(loops.length,2);
  assert.ok(loops.some(x=>x.includes('ccpunSignatureGoldBreathe 8s')));
  assert.ok(loops.some(x=>x.includes('ccpunSignaturePlanBeacon 9s')));
  assert.match(jsx,/new IntersectionObserver/);
  assert.match(jsx,/signatureMotionListeners\.size===0/);
  assert.match(jsx,/data-motion-active/);
  for(const name of ['ccpunSignatureGoldBreathe','ccpunSignaturePlanBeacon']){
    const match=css.match(new RegExp('@keyframes '+name+'\\s*\\{([\\s\\S]*?)\\n\\}'));
    assert.ok(match,name+' keyframes missing');
    assert.doesNotMatch(match[1],/box-shadow|filter|backdrop-filter|left:|top:|height:|width:|margin:|padding:/);
    assert.match(match[1],/opacity:/);
    assert.match(match[1],/transform:/);
  }
});

test('UAT tax article renders readable table plus Insight without interactive checklist',()=>{
  const source=read('apps/web/app/blog/uat-tax-article-component-review/page.tsx');
  const renderer=read('features/blog/website-43/SignatureArticle.tsx');
  assert.match(source,/uat-ux-tax-table-20261011/);
  assert.match(source,/robots:\{index:false,follow:false\}/);
  assert.match(source,/CCPUN_APP_ENV/);
  assert.match(source,/notFound\(\)/);
  assert.equal((source.match(/type:'signatureEditorial'/g)||[]).length,2);
  assert.equal((source.match(/type:'signatureStructuredTable'/g)||[]).length,1);
  assert.doesNotMatch(source,/kind:'checklist'/);
  assert.doesNotMatch(read('apps/web/app/blog/signature-article-preview/page.tsx'),/kind:'checklist'/);
  assert.match(renderer,/<details className=\{styles\.tableMore\}>/);
  assert.match(renderer,/block\.rows\.slice\(mobileInitialRows\)/);
});

test('No anonymous checklist renders in article even when old Sanity draft contains one',()=>{
  const renderer=read('features/blog/website-43/Website43ArticleBody.tsx');
  const readTime=read('features/blog/website-43/articleReadingTime.ts');
  assert.match(renderer,/item\.kind === 'checklist'\) return null/);
  assert.match(readTime,/block\.kind === 'checklist'\) return ''/);
});

test('All remaining interactive Article blocks are transient browser state, not a user database',()=>{
  const component=read('features/blog/website-43/SignatureArticle.tsx');
  for(const forbidden of ['fetch(', 'localStorage', 'sessionStorage', 'indexedDB', 'document.cookie', 'navigator.sendBeacon', 'XMLHttpRequest', 'supabase'])
    assert.ok(!component.includes(forbidden),forbidden+' must not persist user inputs');
  assert.match(component,/const \[monthly,setMonthly\]=useState/);
  assert.match(component,/const \[view,setView\]=useState/);
});

test('Plan Explorer offers SSR-readable all-plan benefit facts using native details, independent of user selection',()=>{
 const view=read('features/blog/website-43/SignatureArticle.tsx').replace(/\{copyText\("([^"]+)"\)\}/g, (_, key) => BLOG_COPY_DEFAULTS[key]);
 assert.match(view,/className=\{styles\.planFacts\}/);
 assert.match(view,/<details>[\s\S]*?<summary>อ่านรายละเอียดและเงื่อนไขของทุกแผน/);
 assert.match(view,/plans\.map\(\(plan,i\)=>/);
 assert.match(view,/plan\.benefits\.map\(\(benefit,j\)=>/);
 assert.match(view,/<dt>\{benefit\.label\}<\/dt><dd>\{benefit\.value\}<\/dd>/);
});

test('Source & Verification defaults to unverified unless real ISO date and linked source both exist',()=>{
 const view=read('features/blog/website-43/SignatureArticle.tsx').replace(/\{copyText\("([^"]+)"\)\}/g, (_, key) => BLOG_COPY_DEFAULTS[key]);
 const studio=read('cms/sanity/schema/objects/signature-editorial.ts');
 assert.match(view,/block\.sourceStatus==='verified'&&!!reviewDate\(block\.verifiedAt\)&&hasHttpSource\(entries\)/);
 assert.match(BLOG_COPY_DEFAULTS["blog.signatureEditorialViewText6"],/ยังไม่ยืนยันการตรวจสอบต้นฉบับ/);
 assert.match(view,/copyText\("blog.signatureEditorialViewText6"\)/);
 assert.match(view,/<time dateTime=\{block\.verifiedAt\}>/);
 assert.match(view,/rel="noopener noreferrer"/);
 assert.match(studio,/name:'verifiedAt'/);
 assert.match(studio,/name:'effectivePeriod'/);
 assert.match(studio,/name:'sourceVersion'/);
 assert.match(studio,/ระบุวันที่ตรวจสอบจริงก่อนเลือกว่าตรวจสอบแล้ว/);
 assert.equal(signatureEditorialSchema.safeParse({_type:'signatureEditorial',kind:'sources',title:'ทดลองที่มา',sourceStatus:'verified',verifiedAt:'not a date'}).success,false);
 assert.equal(signatureEditorialSchema.safeParse({_type:'signatureEditorial',kind:'sources',title:'ทดลองที่มา',sourceStatus:'unverified'}).success,true);
});

test('Both UAT example articles have plainly marked unverified provenance',()=>{
 for(const file of ['apps/web/app/blog/signature-article-preview/page.tsx','apps/web/app/blog/uat-tax-article-component-review/page.tsx']){
  const s=read(file);
  assert.match(s,/sourceStatus:'unverified'/);
  assert.match(s,/kind:'sources'/);
  assert.match(s,/noindex:true/);
 }
});
