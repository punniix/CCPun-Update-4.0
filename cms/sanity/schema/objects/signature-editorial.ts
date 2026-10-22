import {defineField,defineType} from 'sanity';
import {title,description,takeaway,note,item} from './signature-fields';

export const signatureEditorial=defineType({
  name:'signatureEditorial',type:'object',title:'CCPun · อธิบายข้อมูลแบบอินเทอร์แอคทีฟ',
  description:'เลือกวิธีเล่าเรื่องก่อน แล้วจะเห็นเฉพาะช่องที่เกี่ยวข้อง ไม่ต้องเขียนโค้ด',
  fields:[
    defineField({name:'kind',type:'string',title:'เลือกวิธีแสดงข้อมูล',
      options:{list:[
        {title:'มองอีกมุม / Insight',value:'insight'},
        {title:'วงเงินที่ใช้และคงเหลือ',value:'limit'},
        {title:'ก่อน–หลัง',value:'beforeAfter'},
        {title:'ขั้นตอน / Timeline',value:'timeline'},
        {title:'เช็กลิสต์',value:'checklist'},
        {title:'คำนวณตัวอย่าง',value:'calculation'},
        {title:'อธิบายคำศัพท์',value:'glossary'},
        {title:'แหล่งอ้างอิง / การตรวจสอบ',value:'sources'},
      ]},initialValue:'insight',validation:Rule=>Rule.required()}),
    title,description,
    defineField({name:'firstLabel',type:'string',title:'สิ่งที่คนมักมองก่อน',hidden:({parent})=>parent?.kind!=='insight'}),
    defineField({name:'secondLabel',type:'string',title:'สิ่งที่ควรดูจริง ๆ',hidden:({parent})=>parent?.kind!=='insight'}),
    defineField({name:'limit',type:'number',title:'วงเงินเต็ม (ตัวเลข)',hidden:({parent})=>parent?.kind!=='limit',validation:Rule=>Rule.min(0).max(1e12)}),
    defineField({name:'used',type:'number',title:'ใช้ไปแล้ว (ตัวเลข)',hidden:({parent})=>parent?.kind!=='limit',validation:Rule=>Rule.min(0).max(1e12)}),
    defineField({name:'monthlyAmount',type:'number',title:'เงินต่อเดือน (บาท)',hidden:({parent})=>parent?.kind!=='calculation',validation:Rule=>Rule.min(0).max(1e9)}),
    defineField({name:'months',type:'number',title:'จำนวนเดือน',initialValue:6,hidden:({parent})=>parent?.kind!=='calculation',validation:Rule=>Rule.integer().min(1).max(120)}),
    defineField({name:'existingAmount',type:'number',title:'เงินที่มีอยู่แล้ว (บาท)',initialValue:0,hidden:({parent})=>parent?.kind!=='calculation',validation:Rule=>Rule.min(0).max(1e12)}),
    defineField({name:'entries',type:'array',title:'เพิ่มรายการ กด +',
      description:'สำหรับก่อน–หลัง / ขั้นตอน / เช็กลิสต์ / คำศัพท์ / แหล่งอ้างอิง',
      hidden:({parent})=>!['beforeAfter','timeline','checklist','glossary','sources'].includes(String(parent?.kind)),
      of:[item],validation:Rule=>Rule.max(40)}),
    takeaway,note,
  ],
  validation:(Rule)=>Rule.custom((value)=>{
    const block=value as {kind?:string;firstLabel?:string;secondLabel?:string;limit?:number;used?:number;monthlyAmount?:number;months?:number;entries?:unknown[]}|undefined;
    if(!block?.kind)return 'เลือกวิธีแสดงข้อมูลก่อน';
    if(block.kind==='insight'&&(!block.firstLabel?.trim()||!block.secondLabel?.trim()))
      return 'กรอกทั้งสิ่งที่มักมองก่อน และสิ่งที่ควรดูจริง ๆ';
    if(block.kind==='limit'){
      if(typeof block.limit!=='number'||block.limit<=0)return 'กรอกวงเงินเต็มที่มากกว่า 0';
      if(typeof block.used!=='number'||block.used<0||block.used>block.limit)return 'ยอดที่ใช้ต้องอยู่ระหว่าง 0 ถึงวงเงินเต็ม';
    }
    if(block.kind==='calculation'&&(!(typeof block.monthlyAmount==='number'&&block.monthlyAmount>=0)||!(typeof block.months==='number'&&block.months>0)))
      return 'กรอกเงินต่อเดือนและจำนวนเดือนให้ครบ';
    if(block.kind==='beforeAfter'&&block.entries?.length!==2)return 'กรอก 2 รายการ: ก่อนและหลัง';
    if(['timeline','checklist','glossary','sources'].includes(block.kind)&&!block.entries?.length)
      return 'กด + เพื่อเพิ่มอย่างน้อย 1 รายการ';
    return true;
  }),
  preview:{select:{title:'title',kind:'kind'},prepare:({title,kind})=>({title:title||'CCPun Interactive',subtitle:'รูปแบบ: '+(kind||'เลือกชนิด')})},
});
