/* eslint-disable @next/next/no-img-element -- Social provider thumbnail hosts are dynamic runtime data. */

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Database, ExternalLink, Image as ImageIcon } from "lucide-react";
import type {
  MarketingMetricUnit,
  MarketingPost,
  WeeklyPoint,
} from "@/lib/admin/social/marketing-dashboard-model";
import {
  FORMAT_LABEL,
  PLATFORM_LABEL,
  compactText,
} from "@/lib/admin/social/marketing-dashboard-model";

export function formatMarketingValue(value: number | null, unit: MarketingMetricUnit, compact = false) {
  if (value === null || !Number.isFinite(value)) return "—";
  if (unit === "percent") {
    return `${(value * 100).toLocaleString("th-TH", { maximumFractionDigits: value < 0.01 ? 2 : 1 })}%`;
  }
  if (unit === "milliseconds") {
    const seconds = value / 1000;
    return seconds >= 60
      ? `${(seconds / 60).toLocaleString("th-TH", { maximumFractionDigits: 1 })} นาที`
      : `${seconds.toLocaleString("th-TH", { maximumFractionDigits: 1 })} วินาที`;
  }
  return value.toLocaleString("th-TH", compact ? { notation: "compact", maximumFractionDigits: 1 } : { maximumFractionDigits: 1 });
}

export function safeExternalUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}

export function QualityBadge({ post }: { post: MarketingPost }) {
  const needsReview = post.dataQualityStatus === "needs_review";
  const partial = !needsReview && (post.metricCoverageRate ?? 0) < 0.8;
  const label = needsReview ? "ควรตรวจ QA" : partial ? "ข้อมูลบางส่วน" : "พร้อมวิเคราะห์";
  const className = needsReview
    ? "border-amber-200/20 bg-amber-200/[0.08] text-amber-100"
    : partial
      ? "border-white/10 bg-white/[0.05] text-white/65"
      : "border-emerald-200/20 bg-emerald-200/[0.08] text-emerald-100";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${className}`}>
      {needsReview ? <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> : <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}
      {label}
    </span>
  );
}

export function CoverageBadge({ rate }: { rate: number | null }) {
  const percent = rate === null ? null : Math.max(0, Math.min(100, Math.round(rate * 100)));
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/65">
      <Database className="h-3.5 w-3.5" aria-hidden="true" />
      {percent === null ? "Coverage ยังไม่ครบ" : `Coverage ${percent}%`}
    </span>
  );
}

export function PostThumbnail({ post, size = "md" }: { post: MarketingPost; size?: "sm" | "md" | "lg" }) {
  const url = safeExternalUrl(post.thumbnail);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const classes = size === "lg" ? "h-24 w-24 rounded-2xl" : size === "sm" ? "h-12 w-12 rounded-xl" : "h-16 w-16 rounded-xl";
  if (!url || failedUrl === url) {
    return (
      <div aria-hidden="true" className={`flex shrink-0 items-center justify-center border border-white/10 bg-white/[0.04] text-white/35 ${classes}`}>
        <ImageIcon className={size === "lg" ? "h-7 w-7" : "h-5 w-5"} />
      </div>
    );
  }
  return <img key={url} src={url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailedUrl(url)} className={`shrink-0 border border-white/10 object-cover ${classes}`} />;
}

export function PostIdentity({ post, compact = false }: { post: MarketingPost; compact?: boolean }) {
  const url = safeExternalUrl(post.permalink);
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-[#f4df9b]">
        <span>{PLATFORM_LABEL[post.platform]}</span>
        <span className="text-white/30">•</span>
        <span>{FORMAT_LABEL[post.formatStandard] ?? post.formatStandard}</span>
      </div>
      <div className={`${compact ? "mt-1 line-clamp-2 text-sm" : "mt-2 line-clamp-3 text-sm leading-6"} font-medium text-white/90`} title={post.text}>
        {compactText(post.text || `Content ${post.providerObjectId}`, compact ? 100 : 180)}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-white/45">
        <span>{new Date(post.publishedAtUtc).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" })}</span>
        {url ? (
          <a href={url} target="_blank" rel="noreferrer" className="inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-[#f4df9b] hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[#e0c985]">
            เปิดโพสต์ <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        ) : null}
      </div>
    </div>
  );
}

export function WeeklyMedianChart({ points, unit }: { points: WeeklyPoint[]; unit: MarketingMetricUnit }) {
  if (points.length < 2) {
    return <div className="flex min-h-44 items-center justify-center rounded-2xl border border-dashed border-white/10 text-sm text-white/45">ยังมีสัปดาห์ไม่พอสำหรับวาดแนวโน้ม</div>;
  }
  const width = 720;
  const height = 230;
  const padding = { top: 24, right: 18, bottom: 48, left: 54 };
  const values = points.map((point) => point.median);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  const x = (index: number) => padding.left + index * ((width - padding.left - padding.right) / Math.max(1, points.length - 1));
  const y = (value: number) => padding.top + (max - value) / range * (height - padding.top - padding.bottom);
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"}${x(index)} ${y(point.median)}`).join(" ");
  const grid = [0, 0.5, 1].map((ratio) => ({
    value: max - range * ratio,
    y: padding.top + (height - padding.top - padding.bottom) * ratio,
  }));
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[230px] min-w-[620px] w-full" role="img" aria-label="กราฟค่ากลางตามสัปดาห์ที่เผยแพร่">
        {grid.map((line) => (
          <g key={line.y}>
            <path d={`M${padding.left} ${line.y}H${width - padding.right}`} stroke="rgba(255,255,255,0.09)" strokeWidth="1" />
            <text x={padding.left - 10} y={line.y + 4} textAnchor="end" fill="rgba(255,255,255,0.42)" fontSize="11">{formatMarketingValue(line.value, unit, true)}</text>
          </g>
        ))}
        <path d={path} fill="none" stroke="#9eebce" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point, index) => (
          <g key={point.week}>
            <circle cx={x(index)} cy={y(point.median)} r="4.5" fill="#e0c985" stroke="#11151a" strokeWidth="2" />
            <text x={x(index)} y={height - 25} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="10">{point.label}</text>
            <title>{`${point.label}: ${formatMarketingValue(point.median, unit)} · ${point.sampleSize} โพสต์`}</title>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function BenchmarkBand({
  min,
  p25,
  median,
  p75,
  p90,
  max,
  unit,
}: {
  min: number;
  p25: number;
  median: number;
  p75: number;
  p90: number;
  max: number;
  unit: MarketingMetricUnit;
}) {
  const ceiling = Math.max(max, 1);
  const position = (value: number) => `${Math.max(0, Math.min(100, value / ceiling * 100))}%`;
  return (
    <div>
      <div className="relative h-12">
        <div className="absolute left-0 right-0 top-5 h-2 rounded-full bg-white/[0.07]" />
        <div className="absolute top-5 h-2 rounded-full bg-[#9eebce]/35" style={{ left: position(p25), width: `calc(${position(p75)} - ${position(p25)})` }} />
        {[{ value: p25, label: "P25" }, { value: median, label: "Median" }, { value: p75, label: "P75" }, { value: p90, label: "P90" }].map((marker) => (
          <div key={marker.label} className="absolute top-1 -translate-x-1/2" style={{ left: position(marker.value) }}>
            <div className={`mx-auto h-8 w-px ${marker.label === "Median" ? "bg-[#e0c985]" : "bg-white/30"}`} />
            <span className="mt-0.5 block whitespace-nowrap text-[9px] text-white/45">{marker.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-3 gap-2 text-[11px] text-white/55">
        <span>ต่ำสุด {formatMarketingValue(min, unit, true)}</span>
        <span className="text-center text-[#f4df9b]">Median {formatMarketingValue(median, unit, true)}</span>
        <span className="text-right">สูงสุด {formatMarketingValue(max, unit, true)}</span>
      </div>
    </div>
  );
}
