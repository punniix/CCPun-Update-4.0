"use client";
import {useRef,useState} from "react";

type Result={status?:string;jobId?:string;jobPath?:string;updatedRows?:number;error?:string};
export default function UatOwnerExportCanary({enabled}:{enabled:boolean}){
 const [busy,setBusy]=useState(false),[result,setResult]=useState<Result|null>(null);
 const idempotencyKey=useRef<string|null>(null);
 async function execute(){
  if(busy||!enabled)return;
  if(!idempotencyKey.current)idempotencyKey.current=crypto.randomUUID();
  setBusy(true);
  try{
   const response=await fetch("/api/admin/n8n/p1/export/",{
    method:"POST",credentials:"same-origin",cache:"no-store",
    headers:{"content-type":"application/json","idempotency-key":idempotencyKey.current},
    body:JSON.stringify({action:"uat-synthetic-export"}),
   });
   const data=await response.json().catch(()=>({})) as Result;
   setResult(response.ok&&(data.status==="completed"||data.status==="duplicate")&&data.jobId
    ? data : {error:data.error??`HTTP ${response.status}`});
  }catch{setResult({error:"ไม่ยืนยันผลการส่งออก โปรดลองใหม่ด้วยคำขอเดิมเพื่อป้องกันการทำงานซ้ำ"});}
  finally{setBusy(false);}
 }
 return <section className="mt-6 rounded-2xl border border-[#e0c985]/30 bg-white/[0.035] p-5">
  <h2 className="font-semibold text-[#e0c985]">ทดสอบ Owner Export ผ่าน n8n — UAT</h2>
  <p className="mt-2 text-sm leading-6 text-white/70">
    ทดสอบการเขียนคำค้นสังเคราะห์ 3 แถวลง Google Sheet สำหรับ UAT เท่านั้น ไม่แตะข้อมูลลูกค้า
    ไม่เขียนทับชีตงานจริง และไม่ใช่การส่งออก CRM ของ Production
  </p>
  {!enabled?<p className="mt-3 text-sm text-amber-200" role="status">ยังไม่เปิดใช้ — รอการเชื่อมต่อ n8n UAT</p>:null}
  <button type="button" disabled={!enabled||busy} onClick={execute} className="mt-3 min-h-11 rounded-xl bg-[#e0c985] px-4 py-2 text-sm font-semibold text-[#352727] disabled:opacity-40">
   {busy?"กำลังตรวจการเขียน Sheet…":"ทดสอบส่งออกข้อมูลสังเคราะห์"}
  </button>
  {result?<p role="status" className="mt-3 break-words text-sm text-white/80">
   {result.error?`ยังไม่ยืนยันผล: ${result.error}`:<> {result.status==="duplicate"?"คำขอนี้เคยรับแล้ว":"เขียนข้อมูลสังเคราะห์ครบ 3 แถวและตรวจ Receipt แล้ว"} {result.jobPath&&/^\/operations\/jobs\/[0-9a-f-]{36}\/$/.test(result.jobPath)?<> · <a href={result.jobPath} className="text-[#e0c985] underline underline-offset-4">ดูสถานะ Job</a></>:null}</>}
  </p>:null}
 </section>;
}
