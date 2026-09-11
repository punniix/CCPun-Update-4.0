import { z } from "zod";
import { isAdminDataPlaneAllowed, type AdminEnvironment } from "../environment";

export const SCHEDULER_VERSION = "20260911_article_scheduling_v1";
export const SCHEDULER_ROLE = "ccpun_admin_runtime";
export const SCHEDULER_LANES = {
  uat: { projectId: "young-term-47483330", branchId: "br-crimson-mouse-az7ajkv8", endpointId: "ep-mute-frost-aztvz394", hostSuffix: "c-3.ap-southeast-1.aws.neon.tech", sanityProjectId: "ccb9lnw5", dataset: "uat", mode: "validate-only" },
  production: { projectId: "lively-bar-43618798", branchId: "br-long-resonance-b3ys5xrv", endpointId: "ep-broad-butterfly-b3ro7u8w", hostSuffix: "c-4.ap-southeast-1.aws.neon.tech", sanityProjectId: "kyfxgjnq", dataset: "production", mode: "publish" },
} as const;
export type SchedulerLane = keyof typeof SCHEDULER_LANES;

export function resolveArticleSchedulerLane(variables: Record<string, string | undefined> = process.env): SchedulerLane | null {
  const environment = variables.CCPUN_APP_ENV as AdminEnvironment;
  const lane = environment === "production-admin" ? "production" : ["admin-uat", "local-uat"].includes(environment) ? "uat" : null;
  if (!lane) return null;
  const expected = SCHEDULER_LANES[lane];
  if (!isAdminDataPlaneAllowed(variables.NEXT_PUBLIC_SANITY_DATASET, environment, variables.VERCEL_PROJECT_ID, variables.CCPUN_PRODUCTION_ADMIN_VERCEL_PROJECT_ID, variables.NEXT_PUBLIC_SANITY_PROJECT_ID)) return null;
  if (environment === "production-admin" && (variables.VERCEL_ENV !== "production" || variables.VERCEL_GIT_COMMIT_REF !== "v4-production")) return null;
  if (environment === "admin-uat" && variables.VERCEL_ENV !== "preview") return null;
  if (variables.CCPUN_NEON_PROJECT_ID !== expected.projectId || variables.CCPUN_NEON_BRANCH_ID !== expected.branchId || variables.CCPUN_NEON_DATABASE !== "neondb") return null;
  try {
    const url = new URL(variables.CCPUN_ADMIN_DATABASE_URL || "");
    const hosts = [expected.endpointId, `${expected.endpointId}-pooler`].map((id) => `${id}.${expected.hostSuffix}`);
    return url.protocol === "postgresql:" && hosts.includes(url.hostname) && !url.port && !url.hash
      && decodeURIComponent(url.username) === SCHEDULER_ROLE && Boolean(url.password)
      && url.pathname === "/neondb" && url.searchParams.get("sslmode") === "require" ? lane : null;
  } catch { return null; }
}

export const scheduleStatusSchema = z.enum(["preparing", "scheduled", "executing", "published", "validated", "cancelled", "stale", "failed", "reconciliation-required"]);
export type ScheduleStatus = z.infer<typeof scheduleStatusSchema>;
export const articleIdSchema = z.string().min(1).max(128).regex(/^[A-Za-z0-9_][A-Za-z0-9_.-]*$/)
  .refine((id) => !/^(drafts\.|versions\.)/.test(id));
export const revisionSchema = z.string().min(1).max(200).regex(/^[A-Za-z0-9_.-]+$/);
export const scheduleRequestSchema = z.object({
  scheduledLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
  draftRevision: revisionSchema,
  publishedRevision: revisionSchema.nullable(),
  expectedGeneration: z.string().uuid().nullable(),
  expectedVersion: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  requestId: z.string().uuid(),
}).strict().refine((value) => (value.expectedGeneration === null) === (value.expectedVersion === 0));
export const cancelScheduleRequestSchema = z.object({
  expectedGeneration: z.string().uuid(), expectedVersion: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
}).strict();

const isoTimestamp = z.union([z.string().datetime({ offset: true }), z.date()]).transform((value) => new Date(value).toISOString());
export const scheduleRowSchema = z.object({
  article_id: articleIdSchema, generation: z.string().uuid(), row_version: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  draft_revision: revisionSchema, published_revision: revisionSchema.nullable(), scheduled_at: isoTimestamp,
  timezone: z.literal("Asia/Bangkok"), mode: z.enum(["publish", "validate-only"]), status: scheduleStatusSchema,
  created_by: z.string().min(1).max(320), workflow_run_id: z.string().nullable(), execution_id: z.string().uuid().nullable(),
  lease_expires_at: isoTimestamp.nullable(), created_at: isoTimestamp, updated_at: isoTimestamp,
  completed_at: isoTimestamp.nullable(), error_code: z.string().nullable(), transaction_id: z.string().nullable(),
});
export type ArticleScheduleRow = z.infer<typeof scheduleRowSchema>;
export type ScheduleView = { generation: string; rowVersion: number; status: ScheduleStatus; scheduledAt: string; timezone: "Asia/Bangkok"; mode: "publish" | "validate-only"; errorCode: string | null };
export function scheduleView(row: ArticleScheduleRow | null, now = Date.now()): ScheduleView | null {
  if (!row) return null;
  const expired = row.status === "executing" && (!row.lease_expires_at || Date.parse(row.lease_expires_at) <= now);
  return { generation: row.generation, rowVersion: row.row_version, status: expired ? "reconciliation-required" : row.status,
    scheduledAt: row.scheduled_at, timezone: row.timezone, mode: row.mode, errorCode: expired ? "EXECUTION_OUTCOME_UNKNOWN" : row.error_code };
}

export class ArticleScheduleError extends Error {
  constructor(public readonly code: "not-ready" | "invalid-request" | "conflict" | "article-not-ready" | "dispatch-failed" | "outcome-unknown") { super(code); }
}
