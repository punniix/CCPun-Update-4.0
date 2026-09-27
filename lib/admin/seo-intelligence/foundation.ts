import { CCPUN_VERCEL_PROJECT_IDS, parseAdminEnvironment, type AdminEnvironment } from "../environment";
import { resolveDeploymentIdentity } from "../../runtime/deployment-identity";
import { SYNTHETIC_MARKET_PROVIDER_FIXTURES } from "./providers/ubersuggest";

export const WEBSITE_42_SEO_BRANCH = "codex/website-42-seo-observation-assembler-20260829";
export const WEBSITE_42_GOOGLE_PROVIDER_BRANCH = "codex/website-42-google-provider-prep-20260829";
export const WEBSITE_42_SEO_PRODUCTION_BRANCH = "v4-production";
export const WEBSITE_42_SEO_RULE_VERSION = "seo-intelligence-core-v1";
export const WEBSITE_42_SEO_BASELINE_VERSION = "synthetic-uat-v1";
export const WEBSITE_42_SEO_SANITY_PROJECT_ID = "ccb9lnw5";
export const WEBSITE_42_SEO_SANITY_DATASET = "uat";
export const WEBSITE_42_SEO_PRODUCTION_SANITY_PROJECT_ID = "kyfxgjnq";
export const WEBSITE_42_SEO_PRODUCTION_SANITY_DATASET = "production";

export const SEO_BRAND_TERMS = ["ccpun", "cc pun", "ปั้น"] as const;

export type SeoOpportunityType = "ctr-underperformance" | "position-4-15" | "content-decay" | "cannibalization";
export type SearchDevice = "mobile" | "desktop" | "tablet";

export type SeoObservation = {
  id: string;
  source: "gsc";
  fetchedAt: string;
  dateRange: { start: string; end: string };
  page: string;
  query: string;
  queryCluster: string;
  device: SearchDevice;
  searchAppearance: "web";
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  previous: { clicks: number; impressions: number; position: number } | null;
  searchIntent: string;
  intentAligned: boolean;
  indexable: boolean;
  businessValue: 1 | 2 | 3 | 4 | 5;
  lastRelevantContentChangeAt: string;
  seasonality: "none" | "known" | "unknown";
  limitations: string[];
};

export type PriorityComponent = { value: 1 | 2 | 3 | 4 | 5; reason: string };

export type SeoOpportunity = {
  id: string;
  type: SeoOpportunityType;
  page: string;
  affectedPages: string[];
  queryCluster: string;
  branded: boolean;
  dateRange: SeoObservation["dateRange"];
  detectedAt: string;
  status: "detected";
  priority: number;
  priorityComponents: {
    trafficPotential: PriorityComponent;
    businessValue: PriorityComponent;
    confidence: PriorityComponent;
    effort: PriorityComponent;
    risk: PriorityComponent;
  };
  evidence: Array<{ label: string; value: string }>;
  limitations: string[];
  recommendedActions: string[];
  protectedFields: string[];
  ruleVersion: string;
  baselineVersion: string;
};

const PROTECTED_FIELDS = ["slug", "canonical", "noindex", "redirect", "sitemap", "robots", "publish"];
const TYPE_EFFORT: Record<SeoOpportunityType, PriorityComponent> = {
  "ctr-underperformance": { value: 2, reason: "ตรวจข้อความในผลค้นหาและความต้องการของผู้ค้นหาได้โดยไม่เปลี่ยน URL" },
  "position-4-15": { value: 3, reason: "ต้องตรวจเนื้อหาที่ยังขาดและลิงก์ภายใน" },
  "content-decay": { value: 4, reason: "ต้องตรวจความสด ฤดูกาล และเนื้อหาทั้งหน้า" },
  cannibalization: { value: 5, reason: "อาจกระทบหน้าหลักของคำค้น และต้องผ่านการตรวจการย้ายข้อมูล SEO" },
};
const TYPE_RISK: Record<SeoOpportunityType, PriorityComponent> = {
  "ctr-underperformance": { value: 2, reason: "เสนอได้เฉพาะชื่อเรื่องและคำอธิบาย โดยยังไม่แก้ฉบับร่าง" },
  "position-4-15": { value: 2, reason: "คำแนะนำจำกัดอยู่ที่เนื้อหาและลิงก์ภายใน" },
  "content-decay": { value: 3, reason: "YMYL ต้อง fact-check ก่อนแก้เนื้อหา" },
  cannibalization: { value: 5, reason: "ห้ามรวมหน้า เปลี่ยนเส้นทาง กำหนดหน้าหลัก หรือลบโดยอัตโนมัติ" },
};

const actionByType: Record<SeoOpportunityType, string[]> = {
  "ctr-underperformance": ["ตรวจสิ่งที่ผู้ค้นหาต้องการและหน้าผลค้นหาก่อนเสนอชื่อเรื่องหรือคำอธิบาย", "คง URL และเนื้อหาที่เผยแพร่แล้วไว้จนกว่ามนุษย์อนุมัติ"],
  "position-4-15": ["ตรวจเนื้อหาที่ยังขาด หัวข้อ และลิงก์ภายในที่สัมพันธ์กับกลุ่มคำค้น", "สร้างข้อเสนอแยกหลังมีหลักฐานเพียงพอ"],
  "content-decay": ["ตรวจความสด แหล่งอ้างอิง และการเปลี่ยนแปลงตามฤดูกาล", "ส่งตรวจข้อเท็จจริงและข้อกำหนด หากเกี่ยวข้องกับข้อมูลการเงินหรือสุขภาพ"],
  cannibalization: ["กำหนดหน้าหลักของคำค้นก่อนเสนอการแก้ไข", "ใช้กระบวนการย้าย SEO ที่มีการป้องกัน หากต้องเปลี่ยน URL หน้าหลัก หรือเส้นทาง"],
};

export function isBrandedQuery(query: string): boolean {
  const normalized = query.toLocaleLowerCase("th-TH").replace(/\s+/g, " ").trim();
  return SEO_BRAND_TERMS.some((term) => normalized.includes(term));
}

function ctrBaseline(position: number, device: SearchDevice, branded: boolean): number {
  const deviceAdjustment = device === "desktop" ? 0.006 : device === "tablet" ? 0.003 : 0;
  const base = position <= 3 ? 0.1 : position <= 6 ? 0.05 : position <= 10 ? 0.03 : position <= 15 ? 0.015 : 0.008;
  return Math.min(base + deviceAdjustment + (branded ? 0.08 : 0), 0.3);
}

function daysSince(value: string, endDate: string): number {
  return Math.floor((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(value)) / 86_400_000);
}

function component(value: number, reason: string): PriorityComponent {
  return { value: Math.max(1, Math.min(5, value)) as PriorityComponent["value"], reason };
}

function priorityFor(type: SeoOpportunityType, observation: SeoObservation) {
  const trafficPotential = component(Math.ceil(observation.impressions / 250), `${observation.impressions.toLocaleString("th-TH")} impressions ในช่วงวิเคราะห์`);
  const businessValue = component(observation.businessValue, `Business value fixture ${observation.businessValue}/5`);
  const confidenceBase = observation.impressions >= 1_000 ? 5 : observation.impressions >= 500 ? 4 : 3;
  const confidence = component(confidenceBase - (observation.limitations.length ? 1 : 0), observation.limitations.length ? "ลดคะแนนเพราะหลักฐานมีข้อจำกัด" : "หลักฐานสังเคราะห์มี sample เพียงพอสำหรับทดสอบกฎ");
  const effort = TYPE_EFFORT[type];
  const risk = TYPE_RISK[type];
  const priority = Math.round((trafficPotential.value * 30 + businessValue.value * 25 + confidence.value * 25 + (6 - effort.value) * 10 + (6 - risk.value) * 10) / 5);
  return { priority, priorityComponents: { trafficPotential, businessValue, confidence, effort, risk } };
}

function createOpportunity(
  type: SeoOpportunityType,
  observation: SeoObservation,
  evidence: SeoOpportunity["evidence"],
  affectedPages = [observation.page],
): SeoOpportunity {
  const scoring = priorityFor(type, observation);
  return {
    id: `${type}:${observation.id}`,
    type,
    page: observation.page,
    affectedPages,
    queryCluster: observation.queryCluster,
    branded: isBrandedQuery(observation.query),
    dateRange: observation.dateRange,
    detectedAt: observation.fetchedAt,
    status: "detected",
    ...scoring,
    evidence,
    limitations: observation.limitations,
    recommendedActions: actionByType[type],
    protectedFields: PROTECTED_FIELDS,
    ruleVersion: WEBSITE_42_SEO_RULE_VERSION,
    baselineVersion: WEBSITE_42_SEO_BASELINE_VERSION,
  };
}

export function detectSeoOpportunities(observations: SeoObservation[]): SeoOpportunity[] {
  const opportunities: SeoOpportunity[] = [];
  const persistentClusters = new Map<string, SeoObservation[]>();

  for (const observation of observations) {
    if (!observation.indexable || observation.impressions < 200 || !observation.previous?.impressions) continue;
    const key = observation.queryCluster.toLocaleLowerCase("th-TH").trim();
    persistentClusters.set(key, [...(persistentClusters.get(key) ?? []), observation]);
  }

  const cannibalizedClusters = new Set<string>();
  for (const [cluster, rows] of persistentClusters) {
    const pages = [...new Set(rows.map((row) => row.page))];
    const intents = new Set(rows.map((row) => row.searchIntent));
    if (pages.length < 2 || intents.size !== 1) continue;
    cannibalizedClusters.add(cluster);
    const lead = [...rows].sort((a, b) => b.impressions - a.impressions)[0]!;
    opportunities.push(createOpportunity("cannibalization", lead, [
      { label: "หน้าที่แข่งขันกัน", value: pages.length.toString() },
      { label: "จำนวนครั้งที่ปรากฏรวม", value: rows.reduce((sum, row) => sum + row.impressions, 0).toLocaleString("th-TH") },
      { label: "ความต้องการของผู้ค้นหา", value: lead.searchIntent },
    ], pages));
  }

  for (const observation of observations) {
    const cluster = observation.queryCluster.toLocaleLowerCase("th-TH").trim();
    const branded = isBrandedQuery(observation.query);
    const baseline = ctrBaseline(observation.position, observation.device, branded);
    const changedRecently = daysSince(observation.lastRelevantContentChangeAt, observation.dateRange.end) < 14;
    if (cannibalizedClusters.has(cluster)) continue;

    const previous = observation.previous;
    if (previous && observation.seasonality !== "known" && !changedRecently) {
      const clickDecline = previous.clicks > 0 ? 1 - observation.clicks / previous.clicks : 0;
      const impressionDecline = previous.impressions > 0 ? 1 - observation.impressions / previous.impressions : 0;
      const positionDecline = observation.position - previous.position;
      if (clickDecline >= 0.25 && (impressionDecline >= 0.2 || positionDecline >= 2)) {
        opportunities.push(createOpportunity("content-decay", observation, [
          { label: "Clicks เปลี่ยนแปลง", value: `-${(clickDecline * 100).toFixed(0)}%` },
          { label: "Impressions เปลี่ยนแปลง", value: `${impressionDecline >= 0 ? "-" : "+"}${Math.abs(impressionDecline * 100).toFixed(0)}%` },
          { label: "อันดับเปลี่ยนแปลง", value: `${positionDecline >= 0 ? "+" : ""}${positionDecline.toFixed(1)}` },
        ]));
        continue;
      }
    }

    if (
      observation.impressions >= 500 &&
      observation.position >= 2 && observation.position <= 15 &&
      observation.ctr <= baseline * 0.65 &&
      observation.intentAligned && observation.seasonality !== "known" && !changedRecently
    ) {
      opportunities.push(createOpportunity("ctr-underperformance", observation, [
        { label: "CTR ปัจจุบัน", value: `${(observation.ctr * 100).toFixed(1)}%` },
        { label: "Synthetic baseline", value: `${(baseline * 100).toFixed(1)}%` },
        { label: "อันดับเฉลี่ย", value: observation.position.toFixed(1) },
        { label: "อุปกรณ์", value: observation.device },
      ]));
    }

    if (
      observation.impressions >= 400 &&
      observation.position >= 4 && observation.position <= 15 &&
      observation.ctr > baseline * 0.65 &&
      observation.intentAligned && observation.seasonality !== "known" && !changedRecently
    ) {
      opportunities.push(createOpportunity("position-4-15", observation, [
        { label: "อันดับเฉลี่ย", value: observation.position.toFixed(1) },
        { label: "Impressions", value: observation.impressions.toLocaleString("th-TH") },
        { label: "CTR", value: `${(observation.ctr * 100).toFixed(1)}%` },
      ]));
    }

  }

  return opportunities.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
}

const common = {
  source: "gsc" as const,
  fetchedAt: "2026-08-28T00:00:00.000Z",
  dateRange: { start: "2026-07-31", end: "2026-08-27" },
  device: "mobile" as const,
  searchAppearance: "web" as const,
  intentAligned: true,
  indexable: true,
  lastRelevantContentChangeAt: "2026-05-01T00:00:00.000Z",
  seasonality: "none" as const,
  limitations: [] as string[],
};

export const SYNTHETIC_SEO_OBSERVATIONS: SeoObservation[] = [
  { ...common, id: "weak-ctr", page: "/blog/health-insurance/health-waiting-period/", query: "ประกันสุขภาพ ระยะรอคอย", queryCluster: "ประกันสุขภาพ ระยะรอคอย", clicks: 18, impressions: 1_000, ctr: 0.018, position: 5, previous: { clicks: 20, impressions: 980, position: 5.2 }, searchIntent: "informational", businessValue: 4 },
  { ...common, id: "quick-win", page: "/blog/investment/dca-guide/", query: "dca คือ", queryCluster: "dca คือ", clicks: 32, impressions: 800, ctr: 0.04, position: 7, previous: { clicks: 26, impressions: 650, position: 8 }, searchIntent: "informational", businessValue: 3 },
  { ...common, id: "decay", page: "/blog/retirement/retirement-plan/", query: "วางแผนเกษียณ", queryCluster: "วางแผนเกษียณ", clicks: 45, impressions: 600, ctr: 0.075, position: 10, previous: { clicks: 90, impressions: 900, position: 7 }, searchIntent: "informational", businessValue: 5 },
  { ...common, id: "cannibal-a", page: "/blog/health-insurance/critical-illness-cost/", query: "ค่ารักษาโรคร้ายแรง", queryCluster: "ค่ารักษาโรคร้ายแรง", clicks: 28, impressions: 700, ctr: 0.04, position: 8, previous: { clicks: 25, impressions: 620, position: 8.4 }, searchIntent: "informational", businessValue: 5 },
  { ...common, id: "cannibal-b", page: "/blog/life-insurance/critical-illness-plan/", query: "ค่ารักษาโรคร้ายแรง", queryCluster: "ค่ารักษาโรคร้ายแรง", clicks: 15, impressions: 500, ctr: 0.03, position: 10, previous: { clicks: 17, impressions: 470, position: 9.5 }, searchIntent: "informational", businessValue: 4 },
  { ...common, id: "position-18", page: "/blog/investment/fund-basics/", query: "กองทุนรวม เริ่มต้น", queryCluster: "กองทุนรวม เริ่มต้น", clicks: 4, impressions: 700, ctr: 0.006, position: 18, previous: null, searchIntent: "informational", businessValue: 3 },
  { ...common, id: "recent-change", page: "/blog/health-insurance/recent-title-test/", query: "ประกันสุขภาพ เปรียบเทียบ", queryCluster: "ประกันสุขภาพ เปรียบเทียบ", clicks: 8, impressions: 900, ctr: 0.009, position: 5, previous: null, searchIntent: "commercial", businessValue: 5, lastRelevantContentChangeAt: "2026-08-20T00:00:00.000Z" },
  { ...common, id: "seasonal-tax", page: "/blog/tax/tax-deduction/", query: "ลดหย่อนภาษี", queryCluster: "ลดหย่อนภาษี", clicks: 20, impressions: 500, ctr: 0.04, position: 8, previous: { clicks: 80, impressions: 1_200, position: 6 }, searchIntent: "informational", businessValue: 4, seasonality: "known" },
  { ...common, id: "brand", page: "/", query: "CCPun", queryCluster: "ccpun", clicks: 120, impressions: 180, ctr: 0.667, position: 1, previous: null, searchIntent: "navigational", businessValue: 5 },
];

export function getSyntheticSeoIntelligenceSnapshot() {
  const opportunities = detectSeoOpportunities(SYNTHETIC_SEO_OBSERVATIONS);
  return {
    mode: "synthetic-uat" as const,
    generatedAt: common.fetchedAt,
    ruleVersion: WEBSITE_42_SEO_RULE_VERSION,
    baselineVersion: WEBSITE_42_SEO_BASELINE_VERSION,
    observations: SYNTHETIC_SEO_OBSERVATIONS.length,
    opportunities,
    marketProviderStates: SYNTHETIC_MARKET_PROVIDER_FIXTURES,
    limitations: [
      "ข้อมูลทั้งหมดเป็นข้อมูลจำลองใน UAT และไม่ใช่ตัวเลขของ ccpun.com",
      "อัตราคลิกอ้างอิงเป็นกฎจำลองเพื่อทดสอบการตรวจจับ ไม่ใช่ค่าเฉลี่ยจริงของ CCPun",
      "การดึง GSC ด้วยตนเองจะตรวจเฉพาะแถวที่จับคู่ URL กติกาคำค้น และความต้องการของผู้ค้นหาได้ชัดเจน ส่วน GA4 ยังเป็นข้อมูลอ่านอย่างเดียวแยกต่างหาก",
      "ยังไม่มีการบันทึกโอกาส สร้างข้อเสนอ แก้ฉบับร่าง หรือเผยแพร่ขึ้นระบบจริง",
    ],
  };
}

export function isSeoIntelligenceEnabled(input: {
  flag: string | undefined;
  environment: AdminEnvironment;
  deploymentProvider?: string | undefined;
  deploymentRole?: string | undefined;
  releaseId?: string | undefined;
  gitSha?: string | undefined;
  vercelEnvironment: string | undefined;
  projectId: string | undefined;
  productionAdminProjectId: string | undefined;
  gitBranch: string | undefined;
  sanityProjectId: string | undefined;
  sanityDataset: string | undefined;
}): boolean {
  if (input.flag !== "1") return false;
  const deployment = resolveDeploymentIdentity({
    CCPUN_APP_ENV: input.environment,
    CCPUN_DEPLOYMENT_PROVIDER: input.deploymentProvider,
    CCPUN_DEPLOYMENT_ROLE: input.deploymentRole,
    CCPUN_RELEASE_ID: input.releaseId,
    CCPUN_GIT_REF: input.gitBranch,
    CCPUN_GIT_SHA: input.gitSha,
    VERCEL_ENV: input.vercelEnvironment,
    VERCEL_PROJECT_ID: input.projectId,
    VERCEL_GIT_COMMIT_REF: input.gitBranch,
    VERCEL_GIT_COMMIT_SHA: input.gitSha,
  }, "admin");
  if (!deployment.valid || deployment.environment !== input.environment) return false;

  const uatLane = input.environment === "admin-uat" &&
    (deployment.provider !== "vercel" || (
      input.projectId === CCPUN_VERCEL_PROJECT_IDS.adminProduction &&
      (!input.vercelEnvironment || input.vercelEnvironment === "preview")
    )) &&
    (input.gitBranch === WEBSITE_42_SEO_BRANCH || input.gitBranch === WEBSITE_42_GOOGLE_PROVIDER_BRANCH || input.gitBranch?.startsWith("admin/")) &&
    input.sanityProjectId === WEBSITE_42_SEO_SANITY_PROJECT_ID &&
    input.sanityDataset === WEBSITE_42_SEO_SANITY_DATASET;

  const productionLane = input.environment === "production-admin" &&
    deployment.provider !== "local" &&
    (deployment.provider !== "vercel" || (
      input.vercelEnvironment === "production" &&
      input.projectId === CCPUN_VERCEL_PROJECT_IDS.adminProduction &&
      input.productionAdminProjectId === CCPUN_VERCEL_PROJECT_IDS.adminProduction
    )) &&
    input.gitBranch === WEBSITE_42_SEO_PRODUCTION_BRANCH &&
    input.sanityProjectId === WEBSITE_42_SEO_PRODUCTION_SANITY_PROJECT_ID &&
    input.sanityDataset === WEBSITE_42_SEO_PRODUCTION_SANITY_DATASET;

  return uatLane || productionLane;
}

export function getSeoIntelligenceRuntimeStatus() {
  const environment = parseAdminEnvironment(process.env.CCPUN_APP_ENV);
  return {
    environment,
    enabled: isSeoIntelligenceEnabled({
      flag: process.env.CCPUN_SEO_INTELLIGENCE_ENABLED,
      environment,
      deploymentProvider: process.env.CCPUN_DEPLOYMENT_PROVIDER?.trim(),
      deploymentRole: process.env.CCPUN_DEPLOYMENT_ROLE?.trim(),
      releaseId: process.env.CCPUN_RELEASE_ID?.trim(),
      gitSha: process.env.CCPUN_GIT_SHA?.trim() || process.env.VERCEL_GIT_COMMIT_SHA?.trim(),
      vercelEnvironment: process.env.VERCEL_ENV?.trim(),
      projectId: process.env.VERCEL_PROJECT_ID?.trim() || process.env.NEXT_PUBLIC_CCPUN_VERCEL_PROJECT_ID?.trim(),
      productionAdminProjectId: process.env.CCPUN_PRODUCTION_ADMIN_VERCEL_PROJECT_ID?.trim() || process.env.NEXT_PUBLIC_CCPUN_PRODUCTION_ADMIN_VERCEL_PROJECT_ID?.trim(),
      gitBranch: process.env.CCPUN_GIT_REF?.trim() || process.env.VERCEL_GIT_COMMIT_REF?.trim(),
      sanityProjectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID?.trim(),
      sanityDataset: process.env.NEXT_PUBLIC_SANITY_DATASET?.trim(),
    }),
  };
}
