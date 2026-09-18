"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { LineCaseStage } from "@/lib/line/ecosystem";

export function LineCaseActions({
  leadId,
  nextStages,
  stageMutationEnabled,
}: {
  leadId: string;
  nextStages: readonly LineCaseStage[];
  stageMutationEnabled: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function moveStage(stage: LineCaseStage) {
    setBusy(`stage:${stage}`);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/line/inbox/${encodeURIComponent(leadId)}/stage/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      if (!response.ok) throw new Error("stage_update_failed");
      setMessage(`อัปเดตเป็น ${stage} แล้ว`);
      router.refresh();
    } catch {
      setMessage("อัปเดต stage ไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
        <h3 className="text-sm font-semibold text-white/90">Case stage</h3>
        <p className="mt-1 text-xs leading-5 text-white/55">
          เปลี่ยนได้เฉพาะ transition ที่ระบบอนุญาตและทุกครั้งมี stage history
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {nextStages.length ? nextStages.map((stage) => (
            <button
              key={stage}
              type="button"
              disabled={!stageMutationEnabled || Boolean(busy)}
              onClick={() => void moveStage(stage)}
              className="min-h-10 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/80 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy === `stage:${stage}` ? "กำลังอัปเดต…" : stage}
            </button>
          )) : <span className="text-sm text-white/45">ไม่มี transition ถัดไป</span>}
        </div>
      </section>

      <section className="rounded-2xl border border-sky-200/15 bg-sky-200/[0.04] p-4 text-xs leading-5 text-sky-100/75">
        <strong className="text-sky-100">ตอบลูกค้าผ่าน LINE OA Manager</strong>
        <p className="mt-2">
          Admin นี้เป็น Conversation Archive / Customer Timeline เท่านั้น และไม่มีปุ่มส่งข้อความออกไปหาลูกค้า
        </p>
      </section>

      {message ? <p role="status" className="text-sm text-white/65">{message}</p> : null}
    </div>
  );
}
