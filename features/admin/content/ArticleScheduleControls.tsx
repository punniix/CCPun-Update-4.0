"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { CalendarClock, ExternalLink, RotateCcw, Trash2, X } from "lucide-react";

export type CalendarScheduleControlRecord = {
  articleId: string;
  generation: string;
  rowVersion: number;
  status: string;
  scheduledAt: string;
  draftRevision: string;
  publishedRevision: string | null;
};

type Mode = "overview" | "reschedule" | "cancel";

function bangkokLocal(value: string) {
  const parts = new Map(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(value)).map((part) => [part.type, part.value]),
  );
  return `${parts.get("year")}-${parts.get("month")}-${parts.get("day")}T${parts.get("hour")}:${parts.get("minute")}`;
}

function displayBangkok(value: string) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
}

function messageForError(code: string) {
  if (code === "conflict") return "คิวหรือฉบับบทความเปลี่ยนไปแล้ว กรุณาเปิด Studio ตรวจฉบับล่าสุดก่อนทำรายการอีกครั้ง";
  if (code === "article-not-ready") return "บทความไม่อยู่ในสถานะที่พร้อมตั้งเวลา กรุณาตรวจสถานะอนุมัติและข้อมูลใน Studio";
  if (code === "invalid-request") return "วันเวลาใหม่หรือข้อมูลคิวไม่ถูกต้อง กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง";
  if (code === "dispatch-failed") return "ยังยืนยันคิวใหม่ไม่ได้ ระบบไม่ได้ถือว่าเลื่อนเวลาสำเร็จ กรุณาโหลดสถานะล่าสุด";
  return "ยังยืนยันผลไม่ได้ กรุณาโหลดสถานะล่าสุดก่อนลองอีกครั้ง";
}

export default function ArticleScheduleControls({ record }: { record: CalendarScheduleControlRecord }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<Mode>("overview");
  const [scheduledLocal, setScheduledLocal] = useState(() => bangkokLocal(record.scheduledAt));
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const endpoint = useMemo(() => `/api/admin/content/${encodeURIComponent(record.articleId)}/schedule/`, [record.articleId]);
  const canReschedule = record.status === "scheduled";
  const canCancel = record.status === "scheduled" || record.status === "preparing";
  const locked = record.status === "executing" || record.status === "reconciliation-required";

  function openManager() {
    setMode("overview");
    setScheduledLocal(bangkokLocal(record.scheduledAt));
    setConfirmed(false);
    setMessage(null);
    setError(null);
    dialogRef.current?.showModal();
  }

  function chooseMode(nextMode: Mode) {
    setMode(nextMode);
    setConfirmed(false);
    setMessage(null);
    setError(null);
  }

  async function reschedule() {
    if (!canReschedule || !confirmed || busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          scheduledLocal,
          draftRevision: record.draftRevision,
          publishedRevision: record.publishedRevision,
          expectedGeneration: record.generation,
          expectedVersion: record.rowVersion,
          requestId: crypto.randomUUID(),
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || "not-ready");
      setMessage("เลื่อนเวลาเรียบร้อย ระบบสร้าง generation ใหม่และคิวเดิมจะไม่สามารถ claim ได้");
      setConfirmed(false);
      setMode("overview");
      router.refresh();
    } catch (caught) {
      setError(messageForError(caught instanceof Error ? caught.message : "not-ready"));
      setConfirmed(false);
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!canCancel || !confirmed || busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(endpoint, {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedGeneration: record.generation,
          expectedVersion: record.rowVersion,
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || "not-ready");
      setMessage("ยกเลิก Schedule เรียบร้อย บทความจะไม่เผยแพร่จากคิวนี้");
      setConfirmed(false);
      setMode("overview");
      router.refresh();
    } catch (caught) {
      setError(messageForError(caught instanceof Error ? caught.message : "not-ready"));
      setConfirmed(false);
    } finally {
      setBusy(false);
    }
  }

  if (locked) {
    return <div className="mt-3 rounded-xl border border-amber-200/15 bg-amber-200/[0.04] p-3 text-xs leading-5 text-amber-50/80">คิวกำลังดำเนินการหรือรอ reconciliation จึงล็อกการเลื่อนเวลาและการยกเลิกไว้ชั่วคราว</div>;
  }

  if (!canReschedule && !canCancel) return null;

  return (
    <>
      <button type="button" onClick={openManager} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2 text-xs font-medium text-white/70 transition hover:bg-white/[0.05] hover:text-white focus:outline-none focus:ring-2 focus:ring-[#e0c985]">
        <CalendarClock className="h-4 w-4" aria-hidden="true" />
        จัดการ Schedule
      </button>

      <dialog
        ref={dialogRef}
        aria-label="จัดการ Schedule"
        className="m-0 h-dvh max-h-none w-full max-w-none bg-transparent p-0 text-white backdrop:bg-black/60 sm:ml-auto"
        onClick={(event) => { if (event.target === event.currentTarget && !busy) dialogRef.current?.close(); }}
      >
        <div className="absolute inset-x-0 bottom-0 max-h-[86dvh] overflow-y-auto rounded-t-[22px] border border-white/10 bg-[#241818] p-4 shadow-2xl sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[430px] sm:rounded-none sm:rounded-l-2xl sm:p-6">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20 sm:hidden" aria-hidden="true" />
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold tracking-[0.12em] text-[#e0c985]">SCHEDULE MANAGEMENT</p>
              <h2 className="mt-1.5 text-xl font-semibold sm:text-2xl">{mode === "reschedule" ? "เลื่อนเวลา" : mode === "cancel" ? "ยกเลิก Schedule" : "จัดการ Schedule"}</h2>
              <p className="mt-1 text-xs text-white/40">{displayBangkok(record.scheduledAt)} · Asia/Bangkok</p>
            </div>
            <button type="button" aria-label="ปิด" disabled={busy} onClick={() => dialogRef.current?.close()} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white/45 hover:bg-white/[0.05] hover:text-white/75 focus:outline-none focus:ring-2 focus:ring-[#e0c985] disabled:opacity-40"><X className="h-4 w-4" aria-hidden="true" /></button>
          </div>

          {mode === "overview" ? (
            <div className="mt-5">
              <div className="rounded-xl border border-white/[0.07] bg-black/10 p-3 text-xs leading-5 text-white/55">
                <div className="font-medium text-white/80">สถานะ: {record.status}</div>
                <div className="mt-1 break-all">{record.articleId}</div>
                <div className="mt-2">การเลื่อนเวลาใช้ revision ที่อนุมัติไว้เดิม หากบทความเปลี่ยน ระบบจะปฏิเสธแบบ conflict แทนการย้ายคิวเงียบ ๆ</div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {canReschedule ? <button type="button" onClick={() => chooseMode("reschedule")} className="min-h-20 rounded-xl border border-white/10 bg-white/[0.025] p-3 text-left hover:bg-white/[0.05] focus:outline-none focus:ring-2 focus:ring-[#e0c985]"><RotateCcw className="h-4 w-4 text-[#f4df9b]" aria-hidden="true" /><strong className="mt-2 block text-sm">เลื่อนเวลา</strong><span className="mt-1 block text-[10px] leading-4 text-white/40">เลือกวันและเวลาใหม่</span></button> : null}
                {canCancel ? <button type="button" onClick={() => chooseMode("cancel")} className="min-h-20 rounded-xl border border-rose-300/15 bg-rose-300/[0.035] p-3 text-left hover:bg-rose-300/[0.06] focus:outline-none focus:ring-2 focus:ring-rose-200"><Trash2 className="h-4 w-4 text-rose-200" aria-hidden="true" /><strong className="mt-2 block text-sm text-rose-100">ยกเลิก Schedule</strong><span className="mt-1 block text-[10px] leading-4 text-white/40">หยุดคิวและเก็บ Audit</span></button> : null}
              </div>
            </div>
          ) : null}

          {mode === "reschedule" ? (
            <div className="mt-5">
              <label className="grid gap-2 text-sm text-white/75">วันและเวลาใหม่ · Asia/Bangkok
                <input type="datetime-local" value={scheduledLocal} onChange={(event) => { setScheduledLocal(event.currentTarget.value); setConfirmed(false); }} disabled={busy} className="min-h-11 rounded-xl border border-white/15 bg-black/15 px-3 text-sm text-white [color-scheme:dark] outline-none focus:border-[#e0c985]/60 focus:ring-2 focus:ring-[#e0c985]/20" />
              </label>
              <div className="mt-3 rounded-xl border border-[#e0c985]/15 bg-[#e0c985]/[0.045] p-3 text-xs leading-5 text-white/55">ใช้ฉบับที่อนุมัติไว้เดิม หาก revision เปลี่ยน ระบบจะปฏิเสธรายการและให้กลับไปตรวจใน Studio</div>
              <label className="mt-3 flex items-start gap-2 text-xs leading-5 text-white/55"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.currentTarget.checked)} disabled={busy} className="mt-1 accent-[#e0c985]" /><span>ยืนยันเลื่อนเวลาโดยใช้ฉบับที่อนุมัติไว้เดิม</span></label>
              <div className="mt-4 flex gap-2"><button type="button" onClick={() => chooseMode("overview")} disabled={busy} className="min-h-11 rounded-xl border border-white/10 px-4 text-sm text-white/60">กลับ</button><button type="button" onClick={() => void reschedule()} disabled={!confirmed || busy} className="min-h-11 flex-1 rounded-xl bg-[#e0c985] px-4 text-sm font-semibold text-[#251818] disabled:cursor-not-allowed disabled:opacity-40">{busy ? "กำลังเลื่อนเวลา…" : "ยืนยันเลื่อนเวลา"}</button></div>
            </div>
          ) : null}

          {mode === "cancel" ? (
            <div className="mt-5">
              <div className="rounded-xl border border-rose-300/15 bg-rose-300/[0.035] p-3 text-sm leading-6 text-white/60"><strong className="text-rose-100">ยกเลิกคิวนี้?</strong><p className="mt-1">บทความ Draft จะไม่ถูกลบหรือแก้เนื้อหา ระบบเปลี่ยนเฉพาะสถานะคิวเป็น cancelled และเก็บ Audit ไว้</p></div>
              <label className="mt-3 flex items-start gap-2 text-xs leading-5 text-white/55"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.currentTarget.checked)} disabled={busy} className="mt-1 accent-rose-300" /><span>ยืนยันยกเลิก Schedule นี้</span></label>
              <div className="mt-4 flex gap-2"><button type="button" onClick={() => chooseMode("overview")} disabled={busy} className="min-h-11 rounded-xl border border-white/10 px-4 text-sm text-white/60">กลับ</button><button type="button" onClick={() => void cancel()} disabled={!confirmed || busy} className="min-h-11 flex-1 rounded-xl border border-rose-300/25 bg-rose-300/[0.07] px-4 text-sm font-semibold text-rose-100 disabled:cursor-not-allowed disabled:opacity-40">{busy ? "กำลังยกเลิก…" : "ยืนยันยกเลิก Schedule"}</button></div>
            </div>
          ) : null}

          {message ? <p role="status" className="mt-4 rounded-xl border border-emerald-200/15 bg-emerald-200/[0.04] p-3 text-xs leading-5 text-emerald-100">{message}</p> : null}
          {error ? <p role="alert" className="mt-4 rounded-xl border border-rose-300/15 bg-rose-300/[0.04] p-3 text-xs leading-5 text-rose-100">{error}</p> : null}

          <Link href={`/studio/intent/edit/id=${encodeURIComponent(record.articleId)};type=article`} target="_blank" rel="noreferrer" className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-4 text-sm text-white/60 hover:bg-white/[0.04] hover:text-white/80 focus:outline-none focus:ring-2 focus:ring-[#e0c985]">เปิดบทความใน Studio <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /></Link>
        </div>
      </dialog>
    </>
  );
}
