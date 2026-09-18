"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

function amountToMinor(value:string){
  if(!/^\d+(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const [whole,decimal=""]=value.trim().split(".");
  const minor=Number(whole)*100+Number((decimal+"00").slice(0,2));
  return Number.isSafeInteger(minor)?minor:null;
}

export function LeadOutcomeActions({leadId}:{leadId:string}){
  const router=useRouter();
  const [implementation,setImplementation]=useState<"planned"|"in_progress"|"complete"|"cancelled">("planned");
  const [partnerCode,setPartnerCode]=useState("");
  const [amount,setAmount]=useState("");
  const [currency,setCurrency]=useState("THB");
  const [busy,setBusy]=useState<string|null>(null);
  const [message,setMessage]=useState<string|null>(null);
  const implRequestId=useMemo(()=>crypto.randomUUID(),[]);
  const revenueRequestId=useMemo(()=>crypto.randomUUID(),[]);

  async function saveImplementation(){
    setBusy("implementation"); setMessage(null);
    try{
      const response=await fetch(`/api/admin/line/inbox/${leadId}/implementation/`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:implementation,partnerCode:partnerCode.trim()||null,requestId:implRequestId})});
      if(!response.ok) throw new Error("implementation");
      setMessage("บันทึก Implementation แล้ว");
      router.refresh();
    }catch{setMessage("บันทึก Implementation ไม่สำเร็จ");}
    finally{setBusy(null);}
  }

  async function saveRevenue(){
    const amountMinor=amountToMinor(amount);
    if(amountMinor==null){setMessage("จำนวนเงินไม่ถูกต้อง");return;}
    setBusy("revenue"); setMessage(null);
    try{
      const response=await fetch(`/api/admin/line/inbox/${leadId}/revenue/`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({amountMinor,currency:currency.toUpperCase(),requestId:revenueRequestId})});
      const payload=await response.json().catch(()=>({})) as {outcome?:string};
      if(!response.ok) throw new Error("revenue");
      setMessage(payload.outcome==="duplicate"?"รายการ Revenue นี้ถูกบันทึกไปแล้ว จึงไม่สร้างซ้ำ":"บันทึก Revenue attribution แล้ว");
      router.refresh();
    }catch{setMessage("บันทึก Revenue ไม่สำเร็จ");}
    finally{setBusy(null);}
  }

  return(
    <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <h3 className="text-sm font-semibold text-white/90">Implementation & Revenue</h3>
      <p className="mt-1 text-xs leading-5 text-white/50">Business outcome อยู่ใน private Admin และไม่ถูกส่งไป generic analytics</p>
      <div className="mt-4 grid gap-2">
        <select value={implementation} onChange={(e)=>setImplementation(e.target.value as typeof implementation)} className="min-h-10 rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white">
          <option value="planned">Planned</option><option value="in_progress">In progress</option><option value="complete">Complete</option><option value="cancelled">Cancelled</option>
        </select>
        <input value={partnerCode} onChange={(e)=>setPartnerCode(e.target.value.toLowerCase())} placeholder="partner code เช่น fairdee / aia" className="min-h-10 rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white placeholder:text-white/30" />
        <button type="button" disabled={Boolean(busy)} onClick={()=>void saveImplementation()} className="min-h-10 rounded-xl border border-white/10 px-3 text-sm text-white/75 disabled:opacity-40">{busy==="implementation"?"กำลังบันทึก…":"Save implementation"}</button>
      </div>
      <div className="mt-5 grid grid-cols-[minmax(0,1fr)_90px] gap-2">
        <input value={amount} onChange={(e)=>setAmount(e.target.value)} inputMode="decimal" placeholder="Revenue เช่น 12500.00" className="min-h-10 rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white placeholder:text-white/30" />
        <input value={currency} onChange={(e)=>setCurrency(e.target.value.toUpperCase().replace(/[^A-Z]/g,"").slice(0,3))} maxLength={3} className="min-h-10 rounded-xl border border-white/10 bg-black/20 px-3 text-center text-sm text-white" />
      </div>
      <button type="button" disabled={Boolean(busy)||!amount.trim()||currency.length!==3} onClick={()=>void saveRevenue()} className="mt-2 min-h-10 w-full rounded-xl bg-white px-3 text-sm font-medium text-black disabled:opacity-40">{busy==="revenue"?"กำลังบันทึก…":"Attribute revenue"}</button>
      {message?<p role="status" className="mt-3 text-xs leading-5 text-white/55">{message}</p>:null}
    </section>
  );
}
