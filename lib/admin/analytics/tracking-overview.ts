import type { AnalyticsDataset } from "./model";
import { canonicalizeMarketingUrl } from "./marketing-url";

type Cell = string | number | boolean | null;
type Row = Record<string, Cell>;

export const TRACKING_OVERVIEW_COLUMNS = [
  "ประเภทที่ติดตาม", "แพลตฟอร์ม / แหล่งข้อมูล", "รายงานต้นทาง", "ระดับข้อมูล", "รายการ", "ID อ้างอิง",
  "URL / หน้าเป้าหมาย", "Observed URL", "URL mapping", "วันที่", "Metric", "ค่า", "หน่วย", "บริบท", "Metric semantics",
  "ช่วงข้อมูลเริ่ม", "ช่วงข้อมูลสิ้นสุด", "ข้อมูลต้นทางถึง", "คุณภาพข้อมูล", "Batch ID", "ข้อจำกัด",
] as const;

export const CONTENT_PERFORMANCE_COLUMNS = [
  "ประเภทคอนเทนต์", "แพลตฟอร์ม / แหล่งข้อมูล", "คอนเทนต์ / หน้า", "URL", "Observed URLs", "URL mapping", "วันที่เผยแพร่",
  "Views", "Reach", "Clicks", "Interactions", "Comments", "Shares", "Saves",
  "Search Clicks", "Search Impressions", "Search CTR (%)", "Average Position",
  "Organic Sessions", "Engaged Sessions", "Engagement Rate (%)", "ID อ้างอิง",
  "ข้อมูลต้นทางถึง", "คุณภาพข้อมูล", "ข้อจำกัด",
] as const;

const number = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;
const text = (value: unknown): string | null => typeof value === "string" && value.trim() ? value.trim() : null;

function status(data: AnalyticsDataset) {
  if (data.lastAttemptStatus === "failed") return "ต้องตรวจสอบ";
  if (data.truncated) return "ข้อมูลบางส่วน";
  return "พร้อมใช้";
}
function limits(data: AnalyticsDataset) {
  return [...data.limitations, ...(data.truncated ? ["จำนวนแถวถูกจำกัด"] : [])].join(" | ");
}
function grain(data: AnalyticsDataset) {
  const labels: Partial<Record<AnalyticsDataset["report"], string>> = {
    "ga4-summary": "Summary",
    "gsc-summary": "Summary",
    "social-performance": "Content snapshot",
    "gsc-query-page": "Keyword × Page · period",
    "gsc-daily-query-page": "Keyword × Page × Day",
    "gsc-daily-page": "Page × Day",
    "ubersuggest-web-keywords": "Keyword snapshot",
    "seo-intelligence": "Keyword / Prompt snapshot",
    "ga4-daily-organic": "Page × Day",
    "ga4-organic-landing": "Landing Page · period",
    "ga4-session-performance": "Source / Campaign / Page × Day",
    "ga4-marketing-events": "Event × Day",
    "ga4-content-events": "Event × Page × Day",
  };
  return labels[data.report] ?? "Report row";
}
function semantics(data: AnalyticsDataset) {
  if (data.report === "social-performance") return "lifetime_snapshot";
  if (data.report === "ubersuggest-web-keywords" || data.report === "seo-intelligence") return "point_in_time_snapshot";
  return "period_activity";
}
function compact(parts: Array<string | null | undefined>) {
  return parts.filter((part): part is string => Boolean(part)).join(" | ");
}
function pushMetric(rows: Row[], data: AnalyticsDataset, input: {
  track: string; source: string; item: string | null; id?: string | null; url?: string | null; observedUrl?: string | null; mappingStatus?: string | null; date?: string | null;
  metric: string; value: number | null; unit: string; context?: string | null; metricSemantics?: string;
}) {
  if (input.value === null) return;
  rows.push({
    "ประเภทที่ติดตาม": input.track,
    "แพลตฟอร์ม / แหล่งข้อมูล": input.source,
    "รายงานต้นทาง": data.title,
    "ระดับข้อมูล": grain(data),
    "รายการ": input.item,
    "ID อ้างอิง": input.id ?? null,
    "URL / หน้าเป้าหมาย": input.url ?? null,
    "Observed URL": input.observedUrl ?? input.url ?? null,
    "URL mapping": input.mappingStatus ?? null,
    "วันที่": input.date ?? null,
    "Metric": input.metric,
    "ค่า": input.value,
    "หน่วย": input.unit,
    "บริบท": input.context ?? null,
    "Metric semantics": input.metricSemantics ?? semantics(data),
    "ช่วงข้อมูลเริ่ม": data.windowStart,
    "ช่วงข้อมูลสิ้นสุด": data.windowEnd,
    "ข้อมูลต้นทางถึง": data.sourceAsOf,
    "คุณภาพข้อมูล": status(data),
    "Batch ID": data.batchId,
    "ข้อจำกัด": limits(data),
  });
}

export function buildMarketingTrackingOverview(datasets: AnalyticsDataset[]) {
  const rows: Row[] = [];
  for (const data of datasets) {
    for (const row of data.rows) {
      if (data.report === "social-performance") {
        const platform = text(row["แพลตฟอร์ม"]);
        const link = canonicalizeMarketingUrl(row["ลิงก์โพสต์"]);
        const common = {
          track: "Content",
          source: platform ? "Meta · " + platform : "Meta",
          item: text(row["เนื้อหา"]) ?? text(row["Provider Object ID"]) ?? "โพสต์ Social",
          id: text(row["Provider Object ID"]),
          url: link.canonicalUrl,
          observedUrl: link.observedUrl,
          mappingStatus: link.mappingStatus,
          date: text(row["วันที่เผยแพร่ (UTC)"]),
          context: compact([text(row["รูปแบบ"]), text(row["Insights status"])]),
          metricSemantics: "lifetime_snapshot",
        };
        for (const [metric, key, unit] of [
          ["Views", "ยอดดู", "count"], ["Reach", "Reach", "count"], ["Clicks", "คลิก", "count"],
          ["Interactions", "Total interactions", "count"], ["Comments", "คอมเมนต์", "count"],
          ["Shares", "แชร์", "count"], ["Saves", "บันทึก", "count"],
        ] as const) pushMetric(rows, data, { ...common, metric, value: number(row[key]), unit });
        continue;
      }

      if (data.report === "gsc-query-page") {
        const page = canonicalizeMarketingUrl(row["หน้าเว็บ"]);
        const common = { track: "Keyword", source: "Google Search", item: text(row["คำค้น"]), url: page.canonicalUrl, observedUrl: page.observedUrl, mappingStatus: page.mappingStatus, context: "Search performance" };
        for (const [metric, key, unit] of [
          ["Clicks", "คลิก", "clicks"], ["Impressions", "การแสดงผล", "impressions"],
          ["CTR", "CTR (%)", "%"], ["Average Position", "อันดับเฉลี่ย", "position"],
        ] as const) pushMetric(rows, data, { ...common, metric, value: number(row[key]), unit });
        continue;
      }

      if (data.report === "ubersuggest-web-keywords") {
        const intent = text(row.Intent);
        const page = canonicalizeMarketingUrl(row["หน้าเว็บ"]);
        const common = {
          track: "Keyword",
          source: "Ubersuggest",
          item: text(row["คำค้น"]),
          url: page.canonicalUrl,
          observedUrl: page.observedUrl,
          mappingStatus: page.mappingStatus,
          context: compact([intent ? "Intent: " + intent : null, text(row["พื้นที่"]), text(row["ภาษา"])]),
          metricSemantics: "point_in_time_snapshot",
        };
        for (const [metric, key, unit] of [
          ["Search Volume", "Volume", "searches"], ["SEO Difficulty", "Difficulty (0–100)", "score"],
          ["Keyword Position", "อันดับ", "position"], ["Estimated Visits", "Estimated visits", "visits"],
        ] as const) pushMetric(rows, data, { ...common, metric, value: number(row[key]), unit });
        const cpc = number(row.CPC);
        if (cpc !== null) pushMetric(rows, data, { ...common, metric: "CPC", value: cpc, unit: text(row["สกุลเงิน CPC"]) ?? "currency" });
        continue;
      }

      if (data.report === "gsc-daily-query-page") {
        const page = canonicalizeMarketingUrl(row["หน้าเว็บ"]);
        const common = {
          track: "Keyword",
          source: "Google Search",
          item: text(row["คำค้น"]),
          url: page.canonicalUrl,
          observedUrl: page.observedUrl,
          mappingStatus: page.mappingStatus,
          date: text(row["วันที่"]),
          context: "Daily keyword × page performance",
        };
        for (const [metric, key, unit] of [
          ["Clicks", "คลิก", "clicks"], ["Impressions", "การแสดงผล", "impressions"],
          ["CTR", "CTR (%)", "%"], ["Average Position", "อันดับเฉลี่ย", "position"],
        ] as const) pushMetric(rows, data, { ...common, metric, value: number(row[key]), unit });
        continue;
      }
      if (data.report === "gsc-daily-page") {
        const page = canonicalizeMarketingUrl(row["หน้าเว็บ"]);
        const url = page.canonicalUrl;
        const common = { track: "Content", source: "Google Search", item: url, url, observedUrl: page.observedUrl, mappingStatus: page.mappingStatus, date: text(row["วันที่"]), context: "Daily page performance" };
        for (const [metric, key, unit] of [
          ["Search Clicks", "คลิก", "clicks"], ["Search Impressions", "การแสดงผล", "impressions"],
          ["Search CTR", "CTR (%)", "%"], ["Average Position", "อันดับเฉลี่ย", "position"],
        ] as const) pushMetric(rows, data, { ...common, metric, value: number(row[key]), unit });
        continue;
      }

      if (data.report === "ga4-daily-organic" || data.report === "ga4-organic-landing") {
        const page = canonicalizeMarketingUrl(row["หน้าเข้า"]);
        const url = page.canonicalUrl;
        const common = { track: "Content", source: "GA4 · Organic Search", item: url, url, observedUrl: page.observedUrl, mappingStatus: page.mappingStatus, date: text(row["วันที่"]), context: "Organic landing page" };
        for (const [metric, key, unit] of [
          ["Organic Sessions", "เซสชัน", "sessions"], ["Engaged Sessions", "Engaged sessions", "sessions"],
          ["Engagement Rate", "Engagement rate (%)", "%"],
        ] as const) pushMetric(rows, data, { ...common, metric, value: number(row[key]), unit });
        continue;
      }

      if (data.report === "ga4-session-performance") {
        const page = canonicalizeMarketingUrl(row["หน้าเข้า"]);
        const url = page.canonicalUrl;
        const common = {
          track: "Traffic", source: "GA4", item: url ?? text(row["แหล่งทราฟฟิก / Medium"]) ?? "Traffic", url, observedUrl: page.observedUrl, mappingStatus: page.mappingStatus,
          date: text(row["วันที่"]), context: compact([text(row["แหล่งทราฟฟิก / Medium"]), text(row["แคมเปญ"])]),
        };
        for (const [metric, key, unit] of [
          ["Sessions", "เซสชัน", "sessions"], ["Engaged Sessions", "Engaged sessions", "sessions"],
          ["Key Events", "Key events", "events"], ["Session Key Event Rate", "Session key event rate (%)", "%"],
        ] as const) pushMetric(rows, data, { ...common, metric, value: number(row[key]), unit });
        continue;
      }

      if (data.report === "ga4-marketing-events" || data.report === "ga4-content-events") {
        const event = text(row.Event) ?? "Event";
        pushMetric(rows, data, {
          track: data.report === "ga4-content-events" ? "Content Activity" : "Activity",
          source: "GA4", item: event, url: canonicalizeMarketingUrl(row["หน้าเว็บ"]).canonicalUrl, observedUrl: canonicalizeMarketingUrl(row["หน้าเว็บ"]).observedUrl, mappingStatus: canonicalizeMarketingUrl(row["หน้าเว็บ"]).mappingStatus, date: text(row["วันที่"]),
          metric: "Event Count", value: number(row["จำนวน event"]), unit: "events",
          context: data.report === "ga4-content-events" ? "Event ต่อหน้า" : event,
        });
        continue;
      }

      if (data.report === "gsc-summary") {
        for (const [metric, key, unit] of [
          ["Search Clicks", "คลิก", "clicks"], ["Search Impressions", "การแสดงผล", "impressions"],
          ["Search CTR", "CTR (%)", "%"], ["Average Position", "อันดับเฉลี่ย", "position"],
        ] as const) pushMetric(rows, data, { track: "Overview", source: "Google Search", item: "Search Performance", metric, value: number(row[key]), unit });
        continue;
      }

      if (data.report === "ga4-summary") {
        for (const [metric, key, unit] of [
          ["Users", "ผู้ใช้งาน", "users"], ["Sessions", "เซสชัน", "sessions"], ["Events", "เหตุการณ์", "events"],
        ] as const) pushMetric(rows, data, { track: "Overview", source: "GA4", item: "Website Performance", metric, value: number(row[key]), unit });
        continue;
      }

      if (data.report === "seo-intelligence") {
        const item = text(row["คำค้น / Prompt"]) ?? text(row["หัวข้อ / Scope"]) ?? "SEO / AI Search";
        const common = {
          track: "Keyword / AI Search", source: text(row["แหล่งข้อมูล"]) ?? "SEO Intelligence", item,
          context: compact([text(row["ประเภทข้อมูล"]), text(row.Intent), text(row["สถานะจับคู่"])]),
          metricSemantics: "point_in_time_snapshot",
        };
        for (const [metric, key, unit] of [
          ["Search Volume", "Volume", "searches"], ["SEO Difficulty", "Difficulty", "score"],
          ["AI Answers", "AI Answers", "count"], ["AI Mentions", "AI Mentions", "count"],
          ["AI Visibility", "AI Visibility (%)", "%"], ["AI Rank", "AI Rank", "position"],
        ] as const) pushMetric(rows, data, { ...common, metric, value: number(row[key]), unit });
      }
    }
  }

  const order: Record<string, number> = { Overview: 0, Content: 1, "Content Activity": 2, Keyword: 3, "Keyword / AI Search": 4, Traffic: 5, Activity: 6 };
  rows.sort((a, b) => (order[String(a["ประเภทที่ติดตาม"])] ?? 99) - (order[String(b["ประเภทที่ติดตาม"])] ?? 99)
    || String(a["รายการ"] ?? "").localeCompare(String(b["รายการ"] ?? ""), "th")
    || String(a.Metric ?? "").localeCompare(String(b.Metric ?? ""), "en"));
  return rows;
}

type ContentAccumulator = {
  type: string; source: string; item: string; url: string | null; publishedAt: string | null; id: string | null;
  values: Record<string, number | null>; observedUrls: Set<string>; mappingStatuses: Set<string>; sourceThrough: Set<string>; quality: Set<string>; limitations: Set<string>;
};
function contentKey(source: string, id: string | null, url: string | null, item: string) {
  return [source, id ?? "", url ?? "", item].join("\u0000");
}
function ensureContent(map: Map<string, ContentAccumulator>, input: Omit<ContentAccumulator, "values" | "observedUrls" | "mappingStatuses" | "sourceThrough" | "quality" | "limitations">) {
  const key = contentKey(input.source, input.id, input.url, input.item);
  const existing = map.get(key);
  if (existing) return existing;
  const created: ContentAccumulator = { ...input, values: {}, observedUrls: new Set(), mappingStatuses: new Set(), sourceThrough: new Set(), quality: new Set(), limitations: new Set() };
  map.set(key, created);
  return created;
}
function addDatasetMeta(target: ContentAccumulator, data: AnalyticsDataset) {
  if (data.sourceAsOf) target.sourceThrough.add(data.sourceAsOf);
  target.quality.add(status(data));
  for (const item of [...data.limitations, ...(data.truncated ? ["จำนวนแถวถูกจำกัด"] : [])]) target.limitations.add(item);
}

export function buildContentPerformanceRows(datasets: AnalyticsDataset[]) {
  const content = new Map<string, ContentAccumulator>();

  for (const data of datasets.filter((item) => item.report === "social-performance")) for (const row of data.rows) {
    const platform = text(row["แพลตฟอร์ม"]);
    const source = platform ? "Meta · " + platform : "Meta";
    const item = text(row["เนื้อหา"]) ?? text(row["Provider Object ID"]) ?? "โพสต์ Social";
    const link = canonicalizeMarketingUrl(row["ลิงก์โพสต์"]);
    const target = ensureContent(content, { type: "Social post", source, item, url: link.canonicalUrl, publishedAt: text(row["วันที่เผยแพร่ (UTC)"]), id: text(row["Provider Object ID"]) });
    if (link.observedUrl) target.observedUrls.add(link.observedUrl);
    target.mappingStatuses.add(link.mappingStatus);
    Object.assign(target.values, {
      Views: number(row["ยอดดู"]), Reach: number(row.Reach), Clicks: number(row["คลิก"]),
      Interactions: number(row["Total interactions"]), Comments: number(row["คอมเมนต์"]),
      Shares: number(row["แชร์"]), Saves: number(row["บันทึก"]),
    });
    addDatasetMeta(target, data);
  }

  const web = new Map<string, ContentAccumulator>();
  const webTarget = (urlValue: unknown) => {
    const identity = canonicalizeMarketingUrl(urlValue);
    const url = identity.canonicalUrl;
    if (!url) return null;
    let target = web.get(url);
    if (!target) {
      target = { type: "Web page", source: "Website", item: url, url, publishedAt: null, id: null, values: {}, observedUrls: new Set(), mappingStatuses: new Set(), sourceThrough: new Set(), quality: new Set(), limitations: new Set() };
      web.set(url, target);
    }
    if (identity.observedUrl) target.observedUrls.add(identity.observedUrl);
    target.mappingStatuses.add(identity.mappingStatus);
    return target;
  };

  for (const data of datasets.filter((item) => item.report === "gsc-daily-page")) {
    const byUrl = new Map<string, { clicks: number; impressions: number; weightedPosition: number; observedUrls: Set<string>; mappingStatuses: Set<string> }>();
    for (const row of data.rows) {
      const identity = canonicalizeMarketingUrl(row["หน้าเว็บ"]);
      const url = identity.canonicalUrl; if (!url) continue;
      const current = byUrl.get(url) ?? { clicks: 0, impressions: 0, weightedPosition: 0, observedUrls: new Set<string>(), mappingStatuses: new Set<string>() };
      if (identity.observedUrl) current.observedUrls.add(identity.observedUrl);
      current.mappingStatuses.add(identity.mappingStatus);
      const clicks = number(row["คลิก"]) ?? 0, impressions = number(row["การแสดงผล"]) ?? 0, position = number(row["อันดับเฉลี่ย"]);
      current.clicks += clicks; current.impressions += impressions; current.weightedPosition += position === null ? 0 : position * impressions;
      byUrl.set(url, current);
    }
    for (const [url, values] of byUrl) {
      const target = webTarget(url)!;
      for (const observed of values.observedUrls) target.observedUrls.add(observed);
      for (const mapping of values.mappingStatuses) target.mappingStatuses.add(mapping);
      target.values["Search Clicks"] = values.clicks;
      target.values["Search Impressions"] = values.impressions;
      target.values["Search CTR (%)"] = values.impressions ? values.clicks * 100 / values.impressions : null;
      target.values["Average Position"] = values.impressions ? values.weightedPosition / values.impressions : null;
      addDatasetMeta(target, data);
    }
  }

  for (const data of datasets.filter((item) => item.report === "ga4-daily-organic" || item.report === "ga4-organic-landing")) for (const row of data.rows) {
    const target = webTarget(row["หน้าเข้า"]); if (!target) continue;
    target.values["Organic Sessions"] = (target.values["Organic Sessions"] ?? 0) + (number(row["เซสชัน"]) ?? 0);
    target.values["Engaged Sessions"] = (target.values["Engaged Sessions"] ?? 0) + (number(row["Engaged sessions"]) ?? 0);
    addDatasetMeta(target, data);
  }
  for (const target of web.values()) {
    const sessions = target.values["Organic Sessions"], engaged = target.values["Engaged Sessions"];
    if (sessions !== null && sessions !== undefined && engaged !== null && engaged !== undefined) target.values["Engagement Rate (%)"] = sessions ? engaged * 100 / sessions : null;
    content.set(contentKey(target.source, target.id, target.url, target.item), target);
  }

  return [...content.values()].map((item) => ({
    "ประเภทคอนเทนต์": item.type,
    "แพลตฟอร์ม / แหล่งข้อมูล": item.source,
    "คอนเทนต์ / หน้า": item.item,
    "URL": item.url,
    "Observed URLs": [...item.observedUrls].sort().join(" | ") || item.url,
    "URL mapping": item.mappingStatuses.has("legacy-unresolved") ? "legacy-unresolved" : item.mappingStatuses.has("redirected") ? "redirected" : item.mappingStatuses.has("external") ? "external" : "current",
    "วันที่เผยแพร่": item.publishedAt,
    "Views": item.values.Views ?? null,
    "Reach": item.values.Reach ?? null,
    "Clicks": item.values.Clicks ?? null,
    "Interactions": item.values.Interactions ?? null,
    "Comments": item.values.Comments ?? null,
    "Shares": item.values.Shares ?? null,
    "Saves": item.values.Saves ?? null,
    "Search Clicks": item.values["Search Clicks"] ?? null,
    "Search Impressions": item.values["Search Impressions"] ?? null,
    "Search CTR (%)": item.values["Search CTR (%)"] ?? null,
    "Average Position": item.values["Average Position"] ?? null,
    "Organic Sessions": item.values["Organic Sessions"] ?? null,
    "Engaged Sessions": item.values["Engaged Sessions"] ?? null,
    "Engagement Rate (%)": item.values["Engagement Rate (%)"] ?? null,
    "ID อ้างอิง": item.id,
    "ข้อมูลต้นทางถึง": [...item.sourceThrough].sort().at(-1) ?? null,
    "คุณภาพข้อมูล": item.quality.has("ต้องตรวจสอบ") ? "ต้องตรวจสอบ" : item.quality.has("ข้อมูลบางส่วน") ? "ข้อมูลบางส่วน" : "พร้อมใช้",
    "ข้อจำกัด": [...item.limitations].join(" | "),
  }));
}
