import { z } from "zod";

export const SAFE_KNOWLEDGE_QUESTION_IDS = [
  "motor_2plus_vs_3plus",
  "motor_types_overview",
  "critical_illness_basics",
  "health_happy_basics",
  "financial_pyramid_basics",
  "investment_before_act",
] as const;

export type SafeKnowledgeQuestionId = (typeof SAFE_KNOWLEDGE_QUESTION_IDS)[number];

export const safeKnowledgeRequestSchema = z.object({
  question_id: z.enum(SAFE_KNOWLEDGE_QUESTION_IDS),
  journey: z.enum(["motor_quote_review", "life_health_policy_review", "investment_before_you_act"]),
  stage: z.string().trim().min(1).max(80).regex(/^[a-z0-9][a-z0-9_-]*$/),
  personalized: z.boolean().default(false),
  suitability_required: z.boolean().default(false),
  recommendation_required: z.boolean().default(false),
  quote_required: z.boolean().default(false),
  health_conclusion_required: z.boolean().default(false),
  explicit_human_request: z.boolean().default(false),
  material_received: z.boolean().default(false),
  needs_human: z.boolean().default(false),
  content_id: z.string().trim().min(1).max(80).regex(/^[a-z0-9][a-z0-9_-]*$/).optional(),
}).strict();

export type SafeKnowledgeRequest = z.infer<typeof safeKnowledgeRequestSchema>;

export type SafeKnowledgeDecision =
  | { kind: "approved_answer"; questionId: SafeKnowledgeQuestionId; sourceSlug: string; sourcePath: string; answer: string }
  | { kind: "related_content"; questionId: SafeKnowledgeQuestionId; sourceSlug: string; sourcePath: string }
  | { kind: "human_handoff"; questionId: SafeKnowledgeQuestionId; reason: "personalized" | "human_requested" | "no_approved_answer" | "source_unavailable" };

export const SAFE_KNOWLEDGE_REGISTRY: Record<
  SafeKnowledgeQuestionId,
  { sourceSlug: string | null; faqKeywords: readonly string[] }
> = {
  motor_2plus_vs_3plus: { sourceSlug: "car-insurance-types", faqKeywords: ["2+", "3+"] },
  motor_types_overview: { sourceSlug: "car-insurance-types", faqKeywords: ["ประกันรถ", "ชั้น"] },
  critical_illness_basics: { sourceSlug: "critical-illness-insurance", faqKeywords: ["โรคร้ายแรง"] },
  health_happy_basics: { sourceSlug: "aia-health-happy-describe", faqKeywords: ["health happy", "สุขภาพ"] },
  financial_pyramid_basics: { sourceSlug: "financial-pyramid", faqKeywords: ["พีระมิด", "การเงิน"] },
  investment_before_act: { sourceSlug: null, faqKeywords: [] },
};

export function parseSafeKnowledgeRequest(input: unknown): SafeKnowledgeRequest | null {
  const parsed = safeKnowledgeRequestSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}

export function requiresHumanKnowledgeHandoff(input: SafeKnowledgeRequest) {
  return input.explicit_human_request
    || input.personalized
    || input.suitability_required
    || input.recommendation_required
    || input.quote_required
    || input.health_conclusion_required
    || input.needs_human;
}

export function buildSafeKnowledgeEventPayload(
  input: unknown,
  decision: SafeKnowledgeDecision,
) {
  const request = parseSafeKnowledgeRequest(input);
  if (!request || decision.questionId !== request.question_id) return null;
  return {
    question_id: request.question_id,
    journey: request.journey,
    stage: request.stage,
    outcome: decision.kind,
    reason: decision.kind === "human_handoff" ? decision.reason : null,
    request_content_id: request.content_id ?? null,
    source_slug: decision.kind === "human_handoff" ? null : decision.sourceSlug,
  } as const;
}

export const SAFE_KNOWLEDGE_FORBIDDEN_KEYS = [
  "customer_id", "lead_id", "line_user_id", "user_id", "name", "display_name",
  "message", "text", "chat", "document", "file", "phone", "email", "address",
  "birthday", "policy_number", "quotation", "income", "asset", "assets", "debt",
  "debts", "holding", "holdings", "portfolio", "health", "medical", "diagnosis",
  "internal_note", "internal_notes", "recipient", "recipients", "recipient_list",
] as const;
