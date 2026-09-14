"use client";

import { useState } from "react";
import type { Ga4DashboardRow, Ga4MetricTotals } from "@/lib/admin/seo-intelligence/contracts";

type DateRange = { startDate: string; endDate: string };
type SyncResult = {
  state: "ready" | "partial";
  fetchedAt: string;
  timeZone: string | null;
  dateRange: DateRange;
  comparisonRange: DateRange;
  current: Ga4MetricTotals;
  comparison: Ga4MetricTotals | null;
  rows: Ga4DashboardRow[];
  signals: Ga4DashboardRow[];
  truncated: boolean;
  limitations: string[];
};

const errorMessage: Record<string, string> = {
  "provider-auth-required": "สิทธิ์ GA4 หมดอายุ กรุณาเชื่อมใหม่",
  "provider-rate-limited": "GA4 จำกัดการเรียก กรุณารอแล้วลองใหม่",
  "provider-timeout": "GA4 ตอบช้าเกินกำหนด กรุณาลองใหม่",
  "provider-invalid-response": "ข้อมูลจาก GA4 ไม่อยู่ในรูปแบบที่รองรับ",
  "sync-in-progress": "มีการ Sync อยู่แล้ว กรุณารอให้เสร็จ",
};

function fetchedLabel(value: string) {
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(value));
}

function rangeLabel(range: DateRange) {
  return `${range.startDate} – ${range.endDate}`;
}

function countDelta(current: number, previous: number | null) {
  if (previous === null) return "ไม่มีช่วงเทียบ";
  if (previous === 0) return current === 0 ? "เท่าเดิม" : "เริ่มมีข้อมูล";
  const value = ((current - previous) / previous) * 100;
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}% จากช่วงก่อน`;
}

function pointDelta(current: number, previous: number | null) {
  if (previous === null) return "ไม่มีช่วงเทียบ";
  const value = (current - previous) * 100;
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)} จุดเปอร์เซ็นต์`;
}

function nextCheck(row: Ga4DashboardRow) {
  if (!row.previous) return "ควรตรวจ intent และ UX ของ landing page นี้";
  if (row.current.sessions > row.previous.sessions && row.current.engagementRate < row.previous.engagementRate) return "Traffic เพิ่มแต่ engagement ลด ควรตรวจ intent, ความเร็ว และ CTA ของหน้า";
  if (row.current.sessions < row.previous.sessions) return "ควรตรวจ query ต้นทาง, อันดับ และการเปลี่ยนแปลงของหน้านี้";
  return "ควรตรวจว่าการเติบโตมาจากเนื้อหาหรือ query กลุ่มใด";
}

export default function Ga4ManualSync({ defaultStartDate, defaultEndDate, laneLabel }: { defaultStartDate: string; defaultEndDate: string; laneLabel: "Production" | "UAT" }) {
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<SyncResult | null>(null);
  const topRows = result?.rows.slice(0, 10) ?? [];
  const maxSessions = Math.max(0, ...topRows.flatMap((row) => [row.current.sessions, row.previous?.sessions ?? 0]));

  async function sync() {
    if (state === "running") return;
    setState("running");
    setMessage("");
    setResult(null);
    try {
      const response = await fetch("/api/admin/seo/opportunities/sync/ga4/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(payload?.error === "provider-not-connected"
          ? `ยังไม่ได้เชื่อม GA4 สำหรับ ${laneLabel}`
          : errorMessage[payload?.error] ?? "Sync ไม่สำเร็จและไม่มีข้อมูลใดถูกบันทึก");
        setState("error");
        return;
      }
      setResult(payload as SyncResult);
      setState("done");
    } catch {
      setMessage("เชื่อมต่อไม่สำเร็จและไม่มีข้อมูลใดถูกบันทึก");
      setState("error");
    }
  }

  return (
    <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5" aria-labelledby="ga4-title">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 id="ga4-title" className="text-xl font-semibold">GA4 · Organic Search</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">ดูคุณภาพ Session จริงของ Organic Search โดยไม่ดึงข้อมูลผู้ใช้ ไม่บันทึก DB/Sanity และไม่แก้ Analytics</p>
          {result ? <p className="mt-2 text-xs leading-5 text-white/45">ดึงข้อมูลล่าสุดเมื่อ {fetchedLabel(result.fetchedAt)} · ช่วง {rangeLabel(result.dateRange)} · เทียบ {rangeLabel(result.comparisonRange)}{result.timeZone ? ` · Data timezone ${result.timeZone}` : ""}</p> : null}
        </div>
        <div className="grid w-full min-w-0 grid-cols-2 items-end gap-3 lg:w-auto">
          <label className="min-w-0 text-xs text-white/60">เริ่ม
            <input type="date" value={startDate} max={endDate} onChange={(event) => setStartDate(event.target.value)} className="mt-1 block min-h-11 w-full min-w-0 rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white" />
          </label>
          <label className="min-w-0 text-xs text-white/60">สิ้นสุด
            <input type="date" value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} className="mt-1 block min-h-11 w-full min-w-0 rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white" />
          </label>
          <button type="button" onClick={sync} disabled={state === "running" || !startDate || !endDate} className="col-span-2 min-h-11 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 lg:col-span-1 lg:w-auto">
            {state === "running" ? "กำลัง Sync…" : "Sync GA4 แบบอ่านอย่างเดียว"}
          </button>
        </div>
      </div>

      <p aria-live="polite" className="mt-3 min-h-5 text-sm text-white/55">{state === "running" ? "กำลังดึงข้อมูลจริงจาก GA4" : state === "done" ? "ดึงข้อมูลสำเร็จ" : ""}</p>
      {message ? <p role="alert" className="mt-1 text-sm text-red-200">{message}</p> : null}

      {result ? (
        <div className="mt-4 space-y-5">
          <dl className="grid overflow-hidden rounded-2xl border border-white/10 bg-black/10 sm:grid-cols-3">
            {[
              { label: "Organic Sessions", value: result.current.sessions.toLocaleString("th-TH"), comparison: countDelta(result.current.sessions, result.comparison?.sessions ?? null) },
              { label: "Engaged Sessions", value: result.current.engagedSessions.toLocaleString("th-TH"), comparison: countDelta(result.current.engagedSessions, result.comparison?.engagedSessions ?? null) },
              { label: "Engagement Rate", value: `${(result.current.engagementRate * 100).toFixed(1)}%`, comparison: pointDelta(result.current.engagementRate, result.comparison?.engagementRate ?? null) },
            ].map((metric) => (
              <div key={metric.label} className="border-b border-white/10 p-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
                <dt className="text-xs text-white/65">{metric.label}</dt>
                <dd className="mt-1 text-2xl font-semibold text-white/90">{metric.value}</dd>
                <dd className="mt-1 text-xs text-white/55">{metric.comparison}</dd>
              </div>
            ))}
          </dl>

          {result.signals.length ? (
            <section aria-labelledby="ga4-signals-title">
              <h3 id="ga4-signals-title" className="font-semibold">การเปลี่ยนแปลงเด่นจากหน้าที่จับคู่ตรงกัน</h3>
              <p className="mt-1 text-xs text-white/45">เรียงจากส่วนต่าง Sessions สูงสุด ไม่ใช่ข้อสรุปสาเหตุหรือคำสั่งแก้ไข</p>
              <div className="mt-3 grid gap-2 lg:grid-cols-3">
                {result.signals.map((row) => (
                  <article key={row.landingPage} className="rounded-xl border border-white/10 bg-black/10 p-3">
                    <div className="truncate text-sm text-white/85" title={row.landingPage}>{row.landingPage}</div>
                    <div className="mt-3 text-sm font-semibold text-primary">Sessions {countDelta(row.current.sessions, row.previous?.sessions ?? null)}</div>
                    <div className="mt-1 text-xs text-white/65">Engagement Rate {pointDelta(row.current.engagementRate, row.previous?.engagementRate ?? null)}</div>
                    <p className="mt-2 text-xs leading-5 text-white/75">{nextCheck(row)}</p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <section aria-labelledby="ga4-details-title">
            <h3 id="ga4-details-title" className="font-semibold">Top 10 Organic landing pages · เรียงตาม Sessions</h3>
            {topRows.length ? (
              <ol className="mt-3 divide-y divide-white/10 rounded-2xl border border-white/10 bg-black/10 px-3 sm:px-4">
                {topRows.map((row) => {
                  const currentWidth = maxSessions ? (row.current.sessions / maxSessions) * 100 : 0;
                  const previousWidth = maxSessions ? ((row.previous?.sessions ?? 0) / maxSessions) * 100 : 0;
                  return (
                    <li key={row.landingPage} className="py-4">
                      <div className="truncate text-sm text-white/85" title={row.landingPage}>{row.landingPage}</div>
                      <div className="mt-3 grid grid-cols-[4.5rem_1fr_auto] items-center gap-2 text-xs">
                        <span className="text-white/65">ช่วงนี้</span><div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-primary" style={{ width: `${currentWidth}%` }} /></div><span>{row.current.sessions.toLocaleString("th-TH")}</span>
                        <span className="text-white/65">ช่วงก่อน</span><div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-white/35" style={{ width: `${previousWidth}%` }} /></div><span>{row.previous ? row.previous.sessions.toLocaleString("th-TH") : "—"}</span>
                      </div>
                      <dl className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
                        <div><dt className="text-white/40">Sessions</dt><dd className="text-white/75">{row.current.sessions.toLocaleString("th-TH")} · {countDelta(row.current.sessions, row.previous?.sessions ?? null)}</dd></div>
                        <div><dt className="text-white/40">Engaged Sessions</dt><dd className="text-white/75">{row.current.engagedSessions.toLocaleString("th-TH")} · {countDelta(row.current.engagedSessions, row.previous?.engagedSessions ?? null)}</dd></div>
                        <div><dt className="text-white/40">Engagement Rate</dt><dd className="text-white/75">{(row.current.engagementRate * 100).toFixed(1)}% · {pointDelta(row.current.engagementRate, row.previous?.engagementRate ?? null)}</dd></div>
                      </dl>
                    </li>
                  );
                })}
              </ol>
            ) : <p className="mt-3 text-sm text-white/55">ช่วงวันที่เลือกไม่มี Organic landing page ที่นำมาแสดงได้</p>}
          </section>

          {result.state === "partial" || result.truncated ? <p className="text-xs leading-5 text-amber-100/80">{result.state === "partial" ? "ช่วงเปรียบเทียบยังดึงไม่สำเร็จ" : ""}{result.state === "partial" && result.truncated ? " · " : ""}{result.truncated ? "รายละเอียดบางส่วนชนขีดจำกัดรอบนี้" : ""}</p> : null}
          <details className="text-xs text-white/60">
            <summary className="cursor-pointer">ข้อจำกัดของข้อมูล</summary>
            <p className="mt-2 leading-5">{result.limitations.join(" · ")}</p>
          </details>
        </div>
      ) : null}
    </section>
  );
}
