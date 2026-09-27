import "server-only";
import { z } from "zod";
import { getGoogleDataAccessToken } from "../seo-intelligence/google-data-auth";
import { getSeoGoogleProviderReadiness } from "../seo-intelligence/provider-readiness";
import { fetchGscSearchAnalytics, fetchGscSearchAnalyticsTotals } from "../seo-intelligence/providers/gsc";
import { fetchGa4LandingPages } from "../seo-intelligence/providers/ga4";
import { fetchMetaReadOnlyDiscovery } from "../social/providers/meta/read-only";
import { getUbersuggestDashboardData } from "../ubersuggest-dashboard";
import type { ResearchSnapshotList } from "../research";
import { buildSeoIntelligenceExport } from "../agent-os/export-datasets";
import { analyticsDatasetSchema, analyticsDate, analyticsHash, sanitizeAnalyticsRaw, shiftAnalyticsDate, type AnalyticsDataset, type AnalyticsReport, type AnalyticsSource, type RawAnalyticsPage } from "./model";
import { beginAnalyticsCollection, finishAnalyticsCollection, readAnalyticsResearch } from "./store";

type FetchLike = typeof fetch;
const ga4SummarySchema = z.object({
  metricHeaders: z.array(z.object({ name: z.string() })),
  totals: z.array(z.object({ metricValues: z.array(z.object({ value: z.string() })) })),
  metadata: z.object({ timeZone: z.string().optional(), subjectToThresholding: z.boolean().optional(), dataLossFromOtherRow: z.boolean().optional(), samplingMetadatas: z.array(z.unknown()).optional() }).optional(),
});
export function normalizeGa4Summary(raw: unknown) {
  const report = ga4SummarySchema.parse(raw);
  if (report.metricHeaders.map((value) => value.name).join(",") !== "activeUsers,sessions,eventCount" || report.totals.length !== 1) throw new Error("GA4_INVALID_RESPONSE");
  const values = report.totals[0]!.metricValues.map((value) => Number(value.value));
  if (values.length !== 3 || report.totals[0]!.metricValues.some((value) => !/^\d+$/.test(value.value)) || values.some((value) => !Number.isSafeInteger(value) || value < 0)) throw new Error("GA4_INVALID_RESPONSE");
  return { activeUsers: values[0]!, sessions: values[1]!, eventCount: values[2]!, timeZone: report.metadata?.timeZone ?? null,
    limitations: [...(report.metadata?.subjectToThresholding ? ["GA4 applied data thresholding"] : []), ...(report.metadata?.dataLossFromOtherRow ? ["GA4 grouped rows into (other)"] : []), ...(report.metadata?.samplingMetadatas?.length ? ["GA4 sampled this report"] : [])] };
}

export async function collectAnalyticsSource(source: AnalyticsSource, date = analyticsDate(), variables: Record<string, string | undefined> = process.env, fetcher: FetchLike = fetch) {
  const deadline = Date.now() + 90_000;
  const claim = await beginAnalyticsCollection(source, date, variables);
  if (claim.status !== "claimed") return { source, status: claim.status === "completed" ? "duplicate" : claim.status, batchId: claim.batchId };
  const raw: RawAnalyticsPage[] = [];
  const collectedAt = new Date().toISOString();
  const timedFetch: FetchLike = async (url, init) => {
    if (Date.now() > deadline) throw new Error("ANALYTICS_SOURCE_UNAVAILABLE");
    return fetcher(url, { ...init, redirect: "error", signal: AbortSignal.any([...(init?.signal ? [init.signal] : []), AbortSignal.timeout(Math.max(1, deadline - Date.now()))]) });
  };
  const capturedFetch = (report: AnalyticsReport): FetchLike => async (url, init) => {
    const response = await timedFetch(url, init);
    if (response.ok || source === "meta") {
      const body = sanitizeAnalyticsRaw(await response.clone().json());
      const resource = new URL(url instanceof Request ? url.url : String(url));
      const requestMeta = { path: resource.origin + resource.pathname, parameters: sanitizeAnalyticsRaw({ ...Object.fromEntries(resource.searchParams), ...(typeof init?.body === "string" ? { query: JSON.parse(init.body) } : {}) }) };
      raw.push({ report, page: raw.filter((item) => item.report === report).length, collectedAt: new Date().toISOString(), body, canonicalJson: JSON.stringify({ body, requestMeta }), hash: analyticsHash({ body, requestMeta }), requestMeta, origin: "provider-response" });
    }
    return response;
  };
  const dataset = (report: AnalyticsReport, value: Partial<AnalyticsDataset> & Pick<AnalyticsDataset, "title" | "columns" | "rows">): AnalyticsDataset => analyticsDatasetSchema.parse({ report, source, batchId: claim.batchId, collectedAt,
    sourceAsOf: collectedAt, windowStart: null, windowEnd: null, nativeTimeZone: null, overview: [], limitations: [], truncated: false,
    rawHash: analyticsHash(raw.filter((item) => item.report === report).map((item) => item.hash)), lastAttemptAt: collectedAt, lastAttemptStatus: "completed", ...value });
  let reports: AnalyticsDataset[];
  try {
    if (source === "gsc" || source === "ga4") {
      if (getSeoGoogleProviderReadiness(source, variables).status !== "manual-sync-ready") throw new Error("ANALYTICS_NOT_CONFIGURED");
      // Provider processing delays differ. Recollect rolling windows daily to preserve late revisions.
      const windowEnd = shiftAnalyticsDate(date, source === "gsc" ? -3 : -1);
      const windowStart = shiftAnalyticsDate(windowEnd, -27);
      const token = await getGoogleDataAccessToken(variables, timedFetch);
      if (source === "gsc") {
        const input = { siteUrl: variables.CCPUN_GSC_SITE_URL!.trim(), token, startDate: windowStart, endDate: windowEnd, dimensions: ["query", "page"], rowLimit: 25_000 };
        const [summary, detail] = await Promise.all([fetchGscSearchAnalyticsTotals(input, capturedFetch("gsc-summary")), fetchGscSearchAnalytics(input, capturedFetch("gsc-query-page"))]);
        reports = [dataset("gsc-summary", { title: "Google Search Console · ภาพรวม", windowStart, windowEnd, nativeTimeZone: "America/Los_Angeles", columns: ["คลิก", "การแสดงผล", "CTR (%)", "อันดับเฉลี่ย"], rows: [{ "คลิก": summary.totals.clicks, "การแสดงผล": summary.totals.impressions, "CTR (%)": summary.totals.impressions ? summary.totals.ctr * 100 : null, "อันดับเฉลี่ย": summary.totals.position }], limitations: ["ข้อมูล web search แบบ final; ไม่รวม 3 วันล่าสุด; รายงานภาพรวมไม่แบ่ง dimension"] }),
          dataset("gsc-query-page", { title: "Google Search Console · คำค้นและหน้า", windowStart, windowEnd, nativeTimeZone: "America/Los_Angeles", columns: ["คำค้น", "หน้าเว็บ", "คลิก", "การแสดงผล", "CTR (%)", "อันดับเฉลี่ย"], rows: detail.rows.map((row) => ({ "คำค้น": row.dimensions.query ?? "", "หน้าเว็บ": row.dimensions.page ?? "", "คลิก": row.clicks, "การแสดงผล": row.impressions, "CTR (%)": row.impressions ? row.ctr * 100 : null, "อันดับเฉลี่ย": row.impressions ? row.position : null })), truncated: detail.truncated, limitations: [detail.limitation, "ไม่รวมคำค้น anonymized; ยอด detail อาจต่างจาก summary; ห้ามเฉลี่ย CTR/อันดับข้ามแถวตรง ๆ"] })];
      } else {
        const [summaryResponse, detail] = await Promise.all([
          capturedFetch("ga4-summary")(`https://analyticsdata.googleapis.com/v1beta/properties/${variables.CCPUN_GA4_PROPERTY_ID!.trim()}:runReport`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ dateRanges: [{ startDate: windowStart, endDate: windowEnd }], metrics: [{ name: "activeUsers" }, { name: "sessions" }, { name: "eventCount" }], metricAggregations: ["TOTAL"], returnPropertyQuota: true }), signal: AbortSignal.timeout(15_000), cache: "no-store" }),
          fetchGa4LandingPages({ propertyId: variables.CCPUN_GA4_PROPERTY_ID, token, startDate: windowStart, endDate: windowEnd, rowLimit: 10_000 }, capturedFetch("ga4-organic-landing")),
        ]);
        if (!summaryResponse.ok) throw new Error("GA4_PROVIDER_UNAVAILABLE");
        const summary = normalizeGa4Summary(await summaryResponse.json());
        reports = [dataset("ga4-summary", { title: "GA4 · ภาพรวมทุกช่องทาง", windowStart, windowEnd, nativeTimeZone: summary.timeZone, columns: ["ผู้ใช้งาน", "เซสชัน", "เหตุการณ์"], rows: [{ "ผู้ใช้งาน": summary.activeUsers, "เซสชัน": summary.sessions, "เหตุการณ์": summary.eventCount }], limitations: [...summary.limitations, "ยอดรวมทุกช่องทาง; จำนวนผู้ใช้เป็น distinct ในช่วงนี้ ห้ามรวมข้ามรายงาน; ไม่รวมวันนี้"] }),
          dataset("ga4-organic-landing", { title: "GA4 · หน้าเข้า Organic Search", windowStart, windowEnd, nativeTimeZone: detail.timeZone, columns: ["หน้าเข้า", "เซสชัน", "Engaged sessions", "Engagement rate (%)"], rows: detail.rows.map((row) => ({ "หน้าเข้า": row.landingPage, "เซสชัน": row.sessions, "Engaged sessions": row.engagedSessions, "Engagement rate (%)": row.sessions ? row.engagementRate * 100 : null })), limitations: [...detail.limitations, "เฉพาะ Organic Search; ไม่รวม landingPage ที่ (not set); ไม่ใช่ยอดทุกช่องทาง"], truncated: detail.truncated })];
      }
    } else if (source === "meta") {
      const discovery = await fetchMetaReadOnlyDiscovery(variables, capturedFetch("social-performance"), { includeInsights: true, insightsBackfillLimit: 50 });
      if (discovery.status !== "connected") throw new Error("META_READ_NOT_CONFIGURED");
      const metricLabels: Record<string, string> = { views: "ยอดดู", reach: "Reach", clicks: "คลิก", likes: "ปฏิกิริยา / Like", comments: "คอมเมนต์", shares: "แชร์", saves: "บันทึก", totalInteractions: "Total interactions", reelTotalWatchTimeMs: "Reel watch time (ms)", reelAverageWatchTimeMs: "Reel average watch time (ms)", reactionLike: "Reaction Like", reactionLove: "Reaction Love", reactionCare: "Reaction Care", reactionWow: "Reaction Wow", reactionHaha: "Reaction Haha", reactionSad: "Reaction Sad", reactionAngry: "Reaction Angry" };
      const items = [...discovery.facebookPosts.map((item) => ({ ...item, platform: "Facebook" })), ...discovery.instagramMedia.map((item) => ({ ...item, platform: "Instagram" }))];
      const rows = items.map((item) => ({ "แพลตฟอร์ม": item.platform, "Provider Object ID": item.id, "วันที่เผยแพร่ (UTC)": item.publishedAt, "เนื้อหา": item.text, "รูปแบบ": item.mediaType, "ลิงก์โพสต์": item.permalink, "Insights status": raw.some((page) => page.requestMeta?.path.endsWith(`/${item.id}/insights`) && page.body && typeof page.body === "object" && "error" in page.body) ? "provider-error; see private raw" : Object.keys(item.metrics).some((key) => ["views", "reach", "clicks", "saves", "totalInteractions"].includes(key) && (item.metrics as Record<string, unknown>)[key] != null) ? "partial-or-available" : "not-returned-or-not-fetched",
        ...Object.fromEntries(Object.entries(metricLabels).map(([key, label]) => [label, (item.metrics as Record<string, unknown>)[key] ?? null])) }));
      reports = [dataset("social-performance", { title: "Meta · ผลงานโพสต์", sourceAsOf: discovery.fetchedAt, nativeTimeZone: null, columns: ["แพลตฟอร์ม", "Provider Object ID", "วันที่เผยแพร่ (UTC)", "เนื้อหา", "รูปแบบ", "ลิงก์โพสต์", "Insights status", ...Object.values(metricLabels)], rows: rows as AnalyticsDataset["rows"],
        overview: [{ label: "โพสต์", value: rows.length }, { label: "Insights ล่าสุดต่อแพลตฟอร์ม", value: discovery.insightBackfillLimit }],
        limitations: ["Provider response pages และ insight period/end_time เก็บใน raw ก่อน normalize", "อ่าน metadata ได้สูงสุด 10,000 โพสต์; insights เฉพาะ 50 โพสต์ล่าสุดต่อแพลตฟอร์ม; ช่องว่าง = ไม่ได้ดึง/ไม่รองรับ/ไม่คืนค่า", "ตัวเลขเป็น snapshot native ต่อโพสต์ ไม่ใช่ยอดรายวัน; FB reactions และ IG likes มีความหมายต่างกัน; ห้ามรวม Reach ข้ามแพลตฟอร์ม", "Normalized insights ใช้ total_value หรือค่าล่าสุด; series/period เดิมอยู่ใน raw"] })];
    } else {
      const body = { research: { rows: await readAnalyticsResearch(variables), error: null }, dashboard: await getUbersuggestDashboardData(100) };
      const report = "seo-intelligence" as const;
      const sanitized = sanitizeAnalyticsRaw(body);
      raw.push({ report, page: 0, collectedAt, body: sanitized, canonicalJson: JSON.stringify(sanitized), hash: analyticsHash(sanitized), origin: "existing-private-store" });
      if (body.dashboard.error === "request-failed") throw new Error("ANALYTICS_SOURCE_UNAVAILABLE");
      {
        const model = body as { research: ResearchSnapshotList; dashboard: Awaited<ReturnType<typeof getUbersuggestDashboardData>> };
        const data = buildSeoIntelligenceExport(model.research, model.dashboard, collectedAt);
        const geo = model.dashboard.geo;
        reports = [dataset(report, { ...data, rows: data.rows.slice(0, 50_000), truncated: data.rows.length > 50_000 || model.research.rows.length > 50_000, title: "SEO · Research และ AI Visibility", sourceAsOf: geo?.fetchedAt ?? geo?.checkedAt ?? model.research.rows.map((row) => row.checkedAt).sort().at(-1) ?? null, windowStart: geo?.windowStart ?? null, windowEnd: geo?.windowEnd ?? null,
          limitations: [...(geo?.limitations ?? []), ...(body.dashboard.error === "not-configured" ? ["AISV เป็นแหล่งเสริมที่ยังไม่ configured; รายงานรอบนี้มีเฉพาะ stored Research ไม่ใช่ AISV ค่า 0"] : []), "อ่าน stored Research/AISV เดิม ไม่ยิง Ubersuggest ใหม่; แถว keyword และ prompt มี grain ต่างกัน; provider runtime อยู่บน Local Mac; ไม่รวม 2 คำค้นทดสอบ CSV ที่ COO อนุมัติ", ...(model.research.rows.length > 50_000 || data.rows.length > 50_000 ? ["ถึงขีดจำกัด snapshot 50,000 แถว; raw มี sentinel แถวที่ 50,001 เพื่อยืนยัน coverage ไม่ครบ"] : [])] })];
      }
    }
    if (Date.now() > deadline) throw new Error("ANALYTICS_SOURCE_UNAVAILABLE");
    const status = await finishAnalyticsCollection({ batchId: claim.batchId, attempt: claim.attempt, reports, raw, error: null }, variables);
    return { source, status, batchId: claim.batchId, reports: reports.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const category = /NOT_CONFIGURED/.test(message) ? "not-configured" : /INVALID|Zod/.test(message) || error instanceof z.ZodError ? "invalid-response" : /TOO_LARGE/.test(message) ? "batch-too-large" : "source-unavailable";
    await finishAnalyticsCollection({ batchId: claim.batchId, attempt: claim.attempt, reports: [], raw: category === "batch-too-large" ? [] : raw, error: category }, variables);
    return { source, status: "failed" as const, batchId: claim.batchId, error: category };
  }
}
