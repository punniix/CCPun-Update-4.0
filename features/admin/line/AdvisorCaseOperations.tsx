"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminCaseDraft } from "../components/AdminDataRefresh";

export function bangkokFollowUpIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00+07:00`);
  if (!Number.isFinite(date.getTime())) return null;
  // Reject normalized invalid calendar dates by checking the same Bangkok wall time.
  if (new Date(date.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 16) !== value) return null;
  return date.toISOString();
}

export function formatBangkokFollowUp(value: string) {
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(value));
}

export function AdvisorCaseOperations({
  leadId,
  notesEnabled,
}: {
  leadId: string;
  notesEnabled: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [boundLead, setBoundLead] = useState(leadId);
  if (boundLead !== leadId) { setBoundLead(leadId); setBusy(false); setMessage(null); }
  const noteMemory = useAdminCaseDraft(leadId, "note", () => ({ text: "" }), notesEnabled);
  const followMemory = useAdminCaseDraft(leadId, "follow-up", () => ({ value: "", baseline: "", selected: null as string | null }));
  const note = noteMemory.data.text;
  const followDraft = followMemory.data.value;
  const selectedFollowUp = followMemory.data.selected;
  const noteId = useId();
  const followHintId = useId();
  const requestPending = useRef(false);
  const active = useRef(true);
  const generation = useRef(0);
  useEffect(() => {
    const token = generation.current + 1;
    generation.current = token;
    active.current = true;
    requestPending.current = false;
    return () => { active.current = false; generation.current = token + 1; };
  }, [leadId]);

  async function post(path: string, body: unknown, draft: {
    available: boolean; phase: string; begin: () => number | null; complete: (revision: number) => number | null;
    unknown: (revision: number) => number | null; settled: (revision: number) => void; authFailed: (status: number) => void; refresh: (router: { refresh: () => void }) => void;
  }, outcome: "created" | "updated") {
    if (requestPending.current || !draft.available || draft.phase !== "idle") return false;
    const revision = draft.begin();
    if (revision === null) return false;
    requestPending.current = true;
    const token = generation.current;
    const isCurrent = () => active.current && generation.current === token;
    setBusy(true); setMessage(null);
    try {
      const response = await fetch(path, { method: "POST", redirect: "error", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      draft.authFailed(response.status);
      if (!response.ok) throw new Error("request_failed");
      const result = await response.json();
      if (!result || result.outcome !== outcome || (outcome === "created" && (typeof result.noteId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(result.noteId)))) throw new Error("save-result-unconfirmed");
      if (draft.complete(revision) === null) return false;
      draft.settled(revision);
      if (isCurrent()) { setMessage("บันทึกแล้ว"); draft.refresh(router); }
      return true;
    } catch {
      draft.unknown(revision);
      if (isCurrent()) setMessage("ยังยืนยันผลการบันทึกไม่ได้ ตรวจข้อมูลและประวัติเดิมก่อนบันทึกซ้ำ");
      return false;
    } finally {
      draft.settled(revision);
      if (isCurrent()) setBusy(false);
      if (isCurrent()) requestPending.current = false;
    }
  }

  return (
    <div className="space-y-4">
      {noteMemory.restored || followMemory.restored ? <p role="status" className="text-sm leading-[22px] text-white/75">นำฉบับในแท็บนี้กลับมาแล้ว ยังไม่ใช่การบันทึกอัตโนมัติ ตรวจประวัติเคสก่อนดำเนินการต่อ</p> : null}
      {!followMemory.available ? <p role="status" className="text-sm leading-[22px] text-white/75">สิทธิ์หรือการเข้าสู่ระบบเปลี่ยน ฉบับในแท็บถูกล้าง กรุณาเข้าสู่ระบบและตรวจเคสอีกครั้ง</p> : null}
      {[noteMemory.capacityMessage, followMemory.capacityMessage].filter(Boolean).map((text, index) => <p key={index} role="status" className="text-sm leading-[22px] text-white/75">{text}</p>)}
      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
        <h3 className="text-sm leading-[22px] font-semibold text-white/90">ติดตามลูกค้า</h3>
        <p className="mt-1 text-sm leading-[22px] text-white/70">
          ตั้งวันที่ที่อยากกลับมาดูเคสนี้อีกครั้ง ที่เหลือระบบเก็บประวัติให้เอง
        </p>
        {followMemory.phase !== "idle" && !busy ? <div className="mt-2"><p className="text-sm leading-[22px] text-white/75">คำขอเดิมยังไม่ยืนยัน ตรวจประวัติเวลาติดตามก่อนบันทึกซ้ำ</p><button type="button" disabled={followMemory.inFlight} onClick={() => followMemory.reviewed()} className="mt-2 min-h-11 rounded-xl border border-white/15 px-3 text-base leading-6 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e0c985]">ตรวจประวัติแล้ว · เปิดการบันทึกอีกครั้ง</button></div> : null}
        <form
          className="mt-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (requestPending.current || !followMemory.available || followMemory.phase !== "idle") return;
            const value = String(new FormData(event.currentTarget).get("follow") ?? "");
            const followUpAt = bangkokFollowUpIso(value);
            if (followUpAt) {
              if (followMemory.update({ ...followMemory.data, value, selected: followUpAt }, true) === null) return;
              void post(
                `/api/admin/line/inbox/${leadId}/operations/`,
                { followUpAt },
                { ...followMemory, begin: () => followMemory.begin(), complete: (revision) => followMemory.complete(revision, { value, baseline: value, selected: followUpAt }) },
                "updated",
              );
            } else {
              setMessage("เลือกวันและเวลาติดตามที่ถูกต้องตามเวลาไทย");
            }
          }}
        >
          <label className="text-sm leading-[22px] text-white/70">
            นัดกลับมาติดตาม (เวลาไทย UTC+7)
            <input
              name="follow"
              type="datetime-local"
              value={followDraft}
              onChange={(event) => { const value = event.target.value; followMemory.update({ ...followMemory.data, value }, value !== followMemory.data.baseline); }}
              disabled={busy || !followMemory.available}
              required
              aria-describedby={followHintId}
              className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/20 p-2.5 text-base leading-6 text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e0c985]"
            />
          </label>
          <p id={followHintId} className="mt-2 text-sm leading-[22px] text-white/70">ใช้เวลาไทย Asia/Bangkok แม้เครื่องของคุณตั้งเขตเวลาอื่น{selectedFollowUp ? ` · เวลาที่เลือก: ${formatBangkokFollowUp(selectedFollowUp)}` : ""}</p>
          <button
            disabled={busy || !followMemory.available || followMemory.phase !== "idle"}
            className="mt-2 min-h-11 rounded-xl border border-white/10 px-3 text-base text-white/75 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e0c985]"
          >
            ตั้งวันติดตาม
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
        <h3 className="text-sm leading-[22px] font-semibold text-white/90">โน้ตของเรา</h3>
        <p className="mt-1 text-sm leading-[22px] text-white/70">
          ใช้จดสิ่งที่อยากจำเกี่ยวกับเคสนี้ ข้อมูลถูกเก็บแบบส่วนตัวและไม่ส่งให้ AI
        </p>
        {noteMemory.phase !== "idle" && !busy ? <div className="mt-2"><p className="text-sm leading-[22px] text-white/75">คำขอโน้ตเดิมยังไม่ยืนยัน ตรวจประวัติก่อนบันทึกซ้ำ</p><button type="button" disabled={noteMemory.inFlight} onClick={() => noteMemory.reviewed()} className="mt-2 min-h-11 rounded-xl border border-white/15 px-3 text-base leading-6 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e0c985]">ตรวจประวัติแล้ว · เปิดการบันทึกอีกครั้ง</button></div> : null}
        <label htmlFor={noteId} className="mt-3 block text-sm leading-[22px] text-white/70">ข้อความโน้ตส่วนตัว</label>
        <textarea
          id={noteId}
          value={note}
          onChange={(event) => noteMemory.update({ text: event.target.value }, event.target.value !== "")}
          disabled={!noteMemory.available || busy}
          maxLength={4000}
          rows={3}
          placeholder={notesEnabled ? "เช่น รอโทรกลับวันจันทร์ ลูกค้าขอเวลาเทียบแผนก่อน" : "โน้ตส่วนตัวยังไม่พร้อมใช้งาน"}
          className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-base leading-6 text-white disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e0c985]"
        />
        <button
          type="button"
          disabled={!noteMemory.available || busy || !note.trim() || noteMemory.phase !== "idle"}
          onClick={() => void post(
            `/api/admin/line/inbox/${leadId}/notes/`,
            { text: note.trim() },
            { ...noteMemory, complete: (revision) => noteMemory.complete(revision, { text: "" }) },
            "created",
          )}
          className="mt-2 min-h-11 rounded-xl bg-white px-4 text-base leading-6 font-medium text-black disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e0c985]"
        >
          บันทึกโน้ต
        </button>
      </section>

      {message ? <p role="status" className="text-sm leading-[22px] text-white/75">{message}</p> : null}
    </div>
  );
}
