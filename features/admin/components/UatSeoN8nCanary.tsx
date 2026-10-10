"use client";

import { useRef, useState } from "react";

type Receipt = { status?: string; jobId?: string; jobPath?: string; error?: string };

export default function UatSeoN8nCanary({ enabled }: { enabled: boolean }) {
  const [keywords, setKeywords] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Receipt | null>(null);
  const idempotencyKey = useRef<string | null>(null);

  async function start() {
    if (busy || !enabled) return;
    const items = keywords.split(/[,\n]+/).map((item) => item.trim()).filter(Boolean);
    if (!items.length || items.length > 8 || items.some((item) => item.length < 2 || item.length > 90 || !/^[\p{L}\p{M}\p{N} ._-]+$/u.test(item))) {
      setResult({ error: "กรอกคำค้นสาธารณะ 1–8 รายการ ความยาวรายการละ 2–90 ตัวอักษร" });
      return;
    }
    if (!idempotencyKey.current) idempotencyKey.current = crypto.randomUUID();
    setBusy(true);
    try {
      const response = await fetch("/api/admin/n8n/p1/seo/", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "content-type": "application/json", "idempotency-key": idempotencyKey.current },
        body: JSON.stringify({ keywords: items }),
      });
      const receipt = await response.json().catch(() => ({})) as Receipt;
      setResult(response.ok && (receipt.status === "queued" || receipt.status === "duplicate") && receipt.jobId
        ? receipt : { error: receipt.error ?? `HTTP ${response.status}` });
    } catch {
      setResult({ error: "เชื่อมต่อไม่ได้ โปรดลองซ้ำโดยใช้คำค้นเดิม ระบบจะใช้เลขคำขอเดิมเพื่อป้องกันงานซ้ำ" });
    } finally { setBusy(false); }
  }

  return <section className="mt-6 rounded-2xl border border-[#e0c985]/25 bg-white/[0.035] p-5">
    <h2 className="font-semibold text-[#e0c985]">SEO Clustering ผ่าน n8n — UAT</h2>
    <p className="mt-2 text-sm leading-6 text-white/70">ใช้เฉพาะคำค้นสาธารณะ ไม่มีข้อมูลลูกค้า และยังไม่เผยแพร่หรือแก้ไขบทความ ผลต้องผ่านการตรวจของเจ้าของก่อน</p>
    {!enabled ? <p role="status" className="mt-3 text-sm text-amber-200">ยังไม่เปิดใช้งาน: รอเชื่อม Credential และ Webhook สำหรับ UAT เท่านั้น</p> : null}
    <label htmlFor="seo-uat-keywords" className="mt-4 block text-sm font-medium text-white/85">คำค้นสาธารณะ (คั่นด้วยเครื่องหมายจุลภาคหรือขึ้นบรรทัดใหม่)</label>
    <textarea id="seo-uat-keywords" value={keywords} onChange={(event) => { setKeywords(event.target.value); idempotencyKey.current = null; setResult(null); }} disabled={!enabled || busy} rows={3} maxLength={760}
      placeholder="ประกันสุขภาพ, วางแผนภาษี" className="mt-2 w-full rounded-xl border border-white/20 bg-[#251818] px-4 py-3 text-sm text-white placeholder:text-white/40 disabled:opacity-50" />
    <button type="button" disabled={!enabled || busy} onClick={start} className="mt-3 min-h-11 rounded-xl bg-[#e0c985] px-4 py-2.5 text-sm font-semibold text-[#352727] disabled:cursor-not-allowed disabled:opacity-40">{busy ? "กำลังส่งคำขอ…" : "เริ่มงานบน UAT"}</button>
    {result ? <div role="status" className="mt-3 break-words text-sm text-white/80">{result.error ? `ยังไม่รับงาน: ${result.error}` : <>{result.status === "duplicate" ? "รับคำขอนี้ไว้แล้ว" : "บันทึกคำขอแล้ว กำลังรอผลจาก n8n (ยังไม่ใช่งานเสร็จ)"}{result.jobPath && /^\/operations\/jobs\/[0-9a-f-]{36}\/$/.test(result.jobPath) ? <> · <a href={result.jobPath} className="text-[#e0c985] underline underline-offset-4">ดูสถานะงาน</a></> : null}</>}</div> : null}
  </section>;
}
