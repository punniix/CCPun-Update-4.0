import "server-only";

import { neon } from "@neondatabase/serverless";
import { z } from "zod";
import {
  adminOperationsRuntimeInputFromEnvironment,
  resolveAdminOperationsRuntimeIdentity,
} from "../operations/foundation";

const safeId = z.string().trim().min(1).max(80).regex(/^[a-z0-9][a-z0-9_.:-]*$/);
const nullableSafeId = safeId.nullable();

const safeKnowledgePayloadSchema = z.object({
  question_id: z.enum([
    "motor_2plus_vs_3plus",
    "motor_types_overview",
    "critical_illness_basics",
    "health_happy_basics",
    "financial_pyramid_basics",
    "investment_before_act",
  ]),
  journey: z.enum(["motor_quote_review", "life_health_policy_review", "investment_before_you_act"]),
  stage: safeId,
  outcome: z.enum(["approved_answer", "related_content", "human_handoff"]),
  reason: z.enum(["personalized", "human_requested", "no_approved_answer", "source_unavailable"]).nullable(),
  request_content_id: nullableSafeId,
  source_slug: z.string().trim().min(1).max(160).regex(/^[a-z0-9][a-z0-9-]*$/).nullable(),
}).strict();

const attributionSchema = z.object({
  traffic_source: safeId.optional(),
  utm_source: safeId.optional(),
  utm_medium: safeId.optional(),
  utm_campaign: safeId.optional(),
  utm_content: safeId.optional(),
  utm_term: safeId.optional(),
  referrer_host: safeId.optional(),
}).strict();

const lineContinuePayloadSchema = z.object({
  journey: z.enum(["motor_quote_review", "life_health_policy_review", "investment_before_you_act"]),
  entrypoint: safeId,
  event_type: z.literal("line_continue"),
  content_id: nullableSafeId,
  tool_id: nullableSafeId,
  saved_result_ref: nullableSafeId,
  campaign_id: nullableSafeId,
  attribution: attributionSchema,
}).strict();

const publicEventSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("safe_knowledge"), payload: safeKnowledgePayloadSchema }).strict(),
  z.object({ kind: z.literal("line_continue"), payload: lineContinuePayloadSchema }).strict(),
]);

export type LinePublicEvent = z.infer<typeof publicEventSchema>;

function runtime(
  variables: Record<string, string | undefined> = process.env,
) {
  const identity = resolveAdminOperationsRuntimeIdentity(
    adminOperationsRuntimeInputFromEnvironment(variables),
  );
  const connectionString = variables.CCPUN_ADMIN_DATABASE_URL?.trim();
  if (!identity || !connectionString) return null;
  return {
    identity,
    sql: neon(connectionString, { fetchOptions: { signal: AbortSignal.timeout(5_000) } }),
  };
}

export function parseLinePublicEvent(input: unknown): LinePublicEvent | null {
  const parsed = publicEventSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}

export async function recordLinePublicEvent(
  input: unknown,
  variables: Record<string, string | undefined> = process.env,
) {
  const event = parseLinePublicEvent(input);
  if (!event) return { ok: false as const, status: "invalid" as const };
  const handle = runtime(variables);
  if (!handle) return { ok: false as const, status: "unavailable" as const };

  try {
    const rows = event.kind === "safe_knowledge"
      ? await handle.sql.query(
          "SELECT outcome FROM private_line.ingress_record_safe_knowledge_event($1::jsonb)",
          [JSON.stringify(event.payload)],
        )
      : await handle.sql.query(
          "SELECT outcome FROM private_line.record_safe_web_journey_event($1::jsonb)",
          [JSON.stringify(event.payload)],
        );
    const outcome = (rows as Array<{ outcome?: unknown }>)[0]?.outcome;
    return outcome === "recorded" || outcome === "accepted"
      ? { ok: true as const, status: "recorded" as const }
      : { ok: false as const, status: "rejected" as const };
  } catch {
    return { ok: false as const, status: "unavailable" as const };
  }
}
