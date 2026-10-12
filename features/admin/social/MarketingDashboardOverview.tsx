"use client";

import { useMemo } from "react";
import { AlertTriangle, Lightbulb, Sparkles, Target } from "lucide-react";
import {
  FORMAT_LABEL,
  GOAL_LABEL,
  PLATFORM_LABEL,
  buildFormatBenchmarks,
  buildInsights,
  buildTimeSlots,
  buildWeeklySeries,
  buildWinners,
  metricSummary,
  type FormatBenchmark,
  type MarketingGoal,
  type MarketingInsight,
  type MarketingMetricUnit,
  type MarketingPlatform,
  type MarketingPost,
} from "@/lib/admin/social/marketing-dashboard-model";
import {
  CoverageBadge,
  PostIdentity,
  PostThumbnail,
  QualityBadge,
  WeeklyMedianChart,
  formatMarketingValue,
} from "./MarketingDashboardVisuals";

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

export function OverviewTab({ posts, goal, setGoal }: { posts: MarketingPost[]; goal: MarketingGoal; setGoal: (goal: MarketingGoal) => void }) {
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

