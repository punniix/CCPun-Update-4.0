import { z } from "zod";

export const LOCAL_AI_TASK_TYPES = [
  "privacy-redaction",
  "line-intent",
  "content-operations",
  "seo-preprocessing",
] as const;

export const LOCAL_AI_DATA_CLASSES = ["public-safe", "customer-private"] as const;
export const LOCAL_AI_QUEUE_CLASSES = ["urgent", "batch"] as const;
export const LOCAL_AI_QUEUE_POLICY = {
  urgent: { priority: 80, deadlineSeconds: 900 },
  batch: { priority: 20, deadlineSeconds: 21_600 },
} as const;
export const LOCAL_AI_REVIEW_STATUSES = ["pending", "approved", "rejected"] as const;
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
export type LocalAiQueueClass = (typeof LOCAL_AI_QUEUE_CLASSES)[number];
export type LocalAiReviewStatus = (typeof LOCAL_AI_REVIEW_STATUSES)[number];
export type LocalAiJobStatus = (typeof LOCAL_AI_JOB_STATUSES)[number];

export const localAiTaskTypeSchema = z.enum(LOCAL_AI_TASK_TYPES);
export const localAiDataClassSchema = z.enum(LOCAL_AI_DATA_CLASSES);
export const localAiQueueClassSchema = z.enum(LOCAL_AI_QUEUE_CLASSES);
export const localAiReviewStatusSchema = z.enum(LOCAL_AI_REVIEW_STATUSES);
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
  allowedCategories: z.array(z.string().min(1).max(80)).min(1).max(50),
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
  reviewRequired: z.literal(true),
}).strict();

const seoPreprocessingOutputSchema = z.object({
  clusters: z.array(z.object({
    label: z.string().min(1).max(160),
    intent: z.enum(["informational", "commercial", "transactional", "navigational", "mixed"]),
    queries: z.array(z.string().min(1).max(300)).min(1).max(100),
    ownerCandidate: z.string().startsWith("/").max(500).nullable(),
    reviewRequired: z.literal(true),
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

export function parseLocalAiTaskResult(taskType: LocalAiTaskType, inputValue: unknown, outputValue: unknown) {
  if (taskType === "content-operations") {
    const input = contentOperationsInputSchema.safeParse(inputValue);
    if (!input.success) return input;
    const allowed = new Set(input.data.allowedCategories);
    return contentOperationsOutputSchema.superRefine((output, context) => {
      if (!allowed.has(output.category)) {
        context.addIssue({ code: "custom", message: "category is outside allowedCategories", path: ["category"] });
      }
    }).safeParse(outputValue);
  }

  if (taskType === "seo-preprocessing") {
    const input = seoPreprocessingInputSchema.safeParse(inputValue);
    if (!input.success) return input;
    const expectedQueries = new Map<string, number>();
    const allowedOwners = new Set<string>();
    for (const item of input.data.queries) {
      expectedQueries.set(item.query, (expectedQueries.get(item.query) ?? 0) + 1);
      if (item.page) allowedOwners.add(item.page);
    }
    return seoPreprocessingOutputSchema.superRefine((output, context) => {
      const actualQueries = new Map<string, number>();
      for (const cluster of output.clusters) {
        for (const query of cluster.queries) actualQueries.set(query, (actualQueries.get(query) ?? 0) + 1);
        if (cluster.ownerCandidate !== null && !allowedOwners.has(cluster.ownerCandidate)) {
          context.addIssue({ code: "custom", message: "ownerCandidate is outside input pages", path: ["clusters"] });
        }
      }
      if (expectedQueries.size !== actualQueries.size || [...expectedQueries].some(([query, count]) => actualQueries.get(query) !== count)) {
        context.addIssue({ code: "custom", message: "queries must preserve the exact input multiset", path: ["clusters"] });
      }
    }).safeParse(outputValue);
  }

  const input = parseLocalAiTaskInput(taskType, inputValue);
  if (!input.success) return input;
  return parseLocalAiTaskOutput(taskType, outputValue);
}

export type LocalAiTaskInput = {
  [K in LocalAiTaskType]: z.infer<(typeof localAiTaskInputSchemas)[K]>;
};

export type LocalAiTaskOutput = {
  [K in LocalAiTaskType]: z.infer<(typeof localAiTaskOutputSchemas)[K]>;
};
