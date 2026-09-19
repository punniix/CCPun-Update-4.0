"use client";

import { useState } from "react";
import type { GscDashboardRow, GscMetricTotals } from "@/lib/admin/seo-intelligence/contracts";

type DateRange = { startDate: string; endDate: string };
type SyncResult = {
  state: "ready" | "partial";
  fetchedAt: string;
  dateRange: DateRange;
  comparisonRange: DateRange;
  current: GscMetricTotals;
  comparison: GscMetricTotals | null;
  rows: GscDashboardRow[];
  signals: GscDashboardRow[];
  truncated: boolean;
  limitations: string[];
};

const errorMessage: Record<string, string> = {
  "provider-auth-required": "สิทธิ์ Search Console หมดอายุ กรุณาเชื่อมใหม่",
  "provider-rate-limited": "Search Console จำกัดการเรียก กรุณารอแล้วลองใหม่",
  "provider-timeout": "Search Console ตอบช้าเกินกำหนด กรุณาลองใหม่",
  "provider-invalid-response": "ข้อมูลจาก Search Console ไม่อยู่ในรูปแบบที่รองรับ",
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

function positionDelta(current: number | null, previous: number | null) {
  if (current === null || previous === null) return "ไม่มีช่วงเทียบ";
  const value = previous - current;
  if (Math.abs(value) < 0.05) return "อันดับใกล้เคียงเดิม";
  return `${value > 0 ? "ดีขึ้น" : "ลดลง"} ${Math.abs(value).toFixed(1)} อันดับ`;
}

function nextCheck(row: GscDashboardRow) {
  if (!row.previous) return "ควรตรวจว่าหน้านี้ตอบสิ่งที่ผู้ใช้ต้องการจากคำค้นหรือไม่";
  if (row.current.clicks < row.previous.clicks) return "ควรตรวจ CTR, อันดับ และเนื้อหาที่เปลี่ยนในหน้านี้";
  if (row.current.impressions > row.previous.impressions && row.current.ctr < row.previous.ctr) return "คนเห็นเพิ่มแต่อัตราคลิกลดลง ควรตรวจชื่อเรื่อง คำอธิบาย และความตรงกับสิ่งที่ค้นหา";
  if (row.current.position >= 4 && row.current.position <= 15) return "อันดับอยู่ช่วง 4–15 ควรตรวจ content gap และ internal links";
  return "ควรตรวจว่าการเติบโตมาจากความต้องการแบบใดหรือหัวข้อย่อยใด";
}

export default function GscManualSync({ defaultStartDate, defaultEndDate, laneLabel }: { defaultStartDate: string; defaultEndDate: string; laneLabel: "ระบบจริง" | "UAT" }) {
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<SyncResult | null>(null);
  const topRows = result?.rows.slice(0, 10) ?? [];
  const maxImpressions = Math.max(0, ...topRows.flatMap((row) => [row.current.impressions, row.previous?.impressions ?? 0]));

  async function sync() {
    if (state === "running") return;
    setState("running");
    setMessage("");
    setResult(null);
    try {
      const response = await fetch("/api/admin/seo/opportunities/sync/gsc/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(payload?.error === "provider-not-connected"
          ? `ยังไม่ได้เชื่อม Search Console สำหรับ ${laneLabel}`
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
    <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5" aria-labelledby="gsc-title">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 id="gsc-title" className="text-xl font-semibold">Google Search Console</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">ดูผลจากการค้นหาธรรมชาติเทียบกับช่วงก่อนหน้าที่ยาวเท่ากัน ระบบอ่านอย่างเดียวและไม่บันทึกลงฐานข้อมูลหรือ Sanity</p>
          {result ? <p className="mt-2 text-xs leading-5 text-white/45">ดึงข้อมูลล่าสุดเมื่อ {fetchedLabel(result.fetchedAt)} · ช่วง {rangeLabel(result.dateRange)} · เทียบ {rangeLabel(result.comparisonRange)}</p> : null}
        </div>
        <div className="grid w-full min-w-0 grid-cols-2 items-end gap-3 lg:w-auto">
          <label className="min-w-0 text-xs text-white/60">เริ่ม
            <input type="date" value={startDate} max={endDate} onChange={(event) => setStartDate(event.target.value)} className="mt-1 block min-h-11 w-full min-w-0 rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white" />
          </label>
          <label className="min-w-0 text-xs text-white/60">สิ้นสุด
            <input type="date" value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} className="mt-1 block min-h-11 w-full min-w-0 rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white" />
          </label>
          <button type="button" onClick={sync} disabled={state === "running" || !startDate || !endDate} className="col-span-2 min-h-11 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 lg:col-span-1 lg:w-auto">
            {state === "running" ? "กำลังดึงข้อมูล…" : "ดึงข้อมูลจาก Search Console"}
          </button>
        </div>
      </div>

      <p aria-live="polite" className="mt-3 min-h-5 text-sm text-white/55">{state === "running" ? "กำลังดึงข้อมูลจริงจาก Search Console" : state === "done" ? "ดึงข้อมูลสำเร็จ" : ""}</p>
      {message ? <p role="alert" className="mt-1 text-sm text-red-200">{message}</p> : null}

      {result ? (
        <div className="mt-4 space-y-5">
          <dl className="grid overflow-hidden rounded-2xl border border-white/10 bg-black/10 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "ยอดคลิก", value: result.current.clicks.toLocaleString("th-TH"), comparison: countDelta(result.current.clicks, result.comparison?.clicks ?? null) },
              { label: "จำนวนครั้งที่แสดง", value: result.current.impressions.toLocaleString("th-TH"), comparison: countDelta(result.current.impressions, result.comparison?.impressions ?? null) },
              { label: "อัตราการคลิก", value: `${(result.current.ctr * 100).toFixed(1)}%`, comparison: pointDelta(result.current.ctr, result.comparison?.ctr ?? null) },
              { label: "อันดับเฉลี่ย", value: result.current.position === null ? "—" : result.current.position.toFixed(1), comparison: positionDelta(result.current.position, result.comparison?.position ?? null) },
            ].map((metric) => (
              <div key={metric.label} className="border-b border-white/10 p-4 last:border-b-0 sm:[&:nth-child(odd)]:border-r xl:border-b-0 xl:border-r xl:last:border-r-0">
                <dt className="text-xs text-white/65">{metric.label}</dt>
                <dd className="mt-1 text-2xl font-semibold text-white/90">{metric.value}</dd>
                <dd className="mt-1 text-xs text-white/55">{metric.comparison}</dd>
              </div>
            ))}
          </dl>

          {result.signals.length ? (
            <section aria-labelledby="gsc-signals-title">
              <h3 id="gsc-signals-title" className="font-semibold">การเปลี่ยนแปลงเด่นจากแถวที่จับคู่ตรงกัน</h3>
              <p className="mt-1 text-xs text-white/45">เรียงจากความต่างของยอดคลิกสูงสุด ไม่ใช่ข้อสรุปสาเหตุหรือคำสั่งแก้ไข</p>
              <div className="mt-3 grid gap-2 lg:grid-cols-3">
                {result.signals.map((row) => (
                  <article key={`${row.dimensions.query}:${row.dimensions.page}`} className="rounded-xl border border-white/10 bg-black/10 p-3">
                    <div className="truncate text-sm text-white/85" title={row.dimensions.query}>{row.dimensions.query}</div>
                    <div className="mt-1 truncate text-xs text-white/40" title={row.dimensions.page}>{row.dimensions.page}</div>
                    <div className="mt-3 text-sm font-semibold text-primary">ยอดคลิก {countDelta(row.current.clicks, row.previous?.clicks ?? null)}</div>
                    <div className="mt-1 text-xs text-white/65">จำนวนครั้งที่แสดง {countDelta(row.current.impressions, row.previous?.impressions ?? null)}</div>
                    <p className="mt-2 text-xs leading-5 text-white/75">{nextCheck(row)}</p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <section aria-labelledby="gsc-details-title">
            <h3 id="gsc-details-title" className="font-semibold">10 คำค้นและหน้าที่แสดงในผลค้นหามากที่สุด</h3>
            {topRows.length ? (
              <ol className="mt-3 divide-y divide-white/10 rounded-2xl border border-white/10 bg-black/10 px-3 sm:px-4">
                {topRows.map((row) => {
                  const currentWidth = maxImpressions ? (row.current.impressions / maxImpressions) * 100 : 0;
                  const previousWidth = maxImpressions ? ((row.previous?.impressions ?? 0) / maxImpressions) * 100 : 0;
                  return (
                    <li key={`${row.dimensions.query}:${row.dimensions.page}`} className="py-4">
                      <div className="min-w-0">
                        <div className="truncate text-sm text-white/85" title={row.dimensions.query}>{row.dimensions.query}</div>
                        <div className="mt-1 truncate text-xs text-white/40" title={row.dimensions.page}>{row.dimensions.page}</div>
                      </div>
                      <div className="mt-3 grid grid-cols-[4.5rem_1fr_auto] items-center gap-2 text-xs">
                        <span className="text-white/65">ช่วงนี้</span><div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-primary" style={{ width: `${currentWidth}%` }} /></div><span>{row.current.impressions.toLocaleString("th-TH")}</span>
                        <span className="text-white/65">ช่วงก่อน</span><div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-white/35" style={{ width: `${previousWidth}%` }} /></div><span>{row.previous ? row.previous.impressions.toLocaleString("th-TH") : "—"}</span>
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs sm:grid-cols-4">
                        <div><dt className="text-white/40">ยอดคลิก</dt><dd className="text-white/75">{row.current.clicks.toLocaleString("th-TH")} · {countDelta(row.current.clicks, row.previous?.clicks ?? null)}</dd></div>
                        <div><dt className="text-white/40">จำนวนครั้งที่แสดง</dt><dd className="text-white/75">{row.current.impressions.toLocaleString("th-TH")} · {countDelta(row.current.impressions, row.previous?.impressions ?? null)}</dd></div>
                        <div><dt className="text-white/40">อัตราการคลิก</dt><dd className="text-white/75">{(row.current.ctr * 100).toFixed(1)}% · {pointDelta(row.current.ctr, row.previous?.ctr ?? null)}</dd></div>
                        <div><dt className="text-white/40">อันดับ</dt><dd className="text-white/75">{row.current.position.toFixed(1)} · {positionDelta(row.current.position, row.previous?.position ?? null)}</dd></div>
                      </dl>
                    </li>
                  );
                })}
              </ol>
            ) : <p className="mt-3 text-sm text-white/55">ช่วงวันที่เลือกไม่มีคำค้นหรือหน้าที่นำมาแสดงได้</p>}
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
