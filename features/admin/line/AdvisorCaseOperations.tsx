"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdvisorCaseOperations({
  leadId,
  notesEnabled,
}: {
  leadId: string;
  notesEnabled: boolean;
}) {
  const router=useRouter();
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState<string|null>(null);
  const [note,setNote]=useState("");

  async function post(path:string,body:unknown){
    setBusy(true); setMessage(null);
    try{
      const response=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      if(!response.ok) throw new Error("request_failed");
      setMessage("บันทึกแล้ว");
      router.refresh();
    }catch{ setMessage("บันทึกไม่สำเร็จ ระบบยังคง fail-closed"); }
    finally{ setBusy(false); }
  }

  return <div className="space-y-4">
    <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <h3 className="text-sm font-semibold text-white/90">Advisor operations</h3>
      <p className="mt-1 text-xs leading-5 text-white/50">อัปเดตเฉพาะ operational state ไม่มี transcript search และไม่มีข้อมูลส่วนตัวเข้า AI</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-white/55">Priority
          <select disabled={busy} onChange={(e)=>void post(`/api/admin/line/inbox/${leadId}/operations/`,{priority:e.target.value})} defaultValue="" className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 p-2.5 text-sm text-white">
            <option value="" disabled>เลือก priority</option><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option>
          </select>
        </label>
        <label className="text-xs text-white/55">Case state
          <select disabled={busy} onChange={(e)=>void post(`/api/admin/line/inbox/${leadId}/operations/`,{caseState:e.target.value})} defaultValue="" className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 p-2.5 text-sm text-white">
            <option value="" disabled>เลือก state</option><option value="active">Active</option><option value="waiting">Waiting</option><option value="completed">Completed</option>
          </select>
        </label>
        <form className="sm:col-span-2" onSubmit={(e)=>{e.preventDefault();const form=new FormData(e.currentTarget);const value=String(form.get("assigned")??"").trim();void post(`/api/admin/line/inbox/${leadId}/operations/`,{assignedAdvisor:value||null});}}>
          <label className="text-xs text-white/55">Assigned advisor<input name="assigned" maxLength={200} className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 p-2.5 text-sm text-white" placeholder="ชื่อ/ทีมภายใน" /></label>
          <button disabled={busy} className="mt-2 min-h-10 rounded-xl border border-white/10 px-3 text-sm text-white/75 disabled:opacity-40">บันทึก assignment</button>
        </form>
        <form onSubmit={(e)=>{e.preventDefault();const value=String(new FormData(e.currentTarget).get("tag")??"").trim().toLowerCase();if(value)void post(`/api/admin/line/inbox/${leadId}/operations/`,{tagAdd:value});}}>
          <label className="text-xs text-white/55">Add safe tag<input name="tag" pattern="[a-z0-9][a-z0-9_-]{0,79}" className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 p-2.5 text-sm text-white" placeholder="renewal_soon" /></label>
          <button disabled={busy} className="mt-2 min-h-10 rounded-xl border border-white/10 px-3 text-sm text-white/75 disabled:opacity-40">เพิ่ม tag</button>
        </form>
        <form onSubmit={(e)=>{e.preventDefault();const value=String(new FormData(e.currentTarget).get("follow")??"");if(value)void post(`/api/admin/line/inbox/${leadId}/operations/`,{followUpAt:new Date(value).toISOString()});}}>
          <label className="text-xs text-white/55">Follow-up<input name="follow" type="datetime-local" className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 p-2.5 text-sm text-white" /></label>
          <button disabled={busy} className="mt-2 min-h-10 rounded-xl border border-white/10 px-3 text-sm text-white/75 disabled:opacity-40">ตั้ง follow-up</button>
        </form>
      </div>
    </section>
    <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <h3 className="text-sm font-semibold text-white/90">Internal note</h3>
      <p className="mt-1 text-xs leading-5 text-white/50">Private customer data · encrypted · AI อ่านไม่ได้</p>
      <textarea value={note} onChange={(e)=>setNote(e.target.value)} disabled={!notesEnabled||busy} maxLength={4000} rows={3} placeholder={notesEnabled?"เขียนโน้ตภายใน":"Private notes ยังไม่เปิด encryption gate"} className="mt-3 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white disabled:opacity-40" />
      <button type="button" disabled={!notesEnabled||busy||!note.trim()} onClick={()=>void post(`/api/admin/line/inbox/${leadId}/notes/`,{text:note.trim()}).then(()=>setNote(""))} className="mt-2 min-h-10 rounded-xl bg-white px-4 text-sm font-medium text-black disabled:opacity-40">บันทึก private note</button>
    </section>
    {message?<p role="status" className="text-sm text-white/60">{message}</p>:null}
  </div>;
}
