import {defineArrayMember,defineField,defineType} from 'sanity';
import {title,description,takeaway,note} from './signature-fields';

export const signatureStructuredTable=defineType({
  name:'signatureStructuredTable',type:'object',title:'CCPun · ตารางอ่านง่ายบนมือถือ',
  description:'เพิ่มหัวตารางและข้อมูล ไม่ต้องปรับขนาดเอง เว็บจะจัดบนมือถือให้',
  fields:[title,description,
    defineField({name:'headers',type:'array',title:'ชื่อคอลัมน์',of:[defineArrayMember({type:'string'})],validation:Rule=>Rule.required().min(2).max(6)}),
    defineField({name:'rows',type:'array',title:'แถวข้อมูล (กด + เพิ่ม)',of:[defineArrayMember({type:'tableRow'})],
      description:'จำนวนช่องต้องตรงกับจำนวนหัวคอลัมน์',validation:Rule=>Rule.required().min(1).max(60).custom((rows,context)=>{
        const headers=(context.parent as {headers?:string[]}|undefined)?.headers;
        if(!Array.isArray(headers)||!Array.isArray(rows))return true;
        const wrong=rows.findIndex(row=>(row as {cells?:string[]}).cells?.length!==headers.length);
        return wrong<0?true:'แถวที่ '+(wrong+1)+' มีจำนวนช่องไม่เท่าหัวตาราง ('+headers.length+' คอลัมน์)';
      })}),
    takeaway,note,
  ],
  preview:{select:{title:'title'},prepare:({title})=>({title:title||'ตาราง CCPun',subtitle:'ตารางที่ปรับตามอุปกรณ์'})},
});
