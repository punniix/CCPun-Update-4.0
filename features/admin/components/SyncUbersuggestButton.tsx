"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { friendlyApiErrorFromPayload } from "@/lib/admin/presentation";

export default function SyncUbersuggestButton() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function sync() {
    if (state === "running") return;
    if (!window.confirm("ดึงข้อมูลโควตาและการปรากฏใน AI Search จาก Ubersuggest ตอนนี้หรือไม่? ระบบจะบันทึกเฉพาะผลสรุปที่ไม่มีข้อมูลเข้าสู่ระบบ")) return;
    setState("running");
    setMessage("");
    try {
      const response = await fetch("/api/admin/providers/ubersuggest/sync/", { method: "POST" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(friendlyApiErrorFromPayload(payload));
        setState("error");
        return;
      }
      setMessage(payload?.reused ? "ใช้ข้อมูลล่าสุดที่ยังใหม่อยู่ จึงไม่ดึงซ้ำ" : "ดึงข้อมูล Ubersuggest สำเร็จ");
      setState("done");
      router.refresh();
    } catch {
      setMessage(friendlyApiErrorFromPayload(null));
      setState("error");
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={sync}
        disabled={state === "running"}
        className="min-h-11 rounded-xl bg-[#e0c985] px-4 py-2.5 text-sm font-semibold text-[#17191d] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {state === "running" ? "กำลังดึงข้อมูล…" : state === "done" ? "ดึงข้อมูลแล้ว" : state === "error" ? "ลองดึงข้อมูลอีกครั้ง" : "ดึงข้อมูล Ubersuggest"}
      </button>
      {message ? <p role={state === "error" ? "alert" : "status"} className={`mt-2 max-w-md text-sm leading-6 ${state === "error" ? "text-red-200" : "text-white/60"}`}>{message}</p> : null}
    </div>
  );
}
