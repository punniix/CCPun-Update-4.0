"use client";

/* eslint-disable @next/next/no-img-element -- Provider thumbnail hosts are dynamic runtime data. */

import { useMemo, useState } from "react";
import SocialSheetsExport from "@/features/admin/social/SocialSheetsExport";

type AnalyticsPlatform = "facebook" | "instagram" | "youtube" | "tiktok";
type MetricUnit = "count" | "seconds" | "minutes" | "milliseconds";

type SocialMetric = {
  key: string;
  label: string;
  value: number;
  unit: MetricUnit;
  dimension: string;
  delta: number | null;
};

export type SocialAnalyticsItem = {
  publicationId: string;
  contentId: string | null;
  linkedPublicationId: string | null;
  provider: "meta" | "youtube" | "tiktok";
  platform: AnalyticsPlatform;
  platformObjectId: string;
  fetchedAt: string;
  snapshotCount: number;
  format: string;
  mediaType: string | null;
  title: string | null;
  text: string | null;
  permalink: string | null;
  thumbnail: string | null;
  publishedAt: string | null;
  source: "provider-content" | "publication-snapshot";
  metrics: SocialMetric[];
  limitation: string;
};

const platformLabel: Record<AnalyticsPlatform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
};

const formatLabel: Record<string, string> = {
  "text-post": "ข้อความ",
  "image-post": "ภาพเดี่ยว",
  album: "อัลบั้ม",
  carousel: "คารูเซล",
  reel: "Reel",
  video: "วิดีโอ",
  short: "Short",
  "photo-post": "Photo post",
  live: "Live",
  unknown: "ไม่ระบุ",
};

function metricValue(value: number, unit: MetricUnit) {
  return `${value.toLocaleString("th-TH")}${unit === "seconds" ? " วินาที" : unit === "minutes" ? " นาที" : unit === "milliseconds" ? " มิลลิวินาที" : ""}`;
}

function deltaText(delta: number | null, unit: MetricUnit) {
  if (delta === null) return "รอรอบเปรียบเทียบ";
  if (delta === 0) return "ไม่เปลี่ยนจากรอบก่อน";
  return `${delta > 0 ? "เพิ่ม" : "ลด"} ${metricValue(Math.abs(delta), unit)} จากรอบก่อน`;
}

function contentLabel(item: SocialAnalyticsItem) {
  const text = item.title?.trim() || item.text?.trim();
  if (!text) return `เนื้อหา ${item.platformObjectId}`;
  return text.length > 110 ? `${text.slice(0, 107)}…` : text;
}

function externalUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}

function MiniTrend({ current, delta }: { current: number; delta: number | null }) {
  const previous = delta === null ? current : Math.max(0, current - delta);
  const ceiling = Math.max(current, previous, 1);
  const previousY = 34 - (previous / ceiling) * 24;
  const currentY = 34 - (current / ceiling) * 24;
  return (
    <svg viewBox="0 0 100 42" className="h-12 w-full" aria-hidden="true" focusable="false">
      <path d="M8 34H92" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
      {delta !== null ? <path d={`M8 ${previousY} L92 ${currentY}`} fill="none" stroke="#e0c985" strokeWidth="3" strokeLinecap="round" /> : null}
      <circle cx={delta === null ? 50 : 8} cy={delta === null ? currentY : previousY} r="3.5" fill="#9ca3af" />
      {delta !== null ? <circle cx="92" cy={currentY} r="4" fill="#e0c985" /> : null}
    </svg>
  );
}

export default function SocialStatsDashboard({ items }: { items: SocialAnalyticsItem[] }) {
  const [platform, setPlatform] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [format, setFormat] = useState("all");
  const [metricKey, setMetricKey] = useState("all");
  const [search, setSearch] = useState("");

  const formats = useMemo(() => [...new Set(items.map((item) => item.format))].sort(), [items]);
  const metrics = useMemo(() => {
    const byKey = new Map<string, { key: string; label: string; unit: MetricUnit; platform: AnalyticsPlatform }>();
    for (const item of items) for (const metric of item.metrics) {
      if (!byKey.has(metric.key)) byKey.set(metric.key, { key: metric.key, label: metric.label, unit: metric.unit, platform: item.platform });
    }
    return [...byKey.values()].sort((a, b) => `${a.platform}:${a.label}`.localeCompare(`${b.platform}:${b.label}`, "th"));
  }, [items]);

  const visibleMetrics = useMemo(() => platform === "all" ? metrics : metrics.filter((metric) => metric.platform === platform), [metrics, platform]);

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("th-TH");
    return items.filter((item) => {
      const fetchedDate = item.fetchedAt.slice(0, 10);
      if (platform !== "all" && item.platform !== platform) return false;
      if (format !== "all" && item.format !== format) return false;
      if (fromDate && fetchedDate < fromDate) return false;
      if (toDate && fetchedDate > toDate) return false;
      if (metricKey !== "all" && !item.metrics.some((metric) => metric.key === metricKey)) return false;
      if (!keyword) return true;
      const haystack = [
        item.publicationId,
        item.platformObjectId,
        item.platform,
        item.provider,
        item.format,
        item.mediaType ?? "",
        item.title ?? "",
        item.text ?? "",
        item.permalink ?? "",
        item.source,
        ...item.metrics.flatMap((metric) => [metric.key, metric.label]),
      ].join(" ").toLocaleLowerCase("th-TH");
      return haystack.includes(keyword);
    });
  }, [format, fromDate, items, metricKey, platform, search, toDate]);

  const rows = useMemo(() => filteredItems.flatMap((item) => item.metrics
    .filter((metric) => metricKey === "all" || metric.key === metricKey)
    .map((metric) => ({ ...item, metric }))), [filteredItems, metricKey]);

  const latest = filteredItems.map((item) => item.fetchedAt).sort().at(-1) ?? null;
  const comparable = rows.filter((row) => row.metric.delta !== null).length;
  const selectedMetric = metrics.find((metric) => metric.key === metricKey) ?? null;
  const selectedMetricPlatforms = new Set(rows.map((row) => row.platform));
  const canAggregateSelectedMetric = Boolean(selectedMetric) && selectedMetricPlatforms.size <= 1;
  const selectedTotal = canAggregateSelectedMetric ? rows.reduce((sum, row) => sum + row.metric.value, 0) : null;
  const selectedDelta = canAggregateSelectedMetric && rows.every((row) => row.metric.delta !== null)
    ? rows.reduce((sum, row) => sum + (row.metric.delta ?? 0), 0)
    : null;

  const topContent = useMemo(() => {
    const top = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      const group = `${row.platform}:${row.metric.key}`;
      const current = top.get(group);
      if (!current || row.metric.value > current.metric.value) top.set(group, row);
    }
    return [...top.values()]
      .sort((a, b) => `${a.platform}:${a.metric.label}`.localeCompare(`${b.platform}:${b.metric.label}`, "th"))
      .slice(0, 6);
  }, [rows]);

  const trends = rows.filter((row) => row.metric.delta !== null).slice(0, 8);

  function resetFilters() {
    setPlatform("all");
    setFromDate("");
    setToDate("");
    setFormat("all");
    setMetricKey("all");
    setSearch("");
  }

  return (
    <div className="mt-7">
      <SocialSheetsExport />
      <section aria-labelledby="social-stats-filter-title" className="rounded-3xl border border-white/10 bg-white/[0.035] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="social-stats-filter-title" className="text-lg font-semibold">ตัวกรองสถิติโซเชียล</h2>
            <p className="mt-1 text-sm text-white/65">กรองจากข้อมูลล่าสุดที่ระบบได้รับ โดยคงชื่อตัวชี้วัดของแต่ละแพลตฟอร์ม</p>
          </div>
          <button type="button" onClick={resetFilters} className="min-h-11 rounded-xl border border-white/15 px-4 py-2.5 text-sm text-white/80 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[#e0c985]">ล้างตัวกรอง</button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <label className="text-xs text-white/70">แพลตฟอร์ม
            <select value={platform} onChange={(event) => {
              const nextPlatform = event.target.value;
              setPlatform(nextPlatform);
              if (metricKey !== "all") {
                const selected = metrics.find((metric) => metric.key === metricKey);
                if (selected && nextPlatform !== "all" && selected.platform !== nextPlatform) setMetricKey("all");
              }
            }} className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-[#151a20] px-3 text-sm text-white focus:border-[#e0c985] focus:outline-none">
              <option value="all">ทั้งหมด</option>
              {(Object.keys(platformLabel) as AnalyticsPlatform[]).map((value) => <option key={value} value={value}>{platformLabel[value]}</option>)}
            </select>
          </label>
          <label className="text-xs text-white/70">ตั้งแต่วันที่
            <input type="date" value={fromDate} max={toDate || undefined} onChange={(event) => setFromDate(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-[#151a20] px-3 text-sm text-white [color-scheme:dark] focus:border-[#e0c985] focus:outline-none" />
          </label>
          <label className="text-xs text-white/70">ถึงวันที่
            <input type="date" value={toDate} min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-[#151a20] px-3 text-sm text-white [color-scheme:dark] focus:border-[#e0c985] focus:outline-none" />
          </label>
          <label className="text-xs text-white/70">รูปแบบ
            <select value={format} onChange={(event) => setFormat(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-[#151a20] px-3 text-sm text-white focus:border-[#e0c985] focus:outline-none">
              <option value="all">ทั้งหมด</option>
              {formats.map((value) => <option key={value} value={value}>{formatLabel[value] ?? value}</option>)}
            </select>
          </label>
          <label className="text-xs text-white/70">ตัวชี้วัด
            <select value={metricKey} onChange={(event) => setMetricKey(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-[#151a20] px-3 text-sm text-white focus:border-[#e0c985] focus:outline-none">
              <option value="all">ทั้งหมด</option>
              {visibleMetrics.map((metric) => <option key={metric.key} value={metric.key}>{platform === "all" ? `${platformLabel[metric.platform]} · ${metric.label}` : metric.label}</option>)}
            </select>
          </label>
          <label className="text-xs text-white/70">ค้นหา
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="โพสต์หรือตัวชี้วัด" className="mt-1 min-h-11 w-full min-w-0 rounded-xl border border-white/15 bg-black/20 px-3 text-sm text-white placeholder:text-white/40 focus:border-[#e0c985] focus:outline-none" />
          </label>
        </div>
      </section>

      <section aria-label="ภาพรวมสถิติโซเชียล" className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <div className="text-xs text-white/65">โพสต์ในผลกรอง</div>
          <div className="mt-2 text-2xl font-semibold">{filteredItems.length.toLocaleString("th-TH")}</div>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <div className="text-xs text-white/65">{selectedMetric ? platform === "all" ? `${platformLabel[selectedMetric.platform]} · ${selectedMetric.label}` : selectedMetric.label : "ตัวชี้วัดที่เปรียบเทียบได้"}</div>
          <div className="mt-2 text-2xl font-semibold">
            {selectedMetric ? selectedTotal !== null ? metricValue(selectedTotal, selectedMetric.unit) : "เลือกแพลตฟอร์ม" : comparable.toLocaleString("th-TH")}
          </div>
          {selectedMetric && selectedTotal !== null ? <div className="mt-1 text-xs text-white/60">{deltaText(selectedDelta, selectedMetric.unit)}</div> : null}
          {selectedMetric && selectedTotal === null ? <div className="mt-1 text-xs text-amber-100/80">ระบบไม่รวมตัวชี้วัดต่างแพลตฟอร์มเข้าด้วยกัน</div> : null}
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <div className="text-xs text-white/65">แพลตฟอร์มในผลกรอง</div>
          <div className="mt-2 text-2xl font-semibold">{new Set(filteredItems.map((item) => item.platform)).size.toLocaleString("th-TH")}</div>
        </article>
        <article className="col-span-2 rounded-2xl border border-white/10 bg-white/[0.035] p-4 lg:col-span-1">
          <div className="text-xs text-white/65">อัปเดตล่าสุด</div>
          <div className="mt-2 text-base font-semibold">{latest ? new Date(latest).toLocaleString("th-TH") : "ไม่มีข้อมูล"}</div>
        </article>
      </section>

      <section aria-labelledby="social-trends-title" className="mt-7">
        <div>
          <h2 id="social-trends-title" className="text-xl font-semibold">แนวโน้มเทียบข้อมูลรอบก่อน</h2>
          <p className="mt-1 text-sm text-white/65">เส้นแสดงเพียงค่ารอบก่อนและรอบล่าสุดที่ระบบได้รับ ไม่คาดการณ์ค่าระหว่างช่วง</p>
        </div>
        {trends.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {trends.map((row) => (
            <article key={`${row.publicationId}:${row.metric.key}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><div className="text-xs font-semibold text-[#f4df9b]">{platformLabel[row.platform]} · {formatLabel[row.format] ?? row.format}</div><h3 className="mt-1 truncate text-sm text-white/85" title={contentLabel(row)}>{contentLabel(row)}</h3><p className="mt-1 truncate text-xs text-white/50">{row.metric.label}</p></div>
                <div className="shrink-0 text-right font-semibold">{metricValue(row.metric.value, row.metric.unit)}</div>
              </div>
              <MiniTrend current={row.metric.value} delta={row.metric.delta} />
              <p className={`text-xs ${row.metric.delta !== null && row.metric.delta > 0 ? "text-emerald-200" : row.metric.delta !== null && row.metric.delta < 0 ? "text-rose-200" : "text-white/60"}`}>{deltaText(row.metric.delta, row.metric.unit)}</p>
            </article>
          ))}
        </div> : <p className="mt-4 rounded-2xl border border-white/10 p-5 text-sm text-white/65">ยังไม่มีข้อมูลรอบก่อนในผลกรอง จึงยังวาดแนวโน้มไม่ได้</p>}
      </section>

      <section aria-labelledby="social-top-content-title" className="mt-7">
        <h2 id="social-top-content-title" className="text-xl font-semibold">เนื้อหาที่ทำผลงานดีที่สุด แยกตามตัวชี้วัด</h2>
        <p className="mt-1 text-sm text-white/65">เลือกชิ้นที่มีค่าสูงสุดภายในแพลตฟอร์มและตัวชี้วัดเดียวกัน จึงไม่บวกยอดเข้าถึง ยอดดู หรือการมีส่วนร่วมข้ามชนิด</p>
        {topContent.length ? <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {topContent.map((row) => (
            <article key={`top:${row.platform}:${row.metric.key}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-start gap-3">
                {externalUrl(row.thumbnail) ? <img src={externalUrl(row.thumbnail)!} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-16 w-16 shrink-0 rounded-xl border border-white/10 object-cover" /> : <div aria-hidden="true" className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-[10px] text-white/40">ไม่มีรูป</div>}
                <div className="min-w-0 flex-1"><div className="text-xs font-semibold text-[#f4df9b]">{platformLabel[row.platform]} · {row.metric.label}</div><h3 className="mt-1 line-clamp-2 text-sm font-medium leading-5 text-white/90">{contentLabel(row)}</h3>{row.publishedAt ? <p className="mt-1 text-xs text-white/50">เผยแพร่ {new Date(row.publishedAt).toLocaleString("th-TH")}</p> : null}</div>
                <div className="text-xl font-semibold">{metricValue(row.metric.value, row.metric.unit)}</div>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-white/60"><span>{row.mediaType ?? formatLabel[row.format] ?? row.format} · {deltaText(row.metric.delta, row.metric.unit)}</span>{externalUrl(row.permalink) ? <a href={externalUrl(row.permalink)!} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-lg border border-white/15 px-3 text-[#f4df9b] hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[#e0c985]">เปิดโพสต์จริง</a> : <span>ไม่มีลิงก์โพสต์</span>}</div>
            </article>
          ))}
        </div> : <p className="mt-4 rounded-2xl border border-white/10 p-5 text-sm text-white/65">ไม่พบข้อมูลตามตัวกรอง</p>}
      </section>

      <section aria-labelledby="social-raw-history-title" className="mt-7">
        <h2 id="social-raw-history-title" className="text-xl font-semibold">ประวัติตัวเลขจากแพลตฟอร์ม</h2>
        <p className="mt-1 text-sm text-white/65">แสดงข้อมูลล่าสุดและการเปลี่ยนแปลงของแต่ละโพสต์ตามที่ระบบได้รับ โดยไม่สร้างแถวประวัติที่ไม่มีอยู่จริง</p>
        <div role="region" aria-label="ตารางประวัติสถิติโซเชียล" tabIndex={0} className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
          <table className="min-w-[1240px] w-full border-collapse text-left text-sm">
            <thead className="bg-white/[0.05] text-xs text-white/70">
              <tr>
                <th className="px-4 py-3 font-medium">เวลาที่เก็บข้อมูล</th>
                <th className="px-4 py-3 font-medium">แพลตฟอร์ม</th>
                <th className="px-4 py-3 font-medium">รูปแบบ</th>
                <th className="px-4 py-3 font-medium">รหัสโพสต์</th>
                <th className="px-4 py-3 font-medium">เนื้อหา</th>
                <th className="px-4 py-3 font-medium">แหล่งข้อมูล</th>
                <th className="px-4 py-3 font-medium">ตัวชี้วัด</th>
                <th className="px-4 py-3 text-right font-medium">ค่าล่าสุด</th>
                <th className="px-4 py-3 text-right font-medium">ค่ารอบก่อน</th>
                <th className="px-4 py-3 text-right font-medium">เปลี่ยนแปลง</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const previous = row.metric.delta === null ? null : Math.max(0, row.metric.value - row.metric.delta);
                return <tr key={`raw:${row.publicationId}:${row.metric.key}`} className="border-t border-white/10 text-white/75">
                  <td className="whitespace-nowrap px-4 py-3">{new Date(row.fetchedAt).toLocaleString("th-TH")}</td>
                  <td className="px-4 py-3">{platformLabel[row.platform]}</td>
                  <td className="px-4 py-3">{formatLabel[row.format] ?? row.format}</td>
                  <td className="max-w-[240px] break-all px-4 py-3">{row.platformObjectId}</td>
                  <td className="max-w-[320px] px-4 py-3"><div className="line-clamp-2">{contentLabel(row)}</div>{externalUrl(row.permalink) ? <a href={externalUrl(row.permalink)!} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-[#f4df9b] hover:underline">เปิดโพสต์</a> : null}</td>
                  <td className="px-4 py-3"><div>{row.source === "provider-content" ? "ข้อมูลจากแพลตฟอร์ม" : "ข้อมูลจากรายการเผยแพร่"}</div><div className="mt-0.5 text-xs text-white/50">{row.mediaType ?? "ไม่ระบุชนิดสื่อ"}</div></td>
                  <td className="px-4 py-3"><div>{row.metric.label}</div><div className="mt-0.5 text-xs text-white/50">{row.metric.key}</div></td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-white">{metricValue(row.metric.value, row.metric.unit)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">{previous === null ? "—" : metricValue(previous, row.metric.unit)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">{row.metric.delta === null ? "—" : `${row.metric.delta > 0 ? "+" : ""}${metricValue(row.metric.delta, row.metric.unit)}`}</td>
                </tr>;
              })}
              {rows.length === 0 ? <tr><td colSpan={10} className="px-4 py-8 text-center text-white/60">ไม่พบข้อมูลตามตัวกรอง</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
