"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { lineImplementationLabel } from "@/lib/admin/line/presentation";

function amountToMinor(value: string) {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const [whole, decimal = ""] = value.trim().split(".");
  const minor = Number(whole) * 100 + Number((decimal + "00").slice(0, 2));
  return Number.isSafeInteger(minor) ? minor : null;
}

export function LeadOutcomeActions({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [implementation, setImplementation] = useState<"planned" | "in_progress" | "complete" | "cancelled">("planned");
  const [partnerCode, setPartnerCode] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("THB");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const implRequestId = useMemo(() => crypto.randomUUID(), []);
  const revenueRequestId = useMemo(() => crypto.randomUUID(), []);

  async function saveImplementation() {
    setBusy("implementation");
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/line/inbox/${leadId}/implementation/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: implementation,
          partnerCode: partnerCode.trim() || null,
          requestId: implRequestId,
        }),
      });
      if (!response.ok) throw new Error("implementation");
      setMessage(`บันทึกว่า “${lineImplementationLabel(implementation)}” แล้ว`);
      router.refresh();
    } catch {
      setMessage("ยังบันทึกสถานะงานไม่ได้ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(null);
    }
  }

  async function saveRevenue() {
    const amountMinor = amountToMinor(amount);
    if (amountMinor == null) {
      setMessage("กรุณากรอกจำนวนเงินให้ถูกต้อง");
      return;
    }
    setBusy("revenue");
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/line/inbox/${leadId}/revenue/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountMinor,
          currency: currency.toUpperCase(),
          requestId: revenueRequestId,
        }),
      });
      const payload = await response.json().catch(() => ({})) as { outcome?: string };
      if (!response.ok) throw new Error("revenue");
      setMessage(
        payload.outcome === "duplicate"
          ? "รายการนี้ถูกบันทึกไว้แล้ว จึงไม่สร้างซ้ำ"
          : "บันทึกรายได้จากเคสนี้แล้ว",
      );
      router.refresh();
    } catch {
      setMessage("ยังบันทึกรายได้ไม่ได้ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <h3 className="text-sm font-semibold text-white/90">ผลลัพธ์ของเคส</h3>
      <p className="mt-1 text-xs leading-5 text-white/50">
        ใช้เมื่อเคสเริ่มดำเนินการจริงหรือมีรายได้แล้ว ข้อมูลนี้เก็บเฉพาะหลังบ้าน
      </p>

      <div className="mt-4 grid gap-2">
        <label className="text-xs text-white/55">
          งานตอนนี้อยู่ขั้นไหน
          <select
            value={implementation}
            onChange={(event) => setImplementation(event.target.value as typeof implementation)}
            className="mt-1 min-h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white"
          >
            <option value="planned">{lineImplementationLabel("planned")}</option>
            <option value="in_progress">{lineImplementationLabel("in_progress")}</option>
            <option value="complete">{lineImplementationLabel("complete")}</option>
            <option value="cancelled">{lineImplementationLabel("cancelled")}</option>
          </select>
        </label>

        <label className="text-xs text-white/55">
          ทำรายการผ่านที่ไหน
          <input
            value={partnerCode}
            onChange={(event) => setPartnerCode(event.target.value.toLowerCase())}
            placeholder="เช่น Fairdee หรือ AIA"
            className="mt-1 min-h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white placeholder:text-white/30"
          />
        </label>

        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => void saveImplementation()}
          className="min-h-10 rounded-xl border border-white/10 px-3 text-sm text-white/75 disabled:opacity-40"
        >
          {busy === "implementation" ? "กำลังบันทึก…" : "บันทึกสถานะงาน"}
        </button>
      </div>

      <div className="mt-5 border-t border-white/10 pt-4">
        <p className="text-xs font-medium text-white/70">รายได้จากเคสนี้</p>
        <div className="mt-2 grid grid-cols-[minmax(0,1fr)_90px] gap-2">
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            placeholder="เช่น 12500.00"
            className="min-h-10 rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white placeholder:text-white/30"
          />
          <input
            value={currency}
            onChange={(event) => setCurrency(event.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3))}
            maxLength={3}
            aria-label="สกุลเงิน"
            className="min-h-10 rounded-xl border border-white/10 bg-black/20 px-3 text-center text-sm text-white"
          />
        </div>
        <button
          type="button"
          disabled={Boolean(busy) || !amount.trim() || currency.length !== 3}
          onClick={() => void saveRevenue()}
          className="mt-2 min-h-10 w-full rounded-xl bg-white px-3 text-sm font-medium text-black disabled:opacity-40"
        >
          {busy === "revenue" ? "กำลังบันทึก…" : "บันทึกรายได้"}
        </button>
      </div>

      {message ? <p role="status" className="mt-3 text-xs leading-5 text-white/55">{message}</p> : null}
    </section>
  );
}
