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
        `เพิ่มเข้าประวัติแล้ว ${payload.imported ?? 0} ข้อความ · มีอยู่แล้ว ${payload.duplicate ?? 0} · ข้าม ${payload.skipped ?? 0}`,
      );
      setFile(null);
      router.refresh();
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      setMessage(
        code.includes("unsupported_format")
          ? "ยังอ่านไฟล์นี้ไม่ได้ ลองดาวน์โหลดประวัติการคุยจาก LINE OA ใหม่อีกครั้ง"
          : "ยังนำเข้าประวัติไม่ได้ ลองใหม่อีกครั้ง",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <h2 className="text-sm font-semibold">นำเข้าประวัติจาก LINE OA</h2>
      <p className="mt-1 text-xs leading-5 text-white/50">
        ใช้เมื่ออยากเติมข้อความที่ CCPun เคยตอบจาก LINE OA ให้ประวัติครบทั้งสองฝั่ง
        ไฟล์ที่เลือกจะไม่ถูกเก็บไว้
      </p>

      <label className="mt-3 block text-xs text-white/55">
        ชื่อผู้ส่งฝั่ง CCPun ในไฟล์
        <input
          value={senderLabel}
          onChange={(event) => setSenderLabel(event.target.value)}
          maxLength={200}
          placeholder="เช่น CCPun"
          className="mt-1 min-h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none"
        />
      </label>

      <label className="mt-3 block text-xs text-white/55">
        เลือกไฟล์ประวัติการคุย (.csv)
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
        {busy ? "กำลังเพิ่มเข้าประวัติ…" : "เพิ่มเข้าประวัติ"}
      </button>

      {message ? <p role="status" className="mt-3 text-xs leading-5 text-white/55">{message}</p> : null}
    </section>
  );
}
