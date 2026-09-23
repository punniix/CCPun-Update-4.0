import "server-only";

import { createClient, defineQuery } from "next-sanity";
import { z } from "zod";

import {
  lineCardTextDescriptionSchema,
  lineCardTitleSchema,
} from "../../local-ai/contracts";
import { isAdminDataPlaneAllowed, isAdminReadDataPlaneAllowed } from "../environment";
import { getAdminSanityReadToken, getAdminSanityWriteToken } from "../sanity-credentials";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID?.trim();
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET?.trim();
const logicalArticleIdSchema = z.string().regex(/^[A-Za-z0-9_-]+(?:\\.[A-Za-z0-9_-]+)*$/).max(200);
const revisionSchema = z.string().min(1).max(200);

const baseClient = projectId && dataset
  ? createClient({ projectId, dataset, apiVersion: "2026-09-21", useCdn: false, stega: { enabled: false, studioUrl: "/studio" } })
  : null;

const missingArticleSchema = z.object({
  id: z.string().min(1),
  revision: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  category: z.string().min(1),
  body: z.string().min(1).max(1_000_000),
  lineTitle: z.string().nullable(),
  lineDescription: z.string().nullable(),
}).strict();

const targetArticleSchema = z.object({
  id: z.string().min(1),
  revision: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  category: z.string().min(1),
  lineTitle: z.string().nullable(),
  lineDescription: z.string().nullable(),
}).strict();

const draftLineCopySchema = targetArticleSchema.extend({
  body: z.string().min(1).max(1_000_000),
}).strict();

const lineCopyRevisionSchema = z.object({
  id: z.string().min(1),
  revision: z.string().min(1),
  lineTitle: z.string().nullable(),
  lineDescription: z.string().nullable(),
}).strict();

const lineCopyPairSchema = z.object({
  draft: lineCopyRevisionSchema.nullable(),
  published: lineCopyRevisionSchema.nullable(),
}).strict();

const improvementTargetSchema = z.object({
  draft: lineCopyRevisionSchema.nullable(),
  published: targetArticleSchema.nullable(),
}).strict();

export type DraftLineCopyTarget = z.infer<typeof draftLineCopySchema>;

const missingArticlesQuery = defineQuery(
  '*[_type == "article" && !(_id in path("drafts.**")) && !(_id in path("versions.**")) && defined(publishedAt) && defined(slug.current) && ($slug == null || slug.current == $slug) && coalesce(seo.noindex, false) != true && !defined(*[_id == "drafts." + ^._id][0]._id) && ((!defined(lineTitle) || lineTitle == "") || (!defined(lineDescription) || lineDescription == ""))] | order(coalesce(publishedAt, _updatedAt) desc) [0...$limit] {"id": _id,"revision": _rev,"slug": slug.current,title,"category": category->title,"body": pt::text(body),"lineTitle": coalesce(lineTitle, null),"lineDescription": coalesce(lineDescription, null)}',
);

const draftExistsQuery = defineQuery(
  'defined(*[_id == "drafts." + $id][0]._id)',
);

const targetArticleQuery = defineQuery(
  '*[_type == "article" && _id == $id][0]{"id": _id,"revision": _rev,"slug": slug.current,title,"category": category->title,"lineTitle": coalesce(lineTitle, null),"lineDescription": coalesce(lineDescription, null)}',
);

const draftLineCopyQuery = defineQuery(
  '*[_type == "article" && _id == "drafts." + $id][0]{"id": _id,"revision": _rev,"slug": slug.current,title,"category": category->title,"body": pt::text(body),"lineTitle": coalesce(lineTitle, null),"lineDescription": coalesce(lineDescription, null)}',
);

const lineCopyPairQuery = defineQuery(
  '{"draft": *[_type == "article" && _id == "drafts." + $id][0]{"id": _id,"revision": _rev,"lineTitle": coalesce(lineTitle, null),"lineDescription": coalesce(lineDescription, null)},"published": *[_type == "article" && _id == $id][0]{"id": _id,"revision": _rev,"lineTitle": coalesce(lineTitle, null),"lineDescription": coalesce(lineDescription, null)}}',
);

const improvementTargetQuery = defineQuery(
  '{"draft": *[_type == "article" && _id == "drafts." + $id][0]{"id": _id,"revision": _rev,"lineTitle": coalesce(lineTitle, null),"lineDescription": coalesce(lineDescription, null)},"published": *[_type == "article" && _id == $id][0]{"id": _id,"revision": _rev,"slug": slug.current,title,"category": category->title,"lineTitle": coalesce(lineTitle, null),"lineDescription": coalesce(lineDescription, null)}}',
);

function readClient(perspective: "published" | "raw" = "published") {
  const token = getAdminSanityReadToken();
  if (!baseClient || !dataset || !token || !isAdminReadDataPlaneAllowed(dataset)) return null;
  return baseClient.withConfig({ token, perspective, useCdn: false });
}

function writeClient() {
  const token = getAdminSanityWriteToken();
  if (!baseClient || !dataset || !token || !isAdminDataPlaneAllowed(dataset)) return null;
  return baseClient.withConfig({ token, perspective: "published", useCdn: false });
}

function parsedLogicalId(id: string) {
  const parsed = logicalArticleIdSchema.safeParse(id);
  if (!parsed.success || parsed.data.startsWith("drafts.") || parsed.data.startsWith("versions.")) return null;
  return parsed.data;
}

function conflictCode(error: unknown) {
  return typeof error === "object" && error && "statusCode" in error
    ? Number((error as { statusCode?: unknown }).statusCode)
    : null;
}

export async function listPublishedArticlesMissingLineDescription(limit = 10, slug?: string) {
  const client = readClient("raw");
  if (!client) throw new Error("LINE_DESCRIPTION_READ_UNAVAILABLE");
  const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), 20);
  const parsedSlug = slug === undefined
    ? null
    : z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(96).parse(slug);
  const rows = z.array(missingArticleSchema).parse(await client.fetch(missingArticlesQuery, {
    limit: boundedLimit,
    slug: parsedSlug,
  }));
  return rows.map((row) => ({ ...row, body: row.body.trim().slice(0, 30_000) })).filter((row) => row.body.length > 0);
}

export async function readArticleDraftLineCopy(id: string) {
  const logicalId = parsedLogicalId(id);
  if (!logicalId) return null;
  const client = readClient("raw");
  if (!client) throw new Error("LINE_DESCRIPTION_READ_UNAVAILABLE");
  const raw = await client.fetch(draftLineCopyQuery, { id: logicalId });
  if (!raw) return null;
  const draft = draftLineCopySchema.parse(raw);
  const body = draft.body.trim().slice(0, 30_000);
  if (!body) return null;
  return { ...draft, body };
}

export async function readArticleLineCopyImprovementTarget(id: string) {
  const logicalId = parsedLogicalId(id);
  if (!logicalId) throw new Error("LINE_COPY_INVALID_REQUEST");
  const client = readClient("raw");
  if (!client) throw new Error("LINE_DESCRIPTION_READ_UNAVAILABLE");
  return improvementTargetSchema.parse(await client.fetch(improvementTargetQuery, { id: logicalId }));
}

export async function applyImprovedLineCopyToDraft(input: {
  id: string;
  draftRevision: string;
  publishedRevision: string;
  lineTitle: string;
  lineDescription: string;
}) {
  const logicalId = parsedLogicalId(input.id);
  const draftRevision = revisionSchema.safeParse(input.draftRevision);
  const publishedRevision = revisionSchema.safeParse(input.publishedRevision);
  if (!logicalId || !draftRevision.success || !publishedRevision.success) throw new Error("LINE_COPY_INVALID_REQUEST");
  const write = writeClient();
  if (!write) throw new Error("LINE_DESCRIPTION_WRITE_UNAVAILABLE");

  const target = await readArticleLineCopyImprovementTarget(logicalId);
  if (!target.draft) throw new Error("LINE_COPY_DRAFT_REQUIRED");
  if (!target.published) throw new Error("LINE_COPY_PUBLISHED_REQUIRED");
  if (target.draft.revision !== draftRevision.data || target.published.revision !== publishedRevision.data) {
    throw new Error("LINE_COPY_CONFLICT");
  }
  if (!target.published.lineTitle?.trim() || !target.published.lineDescription?.trim()) {
    throw new Error("LINE_COPY_PUBLISHED_LINE_REQUIRED");
  }

  const lineTitle = lineCardTitleSchema.parse(input.lineTitle);
  const lineDescription = lineCardTextDescriptionSchema.parse(input.lineDescription);
  if (lineTitle === target.draft.lineTitle?.trim() && lineDescription === target.draft.lineDescription?.trim()) {
    return { status: "already-current" as const, revision: target.draft.revision };
  }

  try {
    const result = await write.patch("drafts." + logicalId)
      .ifRevisionId(target.draft.revision)
      .set({ lineTitle, lineDescription })
      .commit();
    return { status: "applied" as const, revision: result._rev };
  } catch (error) {
    if (conflictCode(error) === 409) throw new Error("LINE_COPY_CONFLICT");
    throw new Error("LINE_DESCRIPTION_WRITE_UNAVAILABLE");
  }
}

export async function applyGeneratedLineCopyToDraft(input: {
  id: string;
  revision: string;
  lineTitle?: string;
  lineDescription?: string;
}) {
  const logicalId = parsedLogicalId(input.id);
  const revision = revisionSchema.safeParse(input.revision);
  if (!logicalId || !revision.success) throw new Error("LINE_COPY_INVALID_REQUEST");
  const read = readClient("raw");
  const write = writeClient();
  if (!read || !write) throw new Error("LINE_DESCRIPTION_WRITE_UNAVAILABLE");

  const raw = await read.fetch(draftLineCopyQuery, { id: logicalId });
  if (!raw) throw new Error("LINE_COPY_DRAFT_REQUIRED");
  const draft = draftLineCopySchema.parse(raw);
  if (draft.revision !== revision.data) throw new Error("LINE_COPY_CONFLICT");

  const existingTitle = draft.lineTitle?.trim() ?? "";
  const existingDescription = draft.lineDescription?.trim() ?? "";
  if (existingTitle && existingDescription) return { status: "skipped-existing" as const, revision: draft.revision };

  const patch: { lineTitle?: string; lineDescription?: string } = {};
  if (!existingTitle) {
    if (input.lineTitle === undefined) throw new Error("LINE_COPY_GENERATION_INCOMPLETE");
    patch.lineTitle = lineCardTitleSchema.parse(input.lineTitle);
  }
  if (!existingDescription) {
    if (input.lineDescription === undefined) throw new Error("LINE_COPY_GENERATION_INCOMPLETE");
    patch.lineDescription = lineCardTextDescriptionSchema.parse(input.lineDescription);
  }

  try {
    const result = await write.patch("drafts." + logicalId).ifRevisionId(draft.revision).set(patch).commit();
    return { status: "applied" as const, revision: result._rev, appliedFields: Object.keys(patch) };
  } catch (error) {
    if (conflictCode(error) === 409) throw new Error("LINE_COPY_CONFLICT");
    throw new Error("LINE_DESCRIPTION_WRITE_UNAVAILABLE");
  }
}

export async function publishDraftLineCopyOnly(input: {
  id: string;
  draftRevision: string;
  publishedRevision: string;
}) {
  const logicalId = parsedLogicalId(input.id);
  const draftRevision = revisionSchema.safeParse(input.draftRevision);
  const publishedRevision = revisionSchema.safeParse(input.publishedRevision);
  if (!logicalId || !draftRevision.success || !publishedRevision.success) throw new Error("LINE_COPY_INVALID_REQUEST");
  const read = readClient("raw");
  const write = writeClient();
  if (!read || !write) throw new Error("LINE_DESCRIPTION_WRITE_UNAVAILABLE");

  const rawPair = await read.fetch(lineCopyPairQuery, { id: logicalId });
  const pair = lineCopyPairSchema.parse(rawPair);
  if (!pair.draft) throw new Error("LINE_COPY_DRAFT_REQUIRED");
  if (!pair.published) throw new Error("LINE_COPY_PUBLISHED_REQUIRED");
  if (pair.draft.revision !== draftRevision.data || pair.published.revision !== publishedRevision.data) {
    throw new Error("LINE_COPY_CONFLICT");
  }

  const draftTitle = pair.draft.lineTitle?.trim() ?? "";
  const draftDescription = pair.draft.lineDescription?.trim() ?? "";
  const publishedTitle = pair.published.lineTitle?.trim() ?? "";
  const publishedDescription = pair.published.lineDescription?.trim() ?? "";

  const patch: { lineTitle?: string; lineDescription?: string } = {};
  if (draftTitle && draftTitle !== publishedTitle) patch.lineTitle = lineCardTitleSchema.parse(draftTitle);
  if (draftDescription && draftDescription !== publishedDescription) patch.lineDescription = lineCardTextDescriptionSchema.parse(draftDescription);
  if (Object.keys(patch).length === 0) return { status: "already-current" as const, appliedFields: [] as string[] };

  try {
    await write
      .transaction()
      .patch(logicalId, (article) => article.ifRevisionId(pair.published!.revision).set(patch))
      .patch("drafts." + logicalId, (article) => article.ifRevisionId(pair.draft!.revision).set(patch))
      .commit();
    return { status: "published-line-only" as const, appliedFields: Object.keys(patch) };
  } catch (error) {
    if (conflictCode(error) === 409) throw new Error("LINE_COPY_CONFLICT");
    throw new Error("LINE_DESCRIPTION_WRITE_UNAVAILABLE");
  }
}

export async function readPublishedArticleLineDescription(id: string) {
  const logicalId = parsedLogicalId(id);
  if (!logicalId) return null;
  const client = readClient("raw");
  if (!client) throw new Error("LINE_DESCRIPTION_READ_UNAVAILABLE");
  const raw = await client.fetch(targetArticleQuery, { id: logicalId });
  if (!raw) return null;
  const article = targetArticleSchema.parse(raw);
  return { ...article, draftActive: await hasPublishedArticleDraft(article.id) };
}

export async function hasPublishedArticleDraft(id: string) {
  const logicalId = parsedLogicalId(id);
  if (!logicalId) return true;
  const client = readClient("raw");
  if (!client) throw new Error("LINE_DESCRIPTION_READ_UNAVAILABLE");
  return z.boolean().parse(await client.fetch(draftExistsQuery, { id: logicalId }));
}
