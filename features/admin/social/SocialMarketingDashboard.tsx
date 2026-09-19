"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowDownAZ,
  ArrowUpAZ,
  BarChart3,
  Check,
  ChevronDown,
  CircleGauge,
  Clock3,
  Copy,
  Database,
  Download,
  FileSpreadsheet,
  Filter,
  Gauge,
  Layers3,
  Lightbulb,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  TableProperties,
  Target,
  X,
} from "lucide-react";
import SocialSheetsExport from "./SocialSheetsExport";
import {
  FORMAT_LABEL,
  GOAL_LABEL,
  METRIC_DEFINITIONS,
  PERIOD_LABEL,
  PLATFORM_LABEL,
  buildFormatBenchmarks,
  buildInsights,
  buildMarketingCsv,
  buildTimeSlots,
  buildWeeklySeries,
  buildWinners,
  compactText,
  executiveSummary,
  filterMarketingPosts,
  goalMetric,
  median,
  metricSummary,
  metricValue,
  percentile,
  percentileRank,
  qualityBucket,
  referenceDate,
  type FormatBenchmark,
  type MarketingDashboardData,
  type MarketingFilters,
  type MarketingGoal,
  type MarketingInsight,
  type MarketingMetricId,
  type MarketingMetricUnit,
  type MarketingPlatform,
  type MarketingPost,
} from "@/lib/admin/social/marketing-dashboard-model";
import {
  BenchmarkBand,
  CoverageBadge,
  PostIdentity,
  PostThumbnail,
  QualityBadge,
  WeeklyMedianChart,
  formatMarketingValue,
} from "./MarketingDashboardVisuals";

type DashboardTab = "overview" | "content" | "benchmarks" | "quality";
type ContentSort = "content" | "published" | "awareness" | "intent" | "deep" | "coverage";

function ContentSortHeader({ field, activeField, direction, onSort, children, align = "left" }: {
  field: ContentSort; activeField: ContentSort; direction: "desc" | "asc"; onSort: (field: ContentSort) => void; children: ReactNode; align?: "left" | "right";
}) {
  const active = activeField === field;
  return <button type="button" onClick={() => onSort(field)} aria-pressed={active} className={`inline-flex min-h-10 w-full items-center gap-1.5 font-medium hover:text-white focus:outline-none focus:ring-2 focus:ring-[#e0c985] ${align === "right" ? "justify-end text-right" : "justify-start text-left"}`}>
    <span>{children}</span>{active ? direction === "desc" ? <ArrowDownAZ className="h-3.5 w-3.5" /> : <ArrowUpAZ className="h-3.5 w-3.5" /> : null}
  </button>;
}

const DASHBOARD_TABS: Array<{ id: DashboardTab; label: string; description: string; icon: typeof BarChart3 }> = [
  { id: "overview", label: "ภาพรวม", description: "ดูว่าอะไรเวิร์กและควรทำอะไรต่อ", icon: BarChart3 },
  { id: "content", label: "คอนเทนต์", description: "ค้นหา เรียง เปรียบเทียบ และดาวน์โหลด", icon: TableProperties },
  { id: "benchmarks", label: "เทียบกับกลุ่มเดียวกัน", description: "เทียบกับโพสต์ในแพลตฟอร์มและรูปแบบเดียวกัน", icon: Gauge },
  { id: "quality", label: "คุณภาพข้อมูล", description: "ดูความครบถ้วน ข้อมูลที่ขาด และจุดที่ควรตรวจ", icon: ShieldCheck },
];

const QUALITY_LABEL = {
  all: "ทุกสถานะ",
  ready: "พร้อมวิเคราะห์",
  needs_review: "ควรตรวจข้อมูล",
  partial: "ข้อมูลบางส่วน",
} as const;

const metricThaiLabel: Record<string, string> = {
  views: "ยอดดู",
  reach: "บัญชีที่เข้าถึง",
  clicks: "ยอดคลิก",
  reactions_total: "ปฏิกิริยา",
  likes: "ถูกใจ",
  comments_total: "คอมเมนต์",
  shares: "แชร์",
  saves: "บันทึก",
  total_interactions: "การมีส่วนร่วมทั้งหมด",
  reaction_like: "ปฏิกิริยา · ถูกใจ",
  reaction_love: "ปฏิกิริยา · รักเลย",
  reaction_care: "ปฏิกิริยา · ห่วงใย",
  reaction_wow: "ปฏิกิริยา · ว้าว",
  reaction_haha: "ปฏิกิริยา · หัวเราะ",
  reaction_sad: "ปฏิกิริยา · เศร้า",
  reaction_angry: "ปฏิกิริยา · โกรธ",
  reel_total_watch_time_ms: "เวลารับชม Reel รวม",
  reel_average_watch_time_ms: "เวลารับชม Reel เฉลี่ย",
  impressions: "จำนวนครั้งที่แสดง",
};

function MetricCard({
  icon,
  label,
  value,
  helper,
  tone = "default",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  helper: string;
  tone?: "default" | "mint" | "gold" | "warning";
}) {
  const toneClass = tone === "mint"
    ? "border-[#9eebce]/20 bg-[#9eebce]/[0.07]"
    : tone === "gold"
      ? "border-[#e0c985]/20 bg-[#e0c985]/[0.07]"
      : tone === "warning"
        ? "border-amber-200/20 bg-amber-200/[0.06]"
        : "border-white/10 bg-white/[0.035]";
  return (
    <article className={`rounded-2xl border p-4 sm:p-5 ${toneClass}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-white/60">{label}</span>
        <span className="text-white/50">{icon}</span>
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{value}</div>
      <p className="mt-2 text-xs leading-5 text-white/50">{helper}</p>
    </article>
  );
}

function GoalSelector({ value, onChange }: { value: MarketingGoal; onChange: (value: MarketingGoal) => void }) {
  return (
    <div>
      <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.12em] text-[#e0c985]">
        <Target className="h-4 w-4" aria-hidden="true" /> เป้าหมายที่ต้องการดู
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {(Object.keys(GOAL_LABEL) as MarketingGoal[]).map((goal) => {
          const active = value === goal;
          return (
            <button key={goal} type="button" onClick={() => onChange(goal)} aria-pressed={active}
              className={`min-h-16 rounded-2xl border px-4 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-[#e0c985] ${active ? "border-[#9eebce]/50 bg-[#9eebce]/[0.10]" : "border-white/10 bg-white/[0.025] hover:bg-white/[0.05]"}`}>
              <div className={`text-sm font-semibold ${active ? "text-[#b6f3dc]" : "text-white/80"}`}>{GOAL_LABEL[goal].label}</div>
              <div className="mt-1 text-xs leading-5 text-white/45">{GOAL_LABEL[goal].description}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function formatMetricSummary(value: number | null, unit: MarketingMetricUnit) {
  return formatMarketingValue(value, unit, true);
}

function PlatformOverview({ posts, platform }: { posts: MarketingPost[]; platform: MarketingPlatform }) {
  const platformPosts = posts.filter((post) => post.platform === platform);
  const isFacebook = platform === "facebook";
  const first = metricSummary(platformPosts, isFacebook ? "views" : "reach");
  const second = metricSummary(platformPosts, "views");
  const third = metricSummary(platformPosts, isFacebook ? "clicks" : "engagement_rate_by_reach");
  const fourth = metricSummary(platformPosts, isFacebook ? "click_rate_by_view" : "deep_engagement_rate_by_reach");
  const stats = isFacebook ? [
    { label: "ค่ากลางของยอดดู", value: first.median, unit: "count" as const },
    { label: "ค่ากลางของยอดคลิก", value: third.median, unit: "count" as const },
    { label: "ค่ากลางของอัตราคลิก", value: fourth.median, unit: "percent" as const },
    { label: "โพสต์ในชุด", value: platformPosts.length, unit: "count" as const },
  ] : [
    { label: "ค่ากลางของบัญชีที่เข้าถึง", value: first.median, unit: "count" as const },
    { label: "ค่ากลางของยอดดู", value: second.median, unit: "count" as const },
    { label: "ค่ากลางของการมีส่วนร่วม", value: third.median, unit: "percent" as const },
    { label: "ค่ากลางของการมีส่วนร่วมเชิงลึก", value: fourth.median, unit: "percent" as const },
  ];
  return (
    <article className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] p-5 sm:p-6">
      <div aria-hidden="true" className={`absolute -right-16 -top-20 h-48 w-48 rounded-full blur-3xl ${isFacebook ? "bg-[#9eebce]/[0.07]" : "bg-[#e0c985]/[0.07]"}`} />
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">{PLATFORM_LABEL[platform].toUpperCase()}</p>
          <h3 className="mt-2 text-xl font-semibold">ภาพรวมแบบใช้ค่ากลาง</h3>
          <p className="mt-1 text-sm text-white/55">ไม่ใช้ยอดรวมของโพสต์ต่างอายุ จึงเปรียบเทียบได้เหมาะกว่าการดูยอดสะสมอย่างเดียว</p>
        </div>
        <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/60">n = {platformPosts.length.toLocaleString("th-TH")}</span>
      </div>
      <div className="relative mt-5 grid grid-cols-2 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-white/8 bg-black/15 p-3.5">
            <div className="text-[11px] text-white/45">{stat.label}</div>
            <div className="mt-1.5 text-lg font-semibold text-white/90">{formatMetricSummary(stat.value, stat.unit)}</div>
          </div>
        ))}
      </div>
      <p className="relative mt-4 text-xs leading-5 text-white/45">
        {isFacebook ? "Facebook ยังไม่มีข้อมูลบัญชีที่เข้าถึงซึ่งตรวจสอบแล้ว จึงใช้ยอดดูและยอดคลิกเป็นหลัก" : "Instagram คำนวณอัตราต่อบัญชีที่เข้าถึงได้ เพราะข้อมูลชุดนี้มีตัวเลขครบ"}
      </p>
    </article>
  );
}

function WinnerCard({ winner }: { winner: ReturnType<typeof buildWinners>[number] }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:-translate-y-0.5 hover:border-white/20">
      <div className="flex gap-3">
        <PostThumbnail post={winner.post} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="rounded-full border border-[#9eebce]/20 bg-[#9eebce]/[0.08] px-2.5 py-1 text-[11px] font-semibold text-[#b6f3dc]">อันดับเทียบกลุ่ม {winner.percentile}</span>
            <span className="text-lg font-semibold">{formatMarketingValue(winner.metric.value, winner.metric.unit, true)}</span>
          </div>
          <p className="mt-1 text-[11px] text-white/45">{winner.metric.label} · เทียบกับ {winner.cohortSize} โพสต์รูปแบบเดียวกัน</p>
          <div className="mt-2"><PostIdentity post={winner.post} compact /></div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2"><QualityBadge post={winner.post} /><CoverageBadge rate={winner.post.metricCoverageRate} /></div>
    </article>
  );
}

function FormatComparison({ benchmarks }: { benchmarks: FormatBenchmark[] }) {
  if (!benchmarks.length) return <p className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-white/50">ยังไม่มีข้อมูลพอสำหรับเปรียบเทียบรูปแบบ</p>;
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {(["facebook", "instagram"] as const).map((platform) => {
        const rows = benchmarks.filter((row) => row.platform === platform);
        if (!rows.length) return null;
        const ceiling = Math.max(...rows.map((row) => row.median), 1);
        return (
          <article key={platform} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-end justify-between gap-3">
              <div><h3 className="font-semibold">{PLATFORM_LABEL[platform]}</h3><p className="mt-1 text-xs text-white/45">ค่ากลางตามรูปแบบ</p></div>
              <span className="text-[11px] text-white/40">ไม่รวมข้ามแพลตฟอร์ม</span>
            </div>
            <div className="mt-5 space-y-4">
              {rows.map((row) => (
                <div key={`${platform}:${row.format}`}>
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-white/70">{FORMAT_LABEL[row.format] ?? row.format} <span className="text-white/35">· n={row.sampleSize}</span></span>
                    <span className="font-semibold text-white/85">{formatMarketingValue(row.median, row.unit, true)}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.07]">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#9eebce]/45 to-[#e0c985]" style={{ width: `${Math.max(4, row.median / ceiling * 100)}%` }} />
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] text-white/35"><span>ค่ากลาง</span><span>กลุ่มบน 25% {formatMarketingValue(row.p75, row.unit, true)}</span></div>
                </div>
              ))}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function InsightCard({ insight }: { insight: MarketingInsight }) {
  const tone = insight.tone === "positive"
    ? "border-[#9eebce]/20 bg-[#9eebce]/[0.06]"
    : insight.tone === "warning"
      ? "border-amber-200/20 bg-amber-200/[0.06]"
      : "border-white/10 bg-white/[0.03]";
  return (
    <article className={`rounded-2xl border p-4 ${tone}`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-[#f4df9b]">{insight.tone === "positive" ? <Sparkles className="h-5 w-5" /> : insight.tone === "warning" ? <AlertTriangle className="h-5 w-5" /> : <Lightbulb className="h-5 w-5" />}</span>
        <div>
          <h3 className="text-sm font-semibold text-white/90">{insight.title}</h3>
          <p className="mt-1.5 text-sm leading-6 text-white/60">{insight.detail}</p>
          <p className="mt-2 text-xs leading-5 text-[#f4df9b]">ทำต่อ: {insight.action}</p>
          <p className="mt-2 text-[10px] text-white/35">ฐานข้อมูล {insight.sampleSize.toLocaleString("th-TH")} รายการ</p>
        </div>
      </div>
    </article>
  );
}

function OverviewTab({ posts, goal, setGoal }: { posts: MarketingPost[]; goal: MarketingGoal; setGoal: (goal: MarketingGoal) => void }) {
  const facebookWinners = useMemo(() => buildWinners(posts, goal, "facebook"), [goal, posts]);
  const instagramWinners = useMemo(() => buildWinners(posts, goal, "instagram"), [goal, posts]);
  const benchmarks = useMemo(() => buildFormatBenchmarks(posts, goal), [goal, posts]);
  const insights = useMemo(() => buildInsights(posts, goal), [goal, posts]);
  const facebookWeekly = useMemo(() => buildWeeklySeries(posts, goal, "facebook"), [goal, posts]);
  const instagramWeekly = useMemo(() => buildWeeklySeries(posts, goal, "instagram"), [goal, posts]);
  const facebookTime = useMemo(() => buildTimeSlots(posts, goal, "facebook"), [goal, posts]);
  const instagramTime = useMemo(() => buildTimeSlots(posts, goal, "instagram"), [goal, posts]);

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
        <GoalSelector value={goal} onChange={setGoal} />
      </section>

      <section aria-labelledby="platform-overview-title">
        <div><p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">ภาพรวมแต่ละแพลตฟอร์ม</p><h2 id="platform-overview-title" className="mt-2 text-2xl font-semibold">อ่านแต่ละแพลตฟอร์มด้วยตัวชี้วัดที่เหมาะสม</h2></div>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <PlatformOverview posts={posts} platform="facebook" />
          <PlatformOverview posts={posts} platform="instagram" />
        </div>
      </section>

      <section aria-labelledby="winning-content-title">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">เนื้อหาที่ทำผลงานเด่น</p><h2 id="winning-content-title" className="mt-2 text-2xl font-semibold">โพสต์ที่เด่นเมื่อเทียบกับกลุ่มเดียวกัน</h2><p className="mt-1 text-sm text-white/55">อันดับคำนวณภายในแพลตฟอร์มและรูปแบบเดียวกัน โดยไม่เปรียบเทียบ Facebook กับ Instagram</p></div>
          <span className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/55">เป้าหมาย: {GOAL_LABEL[goal].label}</span>
        </div>
        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          {(["facebook", "instagram"] as const).map((platform) => {
            const winners = platform === "facebook" ? facebookWinners : instagramWinners;
            return (
              <div key={platform}>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/75"><span className="h-2 w-2 rounded-full bg-[#9eebce]" />{PLATFORM_LABEL[platform]}</h3>
                <div className="space-y-3">{winners.length ? winners.map((winner) => <WinnerCard key={`${platform}:${winner.post.contentId}`} winner={winner} />) : <p className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-white/45">ยังไม่มีตัวชี้วัดสำหรับเปรียบเทียบเป้าหมายนี้</p>}</div>
              </div>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="format-comparison-title">
        <div><p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">เปรียบเทียบรูปแบบ</p><h2 id="format-comparison-title" className="mt-2 text-2xl font-semibold">รูปแบบไหนทำผลงานได้ดีที่สุด</h2><p className="mt-1 text-sm text-white/55">ใช้ค่ากลางเพื่อลดผลกระทบจากโพสต์ไวรัลเพียงชิ้นเดียว</p></div>
        <div className="mt-4"><FormatComparison benchmarks={benchmarks} /></div>
      </section>

      <section aria-labelledby="weekly-performance-title">
        <div><p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">ผลงานรายสัปดาห์</p><h2 id="weekly-performance-title" className="mt-2 text-2xl font-semibold">ผลงานตามสัปดาห์ที่เผยแพร่</h2><p className="mt-1 text-sm text-white/55">เป็นค่าล่าสุดของโพสต์ที่เผยแพร่ในแต่ละสัปดาห์ ไม่ใช่ยอดที่เกิดขึ้นเฉพาะสัปดาห์นั้น</p></div>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {(["facebook", "instagram"] as const).map((platform) => {
            const points = platform === "facebook" ? facebookWeekly : instagramWeekly;
            const unit = points[0]?.unit ?? "count";
            return <article key={platform} className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5"><div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">{PLATFORM_LABEL[platform]}</h3><span className="text-xs text-white/40">ค่ากลาง · {GOAL_LABEL[goal].label}</span></div><WeeklyMedianChart points={points} unit={unit} /></article>;
          })}
        </div>
      </section>

      <section aria-labelledby="publish-time-title">
        <div><p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">ช่วงเวลาเผยแพร่</p><h2 id="publish-time-title" className="mt-2 text-2xl font-semibold">ช่วงเวลาที่น่าสนใจ</h2><p className="mt-1 text-sm text-white/55">เรียงจากค่ากลางสูงสุดและแสดงเฉพาะช่วงที่มีอย่างน้อย 3 โพสต์ ใช้เป็นแนวทางทดสอบ ไม่ใช่ข้อสรุปว่าเวลาเป็นสาเหตุ</p></div>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {(["facebook", "instagram"] as const).map((platform) => {
            const slots = platform === "facebook" ? facebookTime : instagramTime;
            return <article key={platform} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5"><h3 className="font-semibold">{PLATFORM_LABEL[platform]}</h3><div className="mt-4 space-y-3">{slots.length ? slots.map((slot, index) => <div key={slot.key} className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/15 p-3"><div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e0c985]/10 text-xs font-semibold text-[#f4df9b]">{index + 1}</span><div><div className="text-sm text-white/80">{slot.label}</div><div className="text-[11px] text-white/40">{slot.sampleSize} โพสต์</div></div></div><div className="text-right"><div className="font-semibold">{formatMarketingValue(slot.median, slot.unit, true)}</div><div className="text-[10px] text-white/35">ค่ากลาง</div></div></div>) : <p className="text-sm text-white/45">ยังมีตัวอย่างไม่พอ</p>}</div></article>;
          })}
        </div>
      </section>

      <section aria-labelledby="decision-insights-title">
        <div><p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">ข้อสังเกตเพื่อการตัดสินใจ</p><h2 id="decision-insights-title" className="mt-2 text-2xl font-semibold">สิ่งที่ควรทำต่อจากข้อมูลชุดนี้</h2><p className="mt-1 text-sm text-white/55">เป็นกฎวิเคราะห์ที่ตรวจสอบได้ ไม่ใช่ข้อความที่ AI เดาจากความรู้สึก</p></div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">{insights.length ? insights.map((insight) => <InsightCard key={insight.id} insight={insight} />) : <p className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-white/45">ยังไม่พบรูปแบบที่เข้าเงื่อนไขในชุดกรองนี้</p>}</div>
      </section>
    </div>
  );
}

function ComparisonPanel({ posts, onRemove }: { posts: MarketingPost[]; onRemove: (id: string) => void }) {
  if (!posts.length) return null;
  return (
    <section aria-labelledby="selected-comparison-title" className="rounded-3xl border border-[#9eebce]/20 bg-[#9eebce]/[0.055] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h3 id="selected-comparison-title" className="font-semibold">เปรียบเทียบ {posts.length} โพสต์</h3><p className="mt-1 text-xs text-white/55">เลือกได้สูงสุด 4 โพสต์ และอ่านตัวชี้วัดตามแพลตฟอร์มของแต่ละโพสต์</p></div>
        <span className="text-xs text-white/45">ไม่รวมยอดเข้าถึงหรือยอดดูข้ามแพลตฟอร์ม</span>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-[760px] w-full border-collapse text-sm">
          <thead className="text-left text-[11px] text-white/45"><tr><th className="pb-2 pr-4 font-medium">เนื้อหา</th><th className="pb-2 px-3 text-right font-medium">การมองเห็น</th><th className="pb-2 px-3 text-right font-medium">ความสนใจต่อ</th><th className="pb-2 px-3 text-right font-medium">ส่วนร่วมเชิงลึก</th><th className="pb-2 px-3 text-right font-medium">ความครบถ้วน</th><th className="pb-2 pl-3" /></tr></thead>
          <tbody>{posts.map((post) => {
            const awareness = goalMetric(post, "awareness");
            const intent = goalMetric(post, "intent");
            const deep = goalMetric(post, "deep");
            return <tr key={post.contentId} className="border-t border-white/10"><td className="py-3 pr-4"><div className="max-w-[320px]"><PostIdentity post={post} compact /></div></td><td className="px-3 py-3 text-right"><div className="font-medium">{formatMarketingValue(awareness.value, awareness.unit, true)}</div><div className="text-[10px] text-white/35">{awareness.shortLabel}</div></td><td className="px-3 py-3 text-right"><div className="font-medium">{formatMarketingValue(intent.value, intent.unit, true)}</div><div className="text-[10px] text-white/35">{intent.shortLabel}</div></td><td className="px-3 py-3 text-right"><div className="font-medium">{formatMarketingValue(deep.value, deep.unit, true)}</div><div className="text-[10px] text-white/35">{deep.shortLabel}</div></td><td className="px-3 py-3 text-right">{formatMarketingValue(post.metricCoverageRate, "percent")}</td><td className="py-3 pl-3"><button type="button" onClick={() => onRemove(post.contentId)} aria-label={`นำ ${compactText(post.text, 30)} ออกจากการเปรียบเทียบ`} className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/50 hover:bg-white/5"><X className="h-4 w-4" /></button></td></tr>;
          })}</tbody>
        </table>
      </div>
    </section>
  );
}

function ContentTab({ posts, goal, periodLabel }: { posts: MarketingPost[]; goal: MarketingGoal; periodLabel: string }) {
  const [sort, setSort] = useState<ContentSort>("awareness");
  const [direction, setDirection] = useState<"desc" | "asc">("desc");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(50);
  const [notice, setNotice] = useState("");

  const sorted = useMemo(() => {
    const textValue = (post: MarketingPost) => compactText(post.text, 500).toLocaleLowerCase("th-TH");
    const numericValue = (post: MarketingPost) => {
      if (sort === "published") return Date.parse(post.publishedAtUtc);
      if (sort === "coverage") return post.metricCoverageRate ?? -1;
      if (sort === "content") return 0;
      return goalMetric(post, sort).value ?? -1;
    };
    return [...posts].sort((a, b) => {
      if (sort === "content") {
        const compared = textValue(a).localeCompare(textValue(b), "th");
        return direction === "asc" ? compared : -compared;
      }
      const compared = numericValue(a) - numericValue(b);
      return compared * (direction === "asc" ? 1 : -1);
    });
  }, [direction, posts, sort]);
  const visible = sorted.slice(0, visibleCount);
  const selected = selectedIds.map((id) => posts.find((post) => post.contentId === id)).filter((post): post is MarketingPost => Boolean(post));

  function toggleSelection(post: MarketingPost) {
    setNotice("");
    setSelectedIds((current) => {
      if (current.includes(post.contentId)) return current.filter((id) => id !== post.contentId);
      if (current.length >= 4) { setNotice("เลือกเปรียบเทียบได้สูงสุด 4 โพสต์"); return current; }
      return [...current, post.contentId];
    });
  }

  function setSortField(next: ContentSort) {
    if (sort === next) {
      setDirection((value) => value === "desc" ? "asc" : "desc");
      return;
    }
    setSort(next);
    setDirection(next === "content" ? "asc" : "desc");
  }

  function directionLabel() {
    if (sort === "content") return direction === "asc" ? "A → Z" : "Z → A";
    if (sort === "published") return direction === "desc" ? "ใหม่ → เก่า" : "เก่า → ใหม่";
    return direction === "desc" ? "มาก → น้อย" : "น้อย → มาก";
  }

  function sortLabel() {
    return sort === "content" ? "ตัวอักษร" : sort === "published" ? "วันที่เผยแพร่" : sort === "coverage" ? "ความครบถ้วนของข้อมูล" : sort === "awareness" ? "การมองเห็น" : sort === "intent" ? "ความสนใจต่อ" : "การมีส่วนร่วมเชิงลึก";
  }

  function downloadCsv() {
    const blob = new Blob([buildMarketingCsv(sorted)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ccpun-marketing-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setNotice(`ดาวน์โหลด CSV ${sorted.length.toLocaleString("th-TH")} แถวแล้ว`);
  }

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(executiveSummary(posts, goal, periodLabel));
      setNotice("คัดลอกสรุปสำหรับส่งต่อแล้ว");
    } catch {
      setNotice("คัดลอกอัตโนมัติไม่สำเร็จ กรุณาใช้ Google Sheets หรือ CSV");
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div><p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">สำรวจเนื้อหา</p><h2 className="mt-2 text-2xl font-semibold">เรียงดูทุกโพสต์ในรายการเดียว</h2><p className="mt-1 text-sm text-white/55">กดหัวคอลัมน์บนคอมพิวเตอร์ หรือเลือกการเรียงบนมือถือได้ทันที โดยไม่ต้องเปิดทีละกล่อง</p></div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={copySummary} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-4 text-sm text-white/75 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[#e0c985]"><Copy className="h-4 w-4" />คัดลอกสรุป</button>
            <button type="button" onClick={downloadCsv} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#9eebce] px-4 text-sm font-semibold text-[#101820] hover:bg-[#b6f3dc] focus:outline-none focus:ring-2 focus:ring-[#e0c985]"><Download className="h-4 w-4" />ดาวน์โหลด CSV</button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(220px,320px)_auto_1fr] sm:items-end">
          <label className="text-xs text-white/60">เรียงตาม
            <select value={sort} onChange={(event) => { const next = event.target.value as ContentSort; setSort(next); setDirection(next === "content" ? "asc" : "desc"); }} className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-[#151a20] px-3 text-sm text-white focus:border-[#e0c985] focus:outline-none">
              <option value="awareness">การมองเห็น</option><option value="intent">ความสนใจต่อ</option><option value="deep">การมีส่วนร่วมเชิงลึก</option><option value="coverage">ความครบถ้วนของข้อมูล</option><option value="published">วันที่เผยแพร่</option><option value="content">ตัวอักษร / เนื้อหา</option>
            </select>
          </label>
          <button type="button" onClick={() => setDirection((value) => value === "desc" ? "asc" : "desc")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 px-4 text-sm text-white/70 hover:bg-white/5">
            {direction === "desc" ? <ArrowDownAZ className="h-4 w-4" /> : <ArrowUpAZ className="h-4 w-4" />}{directionLabel()}
          </button>
          <div className="pb-3 text-xs text-white/40 sm:text-right">เรียง: {sortLabel()} · ทั้งหมด {posts.length.toLocaleString("th-TH")} โพสต์</div>
        </div>
        {notice ? <p role="status" className="mt-3 text-sm text-[#f4df9b]">{notice}</p> : null}
      </section>

      <ComparisonPanel posts={selected} onRemove={(id) => setSelectedIds((current) => current.filter((value) => value !== id))} />

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] lg:hidden" aria-label="รายการคอนเทนต์สำหรับวิเคราะห์บนมือถือ">
        <div className="grid grid-cols-[36px_minmax(0,1fr)_auto] gap-2 border-b border-white/10 bg-white/[0.035] px-3 py-2 text-[11px] text-white/45"><span /><span>เนื้อหา</span><span className="text-right">ค่าหลัก</span></div>
        {visible.map((post) => {
          const awareness = goalMetric(post, "awareness"); const intent = goalMetric(post, "intent"); const deep = goalMetric(post, "deep");
          const checked = selectedIds.includes(post.contentId);
          const primary = sort === "intent" ? intent : sort === "deep" ? deep : awareness;
          return <div key={post.contentId} className="grid grid-cols-[36px_minmax(0,1fr)_auto] gap-2 border-b border-white/8 px-3 py-3 last:border-b-0">
            <button type="button" onClick={() => toggleSelection(post)} aria-pressed={checked} aria-label="เลือกโพสต์เพื่อเปรียบเทียบ" className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg border ${checked ? "border-[#9eebce] bg-[#9eebce] text-[#101820]" : "border-white/15 text-transparent"}`}>{checked ? <Check className="h-4 w-4" /> : null}</button>
            <div className="min-w-0"><PostIdentity post={post} compact /><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/45"><span>การมองเห็น <strong className="text-white/75">{formatMarketingValue(awareness.value, awareness.unit, true)}</strong></span><span>ความสนใจต่อ <strong className="text-white/75">{formatMarketingValue(intent.value, intent.unit, true)}</strong></span><span>ส่วนร่วมเชิงลึก <strong className="text-white/75">{formatMarketingValue(deep.value, deep.unit, true)}</strong></span></div><div className="mt-2 flex flex-wrap gap-2"><QualityBadge post={post} /><CoverageBadge rate={post.metricCoverageRate} /></div></div>
            <div className="min-w-[78px] text-right"><div className="text-sm font-semibold text-white/90">{sort === "content" ? "A–Z" : sort === "published" ? new Date(post.publishedAtUtc).toLocaleDateString("th-TH", { day: "2-digit", month: "short", timeZone: "Asia/Bangkok" }) : sort === "coverage" ? formatMarketingValue(post.metricCoverageRate, "percent") : formatMarketingValue(primary.value, primary.unit, true)}</div><div className="mt-1 text-[10px] text-white/35">{sortLabel()}</div></div>
          </div>;
        })}
      </section>

      <div role="region" aria-label="ตารางคอนเทนต์สำหรับวิเคราะห์" tabIndex={0} className="hidden overflow-x-auto rounded-2xl border border-white/10 lg:block">
        <table className="min-w-[1240px] w-full border-collapse text-left text-sm">
          <thead className="sticky top-0 bg-[#181d23] text-[11px] text-white/55"><tr><th className="w-14 px-3 py-2"><span className="sr-only">เลือก</span></th><th className="min-w-[360px] px-4 py-1"><ContentSortHeader field="content" activeField={sort} direction={direction} onSort={setSortField}>เนื้อหา</ContentSortHeader></th><th className="px-4 py-1"><ContentSortHeader field="published" activeField={sort} direction={direction} onSort={setSortField}>เผยแพร่</ContentSortHeader></th><th className="px-4 py-1"><ContentSortHeader field="awareness" activeField={sort} direction={direction} onSort={setSortField} align="right">การมองเห็น</ContentSortHeader></th><th className="px-4 py-1"><ContentSortHeader field="intent" activeField={sort} direction={direction} onSort={setSortField} align="right">ความสนใจต่อ</ContentSortHeader></th><th className="px-4 py-1"><ContentSortHeader field="deep" activeField={sort} direction={direction} onSort={setSortField} align="right">ส่วนร่วมเชิงลึก</ContentSortHeader></th><th className="px-4 py-1"><ContentSortHeader field="coverage" activeField={sort} direction={direction} onSort={setSortField}>ความครบถ้วน</ContentSortHeader></th><th className="px-4 py-3 font-medium">คุณภาพ</th></tr></thead>
          <tbody>{visible.map((post) => {
            const awareness = goalMetric(post, "awareness"); const intent = goalMetric(post, "intent"); const deep = goalMetric(post, "deep"); const checked = selectedIds.includes(post.contentId);
            return <tr key={post.contentId} className="border-t border-white/10 text-white/75 hover:bg-white/[0.025]"><td className="px-3 py-3"><button type="button" onClick={() => toggleSelection(post)} aria-pressed={checked} aria-label="เลือกโพสต์เพื่อเปรียบเทียบ" className={`flex h-8 w-8 items-center justify-center rounded-lg border ${checked ? "border-[#9eebce] bg-[#9eebce] text-[#101820]" : "border-white/15 text-transparent hover:border-white/30"}`}>{checked ? <Check className="h-4 w-4" /> : null}</button></td><td className="px-4 py-3"><div className="flex gap-3"><PostThumbnail post={post} size="sm" /><PostIdentity post={post} compact /></div></td><td className="whitespace-nowrap px-4 py-3 text-xs text-white/55">{new Date(post.publishedAtUtc).toLocaleDateString("th-TH", { dateStyle: "medium", timeZone: "Asia/Bangkok" })}</td><td className="whitespace-nowrap px-4 py-3 text-right"><div className="font-semibold text-white/90">{formatMarketingValue(awareness.value, awareness.unit, true)}</div><div className="text-[10px] text-white/35">{awareness.shortLabel}</div></td><td className="whitespace-nowrap px-4 py-3 text-right"><div className="font-semibold text-white/90">{formatMarketingValue(intent.value, intent.unit, true)}</div><div className="text-[10px] text-white/35">{intent.shortLabel}</div></td><td className="whitespace-nowrap px-4 py-3 text-right"><div className="font-semibold text-white/90">{formatMarketingValue(deep.value, deep.unit, true)}</div><div className="text-[10px] text-white/35">{deep.shortLabel}</div></td><td className="px-4 py-3"><CoverageBadge rate={post.metricCoverageRate} /></td><td className="px-4 py-3"><QualityBadge post={post} /></td></tr>;
          })}</tbody>
        </table>
      </div>
      {visibleCount < sorted.length ? <div className="text-center"><button type="button" onClick={() => setVisibleCount((value) => value + 50)} className="min-h-11 rounded-xl border border-white/15 px-5 text-sm text-white/70 hover:bg-white/5">แสดงเพิ่มอีก {Math.min(50, sorted.length - visibleCount).toLocaleString("th-TH")} โพสต์</button></div> : null}
    </div>
  );
}
function BenchmarksTab({ posts }: { posts: MarketingPost[] }) {
  const [metricId, setMetricId] = useState<MarketingMetricId>("views");
  const definition = METRIC_DEFINITIONS.find((metric) => metric.id === metricId)!;
  const groupMap = new Map<string, { platform: MarketingPlatform; format: string; values: number[] }>();
  for (const post of posts) {
    const value = metricValue(post, metricId);
    if (value === null || !Number.isFinite(value)) continue;
    const key = `${post.platform}:${post.formatStandard}`;
    const group = groupMap.get(key) ?? { platform: post.platform, format: post.formatStandard, values: [] };
    group.values.push(value);
    groupMap.set(key, group);
  }
  const groups = [...groupMap.values()].map((group) => ({
    ...group,
    min: Math.min(...group.values),
    p25: percentile(group.values, 0.25) ?? 0,
    median: median(group.values) ?? 0,
    p75: percentile(group.values, 0.75) ?? 0,
    p90: percentile(group.values, 0.9) ?? 0,
    max: Math.max(...group.values),
  })).sort((a, b) => b.values.length - a.values.length || b.median - a.median);

  const ranked = posts.map((post) => {
    const value = metricValue(post, metricId);
    if (value === null || !Number.isFinite(value)) return null;
    const cohort = posts.filter((candidate) => candidate.platform === post.platform && candidate.formatStandard === post.formatStandard)
      .map((candidate) => metricValue(candidate, metricId)).filter((candidate): candidate is number => candidate !== null && Number.isFinite(candidate));
    return { post, value, percentile: percentileRank(value, cohort), cohortSize: cohort.length };
  }).filter((value): value is NonNullable<typeof value> => Boolean(value)).sort((a, b) => b.percentile - a.percentile || b.value - a.value).slice(0, 10);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">เปรียบเทียบอย่างเหมาะสม</p><h2 className="mt-2 text-2xl font-semibold">โพสต์นี้ดีแค่ไหนเมื่อเทียบกับโพสต์แบบเดียวกัน</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-white/55">เปรียบเทียบภายในแพลตฟอร์มและรูปแบบเดียวกัน พร้อมแสดงจำนวนตัวอย่างทุกครั้ง เพื่อไม่ให้ตัวเลขดูน่าเชื่อถือเกินข้อมูลที่มี</p></div><label className="min-w-[260px] text-xs text-white/60">เลือกตัวชี้วัด<select value={metricId} onChange={(event) => setMetricId(event.target.value as MarketingMetricId)} className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-[#151a20] px-3 text-sm text-white focus:border-[#e0c985] focus:outline-none">{METRIC_DEFINITIONS.map((metric) => <option key={metric.id} value={metric.id}>{metric.label}</option>)}</select></label></div>
        <div className="mt-4 rounded-2xl border border-[#e0c985]/15 bg-[#e0c985]/[0.05] p-4 text-sm leading-6 text-white/65"><strong className="text-[#f4df9b]">{definition.label}:</strong> {definition.description}</div>
      </section>

      {groups.length ? <section className="grid gap-4 xl:grid-cols-2">{groups.map((group) => {
        const status = group.values.length >= 20 ? "ใช้อ้างอิงได้" : group.values.length >= 10 ? "ใช้สำรวจ" : "ตัวอย่างยังน้อย";
        return <article key={`${group.platform}:${group.format}`} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-xs font-semibold text-[#f4df9b]">{PLATFORM_LABEL[group.platform]} · {FORMAT_LABEL[group.format] ?? group.format}</div><h3 className="mt-1 text-lg font-semibold">{definition.label}</h3></div><span className={`rounded-full border px-3 py-1 text-[11px] ${group.values.length >= 20 ? "border-emerald-200/20 bg-emerald-200/[0.06] text-emerald-100" : "border-white/10 bg-white/[0.04] text-white/55"}`}>{status} · n={group.values.length}</span></div><div className="mt-5"><BenchmarkBand min={group.min} p25={group.p25} median={group.median} p75={group.p75} p90={group.p90} max={group.max} unit={definition.unit} /></div></article>;
      })}</section> : <p className="rounded-2xl border border-dashed border-white/10 p-6 text-sm text-white/50">ตัวชี้วัดนี้ไม่มีข้อมูลในชุดกรองปัจจุบัน</p>}

      <section aria-labelledby="benchmark-leaders-title"><div><h2 id="benchmark-leaders-title" className="text-xl font-semibold">โพสต์ที่อยู่บนสุดของแต่ละกลุ่ม</h2><p className="mt-1 text-sm text-white/50">อันดับสูงไม่ได้แปลว่าสร้างยอดขาย แต่ช่วยหาโพสต์ที่ควรตรวจประโยคเปิด รูปแบบ และคำชวนให้ทำต่อ</p></div><div className="mt-4 grid gap-3 lg:grid-cols-2">{ranked.map((item) => <article key={item.post.contentId} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4"><div className="flex gap-3"><PostThumbnail post={item.post} size="sm" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><span className="rounded-full bg-[#9eebce]/10 px-2.5 py-1 text-[11px] font-semibold text-[#b6f3dc]">อันดับ {item.percentile}</span><span className="font-semibold">{formatMarketingValue(item.value, definition.unit, true)}</span></div><div className="mt-2"><PostIdentity post={item.post} compact /></div><p className="mt-2 text-[10px] text-white/35">เทียบกับ {item.cohortSize} โพสต์ในกลุ่มเดียวกัน</p></div></div></article>)}</div></section>
    </div>
  );
}

function CoverageRow({ row }: { row: MarketingDashboardData["coverage"][number] }) {
  const rate = row.availabilityRate === null ? null : Math.round(row.availabilityRate * 100);
  const status = row.notRequestedPosts === row.totalPosts ? "ยังไม่ได้ดึง" : row.permissionDeniedPosts || row.fetchErrorPosts ? "มีปัญหา" : rate !== null && rate >= 95 ? "พร้อมใช้" : "มีช่องว่าง";
  const statusClass = status === "พร้อมใช้" ? "text-emerald-100" : status === "มีปัญหา" ? "text-rose-100" : status === "ยังไม่ได้ดึง" ? "text-white/40" : "text-amber-100";
  return (
    <tr className="border-t border-white/10 text-white/70"><td className="px-4 py-3"><div className="font-medium text-white/80">{metricThaiLabel[row.metricKey] ?? row.metricKey}</div><div className="mt-0.5 text-[10px] text-white/35">{row.nativeMetricKey ?? "ไม่มี native key"}</div></td><td className="px-4 py-3">{PLATFORM_LABEL[row.platform]}</td><td className="px-4 py-3 text-right">{row.availablePosts.toLocaleString("th-TH")} / {row.eligiblePosts.toLocaleString("th-TH")}</td><td className="px-4 py-3 text-right">{rate === null ? "—" : `${rate}%`}</td><td className="px-4 py-3 text-right">{row.notReturnedPosts.toLocaleString("th-TH")}</td><td className="px-4 py-3 text-right">{row.notRequestedPosts.toLocaleString("th-TH")}</td><td className={`px-4 py-3 text-right text-xs font-medium ${statusClass}`}>{status}</td></tr>
  );
}

function QualityTab({ posts, coverage }: Pick<MarketingDashboardData, "posts" | "coverage">) {
  const ready = posts.filter((post) => qualityBucket(post) === "ready").length;
  const review = posts.filter((post) => qualityBucket(post) === "needs_review").length;
  const partial = posts.filter((post) => qualityBucket(post) === "partial").length;
  const medianCoverage = median(posts.map((post) => post.metricCoverageRate).filter((value): value is number => value !== null));
  const shareReview = posts.filter((post) => post.facebookShareQualityStatus === "needs_review").length;
  const reactionReview = posts.filter((post) => post.facebookReactionDefinitionStatus === "needs_review").length;
  const interactionReview = posts.filter((post) => post.instagramInteractionDefinitionStatus === "provider_definition_review").length;
  const errors = coverage.reduce((sum, row) => sum + row.permissionDeniedPosts + row.rateLimitedPosts + row.fetchErrorPosts, 0);
  const readyRate = posts.length ? ready / posts.length : 0;

  return (
    <div className="space-y-7">
      <section className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <article className="flex items-center gap-5 rounded-3xl border border-white/10 bg-white/[0.03] p-5"><div className="relative flex h-28 w-28 shrink-0 items-center justify-center rounded-full" style={{ background: `conic-gradient(#9eebce ${readyRate * 360}deg, rgba(255,255,255,0.08) 0deg)` }}><div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#151a20] text-xl font-semibold">{Math.round(readyRate * 100)}%</div></div><div><div className="text-sm font-semibold">พร้อมวิเคราะห์</div><div className="mt-1 text-2xl font-semibold">{ready.toLocaleString("th-TH")}</div><div className="text-xs text-white/45">จาก {posts.length.toLocaleString("th-TH")} โพสต์</div></div></article>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4"><MetricCard icon={<ShieldCheck className="h-5 w-5" />} label="พร้อมวิเคราะห์" value={ready.toLocaleString("th-TH")} helper="ข้อมูลหลักครบอย่างน้อย 80% และไม่มีจุดเตือนสำคัญ" tone="mint" /><MetricCard icon={<AlertTriangle className="h-5 w-5" />} label="ควรตรวจข้อมูล" value={review.toLocaleString("th-TH")} helper="ตัวชี้วัดบางส่วนยังใช้ได้ แต่ไม่ควรรวมเป็นคะแนนเดียวทันที" tone="warning" /><MetricCard icon={<Database className="h-5 w-5" />} label="ข้อมูลบางส่วน" value={partial.toLocaleString("th-TH")} helper="Meta ไม่ส่งตัวชี้วัดหลักบางรายการ" /><MetricCard icon={<CircleGauge className="h-5 w-5" />} label="ค่ากลางของความครบถ้วน" value={formatMarketingValue(medianCoverage, "percent")} helper="สัดส่วนตัวชี้วัดหลักที่มีข้อมูลต่อโพสต์" tone="gold" /></div>
      </section>

      <section><div><p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">การใช้ตัวเลขอย่างเหมาะสม</p><h2 className="mt-2 text-2xl font-semibold">ตัวเลขไหนใช้ได้ และตัวเลขไหนต้องอ่านพร้อมข้อจำกัด</h2></div><div className="mt-4 grid gap-3 lg:grid-cols-3"><article className="rounded-2xl border border-emerald-200/15 bg-emerald-200/[0.05] p-4"><div className="flex items-center gap-2 font-semibold text-emerald-100"><Check className="h-4 w-4" />ใช้ได้ทันที</div><p className="mt-2 text-sm leading-6 text-white/60">ยอดดูและยอดคลิกของ Facebook รวมถึงยอดดู บัญชีที่เข้าถึง การบันทึก และการแชร์ของ Instagram ใช้ดูผลงานตามนิยามของ Meta ได้ โดยไม่รวมข้ามแพลตฟอร์ม</p></article><article className="rounded-2xl border border-amber-200/15 bg-amber-200/[0.05] p-4"><div className="flex items-center gap-2 font-semibold text-amber-100"><AlertTriangle className="h-4 w-4" />ใช้พร้อมข้อจำกัด</div><p className="mt-2 text-sm leading-6 text-white/60">รายละเอียดปฏิกิริยา การมีส่วนร่วมทั้งหมดของ Instagram และยอดแชร์ของ Facebook บางโพสต์มีนิยามหรือค่าที่ต้องตรวจ ระบบจึงแสดงจุดเตือนแยก</p></article><article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><div className="flex items-center gap-2 font-semibold text-white/75"><Database className="h-4 w-4" />ยังไม่มี</div><p className="mt-2 text-sm leading-6 text-white/60">ยังไม่มีข้อมูลบัญชีที่เข้าถึงของ Facebook และยังแยกคอมเมนต์ของ CCPun ออกจากผู้ชมไม่ได้ ระบบจึงไม่สร้างอัตราที่ไม่มีหลักฐาน</p></article></div></section>

      <section><div><p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">จุดที่ควรตรวจ</p><h2 className="mt-2 text-2xl font-semibold">รายการที่ระบบไม่แก้ค่าให้เอง</h2></div><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard icon={<AlertTriangle className="h-5 w-5" />} label="ยอดแชร์ Facebook" value={shareReview.toLocaleString("th-TH")} helper="ยอดแชร์สูงผิดสังเกตเมื่อเทียบกับยอดปฏิกิริยาเดิม" tone="warning" /><MetricCard icon={<Layers3 className="h-5 w-5" />} label="นิยามปฏิกิริยา" value={reactionReview.toLocaleString("th-TH")} helper="ผลรวมรายประเภทไม่ตรงกับยอดปฏิกิริยาเดิม" tone="warning" /><MetricCard icon={<Database className="h-5 w-5" />} label="นิยามการมีส่วนร่วม Instagram" value={interactionReview.toLocaleString("th-TH")} helper="ยอดรวมจากแพลตฟอร์มไม่ตรงกับรายการย่อยที่เห็น" tone="warning" /><MetricCard icon={<ShieldCheck className="h-5 w-5" />} label="ปัญหาจากแพลตฟอร์ม" value={errors.toLocaleString("th-TH")} helper="รวมปัญหาสิทธิ์ ขีดจำกัด และการอ่านข้อมูล" tone={errors ? "warning" : "mint"} /></div></section>

      <section aria-labelledby="coverage-table-title"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 id="coverage-table-title" className="text-xl font-semibold">ความครบถ้วนของตัวชี้วัด</h2><p className="mt-1 text-sm text-white/50">ดูว่าแต่ละตัวชี้วัดมีข้อมูลจริงกี่โพสต์ โดยไม่ถือว่ารายการที่ขาดมีค่าเป็นศูนย์</p></div><span className="text-xs text-white/40">{coverage.length.toLocaleString("th-TH")} กลุ่มตัวชี้วัด</span></div><div role="region" aria-label="ตารางความครบถ้วนของตัวชี้วัด" tabIndex={0} className="mt-4 overflow-x-auto rounded-2xl border border-white/10"><table className="min-w-[980px] w-full border-collapse text-sm"><thead className="bg-white/[0.05] text-[11px] text-white/55"><tr><th className="px-4 py-3 text-left font-medium">ตัวชี้วัด</th><th className="px-4 py-3 text-left font-medium">แพลตฟอร์ม</th><th className="px-4 py-3 text-right font-medium">มีข้อมูล / ควรมี</th><th className="px-4 py-3 text-right font-medium">ความครบถ้วน</th><th className="px-4 py-3 text-right font-medium">Meta ไม่ส่ง</th><th className="px-4 py-3 text-right font-medium">ยังไม่ได้ขอ</th><th className="px-4 py-3 text-right font-medium">สถานะ</th></tr></thead><tbody>{coverage.map((row) => <CoverageRow key={`${row.platform}:${row.metricKey}`} row={row} />)}</tbody></table></div></section>

      <details className="rounded-2xl border border-white/10 bg-white/[0.025] p-4"><summary className="cursor-pointer list-none font-medium text-white/75"><span className="inline-flex items-center gap-2"><ChevronDown className="h-4 w-4" />คำอธิบายการตรวจข้อมูลแบบละเอียด</span></summary><div className="mt-4 space-y-3 text-sm leading-6 text-white/55"><p><strong className="text-white/75">ข้อมูลที่ขาดไม่เท่ากับศูนย์:</strong> ค่าว่างหมายถึง Meta ไม่ส่ง ไม่รองรับ หรือยังไม่ได้ดึง ส่วน 0 หมายถึง Meta ส่งค่าศูนย์จริง</p><p><strong className="text-white/75">ยอดปฏิกิริยาไม่ตรงกัน:</strong> ระบบเก็บยอดรวมเดิมและยอดแยกรายประเภทไว้แยกกัน เพราะช่วงเวลาหรือนิยามอาจต่างกัน</p><p><strong className="text-white/75">การมีส่วนร่วมทั้งหมดของ Instagram:</strong> เก็บยอดรวมจากแพลตฟอร์มแยกจากผลรวมยอดถูกใจ คอมเมนต์ แชร์ และบันทึก โดยไม่แก้ค่าให้เท่ากันเอง</p><p><strong className="text-white/75">ที่มาของคอมเมนต์:</strong> ยังหักคอมเมนต์ของ CCPun ออกจากคอมเมนต์ผู้ชมไม่ได้ จึงแสดงเฉพาะการมีส่วนร่วมที่ยืนยันได้</p></div></details>
    </div>
  );
}

export default function SocialMarketingDashboard({ data }: { data: MarketingDashboardData }) {
  const [tab, setTab] = useState<DashboardTab>("overview");
  const [goal, setGoal] = useState<MarketingGoal>("awareness");
  const [filters, setFilters] = useState<MarketingFilters>({ period: "90d", platform: "all", format: "all", quality: "all", search: "" });
  const reference = useMemo(() => referenceDate(data.posts, data.latestSnapshotAt), [data.latestSnapshotAt, data.posts]);
  const filtered = useMemo(() => filterMarketingPosts(data.posts, filters, reference), [data.posts, filters, reference]);
  const formats = useMemo(() => [...new Set(data.posts.map((post) => post.formatStandard))].sort(), [data.posts]);
  const ready = filtered.filter((post) => qualityBucket(post) === "ready").length;
  const needsReview = filtered.filter((post) => qualityBucket(post) === "needs_review").length;
  const medianCoverage = median(filtered.map((post) => post.metricCoverageRate).filter((value): value is number => value !== null));
  const latest = filtered.map((post) => post.snapshotAt).sort().at(-1) ?? data.latestSnapshotAt;

  function resetFilters() {
    setFilters({ period: "90d", platform: "all", format: "all", quality: "all", search: "" });
  }

  return (
    <div className="mt-7">
      <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-white/[0.055] via-white/[0.025] to-[#9eebce]/[0.035] p-5 sm:p-7">
        <div aria-hidden="true" className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#e0c985]/[0.06] blur-3xl" />
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-[#9eebce]/25 bg-[#9eebce]/[0.08] px-3 py-1 text-[11px] font-semibold text-[#b6f3dc]">ข้อมูลการตลาดที่ตรวจแล้ว</span><span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] text-white/50">{data.sourceMode === "clean-mart" ? "ข้อมูลจริงจาก Neon" : "ข้อมูลสำรองสำหรับหน้าทดสอบ"}</span></div><h2 className="mt-4 text-2xl font-semibold sm:text-3xl">เริ่มจากคำถามทางการตลาด ไม่ใช่เริ่มจากตารางดิบ</h2><p className="mt-3 text-sm leading-6 text-white/65">เลือกช่วงเวลาและเป้าหมาย แล้วดูโพสต์เด่น ค่ากลาง ตำแหน่งเทียบกลุ่ม ความครบถ้วน และข้อควรระวังได้ทันที</p></div>
          <div className="grid grid-cols-2 gap-2 sm:flex"><Link href="/analytics/social/?view=raw" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 px-4 text-sm text-white/70 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[#e0c985]"><Database className="h-4 w-4" />ข้อมูลต้นทาง</Link><Link href="/social/posts/" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 px-4 text-sm text-white/70 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[#e0c985]"><Layers3 className="h-4 w-4" />รายการโพสต์</Link></div>
        </div>
        <div className="relative mt-5 rounded-2xl border border-[#e0c985]/15 bg-[#e0c985]/[0.045] p-3.5 text-xs leading-5 text-white/55"><strong className="text-[#f4df9b]">อ่านให้ถูก:</strong> ช่วงเวลาที่เลือกหมายถึง “โพสต์ที่เผยแพร่ในช่วงนั้น” ส่วนค่าผลงานคือตัวเลขล่าสุดของแต่ละโพสต์ ไม่ใช่ยอดที่เกิดขึ้นเฉพาะในช่วงเวลาเดียวกัน</div>
      </section>

      <nav aria-label="ส่วนของสรุปผลการตลาด" className="mt-5 overflow-x-auto"><div role="tablist" className="inline-flex min-w-full gap-2 rounded-2xl border border-white/10 bg-white/[0.025] p-2 sm:min-w-0">{DASHBOARD_TABS.map((item) => { const Icon = item.icon; const active = tab === item.id; return <button key={item.id} role="tab" aria-selected={active} aria-controls={`marketing-panel-${item.id}`} type="button" onClick={() => setTab(item.id)} className={`min-h-12 shrink-0 rounded-xl px-4 py-2 text-left transition focus:outline-none focus:ring-2 focus:ring-[#e0c985] ${active ? "bg-[#9eebce] text-[#101820]" : "text-white/60 hover:bg-white/5 hover:text-white"}`}><span className="flex items-center gap-2 text-sm font-semibold"><Icon className="h-4 w-4" />{item.label}</span><span className={`mt-0.5 hidden text-[10px] sm:block ${active ? "text-[#101820]/65" : "text-white/35"}`}>{item.description}</span></button>; })}</div></nav>

      <section aria-labelledby="marketing-filter-title" className="mt-5 rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="marketing-filter-title" className="flex items-center gap-2 font-semibold"><Filter className="h-4 w-4 text-[#f4df9b]" />ตัวกรองกลาง</h2><p className="mt-1 text-xs text-white/45">ตัวกรองนี้ใช้กับทุกแท็บ ยกเว้นหน้าข้อมูลต้นทาง</p></div><button type="button" onClick={resetFilters} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs text-white/60 hover:bg-white/5"><RefreshCcw className="h-3.5 w-3.5" />กลับค่าเริ่มต้น</button></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(300px,1.4fr)_repeat(3,minmax(150px,0.7fr))_minmax(220px,1fr)]">
          <div><span className="text-xs text-white/55">ช่วงเวลา</span><div className="mt-1 grid grid-cols-5 gap-1 rounded-xl border border-white/10 bg-black/15 p-1">{(Object.keys(PERIOD_LABEL) as Array<keyof typeof PERIOD_LABEL>).map((period) => <button key={period} type="button" onClick={() => setFilters((current) => ({ ...current, period }))} aria-pressed={filters.period === period} className={`min-h-9 rounded-lg px-2 text-[11px] transition ${filters.period === period ? "bg-white/12 text-white" : "text-white/45 hover:bg-white/5"}`}>{period === "year" ? "ปีนี้" : period === "all" ? "ทั้งหมด" : period.replace("d", " วัน")}</button>)}</div></div>
          <label className="text-xs text-white/55">แพลตฟอร์ม<select value={filters.platform} onChange={(event) => setFilters((current) => ({ ...current, platform: event.target.value as MarketingFilters["platform"] }))} className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-[#151a20] px-3 text-sm text-white focus:border-[#e0c985] focus:outline-none"><option value="all">ทั้งหมด</option><option value="facebook">Facebook</option><option value="instagram">Instagram</option></select></label>
          <label className="text-xs text-white/55">รูปแบบ<select value={filters.format} onChange={(event) => setFilters((current) => ({ ...current, format: event.target.value }))} className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-[#151a20] px-3 text-sm text-white focus:border-[#e0c985] focus:outline-none"><option value="all">ทั้งหมด</option>{formats.map((value) => <option key={value} value={value}>{FORMAT_LABEL[value] ?? value}</option>)}</select></label>
          <label className="text-xs text-white/55">คุณภาพข้อมูล<select value={filters.quality} onChange={(event) => setFilters((current) => ({ ...current, quality: event.target.value as MarketingFilters["quality"] }))} className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-[#151a20] px-3 text-sm text-white focus:border-[#e0c985] focus:outline-none">{(Object.keys(QUALITY_LABEL) as Array<keyof typeof QUALITY_LABEL>).map((value) => <option key={value} value={value}>{QUALITY_LABEL[value]}</option>)}</select></label>
          <label className="text-xs text-white/55">ค้นหาคอนเทนต์<div className="relative mt-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" /><input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="พิมพ์คำจากโพสต์" className="min-h-11 w-full rounded-xl border border-white/15 bg-black/20 pl-10 pr-3 text-sm text-white placeholder:text-white/30 focus:border-[#e0c985] focus:outline-none" /></div></label>
        </div>
      </section>

      <section aria-label="ภาพรวมชุดข้อมูลที่กรอง" className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard icon={<Layers3 className="h-5 w-5" />} label="โพสต์ในชุดวิเคราะห์" value={filtered.length.toLocaleString("th-TH")} helper={`${PERIOD_LABEL[filters.period]} · ${filters.platform === "all" ? "ทุกแพลตฟอร์ม" : PLATFORM_LABEL[filters.platform]}`} tone="gold" />
        <MetricCard icon={<ShieldCheck className="h-5 w-5" />} label="พร้อมวิเคราะห์" value={ready.toLocaleString("th-TH")} helper="ข้อมูลครบอย่างน้อย 80% และไม่มีจุดเตือนสำคัญ" tone="mint" />
        <MetricCard icon={<AlertTriangle className="h-5 w-5" />} label="ควรตรวจข้อมูล" value={needsReview.toLocaleString("th-TH")} helper="ระบบเก็บค่าเดิมไว้ แต่ควรอ่านพร้อมข้อจำกัด" tone={needsReview ? "warning" : "mint"} />
        <MetricCard icon={<Clock3 className="h-5 w-5" />} label="ข้อมูลล่าสุด" value={latest ? new Date(latest).toLocaleDateString("th-TH", { dateStyle: "medium", timeZone: "Asia/Bangkok" }) : "—"} helper={`ค่ากลางของความครบถ้วน ${formatMarketingValue(medianCoverage, "percent")}`} />
      </section>

      {filtered.length === 0 ? <div className="mt-7 rounded-3xl border border-dashed border-white/10 p-8 text-center"><Search className="mx-auto h-8 w-8 text-white/30" /><h2 className="mt-3 font-semibold">ไม่พบโพสต์ตามตัวกรอง</h2><p className="mt-1 text-sm text-white/45">ลองล้างตัวกรองหรือเปลี่ยนช่วงเวลา</p></div> : (
        <div id={`marketing-panel-${tab}`} role="tabpanel" className="mt-8">
          {tab === "overview" ? <OverviewTab posts={filtered} goal={goal} setGoal={setGoal} /> : null}
          {tab === "content" ? <ContentTab posts={filtered} goal={goal} periodLabel={PERIOD_LABEL[filters.period]} /> : null}
          {tab === "benchmarks" ? <BenchmarksTab posts={filtered} /> : null}
          {tab === "quality" ? <QualityTab posts={filtered} coverage={data.coverage.filter((row) => filters.platform === "all" || row.platform === filters.platform)} /> : null}
        </div>
      )}

      <section className="mt-8 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <SocialSheetsExport />
        <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5"><div className="flex items-center gap-2 text-sm font-semibold"><FileSpreadsheet className="h-4 w-4 text-[#f4df9b]" />เอาข้อมูลไปใช้ต่อแบบไหนง่ายสุด</div><ol className="mt-4 space-y-3 text-sm leading-6 text-white/60"><li className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#9eebce]/10 text-xs font-semibold text-[#b6f3dc]">1</span><span>ดูโพสต์เด่นและข้อสังเกตในแท็บภาพรวม</span></li><li className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#9eebce]/10 text-xs font-semibold text-[#b6f3dc]">2</span><span>กรองและดาวน์โหลด CSV ในแท็บคอนเทนต์</span></li><li className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#9eebce]/10 text-xs font-semibold text-[#b6f3dc]">3</span><span>สร้าง Google Sheets เมื่อต้องส่งต่อหรือวิเคราะห์ระยะยาว</span></li></ol></article>
      </section>

      {data.sourceMode === "raw-fallback" ? <p className="mt-4 rounded-2xl border border-amber-200/15 bg-amber-200/[0.04] p-3 text-xs leading-5 text-amber-100/75">หน้าทดสอบนี้ใช้ข้อมูลต้นทางที่มีอยู่เพื่อทดสอบหน้าจอ ส่วนระบบจริงใช้ข้อมูลที่ตรวจและจัดรูปแบบแล้ว</p> : null}
    </div>
  );
}
