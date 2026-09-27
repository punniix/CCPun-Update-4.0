"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const providerErrorMessages: Record<string, string> = {
  "provider-auth-required": "การเชื่อมต่อหมดอายุ กรุณาเชื่อม Ubersuggest ใหม่",
  "provider-rate-limited": "ระบบพักการเรียกข้อมูลชั่วคราวเพื่อป้องกันโควตา กรุณารอสักครู่แล้วลองใหม่",
  "provider-timeout": "Ubersuggest ใช้เวลานานเกินกำหนด ระบบไม่ได้บันทึกข้อมูล กรุณาลองใหม่ภายหลัง",
  "provider-invalid-response": "ข้อมูลจาก Ubersuggest มีรูปแบบไม่ถูกต้อง ระบบจึงไม่ได้บันทึกข้อมูล",
  "provider-tool-failed": "Ubersuggest ยังดึงข้อมูลไม่สำเร็จ ระบบไม่ได้บันทึกข้อมูล กรุณาลองใหม่",
  "research-write-not-configured": "ยังไม่ได้เปิดสิทธิ์บันทึก Research สำหรับรางนี้",
};

export default function UbersuggestResearchForm({ connected, writeReady }: { connected: boolean; writeReady: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function connect() {
    setState("working");
    const response = await fetch("/api/admin/providers/ubersuggest/connect/", { method: "POST" }).catch(() => null);
    const payload = await response?.json().catch(() => null);
    if (!response?.ok || (!payload?.connected && typeof payload?.authorizationUrl !== "string")) {
      setMessage("ยังเริ่มการเชื่อมต่อ Ubersuggest ไม่ได้ กรุณาลองใหม่");
      setState("error");
      return;
    }
    if (payload.connected) { router.refresh(); return; }
    window.location.assign(payload.authorizationUrl);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const keyword = String(new FormData(formElement).get("keyword") || "").trim();
    if (!window.confirm(`ดึงข้อมูล Ubersuggest สำหรับ “${keyword}” หรือไม่? ระบบจะใช้โควตาเฉพาะเมื่อไม่มีข้อมูลใหม่ภายใน 24 ชั่วโมง`)) return;
    setState("working");
    setMessage("");
    const response = await fetch("/api/admin/research/ubersuggest/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keyword }) }).catch(() => null);
    const payload = await response?.json().catch(() => null);
    if (!response?.ok) {
      setMessage(providerErrorMessages[payload?.error] ?? "ยังดึงข้อมูลไม่ได้ ระบบไม่ได้บันทึกข้อมูล กรุณาลองใหม่");
      setState("error");
      return;
    }
    setMessage(payload?.reused ? "ใช้ข้อมูลเดิมที่ยังใหม่อยู่ — ไม่เสียโควตาซ้ำ" : "ดึงและบันทึกข้อมูลแล้ว");
    setState("done");
    formElement.reset();
    router.refresh();
  }

  return (
    <section className="rounded-3xl border border-[#e0c985]/20 bg-[#e0c985]/[0.06] p-5 md:p-6">
      <h2 className="text-lg font-semibold text-[#f4df9b]">ค้นข้อมูลด้วย Ubersuggest</h2>
      {!connected ? <><p className="mt-2 text-sm leading-6 text-white/70">เชื่อมบัญชีครั้งแรกบน Mac เครื่องนี้ ข้อมูลเข้าสู่ระบบจะเก็บเฉพาะในเครื่องและไม่ส่งขึ้นเว็บไซต์</p><button type="button" onClick={connect} disabled={state === "working"} className="mt-4 min-h-11 rounded-xl bg-[#e0c985] px-4 py-2.5 text-sm font-semibold text-[#17191d] disabled:opacity-40">เชื่อมต่อ Ubersuggest</button></> :
        <form onSubmit={submit} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"><label className="flex-1 text-sm text-white/70">คำค้น<input name="keyword" required maxLength={300} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-white" /></label><button type="submit" disabled={state === "working" || !writeReady} className="min-h-11 rounded-xl bg-[#e0c985] px-4 py-2.5 text-sm font-semibold text-[#17191d] disabled:opacity-40">{state === "working" ? "กำลังดึงข้อมูล…" : "ดึงข้อมูลและบันทึก"}</button></form>}
      {!writeReady ? <p className="mt-3 text-sm text-amber-100">ระบบนี้ยังไม่ได้รับสิทธิ์บันทึกข้อมูลประกอบ จึงปิดปุ่มไว้</p> : null}
      {message ? <p role={state === "error" ? "alert" : "status"} className={`mt-3 text-sm ${state === "error" ? "text-red-200" : "text-emerald-200"}`}>{message}</p> : null}
    </section>
  );
}
