import { z } from "zod";

export const AGENT_OS_DATA_CLASSES = [
  "public_safe",
  "internal_safe",
  "customer_personal",
  "financial_sensitive",
  "health_sensitive",
  "raw_conversation",
  "secret",
] as const;

export const agentOsDataClassSchema = z.enum(AGENT_OS_DATA_CLASSES);
export type AgentOsDataClass = z.infer<typeof agentOsDataClassSchema>;

export type CloudEligibility = {
  allowed: boolean;
  reason:
    | "public_safe"
    | "internal_allowlisted"
    | "internal_not_allowlisted"
    | "sensitive_prohibited"
    | "unknown_data_class"
    | "raw_conversation_prohibited"
    | "secret_prohibited";
};

export function evaluateCloudEligibility(input: {
  dataClass: AgentOsDataClass;
  sanitized: boolean;
  allowlisted: boolean;
  explicitWorkflowOptIn: boolean;
}): CloudEligibility {
  if (!agentOsDataClassSchema.safeParse(input.dataClass).success) return { allowed: false, reason: "unknown_data_class" };
  if (input.dataClass === "secret") return { allowed: false, reason: "secret_prohibited" };
  if (input.dataClass === "raw_conversation") return { allowed: false, reason: "raw_conversation_prohibited" };
  if (input.dataClass === "public_safe") return { allowed: true, reason: "public_safe" };
  if (input.dataClass === "internal_safe") {
    return input.allowlisted
      ? { allowed: true, reason: "internal_allowlisted" }
      : { allowed: false, reason: "internal_not_allowlisted" };
  }
  // Sanitization or workflow opt-in cannot authorize private customer facts.
  return { allowed: false, reason: "sensitive_prohibited" };
}

const PROHIBITED_CLOUD_KEYS = new Set([
  "name",
  "phone",
  "email",
  "line_id",
  "lineId",
  "transcript",
  "raw_message",
  "rawMessage",
  "health_details",
  "healthDetails",
  "financial_details",
  "financialDetails",
  "policy_number",
  "policyNumber",
  "secret",
  "token",
  "api_key",
  "apiKey",
]);

const cloudAggregateSchema = z.object({
  topic: z.literal("health_coverage"),
  count: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  qualified_rate: z.number().min(0).max(1),
}).strict();

export function cloudPayloadUsesOnlyAllowedKeys(payload: unknown, allowedKeys: readonly string[]) {
  // This schema is only a public aggregate contract, not proof of privacy or consent.
  // Callers cannot widen it by adding a key to their allowlist.
  try {
    if (!payload || typeof payload !== "object" || Object.getPrototypeOf(payload) !== Object.prototype) return false;
    const descriptors = Object.getOwnPropertyDescriptors(payload);
    const keys = Reflect.ownKeys(payload);
    const allowed = new Set(allowedKeys);
    return keys.every((key) => typeof key === "string" && allowed.has(key)
      && !PROHIBITED_CLOUD_KEYS.has(key) && "value" in descriptors[key])
      && cloudAggregateSchema.safeParse(payload).success;
  } catch {
    return false;
  }
}
