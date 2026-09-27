import { z } from "zod";
import intentOwnerRegistry from "../../../qa/search-intent-owner-registry.json";

const nullableMetric = z.number().min(0).nullable();
const nullablePercentage = z.number().min(0).max(100).nullable();
const shortNullableText = z.string().trim().min(1).max(255).nullable();

export const aisvSourceRuntimeSchema = z.enum([
  "ccpun-local-admin",
  "chatgpt-ubersuggest-connector",
]);

export const aisvReportStatusSchema = z.enum([
  "ready",
  "partial",
  "pending_update",
]);

const quotaSchema = z.object({
  key: z.string().trim().min(1).max(120),
  label: z.string().trim().min(1).max(160),
  limit: z.number().int().min(0),
  used: z.number().int().min(0),
  remaining: z.number().int().min(0),
  status: z.enum(["available", "near-limit", "full"]),
}).strict();

const promptSchema = z.object({
  promptText: z.string().trim().min(1).max(512),
  topic: shortNullableText,
  language: z.string().trim().min(1).max(40).nullable(),
  locId: z.number().int().nullable(),
  intents: z.array(z.string().trim().min(1).max(80)).max(8),
  totalAnswers: nullableMetric,
  userAverageRank: nullableMetric,
  userTotalMentions: nullableMetric,
  userVisibilityPercentage: nullablePercentage,
  topBrands: z.array(z.string().trim().min(1).max(255)).max(5),
}).strict();

const geoSchema = z.object({
  domain: z.literal("ccpun.com"),
  projectId: z.string().trim().min(1).max(160),
  visibilityPercentage: nullablePercentage,
  totalMentions: nullableMetric,
  shareOfVoice: nullableMetric,
  averageRank: nullableMetric,
  totalAnswers: nullableMetric,
  totalPrompts: nullableMetric,
  totalCompetitors: nullableMetric,
  providers: z.array(z.object({
    provider: z.string().trim().min(1).max(80),
    averageRank: nullableMetric,
    totalMentions: nullableMetric,
    visibilityPercentage: nullablePercentage,
  }).strict()).max(8),
  competitors: z.array(z.object({
    brandName: z.string().trim().min(1).max(255),
    brandDomain: z.string().trim().min(1).max(255).nullable(),
    averageRank: nullableMetric,
    totalMentions: nullableMetric,
    visibilityPercentage: nullablePercentage,
    sentimentLabel: z.string().trim().min(1).max(80).nullable(),
  }).strict()).max(25),
  intents: z.array(z.object({
    intent: z.string().trim().min(1).max(80),
    value: nullableMetric,
  }).strict()).max(12),
  prompts: z.array(promptSchema).max(25),
}).strict();

export const aisvSnapshotImportSchema = z.object({
  source: z.literal("ubersuggest-aisv"),
  sourceRuntime: aisvSourceRuntimeSchema,
  fetchedAt: z.string().datetime(),
  reportStatus: aisvReportStatusSchema,
  reportWindow: z.object({
    start: z.iso.date(),
    end: z.iso.date(),
  }).strict(),
  providerFreshness: z.object({
    promptsUpdatedAt: z.iso.date().nullable(),
    answerCollectedAt: z.string().datetime().nullable(),
  }).strict(),
  account: z.object({
    tier: z.string().trim().min(1).max(80).nullable(),
    domain: z.literal("ccpun.com"),
    projectId: z.string().trim().min(1).max(160),
    projectUpdateFrequency: z.string().trim().min(1).max(80).nullable(),
    brandUpdateFrequency: z.string().trim().min(1).max(80).nullable(),
    quotas: z.array(quotaSchema).max(20),
  }).strict(),
  geo: geoSchema.nullable(),
  limitations: z.array(z.string().trim().min(1).max(500)).min(1).max(12),
}).strict().superRefine((snapshot, context) => {
  if (snapshot.reportWindow.start > snapshot.reportWindow.end) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["reportWindow", "start"], message: "Report start must not follow end" });
  }

  if (snapshot.reportStatus === "ready") {
    if (!snapshot.geo) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["geo"], message: "Ready report requires AISV evidence" });
      return;
    }
    for (const key of ["visibilityPercentage", "totalMentions", "shareOfVoice", "totalAnswers", "totalPrompts"] as const) {
      if (snapshot.geo[key] === null) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["geo", key], message: "Ready report requires explicit metric value" });
      }
    }
  }
});

export type AisvSnapshotImport = z.infer<typeof aisvSnapshotImportSchema>;
export type AisvReadState =
  | "ready"
  | "stale"
  | "partial"
  | "pending_update"
  | "missing"
  | "not-configured"
  | "unavailable";

type RegistryOwner = (typeof intentOwnerRegistry.owners)[number];

function normalizeQuery(value: string) {
  return value.normalize("NFKC").trim().toLocaleLowerCase("th-TH").replace(/\s+/g, " ");
}

const reviewedIntentOwners = new Map<string, RegistryOwner>();
for (const owner of intentOwnerRegistry.owners) {
  for (const query of [owner.primaryQuery, ...owner.queryVariants]) {
    reviewedIntentOwners.set(normalizeQuery(query), owner);
  }
}

export function matchReviewedIntentOwner(promptText: string): RegistryOwner | null {
  return reviewedIntentOwners.get(normalizeQuery(promptText)) ?? null;
}

export function deriveAisvReadState(input: {
  error: "not-configured" | "request-failed" | null;
  snapshot: {
    reportStatus?: "ready" | "partial" | "pending_update" | null;
    windowEnd?: string | null;
  } | null;
  now?: number;
  maxReportAgeDays?: number;
}): AisvReadState {
  if (input.error === "not-configured") return "not-configured";
  if (input.error === "request-failed") return "unavailable";
  if (!input.snapshot) return "missing";
  if (input.snapshot.reportStatus === "pending_update") return "pending_update";
  if (input.snapshot.reportStatus === "partial") return "partial";

  const end = input.snapshot.windowEnd
    ? Date.parse(input.snapshot.windowEnd + "T23:59:59.999Z")
    : Number.NaN;
  const now = input.now ?? Date.now();
  const maxAge = (input.maxReportAgeDays ?? 30) * 86_400_000;
  if (!Number.isFinite(end) || end > now + 86_400_000 || now - end > maxAge) return "stale";
  return "ready";
}

export function aisvReadStateLabel(state: AisvReadState) {
  switch (state) {
    case "ready": return "มีข้อมูลที่วัดได้";
    case "stale": return "ข้อมูลเก่า";
    case "partial": return "ข้อมูลไม่ครบ";
    case "pending_update": return "ผู้ให้บริการกำลังอัปเดต";
    case "not-configured": return "ยังไม่ได้ตั้งค่าแหล่งข้อมูล";
    case "unavailable": return "อ่านแหล่งข้อมูลไม่ได้";
    default: return "ยังไม่มีข้อมูล";
  }
}

export function aisvSourceRuntimeLabel(runtime: string | null | undefined) {
  if (runtime === "ccpun-local-admin") return "CCPun Local Admin";
  if (runtime === "chatgpt-ubersuggest-connector") return "ChatGPT Ubersuggest connector";
  return "ไม่ทราบ runtime ที่ดึงข้อมูล";
}

export function formatNullableMetric(value: number | null | undefined, suffix = "") {
  return value == null ? "ไม่มีค่า" : String(value) + suffix;
}
