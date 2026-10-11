"use client";

import { useEffect, useMemo, useState } from "react";
import type { AgentRuntimeJobDetail } from "@/lib/admin/operations/agent-os-runtime-detail";
import { ownerJobStatusLabel as statusLabel, safeN8nExecutionId } from "./job-copy";

function formatDuration(ms: number | null) {
  if (ms == null || !Number.isFinite(ms)) return "—";
  if (ms < 1000) return `${Math.round(ms)} มิลลิวินาที`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds} วินาที`;
  const minutes = Math.floor(seconds / 60);
  const remain = seconds % 60;
  return `${minutes} นาที ${remain} วินาที`;
}

function paceLabel(pace: AgentRuntimeJobDetail["pace"]) {
  if (pace === "slower_than_usual") return "งานนี้ใช้เวลานานกว่าปกติ แต่ระบบยังรายงานสถานะอยู่";
  if (pace === "heartbeat_stale") return "ไม่ได้รับสัญญาณสถานะตามเวลาปกติ ควรตรวจประวัติการทำงาน";
  if (pace === "unknown") return "ยังมีประวัติไม่พอสำหรับประเมินเวลาปกติ";
  return "ระยะเวลายังอยู่ในช่วงปกติ";
}

export function completedSheetUrl(job: Pick<AgentRuntimeJobDetail["job"], "status" | "action" | "providerReference">) {
  if (job.status !== "completed" || job.action !== "export.google_sheet" || !job.providerReference) return null;
  try {
    const url = new URL(job.providerReference);
    const id = /^\/spreadsheets\/d\/([A-Za-z0-9_-]+)\/edit\/?$/.exec(url.pathname)?.[1];
    if (url.protocol !== "https:" || url.hostname !== "docs.google.com" || url.port || url.username || url.password || !id) return null;
    return `https://docs.google.com/spreadsheets/d/${id}/edit`;
  } catch {
    return null;
  }
}

export function AgentRuntimeJobStatus({ initial, canReconcileTimeout = false }: { initial: AgentRuntimeJobDetail; canReconcileTimeout?: boolean }) {
  const [detail, setDetail] = useState(initial);
  const [now, setNow] = useState(() => Date.now());
  const [reconciling, setReconciling] = useState(false);
  const [reconcileError, setReconcileError] = useState("");

  useEffect(() => {
    if (detail.terminal) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [detail.terminal]);

  useEffect(() => {
    if (detail.terminal) return;
    let stopped = false;
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/admin/operations/jobs/${detail.job.jobId}/`, {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        if (!response.ok) return;
        const next = await response.json() as AgentRuntimeJobDetail;
        if (!stopped) setDetail(next);
      } catch {
        // Keep the last confirmed state visible; the next poll may recover.
      }
    }, 3000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [detail.job.jobId, detail.terminal]);

  const elapsed = useMemo(() => {
    if (detail.terminal) return detail.elapsedMs;
    const started = detail.job.startedAt
      ? Date.parse(detail.job.startedAt)
      : detail.job.queuedAt
        ? Date.parse(detail.job.queuedAt)
        : Date.parse(detail.job.createdAt);
    return Math.max(0, now - started);
  }, [detail, now]);
  const sheetUrl = completedSheetUrl(detail.job);
  const timeoutEligible = canReconcileTimeout && detail.job.source === "admin"
    && detail.job.action === "seo.cluster.uat" && detail.job.workflowKey === "seo.cluster.uat"
    && detail.job.status === "waiting_external" && ["n8n-dispatching", "n8n-received"].includes(detail.job.stage)
    && Boolean(detail.job.startedAt) && now - Date.parse(detail.job.startedAt!) > 601_000;

  async function reconcileTimeout() {
    setReconciling(true);
    setReconcileError("");
    try {
      const path = `/api/admin/operations/jobs/${detail.job.jobId}/`;
      const response = await fetch(path, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reconcile-seo-callback-timeout", expectedVersion: detail.job.rowVersion }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null) as { error?: string } | null;
        setReconcileError(result?.error === "stale-version"
          ? "สถานะงานเปลี่ยนแล้ว กรุณาโหลดหน้าใหม่ก่อนดำเนินการ"
          : result?.error === "not-reconcilable"
            ? "งานนี้ยังไม่เข้าเงื่อนไขตรวจผลหลังหมดเวลา"
            : "ยังบันทึกสถานะไม่ได้ กรุณาตรวจสถานะงานอีกครั้ง");
        return;
      }
      const refreshed = await fetch(path, { cache: "no-store", headers: { Accept: "application/json" } });
      if (!refreshed.ok) throw new Error("refresh-unavailable");
      setDetail(await refreshed.json() as AgentRuntimeJobDetail);
    } catch {
      setReconcileError("ยังยืนยันสถานะล่าสุดไม่ได้ กรุณาโหลดหน้าใหม่เพื่อตรวจผล");
    } finally {
      setReconciling(false);
    }
  }


  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">Agent OS</p>
            <h2 className="mt-2 text-2xl font-semibold">{statusLabel(detail.job.status)}</h2>
            <p className="mt-2 text-sm text-white/55">ดูความคืบหน้าและเวลาที่ใช้ด้านล่าง</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-white/65" aria-live="polite">
            {!detail.terminal ? <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#e0c985]" aria-hidden="true" /> : null}
            <span>{formatDuration(elapsed)}</span>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl bg-black/15 p-4">
            <p className="text-xs text-white/45">เวลาปกติ (ค่ากลาง)</p>
            <p className="mt-2 text-sm font-medium">{detail.baseline.sampleSize >= 5 ? formatDuration(detail.baseline.p50Ms) : "ข้อมูลยังไม่พอ"}</p>
          </div>
          <div className="rounded-2xl bg-black/15 p-4">
            <p className="text-xs text-white/45">90% ของงานที่ผ่านมา</p>
            <p className="mt-2 text-sm font-medium">{detail.baseline.sampleSize >= 5 ? `ไม่เกิน ${formatDuration(detail.baseline.p90Ms)}` : "ข้อมูลยังไม่พอ"}</p>
          </div>
          <div className="rounded-2xl bg-black/15 p-4">
            <p className="text-xs text-white/45">จำนวนครั้งที่ลอง</p>
            <p className="mt-2 text-sm font-medium">{detail.job.attempt}/{detail.job.maxAttempts}</p>
          </div>
          <div className="rounded-2xl bg-black/15 p-4">
            <p className="text-xs text-white/45">n8n Execution</p>
            <p className="mt-2 break-all text-sm font-medium">{safeN8nExecutionId(detail.job.n8nExecutionId) ?? "ยังไม่มีหมายเลขยืนยัน"}</p>
          </div>
        </div>

        <p className={`mt-4 rounded-2xl border p-4 text-sm leading-6 ${
          detail.pace === "heartbeat_stale"
            ? "border-rose-300/20 bg-rose-300/10 text-rose-100"
            : detail.pace === "slower_than_usual"
              ? "border-amber-200/20 bg-amber-200/10 text-amber-50"
              : "border-white/10 bg-black/10 text-white/60"
        }`}>
          {paceLabel(detail.pace)}
        </p>

        {detail.job.errorCategory ? (
          <div className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-300/10 p-4">
            <p className="text-sm font-medium text-rose-100">รายละเอียดปัญหา</p>
            <p className="mt-1 text-sm text-rose-100/80">งานรอบนี้ไม่สำเร็จ กรุณาตรวจประวัติการทำงานก่อนลองใหม่</p>
          </div>
        ) : null}

        {timeoutEligible ? (
          <div className="mt-4">
            <p className="text-sm leading-6 text-white/60">งานนี้รอผลเกินกำหนด คุณสามารถย้ายไปสถานะต้องตรวจผลก่อนตัดสินใจดำเนินการต่อ</p>
            <button type="button" onClick={reconcileTimeout} disabled={reconciling}
              className="mt-3 min-h-11 rounded-xl border border-[#e0c985]/35 px-4 py-2 text-sm font-medium text-[#e0c985] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e0c985]">
              {reconciling ? "กำลังบันทึกสถานะ…" : "ย้ายงานหมดเวลาไปสถานะต้องตรวจผล"}
            </button>
          </div>
        ) : null}
        {reconcileError ? <p role="alert" className="mt-3 text-sm text-rose-100">{reconcileError}</p> : null}

        {sheetUrl ? (
          <a href={sheetUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-[#e0c985] underline underline-offset-4 focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e0c985]">
            เปิด Google Sheet ที่ส่งออก
          </a>
        ) : null}
        <details className="mt-4 text-xs text-white/55">
          <summary className="cursor-pointer">ข้อมูลสำหรับทีมดูแลระบบ</summary>
          <p className="mt-2 break-all">Job ID: {detail.job.jobId} · Stage: {detail.job.stage} · n8n Execution: {detail.job.n8nExecutionId ?? "ยังไม่มี"}{detail.job.errorCategory ? ` · Error category: ${detail.job.errorCategory}` : ""}</p>
        </details>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
        <h2 className="text-lg font-semibold">ลำดับการทำงาน</h2>
        <p className="mt-1 text-sm text-white/50">แสดงเฉพาะสถานะงาน โดยไม่แสดงข้อความลูกค้าหรือรหัสลับ</p>

        {detail.events.length ? (
          <ol className="mt-5 space-y-3">
            {detail.events.map((event, index) => {
              const current = index === detail.events.length - 1 && !detail.terminal;
              return (
                <li key={event.eventId} className="flex gap-3">
                  <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${current ? "animate-pulse bg-[#e0c985]" : "bg-white/30"}`} aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white/85">{statusLabel(event.status)}</p>
                    <p className="mt-1 text-xs text-white/40">
                      ครั้งที่ {event.attempt} · {new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "medium", timeZone: "Asia/Bangkok" }).format(new Date(event.occurredAt))}
                    </p>
                    {event.errorCategory ? <p className="mt-1 text-xs text-rose-100/70">พบข้อขัดข้องในขั้นนี้</p> : null}
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="mt-4 text-sm text-white/45">ยังไม่มีประวัติขั้นตอนให้แสดง</p>
        )}
      </section>
    </div>
  );
}
