import "server-only";

import { neon } from "@neondatabase/serverless";
import { z } from "zod";
import { ARTICLE_SCHEDULER_CHECKSUM, ARTICLE_SCHEDULER_MIGRATION } from "../../../db/migrations/20260911_article_scheduling_v1";
import { ArticleScheduleError, resolveArticleSchedulerLane, SCHEDULER_LANES, SCHEDULER_ROLE, scheduleRowSchema, type ArticleScheduleRow, type ScheduleStatus } from "./article-schedule-contract";
import { ACK_ARTICLE_DISPATCH, AUTHORIZE_ARTICLE_EXECUTION, CANCEL_ARTICLE_SCHEDULE, CLAIM_ARTICLE_SCHEDULE, FAIL_ARTICLE_DISPATCH, FINISH_ARTICLE_SCHEDULE, PREPARE_ARTICLE_SCHEDULE } from "./article-schedule-sql";

export type ScheduleStore = {
  mode: "publish" | "validate-only";
  enabled: boolean;
  read(articleId: string): Promise<ArticleScheduleRow | null>;
  prepare(input: { articleId: string; generation: string; draftRevision: string; publishedRevision: string | null; scheduledAt: string; actor: string; expectedGeneration: string | null; expectedVersion: number }): Promise<ArticleScheduleRow | null>;
  acknowledge(articleId: string, generation: string, runId: string): Promise<ArticleScheduleRow | null>;
  failDispatch(articleId: string, generation: string): Promise<void>;
  cancel(articleId: string, generation: string, version: number, actor: string): Promise<ArticleScheduleRow | null>;
  claim(articleId: string, generation: string, executionId: string): Promise<ArticleScheduleRow | null>;
  authorize(row: ArticleScheduleRow): Promise<boolean>;
  finish(row: ArticleScheduleRow, status: ScheduleStatus, errorCode?: string, transactionId?: string): Promise<void>;
};

export async function openArticleScheduleStore(): Promise<ScheduleStore> {
  const lane = resolveArticleSchedulerLane();
  if (!lane) throw new ArticleScheduleError("not-ready");
  const expected = SCHEDULER_LANES[lane];
  // Never fall back to social, owner, backfill or generic DATABASE_URL credentials.
  const sql = neon(process.env.CCPUN_ADMIN_DATABASE_URL!, { fetchOptions: { signal: AbortSignal.timeout(10_000) } });
  const identitySchema = z.object({ database_name: z.literal("neondb"), role_name: z.literal(SCHEDULER_ROLE), lane: z.literal(lane),
    project_id: z.literal(expected.projectId), branch_id: z.literal(expected.branchId), endpoint_id: z.literal(expected.endpointId),
    sanity_project_id: z.literal(expected.sanityProjectId), sanity_dataset: z.literal(expected.dataset), mode: z.literal(expected.mode),
    enabled: z.boolean(), migration_version: z.literal(ARTICLE_SCHEDULER_MIGRATION), migration_checksum: z.literal(ARTICLE_SCHEDULER_CHECKSUM) });
  async function verifyIdentity() {
    const rows = await sql.query(`SELECT current_database() AS database_name,current_user AS role_name,
      lane,project_id,branch_id,endpoint_id,sanity_project_id,sanity_dataset,mode,enabled,migration_version,migration_checksum
      FROM ccpun_admin.article_scheduler_identity WHERE singleton=true`);
    const parsed = z.array(identitySchema).length(1).safeParse(rows);
    if (!parsed.success) throw new ArticleScheduleError("not-ready");
    return parsed.data[0];
  }
  const identity = await verifyIdentity();
  async function query(statement: string, parameters: unknown[]) {
    // Recheck the durable data-plane identity on every operation, including pinned workflows.
    await verifyIdentity();
    return sql.query(statement, parameters);
  }
  async function one(statement: string, parameters: unknown[]) {
    const rows = z.array(scheduleRowSchema).max(1).parse(await query(statement, parameters));
    return rows[0] ?? null;
  }
  return {
    mode: expected.mode,
    enabled: identity.enabled && process.env.CCPUN_ARTICLE_SCHEDULING_ENABLED === "1",
    read: (articleId) => one("SELECT * FROM ccpun_admin.article_schedule WHERE article_id=$1", [articleId]),
    prepare: (input) => one(PREPARE_ARTICLE_SCHEDULE, [input.articleId,input.generation,input.draftRevision,input.publishedRevision,input.scheduledAt,input.actor,input.expectedGeneration,input.expectedVersion]),
    acknowledge: (articleId,generation,runId) => one(ACK_ARTICLE_DISPATCH, [articleId,generation,runId]),
    async failDispatch(articleId,generation) { await one(FAIL_ARTICLE_DISPATCH, [articleId,generation]); },
    cancel: (articleId,generation,version,actor) => one(CANCEL_ARTICLE_SCHEDULE, [articleId,generation,version,actor]),
    claim: (articleId,generation,executionId) => one(CLAIM_ARTICLE_SCHEDULE, [articleId,generation,executionId]),
    async authorize(row) {
      const rows = z.array(z.object({ allowed: z.boolean() })).length(1).parse(await query(AUTHORIZE_ARTICLE_EXECUTION, [row.article_id,row.generation,row.execution_id]));
      return rows[0].allowed && process.env.CCPUN_ARTICLE_SCHEDULING_ENABLED === "1";
    },
    async finish(row,status,errorCode,transactionId) {
      const result = await one(FINISH_ARTICLE_SCHEDULE, [row.article_id,row.generation,row.execution_id,status,errorCode ?? null,transactionId ?? null]);
      if (!result) throw new ArticleScheduleError("outcome-unknown");
    },
  };
}
