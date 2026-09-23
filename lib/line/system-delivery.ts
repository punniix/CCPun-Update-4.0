import { z } from "zod";

export const LINE_ARTICLE_DISCOVERY_JOURNEYS = [
  "motor_quote_review",
  "life_health_policy_review",
  "investment_before_you_act",
] as const;

export const lineArticleDiscoveryJourneySchema = z.enum(LINE_ARTICLE_DISCOVERY_JOURNEYS);
export type LineArticleDiscoveryJourney = z.infer<typeof lineArticleDiscoveryJourneySchema>;

const lineSystemMessageIntentSchema = z.object({
  kind: z.literal("article_discovery"),
  journey: lineArticleDiscoveryJourneySchema,
}).strict();

export type LineSystemMessageIntent = z.infer<typeof lineSystemMessageIntentSchema>;

export function encodeLineSystemMessageIntent(journey: LineArticleDiscoveryJourney) {
  return JSON.stringify({ kind: "article_discovery", journey } satisfies LineSystemMessageIntent);
}

export function parseLineSystemMessageIntent(value: string): LineSystemMessageIntent | null {
  if (!value || value.length > 512) return null;
  try {
    const parsed = lineSystemMessageIntentSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function isLineArticleDiscoveryJourney(value: unknown): value is LineArticleDiscoveryJourney {
  return lineArticleDiscoveryJourneySchema.safeParse(value).success;
}
