"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Campaign={campaignId:string;campaignCode:string;title:string;status:string;copyText:string;recipientCount:number;queuedCount:number;sentCount:number;failedCount:number;reconciliationCount:number;segment:Record<string,unknown>};

export function LineCampaignManager({campaigns,providerSendEnabled}:{campaigns:Campaign[];providerSendEnabled:boolean}){
  const router=useRouter(); const [busy,setBusy]=useState(false); const [message,setMessage]=useState<string|null>(null);
  async function post(path:string,body?:unknown){setBusy(true);setMessage(null);try{const r=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json"},body:body===undefined?undefined:JSON.stringify(body)});const p=await r.json().catch(()=>({}));if(!r.ok)throw new Error();setMessage(p.queuedCount!=null?`queue สร้าง ${p.queuedCount} รายการ (ยังไม่ส่ง provider)`:"บันทึกแล้ว");router.refresh();}catch{setMessage("ดำเนินการไม่สำเร็จ ระบบยังคง fail-closed");}finally{setBusy(false);}}
  return <div className="space-y-6">
    <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
      <h2 className="text-lg font-semibold">สร้าง Campaign Draft</h2>
      <p className="mt-1 text-xs leading-5 text-white/50">Segment ใช้ structured safe criteria เท่านั้น ไม่มี recipient list เข้า client/AI</p>
      <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={(e)=>{e.preventDefault();const f=new FormData(e.currentTarget);const segment:Record<string,unknown>={};for(const key of ["journey","stage","priority","case_state","origin","content_id","tool_id","tag","recency_bucket"]){const v=String(f.get(key)??"").trim();if(v)segment[key]=v;}void post("/api/admin/line/campaigns/",{campaignCode:String(f.get("code")??"").trim().toLowerCase(),title:String(f.get("title")??"").trim(),journey:String(f.get("journey")??"").trim()||undefined,contentId:String(f.get("content_id")??"").trim()||undefined,toolId:String(f.get("tool_id")??"").trim()||undefined,copyText:String(f.get("copy")??"").trim(),segment});}}>
        <input required name="code" pattern="[a-z0-9][a-z0-9_-]{0,79}" placeholder="campaign_code" className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white" />
        <input required name="title" maxLength={160} placeholder="ชื่อ Campaign" className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white" />
        <input name="journey" placeholder="journey (optional)" className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white" />
        <input name="content_id" placeholder="content_id (optional)" className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white" />
        <input name="stage" placeholder="stage segment (optional)" className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white" />
        <input name="priority" placeholder="priority segment (optional)" className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white" />
        <input name="tag" placeholder="tag segment (optional)" className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white" />
        <select name="recency_bucket" defaultValue="" className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white"><option value="">ทุกช่วงเวลา</option><option value="day">1 วัน</option><option value="week">7 วัน</option><option value="month">30 วัน</option></select>
        <textarea required name="copy" maxLength={2000} rows={4} placeholder="ข้อความ Campaign ที่มนุษย์จะ review ก่อน approve" className="md:col-span-2 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white" />
        <button disabled={busy} className="min-h-11 rounded-xl bg-white px-4 text-sm font-medium text-black disabled:opacity-40">Save Draft</button>
      </form>
    </section>
    <section className="space-y-3">
      {campaigns.length===0?<div className="rounded-2xl border border-white/10 p-5 text-sm text-white/55">ยังไม่มี campaign</div>:campaigns.map(c=><article key={c.campaignId} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><p className="text-xs text-[#e0c985]">{c.campaignCode} · {c.status}</p><h3 className="mt-1 font-semibold">{c.title}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/70">{c.copyText}</p><p className="mt-2 text-xs text-white/45">Segment: {JSON.stringify(c.segment)}</p></div><div className="text-xs leading-5 text-white/55">Recipients {c.recipientCount}<br/>Queued {c.queuedCount} · Sent {c.sentCount}<br/>Failed {c.failedCount} · Reconcile {c.reconciliationCount}</div></div>
        <div className="mt-4 flex flex-wrap gap-2">
          {c.status==="draft"?<button disabled={busy} onClick={()=>void post(`/api/admin/line/campaigns/${c.campaignId}/approve/`)} className="min-h-10 rounded-xl border border-white/10 px-3 text-sm text-white/75">Human Approve</button>:null}
          {c.status==="approved"?<button disabled={busy} onClick={()=>void post(`/api/admin/line/campaigns/${c.campaignId}/enqueue/`)} className="min-h-10 rounded-xl border border-[#e0c985]/25 bg-[#e0c985]/10 px-3 text-sm text-[#f4df9b]">Build private queue</button>:null}
        </div>
      </article>)}
    </section>
    <section className="rounded-2xl border border-sky-200/15 bg-sky-200/[0.05] p-4 text-sm text-sky-100/80"><strong>Provider send: {providerSendEnabled?"Enabled":"Disabled"}</strong><p className="mt-1 text-xs">การ approve/enqueue ไม่ได้ส่ง LINE เอง จนกว่า owner จะเปิด secret + provider feature gate ใน Final Activation Batch</p></section>
    {message?<p role="status" className="text-sm text-white/60">{message}</p>:null}
  </div>;
}
