"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FaEmploymentType } from "../../../lib/admin/financial-planning/contracts";
import styles from "./FinancialPlanning.module.css";
import { errorMessage, FA_EMPLOYMENT_LABELS } from "./presentation";

const fieldClass = "mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-black/25 px-3 text-sm text-white";

export function HouseholdCreateForm() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [employment, setEmployment] = useState<FaEmploymentType>("salaried");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!displayName.trim()) {
      setError("ใส่ชื่อที่ใช้เรียกครอบครัวนี้ก่อน");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/planning/households/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: { displayName: displayName.trim(), employment, dependentsCount: null } }),
      });
      const body = await response.json().catch(() => null) as { id?: string; error?: string } | null;
      if (!response.ok || typeof body?.id !== "string") throw new Error(body?.error ?? "store-failed");
      router.push(`/dashboard/planning/${body.id}/`);
    } catch (caught) {
      setError(errorMessage(caught instanceof Error ? caught.message : null));
      setBusy(false);
    }
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
      <h2 className="text-lg font-semibold">เพิ่มครอบครัวใหม่</h2>
      <p className="mt-1 text-xs leading-5 text-white/50">
        ใช้ชื่อเล่นหรือรหัสที่ปั้นจำได้ก็พอ ไม่ต้องใส่เลขบัตรประชาชนหรือเลขบัญชี ชื่อจะถูกเข้ารหัสก่อนบันทึก
      </p>
      <div className={`${styles.createColumns} mt-4 grid gap-3 md:items-end`}>
        <label className="text-xs text-white/60">
          ชื่อที่ใช้เรียกครอบครัวนี้
          <input value={displayName} maxLength={120} onChange={(event) => setDisplayName(event.target.value)} className={fieldClass} />
        </label>
        <label className="text-xs text-white/60">
          ลักษณะรายได้
          <select value={employment} onChange={(event) => setEmployment(event.target.value as FaEmploymentType)} className={fieldClass}>
            {Object.entries(FA_EMPLOYMENT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <button type="button" onClick={create} disabled={busy} style={{ color: "#1c1615" }} className="min-h-11 rounded-xl bg-[#e0c985] px-5 text-sm font-semibold disabled:opacity-50">
          {busy ? "กำลังสร้าง…" : "เริ่มวางแผน"}
        </button>
      </div>
      {error ? <p role="status" className="mt-3 text-sm text-rose-200">{error}</p> : null}
    </section>
  );
}
