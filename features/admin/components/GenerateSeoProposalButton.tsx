"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { friendlyApiErrorFromPayload } from "@/lib/admin/presentation";

export default function GenerateSeoProposalButton({ articleId }: { articleId: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function generate() {
    if (state === "running") return;
    if (!window.confirm("สร้างข้อเสนอเรื่องเป้าหมายการค้นหาจากข้อมูลล่าสุดหรือไม่? ระบบจะส่งให้ผู้มีสิทธิ์ตรวจ และจะไม่แก้หรือเผยแพร่บทความเอง")) return;
    setState("running");
    setError("");
    try {
      const response = await fetch(`/api/admin/seo/audit/${encodeURIComponent(articleId)}/proposals/`, { method: "POST" });
      if (!response.ok) {
        setError(friendlyApiErrorFromPayload(await response.json().catch(() => null)));
        setState("error");
        return;
      }
      setState("done");
      router.refresh();
    } catch {
      setError(friendlyApiErrorFromPayload(null));
      setState("error");
    }
  }

  return (
    <div>
      <button type="button" onClick={generate} disabled={state === "running" || state === "done"} className="min-h-11 rounded-xl border border-violet-200/20 bg-violet-200/[0.06] px-3.5 py-2 text-sm font-medium text-violet-100 transition hover:bg-violet-200/10 disabled:opacity-40">
        {state === "running" ? "กำลังสร้าง…" : state === "done" ? "ส่งเข้าคิวแล้ว" : state === "error" ? "ลองสร้างอีกครั้ง" : "สร้างข้อเสนอเป้าหมายการค้นหา"}
      </button>
      {error ? <p role="alert" className="mt-2 max-w-xs text-sm leading-6 text-red-200">{error}</p> : null}
      <span role="status" aria-live="polite" className="sr-only">{state === "running" ? "กำลังสร้างข้อเสนอ" : state === "done" ? "ส่งข้อเสนอเข้าคิวตรวจแล้ว" : ""}</span>
    </div>
  );
}
