"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FaClientStatus } from "../../../lib/admin/financial-planning/contracts";
import { formatThaiDate } from "./format";
import { errorMessage, FA_CLIENT_STATUS_LABELS } from "./presentation";

type Props = {
  householdId: string;
  clientStatus: FaClientStatus;
  relationshipEndedOn: string | null;
  retentionUntil: string | null;
  today: string;
};

/** Decision F3: mark a household former to start the 2-year retention clock. Nothing is deleted. */
export function ClientStatusControl({ householdId, clientStatus, relationshipEndedOn, retentionUntil, today }: Props) {
  const router = useRouter();
  const [endedOn, setEndedOn] = useState(relationshipEndedOn ?? today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function update(status: FaClientStatus) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/planning/households/${householdId}/status/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(status === "former" ? { status, relationshipEndedOn: endedOn } : { status }),
      });
      const body = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error ?? "store-failed");
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught instanceof Error ? caught.message : null));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm">
      <h2 className="font-semibold">สถานะลูกค้าและระยะเก็บข้อมูล</h2>
      <p className="mt-1 text-xs leading-5 text-white/55">
        {clientStatus === "active"
          ? "เก็บข้อมูลตลอดที่ยังเป็นลูกค้า เมื่อเลิกเป็นลูกค้า ระบบจะเก็บต่ออีก 2 ปี แล้วขึ้นในรายการให้ปั้นตรวจ ระบบไม่ลบเอง"
          : `${FA_CLIENT_STATUS_LABELS.former} เมื่อ ${formatThaiDate(relationshipEndedOn)} · เก็บข้อมูลถึง ${formatThaiDate(retentionUntil)} จากนั้นจะขึ้นในรายการให้ปั้นตรวจ ระบบไม่ลบเอง`}
      </p>
      {clientStatus === "active" ? (
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-xs text-white/60">
            วันที่เลิกเป็นลูกค้า
            <input type="date" value={endedOn} max={today} onChange={(event) => setEndedOn(event.target.value)} className="mt-1 min-h-11 rounded-xl border border-white/15 bg-black/25 px-3 text-sm text-white [color-scheme:dark]" />
          </label>
          <button type="button" disabled={busy || !endedOn} onClick={() => update("former")} className="min-h-11 rounded-xl border border-white/15 px-4 text-sm text-white/85 hover:bg-white/[0.05] disabled:opacity-50">
            บันทึกว่าเลิกเป็นลูกค้าแล้ว
          </button>
        </div>
      ) : (
        <button type="button" disabled={busy} onClick={() => update("active")} className="mt-3 min-h-11 rounded-xl border border-white/15 px-4 text-sm text-white/85 hover:bg-white/[0.05] disabled:opacity-50">
          กลับมาเป็นลูกค้าปัจจุบัน
        </button>
      )}
      {error ? <p role="status" className="mt-2 text-sm text-rose-200">{error}</p> : null}
    </section>
  );
}
