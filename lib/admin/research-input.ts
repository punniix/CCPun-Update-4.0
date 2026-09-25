import { z } from "zod";

const providerSchema = z.enum(["ubersuggest", "gsc", "serp", "manual"]);
const externalUrlSchema = z.string().url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "https:" || protocol === "http:";
}, "Only HTTP(S) research URLs are accepted");

const serpResultInputSchema = z.object({
  position: z.number().int().positive().optional(),
  title: z.string().trim().max(500).optional(),
  url: externalUrlSchema.optional(),
  domain: z.string().trim().max(255).optional(),
  snippet: z.string().trim().max(3000).optional(),
});

export const researchInputSchema = z.object({
  keyword: z.string().trim().min(1).max(300),
  provider: providerSchema,
  scope: z.string().trim().min(1).max(120).optional(),
  location: z.string().trim().min(1).max(120).optional(),
  language: z.string().trim().min(1).max(80).optional(),
  volume: z.number().min(0).optional(),
  difficulty: z.number().min(0).max(100).optional(),
  cpc: z.number().min(0).optional(),
  paidDifficulty: z.number().min(0).max(100).optional(),
  sourceMethod: z.enum(["web-csv-import", "provider-query", "manual-entry"]).optional(),
  sourcePosition: z.number().int().min(0).optional(),
  estimatedVisits: z.number().min(0).optional(),
  sourceUrl: externalUrlSchema.optional(),
  intent: z.enum(["informational", "commercial", "transactional", "navigational", "mixed"]).optional(),
  serp: z.array(serpResultInputSchema).max(30).optional(),
  competitors: z.array(z.string().trim().min(1).max(255)).max(50).transform((values) => [...new Map(values.map((value) => [value.toLocaleLowerCase("th-TH"), value])).values()]).optional(),
  checkedAt: z.string().datetime().optional(),
});

// ponytail: browser-entered evidence stays manual until a dedicated provider route validates provenance.
export const manualResearchInputSchema = researchInputSchema.extend({
  provider: z.literal("manual"),
});

export type ResearchInput = z.infer<typeof researchInputSchema>;

export function normalizeResearchKeyword(value: string) {
  return value.toLocaleLowerCase("th-TH").replace(/\s+/g, " ").trim();
}

export function researchOpportunityScore(volume: number | null | undefined, difficulty: number | null | undefined) {
  if (volume == null || difficulty == null) return null;
  const demand = Math.min(100, Math.log10(volume + 1) * 30);
  return Math.max(0, Math.min(100, Math.round(demand * (1 - difficulty / 100))));
}
