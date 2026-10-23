import {defineArrayMember, defineField} from 'sanity';

// Article-only: the editor enters meaning, never custom colors or CSS.
export const title = defineField({name:'title',type:'string',title:'หัวข้อที่คนอ่านจะเห็น',validation:Rule=>Rule.required().min(4).max(110)});
export const description = defineField({name:'description',type:'text',title:'อธิบายสั้น ๆ',rows:2});
export const takeaway = defineField({name:'takeaway',type:'text',title:'สิ่งที่ควรดูต่อ — CCPun',rows:3});
export const note = defineField({name:'sampleNote',type:'string',title:'หมายเหตุเกี่ยวกับข้อมูล',initialValue:'ตัวเลขเพื่ออธิบายหลักการ ไม่ใช่คำแนะนำเฉพาะบุคคล'});
export const item = defineArrayMember({name:'signatureEntry',type:'object',title:'รายการ',fields:[
  defineField({name:'label',type:'string',title:'ชื่อรายการ',validation:Rule=>Rule.required()}),
  defineField({name:'value',type:'string',title:'คำอธิบายหรือคำตอบ',validation:Rule=>Rule.required()}),
  defineField({name:'detail',type:'text',title:'คำแนะนำเพิ่มเติม (ถ้ามี)',rows:2}),
  defineField({name:'url',type:'url',title:'ลิงก์อ้างอิง (ถ้ามี)',validation:Rule=>Rule.uri({scheme:['https','http']})}),
],preview:{select:{title:'label',subtitle:'value'}}});
