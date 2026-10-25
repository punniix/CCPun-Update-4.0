"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FA_NOTE_TAGS, type CrmNote } from "../../../lib/admin/financial-planning/contracts";
import { formatThaiDate } from "./format";
import { errorMessage, FA_NOTE_TAG_LABELS } from "./presentation";

export type CrmNoteView = { id: string; createdAt: string; note: CrmNote | null };

type Tag = (typeof FA_NOTE_TAGS)[number];

const fieldClass = "min-h-11 w-full rounded-xl border border-white/15 bg-black/25 px-3 text-sm text-white";

export function CrmNotesPanel({ householdId, notes }: { householdId: string; notes: CrmNoteView[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [tags, setTags] = useState<Tag[]>([]);
  const [nextMeetingOn, setNextMeetingOn] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  function toggle(tag: Tag) {
    setTags((current) => (current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]));
  }

  async function submit() {
    if (!text.trim()) {
      setMessage({ tone: "error", text: "พิมพ์โน้ตก่อนบันทึก" });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/planning/households/${householdId}/notes/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          tags,
          nextMeetingOn: nextMeetingOn || null,
          followUp: followUp.trim() || null,
        }),
      });
      const body = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error ?? "store-failed");
      setText("");
      setTags([]);
      setNextMeetingOn("");
      setFollowUp("");
      setMessage({ tone: "ok", text: "บันทึกโน้ตแล้ว" });
      router.refresh();
    } catch (error) {
      setMessage({ tone: "error", text: errorMessage(error instanceof Error ? error.message : null) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="fa-crm-title" className="flex flex-col gap-3 rounded-2xl border border-dashed border-white/20 bg-black/15 p-4 md:p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="fa-crm-title" className="text-lg font-semibold">โน้ตของที่ปรึกษา (ลูกค้าไม่เห็น)</h2>
        <span className="text-xs text-white/50">แสดงเฉพาะโหมดเตรียมก่อนนัด · บันทึกแล้วแก้หรือลบไม่ได้</span>
      </div>

      <label className="flex flex-col gap-1 text-xs text-white/60">
        สิ่งที่ลูกค้าเล่า กังวล หรือให้ความสำคัญ
        <textarea rows={3} maxLength={4000} value={text} onChange={(event) => setText(event.target.value)} className="rounded-xl border border-white/15 bg-black/25 px-3 py-2 text-sm text-white" />
      </label>

      <div role="group" aria-label="แท็กโน้ต" className="flex flex-wrap gap-2">
        {FA_NOTE_TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            aria-pressed={tags.includes(tag)}
            onClick={() => toggle(tag)}
            className={`min-h-11 rounded-full border px-4 text-sm ${tags.includes(tag) ? "border-[#e0c985] bg-white/10 text-white" : "border-white/15 text-white/70"}`}
          >
            {FA_NOTE_TAG_LABELS[tag]}
          </button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-white/60">
          นัดครั้งถัดไป
          <input type="date" value={nextMeetingOn} onChange={(event) => setNextMeetingOn(event.target.value)} className={`${fieldClass} [color-scheme:dark]`} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-white/60">
          สิ่งที่ต้องทำต่อ
          <input value={followUp} maxLength={300} placeholder="เช่น ขอสำเนาหน้าตารางกรมธรรม์" onChange={(event) => setFollowUp(event.target.value)} className={fieldClass} />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={submit} disabled={busy} className="min-h-11 rounded-xl border border-white/15 px-4 text-sm font-semibold text-[#e0c985] hover:bg-white/[0.05] disabled:opacity-50">
          {busy ? "กำลังบันทึก…" : "บันทึกโน้ต"}
        </button>
        {message ? <span role="status" className={`text-sm ${message.tone === "ok" ? "text-emerald-200" : "text-rose-200"}`}>{message.text}</span> : null}
      </div>

      {notes.length ? (
        <ol className="mt-2 flex flex-col gap-2">
          {notes.map((item) => (
            <li key={item.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">
              <p className="text-xs text-white/45">{formatThaiDate(item.createdAt)}</p>
              {item.note ? (
                <>
                  <p className="mt-1 whitespace-pre-wrap text-white/85">{item.note.text}</p>
                  {item.note.tags.length ? (
                    <p className="mt-2 flex flex-wrap gap-1.5">
                      {item.note.tags.map((tag) => <span key={tag} className="rounded-full border border-white/15 px-2 py-0.5 text-xs text-white/65">{FA_NOTE_TAG_LABELS[tag]}</span>)}
                    </p>
                  ) : null}
                  {item.note.nextMeetingOn || item.note.followUp ? (
                    <p className="mt-2 text-xs text-white/55">
                      {item.note.nextMeetingOn ? `นัดถัดไป ${formatThaiDate(item.note.nextMeetingOn)}` : null}
                      {item.note.nextMeetingOn && item.note.followUp ? " · " : null}
                      {item.note.followUp ? `ต้องทำต่อ: ${item.note.followUp}` : null}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="mt-1 text-white/50">ถอดรหัสโน้ตนี้ไม่ได้</p>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-white/45">ยังไม่มีโน้ตของครอบครัวนี้</p>
      )}
    </section>
  );
}
