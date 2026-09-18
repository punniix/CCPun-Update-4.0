"use client";

import { useState } from "react";

export function EvidencePrintButton({ leadId, itemCount }: { leadId: string; itemCount: number }) {
  const [busy, setBusy] = useState(false);

  async function printEvidence() {
    setBusy(true);
    try {
      await fetch(`/api/admin/line/inbox/${encodeURIComponent(leadId)}/evidence/audit/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "print", itemCount }),
      });
    } finally {
      setBusy(false);
      window.print();
    }
  }

  return (
    <button
      type="button"
      onClick={() => void printEvidence()}
      disabled={busy}
      className="min-h-10 rounded-xl bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-40 print:hidden"
    >
      {busy ? "กำลังเตรียม…" : "พิมพ์ / Save PDF"}
    </button>
  );
}
