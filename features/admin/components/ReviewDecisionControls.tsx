"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { friendlyApiErrorFromPayload } from "@/lib/admin/presentation";

type Mode = "idle" | "edit" | "reject";

export default function ReviewDecisionControls({
  id,
  initialAfter,
  initialReason,
  canEdit,
  canReject,
}: {
  id: string;
  initialAfter: string;
  initialReason: string;
  canEdit: boolean;
  canReject: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("idle");
  const [after, setAfter] = useState(initialAfter);
  const [reason, setReason] = useState(initialReason);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(decision: "edit" | "reject") {
    if (saving || (decision === "edit" ? !canEdit : !canReject)) return;
    setSaving(true);
    setError("");

    const payload = decision === "edit" ? { after, reason } : { reason };
    try {
      const response = await fetch(`/api/admin/reviews/${encodeURIComponent(id)}/${decision}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        setError(friendlyApiErrorFromPayload(await response.json().catch(() => null)));
        setSaving(false);
        return;
      }
      setMode("idle");
      setSaving(false);
      router.refresh();
    } catch {
      setError(friendlyApiErrorFromPayload(null));
      setSaving(false);
    }
  }

  if (mode === "idle") {
    return (
      <div className="mt-2 flex flex-wrap justify-end gap-2">
        <button type="button" disabled={!canEdit} onClick={() => setMode("edit")} className="min-h-11 rounded-xl border border-white/15 px-3.5 py-2 text-sm text-white/75 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40">
          แก้ข้อเสนอ
        </button>
        <button type="button" disabled={!canReject} onClick={() => { setReason(""); setMode("reject"); }} className="min-h-11 rounded-xl border border-red-300/20 px-3.5 py-2 text-sm text-red-100 transition hover:bg-red-300/10 disabled:cursor-not-allowed disabled:opacity-40">
          ไม่อนุมัติ
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-left">
      {mode === "edit" ? (
        <label className="block text-sm text-white/70">
          ข้อเสนอที่แก้แล้ว
          <textarea value={after} onChange={(event) => setAfter(event.target.value)} maxLength={12000} rows={5} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 p-3 text-sm leading-6 text-white outline-none focus:border-[#e0c985]/50" />
        </label>
      ) : null}
      <label className="mt-3 block text-sm text-white/70">
        เหตุผล
        <textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={mode === "edit" ? 8000 : 2000} rows={3} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 p-3 text-sm leading-6 text-white outline-none focus:border-[#e0c985]/50" />
      </label>
      {error ? <p role="alert" className="mt-2 text-sm leading-6 text-red-200">{error}</p> : null}
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button type="button" disabled={saving} onClick={() => { setError(""); setMode("idle"); }} className="min-h-11 rounded-xl border border-white/10 px-3.5 py-2 text-sm text-white/65 disabled:opacity-40">
          ยกเลิก
        </button>
        <button type="button" disabled={saving || !reason.trim() || (mode === "edit" && !after.trim())} onClick={() => void submit(mode)} className="min-h-11 rounded-xl bg-[#e0c985] px-3.5 py-2 text-sm font-semibold text-[#17191d] disabled:cursor-not-allowed disabled:opacity-40">
          {saving ? "กำลังบันทึก…" : mode === "edit" ? "บันทึกข้อเสนอ" : "ยืนยันไม่อนุมัติ"}
        </button>
      </div>
      <span role="status" aria-live="polite" className="sr-only">{saving ? "กำลังบันทึกการตัดสินใจ" : ""}</span>
    </div>
  );
}
