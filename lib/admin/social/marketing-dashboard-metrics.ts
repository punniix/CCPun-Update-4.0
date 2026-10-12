import type { MarketingPost, MarketingMetricId, MarketingGoal, GoalMetric } from "./marketing-dashboard-model";

export function finite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function metricValue(post: MarketingPost, metricId: MarketingMetricId): number | null {
  switch (metricId) {
    case "views": return post.views;
    case "reach": return post.reach;
    case "clicks": return post.clicks;
    case "click_rate_by_view": return post.clicksPerView;
    case "known_engagement_total": return post.knownEngagementTotal;
    case "known_deep_engagement_total": return post.knownDeepEngagementTotal;
    case "engagement_rate_by_reach": return post.knownEngagementRateByReach;
    case "deep_engagement_rate_by_reach": return post.knownDeepEngagementRateByReach;
    case "shares": return post.shares;
    case "saves": return post.saves;
    case "total_interactions": return post.totalInteractions;
    case "reel_average_watch_time_ms": return post.reelAverageWatchTimeMs;
  }
}

export function goalMetric(post: MarketingPost, goal: MarketingGoal): GoalMetric {
  if (goal === "awareness") {
    return post.platform === "facebook"
      ? { label: "จำนวนครั้งที่ดู", shortLabel: "ครั้งที่ดู", unit: "count", value: post.views }
      : { label: "บัญชีที่เข้าถึง", shortLabel: "เข้าถึง", unit: "count", value: post.reach };
  }
  if (goal === "intent") {
    if (post.platform === "facebook") {
      return { label: "อัตราคลิกต่อการดู", shortLabel: "อัตราคลิก", unit: "percent", value: post.clicksPerView };
    }
    const value = finite(post.reach) && post.reach > 0 && (finite(post.saves) || finite(post.shares))
      ? ((post.saves ?? 0) + (post.shares ?? 0)) / post.reach
      : null;
    return { label: "อัตราบันทึกและแชร์", shortLabel: "บันทึกและแชร์", unit: "percent", value };
  }
  return post.platform === "facebook"
    ? { label: "คอมเมนต์และแชร์", shortLabel: "คอมเมนต์และแชร์", unit: "count", value: post.knownDeepEngagementTotal }
    : { label: "อัตราการมีส่วนร่วมเชิงลึก", shortLabel: "อัตราเชิงลึก", unit: "percent", value: post.knownDeepEngagementRateByReach };
}

export function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

export function percentile(values: number[], ratio: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * Math.min(1, Math.max(0, ratio));
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower]!;
  return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (position - lower);
}

export function percentileRank(value: number, values: number[]) {
  if (!values.length) return 0;
  let lower = 0;
  let equal = 0;
  for (const candidate of values) {
    if (candidate < value) lower += 1;
    else if (candidate === value) equal += 1;
  }
  return Math.max(1, Math.min(99, Math.round(((lower + equal * 0.5) / values.length) * 100)));
}

export function metricValues(posts: MarketingPost[], metricId: MarketingMetricId) {
  return posts.map((post) => metricValue(post, metricId)).filter(finite);
}

export function metricSummary(posts: MarketingPost[], metricId: MarketingMetricId) {
  const values = metricValues(posts, metricId);
  return {
    sampleSize: values.length,
    median: median(values),
    p25: percentile(values, 0.25),
    p75: percentile(values, 0.75),
    p90: percentile(values, 0.9),
    max: values.length ? Math.max(...values) : null,
    min: values.length ? Math.min(...values) : null,
  };
}
