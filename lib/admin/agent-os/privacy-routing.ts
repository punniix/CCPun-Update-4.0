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
    | "sensitive_requires_sanitization"
    | "sanitized_sensitive_opt_in"
    | "raw_conversation_prohibited"
    | "secret_prohibited";
};

export function evaluateCloudEligibility(input: {
  dataClass: AgentOsDataClass;
  sanitized: boolean;
  allowlisted: boolean;
  explicitWorkflowOptIn: boolean;
}): CloudEligibility {
  if (input.dataClass === "secret") return { allowed: false, reason: "secret_prohibited" };
  if (input.dataClass === "raw_conversation") return { allowed: false, reason: "raw_conversation_prohibited" };
  if (input.dataClass === "public_safe") return { allowed: true, reason: "public_safe" };
  if (input.dataClass === "internal_safe") {
    return input.allowlisted
      ? { allowed: true, reason: "internal_allowlisted" }
      : { allowed: false, reason: "sensitive_requires_sanitization" };
  }
  if (input.sanitized && input.allowlisted && input.explicitWorkflowOptIn) {
    return { allowed: true, reason: "sanitized_sensitive_opt_in" };
  }
  return { allowed: false, reason: "sensitive_requires_sanitization" };
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

export function cloudPayloadUsesOnlyAllowedKeys(payload: Record<string, unknown>, allowedKeys: readonly string[]) {
  const allowed = new Set(allowedKeys);
  return Object.keys(payload).every((key) => allowed.has(key) && !PROHIBITED_CLOUD_KEYS.has(key));
}
