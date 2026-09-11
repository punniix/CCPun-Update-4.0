import "server-only";

import { createClient, groq } from "next-sanity";
import { z } from "zod";
import type { SanityClient } from "sanity";
import { isAdminReadDataPlaneAllowed, getAdminEnvironment } from "./environment";
import { getAdminSanityReadToken, getAdminSanityWriteToken } from "./sanity-credentials";
import { getAdminRoleForEmail } from "./rbac";
import { articleScheduleBlock } from "../../cms/sanity/policy/article-scheduling";
import { publishApprovedArticle, type PublishableArticle } from "../../cms/sanity/policy/article-publication";
import { executeArticleSchedule, matchesScheduledSnapshot, type ArticlePair } from "./article-schedule-executor";
import { ArticleScheduleError, articleIdSchema, revisionSchema, scheduleRequestSchema, scheduleView } from "./operations/article-schedule-contract";
import { openArticleScheduleStore } from "./operations/article-schedule-store";

function articleClient(write = false) {
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID?.trim();
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET?.trim();
  const token = write ? getAdminSanityWriteToken() : getAdminSanityReadToken();
  if (!projectId || !dataset || !token || !isAdminReadDataPlaneAllowed(dataset)
    || (write && getAdminEnvironment() !== "production-admin")) throw new ArticleScheduleError("not-ready");
  return createClient({ projectId, dataset, token, apiVersion: "2026-09-11", perspective: "raw", useCdn: false,
    stega: false, maxRetries: 0, timeout: 20_000 });
}
const articleIdentitySchema = z.object({ _id: z.string(), _type: z.literal("article"), _rev: revisionSchema }).passthrough();
async function readArticlePair(articleId: string): Promise<ArticlePair> {
  articleIdSchema.parse(articleId);
  const result = await articleClient().fetch(groq`{
    "draft": *[_id == $draftId && _type == "article"][0],
    "published": *[_id == $articleId && _type == "article"][0]
  }`, { articleId, draftId: `drafts.${articleId}` });
  z.object({ draft: articleIdentitySchema.nullable(), published: articleIdentitySchema.nullable() }).parse(result);
  return result as ArticlePair;
}

export async function getArticleScheduleState(articleId: string) {
  articleIdSchema.parse(articleId);
  const store = await openArticleScheduleStore();
  return { ready: store.enabled, mode: store.mode, schedule: scheduleView(await store.read(articleId)) };
}

export async function prepareArticleSchedule(input: z.infer<typeof scheduleRequestSchema> & { articleId: string; scheduledAt: string; actor: string }) {
  articleIdSchema.parse(input.articleId);
  if (getAdminRoleForEmail(input.actor) !== "owner") throw new ArticleScheduleError("not-ready");
  const store = await openArticleScheduleStore();
  if (!store.enabled) throw new ArticleScheduleError("not-ready");
  const current = await store.read(input.articleId);
  const snapshot = { generation: input.requestId, draftRevision: input.draftRevision, publishedRevision: input.publishedRevision, scheduledAt: input.scheduledAt, actor: input.actor };
  if (current?.generation === input.requestId) {
    if (!matchesScheduledSnapshot(current, snapshot)) throw new ArticleScheduleError("conflict");
    // Retrying the same browser request never dispatches a second workflow.
    return { row: current, dispatch: false };
  }
  const { draft, published } = await readArticlePair(input.articleId);
  if (!draft || draft._rev !== input.draftRevision || (published?._rev ?? null) !== input.publishedRevision) throw new ArticleScheduleError("conflict");
  if (articleScheduleBlock(draft, published, input.scheduledAt)) throw new ArticleScheduleError("article-not-ready");
  // Check write readiness before accepting a real Production schedule; UAT needs no write client.
  if (store.mode === "publish") articleClient(true);
  const row = await store.prepare({ articleId: input.articleId, ...snapshot, expectedGeneration: input.expectedGeneration, expectedVersion: input.expectedVersion });
  if (!row) throw new ArticleScheduleError("conflict");
  return { row, dispatch: true };
}

export async function acknowledgeArticleSchedule(articleId: string, generation: string, runId: string) {
  const store = await openArticleScheduleStore();
  const row = await store.acknowledge(articleId, generation, z.string().min(1).max(200).parse(runId));
  if (!row) throw new ArticleScheduleError("conflict");
  return scheduleView(row);
}
export async function markScheduleStartFailed(articleId: string, generation: string) {
  await (await openArticleScheduleStore()).failDispatch(articleId, generation);
}
export async function cancelArticleSchedule(articleId: string, generation: string, version: number, actor: string) {
  articleIdSchema.parse(articleId);
  // Cancellation remains available with feature activation disabled and with no Draft present.
  const store = await openArticleScheduleStore();
  const current = await store.read(articleId);
  if (current?.generation === generation && current.status === "cancelled") return scheduleView(current);
  const row = await store.cancel(articleId, generation, version, actor);
  if (!row) throw new ArticleScheduleError("conflict");
  return scheduleView(row);
}

export async function runScheduledArticlePublication(input: { articleId: string; generation: string }) {
  articleIdSchema.parse(input.articleId);
  z.string().uuid().parse(input.generation);
  const store = await openArticleScheduleStore();
  return executeArticleSchedule({ store, readArticle: readArticlePair, ownerAllowed: (actor) => getAdminRoleForEmail(actor) === "owner",
    async publish(draft: PublishableArticle, published: PublishableArticle | null) {
      // Studio uses client v8 while next-sanity retains v7. Only the shared transaction
      // protocol used by publishApprovedArticle crosses this existing compatibility boundary.
      const receipt = await publishApprovedArticle(articleClient(true) as unknown as SanityClient, draft, published);
      return { transactionId: receipt.transactionId };
    },
  }, input);
}
