import type { Metadata } from "next";
import { PrivacyRequestActions, PrivacyRequestManager } from "@/features/admin/line/PrivacyRequestManager";
import { listPrivacyRequests } from "@/lib/admin/line/business-intelligence";
import { requireAdminPermission } from "@/lib/admin/require-permission";

export const metadata: Metadata = { title: "Privacy / Data Rights" };

function date(value:string|null){ if(!value) return "—"; const d=new Date(value); return Number.isNaN(d.getTime())?"—":new Intl.DateTimeFormat("th-TH",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Bangkok"}).format(d); }

export default async function PrivacyPage(){
  await requireAdminPermission("settings:read");
  const model=await listPrivacyRequests();
  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">PRIVATE OPERATIONS</p>
      <h1 className="mt-2 text-3xl font-semibold">Privacy / Data Rights</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-white/65">Export และ Delete เป็น deterministic private workflow เท่านั้น ไม่มี AI อ่านข้อมูลลูกค้า และ retention default เป็น manual review โดยไม่มี auto-delete</p>

      <div className="mt-7"><PrivacyRequestManager /></div>

      <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-lg font-semibold">Requests</h2><p className="mt-1 text-xs text-white/45">Delete execution ไม่ได้เปิดจาก UI นี้</p></div>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/60">{model.state}</span>
        </div>
        {model.state==="ready"&&model.requests.length?(
          <div className="mt-4 space-y-3">
            {model.requests.map((request)=>(
              <article key={request.id} className="rounded-2xl border border-white/10 bg-black/15 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="text-sm font-medium text-white/85">{request.requestType.toUpperCase()} · {request.id.slice(0,8)}</p><p className="mt-1 text-xs text-white/45">Requested {date(request.requestedAt)}</p></div>
                  <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/60">{request.status}</span>
                </div>
                <PrivacyRequestActions requestId={request.id} status={request.status} />
              </article>
            ))}
          </div>
        ):<p className="mt-4 text-sm text-white/45">{model.state==="ready"?"ยังไม่มี privacy request":"Private privacy runtime ยังไม่พร้อม"}</p>}
      </section>

      <section className="mt-6 rounded-2xl border border-amber-200/15 bg-amber-200/[0.05] p-4 text-xs leading-5 text-amber-50/75">
        <strong className="text-amber-50">Irreversible gate:</strong> การลบข้อมูลจริงต้องเป็นคำสั่ง Human Gate แยกต่างหากหลัง request ผ่าน verify → prepare → approve และต้องมีการยืนยันแบบ irreversible โดยเจ้าของระบบ ระบบนี้ไม่ตั้ง retention period ทางกฎหมายเองและไม่มี purge cron
      </section>
    </div>
  );
}
