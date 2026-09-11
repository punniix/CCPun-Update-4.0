import { randomUUID } from "node:crypto";
import { scheduledArticleReadinessBlock } from "../../cms/sanity/policy/article-scheduling";
import type { PublishableArticle } from "../../cms/sanity/policy/article-publication";
import { ArticleScheduleError, type ArticleScheduleRow, type ScheduleStatus } from "./operations/article-schedule-contract";
import type { ScheduleStore } from "./operations/article-schedule-store";

export type ArticlePair = { draft: PublishableArticle | null; published: PublishableArticle | null };
export type ScheduleExecutorDependencies = {
  store: ScheduleStore;
  readArticle(articleId: string): Promise<ArticlePair>;
  ownerAllowed(actor: string): boolean;
  publish(draft: PublishableArticle, published: PublishableArticle | null): Promise<{ transactionId: string }>;
  now?: () => number;
};
export type ScheduleExecutionResult = { status: ScheduleStatus | "ignored" | "not-due" | "awaiting-dispatch" };

/** No automatic lease reclamation: an uncertain external write requires reconciliation. */
export async function executeArticleSchedule(
  dependencies: ScheduleExecutorDependencies,
  input: { articleId: string; generation: string },
): Promise<ScheduleExecutionResult> {
  const { store } = dependencies;
  const now = dependencies.now ?? Date.now;
  const current = await store.read(input.articleId);
  if (!current || current.generation !== input.generation) return { status: "ignored" };
  if (current.status === "preparing") return { status: "awaiting-dispatch" };
  if (current.status !== "scheduled" || !store.enabled) return { status: "ignored" };
  if (Date.parse(current.scheduled_at) > now()) return { status: "not-due" };
  const claimed = await store.claim(input.articleId, input.generation, randomUUID());
  if (!claimed) return { status: "ignored" };
  let mutationStarted = false;
  const finish = async (status: ScheduleStatus, errorCode?: string, transactionId?: string) => {
    await store.finish(claimed, status, errorCode, transactionId);
    return { status };
  };
  try {
    if (claimed.mode !== store.mode || !dependencies.ownerAllowed(claimed.created_by)) return await finish("failed", "AUTHORIZATION_REVOKED");
    const { draft, published } = await dependencies.readArticle(claimed.article_id);
    if (!draft) return await finish("stale", "DRAFT_MISSING");
    if (draft._id !== `drafts.${claimed.article_id}` || draft._rev !== claimed.draft_revision
      || (published?._rev ?? null) !== claimed.published_revision) return await finish("stale", "ARTICLE_REVISION_CHANGED");
    if (scheduledArticleReadinessBlock(draft, published, now())) return await finish("failed", "PUBLICATION_GUARD_BLOCKED");
    if (!await store.authorize(claimed)) return await finish("failed", "EXECUTION_NOT_AUTHORIZED");
    if (store.mode === "validate-only") return await finish("validated");
    mutationStarted = true;
    const receipt = await dependencies.publish(draft, published);
    if (!receipt || typeof receipt.transactionId !== "string" || !receipt.transactionId || receipt.transactionId.length > 200) {
      return await finish("reconciliation-required", "PUBLICATION_RECEIPT_MISSING");
    }
    return await finish("published", undefined, receipt.transactionId);
  } catch {
    // Never infer success merely because a published document exists or a Draft disappeared.
    try {
      return await finish(mutationStarted ? "reconciliation-required" : "failed",
        mutationStarted ? "PUBLICATION_OUTCOME_UNKNOWN" : "PREPUBLICATION_CHECK_FAILED");
    } catch {
      // A lost Neon acknowledgement leaves an executing/terminal row. It is never reclaimed.
      throw new ArticleScheduleError("outcome-unknown");
    }
  }
}

export function matchesScheduledSnapshot(row: ArticleScheduleRow, input: {
  generation: string; draftRevision: string; publishedRevision: string | null; scheduledAt: string; actor: string;
}) {
  return row.generation === input.generation && row.draft_revision === input.draftRevision
    && row.published_revision === input.publishedRevision && row.scheduled_at === input.scheduledAt && row.created_by === input.actor;
}
