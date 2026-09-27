"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { MarketingAction, MarketingActionInput, MarketingContentRow } from "@/lib/admin/marketing/model";
import { changeText, labelStatus, metricText, storedDateText } from "./presentation";

const input = "mt-1 min-h-11 w-full rounded-lg border border-white/20 bg-[#251818] px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e0c985]";
const actionTypes = { title: "ปรับหัวเรื่อง", description: "ปรับคำอธิบาย", refresh: "อัปเดตเนื้อหา", cta: "ปรับ CTA", internal_link: "เพิ่มลิงก์ภายใน", expansion: "ขยายเนื้อหา", promotion: "โปรโมต", keyword: "ปรับคำค้นเป้าหมาย", investigation: "ตรวจหาสาเหตุ" };
const metrics = { organic_sessions: "Organic sessions", search_clicks: "GSC clicks", line_clicks: "LINE clicks (intent)", calculator_complete: "Calculator complete (intent)", social_views: "Social views ตามแพลตฟอร์ม" };

function ActionEditor({ action, assets }: { action?: MarketingAction; assets: Array<Pick<MarketingContentRow, "assetId" | "title">> }) {
  const router = useRouter(), [saving, setSaving] = useState(false), [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (saving) return;
    const form = event.currentTarget, data = new FormData(form);
    const value = (name: string) => String(data.get(name) ?? "");
    const localExecution = value("executedAt");
    if (["measuring", "done"].includes(value("status")) && !localExecution) { setMessage("ระบุเวลาที่ลงมือจริงก่อนเปลี่ยนเป็นกำลังวัดผลหรือเสร็จแล้ว"); return; }
    const executionDate = localExecution ? new Date(`${localExecution}:00+07:00`) : null;
    if (executionDate && !Number.isFinite(executionDate.getTime())) { setMessage("ตรวจวันและเวลาที่ลงมือจริงอีกครั้ง"); return; }
    const execution = action?.executedAt && localExecution === localDateTime(action.executedAt) ? action.executedAt : executionDate?.toISOString() ?? null;
    const body: MarketingActionInput = { ...(action ? { id: action.id } : {}), version: action?.version ?? 0, assetId: value("assetId") || null, priority: value("priority") as MarketingActionInput["priority"], actionType: value("actionType") as MarketingActionInput["actionType"], description: value("description"), expectedMetric: value("expectedMetric") as MarketingActionInput["expectedMetric"], owner: value("owner"), status: value("status") as MarketingActionInput["status"], executedAt: execution, measurementDays: Number(value("measurementDays")), notes: value("notes"), hypothesis: value("hypothesis"), confounderNotes: value("confounderNotes") };
    setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/admin/marketing/actions/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!response.ok) { setMessage(response.status === 409 ? "รายการนี้ถูกแก้ไขจากที่อื่นแล้ว กรุณาโหลดหน้าล่าสุดก่อนบันทึก เพื่อไม่เขียนทับงานเดิม" : "ยังบันทึกไม่ได้ ข้อมูลในฟอร์มยังอยู่ กรุณาลองใหม่"); return; }
      if (!action) form.reset();
      setMessage("บันทึกแล้ว ผลวิเคราะห์รอบถัดไปจะไม่เขียนทับช่องที่คุณจัดการ"); router.refresh();
    } catch { setMessage("เชื่อมต่อไม่สำเร็จ ข้อมูลในฟอร์มยังอยู่ กรุณาลองใหม่"); }
    finally { setSaving(false); }
  }
  return <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
    <label className="text-sm">งานที่ต้องทำ<textarea required name="description" maxLength={2000} defaultValue={action?.description} className={input} rows={2} /></label>
    <label className="text-sm">เนื้อหา<select name="assetId" defaultValue={action?.assetId ?? ""} className={input}><option value="">ไม่ผูกกับเนื้อหา / งานระบบ</option>{action?.assetId && !assets.some(asset => asset.assetId === action.assetId) ? <option value={action.assetId}>{action.assetId}</option> : null}{assets.map(asset => <option key={asset.assetId} value={asset.assetId}>{asset.title}</option>)}</select></label>
    <label className="text-sm">ประเภทงาน<select name="actionType" defaultValue={action?.actionType ?? "investigation"} className={input}>{Object.entries(actionTypes).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    <label className="text-sm">ตัวชี้วัดหลัก<select name="expectedMetric" defaultValue={action?.expectedMetric ?? "organic_sessions"} className={input}>{Object.entries(metrics).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    <label className="text-sm">ผู้รับผิดชอบ<input name="owner" maxLength={160} defaultValue={action?.owner ?? ""} className={input} /></label>
    <label className="text-sm">ความสำคัญที่คุณกำหนด<select name="priority" defaultValue={action?.priority ?? "medium"} className={input}>{["high", "medium", "low"].map(key => <option key={key} value={key}>{labelStatus(key)}</option>)}</select></label>
    <label className="text-sm">สถานะ<select name="status" defaultValue={action?.status ?? "backlog"} className={input}>{["backlog", "planned", "doing", "measuring", "done"].map(key => <option key={key} value={key}>{labelStatus(key)}</option>)}</select></label>
    <label className="text-sm">ช่วงวัดก่อนและหลัง (วัน)<input name="measurementDays" type="number" min={7} max={90} required defaultValue={action?.measurementDays ?? 14} className={input} /></label>
    <label className="text-sm">เวลาที่ลงมือจริง (เวลาไทย)<input name="executedAt" type="datetime-local" defaultValue={action?.executedAt ? localDateTime(action.executedAt) : ""} className={input} /><span className="mt-1 block text-xs text-white/60">Asia/Bangkok; เก็บเวลาเป็น UTC ไม่ใช่เวลาที่กดสร้างงาน</span></label>
    <label className="text-sm">สมมติฐาน<textarea name="hypothesis" maxLength={1000} defaultValue={action?.hypothesis ?? ""} rows={2} className={input} /></label>
    <label className="text-sm">สิ่งอื่นที่เปลี่ยนพร้อมกัน<textarea name="confounderNotes" maxLength={2000} defaultValue={action?.confounderNotes ?? ""} rows={2} className={input} /></label>
    <label className="text-sm">บันทึกของคุณ<textarea name="notes" maxLength={2000} defaultValue={action?.notes ?? ""} rows={2} className={input} /></label>
    <div className="sm:col-span-2"><button disabled={saving} type="submit" className="min-h-11 rounded-lg border border-[#e0c985]/60 px-5 py-2 text-sm text-[#e0c985] disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e0c985]">{saving ? "กำลังบันทึก…" : action ? "บันทึกการแก้ไข" : "เพิ่มงานในแผน"}</button><p role="status" aria-live="polite" className="mt-2 text-sm text-white/80">{message}</p></div>
  </form>;
}

function localDateTime(value: string) {
  const date = new Date(value); if (!Number.isFinite(date.getTime())) return "";
  return new Date(date.getTime() + 7 * 60 * 60_000).toISOString().slice(0, 16);
}

export function ActionPlan({ actions, assets }: { actions: MarketingAction[]; assets: Array<Pick<MarketingContentRow, "assetId" | "title">> }) {
  return <section id="action-plan" className="mt-10 border-t border-white/15 pt-6" aria-labelledby="action-plan-title">
    <h2 id="action-plan-title" className="text-xl font-semibold">Action Plan · งานที่คุณจัดการ</h2>
    <p className="mt-2 text-sm leading-6 text-white/70">Owner, สถานะ, ความสำคัญ และ Notes บันทึกแยกจากผลระบบ การอัปเดตข้อมูลหรือ AI จะไม่เปลี่ยนงานของคุณ ก่อน–หลังเป็นผลที่เกิดหลังทำ ไม่ใช่หลักฐานยืนยันเหตุและผล</p>
    <details className="mt-4 rounded-xl border border-white/15 p-4"><summary className="min-h-11 cursor-pointer py-2 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e0c985]">เพิ่มงาน / การทดลอง</summary><ActionEditor assets={assets} /></details>
    {!actions.length ? <p className="mt-4 text-sm text-white/65">ยังไม่มีงานที่บันทึกไว้ เพิ่มงานที่ตัดสินใจทำจริงเพื่อเริ่มวัดผลและเรียนรู้</p> : <div className="mt-4 space-y-3">{actions.map(action => <details key={`${action.id}-${action.version}`} className="rounded-xl border border-white/15 p-4"><summary className="cursor-pointer text-sm leading-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e0c985]"><span className="font-medium">{action.description}</span><span className="ml-3 text-[#e0c985]">{labelStatus(action.status)}</span><span className="ml-3 text-white/65">{action.owner || "ยังไม่กำหนดผู้รับผิดชอบ"}</span></summary>
      <dl className="mt-3 grid gap-3 border-y border-white/10 py-3 text-sm sm:grid-cols-4"><div><dt className="text-white/65">ก่อนทำ</dt><dd>{metricText(action.baseline)}</dd></div><div><dt className="text-white/65">หลังทำ</dt><dd>{metricText(action.result)}</dd></div><div><dt className="text-white/65">การเปลี่ยนแปลง</dt><dd>{changeText(action.percentageChange)}</dd></div><div><dt className="text-white/65">ผลการวัด</dt><dd>{labelStatus(action.measurementStatus)} · {labelStatus(action.outcome)}</dd></div></dl><p className="mt-2 break-all text-xs text-white/60">Action ID {action.id} · ลงมือจริง {storedDateText(action.executedAt)} · วัด {action.measurementDays} วันก่อน/หลัง · แก้ไขล่าสุด {storedDateText(action.updatedAt)}</p><ActionEditor action={action} assets={assets} /></details>)}</div>}
  </section>;
}
