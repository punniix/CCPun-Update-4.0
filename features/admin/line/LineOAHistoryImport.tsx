"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LineOAHistoryImport({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [senderLabel, setSenderLabel] = useState("CCPun");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function upload() {
    if (!file || !senderLabel.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("senderLabel", senderLabel.trim());
      const response = await fetch(
        `/api/admin/line/inbox/${encodeURIComponent(leadId)}/history-import/`,
        { method: "POST", body: form },
      );
      const payload = await response.json().catch(() => ({})) as {
        imported?: number;
        duplicate?: number;
        skipped?: number;
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error ?? "import_failed");
      setMessage(
        `นำเข้า ${payload.imported ?? 0} · ซ้ำ ${payload.duplicate ?? 0} · ข้าม ${payload.skipped ?? 0}`,
      );
      setFile(null);
      router.refresh();
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      setMessage(
        code.includes("unsupported_format")
          ? "ยังอ่านรูปแบบ CSV นี้ไม่ได้ กรุณาใช้ไฟล์ประวัติแชทจาก LINE OA Manager หรือส่งตัวอย่าง header มาให้ปรับ parser"
          : "นำเข้าประวัติ LINE OA ไม่สำเร็จ",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <h2 className="text-sm font-semibold">LINE OA chat history</h2>
      <p className="mt-1 text-xs leading-5 text-white/50">
        ใช้เติมเฉพาะข้อความฝั่ง CCPun ที่ตอบจาก LINE OA Manager ลงใน Archive
        ไฟล์ CSV ไม่ถูกเก็บ และข้อความจะถูกเข้ารหัสก่อนบันทึก
      </p>

      <label className="mt-3 block text-xs text-white/55">
        ชื่อผู้ส่งฝั่ง CCPun ตามที่อยู่ใน CSV
        <input
          value={senderLabel}
          onChange={(event) => setSenderLabel(event.target.value)}
          maxLength={200}
          className="mt-1 min-h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none"
        />
      </label>

      <label className="mt-3 block text-xs text-white/55">
        Chat history CSV
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="mt-1 block w-full text-xs text-white/60 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:text-xs file:font-medium file:text-black"
        />
      </label>

      <button
        type="button"
        onClick={() => void upload()}
        disabled={busy || !file || !senderLabel.trim()}
        className="mt-3 min-h-10 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-sm text-white/80 disabled:opacity-40"
      >
        {busy ? "กำลังนำเข้า…" : "นำเข้าเข้าประวัติ"}
      </button>

      {message ? <p role="status" className="mt-3 text-xs leading-5 text-white/55">{message}</p> : null}
    </section>
  );
}
