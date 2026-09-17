export const LINE_CASE_STAGES = [
  "New",
  "Qualified",
  "Expert Review",
  "Solution",
  "Quote",
  "Implementation",
  "Won",
  "Lost",
] as const;

export type LineCaseStage = (typeof LINE_CASE_STAGES)[number];

const TRANSITIONS: Record<LineCaseStage, readonly LineCaseStage[]> = {
  New: ["Qualified", "Lost"],
  Qualified: ["Expert Review", "Lost"],
  "Expert Review": ["Solution", "Quote", "Lost"],
  Solution: ["Quote", "Implementation", "Lost"],
  Quote: ["Solution", "Implementation", "Lost"],
  Implementation: ["Won", "Lost"],
  Won: [],
  Lost: [],
};

export function isLineCaseStage(value: unknown): value is LineCaseStage {
  return typeof value === "string" && LINE_CASE_STAGES.includes(value as LineCaseStage);
}

export function nextLineCaseStages(stage: LineCaseStage): readonly LineCaseStage[] {
  return TRANSITIONS[stage];
}

export function canTransitionLineCaseStage(from: LineCaseStage, to: LineCaseStage) {
  return TRANSITIONS[from].includes(to);
}

export const LINE_VERTICAL_JOURNEYS = {
  motor_quote_review: {
    vertical: "motor",
    label: "ประกันรถ",
    heroOffer: "ส่ง Quote มาเช็ก",
    entryQuestion: "มีใบเสนอราคาประกันรถอยู่แล้วไหม?",
  },
  life_health_policy_review: {
    vertical: "life-health",
    label: "ชีวิต / สุขภาพ",
    heroOffer: "ส่งของเดิมมาเช็ก",
    entryQuestion: "มีกรมธรรม์หรือแผนเดิมที่อยากให้ช่วยแยกหน้าที่ไหม?",
  },
  investment_before_you_act: {
    vertical: "investment",
    label: "ลงทุน",
    heroOffer: "ก่อนเพิ่ม/ย้าย ลองเช็กก่อน",
    entryQuestion: "กำลังจะเพิ่มเงิน ย้ายกอง หรือซื้ออะไรเพิ่ม?",
  },
} as const;

export type LineJourneyId = keyof typeof LINE_VERTICAL_JOURNEYS;

export type LineBotDecision =
  | "approved_answer"
  | "show_content"
  | "show_tool"
  | "qualify"
  | "human_handoff";

export type LineBotRoutingInput = {
  approvedAnswerAvailable: boolean;
  approvedContentAvailable: boolean;
  approvedToolAvailable: boolean;
  qualificationNeeded: boolean;
  personalized: boolean;
  suitabilityRequired: boolean;
  recommendationRequired: boolean;
  quoteRequired: boolean;
  explicitHumanRequest: boolean;
};

export function routeLineBot(input: LineBotRoutingInput): LineBotDecision {
  if (
    input.explicitHumanRequest ||
    input.personalized ||
    input.suitabilityRequired ||
    input.recommendationRequired ||
    input.quoteRequired ||
    (!input.approvedAnswerAvailable && !input.approvedContentAvailable && !input.approvedToolAvailable)
  ) return "human_handoff";
  if (input.qualificationNeeded) return "qualify";
  if (input.approvedAnswerAvailable) return "approved_answer";
  if (input.approvedToolAvailable) return "show_tool";
  return "show_content";
}

export const LINE_RICH_MENU_ITEMS = [
  { id: "content", label: "หาเรื่องอ่าน", action: "uri", uri: "https://ccpun.com/blog/" },
  { id: "tools", label: "เครื่องมือ", action: "uri", uri: "https://ccpun.com/tools/" },
  { id: "insurance", label: "ประกัน", action: "postback", postbackData: "journey=life_health_policy_review&stage=entry" },
  { id: "investment", label: "ลงทุน", action: "postback", postbackData: "journey=investment_before_you_act&stage=entry" },
  { id: "motor", label: "รถ", action: "postback", postbackData: "journey=motor_quote_review&stage=entry" },
  { id: "human", label: "คุยกับปัน", action: "postback", postbackData: "journey=human_handoff&stage=waiting_for_advisor" },
] as const;

export const LINE_QUICK_REPLIES = [
  { id: "motor_has_quote", label: "มี Quote แล้ว", journey: "motor_quote_review", stage: "quote_available" },
  { id: "motor_no_quote", label: "ยังไม่มี Quote", journey: "motor_quote_review", stage: "need_vehicle_info" },
  { id: "life_has_policy", label: "มีกรมธรรม์เดิม", journey: "life_health_policy_review", stage: "material_request" },
  { id: "life_ci_check", label: "เช็กเงินก้อนโรคร้ายแรง", journey: "life_health_policy_review", stage: "ci_planning_context" },
  { id: "invest_add", label: "ก่อนซื้อเพิ่ม", journey: "investment_before_you_act", stage: "before_add" },
  { id: "invest_move", label: "ก่อนย้าย/สับเปลี่ยน", journey: "investment_before_you_act", stage: "before_switch" },
] as const;

const SAFE_ID = /^[a-z0-9][a-z0-9_-]{0,79}$/;
const SAFE_ATTRIBUTION = /^[a-z0-9][a-z0-9_.:-]{0,79}$/;
const ALLOWED_INTENT_KEYS = new Set(["journey", "entrypoint", "content_id", "tool_id", "saved_result_id", "campaign_id", "attribution"]);
const ALLOWED_ATTRIBUTION_KEYS = new Set(["traffic_source", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "referrer_host"]);
const FORBIDDEN_KEYS = new Set([
  "name", "phone", "email", "line_user_id", "user_id", "message", "text", "document", "file",
  "income", "asset", "assets", "debt", "debts", "health", "medical", "diagnosis", "policy_number",
]);

export type SafeJourneyAttribution = Partial<Record<
  "traffic_source" | "utm_source" | "utm_medium" | "utm_campaign" | "utm_content" | "utm_term" | "referrer_host",
  string
>>;

export type LineJourneyIntent = {
  journey: LineJourneyId;
  entrypoint: string;
  content_id?: string;
  tool_id?: string;
  saved_result_id?: string;
  campaign_id?: string;
  attribution?: SafeJourneyAttribution;
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function containsForbiddenKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsForbiddenKey);
  const obj = record(value);
  if (!obj) return false;
  return Object.entries(obj).some(([key, nested]) => FORBIDDEN_KEYS.has(key.toLowerCase()) || containsForbiddenKey(nested));
}

function safeId(value: unknown): string | undefined {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return SAFE_ID.test(normalized) ? normalized : undefined;
}

export function parseLineJourneyIntent(value: unknown): LineJourneyIntent | null {
  if (containsForbiddenKey(value)) return null;
  const obj = record(value);
  if (!obj || Object.keys(obj).some((key) => !ALLOWED_INTENT_KEYS.has(key))) return null;
  const journey = safeId(obj.journey) as LineJourneyId | undefined;
  if (!journey || !(journey in LINE_VERTICAL_JOURNEYS)) return null;
  const entrypoint = safeId(obj.entrypoint) ?? "web";
  let attribution: SafeJourneyAttribution | undefined;
  if (obj.attribution !== undefined) {
    const raw = record(obj.attribution);
    if (!raw || Object.keys(raw).some((key) => !ALLOWED_ATTRIBUTION_KEYS.has(key))) return null;
    attribution = {};
    for (const [key, rawValue] of Object.entries(raw)) {
      const normalized = typeof rawValue === "string" ? rawValue.trim().toLowerCase() : "";
      if (!SAFE_ATTRIBUTION.test(normalized)) return null;
      attribution[key as keyof SafeJourneyAttribution] = normalized;
    }
  }
  const contentId = safeId(obj.content_id);
  const toolId = safeId(obj.tool_id);
  const savedResultId = safeId(obj.saved_result_id);
  const campaignId = safeId(obj.campaign_id);
  return {
    journey,
    entrypoint,
    ...(contentId ? { content_id: contentId } : {}),
    ...(toolId ? { tool_id: toolId } : {}),
    ...(savedResultId ? { saved_result_id: savedResultId } : {}),
    ...(campaignId ? { campaign_id: campaignId } : {}),
    ...(attribution && Object.keys(attribution).length ? { attribution } : {}),
  };
}

export function buildLineContinueLink(value: unknown, officialAccountId = "@ccpun") {
  const intent = parseLineJourneyIntent(value);
  if (!intent || !/^@[a-z0-9_.-]{2,40}$/i.test(officialAccountId)) return null;
  const journey = LINE_VERTICAL_JOURNEYS[intent.journey];
  const context = [journey.heroOffer, `journey:${intent.journey}`, `entry:${intent.entrypoint}`];
  if (intent.content_id) context.push(`content:${intent.content_id}`);
  if (intent.tool_id) context.push(`tool:${intent.tool_id}`);
  if (intent.saved_result_id) context.push(`saved:${intent.saved_result_id}`);
  const prefill = context.join(" | ");
  return {
    href: `https://line.me/R/oaMessage/${encodeURIComponent(officialAccountId)}/?${encodeURIComponent(prefill)}`,
    label: journey.heroOffer,
    prefill,
    intent,
  };
}
