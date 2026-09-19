import { z } from "zod";

export const LOCAL_AI_TASK_TYPES = [
  "privacy-redaction",
  "line-intent",
  "content-operations",
  "seo-preprocessing",
] as const;

export const LOCAL_AI_DATA_CLASSES = ["public-safe", "customer-private"] as const;
export const LOCAL_AI_JOB_STATUSES = [
  "queued",
  "leased",
  "succeeded",
  "failed",
  "reconciliation-required",
  "cancelled",
] as const;

export type LocalAiTaskType = (typeof LOCAL_AI_TASK_TYPES)[number];
export type LocalAiDataClass = (typeof LOCAL_AI_DATA_CLASSES)[number];
export type LocalAiJobStatus = (typeof LOCAL_AI_JOB_STATUSES)[number];

export const localAiTaskTypeSchema = z.enum(LOCAL_AI_TASK_TYPES);
export const localAiDataClassSchema = z.enum(LOCAL_AI_DATA_CLASSES);
export const localAiJobStatusSchema = z.enum(LOCAL_AI_JOB_STATUSES);

const lineIntentInputSchema = z.object({
  locale: z.literal("th-TH"),
  text: z.string().min(1).max(8_000),
  journey: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,79}$/).optional(),
}).strict();

const privacyRedactionInputSchema = z.object({
  locale: z.literal("th-TH"),
  text: z.string().min(1).max(8_000),
  replacementStyle: z.literal("typed-placeholders"),
}).strict();

const contentOperationsInputSchema = z.object({
  locale: z.literal("th-TH"),
  title: z.string().min(1).max(300),
  body: z.string().min(1).max(30_000),
  canonicalPath: z.string().startsWith("/").max(500).optional(),
  allowedCategories: z.array(z.string().min(1).max(80)).max(50),
}).strict();

const seoPreprocessingInputSchema = z.object({
  locale: z.literal("th-TH"),
  queries: z.array(z.object({
    query: z.string().min(1).max(300),
    page: z.string().startsWith("/").max(500).nullable(),
    clicks: z.number().nonnegative().optional(),
    impressions: z.number().nonnegative().optional(),
    position: z.number().nonnegative().optional(),
  }).strict()).min(1).max(100),
}).strict();

export const localAiTaskInputSchemas = {
  "privacy-redaction": privacyRedactionInputSchema,
  "line-intent": lineIntentInputSchema,
  "content-operations": contentOperationsInputSchema,
  "seo-preprocessing": seoPreprocessingInputSchema,
} as const;

const piiTypeSchema = z.enum([
  "person-name",
  "phone",
  "email",
  "national-id",
  "address",
  "account-number",
  "policy-number",
  "health-detail",
  "financial-detail",
]);

const privacyRedactionOutputSchema = z.object({
  redactedText: z.string().min(1).max(8_000),
  piiTypes: z.array(piiTypeSchema).max(20),
  detectedCount: z.number().int().nonnegative().max(500),
  reviewRequired: z.boolean(),
}).strict();

const lineIntentOutputSchema = z.object({
  intent: z.enum([
    "life-insurance",
    "health-insurance",
    "motor-insurance",
    "home-insurance",
    "pet-insurance",
    "investment",
    "tax",
    "appointment",
    "service",
    "unknown",
  ]),
  urgency: z.enum(["low", "normal", "high", "urgent"]),
  needsHuman: z.boolean(),
  confidence: z.number().min(0).max(1),
  productTags: z.array(z.string().regex(/^[a-z0-9][a-z0-9_-]{0,79}$/)).max(12),
  reasonCodes: z.array(z.enum([
    "explicit-product",
    "price-question",
    "coverage-question",
    "claim-or-service",
    "appointment-request",
    "sensitive-health",
    "sensitive-financial",
    "ambiguous",
  ])).max(12),
}).strict();

const contentOperationsOutputSchema = z.object({
  category: z.string().min(1).max(80),
  tags: z.array(z.string().min(1).max(80)).max(20),
  slugSuggestion: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(160),
  excerpt: z.string().min(1).max(500),
  faqCandidates: z.array(z.object({
    question: z.string().min(1).max(300),
    answerDraft: z.string().min(1).max(1_500),
  }).strict()).max(8),
}).strict();

const seoPreprocessingOutputSchema = z.object({
  clusters: z.array(z.object({
    label: z.string().min(1).max(160),
    intent: z.enum(["informational", "commercial", "transactional", "navigational", "mixed"]),
    queries: z.array(z.string().min(1).max(300)).min(1).max(100),
    ownerCandidate: z.string().startsWith("/").max(500).nullable(),
    reviewRequired: z.boolean(),
  }).strict()).max(100),
}).strict();

export const localAiTaskOutputSchemas = {
  "privacy-redaction": privacyRedactionOutputSchema,
  "line-intent": lineIntentOutputSchema,
  "content-operations": contentOperationsOutputSchema,
  "seo-preprocessing": seoPreprocessingOutputSchema,
} as const;

const directIdentifierPatterns = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /(?:^|\D)0\d(?:[-\s]?\d){8,9}(?:\D|$)/,
  /(?:^|\D)\d(?:[-\s]?\d){12}(?:\D|$)/,
] as const;

export function containsDirectPersonalIdentifier(value: string): boolean {
  return directIdentifierPatterns.some((pattern) => pattern.test(value));
}

export function expectedDataClass(taskType: LocalAiTaskType): LocalAiDataClass {
  return taskType === "privacy-redaction" || taskType === "line-intent"
    ? "customer-private"
    : "public-safe";
}

export function parseLocalAiTaskInput(taskType: LocalAiTaskType, value: unknown) {
  return localAiTaskInputSchemas[taskType].safeParse(value);
}

export function parseLocalAiTaskOutput(taskType: LocalAiTaskType, value: unknown) {
  if (taskType === "privacy-redaction") {
    return privacyRedactionOutputSchema.superRefine((output, context) => {
      if (containsDirectPersonalIdentifier(output.redactedText)) {
        context.addIssue({ code: "custom", message: "direct personal identifier remains after redaction", path: ["redactedText"] });
      }
    }).safeParse(value);
  }
  if (taskType === "line-intent") return lineIntentOutputSchema.safeParse(value);
  if (taskType === "content-operations") return contentOperationsOutputSchema.safeParse(value);
  return seoPreprocessingOutputSchema.safeParse(value);
}

export type LocalAiTaskInput = {
  [K in LocalAiTaskType]: z.infer<(typeof localAiTaskInputSchemas)[K]>;
};

export type LocalAiTaskOutput = {
  [K in LocalAiTaskType]: z.infer<(typeof localAiTaskOutputSchemas)[K]>;
};
