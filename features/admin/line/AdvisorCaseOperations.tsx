"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";

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
  const [note, setNote] = useState("");
  const [selectedFollowUp, setSelectedFollowUp] = useState<string | null>(null);
  const noteId = useId();
  const followHintId = useId();
  const requestPending = useRef(false);

  async function post(path: string, body: unknown) {
    if (requestPending.current) return false;
    requestPending.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error("request_failed");
      setMessage("บันทึกแล้ว");
      router.refresh();
      return true;
    } catch {
      setMessage("ยังยืนยันผลการบันทึกไม่ได้ ตรวจข้อมูลและประวัติเดิมก่อนบันทึกซ้ำ");
      return false;
    } finally {
      setBusy(false);
      requestPending.current = false;
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
        <h3 className="text-sm leading-[22px] font-semibold text-white/90">ติดตามลูกค้า</h3>
        <p className="mt-1 text-sm leading-[22px] text-white/70">
          ตั้งวันที่ที่อยากกลับมาดูเคสนี้อีกครั้ง ที่เหลือระบบเก็บประวัติให้เอง
        </p>
        <form
          className="mt-3"
          onSubmit={(event) => {
            event.preventDefault();
            const value = String(new FormData(event.currentTarget).get("follow") ?? "");
            const followUpAt = bangkokFollowUpIso(value);
            if (followUpAt) {
              setSelectedFollowUp(followUpAt);
              void post(
                `/api/admin/line/inbox/${leadId}/operations/`,
                { followUpAt },
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
              required
              aria-describedby={followHintId}
              className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/20 p-2.5 text-base text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e0c985]"
            />
          </label>
          <p id={followHintId} className="mt-2 text-sm leading-[22px] text-white/70">ใช้เวลาไทย Asia/Bangkok แม้เครื่องของคุณตั้งเขตเวลาอื่น{selectedFollowUp ? ` · เวลาที่เลือก: ${formatBangkokFollowUp(selectedFollowUp)}` : ""}</p>
          <button
            disabled={busy}
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
        <label htmlFor={noteId} className="mt-3 block text-sm leading-[22px] text-white/70">ข้อความโน้ตส่วนตัว</label>
        <textarea
          id={noteId}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          disabled={!notesEnabled || busy}
          maxLength={4000}
          rows={3}
          placeholder={notesEnabled ? "เช่น รอโทรกลับวันจันทร์ ลูกค้าขอเวลาเทียบแผนก่อน" : "โน้ตส่วนตัวยังไม่พร้อมใช้งาน"}
          className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-base leading-6 text-white disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e0c985]"
        />
        <button
          type="button"
          disabled={!notesEnabled || busy || !note.trim()}
          onClick={() => void post(
            `/api/admin/line/inbox/${leadId}/notes/`,
            { text: note.trim() },
          ).then((saved) => {
            if (saved) setNote("");
          })}
          className="mt-2 min-h-11 rounded-xl bg-white px-4 text-base leading-6 font-medium text-black disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e0c985]"
        >
          บันทึกโน้ต
        </button>
      </section>

      {message ? <p role="status" className="text-sm leading-[22px] text-white/75">{message}</p> : null}
    </div>
  );
}
