import "server-only";

import { randomUUID } from "node:crypto";
import type { SanityClient } from "sanity";
import { createClient, groq } from "next-sanity";
import { getAdminEnvironment, isAdminDataPlaneAllowed } from "./environment";
import { getAdminSanityReadToken, getAdminSanityWriteToken } from "./sanity-credentials";
import {
  articleScheduleBlock,
  articleScheduleDocumentId,
  type ArticleScheduleDocument,
  type ArticleScheduleStatus,
  getScheduleDelaySeconds,
  normalizeArticleId,
} from "../../cms/sanity/policy/article-scheduling";
import { publishApprovedArticle, type PublishableArticle } from "../../cms/sanity/policy/article-publication";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID?.trim();
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET?.trim();
const readToken = getAdminSanityReadToken();
const writeToken = getAdminSanityWriteToken();

const baseClient = projectId && dataset
  ? createClient({ projectId, dataset, apiVersion: "2026-09-11", useCdn: false, stega: false })
  : null;

function requireProductionWriteClient() {
  if (getAdminEnvironment() !== "production-admin") throw new Error("SCHEDULE_PRODUCTION_ADMIN_ONLY");
  if (!baseClient || !readToken || !writeToken || !isAdminDataPlaneAllowed(dataset)) {
    throw new Error("SCHEDULE_SANITY_WRITE_NOT_CONFIGURED");
  }
  return baseClient.withConfig({ token: writeToken, perspective: "raw", useCdn: false });
}

const articlePairQuery = groq`{
  "draft": *[_id == $draftId && _type == "article"][0],
  "published": *[_id == $articleId && _type == "article"][0]
}`;

async function readArticlePair(client: ReturnType<typeof requireProductionWriteClient>, articleId: string) {
  const logicalId = normalizeArticleId(articleId);
  const pair = await client.fetch(articlePairQuery, { articleId: logicalId, draftId: `drafts.${logicalId}` }) as {
    draft: PublishableArticle | null;
    published: PublishableArticle | null;
  };
  return { logicalId, ...pair };
}

export async function getArticleSchedule(articleId: string) {
  if (!baseClient || !readToken || getAdminEnvironment() !== "production-admin") return null;
  const scheduleId = articleScheduleDocumentId(articleId);
  return baseClient.withConfig({ token: readToken, perspective: "raw", useCdn: false }).fetch(
    groq`*[_id == $scheduleId && _type == "publishSchedule"][0]{
      _id, _type, _rev, articleId, draftId, draftRevision, scheduledAt, timezone,
      generation, status, createdByRole, createdAt, updatedAt, completedAt, errorCode
    }`,
    { scheduleId },
  ) as Promise<ArticleScheduleDocument | null>;
}

export async function prepareArticleSchedule(input: {
  articleId: string;
  scheduledAt: string;
  createdByRole: string;
  now?: string;
}) {
  const client = requireProductionWriteClient();
  const now = input.now ?? new Date().toISOString();
  const { logicalId, draft, published } = await readArticlePair(client, input.articleId);
  const blocked = articleScheduleBlock(draft, published, input.scheduledAt, Date.parse(now));
  if (blocked) throw new Error(`SCHEDULE_BLOCKED:${blocked}`);
  if (!draft?._rev) throw new Error("SCHEDULE_DRAFT_REQUIRED");

  const scheduleId = articleScheduleDocumentId(logicalId);
  const generation = randomUUID();
  const delaySeconds = getScheduleDelaySeconds(input.scheduledAt, Date.parse(now));
  if (delaySeconds === null) throw new Error("SCHEDULE_INVALID_TIME");

  const document: ArticleScheduleDocument = {
    _id: scheduleId,
    _type: "publishSchedule",
    articleId: logicalId,
    draftId: draft._id,
    draftRevision: draft._rev,
    scheduledAt: input.scheduledAt,
    timezone: "Asia/Bangkok",
    generation,
    status: "scheduled",
    createdByRole: input.createdByRole,
    createdAt: now,
    updatedAt: now,
  };
  await client.createOrReplace(document);
  return { scheduleId, generation, delaySeconds, scheduledAt: input.scheduledAt };
}

export async function cancelArticleSchedule(articleId: string) {
  const client = requireProductionWriteClient();
  const scheduleId = articleScheduleDocumentId(articleId);
  const current = await getArticleSchedule(articleId);
  if (!current || current.status !== "scheduled") return current;
  const now = new Date().toISOString();
  await client.patch(scheduleId).ifRevisionId(current._rev!).set({
    status: "cancelled" satisfies ArticleScheduleStatus,
    generation: randomUUID(),
    updatedAt: now,
    completedAt: now,
  }).unset(["errorCode"]).commit({ visibility: "sync", tag: "article.schedule.cancel" });
  return getArticleSchedule(articleId);
}

export async function markScheduleStartFailed(scheduleId: string, generation: string) {
  const client = requireProductionWriteClient();
  const current = await client.fetch(
    groq`*[_id == $scheduleId && _type == "publishSchedule"][0]{_id,_rev,generation,status}`,
    { scheduleId },
  ) as { _id: string; _rev: string; generation: string; status: ArticleScheduleStatus } | null;
  if (!current || current.generation !== generation || current.status !== "scheduled") return;
  const now = new Date().toISOString();
  await client.patch(scheduleId).ifRevisionId(current._rev).set({
    status: "failed",
    errorCode: "WORKFLOW_START_FAILED",
    updatedAt: now,
    completedAt: now,
  }).commit({ visibility: "sync", tag: "article.schedule.start-failed" });
}

async function setScheduleOutcome(
  client: ReturnType<typeof requireProductionWriteClient>,
  schedule: ArticleScheduleDocument,
  status: ArticleScheduleStatus,
  errorCode?: string,
) {
  const now = new Date().toISOString();
  const patch = client.patch(schedule._id).ifRevisionId(schedule._rev!).set({ status, updatedAt: now, completedAt: now });
  if (errorCode) patch.set({ errorCode });
  else patch.unset(["errorCode"]);
  await patch.commit({ visibility: "sync", tag: `article.schedule.${status}` });
}

export async function runScheduledArticlePublication(input: { scheduleId: string; generation: string }) {
  const client = requireProductionWriteClient();
  const schedule = await client.fetch(
    groq`*[_id == $scheduleId && _type == "publishSchedule"][0]{
      _id, _type, _rev, articleId, draftId, draftRevision, scheduledAt, timezone,
      generation, status, createdByRole, createdAt, updatedAt, completedAt, errorCode
    }`,
    { scheduleId: input.scheduleId },
  ) as ArticleScheduleDocument | null;

  if (!schedule || schedule.status !== "scheduled" || schedule.generation !== input.generation) {
    return { status: "ignored" as const };
  }
  if (Date.parse(schedule.scheduledAt) > Date.now() + 5_000) return { status: "not-due" as const };

  const { draft, published } = await readArticlePair(client, schedule.articleId);
  if (!draft) {
    if (published) {
      await setScheduleOutcome(client, schedule, "published");
      return { status: "published" as const, recovered: true };
    }
    await setScheduleOutcome(client, schedule, "failed", "DRAFT_MISSING");
    return { status: "failed" as const, errorCode: "DRAFT_MISSING" };
  }
  if (draft._rev !== schedule.draftRevision) {
    await setScheduleOutcome(client, schedule, "stale", "DRAFT_REVISION_CHANGED");
    return { status: "stale" as const };
  }

  const blocked = articleScheduleBlock(draft, published, schedule.scheduledAt, Date.now() - 31_000);
  if (blocked) {
    await setScheduleOutcome(client, schedule, "failed", "PUBLICATION_GUARD_BLOCKED");
    return { status: "failed" as const, errorCode: "PUBLICATION_GUARD_BLOCKED" };
  }

  try {
    await publishApprovedArticle(client as unknown as SanityClient, draft, published);
  } catch (error) {
    const after = await readArticlePair(client, schedule.articleId);
    if (!after.draft && after.published) {
      await setScheduleOutcome(client, schedule, "published");
      return { status: "published" as const, recovered: true };
    }
    await setScheduleOutcome(client, schedule, "failed", "PUBLICATION_TRANSACTION_FAILED");
    throw error;
  }

  const latest = await client.fetch(
    groq`*[_id == $scheduleId && _type == "publishSchedule"][0]{_id,_rev,generation,status}`,
    { scheduleId: schedule._id },
  ) as Pick<ArticleScheduleDocument, "_id" | "_rev" | "generation" | "status"> | null;
  if (latest?.status === "scheduled" && latest.generation === input.generation) {
    await setScheduleOutcome(client, { ...schedule, _rev: latest._rev }, "published");
  }
  return { status: "published" as const };
}
