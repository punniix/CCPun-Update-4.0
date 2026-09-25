"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { friendlyApiErrorFromPayload } from "@/lib/admin/presentation";

export default function UbersuggestAisvImportForm() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "running") return;

    const form = event.currentTarget;
    const raw = String(new FormData(form).get("snapshot") ?? "").trim();
    let snapshot: unknown;
    try {
      snapshot = JSON.parse(raw);
    } catch {
      setState("error");
      setMessage("JSON ไม่ถูกต้อง ระบบยังไม่ได้บันทึกข้อมูล");
      return;
    }

    if (!window.confirm("นำเข้าผล AISV ชุดนี้เข้า UAT เพื่อให้เจ้าของตรวจหรือไม่? การนำเข้าไม่แก้บทความ ไม่ publish และไม่เปลี่ยน prompt ของ Ubersuggest")) return;

    setState("running");
    setMessage("");
    try {
      const response = await fetch("/api/admin/providers/ubersuggest/sync/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "reviewed-import", snapshot }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setState("error");
        setMessage(friendlyApiErrorFromPayload(payload));
        return;
      }
      setState("done");
      setMessage("นำเข้าหลักฐาน AISV เข้า UAT แล้ว");
      form.reset();
      router.refresh();
    } catch {
      setState("error");
      setMessage(friendlyApiErrorFromPayload(null));
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-violet-200/15 bg-violet-200/[0.035] p-4">
      <h3 className="font-medium">นำเข้าหลักฐาน AISV ที่ดึงจาก runtime ที่ได้รับสิทธิ์</h3>
      <p className="mt-2 text-sm leading-6 text-white/60">
        ใช้เมื่อ Admin Preview ไม่ถือ OAuth ของ Ubersuggest เอง ข้อมูลต้องมาจาก Ubersuggest จริงและระบุ runtime, ช่วงรายงาน, เวลาดึง และข้อจำกัด ระบบจะ validate แบบ fail-closed ก่อนบันทึก
      </p>
      <textarea
        name="snapshot"
        required
        rows={8}
        spellCheck={false}
        className="mt-4 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 font-mono text-xs leading-5 text-white/75 outline-none focus:border-violet-200/35"
        placeholder='{"source":"ubersuggest-aisv", ...}'
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={state === "running"}
          className="min-h-11 rounded-xl border border-violet-200/20 bg-violet-200/10 px-4 py-2.5 text-sm font-semibold text-violet-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {state === "running" ? "กำลังตรวจและนำเข้า…" : "ตรวจและนำเข้า UAT"}
        </button>
        <span className="text-xs text-white/45">เฉพาะ UAT · ไม่ publish · ไม่แก้ provider config</span>
      </div>
      {message ? <p role={state === "error" ? "alert" : "status"} className={state === "error" ? "mt-3 text-sm text-red-200" : "mt-3 text-sm text-emerald-200"}>{message}</p> : null}
    </form>
  );
}
