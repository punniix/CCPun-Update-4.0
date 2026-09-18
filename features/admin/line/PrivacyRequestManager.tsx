"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function PrivacyRequestManager() {
  const router = useRouter();
  const [requestType, setRequestType] = useState<"export"|"delete">("export");
  const [scopeType, setScopeType] = useState<"lead"|"customer">("lead");
  const [scopeId, setScopeId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string|null>(null);

  async function createRequest() {
    setBusy(true); setMessage(null);
    try {
      const response=await fetch("/api/admin/line/privacy/",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          requestType,
          ...(scopeType==="lead"?{leadId:scopeId.trim()}:{customerId:scopeId.trim()}),
        }),
      });
      const payload=await response.json().catch(()=>({})) as {requestId?:string;error?:string};
      if(!response.ok) throw new Error(payload.error??"request_failed");
      setScopeId("");
      setMessage(`สร้าง ${requestType} request แล้ว · ${payload.requestId?.slice(0,8)??""}`);
      router.refresh();
    } catch {
      setMessage("สร้าง privacy request ไม่สำเร็จ");
    } finally { setBusy(false); }
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
      <h2 className="text-lg font-semibold">Create data-rights request</h2>
      <p className="mt-1 text-xs leading-5 text-white/50">ใช้ internal Lead/Customer UUID เท่านั้น การ Delete จริงยังถูกปิดและต้องผ่าน Human Gate แยก</p>
      <div className="mt-4 grid gap-3 md:grid-cols-[180px_180px_minmax(260px,1fr)_auto]">
        <select value={requestType} onChange={(e)=>setRequestType(e.target.value as "export"|"delete")} className="min-h-11 rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white">
          <option value="export">Export</option>
          <option value="delete">Delete dry-run</option>
        </select>
        <select value={scopeType} onChange={(e)=>setScopeType(e.target.value as "lead"|"customer")} className="min-h-11 rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white">
          <option value="lead">Lead UUID</option>
          <option value="customer">Customer UUID</option>
        </select>
        <input value={scopeId} onChange={(e)=>setScopeId(e.target.value)} placeholder={scopeType==="lead"?"Lead UUID":"Customer UUID"} className="min-h-11 rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none placeholder:text-white/30" />
        <button type="button" onClick={()=>void createRequest()} disabled={busy||!scopeId.trim()} className="min-h-11 rounded-xl bg-white px-4 text-sm font-medium text-black disabled:opacity-40">{busy?"กำลังสร้าง…":"Create"}</button>
      </div>
      {message?<p role="status" className="mt-3 text-sm text-white/60">{message}</p>:null}
    </section>
  );
}

export function RetentionPolicyEditor({
  conversationReviewAfterDays,
  documentReviewAfterDays,
  auditReviewAfterDays,
}:{
  conversationReviewAfterDays:number|null;
  documentReviewAfterDays:number|null;
  auditReviewAfterDays:number|null;
}) {
  const router=useRouter();
  const [conversation,setConversation]=useState(conversationReviewAfterDays?.toString()??"");
  const [documentDays,setDocumentDays]=useState(documentReviewAfterDays?.toString()??"");
  const [audit,setAudit]=useState(auditReviewAfterDays?.toString()??"");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState<string|null>(null);

  function value(input:string) {
    const trimmed=input.trim();
    if(!trimmed) return null;
    const parsed=Number(trimmed);
    return Number.isInteger(parsed)&&parsed>=1&&parsed<=36500?parsed:Number.NaN;
  }

  async function save() {
    const values=[value(conversation),value(documentDays),value(audit)];
    if(values.some((item)=>Number.isNaN(item))) {
      setMessage("กรอกจำนวนวันเป็นเลขเต็ม 1–36,500 หรือเว้นว่าง");
      return;
    }
    setBusy(true); setMessage(null);
    try {
      const response=await fetch("/api/admin/line/privacy/retention/",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          conversationReviewAfterDays:values[0],
          documentReviewAfterDays:values[1],
          auditReviewAfterDays:values[2],
        }),
      });
      if(!response.ok) throw new Error("retention");
      setMessage("บันทึก review threshold แล้ว · auto-delete ยังปิดอยู่");
      router.refresh();
    } catch {
      setMessage("บันทึก retention policy ไม่สำเร็จ");
    } finally { setBusy(false); }
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Retention review policy</h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-white/50">
            ค่านี้เป็น threshold สำหรับให้ owner กลับมาตรวจ ไม่ใช่กำหนดอายุทางกฎหมาย และไม่เปิด automatic delete
          </p>
        </div>
        <span className="rounded-full border border-emerald-200/15 bg-emerald-200/[0.06] px-3 py-1.5 text-xs text-emerald-50/80">manual review only</span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <label className="text-xs text-white/55">Conversation review after days
          <input inputMode="numeric" value={conversation} onChange={(e)=>setConversation(e.target.value)} placeholder="ไม่กำหนด" className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none placeholder:text-white/30" />
        </label>
        <label className="text-xs text-white/55">Document review after days
          <input inputMode="numeric" value={documentDays} onChange={(e)=>setDocumentDays(e.target.value)} placeholder="ไม่กำหนด" className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none placeholder:text-white/30" />
        </label>
        <label className="text-xs text-white/55">Audit review after days
          <input inputMode="numeric" value={audit} onChange={(e)=>setAudit(e.target.value)} placeholder="ไม่กำหนด" className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none placeholder:text-white/30" />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={()=>void save()} disabled={busy} className="min-h-10 rounded-xl bg-white px-4 text-sm font-medium text-black disabled:opacity-40">{busy?"กำลังบันทึก…":"Save review policy"}</button>
        <p className="text-xs text-white/45">Attachment unsend: revoke → delete · auto-delete: off</p>
      </div>
      {message?<p role="status" className="mt-3 text-sm text-white/60">{message}</p>:null}
    </section>
  );
}

export function PrivacyRequestActions({requestId,status}:{requestId:string;status:string}) {
  const router=useRouter();
  const [busy,setBusy]=useState(false);
  const [plan,setPlan]=useState<string|null>(null);

  async function transition(next:string) {
    setBusy(true); setPlan(null);
    try {
      const response=await fetch(`/api/admin/line/privacy/${requestId}/transition/`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:next})});
      if(!response.ok) throw new Error("transition");
      router.refresh();
    } finally { setBusy(false); }
  }

  async function prepare() {
    setBusy(true); setPlan(null);
    try {
      const response=await fetch(`/api/admin/line/privacy/${requestId}/prepare/`,{method:"POST"});
      const payload=await response.json() as {
        counts?:Record<string,number>;
        destructiveExecutionAvailable?:boolean;
        preparationKind?:"export_manifest"|"delete_tombstone";
        rawPayloadMaterialized?:boolean;
        attachmentCleanupRequired?:number;
      };
      if(!response.ok||!payload.counts) throw new Error("prepare");
      const countText=Object.entries(payload.counts).map(([k,v])=>`${k}: ${v}`).join(" · ");
      const safetyText=payload.preparationKind==="export_manifest"
        ? "export manifest prepared · raw payload materialized: no"
        : `delete tombstone prepared · attachment cleanup: ${payload.attachmentCleanupRequired??0} · destructive execution: blocked`;
      setPlan(`${countText} · ${safetyText}`);
    } catch {
      setPlan("อ่าน dry-run plan ไม่สำเร็จ");
    } finally { setBusy(false); }
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {status==="requested"?<button disabled={busy} onClick={()=>void transition("verified")} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-white/70 disabled:opacity-40">Verify</button>:null}
      {status==="verified"||status==="prepared"||status==="approved"?<button disabled={busy} onClick={()=>void prepare()} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-white/70 disabled:opacity-40">Dry-run plan</button>:null}
      {status==="prepared"?<button disabled={busy} onClick={()=>void transition("approved")} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-white/70 disabled:opacity-40">Approve</button>:null}
      {!["executed","cancelled","failed"].includes(status)?<button disabled={busy} onClick={()=>void transition("cancelled")} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-white/45 disabled:opacity-40">Cancel</button>:null}
      {plan?<p className="basis-full text-xs leading-5 text-white/50">{plan}</p>:null}
    </div>
  );
}
