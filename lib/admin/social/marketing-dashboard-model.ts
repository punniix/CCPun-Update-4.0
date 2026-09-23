export type MarketingPlatform = "facebook" | "instagram";
export type MarketingPeriod = "30d" | "90d" | "180d" | "year" | "all";
export type MarketingQualityFilter = "all" | "ready" | "needs_review" | "partial";
export type MarketingGoal = "awareness" | "intent" | "deep";
export type MarketingMetricId =
  | "views"
  | "reach"
  | "clicks"
  | "click_rate_by_view"
  | "known_engagement_total"
  | "known_deep_engagement_total"
  | "engagement_rate_by_reach"
  | "deep_engagement_rate_by_reach"
  | "shares"
  | "saves"
  | "total_interactions"
  | "reel_average_watch_time_ms";

export type MarketingMetricUnit = "count" | "percent" | "milliseconds";

export type MarketingPost = {
  contentId: string;
  publicationId: string | null;
  provider: "meta";
  platform: MarketingPlatform;
  providerObjectId: string;
  permalink: string | null;
  thumbnail: string | null;
  text: string;
  providerMediaType: string;
  formatStandard: string;
  publishedAtUtc: string;
  publishedAtBkk: string;
  publishDateBkk: string;
  publishDayOfWeek: number;
  publishHourBkk: number;
  snapshotAt: string;
  postAgeHours: number | null;
  metricWindow: string;
  reactionsTotal: number | null;
  likes: number | null;
  commentsTotal: number | null;
  shares: number | null;
  saves: number | null;
  reach: number | null;
  impressions: number | null;
  views: number | null;
  clicks: number | null;
  totalInteractions: number | null;
  reactionLike: number | null;
  reactionLove: number | null;
  reactionCare: number | null;
  reactionWow: number | null;
  reactionHaha: number | null;
  reactionSad: number | null;
  reactionAngry: number | null;
  reelTotalWatchTimeMs: number | null;
  reelAverageWatchTimeMs: number | null;
  knownEngagementTotal: number | null;
  knownDeepEngagementTotal: number | null;
  knownEngagementRateByReach: number | null;
  knownDeepEngagementRateByReach: number | null;
  clicksPerView: number | null;
  expectedCoreMetricCount: number;
  availableCoreMetricCount: number;
  metricCoverageRate: number | null;
  engagementComponentsComplete: boolean;
  commentAttributionStatus: string;
  facebookShareQualityStatus: string | null;
  facebookShareQualityNote: string | null;
  facebookReactionDefinitionStatus: string;
  instagramInteractionDefinitionStatus: string;
  dataQualityStatus: string;
  analysisStatus: string;
};

export type MarketingCoverage = {
  provider: "meta";
  platform: MarketingPlatform;
  metricKey: string;
  nativeMetricKey: string | null;
  totalPosts: number;
  eligiblePosts: number;
  availablePosts: number;
  notReturnedPosts: number;
  notFetchedPosts: number;
  unsupportedPosts: number;
  notRequestedPosts: number;
  permissionDeniedPosts: number;
  rateLimitedPosts: number;
  fetchErrorPosts: number;
  availabilityRate: number | null;
};

export type MarketingDashboardData = {
  posts: MarketingPost[];
  coverage: MarketingCoverage[];
  latestSnapshotAt: string | null;
  sourceMode: "clean-mart" | "raw-fallback";
};

export type MarketingFilters = {
  period: MarketingPeriod;
  platform: "all" | MarketingPlatform;
  format: "all" | string;
  quality: MarketingQualityFilter;
  search: string;
};

export type MetricDefinition = {
  id: MarketingMetricId;
  label: string;
  shortLabel: string;
  unit: MarketingMetricUnit;
  platforms: MarketingPlatform[];
  description: string;
};

export type GoalMetric = {
  label: string;
  shortLabel: string;
  unit: MarketingMetricUnit;
  value: number | null;
};

export type Winner = {
  post: MarketingPost;
  metric: GoalMetric;
  percentile: number;
  cohortSize: number;
};

export type FormatBenchmark = {
  platform: MarketingPlatform;
  format: string;
  sampleSize: number;
  median: number;
  p75: number;
  p90: number;
  max: number;
  unit: MarketingMetricUnit;
  metricLabel: string;
};

export type WeeklyPoint = {
  week: string;
  label: string;
  sampleSize: number;
  median: number;
  unit: MarketingMetricUnit;
};

export type TimeSlot = {
  key: string;
  label: string;
  sampleSize: number;
  median: number;
  unit: MarketingMetricUnit;
};

export type MarketingInsight = {
  id: string;
  tone: "positive" | "warning" | "neutral";
  title: string;
  detail: string;
  action: string;
  sampleSize: number;
};

export const PLATFORM_LABEL: Record<MarketingPlatform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
};

export const FORMAT_LABEL: Record<string, string> = {
  text: "ข้อความ",
  image: "ภาพเดี่ยว",
  multi_image: "หลายภาพ",
  carousel: "คารูเซล",
  video: "วิดีโอ / Reel",
  reel: "Reel",
  story: "Story",
  link: "ลิงก์",
  other: "อื่น ๆ",
  mobile_status_update: "ข้อความ",
  added_photos: "ภาพ",
  added_video: "วิดีโอ",
  IMAGE: "ภาพเดี่ยว",
  VIDEO: "วิดีโอ / Reel",
  CAROUSEL_ALBUM: "คารูเซล",
};

export const PERIOD_LABEL: Record<MarketingPeriod, string> = {
  "30d": "30 วันล่าสุด",
  "90d": "90 วันล่าสุด",
  "180d": "180 วันล่าสุด",
  year: "ปีนี้",
  all: "ทั้งหมด",
};

export const GOAL_LABEL: Record<MarketingGoal, { label: string; description: string }> = {
  awareness: { label: "การมองเห็น", description: "Facebook ใช้จำนวนครั้งที่ดู · Instagram ใช้จำนวนบัญชีที่เข้าถึง" },
  intent: { label: "ความสนใจต่อ", description: "Facebook ใช้อัตราคลิก · Instagram ใช้อัตราบันทึกและแชร์" },
  deep: { label: "การมีส่วนร่วมเชิงลึก", description: "Facebook ใช้คอมเมนต์และแชร์ · Instagram ใช้อัตราการมีส่วนร่วมเชิงลึก" },
};

export const METRIC_DEFINITIONS: MetricDefinition[] = [
  { id: "views", label: "จำนวนครั้งที่ดู", shortLabel: "ครั้งที่ดู", unit: "count", platforms: ["facebook", "instagram"], description: "จำนวนครั้งที่ Meta รายงานว่าเนื้อหาถูกดู" },
  { id: "reach", label: "บัญชีที่เข้าถึง", shortLabel: "เข้าถึง", unit: "count", platforms: ["instagram"], description: "จำนวนบัญชีที่เห็นเนื้อหาบน Instagram" },
  { id: "clicks", label: "จำนวนคลิก", shortLabel: "คลิก", unit: "count", platforms: ["facebook"], description: "จำนวนการคลิกที่ Meta รายงานสำหรับโพสต์ Facebook" },
  { id: "click_rate_by_view", label: "อัตราคลิกต่อการดู", shortLabel: "อัตราคลิก", unit: "percent", platforms: ["facebook"], description: "จำนวนคลิกเทียบกับจำนวนครั้งที่ดู ใช้ดูว่าคนที่เห็นโพสต์สนใจคลิกต่อมากน้อยแค่ไหน" },
  { id: "known_engagement_total", label: "การมีส่วนร่วมที่ยืนยันได้", shortLabel: "มีส่วนร่วม", unit: "count", platforms: ["facebook", "instagram"], description: "ผลรวมการมีส่วนร่วมที่มีข้อมูลครบตามแพลตฟอร์ม" },
  { id: "known_deep_engagement_total", label: "การมีส่วนร่วมเชิงลึก", shortLabel: "ส่วนร่วมเชิงลึก", unit: "count", platforms: ["facebook", "instagram"], description: "คอมเมนต์ แชร์ และการบันทึกเมื่อแพลตฟอร์มรองรับ" },
  { id: "engagement_rate_by_reach", label: "อัตราการมีส่วนร่วมต่อการเข้าถึง", shortLabel: "อัตรามีส่วนร่วม", unit: "percent", platforms: ["instagram"], description: "การมีส่วนร่วมที่ยืนยันได้เทียบกับจำนวนบัญชีที่เข้าถึงบน Instagram" },
  { id: "deep_engagement_rate_by_reach", label: "อัตราการมีส่วนร่วมเชิงลึก", shortLabel: "อัตราเชิงลึก", unit: "percent", platforms: ["instagram"], description: "คอมเมนต์ แชร์ และบันทึก เทียบกับจำนวนบัญชีที่เข้าถึงบน Instagram" },
  { id: "shares", label: "จำนวนแชร์", shortLabel: "แชร์", unit: "count", platforms: ["facebook", "instagram"], description: "จำนวนครั้งที่แชร์ตามนิยามของ Meta" },
  { id: "saves", label: "จำนวนบันทึก", shortLabel: "บันทึก", unit: "count", platforms: ["instagram"], description: "จำนวนครั้งที่บันทึกโพสต์ Instagram" },
  { id: "total_interactions", label: "การมีส่วนร่วมทั้งหมดบน Instagram", shortLabel: "ส่วนร่วมทั้งหมด", unit: "count", platforms: ["instagram"], description: "ยอดรวมที่ Meta ส่งมา เก็บแยกจากผลรวมรายการย่อยเพื่อไม่แก้ค่าต้นทาง" },
  { id: "reel_average_watch_time_ms", label: "เวลาดู Reel โดยเฉลี่ย", shortLabel: "เวลาดูเฉลี่ย", unit: "milliseconds", platforms: ["instagram"], description: "เวลาเฉลี่ยที่ดู Reel ตามค่าต้นทางของ Meta" },
];

export function compactText(value: string, limit = 120) {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > limit ? `${clean.slice(0, Math.max(1, limit - 1))}…` : clean;
}

function finite(value: number | null | undefined): value is number {
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

export function qualityBucket(post: MarketingPost): Exclude<MarketingQualityFilter, "all"> {
  if (post.dataQualityStatus === "needs_review") return "needs_review";
  const coverage = post.metricCoverageRate ?? 0;
  if (coverage >= 0.8 && !["partial", "insufficient"].includes(post.analysisStatus)) return "ready";
  return "partial";
}

export function referenceDate(posts: MarketingPost[], explicit?: string | null) {
  const values = [explicit, ...posts.map((post) => post.snapshotAt), ...posts.map((post) => post.publishedAtUtc)]
    .filter((value): value is string => Boolean(value))
    .map((value) => Date.parse(value))
    .filter(Number.isFinite);
  return new Date(values.length ? Math.max(...values) : Date.now());
}

function periodStart(period: MarketingPeriod, reference: Date) {
  if (period === "all") return null;
  if (period === "year") return new Date(Date.UTC(reference.getUTCFullYear(), 0, 1));
  const days = period === "30d" ? 30 : period === "90d" ? 90 : 180;
  return new Date(reference.getTime() - days * 24 * 60 * 60 * 1000);
}

export function filterMarketingPosts(posts: MarketingPost[], filters: MarketingFilters, reference: Date) {
  const start = periodStart(filters.period, reference)?.getTime() ?? null;
  const keyword = filters.search.trim().toLocaleLowerCase("th-TH");
  return posts.filter((post) => {
    if (start !== null && Date.parse(post.publishedAtUtc) < start) return false;
    if (filters.platform !== "all" && post.platform !== filters.platform) return false;
    if (filters.format !== "all" && post.formatStandard !== filters.format) return false;
    if (filters.quality !== "all" && qualityBucket(post) !== filters.quality) return false;
    if (!keyword) return true;
    return [post.text, post.contentId, post.providerObjectId, post.platform, post.formatStandard, post.providerMediaType]
      .join(" ").toLocaleLowerCase("th-TH").includes(keyword);
  });
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

function metricValues(posts: MarketingPost[], metricId: MarketingMetricId) {
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

export function buildWinners(posts: MarketingPost[], goal: MarketingGoal, platform: MarketingPlatform, limit = 3): Winner[] {
  const candidates = posts.filter((post) => post.platform === platform)
    .map((post) => ({ post, metric: goalMetric(post, goal) }))
    .filter((item): item is { post: MarketingPost; metric: GoalMetric & { value: number } } => finite(item.metric.value));
  const byCohort = new Map<string, number[]>();
  for (const item of candidates) {
    const values = byCohort.get(item.post.formatStandard) ?? [];
    values.push(item.metric.value);
    byCohort.set(item.post.formatStandard, values);
  }
  return candidates.map((item) => {
    const cohort = byCohort.get(item.post.formatStandard) ?? [];
    return { post: item.post, metric: item.metric, percentile: percentileRank(item.metric.value, cohort), cohortSize: cohort.length };
  }).sort((a, b) => b.percentile - a.percentile || b.metric.value! - a.metric.value!).slice(0, limit);
}

export function buildFormatBenchmarks(posts: MarketingPost[], goal: MarketingGoal): FormatBenchmark[] {
  const groups = new Map<string, { platform: MarketingPlatform; format: string; values: number[]; unit: MarketingMetricUnit; label: string }>();
  for (const post of posts) {
    const metric = goalMetric(post, goal);
    if (!finite(metric.value)) continue;
    const key = `${post.platform}:${post.formatStandard}`;
    const group = groups.get(key) ?? { platform: post.platform, format: post.formatStandard, values: [], unit: metric.unit, label: metric.label };
    group.values.push(metric.value);
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => ({
    platform: group.platform,
    format: group.format,
    sampleSize: group.values.length,
    median: median(group.values) ?? 0,
    p75: percentile(group.values, 0.75) ?? 0,
    p90: percentile(group.values, 0.9) ?? 0,
    max: Math.max(...group.values),
    unit: group.unit,
    metricLabel: group.label,
  })).sort((a, b) => a.platform.localeCompare(b.platform) || b.median - a.median);
}

function weekStart(dateValue: string) {
  const date = new Date(dateValue);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

export function buildWeeklySeries(posts: MarketingPost[], goal: MarketingGoal, platform: MarketingPlatform): WeeklyPoint[] {
  const groups = new Map<string, number[]>();
  let unit: MarketingMetricUnit = "count";
  for (const post of posts) {
    if (post.platform !== platform) continue;
    const metric = goalMetric(post, goal);
    if (!finite(metric.value)) continue;
    unit = metric.unit;
    const key = weekStart(post.publishedAtUtc);
    const values = groups.get(key) ?? [];
    values.push(metric.value);
    groups.set(key, values);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([week, values]) => ({
    week,
    label: new Date(`${week}T00:00:00.000Z`).toLocaleDateString("th-TH", { day: "numeric", month: "short" }),
    sampleSize: values.length,
    median: median(values) ?? 0,
    unit,
  }));
}

const DAY_LABEL = ["", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"];

function timeBucket(hour: number) {
  if (hour >= 6 && hour < 12) return { key: "morning", label: "06:00–11:59" };
  if (hour >= 12 && hour < 16) return { key: "midday", label: "12:00–15:59" };
  if (hour >= 16 && hour < 21) return { key: "evening", label: "16:00–20:59" };
  return { key: "night", label: "21:00–05:59" };
}

export function buildTimeSlots(posts: MarketingPost[], goal: MarketingGoal, platform: MarketingPlatform, limit = 4): TimeSlot[] {
  const groups = new Map<string, { label: string; values: number[]; unit: MarketingMetricUnit }>();
  for (const post of posts) {
    if (post.platform !== platform) continue;
    const metric = goalMetric(post, goal);
    if (!finite(metric.value)) continue;
    const bucket = timeBucket(post.publishHourBkk);
    const key = `${post.publishDayOfWeek}:${bucket.key}`;
    const group = groups.get(key) ?? { label: `${DAY_LABEL[post.publishDayOfWeek] ?? "ไม่ระบุ"} · ${bucket.label}`, values: [], unit: metric.unit };
    group.values.push(metric.value);
    groups.set(key, group);
  }
  return [...groups.entries()].map(([key, group]) => ({
    key,
    label: group.label,
    sampleSize: group.values.length,
    median: median(group.values) ?? 0,
    unit: group.unit,
  })).filter((slot) => slot.sampleSize >= 3).sort((a, b) => b.median - a.median).slice(0, limit);
}

export function buildInsights(posts: MarketingPost[], goal: MarketingGoal): MarketingInsight[] {
  const insights: MarketingInsight[] = [];
  for (const platform of ["facebook", "instagram"] as const) {
    const platformPosts = posts.filter((post) => post.platform === platform);
    if (!platformPosts.length) continue;
    const awarenessValues = platformPosts.map((post) => goalMetric(post, "awareness").value).filter(finite);
    const intentValues = platformPosts.map((post) => goalMetric(post, "intent").value).filter(finite);
    const deepValues = platformPosts.map((post) => goalMetric(post, "deep").value).filter(finite);
    const awarenessP75 = percentile(awarenessValues, 0.75);
    const awarenessMedian = median(awarenessValues);
    const intentMedian = median(intentValues);
    const deepP75 = percentile(deepValues, 0.75);
    if (finite(awarenessP75) && finite(intentMedian)) {
      const count = platformPosts.filter((post) => {
        const awareness = goalMetric(post, "awareness").value;
        const intent = goalMetric(post, "intent").value;
        return finite(awareness) && finite(intent) && awareness >= awarenessP75 && intent <= intentMedian;
      }).length;
      if (count) insights.push({
        id: `${platform}-high-awareness-low-intent`,
        tone: "warning",
        title: `${PLATFORM_LABEL[platform]}: คนเห็นเยอะ แต่ไปต่อไม่มาก`,
        detail: `${count.toLocaleString("th-TH")} โพสต์อยู่กลุ่มการมองเห็นสูง แต่ความสนใจต่อไม่เกินค่ากลางของแพลตฟอร์ม`,
        action: "ลองปรับประโยคเปิดและคำชวนท้ายโพสต์ให้ชัดขึ้น แล้วเทียบยอดคลิก บันทึก และแชร์ในรอบถัดไป",
        sampleSize: platformPosts.length,
      });
    }
    if (finite(awarenessMedian) && finite(deepP75)) {
      const count = platformPosts.filter((post) => {
        const awareness = goalMetric(post, "awareness").value;
        const deep = goalMetric(post, "deep").value;
        return finite(awareness) && finite(deep) && awareness <= awarenessMedian && deep >= deepP75;
      }).length;
      if (count) insights.push({
        id: `${platform}-hidden-gems`,
        tone: "positive",
        title: `${PLATFORM_LABEL[platform]}: มีโพสต์ผลงานดีที่ควรนำกลับมาใช้`,
        detail: `${count.toLocaleString("th-TH")} โพสต์เข้าถึงไม่เกินค่ากลาง แต่สร้างการมีส่วนร่วมเชิงลึกระดับบน`,
        action: "นำประเด็นเดิมไปเขียนประโยคเปิดใหม่ เปลี่ยนปก หรือขยายเป็นบทความหรือเนื้อหาชุด",
        sampleSize: platformPosts.length,
      });
    }
  }
  const selectedValues = posts.map((post) => goalMetric(post, goal).value).filter(finite);
  const selectedP90 = percentile(selectedValues, 0.9);
  if (finite(selectedP90)) {
    const winners = posts.filter((post) => {
      const value = goalMetric(post, goal).value;
      return finite(value) && value >= selectedP90 && qualityBucket(post) !== "needs_review";
    }).length;
    if (winners) insights.push({
      id: "reusable-winners",
      tone: "positive",
      title: "มีคอนเทนต์ผู้ชนะที่พร้อมนำกลับมาใช้",
      detail: `${winners.toLocaleString("th-TH")} โพสต์อยู่กลุ่มบนของเป้าหมาย “${GOAL_LABEL[goal].label}” และไม่มีจุดเตือนสำคัญ`,
      action: "ทำภาคต่อ เปลี่ยนรูปแบบ หรือใช้เป็นต้นแบบในการเขียนโพสต์รอบใหม่",
      sampleSize: selectedValues.length,
    });
  }
  const review = posts.filter((post) => qualityBucket(post) === "needs_review").length;
  if (review) insights.push({
    id: "quality-review",
    tone: "neutral",
    title: "มีข้อมูลที่ควรอ่านพร้อมข้อจำกัด",
    detail: `${review.toLocaleString("th-TH")} โพสต์มีความต่างระหว่างยอดปฏิกิริยา ยอดมีส่วนร่วมทั้งหมด หรือยอดแชร์ Facebook`,
    action: "ใช้จำนวนครั้งที่ดู จำนวนบัญชีที่เข้าถึง และจำนวนคลิกได้ตามปกติ แต่ควรตรวจแท็บคุณภาพข้อมูลก่อนนำตัวชี้วัดที่มีคำเตือนไปสร้างคะแนนรวม",
    sampleSize: posts.length,
  });
  return insights.slice(0, 4);
}

function csvCell(value: string | number | boolean | null) {
  const text = value === null ? "" : String(value);
  const safe = typeof value === "string" && /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function buildMarketingCsv(posts: MarketingPost[]) {
  const headers = [
    "content_id", "platform", "format", "published_at_bkk", "text", "views", "reach", "clicks", "click_rate_by_view",
    "reactions_or_likes", "comments", "shares", "saves", "known_engagement", "known_deep_engagement",
    "engagement_rate_by_reach", "deep_engagement_rate_by_reach", "reel_average_watch_time_seconds",
    "metric_coverage_rate", "quality", "analysis_status", "permalink",
  ];
  const rows = posts.map((post) => [
    post.contentId,
    PLATFORM_LABEL[post.platform],
    FORMAT_LABEL[post.formatStandard] ?? post.formatStandard,
    post.publishedAtBkk,
    post.text,
    post.views,
    post.reach,
    post.clicks,
    post.clicksPerView,
    post.reactionsTotal ?? post.likes,
    post.commentsTotal,
    post.shares,
    post.saves,
    post.knownEngagementTotal,
    post.knownDeepEngagementTotal,
    post.knownEngagementRateByReach,
    post.knownDeepEngagementRateByReach,
    finite(post.reelAverageWatchTimeMs) ? post.reelAverageWatchTimeMs / 1000 : null,
    post.metricCoverageRate,
    qualityBucket(post),
    post.analysisStatus,
    post.permalink,
  ]);
  return `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
}

export function executiveSummary(posts: MarketingPost[], goal: MarketingGoal, periodLabel: string) {
  const facebook = posts.filter((post) => post.platform === "facebook");
  const instagram = posts.filter((post) => post.platform === "instagram");
  const fbAwareness = facebook.map((post) => goalMetric(post, "awareness").value).filter(finite);
  const fbIntent = facebook.map((post) => goalMetric(post, "intent").value).filter(finite);
  const igAwareness = instagram.map((post) => goalMetric(post, "awareness").value).filter(finite);
  const igDeep = instagram.map((post) => goalMetric(post, "deep").value).filter(finite);
  const reviewCount = posts.filter((post) => qualityBucket(post) === "needs_review").length;
  return [
    `สรุปผลการตลาด CCPun — ${periodLabel}`,
    `โพสต์ในชุดวิเคราะห์: ${posts.length.toLocaleString("th-TH")} รายการ`,
    `Facebook: ${facebook.length.toLocaleString("th-TH")} โพสต์ · ค่ากลางจำนวนครั้งที่ดู ${Math.round(median(fbAwareness) ?? 0).toLocaleString("th-TH")} · ค่ากลางอัตราคลิก ${((median(fbIntent) ?? 0) * 100).toLocaleString("th-TH", { maximumFractionDigits: 1 })}%`,
    `Instagram: ${instagram.length.toLocaleString("th-TH")} โพสต์ · ค่ากลางบัญชีที่เข้าถึง ${Math.round(median(igAwareness) ?? 0).toLocaleString("th-TH")} · ค่ากลางอัตราการมีส่วนร่วมเชิงลึก ${((median(igDeep) ?? 0) * 100).toLocaleString("th-TH", { maximumFractionDigits: 1 })}%`,
    `เป้าหมายที่เลือก: ${GOAL_LABEL[goal].label}`,
    `รายการที่ควรตรวจคุณภาพข้อมูล: ${reviewCount.toLocaleString("th-TH")}`,
    "หมายเหตุ: ตัวเลขเป็นค่าล่าสุดของโพสต์ที่เผยแพร่ในช่วงที่เลือก ไม่ใช่ยอดที่เกิดขึ้นเฉพาะในช่วงนั้น",
  ].join("\n");
}

export function fallbackPostsFromRaw(items: Array<{
  contentId: string | null;
  publicationId: string;
  linkedPublicationId: string | null;
  provider: "meta" | "youtube" | "tiktok";
  platform: "facebook" | "instagram" | "youtube" | "tiktok";
  platformObjectId: string;
  fetchedAt: string;
  format: string;
  mediaType: string | null;
  text: string | null;
  permalink: string | null;
  thumbnail: string | null;
  publishedAt: string | null;
  metrics: Array<{ key: string; value: number }>;
}>): MarketingPost[] {
  return items.filter((item): item is typeof item & { provider: "meta"; platform: MarketingPlatform } => (
    item.provider === "meta" && (item.platform === "facebook" || item.platform === "instagram")
  )).map((item) => {
    const metrics = new Map(item.metrics.map((metric) => [metric.key, metric.value]));
    const get = (...keys: string[]) => {
      for (const key of keys) {
        const value = metrics.get(key);
        if (finite(value)) return value;
      }
      return null;
    };
    const reactionsTotal = item.platform === "facebook" ? get("facebook.likes") : null;
    const likes = item.platform === "instagram" ? get("instagram.likes") : null;
    const comments = get(`${item.platform}.comments`);
    const shares = get(`${item.platform}.shares`);
    const saves = get(`${item.platform}.saves`);
    const reach = get(`${item.platform}.reach`);
    const views = get(`${item.platform}.views`);
    const clicks = get(`${item.platform}.clicks`);
    const knownEngagement = (finite(reactionsTotal) || finite(likes)) && finite(comments)
      ? (reactionsTotal ?? likes ?? 0) + comments + (shares ?? 0) + (saves ?? 0)
      : null;
    const knownDeep = finite(comments) ? comments + (shares ?? 0) + (saves ?? 0) : null;
    const publishedAt = item.publishedAt ?? item.fetchedAt;
    const bkk = new Date(publishedAt).toLocaleString("sv-SE", { timeZone: "Asia/Bangkok" }).replace("T", " ");
    const bkkDate = bkk.slice(0, 10);
    const bkkDateObject = new Date(`${bkkDate}T12:00:00.000Z`);
    const day = bkkDateObject.getUTCDay() || 7;
    return {
      contentId: item.contentId ?? item.publicationId,
      publicationId: item.linkedPublicationId,
      provider: "meta" as const,
      platform: item.platform,
      providerObjectId: item.platformObjectId,
      permalink: item.permalink,
      thumbnail: item.thumbnail,
      text: item.text ?? "",
      providerMediaType: item.mediaType ?? item.format,
      formatStandard: item.format,
      publishedAtUtc: publishedAt,
      publishedAtBkk: bkk,
      publishDateBkk: bkkDate,
      publishDayOfWeek: day,
      publishHourBkk: Number(bkk.slice(11, 13)) || 0,
      snapshotAt: item.fetchedAt,
      postAgeHours: null,
      metricWindow: "latest",
      reactionsTotal,
      likes,
      commentsTotal: comments,
      shares,
      saves,
      reach,
      impressions: null,
      views,
      clicks,
      totalInteractions: get("instagram.total_interactions"),
      reactionLike: get("facebook.reaction_like"),
      reactionLove: get("facebook.reaction_love"),
      reactionCare: get("facebook.reaction_care"),
      reactionWow: get("facebook.reaction_wow"),
      reactionHaha: get("facebook.reaction_haha"),
      reactionSad: get("facebook.reaction_sad"),
      reactionAngry: get("facebook.reaction_angry"),
      reelTotalWatchTimeMs: get("instagram.ig_reels_video_view_total_time"),
      reelAverageWatchTimeMs: get("instagram.ig_reels_avg_watch_time"),
      knownEngagementTotal: knownEngagement,
      knownDeepEngagementTotal: knownDeep,
      knownEngagementRateByReach: finite(reach) && reach > 0 && finite(knownEngagement) ? knownEngagement / reach : null,
      knownDeepEngagementRateByReach: finite(reach) && reach > 0 && finite(knownDeep) ? knownDeep / reach : null,
      clicksPerView: finite(views) && views > 0 && finite(clicks) ? clicks / views : null,
      expectedCoreMetricCount: 0,
      availableCoreMetricCount: item.metrics.length,
      metricCoverageRate: null,
      engagementComponentsComplete: false,
      commentAttributionStatus: "not_collected",
      facebookShareQualityStatus: null,
      facebookShareQualityNote: null,
      facebookReactionDefinitionStatus: "unavailable",
      instagramInteractionDefinitionStatus: "unavailable",
      dataQualityStatus: "usable_with_limitations",
      analysisStatus: "partial",
    };
  });
}
