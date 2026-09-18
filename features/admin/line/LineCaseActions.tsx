"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { LineCaseStage } from "@/lib/line/ecosystem";

export function LineCaseActions({
  leadId,
  nextStages,
  replyEnabled,
  stageMutationEnabled,
}: {
  leadId: string;
  nextStages: readonly LineCaseStage[];
  replyEnabled: boolean;
  stageMutationEnabled: boolean;
}) {
  const router = useRouter();
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const requestId = useMemo(() => crypto.randomUUID(), []);

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

  async function sendReply() {
    const text = reply.trim();
    if (!text) return;
    setBusy("reply");
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/line/inbox/${encodeURIComponent(leadId)}/reply/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, requestId }),
      });
      const payload = await response.json().catch(() => ({})) as { outcome?: string; error?: string };
      if (!response.ok && response.status !== 202) throw new Error(payload.error ?? "reply_failed");
      setReply("");
      setMessage(payload.outcome === "reconciliation_required" ? "ส่งแล้วแต่ผลจาก LINE ยังไม่ชัด ต้อง reconcile ก่อน retry" : payload.outcome === "duplicate" ? "คำขอนี้ถูกบันทึกไปแล้ว จึงไม่ส่งซ้ำ" : "ส่งข้อความแล้ว");
      router.refresh();
    } catch {
      setMessage("ยังส่ง LINE ไม่ได้ ระบบยังคง fail-closed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
        <h3 className="text-sm font-semibold text-white/90">Case stage</h3>
        <p className="mt-1 text-xs leading-5 text-white/55">เปลี่ยนได้เฉพาะ transition ที่ระบบอนุญาตและทุกครั้งมี stage history</p>
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

      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
        <h3 className="text-sm font-semibold text-white/90">ตอบกลับผ่าน LINE</h3>
        <p className="mt-1 text-xs leading-5 text-white/55">ข้อความถูกเข้ารหัสก่อนเข้า queue และ provider write จะเปิดได้ต่อเมื่อ owner ใส่ key/token และเปิด feature gate เอง</p>
        <textarea
          value={reply}
          onChange={(event) => setReply(event.target.value)}
          maxLength={2000}
          disabled={!replyEnabled || Boolean(busy)}
          rows={4}
          placeholder={replyEnabled ? "พิมพ์ข้อความถึงลูกค้า" : "LINE outbound ยังไม่เปิดใช้งาน"}
          className="mt-3 w-full resize-y rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/20 disabled:cursor-not-allowed disabled:opacity-45"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-xs text-white/40">{reply.length}/2000</span>
          <button
            type="button"
            disabled={!replyEnabled || !reply.trim() || Boolean(busy)}
            onClick={() => void sendReply()}
            className="min-h-10 rounded-xl bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy === "reply" ? "กำลังส่ง…" : "ส่งผ่าน LINE"}
          </button>
        </div>
      </section>

      {message ? <p role="status" className="text-sm text-white/65">{message}</p> : null}
    </div>
  );
}
