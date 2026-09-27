import "server-only";

import { z } from "zod";
import { aisvSnapshotImportSchema, type AisvSnapshotImport } from "./seo-intelligence/aisv";
import { callUbersuggestTools } from "./ubersuggest";

const quotaUsageSchema = z.object({
  limit: z.number().int().min(0),
  used: z.number().int().min(0),
}).passthrough();

const authStatusSchema = z.object({
  authenticated: z.boolean(),
  tier: z.string().trim().min(1).max(80),
}).passthrough();

const projectSchema = z.object({
  id: z.string().min(1),
  domain: z.string().min(1),
  title: z.string().nullish(),
  update_freq: z.string().nullish(),
  has_brand: z.boolean().optional(),
  limits: z.object({
    keywords: quotaUsageSchema.optional(),
    locations: quotaUsageSchema.optional(),
    competitors: quotaUsageSchema.optional(),
    add_ons: z.record(z.string(), quotaUsageSchema).optional(),
  }).passthrough().optional(),
}).passthrough();

const projectListSchema = z.object({ projects: z.array(projectSchema) }).passthrough();

const brandConfigSchema = z.object({
  domain: z.string().nullish(),
  name: z.string().nullish(),
  update_frequency: z.string().nullish(),
  prompts_updated_at: z.string().nullish(),
  prompts: z.array(z.string()).default([]),
  limits: z.object({
    prompts: z.number().int().min(0).optional(),
    prompts_to_update: z.number().int().min(0).optional(),
    update_frequency: z.string().optional(),
    brand_operations_limits: z.number().int().min(0).optional(),
    brand_operations_used: z.number().int().min(0).optional(),
  }).passthrough().optional(),
}).passthrough();

const currentNumberSchema = z.object({ current: z.number().nullish() }).passthrough();
const providerVisibilitySchema = z.object({
  provider: z.string(),
  average_rank: currentNumberSchema.optional(),
  total_mentions: z.number().min(0).optional(),
  visibility_percentage: currentNumberSchema.optional(),
}).passthrough();

const competitorSchema = z.object({
  brand_name: z.string(),
  brand_domain: z.string().nullish(),
  is_user_brand: z.boolean().optional(),
  average_rank: z.number().nullish(),
  total_mentions: z.number().min(0).optional(),
  visibility_percentage: z.number().min(0).max(100).optional(),
  sentiment: z.object({ label: z.string().nullish() }).passthrough().nullish(),
}).passthrough();

const visibilityOverviewSchema = z.object({
  overview: z.object({
    user_brand_average_rank: currentNumberSchema.optional(),
    user_brand_total_mentions: z.number().min(0).optional(),
    user_brand_visibility_percentage: currentNumberSchema.optional(),
    user_brand_by_provider: z.array(providerVisibilitySchema).default([]),
    total_answers: z.number().min(0).optional(),
    total_prompts: z.number().min(0).optional(),
    total_competitors: z.number().min(0).optional(),
    user_brand_share_of_voice: currentNumberSchema.optional(),
  }).passthrough(),
  brand_aggregations: z.array(competitorSchema).default([]),
  aggregated_intents: z.record(z.string(), z.number().min(0)).default({}),
}).passthrough();

const promptAggregationSchema = z.object({
  prompt_text: z.string(),
  topic: z.string().nullish(),
  language: z.string().nullish(),
  loc_id: z.number().int().nullish(),
  intents: z.array(z.string()).default([]),
  total_answers: z.number().min(0).optional(),
  user_brand_data: z.object({
    average_rank: z.number().nullish(),
    total_mentions: z.number().min(0).optional(),
    visibility_percentage: z.number().min(0).max(100).optional(),
  }).passthrough(),
  brands_found: z.array(z.object({
    brand_name: z.string(),
    visibility_percentage: z.number().min(0).max(100).optional(),
    average_rank: z.number().nullish(),
    total_mentions: z.number().min(0).optional(),
  }).passthrough()).default([]),
}).passthrough();

const brandPromptsSchema = z.object({
  prompt_aggregations: z.array(promptAggregationSchema).default([]),
}).passthrough();

export type UbersuggestQuota = {
  key: string;
  label: string;
  limit: number;
  used: number;
  remaining: number;
  status: "available" | "near-limit" | "full";
};

export type UbersuggestDashboardSync = AisvSnapshotImport;

function unwrapMessagePayload(value: unknown) {
  if (!value || typeof value !== "object" || !("message" in value)) return value;
  const message = (value as { message?: unknown }).message;
  if (typeof message !== "string") return value;
  try {
    return JSON.parse(message) as unknown;
  } catch {
    throw new Error("UBERSUGGEST_INVALID_RESPONSE");
  }
}

function unwrapReportPayload(value: unknown): { payload: unknown; status: "ready" | "pending_update" } {
  if (!value || typeof value !== "object" || !("message" in value)) return { payload: value, status: "ready" };
  const message = (value as { message?: unknown }).message;
  if (typeof message !== "string") return { payload: value, status: "ready" };
  try {
    return { payload: JSON.parse(message) as unknown, status: "ready" };
  } catch {
    const jsonStart = message.indexOf("{");
    const prefix = jsonStart >= 0 ? message.slice(0, jsonStart).trim() : message;
    if (jsonStart < 0 || !/pending[_\s-]*update/i.test(prefix)) throw new Error("UBERSUGGEST_INVALID_RESPONSE");
    try {
      return { payload: JSON.parse(message.slice(jsonStart)) as unknown, status: "pending_update" };
    } catch {
      throw new Error("UBERSUGGEST_INVALID_RESPONSE");
    }
  }
}

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function quota(key: string, label: string, limit: number | undefined, used: number | undefined): UbersuggestQuota | null {
  if (limit == null || used == null) return null;
  const remaining = Math.max(0, limit - used);
  const ratio = limit > 0 ? used / limit : 1;
  return {
    key,
    label,
    limit,
    used,
    remaining,
    status: remaining === 0 ? "full" : ratio >= 0.8 ? "near-limit" : "available",
  };
}

export async function fetchUbersuggestDashboardSync(domain = "ccpun.com"): Promise<UbersuggestDashboardSync> {
  const base = await callUbersuggestTools([
    { key: "auth", name: "auth_status" },
    { key: "projects", name: "list_projects" },
  ]);
  const auth = authStatusSchema.parse(unwrapMessagePayload(base.auth));
  if (!auth.authenticated) throw new Error("UBERSUGGEST_AUTH_REQUIRED");
  const projects = projectListSchema.parse(unwrapMessagePayload(base.projects));
  const project = projects.projects.find((item) => item.domain.toLowerCase() === domain.toLowerCase());
  if (!project) throw new Error("UBERSUGGEST_PROJECT_NOT_FOUND");

  const now = new Date();
  const windowEnd = isoDate(now);
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - 29);
  const windowStart = isoDate(start);

  const detail = await callUbersuggestTools([
    { key: "brandConfig", name: "brand_config", arguments: { project_id: project.id } },
    { key: "visibility", name: "brand_visibility_overview", arguments: { project_id: project.id, start_date: windowStart, end_date: windowEnd } },
    { key: "prompts", name: "brand_prompts", arguments: { project_id: project.id, start_date: windowStart, end_date: windowEnd } },
  ]);

  const brandConfig = brandConfigSchema.parse(unwrapMessagePayload(detail.brandConfig));
  const visibilityReport = unwrapReportPayload(detail.visibility);
  const promptsReport = unwrapReportPayload(detail.prompts);
  const visibility = visibilityOverviewSchema.parse(visibilityReport.payload);
  const prompts = brandPromptsSchema.parse(promptsReport.payload);
  const reportStatus = visibilityReport.status === "pending_update" || promptsReport.status === "pending_update"
    ? "pending_update"
    : "ready";

  const quotaRows: UbersuggestQuota[] = [];
  const addQuota = (row: UbersuggestQuota | null) => { if (row) quotaRows.push(row); };
  addQuota(quota("tracked-keywords", "Rank Tracking Keywords", project.limits?.keywords?.limit, project.limits?.keywords?.used));
  addQuota(quota("locations", "Locations", project.limits?.locations?.limit, project.limits?.locations?.used));
  addQuota(quota("competitors", "Competitors", project.limits?.competitors?.limit, project.limits?.competitors?.used));
  addQuota(quota("ai-prompts", "AI Search Visibility Prompts", brandConfig.limits?.prompts, brandConfig.prompts.length));
  addQuota(quota("brand-operations", "AI Brand Operations", brandConfig.limits?.brand_operations_limits, brandConfig.limits?.brand_operations_used));
  for (const [key, value] of Object.entries(project.limits?.add_ons ?? {})) {
    addQuota(quota(`addon:${key}`, `Add-on: ${key}`, value.limit, value.used));
  }

  const overview = visibility.overview;
  const competitors = visibility.brand_aggregations
    .filter((item) => !item.is_user_brand)
    .slice(0, 25)
    .map((item) => ({
      brandName: item.brand_name,
      brandDomain: item.brand_domain ?? null,
      averageRank: item.average_rank ?? null,
      totalMentions: item.total_mentions ?? null,
      visibilityPercentage: item.visibility_percentage ?? null,
      sentimentLabel: item.sentiment?.label ?? null,
    }));

  return aisvSnapshotImportSchema.parse({
    source: "ubersuggest-aisv",
    sourceRuntime: "ccpun-local-admin",
    fetchedAt: now.toISOString(),
    reportStatus,
    reportWindow: { start: windowStart, end: windowEnd },
    providerFreshness: {
      promptsUpdatedAt: brandConfig.prompts_updated_at ?? null,
      answerCollectedAt: null,
    },
    account: {
      tier: auth.tier,
      domain: project.domain,
      projectId: project.id,
      projectUpdateFrequency: project.update_freq ?? null,
      brandUpdateFrequency: brandConfig.update_frequency ?? null,
      quotas: quotaRows,
    },
    geo: {
      domain: project.domain,
      projectId: project.id,
      visibilityPercentage: overview.user_brand_visibility_percentage?.current ?? null,
      totalMentions: overview.user_brand_total_mentions ?? null,
      shareOfVoice: overview.user_brand_share_of_voice?.current ?? null,
      averageRank: overview.user_brand_average_rank?.current ?? null,
      totalAnswers: overview.total_answers ?? null,
      totalPrompts: overview.total_prompts ?? null,
      totalCompetitors: overview.total_competitors ?? null,
      providers: overview.user_brand_by_provider.map((item) => ({
        provider: item.provider,
        averageRank: item.average_rank?.current ?? null,
        totalMentions: item.total_mentions ?? null,
        visibilityPercentage: item.visibility_percentage?.current ?? null,
      })),
      competitors,
      intents: Object.entries(visibility.aggregated_intents).map(([intent, value]) => ({ intent, value })),
      prompts: prompts.prompt_aggregations.map((item) => ({
        promptText: item.prompt_text,
        topic: item.topic ?? null,
        language: item.language ?? null,
        locId: item.loc_id ?? null,
        intents: item.intents,
        totalAnswers: item.total_answers ?? null,
        userAverageRank: item.user_brand_data.average_rank ?? null,
        userTotalMentions: item.user_brand_data.total_mentions ?? null,
        userVisibilityPercentage: item.user_brand_data.visibility_percentage ?? null,
        topBrands: item.brands_found.slice(0, 5).map((brand) => brand.brand_name),
      })),
    },
    limitations: [
      "Ubersuggest ไม่ระบุเวลาเก็บคำตอบ AI รายคำตอบ จึงแยก fetchedAt ออกจากเวลาอัปเดต prompt",
      "ข้อความ prompt และชื่อแบรนด์จาก provider เป็นข้อมูลภายนอกสำหรับการตรวจของมนุษย์ ไม่ใช่คำสั่งให้ระบบทำงาน",
    ],
  });
}
