"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminCaseDraft } from "../components/AdminDataRefresh";
import { bangkokFollowUpIso } from "./AdvisorCaseOperations";

type ProposalMessage = {
  text: string;
  direction: "inbound" | "outbound" | "unknown";
  confidence: number;
  include: boolean;
  occurredAtLocal: string;
};

type OcrProposalResponse = {
  requestId?: unknown;
  status?: unknown;
  messages?: Array<{
    text?: unknown;
    direction?: unknown;
    confidence?: unknown;
  }>;
  errorCategory?: unknown;
  error?: unknown;
};

function bangkokLocalInputNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const v = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${v("year")}-${v("month")}-${v("day")}T${v("hour")}:${v("minute")}`;
}

function localBangkokToOffsetIso(value: string) {
  if (!bangkokFollowUpIso(value)) throw new Error("invalid_bangkok_time");
  return `${value}:00+07:00`;
}

export function ChatScreenshotImport({ leadId }: { leadId: string }) {
  const router = useRouter();
  const draft = useAdminCaseDraft(leadId, "ocr", () => ({ file: null as File | null, customerSide: "left" as "left" | "right", capturedAtLocal: bangkokLocalInputNow(), requestId: null as string | null, messages: [] as ProposalMessage[] }));
  const { file, customerSide, capturedAtLocal, requestId, messages } = draft.data;
  const edit = (next: typeof draft.data) => draft.update(next, Boolean(next.file || next.requestId || next.messages.length));
  const setMessages = (update: (rows: ProposalMessage[]) => ProposalMessage[]) => edit({ ...draft.data, messages: update(messages) });
  const [busy, setBusy] = useState<"ocr" | "save" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [boundLead, setBoundLead] = useState(leadId);
  if (boundLead !== leadId) { setBoundLead(leadId); setBusy(null); setMessage(null); }
  const inputId = useId();
  const pending = useRef(false);
  const active = useRef(true);
  const generation = useRef(0);
  useEffect(() => {
    const token = generation.current + 1;
    generation.current = token;
    active.current = true;
    pending.current = false;
    return () => { active.current = false; generation.current = token + 1; };
  }, [leadId]);

  const includedCount = useMemo(() => messages.filter((item) => item.include && item.text.trim() && item.direction !== "unknown").length, [messages]);

  async function runOcr() {
    if (!file || pending.current || !draft.available || draft.phase !== "idle") return;
    if ((requestId || messages.length) && !window.confirm("มีฉบับที่คุณตรวจไว้แล้ว ต้องการอ่านภาพใหม่และแทนที่ฉบับนี้เมื่ออ่านสำเร็จหรือไม่?")) return;
    const revision = draft.begin();
    if (revision === null) return;
    pending.current = true;
    const token = generation.current;
    const isCurrent = () => active.current && generation.current === token;
    setBusy("ocr");
    setMessage(null);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("customerSide", customerSide);
      body.set("capturedAt", localBangkokToOffsetIso(capturedAtLocal));
      const response = await fetch(`/api/admin/line/inbox/${encodeURIComponent(leadId)}/screenshot-ocr/`, {
        method: "POST",
        redirect: "error",
        body,
      });
      draft.authFailed(response.status);
      if (response.status === 401) throw new Error("authentication_expired");
      const data = await response.json() as OcrProposalResponse;
      if (!response.ok || data.status !== "proposal" || typeof data.requestId !== "string" || !data.requestId
        || !Array.isArray(data.messages) || !data.messages.every(item => item && typeof item.text === "string"
          && ["inbound", "outbound", "unknown"].includes(String(item.direction))
          && typeof item.confidence === "number" && Number.isFinite(item.confidence) && item.confidence >= 0 && item.confidence <= 1)) {
        const reason = typeof data.errorCategory === "string"
          ? data.errorCategory
          : typeof data.error === "string"
            ? data.error
            : "ocr_failed";
        throw new Error(reason);
      }
      const next = { ...draft.data, requestId: data.requestId, messages: data.messages.map(item => ({
        text: String(item.text ?? ""),
        direction: item.direction === "inbound" || item.direction === "outbound" ? item.direction : "unknown",
        confidence: Number(item.confidence ?? 0),
        include: true,
        occurredAtLocal: capturedAtLocal,
      } as ProposalMessage)) };
      if (draft.complete(revision, next, true) === null) { draft.unknown(revision); return; }
      if (isCurrent()) setMessage(`อ่านได้ ${data.messages.length} ข้อความ กรุณาตรวจและแก้ก่อนบันทึก`);
    } catch {
      draft.unknown(revision);
      if (isCurrent()) setMessage("ยังยืนยันผลการอ่านภาพไม่ได้ ฉบับที่คุณตรวจไว้ยังอยู่ ตรวจผลเดิมก่อนอ่านใหม่");
    } finally {
      draft.settled(revision);
      if (isCurrent()) pending.current = false;
      if (isCurrent()) setBusy(null);
    }
  }

  async function saveReviewed() {
    if (!requestId || includedCount === 0 || pending.current || !draft.available || draft.phase !== "idle") return;
    const revision = draft.begin();
    if (revision === null) return;
    pending.current = true;
    const token = generation.current;
    const isCurrent = () => active.current && generation.current === token;
    setBusy("save");
    setMessage(null);
    try {
      const payload = {
        requestId,
        messages: messages
          .filter((item) => item.include && item.text.trim() && item.direction !== "unknown")
          .map((item) => ({
            text: item.text.trim(),
            direction: item.direction,
            occurredAt: localBangkokToOffsetIso(item.occurredAtLocal),
          })),
      };
      const response = await fetch(`/api/admin/line/inbox/${encodeURIComponent(leadId)}/screenshot-ocr/confirm/`, {
        method: "POST",
        redirect: "error",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      draft.authFailed(response.status);
      if (response.status === 401) throw new Error("authentication_expired");
      const data = await response.json();
      const duplicate = data.duplicate ?? 0;
      if (!response.ok || !Number.isInteger(data.imported) || data.imported < 0
        || !Number.isInteger(duplicate) || duplicate < 0 || data.imported + duplicate !== payload.messages.length
        || data.total !== payload.messages.length
        || (data.requestId !== undefined && data.requestId !== requestId)) throw new Error("save-result-unconfirmed");
      if (draft.complete(revision, { ...draft.data, messages: [], requestId: null, file: null }) === null) return;
      draft.settled(revision);
      if (isCurrent()) {
        setMessage(`บันทึกแล้ว ${data.imported} ข้อความ${data.duplicate ? ` · ซ้ำ ${data.duplicate}` : ""}`);
        draft.refresh(router);
      }
    } catch {
      draft.unknown(revision);
      if (isCurrent()) setMessage("ยังยืนยันผลการบันทึกไม่ได้ ฉบับที่ตรวจยังอยู่ ตรวจประวัติเคสและผลเดิมก่อนบันทึกซ้ำ");
    } finally {
      draft.settled(revision);
      if (isCurrent()) pending.current = false;
      if (isCurrent()) setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      {draft.restored ? <p role="status" className="text-sm leading-[22px] text-white/75">นำภาพและฉบับที่ตรวจในแท็บนี้กลับมาแล้ว ยังไม่ได้บันทึกอัตโนมัติ โหลดหน้าใหม่หรือปิดแท็บจะล้างฉบับ</p> : null}
      {!draft.available ? <p role="status" className="text-sm leading-[22px] text-white/75">การเข้าสู่ระบบเปลี่ยน ฉบับในแท็บถูกล้าง กรุณาเข้าสู่ระบบและตรวจเคสอีกครั้ง</p> : null}
      {draft.capacityMessage ? <p role="status" className="text-sm leading-[22px] text-white/75">{draft.capacityMessage}</p> : null}
      {draft.phase !== "idle" && !busy ? <div><p className="text-sm leading-[22px] text-white/75">คำขอเดิมยังไม่ยืนยัน ฉบับที่ตรวจยังอยู่ ตรวจประวัติเคสและผลเดิมก่อนอ่านหรือบันทึกซ้ำ</p><button type="button" disabled={draft.inFlight} onClick={() => draft.reviewed()} className="mt-2 min-h-11 rounded-xl border border-white/15 px-3 text-base leading-6 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e0c985]">ตรวจประวัติแล้ว · เปิดการดำเนินการอีกครั้ง</button></div> : null}
      <p className="text-sm leading-[22px] text-white/75">
        อัปภาพแคปแชท → OCR/Local AI บน VPS → คุณตรวจ → ค่อยบันทึก CRM รูปต้นฉบับไม่ถูกบันทึกใน CRM
      </p>

      <label className="block text-sm leading-[22px] text-white/75">
        ภาพแคปแชท
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={busy !== null || !draft.available}
          onChange={(event) => {
            if (pending.current) return;
            const next = event.target.files?.[0] ?? null;
            if ((file || requestId || messages.length) && !window.confirm("มีภาพหรือฉบับที่ยังไม่บันทึก ต้องการเปลี่ยนภาพและยกเลิกฉบับนี้หรือไม่?")) { event.target.value = ""; return; }
            if (edit({ ...draft.data, file: next, messages: [], requestId: null }) === null) { event.target.value = ""; return; }
            setMessage(null);
          }}
          className="mt-1 block min-h-11 w-full rounded-xl border border-white/15 p-2 text-base leading-6 text-white/80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e0c985]"
        />
      </label>
      {file ? <p className="text-sm leading-[22px] text-white/75">ภาพที่เลือก: {file.name}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm leading-[22px] text-white/75">
          ฝั่งของลูกค้าในภาพ
          <select disabled={busy !== null || !draft.available} value={customerSide} onChange={(event) => edit({ ...draft.data, customerSide: event.target.value as "left" | "right" })} className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-base leading-6 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e0c985]">
            <option value="left">ด้านซ้าย</option>
            <option value="right">ด้านขวา</option>
          </select>
        </label>
        <label className="text-sm leading-[22px] text-white/75">
          วันเวลาอ้างอิง (UTC+7)
          <input disabled={busy !== null || !draft.available} type="datetime-local" value={capturedAtLocal} onChange={(event) => edit({ ...draft.data, capturedAtLocal: event.target.value })} className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-base leading-6 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e0c985]" />
        </label>
      </div>

      <button type="button" disabled={!file || busy !== null || !draft.available || draft.phase !== "idle"} onClick={runOcr} className="min-h-11 rounded-xl border border-[#e0c985]/25 bg-[#e0c985]/10 px-4 text-base leading-6 text-[#f4df9b] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e0c985]">
        {busy === "ocr" ? "กำลังอ่านภาพ…" : "อ่านภาพด้วย Local OCR"}
      </button>

      {messages.length ? (
        <div className="space-y-3 border-t border-white/10 pt-4">
          {messages.map((item, index) => (
            <article key={index} className="rounded-2xl border border-white/10 bg-black/15 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex min-h-11 items-center gap-2 text-sm leading-[22px] text-white/75">
                  <input disabled={busy !== null || !draft.available} type="checkbox" checked={item.include} onChange={(event) => setMessages((rows) => rows.map((row, i) => i === index ? { ...row, include: event.target.checked } : row))} />
                  บันทึกรายการนี้
                </label>
                <span className="text-sm leading-[22px] text-white/70">OCR {Math.round(item.confidence * 100)}%</span>
              </div>
              <label htmlFor={`${inputId}-text-${index}`} className="mt-3 block text-sm leading-[22px] text-white/75">ข้อความที่ตรวจแล้ว</label>
              <textarea id={`${inputId}-text-${index}`} disabled={busy !== null || !draft.available} value={item.text} onChange={(event) => setMessages((rows) => rows.map((row, i) => i === index ? { ...row, text: event.target.value } : row))} rows={3} className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-base leading-6 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e0c985]" />
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <label className="text-sm leading-[22px] text-white/75">ผู้ส่งข้อความ<select disabled={busy !== null || !draft.available} value={item.direction} onChange={(event) => setMessages((rows) => rows.map((row, i) => i === index ? { ...row, direction: event.target.value as ProposalMessage["direction"] } : row))} className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-base leading-6 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e0c985]">
                  <option value="inbound">ลูกค้า</option>
                  <option value="outbound">CCPun</option>
                  <option value="unknown">ยังไม่แน่ใจ</option>
                </select></label>
                <label className="text-sm leading-[22px] text-white/75">วันเวลาข้อความ (เวลาไทย)<input disabled={busy !== null || !draft.available} type="datetime-local" value={item.occurredAtLocal} onChange={(event) => setMessages((rows) => rows.map((row, i) => i === index ? { ...row, occurredAtLocal: event.target.value } : row))} className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-base leading-6 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e0c985]" /></label>
              </div>
            </article>
          ))}

          <button type="button" disabled={busy !== null || includedCount === 0 || !draft.available || draft.phase !== "idle"} onClick={saveReviewed} className="min-h-11 rounded-xl bg-[#e0c985] px-4 text-base leading-6 font-medium text-[#251818] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e0c985]">
            {busy === "save" ? "กำลังบันทึก…" : `ยืนยันและบันทึก ${includedCount} ข้อความ`}
          </button>
        </div>
      ) : null}

      {message ? <p role="status" className="text-sm leading-[22px] text-white/75">{message}</p> : null}
    </div>
  );
}
