"use client";

import { useState } from "react";

type JobReceipt = { state?: string; jobId?: string; attempts?: number; error?: string };

export default function PostPublishOwnerRecheckButton({ articleId }: { articleId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  async function recheck() {
    if (!confirming || working) return;
    setConfirming(false);
    setWorking(true);
    setMessage("");
    try {
      // Explicit owner POST only; no Sanity mutation and no Google API call from the browser.
      const response = await fetch("/api/admin/seo/post-publish/", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId }),
      });
      const body: JobReceipt = await response.json();
      if (response.status !== 202 || !body.jobId || !body.state) {
        setMessage(`ส่งเข้าคิวไม่สำเร็จ: ${body.error ?? `HTTP ${response.status}`}`);
      } else {
        setMessage(`บันทึกเข้าคิวแล้ว · ${body.state} · Job ${body.jobId}`);
      }
    } catch {
      setMessage("ไม่สามารถยืนยันผลการเข้าคิวได้ โปรดตรวจสถานะก่อนลองอีกครั้ง");
    } finally {
      setWorking(false);
    }
  }

  async function checkStatus() {
    if (working) return;
    setWorking(true);
    try {
      const response = await fetch(`/api/admin/seo/post-publish/?articleId=${encodeURIComponent(articleId)}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      const body: JobReceipt = await response.json();
      if (!response.ok) {
        setMessage(body.state === "not-found" ? "ยังไม่มีรายการในคิว" : `อ่านคิวไม่ได้: ${body.error ?? response.status}`);
      } else {
        setMessage(`สถานะ ${body.state} · Attempts ${body.attempts ?? 0} · Job ${body.jobId ?? "—"}`);
      }
    } catch {
      setMessage("ไม่สามารถอ่านสถานะคิวได้");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {confirming ? (
        <>
          <button type="button" disabled={working} onClick={() => void recheck()} className="min-h-11 rounded-xl bg-[#e0c985] px-3 py-2 text-sm font-semibold text-[#352727] disabled:opacity-40">
            ยืนยันส่งตรวจ SEO
          </button>
          <button type="button" disabled={working} onClick={() => setConfirming(false)} className="min-h-11 rounded-xl border border-white/20 px-3 py-2 text-sm text-white/70">
            ยกเลิก
          </button>
          <span className="text-xs text-white/60">ใช้บทความ Live เดิม ไม่สร้างฉบับใหม่</span>
        </>
      ) : (
        <button type="button" disabled={working} onClick={() => setConfirming(true)} className="min-h-11 rounded-xl border border-[#e0c985]/30 px-3 py-2 text-sm font-medium text-[#e0c985] disabled:opacity-40">
          ตรวจ Post-Publish อีกครั้ง
        </button>
      )}
      <button type="button" disabled={working} onClick={() => void checkStatus()} className="min-h-11 rounded-xl border border-white/15 px-3 py-2 text-sm text-white/70 disabled:opacity-40">
        สถานะคิว
      </button>
      {message ? <span role="status" className="max-w-sm break-words text-xs text-white/75">{message}</span> : null}
    </div>
  );
}
