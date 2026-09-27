import { z } from "zod";

export const INSIGHT_PERIODS = ["30d", "90d", "180d", "1y", "ytd", "all", "custom"] as const;
export const INSIGHT_COMPARISONS = ["none", "previous_period", "previous_year", "custom"] as const;

export const insightPeriodSchema = z.enum(INSIGHT_PERIODS);
export const insightComparisonSchema = z.enum(INSIGHT_COMPARISONS);

export type InsightWindow = { start: string | null; end: string };
export type InsightPeriod = z.infer<typeof insightPeriodSchema>;
export type InsightComparison = z.infer<typeof insightComparisonSchema>;

const DAY_MS = 86_400_000;
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

function iso(ms: number) {
  return new Date(ms).toISOString();
}

function bangkokYearStart(now: Date) {
  const bkk = new Date(now.getTime() + BANGKOK_OFFSET_MS);
  return Date.UTC(bkk.getUTCFullYear(), 0, 1) - BANGKOK_OFFSET_MS;
}

function validIso(value: string) {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

export function resolveInsightWindow(input: {
  period: InsightPeriod;
  nowIso: string;
  customStart?: string | null;
  customEnd?: string | null;
}): InsightWindow {
  const nowMs = validIso(input.nowIso);
  if (nowMs == null) throw new Error("INSIGHT_NOW_INVALID");

  if (input.period === "all") return { start: null, end: iso(nowMs) };
  if (input.period === "ytd") return { start: iso(bangkokYearStart(new Date(nowMs))), end: iso(nowMs) };

  if (input.period === "custom") {
    const start = input.customStart ? validIso(input.customStart) : null;
    const end = input.customEnd ? validIso(input.customEnd) : null;
    if (start == null || end == null || start >= end) throw new Error("INSIGHT_CUSTOM_RANGE_INVALID");
    return { start: iso(start), end: iso(end) };
  }

  const days = input.period === "30d" ? 30 : input.period === "90d" ? 90 : input.period === "180d" ? 180 : 365;
  return { start: iso(nowMs - days * DAY_MS), end: iso(nowMs) };
}

function shiftOneYear(value: string) {
  const date = new Date(value);
  const originalMonth = date.getUTCMonth();
  date.setUTCFullYear(date.getUTCFullYear() - 1);
  if (date.getUTCMonth() !== originalMonth) date.setUTCDate(0);
  return date.toISOString();
}

export function resolveComparisonWindow(input: {
  primary: InsightWindow;
  comparison: InsightComparison;
  customStart?: string | null;
  customEnd?: string | null;
}): InsightWindow | null {
  if (input.comparison === "none") return null;
  if (input.primary.start == null && input.comparison !== "custom") return null;

  if (input.comparison === "custom") {
    const start = input.customStart ? validIso(input.customStart) : null;
    const end = input.customEnd ? validIso(input.customEnd) : null;
    if (start == null || end == null || start >= end) throw new Error("INSIGHT_COMPARISON_RANGE_INVALID");
    return { start: iso(start), end: iso(end) };
  }

  if (input.comparison === "previous_year") {
    return { start: shiftOneYear(input.primary.start!), end: shiftOneYear(input.primary.end) };
  }

  const startMs = Date.parse(input.primary.start!);
  const endMs = Date.parse(input.primary.end);
  const span = endMs - startMs;
  return { start: iso(startMs - span), end: iso(startMs) };
}

export const customerInsightSignalSchema = z.object({
  topicId: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,79}$/),
  journey: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,79}$/),
  signalType: z.enum(["question", "pain_point", "objection", "need", "content_gap"]),
  count: z.number().int().nonnegative(),
  qualifiedCount: z.number().int().nonnegative(),
  wonCount: z.number().int().nonnegative(),
}).strict();
