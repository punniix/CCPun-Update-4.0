"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { adminDataLaneLabel, friendlyApiErrorFromPayload } from "@/lib/admin/presentation";

export default function ApplySuggestionButton({ id, articleId, disabled = false }: { id: string; articleId?: string | null; disabled?: boolean }) {
  const laneLabel = adminDataLaneLabel();
  const router = useRouter();
  const [state, setState] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [isStale, setIsStale] = useState(false);

  async function apply() {
    if (disabled || state === "saving" || state === "success") return;
    if (
      !window.confirm(
        `นำข้อเสนอที่อนุมัติแล้วไปใช้กับ ${laneLabel} หรือไม่? ขั้นตอนนี้แก้เฉพาะฉบับร่าง และจะไม่เผยแพร่บทความ`,
      )
    ) {
      return;
    }

    setState("saving");
    setErrorMessage("");

    try {
      const response = await fetch(`/api/admin/reviews/${encodeURIComponent(id)}/apply/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setIsStale(Boolean(payload && typeof payload === "object" && "error" in payload && payload.error === "suggestion-stale"));
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
      {isStale ? (
        <Link
          href={articleId ? `/seo/audits/${encodeURIComponent(articleId)}/` : "/seo/"}
          className="inline-flex min-h-11 items-center rounded-xl border border-[#e0c985]/30 bg-[#e0c985]/10 px-3.5 py-2 text-sm font-semibold text-[#f4df9b] transition hover:bg-[#e0c985]/15"
        >
          ตรวจ SEO และสร้างข้อเสนอใหม่
        </Link>
      ) : (
        <button
          type="button"
          onClick={apply}
          disabled={disabled || state === "saving" || state === "success"}
          className="min-h-11 rounded-xl border border-[#e0c985]/30 bg-[#e0c985]/10 px-3.5 py-2 text-sm font-semibold text-[#f4df9b] transition hover:bg-[#e0c985]/15 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {state === "saving"
            ? "กำลังนำไปใช้…"
            : state === "success"
              ? "ใช้กับฉบับร่างแล้ว"
              : state === "error"
                ? "ลองนำไปใช้อีกครั้ง"
                : "ใช้กับฉบับร่าง"}
        </button>
      )}
      {state === "error" ? <p role="alert" className="mt-2 max-w-xs text-sm leading-6 text-red-200">{errorMessage}</p> : null}
      <span role="status" aria-live="polite" className="sr-only">
        {state === "saving"
          ? `กำลังนำข้อเสนอไปใช้กับ ${laneLabel}`
          : state === "success"
            ? `นำข้อเสนอไปใช้กับ ${laneLabel} สำเร็จ ขั้นต่อไปคือตรวจตัวอย่าง และยังไม่มีการเผยแพร่`
            : state === "error"
              ? errorMessage
              : ""}
      </span>
    </>
  );
}
