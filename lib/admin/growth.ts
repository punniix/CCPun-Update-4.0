import "server-only";

import { z } from "zod";
import { getAdminDeploymentIdentity, isAdminReadDataPlaneAllowed } from "./environment";
import { formatGrowthComparison } from "./growth-comparison";
import { getGoogleDataAccessToken } from "./seo-intelligence/google-data-auth";
import { getSeoGoogleProviderReadiness } from "./seo-intelligence/provider-readiness";

export type GrowthSourceResult = {
  source: "gsc" | "ga4" | "runtime";
  state: "ready" | "not-connected" | "unavailable" | "partial";
  fetchedAt?: string;
  dateRange?: string;
  comparison?: string;
  metrics: Array<{ label: string; value: string }>;
  limitation: string;
};

function bangkokDate(daysAgo = 0) {
  const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

async function providerFetch(url: string, init: RequestInit) {
  const response = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error("PROVIDER_UNAVAILABLE");
  return response.json();
}

const gscSchema = z.object({ rows: z.array(z.object({ clicks: z.number().default(0), impressions: z.number().default(0), ctr: z.number().default(0), position: z.number().default(0) }).passthrough()).default([]) }).passthrough();
const ga4Schema = z.object({
  rows: z.array(z.object({ metricValues: z.array(z.object({ value: z.string() })).default([]) }).passthrough()).default([]),
  totals: z.array(z.object({ metricValues: z.array(z.object({ value: z.string() })).default([]) }).passthrough()).default([]),
}).passthrough();

function gscTotals(data: z.infer<typeof gscSchema>) {
  const clicks = data.rows.reduce((sum, row) => sum + row.clicks, 0);
  const impressions = data.rows.reduce((sum, row) => sum + row.impressions, 0);
  return {
    clicks,
    impressions,
    position: impressions ? data.rows.reduce((sum, row) => sum + row.position * row.impressions, 0) / impressions : null,
  };
}

function ga4Totals(data: z.infer<typeof ga4Schema>) {
  const values = data.totals[0]?.metricValues;
  if (!values || values.length < 3 || values.some((item) => !Number.isFinite(Number(item.value)))) throw new Error("GA4_TOTALS_MISSING");
  return values.map((item) => Number(item.value));
}

function previousGa4Totals(data: z.infer<typeof ga4Schema> | null) {
  if (!data) return null;
  try {
    return ga4Totals(data);
  } catch {
    return null;
  }
}

export async function readGscSummary(): Promise<GrowthSourceResult> {
  const siteUrl = process.env.CCPUN_GSC_SITE_URL?.trim();
  if (getSeoGoogleProviderReadiness("gsc").status !== "manual-sync-ready" || !siteUrl) return { source: "gsc", state: "not-connected", metrics: [], limitation: "ยังไม่ได้อนุมัติการเชื่อม Google Search Console แบบอ่านอย่างเดียว" };
  const startDate = bangkokDate(27);
  const endDate = bangkokDate();
  const previousStartDate = bangkokDate(55);
  const previousEndDate = bangkokDate(28);
  try {
    const token = await getGoogleDataAccessToken();
    const query = (rangeStart: string, rangeEnd: string) => providerFetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ startDate: rangeStart, endDate: rangeEnd, rowLimit: 1 }),
      });
    const [raw, previousRaw] = await Promise.all([
      query(startDate, endDate),
      query(previousStartDate, previousEndDate).catch(() => null),
    ]);
    const data = gscSchema.parse(raw);
    const current = gscTotals(data);
    const previous = previousRaw == null ? null : gscSchema.safeParse(previousRaw);
    const previousTotals = previous?.success ? gscTotals(previous.data) : null;
    return { source: "gsc", state: "ready", fetchedAt: new Date().toISOString(), dateRange: `${startDate} – ${endDate}`, comparison: previousTotals ? formatGrowthComparison([
      { label: "คลิก", current: current.clicks, previous: previousTotals.clicks },
      { label: "การแสดงผล", current: current.impressions, previous: previousTotals.impressions },
    ]) ?? "ทั้งสองช่วงยังไม่มีข้อมูล" : "ดึงช่วงก่อนหน้าไม่สำเร็จ", metrics: [
      { label: "คลิก", value: current.clicks.toLocaleString("th-TH") },
      { label: "การแสดงผล", value: current.impressions.toLocaleString("th-TH") },
      { label: "CTR", value: current.impressions ? `${((current.clicks / current.impressions) * 100).toFixed(1)}%` : "—" },
      { label: "อันดับเฉลี่ย", value: current.position == null ? "—" : current.position.toFixed(1) },
    ], limitation: "ยอดรวมแบบไม่แบ่ง dimension เพื่อให้ช่วงปัจจุบันและช่วงก่อนหน้าเทียบฐานเดียวกัน ไม่ใช่การพิสูจน์สาเหตุของอันดับ" };
  } catch {
    return { source: "gsc", state: "unavailable", metrics: [], limitation: "เชื่อม GSC แล้วแต่ดึงข้อมูลรอบนี้ไม่สำเร็จ ข้อมูลแหล่งอื่นยังใช้ได้" };
  }
}

export async function readGa4Summary(): Promise<GrowthSourceResult> {
  const propertyId = process.env.CCPUN_GA4_PROPERTY_ID?.trim();
  if (getSeoGoogleProviderReadiness("ga4").status !== "manual-sync-ready" || !propertyId) return { source: "ga4", state: "not-connected", metrics: [], limitation: "ยังไม่ได้อนุมัติการเชื่อม GA4 แบบอ่านอย่างเดียว" };
  const startDate = bangkokDate(27);
  const endDate = bangkokDate();
  const previousStartDate = bangkokDate(55);
  const previousEndDate = bangkokDate(28);
  try {
    const token = await getGoogleDataAccessToken();
    const report = (rangeStart: string, rangeEnd: string) => providerFetch(`https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:runReport`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ dateRanges: [{ startDate: rangeStart, endDate: rangeEnd }], metrics: [{ name: "activeUsers" }, { name: "sessions" }, { name: "eventCount" }], limit: 10, metricAggregations: ["TOTAL"] }),
      });
    const [raw, previousRaw] = await Promise.all([
      report(startDate, endDate),
      report(previousStartDate, previousEndDate).catch(() => null),
    ]);
    const data = ga4Schema.parse(raw);
    const values = ga4Totals(data);
    const previous = previousRaw == null ? null : ga4Schema.safeParse(previousRaw);
    const previousValues = previousGa4Totals(previous?.success ? previous.data : null);
    return { source: "ga4", state: "ready", fetchedAt: new Date().toISOString(), dateRange: `${startDate} – ${endDate}`, comparison: previousValues ? formatGrowthComparison([
      { label: "ผู้ใช้งาน", current: values[0] ?? 0, previous: previousValues[0] ?? 0 },
      { label: "เซสชัน", current: values[1] ?? 0, previous: previousValues[1] ?? 0 },
    ]) ?? "ทั้งสองช่วงยังไม่มีข้อมูล" : "ดึงช่วงก่อนหน้าไม่สำเร็จ", metrics: [
      { label: "ผู้ใช้งาน", value: Number(values[0] ?? 0).toLocaleString("th-TH") },
      { label: "เซสชัน", value: Number(values[1] ?? 0).toLocaleString("th-TH") },
      { label: "เหตุการณ์", value: Number(values[2] ?? 0).toLocaleString("th-TH") },
    ], limitation: "เหตุการณ์หรือการคลิกคำชวนให้ทำต่อเป็นเพียงสัญญาณความสนใจ ไม่ใช่จำนวนลูกค้า ยอดขาย หรือผู้สนใจที่ผ่านการคัดกรอง" };
  } catch {
    return { source: "ga4", state: "unavailable", metrics: [], limitation: "เชื่อม GA4 แล้วแต่ดึงข้อมูลรอบนี้ไม่สำเร็จ ข้อมูลแหล่งอื่นยังใช้ได้" };
  }
}

export async function readRuntimeHealth(): Promise<GrowthSourceResult> {
  const deployment = getAdminDeploymentIdentity();
  if (deployment.provider !== "hostinger" || !deployment.valid || deployment.role !== "admin"
    || !["admin-uat", "production-admin"].includes(deployment.environment)
    || !deployment.gitSha || !/^[a-f0-9]{40}$/i.test(deployment.gitSha)
    || !deployment.gitRef
    || !isAdminReadDataPlaneAllowed(process.env.NEXT_PUBLIC_SANITY_DATASET?.trim())
    || (deployment.environment === "production-admin" && deployment.gitRef !== "v4-production")) {
    return { source: "runtime", state: "unavailable", metrics: [], limitation: "ยังยืนยันเวอร์ชันและสภาพแวดล้อมของศูนย์จัดการบน Hostinger ไม่ได้" };
  }
  return { source: "runtime", state: "partial", fetchedAt: new Date().toISOString(), metrics: [
    { label: "ผู้ให้บริการ", value: deployment.provider },
    { label: "สภาพแวดล้อม", value: deployment.environment },
    { label: "สายงาน", value: deployment.gitRef },
    { label: "Commit", value: deployment.gitSha.slice(0, 12) },
  ], limitation: "อ่านเวอร์ชันของศูนย์จัดการที่กำลังรัน ยังไม่ใช่ผลตรวจ deployment ของเว็บสาธารณะ HTTPS หรือ Core Web Vitals" };
}

export async function readGrowthSources() {
  return Promise.all([readGscSummary(), readGa4Summary(), readRuntimeHealth()]);
}
