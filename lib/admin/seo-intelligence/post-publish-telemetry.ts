import "server-only";
import { z } from "zod";
import { readSupabaseConfig } from "../ops-telemetry/store";
import { workerDatabaseIdentity } from "./post-publish-worker-policy";

const detailSchema = z.object({ articleId: z.string().max(200), path: z.string().max(500),
  httpStatus: z.number().int().optional(), verdict: z.string().max(100).optional(), coverageState: z.string().max(200).optional() }).strict();
const steps = ["webhook-received", "live-gate", "gsc-sitemap-submit", "indexnow", "inspect-1h", "inspect-24h"] as const;
export async function writeSeoTelemetry(input: { jobId: string; step: typeof steps[number]; status: "succeeded" | "failed" | "skipped" | "warning"; errorCategory?: string; detail: unknown },
  env: Record<string, string | undefined> = process.env, fetcher: typeof fetch = fetch) {
  if (!workerDatabaseIdentity(env)) return;
  const detail = detailSchema.safeParse(input.detail);
  if (!detail.success || !steps.includes(input.step) || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(input.errorCategory ?? "none")) return;
  if (/@|(?:\+?66|0)[689]\d{8}\b/.test(JSON.stringify(detail.data))) return;
  const config = readSupabaseConfig(env); if (!config) return;
  try {
    const headers = { apikey: config.key, Authorization: `Bearer ${config.key}`, "Content-Type": "application/json" };
    const identity = await fetcher(`${config.url}/rest/v1/ops_lane_identity?select=lane&singleton=eq.true`, { headers, redirect: "error", signal: AbortSignal.timeout(4000) });
    const lane = await identity.json() as { lane?: string }[];
    if (!identity.ok || lane[0]?.lane !== "production-admin") return;
    const result = await fetcher(`${config.url}/rest/v1/ops_workflow_runs`, { method: "POST", headers: { ...headers, Prefer: "resolution=ignore-duplicates" }, redirect: "error", signal: AbortSignal.timeout(4000),
      body: JSON.stringify({ workflow_id: "seoPostPublish01", workflow_name: "SEO หลังเผยแพร่", execution_id: input.jobId,
        step: input.step, status: input.status, error_category: input.errorCategory ?? null, detail: detail.data,
        started_at: new Date().toISOString() }) });
    if (!result.ok) throw new Error("telemetry-unavailable");
  } catch { console.warn("SEO_OPS_TELEMETRY_UNAVAILABLE"); }
}
