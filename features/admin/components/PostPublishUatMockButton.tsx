"use client";

import { useState } from "react";

type Receipt = { state?: string; jobId?: string; mock?: boolean; ownerApproved?: boolean; googleWrites?: number; attempts?: number; error?: string };

export default function PostPublishUatMockButton() {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [busy, setBusy] = useState(false);
  async function execute(action: "POST" | "GET") {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/seo/post-publish/uat-mock/", action === "POST"
        ? { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "run-uat-postpublish-mock" }) }
        : { method: "GET", credentials: "same-origin", cache: "no-store" });
      const body: Receipt = await res.json();
      setReceipt(res.ok && body.mock && body.ownerApproved === false && body.googleWrites === 0
        ? body : { error: body.error ?? `HTTP ${res.status}` });
    } catch { setReceipt({ error: "network-unavailable" }); }
    finally { setBusy(false); }
  }
  return <section className="mt-6 rounded-2xl border border-[#e0c985]/30 bg-white/[0.035] p-5">
    <h2 className="font-semibold text-[#e0c985]">ทดสอบ Post-Publish SEO เฉพาะ UAT</h2>
    <p className="mt-2 text-sm text-white/70">สร้าง Durable Queue Fixture แบบจำลองใน Neon UAT เท่านั้น ไม่สร้างหรือเผยแพร่บทความ และไม่ส่งข้อมูลไป Google</p>
    <div className="mt-4 flex flex-wrap gap-3">
      <button type="button" disabled={busy} onClick={() => execute("POST")} className="min-h-11 rounded-xl bg-[#e0c985] px-4 py-2 text-sm font-semibold text-[#352727] disabled:opacity-40">สร้าง Mock Queue</button>
      <button type="button" disabled={busy} onClick={() => execute("GET")} className="min-h-11 rounded-xl border border-white/20 px-4 py-2 text-sm text-white/80 disabled:opacity-40">อ่านสถานะ Queue</button>
    </div>
    {receipt ? <p role="status" className="mt-4 break-words text-sm text-white/75">{receipt.error
      ? `ทดสอบไม่ผ่าน: ${receipt.error}`
      : `UAT Mock: ${receipt.state} · Job ${receipt.jobId} · Attempts ${receipt.attempts} · Google Writes 0`}</p> : null}
  </section>;
}
