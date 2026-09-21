import "server-only";

import { createClient, defineQuery } from "next-sanity";
import { z } from "zod";

import { lineCardDescriptionOutputSchema } from "../../local-ai/contracts";
import { isAdminDataPlaneAllowed, isAdminReadDataPlaneAllowed } from "../environment";
import { getAdminSanityReadToken, getAdminSanityWriteToken } from "../sanity-credentials";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID?.trim();
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET?.trim();

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

export type LineDescriptionTarget = z.infer<typeof targetArticleSchema>;
export type ApprovedLineDescription = z.infer<typeof lineCardDescriptionOutputSchema>;

const missingArticlesQuery = defineQuery(
  '*[_type == "article" && defined(publishedAt) && defined(slug.current) && coalesce(seo.noindex, false) != true && ((!defined(lineTitle) || lineTitle == "") || (!defined(lineDescription) || lineDescription == ""))] | order(coalesce(publishedAt, _updatedAt) desc) [0...$limit] {"id": _id,"revision": _rev,"slug": slug.current,title,"category": category->title,"body": pt::text(body)}',
);

const targetArticleQuery = defineQuery(
  '*[_type == "article" && _id == $id][0]{"id": _id,"revision": _rev,"slug": slug.current,title,"category": category->title,"lineTitle": coalesce(lineTitle, null),"lineDescription": coalesce(lineDescription, null)}',
);

function readClient() {
  const token = getAdminSanityReadToken();
  if (!baseClient || !dataset || !token || !isAdminReadDataPlaneAllowed(dataset)) return null;
  return baseClient.withConfig({ token, perspective: "published", useCdn: false });
}

function writeClient() {
  const token = getAdminSanityWriteToken();
  if (!baseClient || !dataset || !token || !isAdminDataPlaneAllowed(dataset)) return null;
  return baseClient.withConfig({ token, perspective: "published", useCdn: false });
}

export async function listPublishedArticlesMissingLineDescription(limit = 10) {
  const client = readClient();
  if (!client) throw new Error("LINE_DESCRIPTION_READ_UNAVAILABLE");
  const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), 20);
  const rows = z.array(missingArticleSchema).parse(await client.fetch(missingArticlesQuery, { limit: boundedLimit }));
  return rows.map((row) => ({ ...row, body: row.body.trim().slice(0, 30_000) })).filter((row) => row.body.length > 0);
}

export function decideLineDescriptionApply(target: LineDescriptionTarget, approved: ApprovedLineDescription) {
  const existingTitle = target.lineTitle?.trim() ?? "";
  const existingDescription = target.lineDescription?.trim() ?? "";
  if (existingTitle === approved.lineTitle && existingDescription === approved.lineDescription) return "already-applied" as const;
  if (existingTitle && existingDescription) return "skipped-existing" as const;
  if (
    target.id !== approved.source.id ||
    target.slug !== approved.source.slug ||
    target.title !== approved.source.title ||
    target.category !== approved.source.category ||
    target.revision !== approved.source.revision
  ) return "source-conflict" as const;
  return "apply" as const;
}

export async function applyApprovedLineDescription(value: unknown) {
  const approved = lineCardDescriptionOutputSchema.parse(value);
  if (approved.source.id.startsWith("drafts.")) throw new Error("LINE_DESCRIPTION_SOURCE_CONFLICT");
  const client = writeClient();
  if (!client) throw new Error("LINE_DESCRIPTION_WRITE_UNAVAILABLE");

  const raw = await client.fetch(targetArticleQuery, { id: approved.source.id });
  if (!raw) throw new Error("LINE_DESCRIPTION_SOURCE_CONFLICT");
  const target = targetArticleSchema.parse(raw);
  const decision = decideLineDescriptionApply(target, approved);
  if (decision === "source-conflict") throw new Error("LINE_DESCRIPTION_SOURCE_CONFLICT");
  if (decision !== "apply") return { status: decision };

  try {
    const patch: { lineTitle?: string; lineDescription?: string } = {};
    if (!target.lineTitle?.trim()) patch.lineTitle = approved.lineTitle;
    if (!target.lineDescription?.trim()) patch.lineDescription = approved.lineDescription;
    if (Object.keys(patch).length === 0) return { status: "skipped-existing" as const };
    await client.patch(target.id).ifRevisionId(target.revision).set(patch).commit();
    return { status: "applied" as const };
  } catch (error) {
    const statusCode = typeof error === "object" && error && "statusCode" in error
      ? Number((error as { statusCode?: unknown }).statusCode)
      : null;
    if (statusCode === 409) throw new Error("LINE_DESCRIPTION_SOURCE_CONFLICT");
    throw new Error("LINE_DESCRIPTION_WRITE_UNAVAILABLE");
  }
}
