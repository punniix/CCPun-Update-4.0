import "server-only";

import { createHash } from "node:crypto";
import { createClient, defineQuery } from "next-sanity";
import { z } from "zod";

import { getArticleSemanticTopic } from "../../content/taxonomy";
import { getArticlePath } from "../../content/url";
import { isAdminDataPlaneAllowed, isAdminReadDataPlaneAllowed } from "../environment";
import { getAdminSanityReadToken, getAdminSanityWriteToken } from "../sanity-credentials";
import {
  LINE_CHAT_CONFIG_ID,
  LINE_CHAT_CONFIG_PROJECTION,
  LINE_CHAT_DEFAULTS,
  lineChatConfigFromDocument,
  lineChatConfigFromProjection,
  lineChatConfigSchema,
  lineChatConfigToSanityFields,
  lineChatImmutabilityIssues,
  lineChatMergeForRevert,
  chatContextForArticle,
  logicalArticleId,
  parseLineChatConfig,
  type ChatPageContext,
  type LineChatConfig,
} from "../../line/chat-config";

// Owner-approved 2026-10-25 (LINE chat button system, L1-L9; L4: the owner edits alone).
// Same lane guards, published-only reads and revision checks as lib/admin/line/discovery-config.ts.

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID?.trim();
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET?.trim();
const API_VERSION = "2026-09-19";

const baseClient = projectId && dataset
  ? createClient({ projectId, dataset, apiVersion: API_VERSION, useCdn: false, stega: { enabled: false, studioUrl: "/studio" } })
  : null;

export type LineChatHistoryEntry = { revision: string; timestamp: string; author: string | null };

/** Unpublished owner draft (Sanity `drafts.` document); the website never reads it. */
export type LineChatDraft = { revision: string; config: LineChatConfig; invalid: boolean; updatedAt: string | null; updatedBy: string | null };

/** Published articles the owner can pick for a per-page override (title and category for search). */
export type LineChatArticleOption = { id: string; slug: string; title: string; category: string | null; path: string; context: ChatPageContext };

export type LineChatAdminModel = {
  revision: string | null;
  source: "stored" | "default";
  /** A stored document exists but fails validation, so the site is running on the shipped defaults. */
  storedInvalid: boolean;
  writeReady: boolean;
  config: LineChatConfig;
  updatedAt: string | null;
  updatedBy: string | null;
  history: LineChatHistoryEntry[];
  /** GA4 clicks per topic for the last 30 days; null until that report is wired (stub). */
  topicClicks30d: Record<string, number> | null;
  draft: LineChatDraft | null;
  articles: LineChatArticleOption[];
};

/**
 * Save writes the owner's draft (`drafts.ccpun-line-chat-v1`); publish copies the validated draft to
 * the published singleton (revision-checked) and removes the draft in one transaction. Revert
 * publishes an older revision as a new one. Every path is owner-only and lane-guarded.
 */
export const lineChatMutationSchema = z.union([
  z.object({ action: z.literal("draft"), revision: z.string().min(1).nullable(), draftRevision: z.string().min(1).nullable(), config: z.unknown() }).strict(),
  z.object({ action: z.literal("publish"), revision: z.string().min(1).nullable(), draftRevision: z.string().min(1) }).strict(),
  z.object({ action: z.literal("discard"), draftRevision: z.string().min(1) }).strict(),
  z.object({ revision: z.string().min(1), revertTo: z.string().regex(/^[A-Za-z0-9_-]{6,64}$/) }).strict(),
]);

export const LINE_CHAT_DRAFT_ID = `drafts.${LINE_CHAT_CONFIG_ID}`;

const configQuery = defineQuery(`*[_id == $id][0]{_rev,_updatedAt,updatedAt,updatedBy,"runtime":${LINE_CHAT_CONFIG_PROJECTION}}`);
const articleOptionsQuery = defineQuery(`*[_type == "article" && defined(slug.current)] | order(coalesce(publishedAt, _updatedAt) desc)[0...500]{_id,"slug":slug.current,title,"category":category->title,"categorySlug":category->slug.current,"semanticTopic":seo.semanticTopic}`);

const articleOptionSchema = z.object({
  _id: z.string(),
  slug: z.string(),
  title: z.string(),
  category: z.string().nullable().optional(),
  categorySlug: z.string().nullable().optional(),
  semanticTopic: z.string().nullable().optional(),
});

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

/** Reads the owner draft by its exact `drafts.` id (raw perspective; nothing else is read raw). */
function draftReadClient(write = false) {
  const token = write ? getAdminSanityWriteToken() : getAdminSanityReadToken();
  const allowed = write ? isAdminDataPlaneAllowed : isAdminReadDataPlaneAllowed;
  if (!baseClient || !dataset || !token || !allowed(dataset)) return null;
  return baseClient.withConfig({ token, perspective: "raw", useCdn: false });
}

async function readDraft(): Promise<LineChatDraft | null> {
  const client = draftReadClient();
  if (!client) return null;
  const raw = await client.fetch<{ _rev?: string; _updatedAt?: string; updatedAt?: string; updatedBy?: string; runtime?: unknown } | null>(configQuery, { id: LINE_CHAT_DRAFT_ID });
  if (!raw?._rev) return null;
  const parsed = parseLineChatConfig(lineChatConfigFromProjection(raw.runtime));
  return { revision: raw._rev, config: parsed.config, invalid: parsed.invalid || parsed.source === "default", updatedAt: raw.updatedAt ?? raw._updatedAt ?? null, updatedBy: raw.updatedBy ?? null };
}

async function readArticleOptions(): Promise<LineChatArticleOption[]> {
  const client = readClient();
  if (!client) return [];
  try {
    // The same path, semantic topic and context the website computes, so the Admin preview matches the page.
    return z.array(articleOptionSchema).parse(await client.fetch(articleOptionsQuery)).flatMap((row) => {
      const id = logicalArticleId(row._id);
      if (!id) return [];
      const article = { slug: row.slug, category: row.category ?? "", categorySlug: row.categorySlug ?? undefined };
      const path = getArticlePath(article);
      const topic = getArticleSemanticTopic({ articleSlug: row.slug, semanticTopic: row.semanticTopic, categoryTitle: row.category, categorySlug: row.categorySlug });
      return [{ id, slug: row.slug, title: row.title, category: topic?.title ?? row.category ?? null, path, context: chatContextForArticle(path, { id, title: row.title }, topic?.slug) }];
    });
  } catch {
    return [];
  }
}

/** Short, non-reversible actor reference stored on the document (never the raw email). */
export function lineChatActorDigest(actor: string): string {
  return "admin-" + createHash("sha256").update(actor.trim().toLowerCase()).digest("hex").slice(0, 12);
}

type StoredRead = { revision: string | null; raw: unknown; updatedAt: string | null; updatedBy: string | null };

async function readStored(): Promise<StoredRead | null> {
  const client = readClient();
  if (!client) return null;
  const raw = await client.fetch<{ _rev?: string; _updatedAt?: string; updatedAt?: string; updatedBy?: string; runtime?: unknown } | null>(configQuery, { id: LINE_CHAT_CONFIG_ID });
  if (!raw?._rev) return { revision: null, raw: null, updatedAt: null, updatedBy: null };
  return { revision: raw._rev, raw: raw.runtime ?? null, updatedAt: raw.updatedAt ?? raw._updatedAt ?? null, updatedBy: raw.updatedBy ?? null };
}

/** Sanity document history (transactions API): who changed the singleton and when, newest first. */
async function readHistory(limit = 10): Promise<LineChatHistoryEntry[]> {
  const token = getAdminSanityReadToken();
  if (!projectId || !dataset || !token || !isAdminReadDataPlaneAllowed(dataset)) return [];
  try {
    const url = `https://${projectId}.api.sanity.io/v${API_VERSION}/data/history/${dataset}/transactions/${LINE_CHAT_CONFIG_ID}?excludeContent=true&reverse=true&limit=${limit}`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(5_000) });
    if (!response.ok) return [];
    const rows = (await response.text()).split("\n").filter(Boolean).map((line) => JSON.parse(line) as { id?: unknown; timestamp?: unknown; author?: unknown });
    return rows.flatMap((row) => typeof row.id === "string" && typeof row.timestamp === "string"
      ? [{ revision: row.id, timestamp: row.timestamp, author: null }]
      : []);
  } catch {
    return [];
  }
}

export async function readLineChatAdminModel(): Promise<LineChatAdminModel> {
  const [draft, articles] = await Promise.all([readDraft().catch(() => null), readArticleOptions()]);
  const base = { writeReady: Boolean(writeClient()), topicClicks30d: null, draft, articles };
  try {
    const stored = await readStored();
    if (!stored || !stored.revision) {
      return { ...base, revision: null, source: "default", storedInvalid: false, config: LINE_CHAT_DEFAULTS, updatedAt: null, updatedBy: null, history: [] };
    }
    const parsed = parseLineChatConfig(lineChatConfigFromProjection(stored.raw));
    return {
      ...base,
      revision: stored.revision,
      source: parsed.source,
      storedInvalid: parsed.invalid,
      config: parsed.config,
      updatedAt: stored.updatedAt,
      updatedBy: stored.updatedBy,
      history: await readHistory(),
    };
  } catch {
    return { ...base, revision: null, source: "default", storedInvalid: false, config: LINE_CHAT_DEFAULTS, updatedAt: null, updatedBy: null, history: [] };
  }
}

async function documentAtRevision(revision: string): Promise<unknown> {
  const token = getAdminSanityReadToken();
  if (!projectId || !dataset || !token || !isAdminReadDataPlaneAllowed(dataset)) throw new Error("LINE_CHAT_HISTORY_UNAVAILABLE");
  const url = `https://${projectId}.api.sanity.io/v${API_VERSION}/data/history/${dataset}/documents/${LINE_CHAT_CONFIG_ID}?revision=${encodeURIComponent(revision)}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(5_000) });
  if (!response.ok) throw new Error("LINE_CHAT_HISTORY_UNAVAILABLE");
  const payload = await response.json() as { documents?: Array<Record<string, unknown>> };
  const document = payload.documents?.[0];
  if (!document || document._id !== LINE_CHAT_CONFIG_ID) throw new Error("LINE_CHAT_HISTORY_UNAVAILABLE");
  return { campaigns: [], ...(lineChatConfigFromDocument(document) as Record<string, unknown>) };
}

type PublishedRead = { _rev?: string; runtime?: unknown } | null;

function statusOf(error: unknown): number | null {
  return typeof error === "object" && error && "statusCode" in error ? Number((error as { statusCode?: unknown }).statusCode) : null;
}

/** Immutable ids are checked against what is published (or the shipped defaults on first save). */
function baselineOf(current: PublishedRead): LineChatConfig {
  const previous = current?._rev ? parseLineChatConfig(lineChatConfigFromProjection(current.runtime)) : null;
  return previous && !previous.invalid ? previous.config : LINE_CHAT_DEFAULTS;
}

function validNext(candidate: unknown, baseline: LineChatConfig): LineChatConfig {
  const parsed = lineChatConfigSchema.safeParse(candidate);
  if (!parsed.success) throw new Error("LINE_CHAT_INVALID");
  const next = parsed.data as LineChatConfig;
  if (lineChatImmutabilityIssues(baseline, next).length) throw new Error("LINE_CHAT_IMMUTABLE");
  return next;
}

export type LineChatSaveResult = { kind: "draft" | "published" | "discarded"; revision: string | null; config: LineChatConfig | null };

/**
 * Owner-only save. "draft" writes the owner draft; "publish" moves the validated draft to the
 * published singleton (both revisions checked) and deletes the draft in one transaction; "discard"
 * deletes the draft; revert publishes a Sanity history revision as a new revision. Every value is
 * validated with the same rules the website applies on read; topic ids, their reference numbers and
 * campaign codes can never be renamed or removed, only switched off or paused.
 */
export async function saveLineChatConfig(input: unknown, actor: string): Promise<LineChatSaveResult> {
  const request = lineChatMutationSchema.safeParse(input);
  if (!request.success) throw new Error("LINE_CHAT_INVALID");
  const client = writeClient();
  const draftClient = draftReadClient(true);
  if (!client || !draftClient) throw new Error("LINE_CHAT_WRITE_UNAVAILABLE");
  const data = request.data;

  const current = await client.fetch<PublishedRead>(defineQuery(`*[_id == $id][0]{_rev,"runtime":${LINE_CHAT_CONFIG_PROJECTION}}`), { id: LINE_CHAT_CONFIG_ID });
  const draft = await draftClient.fetch<PublishedRead>(defineQuery(`*[_id == $id][0]{_rev,"runtime":${LINE_CHAT_CONFIG_PROJECTION}}`), { id: LINE_CHAT_DRAFT_ID });
  const stamp = () => ({ updatedAt: new Date().toISOString(), updatedBy: lineChatActorDigest(actor) });

  try {
    if ("action" in data && data.action === "discard") {
      if (!draft?._rev || draft._rev !== data.draftRevision) throw new Error("LINE_CHAT_STALE");
      // The revision-checked patch makes the delete fail (409) when the draft changed meanwhile.
      await draftClient.transaction().patch(LINE_CHAT_DRAFT_ID, (patch) => patch.ifRevisionId(data.draftRevision).set(stamp())).delete(LINE_CHAT_DRAFT_ID).commit();
      return { kind: "discarded", revision: null, config: null };
    }

    if ((current?._rev ?? null) !== data.revision) throw new Error("LINE_CHAT_STALE");
    const baseline = baselineOf(current);

    if ("action" in data && data.action === "draft") {
      if ((draft?._rev ?? null) !== data.draftRevision) throw new Error("LINE_CHAT_STALE");
      const next = validNext(data.config, baseline);
      const fields = { ...lineChatConfigToSanityFields(next), ...stamp() };
      if (!draft?._rev) {
        const created = await draftClient.create({ _id: LINE_CHAT_DRAFT_ID, _type: "lineChatConfig", ...fields });
        return { kind: "draft", revision: created._rev, config: next };
      }
      const updated = await draftClient.patch(LINE_CHAT_DRAFT_ID).ifRevisionId(draft._rev).set(fields).commit();
      return { kind: "draft", revision: updated._rev, config: next };
    }

    let next: LineChatConfig;
    const transaction = client.transaction();
    if ("action" in data && data.action === "publish") {
      if (!draft?._rev || draft._rev !== data.draftRevision) throw new Error("LINE_CHAT_STALE");
      next = validNext(lineChatConfigFromProjection(draft.runtime), baseline);
    } else if ("revertTo" in data) {
      const reverted = lineChatConfigSchema.safeParse(await documentAtRevision(data.revertTo));
      if (!reverted.success) throw new Error("LINE_CHAT_INVALID");
      next = validNext(lineChatMergeForRevert(baseline, reverted.data as LineChatConfig), baseline);
    } else {
      throw new Error("LINE_CHAT_INVALID");
    }

    const fields = { ...lineChatConfigToSanityFields(next), ...stamp() };
    if (!current?._rev) transaction.create({ _id: LINE_CHAT_CONFIG_ID, _type: "lineChatConfig", ...fields });
    else { const publishedRevision = current._rev; transaction.patch(LINE_CHAT_CONFIG_ID, (patch) => patch.ifRevisionId(publishedRevision).set(fields)); }
    if ("action" in data && data.action === "publish") {
      transaction.patch(LINE_CHAT_DRAFT_ID, (patch) => patch.ifRevisionId(data.draftRevision).set(stamp())).delete(LINE_CHAT_DRAFT_ID);
    }
    const result = await transaction.commit();
    return { kind: "published", revision: result.transactionId, config: next };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("LINE_CHAT_")) throw error;
    if (statusOf(error) === 409) throw new Error("LINE_CHAT_STALE");
    throw new Error("LINE_CHAT_SAVE_UNAVAILABLE");
  }
}
