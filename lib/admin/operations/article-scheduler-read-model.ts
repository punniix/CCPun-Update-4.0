import "server-only";

import { neon } from "@neondatabase/serverless";
import { z } from "zod";
import { ARTICLE_SCHEDULER_CHECKSUM, ARTICLE_SCHEDULER_MIGRATION } from "../../../db/migrations/20260911_article_scheduling_v1";
import {
  resolveArticleSchedulerLane,
  SCHEDULER_LANES,
  SCHEDULER_ROLE,
  scheduleStatusSchema,
} from "./article-schedule-contract";

const timestamp = z.union([z.string(), z.date()]).transform((value) => new Date(value).toISOString());

const identitySchema = z.object({
  database_name: z.literal("neondb"),
  role_name: z.literal(SCHEDULER_ROLE),
  lane: z.enum(["uat", "production"]),
  project_id: z.string(),
  branch_id: z.string(),
  endpoint_id: z.string(),
  sanity_project_id: z.string(),
  sanity_dataset: z.string(),
  mode: z.enum(["publish", "validate-only"]),
  enabled: z.boolean(),
  migration_version: z.literal(ARTICLE_SCHEDULER_MIGRATION),
  migration_checksum: z.literal(ARTICLE_SCHEDULER_CHECKSUM),
});

const scheduleRowSchema = z.object({
  article_id: z.string().min(1).max(128),
  generation: z.string().uuid(),
  row_version: z.coerce.number().int().positive(),
  status: scheduleStatusSchema,
  mode: z.enum(["publish", "validate-only"]),
  draft_revision: z.string().min(1).max(200),
  published_revision: z.string().min(1).max(200).nullable(),
  scheduled_at: timestamp,
  created_by: z.string(),
  workflow_run_id: z.string().nullable(),
  lease_expires_at: timestamp.nullable(),
  created_at: timestamp,
  updated_at: timestamp,
  completed_at: timestamp.nullable(),
  error_code: z.string().nullable(),
  transaction_id: z.string().nullable(),
});

const auditRowSchema = z.object({
  generation: z.string().uuid(),
  row_version: z.coerce.number().int().positive(),
  article_id: z.string().min(1).max(128),
  status: scheduleStatusSchema,
  actor: z.string(),
  scheduled_at: timestamp,
  error_code: z.string().nullable(),
  transaction_id: z.string().nullable(),
  occurred_at: timestamp,
});

export type ArticleScheduleRecord = z.infer<typeof scheduleRowSchema>;
export type ArticleScheduleAuditRecord = z.infer<typeof auditRowSchema>;

export type ArticleSchedulerReadModel = {
  status: "ready" | "unavailable";
  lane: "uat" | "production" | null;
  mode: "publish" | "validate-only" | null;
  runtimeEnabled: boolean;
  durableEnabled: boolean;
  effectiveEnabled: boolean;
  schedules: ArticleScheduleRecord[];
  audit: ArticleScheduleAuditRecord[];
  error: string | null;
};

export async function readArticleSchedulerModel(
  options: { scheduleLimit?: number; auditLimit?: number } = {},
  env: Record<string, string | undefined> = process.env,
): Promise<ArticleSchedulerReadModel> {
  const lane = resolveArticleSchedulerLane(env);
  const runtimeEnabled = env.CCPUN_ARTICLE_SCHEDULING_ENABLED === "1";
  if (!lane) {
    return {
      status: "unavailable",
      lane: null,
      mode: null,
      runtimeEnabled,
      durableEnabled: false,
      effectiveEnabled: false,
      schedules: [],
      audit: [],
      error: "scheduler-lane-not-ready",
    };
  }

  const expected = SCHEDULER_LANES[lane];
  const connectionString = env.CCPUN_ADMIN_DATABASE_URL?.trim();
  if (!connectionString) {
    return {
      status: "unavailable",
      lane,
      mode: expected.mode,
      runtimeEnabled,
      durableEnabled: false,
      effectiveEnabled: false,
      schedules: [],
      audit: [],
      error: "scheduler-database-not-configured",
    };
  }

  const scheduleLimit = Math.max(1, Math.min(200, Math.trunc(options.scheduleLimit ?? 100)));
  const auditLimit = Math.max(1, Math.min(300, Math.trunc(options.auditLimit ?? 100)));

  try {
    const sql = neon(connectionString, { fetchOptions: { signal: AbortSignal.timeout(5_000) } });
    const identities = z.array(identitySchema).length(1).parse(await sql.query(
      `SELECT current_database() AS database_name,current_user AS role_name,lane,project_id,branch_id,endpoint_id,
        sanity_project_id,sanity_dataset,mode,enabled,migration_version,migration_checksum
       FROM ccpun_admin.article_scheduler_identity WHERE singleton=true`,
    ));
    const identity = identities[0];
    if (
      identity.lane !== lane ||
      identity.project_id !== expected.projectId ||
      identity.branch_id !== expected.branchId ||
      identity.endpoint_id !== expected.endpointId ||
      identity.sanity_project_id !== expected.sanityProjectId ||
      identity.sanity_dataset !== expected.dataset ||
      identity.mode !== expected.mode
    ) {
      throw new Error("scheduler-identity-mismatch");
    }

    const [schedules, audit] = await Promise.all([
      sql.query(
        `SELECT article_id,generation,row_version,status,mode,draft_revision,published_revision,scheduled_at,created_by,workflow_run_id,lease_expires_at,
          created_at,updated_at,completed_at,error_code,transaction_id
         FROM ccpun_admin.article_schedule
         ORDER BY scheduled_at DESC, updated_at DESC LIMIT $1`,
        [scheduleLimit],
      ),
      sql.query(
        `SELECT generation,row_version,article_id,status,actor,scheduled_at,error_code,transaction_id,occurred_at
         FROM ccpun_admin.article_schedule_audit
         ORDER BY occurred_at DESC LIMIT $1`,
        [auditLimit],
      ),
    ]);

    return {
      status: "ready",
      lane,
      mode: identity.mode,
      runtimeEnabled,
      durableEnabled: identity.enabled,
      effectiveEnabled: runtimeEnabled && identity.enabled,
      schedules: z.array(scheduleRowSchema).parse(schedules),
      audit: z.array(auditRowSchema).parse(audit),
      error: null,
    };
  } catch (error) {
    return {
      status: "unavailable",
      lane,
      mode: expected.mode,
      runtimeEnabled,
      durableEnabled: false,
      effectiveEnabled: false,
      schedules: [],
      audit: [],
      error: error instanceof Error ? error.message : "scheduler-read-failed",
    };
  }
}
