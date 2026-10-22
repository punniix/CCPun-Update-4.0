import {notFound} from 'next/navigation';
import type {Metadata} from 'next';
import type {Article} from '@/lib/content/types';
import Website43Article from '@/features/blog/website-43/Website43Article';

// UAT-only article presentation: never indexed, never uses customer or production data.
export const dynamic='force-dynamic';
export const metadata:Metadata={
  title:'CCPun Signature Article Components — UAT preview',
  robots:{index:false,follow:false},
  alternates:{canonical:null},
};
const list=[
  {label:'รายการแรก',value:'สิ่งที่ควรเตรียมไว้',detail:'ตัวอย่างเพื่อทดสอบ UI เท่านั้น'},
  {label:'รายการที่สอง',value:'เปรียบเทียบเงื่อนไข',detail:'ไม่มีข้อมูลส่วนบุคคล'},
  {label:'รายการที่สาม',value:'ทบทวนก่อนตัดสินใจ'},
];
const article:Article={
  id:'uat-fixture-ccpun-signature',
  slug:'signature-article-preview',
  title:'ทดลองอ่านบทความที่มี CCPun Signature Components',
  excerpt:'ทดสอบรูปแบบบทความสำหรับ Mobile, Tablet และ Desktop ด้วยข้อมูลจำลองเท่านั้น',
  category:'การเงินส่วนบุคคล',
  categorySlug:'personal-finance',
  authorName:'CCPun',
  status:'published',
  noindex:true,
  updatedAt:'2026-10-22T00:00:00Z',
  seoTitle:'CCPun Article UAT Component Preview',
  seoDescription:'ตัวอย่างเพื่อทดสอบ Component เท่านั้น ไม่ใช่ข้อมูลผลิตภัณฑ์จริง',
  body:[
    {type:'paragraph',text:'นี่คือบทความจำลองสำหรับตรวจ UX/UI ของ CCPun เท่านั้น ทุกตัวเลขเป็นสมมติฐาน ไม่มีการใช้ข้อมูลของลูกค้า'},
    {type:'heading',level:2,text:'01 รูปแบบการอธิบาย'},
    {type:'signatureEditorial',kind:'insight',title:'อย่ามองแค่ตัวเลข',description:'ทดลองข้อความแบบ CCPun',firstLabel:'เห็นตัวเลขสูงที่สุด',secondLabel:'ดูข้อจำกัดและเงื่อนไขก่อนตัดสินใจ',entries:[],takeaway:'เข้าใจสิ่งที่ได้รับและสิ่งที่ต้องแลก'},
    {type:'signatureEditorial',kind:'limit',title:'ตัวอย่างวงเงินที่ใช้และคงเหลือ',limit:100000,used:35000,description:'ลองเลื่อนดูผลลัพธ์',entries:[],sampleNote:'วงเงินสมมติ ไม่ใช่สิทธิจริง'},
    {type:'signatureEditorial',kind:'beforeAfter',title:'ก่อน–หลังการเตรียมเงินสำรอง',entries:[{label:'ก่อนจัดสรร',value:'0 บาท'},{label:'หลังจัดสรร',value:'60,000 บาท'}]},
    {type:'signatureEditorial',kind:'timeline',title:'ขั้นตอนการวางแผน',entries:list},
    {type:'signatureEditorial',kind:'checklist',title:'เตรียมข้อมูลครบหรือยัง',entries:list},
    {type:'signatureEditorial',kind:'calculation',title:'คำนวณเงินสำรองตัวอย่าง',monthlyAmount:30000,months:6,existingAmount:60000,entries:[],sampleNote:'ไม่รวมเงินเฟ้อและค่าใช้จ่ายอื่น'},
    {type:'signatureEditorial',kind:'glossary',title:'ศัพท์ที่ควรเข้าใจก่อน',entries:[{label:'วงเงิน',value:'จำนวนเงินสูงสุดในเงื่อนไขที่กำหนด',detail:'อย่าลืมตรวจเพดานรายหมวด'},{label:'เงื่อนไข',value:'ข้อกำหนดก่อนมีสิทธิใช้ประโยชน์'}]},
    {type:'signatureEditorial',kind:'sources',title:'ข้อมูลนี้มาจากไหน',entries:[{label:'ชุดทดสอบ CCPun',value:'ข้อมูลจำลองสำหรับ UAT ไม่มีเอกสารผลิตภัณฑ์จริง'}]},
    {type:'heading',level:2,text:'02 ตารางและการเปรียบเทียบ'},
    {type:'signatureStructuredTable',title:'ตารางข้อมูลตัวอย่าง',headers:['รายการ','แผน A','แผน B'],
      rows:[['หัวข้อ 1','100 หน่วย','200 หน่วย'],['หัวข้อ 2','ไม่มี','มี']],sampleNote:'สมมติฐานเพื่อทดสอบการแสดงผลบนมือถือ'},
    {type:'signaturePlanExplorer',title:'เลือกและเปรียบเทียบแผนตัวอย่าง',description:'ทดลอง Dropdown และการเปรียบเทียบ 2 แผน',
      plans:[
        {name:'ตัวเลือก A',headline:'100 หน่วย',benefits:[{label:'วงเงินสมมติ',value:'100 หน่วย',category:'medical'},{label:'เงื่อนไข',value:'ตัวอย่าง A',category:'condition'}]},
        {name:'ตัวเลือก B',headline:'200 หน่วย',benefits:[{label:'วงเงินสมมติ',value:'200 หน่วย',category:'medical'},{label:'เงื่อนไข',value:'ตัวอย่าง B',category:'condition'}]},
        {name:'ตัวเลือก C',headline:'300 หน่วย',benefits:[{label:'วงเงินสมมติ',value:'300 หน่วย',category:'medical'},{label:'ผลประโยชน์เสริม',value:'เพิ่มขึ้น',category:'extra'}]},
      ],
      sampleNote:'ข้อมูลทุกแผนเป็นตัวอย่างทดสอบเท่านั้น'},
  ],
};
export default function SignatureArticleUATPreview(){
  if(!['web-uat','local-uat'].includes(process.env.CCPUN_APP_ENV||process.env.NEXT_PUBLIC_CCPUN_APP_ENV||''))notFound();
  return <Website43Article article={article} preview={true}/>;
}
