"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminDataLaneLabel, friendlyApiErrorFromPayload } from "@/lib/admin/presentation";

export default function RunSeoAuditButton({ articleId, hasPreviousAudit = false }: { articleId: string; hasPreviousAudit?: boolean }) {
  const laneLabel = adminDataLaneLabel();
  const router = useRouter();
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function runAudit() {
    if (state === "running") return;
    const verb = hasPreviousAudit || state === "done" ? "ตรวจ SEO อีกครั้ง" : "ตรวจ SEO";
    if (!window.confirm(`${verb}ของบทความนี้ใน ${laneLabel} หรือไม่? ระบบจะบันทึกผลตรวจใหม่เท่านั้น และจะไม่เผยแพร่บทความ`)) return;
    setState("running");
    setErrorMessage("");
    try {
      const response = await fetch(`/api/snt-admin/seo/audit/${encodeURIComponent(articleId)}/`, { method: "POST" });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setErrorMessage(friendlyApiErrorFromPayload(payload));
        setState("error");
        return;
      }
      setState("done");
      router.refresh();
    } catch {
      setErrorMessage(friendlyApiErrorFromPayload(null));
      setState("error");
    }
  }

  const idleLabel = hasPreviousAudit ? "ตรวจ SEO อีกครั้ง" : "ตรวจ SEO";

  return (
    <>
      <button
        type="button"
        onClick={runAudit}
        disabled={state === "running"}
        className="min-h-11 rounded-xl border border-white/10 px-3.5 py-2 text-sm font-medium text-white/70 transition hover:bg-white/5 hover:text-white disabled:opacity-40"
      >
        {state === "running" ? "กำลังตรวจ…" : state === "done" ? "ตรวจ SEO อีกครั้ง" : state === "error" ? "ลองตรวจอีกครั้ง" : idleLabel}
      </button>
      {state === "error" ? <p role="alert" className="mt-2 max-w-xs text-sm leading-6 text-red-200">{errorMessage}</p> : null}
      <span role="status" aria-live="polite" className="sr-only">
        {state === "running"
          ? `กำลังตรวจ SEO ใน ${laneLabel}`
          : state === "done"
            ? "ตรวจ SEO สำเร็จ สามารถตรวจซ้ำได้ และยังไม่มีการเผยแพร่"
            : state === "error"
              ? errorMessage
              : ""}
      </span>
    </>
  );
}
