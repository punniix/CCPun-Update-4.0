"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminDataLaneLabel, friendlyApiErrorFromPayload } from "@/lib/admin/presentation";

export default function ApproveSuggestionButton({ id, disabled = false }: { id: string; disabled?: boolean }) {
  const laneLabel = adminDataLaneLabel();
  const router = useRouter();
  const [state, setState] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function approve() {
    if (disabled || state === "saving" || state === "success") return;
    if (
      !window.confirm(
        `อนุมัติข้อเสนอ SEO นี้ใน ${laneLabel} หรือไม่? ขั้นตอนนี้บันทึกการตัดสินใจของคุณเท่านั้น และจะไม่เผยแพร่บทความ`,
      )
    ) {
      return;
    }

    setState("saving");
    setErrorMessage("");

    try {
      const response = await fetch(`/api/admin/reviews/${encodeURIComponent(id)}/approve/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setErrorMessage(friendlyApiErrorFromPayload(payload));
        setState("error");
        return;
      }
      setState("success");
      router.refresh();
    } catch {
      setErrorMessage(friendlyApiErrorFromPayload(null));
      setState("error");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={approve}
        disabled={disabled || state === "saving" || state === "success"}
        className="min-h-11 rounded-xl bg-[#e0c985] px-3.5 py-2 text-sm font-semibold text-[#17191d] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {state === "saving"
          ? "กำลังอนุมัติ…"
          : state === "success"
            ? "อนุมัติแล้ว"
            : state === "error"
              ? "ลองอนุมัติอีกครั้ง"
              : "อนุมัติข้อเสนอ"}
      </button>
      {state === "error" ? <p role="alert" className="mt-2 max-w-xs text-sm leading-6 text-red-200">{errorMessage}</p> : null}
      <span role="status" aria-live="polite" className="sr-only">
        {state === "saving"
          ? `กำลังบันทึกการอนุมัติใน ${laneLabel}`
          : state === "success"
            ? `บันทึกการอนุมัติใน ${laneLabel} สำเร็จ`
            : state === "error"
              ? errorMessage
              : ""}
      </span>
    </>
  );
}
