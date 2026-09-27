"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { adminDataLaneLabel, friendlyApiErrorFromPayload } from "@/lib/admin/presentation";

export default function ResearchSnapshotForm() {
  const laneLabel = adminDataLaneLabel();
  const router = useRouter();
  const [state, setState] = useState<"idle" | "saving" | "error" | "done">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    if (!window.confirm(`บันทึกข้อมูลงานวิจัยนี้ใน ${laneLabel} หรือไม่? ข้อมูลนี้ใช้ประกอบการวิเคราะห์เท่านั้น และจะไม่เผยแพร่หรือแก้บทความเอง`)) return;
    setState("saving");
    setErrorMessage("");
    const form = new FormData(formElement);
    const payload = {
      keyword: String(form.get("keyword") || "").trim(),
      provider: "manual",
      volume: form.get("volume") ? Number(form.get("volume")) : undefined,
      difficulty: form.get("difficulty") ? Number(form.get("difficulty")) : undefined,
      intent: form.get("intent") ? String(form.get("intent")) : undefined,
      competitors: String(form.get("competitors") || "").split(",").map((value) => value.trim()).filter(Boolean),
    };

    try {
      const response = await fetch("/api/admin/research/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const responsePayload = await response.json().catch(() => null);
        setErrorMessage(friendlyApiErrorFromPayload(responsePayload));
        setState("error");
        return;
      }
      formElement.reset();
      setState("done");
      router.refresh();
    } catch {
      setErrorMessage(friendlyApiErrorFromPayload(null));
      setState("error");
    }
  }

  return (
    <form onSubmit={submit} className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 md:p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">เพิ่มข้อมูลงานวิจัยด้วยตนเอง</h2>
          <p className="mt-1 text-sm leading-6 text-white/60">ข้อมูลภายนอกเป็นหลักฐานประกอบที่ยังไม่ผ่านการยืนยัน ระบบจะไม่ทำตามเนื้อหาภายนอกโดยอัตโนมัติ</p>
        </div>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <label className="text-sm text-white/70">คำค้น<input name="keyword" required className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-white" /></label>
        <div className="text-sm text-white/70">แหล่งข้อมูล<div className="mt-2 min-h-11 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-white">กรอกด้วยตนเอง</div></div>
        <label className="text-sm text-white/70">เป้าหมายการค้นหา<select name="intent" className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#171b21] px-3 py-2.5 text-white"><option value="">ยังไม่ทราบ</option><option value="informational">หาข้อมูล</option><option value="commercial">เปรียบเทียบก่อนตัดสินใจ</option><option value="transactional">พร้อมลงมือทำ</option><option value="navigational">หาเว็บไซต์เฉพาะ</option><option value="mixed">หลายเป้าหมาย</option></select></label>
        <label className="text-sm text-white/70">จำนวนการค้นหา<input name="volume" type="number" min="0" className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-white" /></label>
        <label className="text-sm text-white/70">ระดับความยาก 0–100<input name="difficulty" type="number" min="0" max="100" className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-white" /></label>
        <label className="text-sm text-white/70">เว็บไซต์คู่แข่ง คั่นด้วยเครื่องหมายจุลภาค<input name="competitors" className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-white" /></label>
      </div>
      <div className="mt-5 flex items-center gap-3">
        <button type="submit" disabled={state === "saving"} className="min-h-11 rounded-xl bg-[#e0c985] px-4 py-2.5 text-sm font-semibold text-[#17191d] disabled:opacity-40">{state === "saving" ? "กำลังบันทึก…" : `บันทึกข้อมูล ${laneLabel}`}</button>
        {state === "done" ? <span className="text-sm text-emerald-300">บันทึกแล้ว — ใช้เป็นข้อมูลประกอบเท่านั้น</span> : null}
        {state === "error" ? <span role="alert" className="text-sm leading-6 text-red-200">{errorMessage}</span> : null}
        <span role="status" aria-live="polite" className="sr-only">
          {state === "saving"
            ? `กำลังบันทึกข้อมูลงานวิจัยใน ${laneLabel}`
            : state === "done"
              ? "บันทึกข้อมูลงานวิจัยสำเร็จ และยังไม่มีการเผยแพร่"
              : state === "error"
                ? errorMessage
                : ""}
        </span>
      </div>
    </form>
  );
}
