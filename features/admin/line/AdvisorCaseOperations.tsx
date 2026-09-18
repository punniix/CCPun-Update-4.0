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
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [note, setNote] = useState("");

  async function post(path: string, body: unknown) {
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
      setMessage("ยังบันทึกไม่ได้ ลองใหม่อีกครั้ง");
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
        <h3 className="text-sm font-semibold text-white/90">ติดตามลูกค้า</h3>
        <p className="mt-1 text-xs leading-5 text-white/50">
          ตั้งวันที่ที่อยากกลับมาดูเคสนี้อีกครั้ง ที่เหลือระบบเก็บประวัติให้เอง
        </p>
        <form
          className="mt-3"
          onSubmit={(event) => {
            event.preventDefault();
            const value = String(new FormData(event.currentTarget).get("follow") ?? "");
            if (value) {
              void post(
                `/api/admin/line/inbox/${leadId}/operations/`,
                { followUpAt: new Date(value).toISOString() },
              );
            }
          }}
        >
          <label className="text-xs text-white/55">
            นัดกลับมาติดตาม
            <input
              name="follow"
              type="datetime-local"
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 p-2.5 text-sm text-white"
            />
          </label>
          <button
            disabled={busy}
            className="mt-2 min-h-10 rounded-xl border border-white/10 px-3 text-sm text-white/75 disabled:opacity-40"
          >
            ตั้งวันติดตาม
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
        <h3 className="text-sm font-semibold text-white/90">โน้ตของเรา</h3>
        <p className="mt-1 text-xs leading-5 text-white/50">
          ใช้จดสิ่งที่อยากจำเกี่ยวกับเคสนี้ ข้อมูลถูกเก็บแบบส่วนตัวและไม่ส่งให้ AI
        </p>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          disabled={!notesEnabled || busy}
          maxLength={4000}
          rows={3}
          placeholder={notesEnabled ? "เช่น รอโทรกลับวันจันทร์ ลูกค้าขอเวลาเทียบแผนก่อน" : "โน้ตส่วนตัวยังไม่พร้อมใช้งาน"}
          className="mt-3 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white disabled:opacity-40"
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
          className="mt-2 min-h-10 rounded-xl bg-white px-4 text-sm font-medium text-black disabled:opacity-40"
        >
          บันทึกโน้ต
        </button>
      </section>

      {message ? <p role="status" className="text-sm text-white/60">{message}</p> : null}
    </div>
  );
}
