"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  cancelSocialPublication,
  executeSocialPublication,
  rescheduleSocialPublication,
} from "./social-operation-client";

const BANGKOK_OFFSET = "+07:00";
const dateTime = new Intl.DateTimeFormat("th-TH", {
  timeZone: "Asia/Bangkok",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const dateInput = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const timeInput = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Bangkok",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

type QueueItem = {
  publicationId: string;
  variantId: string;
  title: string;
  platform: "facebook" | "instagram";
  format: string;
  executionTarget: string;
  status: string;
  publicationStatus: string;
  jobStatus: string;
  scheduledAt: string | null;
  attemptCount: number;
  maxAttempts: number;
  lastErrorCategory: string | null;
  leaseState: "none" | "active" | "expired";
  jobVersion: number;
  approvedRevision: string | null;
  approvedVersion: number | null;
  updatedAt: string;
  capabilities: {
    executeNow: boolean;
    retry: boolean;
    cancel: boolean;
    reschedule: boolean;
    reconcile: boolean;
  };
};

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    queued: "Queued",
    processing: "Processing",
    "native-scheduled": "Native scheduled",
    failed: "Failed",
    retryable: "Retryable",
    "retry-exhausted": "Retry exhausted",
    "needs-reconciliation": "Needs reconciliation",
    cancelled: "Cancelled",
    published: "Published",
  };
  return labels[status] ?? status;
}

function canExecuteWithoutInteractiveMedia(item: QueueItem) {
  return item.capabilities.executeNow && ["text-post", "link-post"].includes(item.format);
}

function toDateInput(value: string) {
  const parts = dateInput.formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export default function SocialQueueClient({ initialItems }: { initialItems: QueueItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [platform, setPlatform] = useState("all");
  const [status, setStatus] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nextDate, setNextDate] = useState("");
  const [nextTime, setNextTime] = useState("09:00");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const selected = items.find((item) => item.publicationId === selectedId) ?? null;
  const statuses = [...new Set(items.map((item) => item.status))].sort();
  const filtered = useMemo(() => items.filter((item) => {
    if (platform !== "all" && item.platform !== platform) return false;
    if (status !== "all" && item.status !== status) return false;
    return true;
  }), [items, platform, status]);

  function patchItem(publicationId: string, patch: Partial<QueueItem>) {
    setItems((current) => current.map((item) => item.publicationId === publicationId ? { ...item, ...patch } : item));
  }

  function openReschedule(item: QueueItem) {
    setSelectedId(item.publicationId);
    setNextDate(item.scheduledAt ? toDateInput(item.scheduledAt) : toDateInput(new Date().toISOString()));
    setNextTime(item.scheduledAt ? timeInput.format(new Date(item.scheduledAt)) : "09:00");
    setFeedback(null);
  }

  async function runExecute(item: QueueItem) {
    setBusyId(item.publicationId);
    setFeedback(null);
    try {
      await executeSocialPublication({ publicationId: item.publicationId, expectedJobVersion: item.jobVersion });
      setFeedback(`${item.title}: execution engine รับงานแล้ว`);
    } catch (error) {
      setFeedback(error instanceof Error ? `${item.title}: ${error.message}` : `${item.title}: execute ไม่สำเร็จ`);
    } finally {
      setBusyId(null);
    }
  }

  async function runCancel(item: QueueItem) {
    setBusyId(item.publicationId);
    setFeedback(null);
    try {
      const result = await cancelSocialPublication({ publicationId: item.publicationId, expectedJobVersion: item.jobVersion });
      patchItem(item.publicationId, {
        jobVersion: result.jobVersion,
        status: "cancelled",
        publicationStatus: "cancelled",
        jobStatus: "cancelled",
        leaseState: "none",
      });
      setFeedback(`${item.title}: cancelled`);
    } catch (error) {
      setFeedback(error instanceof Error ? `${item.title}: ${error.message}` : `${item.title}: cancel ไม่สำเร็จ`);
    } finally {
      setBusyId(null);
    }
  }

  async function runReschedule(item: QueueItem) {
    setBusyId(item.publicationId);
    setFeedback(null);
    try {
      const scheduledAt = new Date(`${nextDate}T${nextTime}:00${BANGKOK_OFFSET}`).toISOString();
      const result = await rescheduleSocialPublication({
        publicationId: item.publicationId,
        expectedJobVersion: item.jobVersion,
        scheduledAt,
      });
      patchItem(item.publicationId, {
        jobVersion: result.jobVersion,
        scheduledAt: result.scheduledAt ?? scheduledAt,
        status: "queued",
        publicationStatus: "approved",
        jobStatus: "queued",
        leaseState: "none",
        lastErrorCategory: null,
      });
      setSelectedId(null);
      setFeedback(`${item.title}: rescheduled`);
    } catch (error) {
      setFeedback(error instanceof Error ? `${item.title}: ${error.message}` : `${item.title}: reschedule ไม่สำเร็จ`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mt-7">
      <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Execution queue</h2>
            <p className="mt-1 text-xs text-white/45">Neon publication/job state · Asia/Bangkok</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="sr-only" htmlFor="queue-platform">Platform</label>
            <select id="queue-platform" value={platform} onChange={(event) => setPlatform(event.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-navy-800 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#e0c985]">
              <option value="all">All platforms</option>
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
            </select>
            <label className="sr-only" htmlFor="queue-status">Status</label>
            <select id="queue-status" value={status} onChange={(event) => setStatus(event.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-navy-800 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#e0c985]">
              <option value="all">All statuses</option>
              {statuses.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}
            </select>
          </div>
        </div>
      </section>

      {feedback ? <p role="status" aria-live="polite" className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/70">{feedback}</p> : null}

      <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
        <table className="min-w-[1050px] w-full border-collapse text-left text-sm">
          <thead className="bg-white/[0.035] text-xs text-white/45">
            <tr>
              <th className="px-4 py-3 font-medium">Post</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Scheduled</th>
              <th className="px-4 py-3 font-medium">Attempts</th>
              <th className="px-4 py-3 font-medium">Lease</th>
              <th className="px-4 py-3 font-medium">Last error</th>
              <th className="px-4 py-3 font-medium">Updated</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.08]">
            {filtered.map((item) => {
              const busy = busyId === item.publicationId;
              const canExecute = canExecuteWithoutInteractiveMedia(item);
              return (
                <tr key={item.publicationId} className="align-top hover:bg-white/[0.02]">
                  <td className="px-4 py-4">
                    <div className="max-w-xs font-medium text-white/85">{item.title}</div>
                    <div className="mt-1 text-xs text-white/40">{item.platform} · {item.format}</div>
                    <details className="mt-2 text-[11px] text-white/35">
                      <summary className="cursor-pointer rounded focus:outline-none focus:ring-2 focus:ring-[#e0c985]">Publication ID</summary>
                      <code className="mt-1 block max-w-xs break-all">{item.publicationId}</code>
                    </details>
                  </td>
                  <td className="px-4 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs ${item.status === "needs-reconciliation" || item.status === "failed" || item.status === "retry-exhausted" ? "border-amber-200/20 bg-amber-200/[0.05] text-amber-50/80" : "border-white/10 bg-white/[0.03] text-white/70"}`}>{statusLabel(item.status)}</span></td>
                  <td className="px-4 py-4 text-xs text-white/60">{item.scheduledAt ? dateTime.format(new Date(item.scheduledAt)) : "—"}</td>
                  <td className="px-4 py-4 text-xs text-white/60">{item.attemptCount} / {item.maxAttempts}</td>
                  <td className="px-4 py-4 text-xs text-white/60">{item.leaseState}</td>
                  <td className="px-4 py-4 text-xs text-white/60">{item.lastErrorCategory ?? "—"}</td>
                  <td className="px-4 py-4 text-xs text-white/50">{dateTime.format(new Date(item.updatedAt))}</td>
                  <td className="px-4 py-4">
                    <div className="flex max-w-sm flex-wrap gap-2">
                      {canExecute ? <button type="button" disabled={busy} onClick={() => void runExecute(item)} className="min-h-11 rounded-xl border border-[#e0c985]/30 px-3 text-xs text-[#f4df9b] hover:bg-[#e0c985]/10 focus:outline-none focus:ring-2 focus:ring-[#e0c985] disabled:opacity-40">{item.capabilities.retry ? "Retry" : "Execute now"}</button> : null}
                      {item.capabilities.reschedule ? <button type="button" disabled={busy} onClick={() => openReschedule(item)} className="min-h-11 rounded-xl border border-white/10 px-3 text-xs text-white/70 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[#e0c985] disabled:opacity-40">Reschedule</button> : null}
                      {item.capabilities.cancel ? <button type="button" disabled={busy} onClick={() => void runCancel(item)} className="min-h-11 rounded-xl border border-red-300/20 px-3 text-xs text-red-100/75 hover:bg-red-300/10 focus:outline-none focus:ring-2 focus:ring-[#e0c985] disabled:opacity-40">Cancel</button> : null}
                      <Link href="/social/posts/" className="inline-flex min-h-11 items-center rounded-xl border border-white/10 px-3 text-xs text-white/65 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[#e0c985]">Open post</Link>
                      {item.capabilities.reconcile ? <span className="inline-flex min-h-11 items-center rounded-xl border border-amber-200/20 px-3 text-xs text-amber-50/75">Reconcile / Needs attention</span> : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 ? <div className="mt-4 rounded-2xl border border-dashed border-white/10 p-6 text-sm text-white/55">ไม่มี job ที่ตรงกับ filter นี้</div> : null}

      {selected ? (
        <div role="dialog" aria-modal="true" aria-labelledby="queue-reschedule-title" className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget && !busyId) setSelectedId(null); }}>
          <div className="w-full max-w-md rounded-t-3xl border border-white/10 bg-navy-800 p-5 shadow-2xl sm:rounded-3xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">RESCHEDULE · ASIA/BANGKOK</p>
                <h2 id="queue-reschedule-title" className="mt-2 text-lg font-semibold text-white">{selected.title}</h2>
              </div>
              <button type="button" disabled={Boolean(busyId)} onClick={() => setSelectedId(null)} className="min-h-11 min-w-11 rounded-xl text-white/60 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[#e0c985]">×<span className="sr-only">ปิด</span></button>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-white/55">วันที่
                <input type="date" value={nextDate} onChange={(event) => setNextDate(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-navy-900 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#e0c985]" />
              </label>
              <label className="text-xs text-white/55">เวลา
                <input type="time" value={nextTime} onChange={(event) => setNextTime(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-navy-900 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#e0c985]" />
              </label>
            </div>
            <button type="button" disabled={Boolean(busyId)} onClick={() => void runReschedule(selected)} className="mt-4 min-h-11 w-full rounded-xl bg-[#e0c985] px-4 text-sm font-semibold text-navy-900 hover:bg-[#f4df9b] focus:outline-none focus:ring-2 focus:ring-white disabled:opacity-40">บันทึกเวลาใหม่</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
