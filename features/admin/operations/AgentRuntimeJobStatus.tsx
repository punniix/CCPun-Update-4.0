"use client";

import { useEffect, useMemo, useState } from "react";
import type { AgentRuntimeJobDetail } from "@/lib/admin/operations/agent-os-runtime-detail";

function formatDuration(ms: number | null) {
  if (ms == null || !Number.isFinite(ms)) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds} วินาที`;
  const minutes = Math.floor(seconds / 60);
  const remain = seconds % 60;
  return `${minutes} นาที ${remain} วินาที`;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    queued: "รอคิว",
    running: "กำลังทำงาน",
    waiting_external: "กำลังรอระบบภายนอก",
    waiting_ai: "กำลังรอ AI",
    validating: "กำลังตรวจผล",
    awaiting_review: "รอคุณตรวจ",
    retrying: "กำลังลองใหม่",
    completed: "เสร็จแล้ว",
    failed: "ไม่สำเร็จ",
    reconciliation_required: "ต้องตรวจผลกับระบบภายนอก",
    cancelled: "ยกเลิกแล้ว",
  };
  return labels[status] ?? status;
}

function paceLabel(pace: AgentRuntimeJobDetail["pace"]) {
  if (pace === "slower_than_usual") return "งานนี้ใช้เวลานานกว่าปกติ แต่ระบบยังรายงานสถานะอยู่";
  if (pace === "heartbeat_stale") return "ไม่ได้รับสัญญาณสถานะตามเวลาปกติ ควรตรวจ execution";
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

export function AgentRuntimeJobStatus({ initial }: { initial: AgentRuntimeJobDetail }) {
  const [detail, setDetail] = useState(initial);
  const [now, setNow] = useState(() => Date.now());

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

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">{detail.job.workflowKey}</p>
            <h2 className="mt-2 text-2xl font-semibold">{statusLabel(detail.job.status)}</h2>
            <p className="mt-2 text-sm text-white/55">ขั้นตอน: {detail.job.stage}</p>
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
            <p className="mt-2 break-all text-sm font-medium">{detail.job.n8nExecutionId ?? "ยังไม่มี"}</p>
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
            <p className="mt-1 break-all font-mono text-xs text-rose-100/70">{detail.job.errorCategory}</p>
          </div>
        ) : null}

        {sheetUrl ? (
          <a href={sheetUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-[#e0c985] underline underline-offset-4 focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e0c985]">
            เปิด Google Sheet ที่ส่งออก
          </a>
        ) : null}
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
        <h2 className="text-lg font-semibold">Runtime timeline</h2>
        <p className="mt-1 text-sm text-white/50">เก็บเฉพาะสถานะและ metadata ที่ปลอดภัย ไม่เก็บข้อความลูกค้า prompt หรือ secret</p>

        {detail.events.length ? (
          <ol className="mt-5 space-y-3">
            {detail.events.map((event, index) => {
              const current = index === detail.events.length - 1 && !detail.terminal;
              return (
                <li key={event.eventId} className="flex gap-3">
                  <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${current ? "animate-pulse bg-[#e0c985]" : "bg-white/30"}`} aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white/85">{statusLabel(event.status)} · {event.stage}</p>
                    <p className="mt-1 text-xs text-white/40">
                      ครั้งที่ {event.attempt} · {new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "medium", timeZone: "Asia/Bangkok" }).format(new Date(event.occurredAt))}
                    </p>
                    {event.errorCategory ? <p className="mt-1 break-all font-mono text-xs text-rose-100/70">{event.errorCategory}</p> : null}
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="mt-4 text-sm text-white/45">ยังไม่มี event history ที่อ่านได้</p>
        )}
      </section>
    </div>
  );
}
