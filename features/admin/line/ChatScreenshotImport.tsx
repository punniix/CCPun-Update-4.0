"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error("invalid_bangkok_time");
  return `${value}:00+07:00`;
}

export function ChatScreenshotImport({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [customerSide, setCustomerSide] = useState<"left" | "right">("left");
  const [capturedAtLocal, setCapturedAtLocal] = useState(bangkokLocalInputNow);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ProposalMessage[]>([]);
  const [busy, setBusy] = useState<"ocr" | "save" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const includedCount = useMemo(() => messages.filter((item) => item.include && item.text.trim() && item.direction !== "unknown").length, [messages]);

  async function runOcr() {
    if (!file) return;
    setBusy("ocr");
    setMessage(null);
    setMessages([]);
    setRequestId(null);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("customerSide", customerSide);
      body.set("capturedAt", localBangkokToOffsetIso(capturedAtLocal));
      const response = await fetch(`/api/admin/line/inbox/${encodeURIComponent(leadId)}/screenshot-ocr/`, {
        method: "POST",
        body,
      });
      const data = await response.json() as OcrProposalResponse;
      if (!response.ok || data.status !== "proposal") {
        const reason = typeof data.errorCategory === "string"
          ? data.errorCategory
          : typeof data.error === "string"
            ? data.error
            : "ocr_failed";
        throw new Error(reason);
      }
      setRequestId(String(data.requestId));
      setMessages((Array.isArray(data.messages) ? data.messages : []).map((item: { text?: unknown; direction?: unknown; confidence?: unknown }) => ({
        text: String(item.text ?? ""),
        direction: item.direction === "inbound" || item.direction === "outbound" ? item.direction : "unknown",
        confidence: Number(item.confidence ?? 0),
        include: true,
        occurredAtLocal: capturedAtLocal,
      })));
      setMessage(`อ่านได้ ${data.messages?.length ?? 0} ข้อความ กรุณาตรวจและแก้ก่อนบันทึก`);
    } catch {
      setMessage("ยังอ่านภาพไม่ได้ กรุณาลองภาพที่คมชัดขึ้นหรือลองใหม่");
    } finally {
      setBusy(null);
    }
  }

  async function saveReviewed() {
    if (!requestId || includedCount === 0) return;
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "save_failed");
      setMessage(`บันทึกแล้ว ${data.imported} ข้อความ${data.duplicate ? ` · ซ้ำ ${data.duplicate}` : ""}`);
      setMessages([]);
      setRequestId(null);
      setFile(null);
      router.refresh();
    } catch {
      setMessage("ยังบันทึกไม่ได้ ข้อมูลเดิมยังไม่ถูกแก้ไข");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs leading-5 text-white/55">
        อัปภาพแคปแชท → OCR/Local AI บน VPS → คุณตรวจ → ค่อยบันทึก CRM รูปต้นฉบับไม่ถูกบันทึกใน CRM
      </p>

      <label className="block text-xs text-white/60">
        ภาพแคปแชท
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="mt-1 block w-full text-xs text-white/70"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-white/60">
          ฝั่งของลูกค้าในภาพ
          <select value={customerSide} onChange={(event) => setCustomerSide(event.target.value as "left" | "right")} className="mt-1 min-h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm">
            <option value="left">ด้านซ้าย</option>
            <option value="right">ด้านขวา</option>
          </select>
        </label>
        <label className="text-xs text-white/60">
          วันเวลาอ้างอิง (UTC+7)
          <input type="datetime-local" value={capturedAtLocal} onChange={(event) => setCapturedAtLocal(event.target.value)} className="mt-1 min-h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm" />
        </label>
      </div>

      <button type="button" disabled={!file || busy !== null} onClick={runOcr} className="min-h-10 rounded-xl border border-[#e0c985]/25 bg-[#e0c985]/10 px-4 text-sm text-[#f4df9b] disabled:opacity-50">
        {busy === "ocr" ? "กำลังอ่านภาพ…" : "อ่านภาพด้วย Local OCR"}
      </button>

      {messages.length ? (
        <div className="space-y-3 border-t border-white/10 pt-4">
          {messages.map((item, index) => (
            <article key={index} className="rounded-2xl border border-white/10 bg-black/15 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-xs text-white/65">
                  <input type="checkbox" checked={item.include} onChange={(event) => setMessages((rows) => rows.map((row, i) => i === index ? { ...row, include: event.target.checked } : row))} />
                  บันทึกรายการนี้
                </label>
                <span className="text-[11px] text-white/40">OCR {Math.round(item.confidence * 100)}%</span>
              </div>
              <textarea value={item.text} onChange={(event) => setMessages((rows) => rows.map((row, i) => i === index ? { ...row, text: event.target.value } : row))} rows={3} className="mt-3 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm leading-6" />
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <select value={item.direction} onChange={(event) => setMessages((rows) => rows.map((row, i) => i === index ? { ...row, direction: event.target.value as ProposalMessage["direction"] } : row))} className="min-h-10 rounded-xl border border-white/10 bg-black/20 px-3 text-sm">
                  <option value="inbound">ลูกค้า</option>
                  <option value="outbound">CCPun</option>
                  <option value="unknown">ยังไม่แน่ใจ</option>
                </select>
                <input type="datetime-local" value={item.occurredAtLocal} onChange={(event) => setMessages((rows) => rows.map((row, i) => i === index ? { ...row, occurredAtLocal: event.target.value } : row))} className="min-h-10 rounded-xl border border-white/10 bg-black/20 px-3 text-sm" />
              </div>
            </article>
          ))}

          <button type="button" disabled={busy !== null || includedCount === 0} onClick={saveReviewed} className="min-h-10 rounded-xl bg-[#e0c985] px-4 text-sm font-medium text-[#251818] disabled:opacity-50">
            {busy === "save" ? "กำลังบันทึก…" : `ยืนยันและบันทึก ${includedCount} ข้อความ`}
          </button>
        </div>
      ) : null}

      {message ? <p className="text-xs leading-5 text-white/60">{message}</p> : null}
    </div>
  );
}
