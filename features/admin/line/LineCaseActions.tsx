"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { LineCaseStage } from "@/lib/line/ecosystem";
import { lineStageLabel } from "@/lib/admin/line/presentation";

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
    setBusy(stage);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/line/inbox/${encodeURIComponent(leadId)}/stage/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      if (!response.ok) throw new Error("stage_update_failed");
      setMessage(`อัปเดตเป็น “${lineStageLabel(stage)}” แล้ว`);
      router.refresh();
    } catch {
      setMessage("ยังเปลี่ยนสถานะไม่ได้ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
        <h3 className="text-sm font-semibold text-white/90">ตอนนี้ดูแลถึงไหน</h3>
        <p className="mt-1 text-xs leading-5 text-white/55">
          เปลี่ยนเฉพาะตอนที่สถานะของลูกค้าเปลี่ยนจริง ๆ ระบบจะเก็บประวัติให้เอง
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
              {busy === stage ? "กำลังอัปเดต…" : lineStageLabel(stage)}
            </button>
          )) : <span className="text-sm text-white/45">สถานะนี้ไม่มีขั้นตอนถัดไปแล้ว</span>}
        </div>
      </section>

      <section className="rounded-2xl border border-sky-200/15 bg-sky-200/[0.04] p-4 text-xs leading-5 text-sky-100/75">
        <strong className="text-sky-100">ตอบลูกค้าใน LINE OA ตามเดิม</strong>
        <p className="mt-2">
          หน้านี้ใช้ดูประวัติและจดข้อมูลช่วยจำเท่านั้น ไม่มีปุ่มส่งข้อความหาลูกค้า
        </p>
      </section>

      {message ? <p role="status" className="text-sm text-white/65">{message}</p> : null}
    </div>
  );
}
