"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  cancelSocialPublication,
  executeSocialPublication,
  rescheduleSocialPublication,
} from "./social-operation-client";

const BANGKOK_TIME_ZONE = "Asia/Bangkok";
const BANGKOK_OFFSET = "+07:00";

type OperationalItem = {
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

type CalendarView = "month" | "week";

const dateParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: BANGKOK_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const timeParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: BANGKOK_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const displayDate = new Intl.DateTimeFormat("th-TH", {
  timeZone: BANGKOK_TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function dateKey(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = dateParts.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function timeKey(value: string) {
  return timeParts.format(new Date(value));
}

function parseDateKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function makeDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(key: string, amount: number) {
  const date = parseDateKey(key);
  date.setUTCDate(date.getUTCDate() + amount);
  return makeDateKey(date);
}

function startOfWeek(key: string) {
  const date = parseDateKey(key);
  const day = date.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return addDays(key, mondayOffset);
}

function shiftMonth(key: string, amount: number) {
  const date = parseDateKey(key);
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + amount);
  return makeDateKey(date);
}

function monthGrid(key: string) {
  const anchor = parseDateKey(key);
  const first = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
  const start = startOfWeek(makeDateKey(first));
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

function weekGrid(key: string) {
  const start = startOfWeek(key);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

function dateHeading(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric" })
    .format(new Date(Date.UTC(year, month - 1, day)));
}

function viewHeading(key: string, view: CalendarView) {
  const date = parseDateKey(key);
  if (view === "month") {
    return new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric" }).format(date);
  }
  const start = startOfWeek(key);
  const end = addDays(start, 6);
  return `${dateHeading(start)} – ${dateHeading(end)}`;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    queued: "รอส่ง",
    processing: "กำลังส่ง",
    "native-scheduled": "ตั้งเวลาที่แพลตฟอร์มแล้ว",
    failed: "ไม่สำเร็จ",
    retryable: "รอลองใหม่",
    "retry-exhausted": "ลองครบแล้ว ต้องตรวจ",
    "needs-reconciliation": "สถานะยังไม่ชัด ต้องตรวจอีกครั้ง",
    cancelled: "ยกเลิกแล้ว",
    published: "เผยแพร่แล้ว",
  };
  return labels[status] ?? status;
}

function canExecuteWithoutInteractiveMedia(item: OperationalItem) {
  return item.capabilities.executeNow && ["text-post", "link-post"].includes(item.format);
}

export default function SocialOperationalCalendar({ initialItems }: { initialItems: OperationalItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [view, setView] = useState<CalendarView>("month");
  const [anchor, setAnchor] = useState(() => dateKey(new Date()));
  const [platform, setPlatform] = useState("all");
  const [status, setStatus] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formDate, setFormDate] = useState("");
  const [formTime, setFormTime] = useState("09:00");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const selected = items.find((item) => item.publicationId === selectedId) ?? null;
  const filtered = useMemo(() => items.filter((item) => {
    if (!item.scheduledAt) return false;
    if (platform !== "all" && item.platform !== platform) return false;
    if (status !== "all" && item.status !== status) return false;
    return true;
  }), [items, platform, status]);
  const days = view === "month" ? monthGrid(anchor) : weekGrid(anchor);
  const currentMonth = parseDateKey(anchor).getUTCMonth();
  const statuses = [...new Set(items.map((item) => item.status))].sort();

  useEffect(() => {
    if (!selectedId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedId]);

  function openDetails(item: OperationalItem) {
    setFormDate(item.scheduledAt ? dateKey(item.scheduledAt) : dateKey(new Date()));
    setFormTime(item.scheduledAt ? timeKey(item.scheduledAt) : "09:00");
    setFeedback(null);
    setSelectedId(item.publicationId);
    requestAnimationFrame(() => closeRef.current?.focus());
  }

  function patchItem(publicationId: string, patch: Partial<OperationalItem>) {
    setItems((current) => current.map((item) => item.publicationId === publicationId ? { ...item, ...patch } : item));
  }

  async function performReschedule(item: OperationalItem, nextDate: string, nextTime: string) {
    setBusy(true);
    setFeedback(null);
    try {
      const scheduledAt = new Date(`${nextDate}T${nextTime}:00${BANGKOK_OFFSET}`).toISOString();
      const result = await rescheduleSocialPublication({
        publicationId: item.publicationId,
        expectedJobVersion: item.jobVersion,
        scheduledAt,
      });
      patchItem(item.publicationId, {
        scheduledAt: result.scheduledAt ?? scheduledAt,
        jobVersion: result.jobVersion,
        status: "queued",
        publicationStatus: "approved",
        jobStatus: "queued",
        leaseState: "none",
        lastErrorCategory: null,
      });
      setFeedback("อัปเดตเวลาแล้ว");
    } catch (error) {
      setFeedback(error instanceof Error ? `อัปเดตไม่สำเร็จ: ${error.message}` : "อัปเดตไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function performCancel(item: OperationalItem) {
    setBusy(true);
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
      setFeedback("ยกเลิกเวลาที่ตั้งไว้แล้ว");
    } catch (error) {
      setFeedback(error instanceof Error ? `ยกเลิกไม่สำเร็จ: ${error.message}` : "ยกเลิกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function performExecute(item: OperationalItem) {
    setBusy(true);
    setFeedback(null);
    try {
      await executeSocialPublication({ publicationId: item.publicationId, expectedJobVersion: item.jobVersion });
      setFeedback("ระบบรับงานแล้ว กรุณารีเฟรชเพื่อดูสถานะล่าสุด");
    } catch (error) {
      setFeedback(error instanceof Error ? `ส่งงานไม่สำเร็จ: ${error.message}` : "ส่งงานไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  function onDrop(day: string, publicationId: string) {
    const item = items.find((candidate) => candidate.publicationId === publicationId);
    if (!item?.scheduledAt || !item.capabilities.reschedule || busy) return;
    void performReschedule(item, day, timeKey(item.scheduledAt));
  }

  return (
    <div className="mt-7">
      <p id="calendar-drag-help" className="sr-only">ลากรายการไปวันใหม่ได้เมื่อสถานะอนุญาต หรือเปิดรายละเอียดแล้วใช้ช่องวันที่และเวลาเป็นทางเลือกด้วยคีย์บอร์ด</p>
      <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setAnchor(dateKey(new Date()))} className="min-h-11 rounded-xl border border-white/10 px-3.5 text-sm text-white/75 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[#e0c985]">วันนี้</button>
              <button type="button" aria-label={view === "month" ? "เดือนก่อนหน้า" : "สัปดาห์ก่อนหน้า"} onClick={() => setAnchor(view === "month" ? shiftMonth(anchor, -1) : addDays(anchor, -7))} className="min-h-11 min-w-11 rounded-xl border border-white/10 text-white/70 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[#e0c985]">←</button>
              <button type="button" aria-label={view === "month" ? "เดือนถัดไป" : "สัปดาห์ถัดไป"} onClick={() => setAnchor(view === "month" ? shiftMonth(anchor, 1) : addDays(anchor, 7))} className="min-h-11 min-w-11 rounded-xl border border-white/10 text-white/70 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[#e0c985]">→</button>
              <h2 className="ml-1 text-lg font-semibold text-white">{viewHeading(anchor, view)}</h2>
            </div>
            <p className="mt-2 text-xs text-white/45">เวลาไทย (UTC+7)</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="inline-flex rounded-xl border border-white/10 p-1" aria-label="มุมมองปฏิทิน">
              {(["month", "week"] as const).map((option) => (
                <button key={option} type="button" aria-pressed={view === option} onClick={() => setView(option)} className={`min-h-11 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#e0c985] ${view === option ? "bg-[#e0c985]/15 text-[#f4df9b]" : "text-white/60 hover:text-white"}`}>{option === "month" ? "เดือน" : "สัปดาห์"}</button>
              ))}
            </div>
            <label className="sr-only" htmlFor="calendar-platform">แพลตฟอร์ม</label>
            <select id="calendar-platform" value={platform} onChange={(event) => setPlatform(event.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-navy-800 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#e0c985]">
              <option value="all">ทุกแพลตฟอร์ม</option>
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
            </select>
            <label className="sr-only" htmlFor="calendar-status">สถานะ</label>
            <select id="calendar-status" value={status} onChange={(event) => setStatus(event.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-navy-800 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#e0c985]">
              <option value="all">ทุกสถานะ</option>
              {statuses.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}
            </select>
          </div>
        </div>
      </section>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10 bg-navy-800/40">
        <div className={`grid min-w-[760px] ${view === "month" ? "grid-cols-7" : "grid-cols-7"}`}>
          {days.slice(0, 7).map((day) => (
            <div key={`heading-${day}`} className="border-b border-white/10 px-3 py-2 text-xs font-medium text-white/45">
              {new Intl.DateTimeFormat("th-TH", { weekday: "short" }).format(parseDateKey(day))}
            </div>
          ))}
          {days.map((day) => {
            const dayItems = filtered.filter((item) => item.scheduledAt && dateKey(item.scheduledAt) === day);
            const inMonth = view === "week" || parseDateKey(day).getUTCMonth() === currentMonth;
            const today = day === dateKey(new Date());
            return (
              <div
                key={day}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  onDrop(day, event.dataTransfer.getData("text/ccpun-social-publication"));
                }}
                className={`min-h-36 border-b border-r border-white/[0.08] p-2.5 ${inMonth ? "bg-transparent" : "bg-black/[0.08] text-white/35"}`}
                aria-label={dateHeading(day)}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className={`inline-flex min-h-7 min-w-7 items-center justify-center rounded-full text-xs ${today ? "bg-[#e0c985] font-semibold text-navy-900" : "text-white/55"}`}>{Number(day.slice(-2))}</span>
                  {dayItems.length > 0 ? <span className="text-[10px] text-white/35">{dayItems.length}</span> : null}
                </div>
                <div className="space-y-2">
                  {dayItems.map((item) => (
                    <div
                      key={item.publicationId}
                      draggable={item.capabilities.reschedule}
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/ccpun-social-publication", item.publicationId);
                        event.dataTransfer.effectAllowed = "move";
                      }}
                      aria-describedby="calendar-drag-help"
                      className={`rounded-xl border p-2 ${item.capabilities.reschedule ? "cursor-grab border-[#e0c985]/20 bg-[#e0c985]/[0.045]" : "border-white/10 bg-white/[0.025]"}`}
                    >
                      <button type="button" onClick={() => openDetails(item)} className="block w-full rounded-md text-left focus:outline-none focus:ring-2 focus:ring-[#e0c985]">
                        <span className="block truncate text-xs font-medium text-white/85">{item.title}</span>
                        <span className="mt-1 flex items-center justify-between gap-2 text-[10px] text-white/45">
                          <span>{item.scheduledAt ? timeKey(item.scheduledAt) : "—"}</span>
                          <span>{item.platform === "facebook" ? "FB" : "IG"}</span>
                        </span>
                        <span className="mt-1 block text-[10px] text-[#f4df9b]/70">{statusLabel(item.status)}</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-white/10 p-6 text-sm text-white/55">ไม่มีโพสต์ที่ตั้งเวลาและตรงกับตัวกรองนี้</div>
      ) : null}

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="calendar-item-title" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setSelectedId(null); }}>
          <div className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl border border-white/10 bg-navy-800 p-5 shadow-2xl sm:rounded-3xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">{selected.platform.toUpperCase()} · {statusLabel(selected.status)}</p>
                <h2 id="calendar-item-title" className="mt-2 text-xl font-semibold text-white">{selected.title}</h2>
                <p className="mt-2 break-all text-xs text-white/40">{selected.publicationId}</p>
              </div>
              <button ref={closeRef} type="button" disabled={busy} onClick={() => setSelectedId(null)} className="min-h-11 min-w-11 rounded-xl text-white/60 hover:bg-white/5 hover:text-white focus:outline-none focus:ring-2 focus:ring-[#e0c985]">×<span className="sr-only">ปิดรายละเอียด</span></button>
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-white/10 p-3"><dt className="text-xs text-white/40">เวลาที่ตั้ง</dt><dd className="mt-1 text-white/80">{selected.scheduledAt ? displayDate.format(new Date(selected.scheduledAt)) : "—"}</dd></div>
              <div className="rounded-xl border border-white/10 p-3"><dt className="text-xs text-white/40">จำนวนครั้ง</dt><dd className="mt-1 text-white/80">{selected.attemptCount} / {selected.maxAttempts}</dd></div>
              <div className="rounded-xl border border-white/10 p-3"><dt className="text-xs text-white/40">กำลังทำงาน</dt><dd className="mt-1 text-white/80">{selected.leaseState === "active" ? "ใช่" : selected.leaseState === "expired" ? "หมดเวลา ต้องตรวจ" : "ไม่"}</dd></div>
              <div className="rounded-xl border border-white/10 p-3"><dt className="text-xs text-white/40">ปัญหาล่าสุด</dt><dd className="mt-1 text-white/80">{selected.lastErrorCategory ? "มีรายละเอียดให้ตรวจ" : "—"}</dd></div>
            </dl>

            {selected.capabilities.reschedule ? (
              <fieldset className="mt-5 rounded-2xl border border-white/10 p-4" disabled={busy}>
                <legend className="px-1 text-sm font-medium text-white/80">เปลี่ยนเวลา</legend>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <label className="text-xs text-white/55">วันที่
                    <input type="date" value={formDate} onChange={(event) => setFormDate(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-navy-900 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#e0c985]" />
                  </label>
                  <label className="text-xs text-white/55">เวลาไทย
                    <input type="time" value={formTime} onChange={(event) => setFormTime(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-navy-900 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#e0c985]" />
                  </label>
                </div>
                <button type="button" onClick={() => void performReschedule(selected, formDate, formTime)} className="mt-3 min-h-11 w-full rounded-xl bg-[#e0c985] px-4 text-sm font-semibold text-navy-900 hover:bg-[#f4df9b] focus:outline-none focus:ring-2 focus:ring-white disabled:opacity-50">บันทึกเวลาใหม่</button>
              </fieldset>
            ) : null}

            {feedback ? <p role="status" className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/70">{feedback}</p> : null}

            <div className="mt-5 flex flex-wrap gap-2 border-t border-white/10 pt-4">
              {canExecuteWithoutInteractiveMedia(selected) ? <button type="button" disabled={busy} onClick={() => void performExecute(selected)} className="min-h-11 rounded-xl border border-[#e0c985]/35 px-4 text-sm text-[#f4df9b] hover:bg-[#e0c985]/10 focus:outline-none focus:ring-2 focus:ring-[#e0c985] disabled:opacity-50">ส่งตอนนี้</button> : null}
              {selected.capabilities.cancel ? <button type="button" disabled={busy} onClick={() => void performCancel(selected)} className="min-h-11 rounded-xl border border-red-300/20 px-4 text-sm text-red-100/80 hover:bg-red-300/10 focus:outline-none focus:ring-2 focus:ring-[#e0c985] disabled:opacity-50">ยกเลิกเวลาที่ตั้งไว้</button> : null}
              <Link href="/social/posts/" className="inline-flex min-h-11 items-center rounded-xl border border-white/10 px-4 text-sm text-white/70 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[#e0c985]">เปิดโพสต์</Link>
              {selected.capabilities.reconcile ? <Link href="/social/queue/" className="inline-flex min-h-11 items-center rounded-xl border border-amber-200/25 px-4 text-sm text-amber-50/80 hover:bg-amber-200/[0.06] focus:outline-none focus:ring-2 focus:ring-[#e0c985]">สถานะยังไม่ชัด ต้องตรวจ</Link> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
