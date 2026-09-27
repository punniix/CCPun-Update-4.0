import "server-only";
import { neon } from "@neondatabase/serverless";
import { z } from "zod";
import { adminOperationsRuntimeInputFromEnvironment, resolveAdminOperationsRuntimeIdentity } from "../operations/foundation";
import { analyticsDatasetSchema, analyticsSourceSchema, type AnalyticsDataset, type AnalyticsSource, type RawAnalyticsPage } from "./model";

const sourceStatusSchema = z.object({ source: analyticsSourceSchema, lastAttemptAt: z.string().nullable(), lastAttemptStatus: z.string().nullable(), lastError: z.string().nullable() });
export type AnalyticsDashboard = { state: "ready" | "unavailable"; datasets: AnalyticsDataset[]; sources: Array<z.infer<typeof sourceStatusSchema>> };
function sqlClient(variables: Record<string, string | undefined> = process.env) {
  if (!resolveAdminOperationsRuntimeIdentity(adminOperationsRuntimeInputFromEnvironment(variables)) || !variables.CCPUN_ADMIN_DATABASE_URL?.trim()) throw new Error("ANALYTICS_DATABASE_NOT_READY");
  return neon(variables.CCPUN_ADMIN_DATABASE_URL.trim(), { fetchOptions: { signal: AbortSignal.timeout(15_000) } });
}
export async function readAnalyticsDashboard(variables: Record<string, string | undefined> = process.env, cutoff = new Date().toISOString()): Promise<AnalyticsDashboard> {
  try {
    const rows = await sqlClient(variables).query("SELECT ccpun_admin.admin_read_analytics_daily($1::timestamptz) AS data", [z.string().datetime().parse(cutoff)]);
    const data = z.object({ datasets: z.array(analyticsDatasetSchema), sources: z.array(sourceStatusSchema) }).parse(rows[0]?.data);
    return { state: "ready", ...data };
  } catch { return { state: "unavailable", datasets: [], sources: [] }; }
}
export async function readAnalyticsResearch(variables: Record<string, string | undefined> = process.env) {
  const rows = await sqlClient(variables).query("SELECT ccpun_admin.admin_read_analytics_research() AS data", []);
  return z.array(z.object({ id: z.string(), keyword: z.string(), provider: z.string(), scope: z.string().nullable(), location: z.string().nullable(), language: z.string().nullable(), volume: z.number().nullable(), difficulty: z.number().nullable(), intent: z.string().nullable(), competitors: z.array(z.string()), serp: z.array(z.unknown()), serpCount: z.number(), checkedAt: z.string(), trustClass: z.string().nullable() })).parse(rows[0]?.data);
}
export async function beginAnalyticsCollection(source: AnalyticsSource, date: string, variables: Record<string, string | undefined> = process.env, key = "daily") {
  const rows = await sqlClient(variables).query("SELECT ccpun_admin.admin_begin_analytics_daily($1,$2::date,$3) AS data", [source, date, key]);
  return z.object({ status: z.enum(["claimed", "completed", "running", "failed"]), batchId: z.string().uuid(), attempt: z.number().int() }).parse(rows[0]?.data);
}
export async function finishAnalyticsCollection(input: { batchId: string; attempt: number; reports: AnalyticsDataset[]; raw: RawAnalyticsPage[]; error: string | null }, variables: Record<string, string | undefined> = process.env) {
  const payload = JSON.stringify(input);
  if (Buffer.byteLength(payload) > 20_000_000) throw new Error("ANALYTICS_BATCH_TOO_LARGE");
  const rows = await sqlClient(variables).query("SELECT ccpun_admin.admin_finish_analytics_daily($1::jsonb) AS data", [payload]);
  if (rows[0]?.data !== "completed" && rows[0]?.data !== "failed") throw new Error("ANALYTICS_CLAIM_CONFLICT");
  return rows[0].data as "completed" | "failed";
}
