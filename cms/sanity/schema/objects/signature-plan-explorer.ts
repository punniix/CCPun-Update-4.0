import {defineArrayMember,defineField,defineType} from 'sanity';
import {title,description,takeaway,note} from './signature-fields';

const benefit=defineArrayMember({name:'signatureBenefit',type:'object',title:'ผลประโยชน์หรือคุณสมบัติ',fields:[
  defineField({name:'label',type:'string',title:'หัวข้อ เช่น ค่าห้อง',validation:Rule=>Rule.required()}),
  defineField({name:'value',type:'string',title:'ค่า เช่น 3,000 บาท/วัน',validation:Rule=>Rule.required()}),
  defineField({name:'category',type:'string',title:'จัดอยู่กลุ่มไหน?',options:{list:[
    {title:'วงเงิน / ผลประโยชน์หลัก',value:'medical'},
    {title:'ผลประโยชน์เพิ่มเติม',value:'extra'},
    {title:'เงื่อนไขสำคัญ',value:'condition'},
  ]},initialValue:'medical'}),
],preview:{select:{title:'label',subtitle:'value'}}});
export const signaturePlanExplorer=defineType({
  name:'signaturePlanExplorer',type:'object',title:'CCPun · เลือกและเปรียบเทียบแผน',
  description:'เพิ่มแผนและรายการได้เอง ใช้ได้ทั้งบทความประกันและการเปรียบเทียบอื่น ๆ',
  fields:[title,description,
    defineField({name:'plans',type:'array',title:'แผนให้คนอ่านเลือก',description:'กด + เพื่อเพิ่มแผน',
      of:[defineArrayMember({name:'signaturePlan',type:'object',title:'แผน',fields:[
        defineField({name:'name',type:'string',title:'ชื่อแผน',validation:Rule=>Rule.required()}),
        defineField({name:'headline',type:'string',title:'ตัวเลขเด่นหรือจุดขาย (ถ้ามี)'}),
        defineField({name:'benefits',type:'array',title:'รายการเปรียบเทียบ',of:[benefit],validation:Rule=>Rule.min(1).max(40)}),
      ],preview:{select:{title:'name',subtitle:'headline'}}})],
      validation:Rule=>Rule.required().min(2).max(12)}),
    takeaway,note,
  ],
  preview:{select:{title:'title'},prepare:({title})=>({title:title||'เปรียบเทียบแผน',subtitle:'CCPun Plan Explorer'})},
});
