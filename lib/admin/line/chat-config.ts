import "server-only";

import { createHash } from "node:crypto";
import { createClient, defineQuery } from "next-sanity";
import { z } from "zod";

import { isAdminDataPlaneAllowed, isAdminReadDataPlaneAllowed } from "../environment";
import { getAdminSanityReadToken, getAdminSanityWriteToken } from "../sanity-credentials";
import {
  LINE_CHAT_CONFIG_ID,
  LINE_CHAT_CONFIG_PROJECTION,
  LINE_CHAT_DEFAULTS,
  lineChatConfigFromProjection,
  lineChatConfigSchema,
  lineChatConfigToSanityFields,
  lineChatImmutabilityIssues,
  lineChatMergeForRevert,
  parseLineChatConfig,
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
};

export const lineChatMutationSchema = z.union([
  z.object({ revision: z.string().min(1).nullable(), config: z.unknown() }).strict(),
  z.object({ revision: z.string().min(1), revertTo: z.string().regex(/^[A-Za-z0-9_-]{6,64}$/) }).strict(),
]);

const configQuery = defineQuery(`*[_id == $id][0]{_rev,_updatedAt,updatedAt,updatedBy,"runtime":${LINE_CHAT_CONFIG_PROJECTION}}`);

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
  const base = { writeReady: Boolean(writeClient()), topicClicks30d: null };
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
  return {
    enabled: document.enabled,
    topics: Array.isArray(document.topics) ? document.topics.map((topic: Record<string, unknown>) => ({ id: topic.topicId, ref: topic.ref, label: topic.label, prefill: topic.prefill, journey: topic.journey, enabled: topic.enabled })) : [],
    placements: Array.isArray(document.placements) ? document.placements.map((placement: Record<string, unknown>) => ({ key: placement.pageKey, topicIds: placement.topicIds })) : [],
    campaigns: Array.isArray(document.campaigns) ? document.campaigns.map((campaign: Record<string, unknown>) => ({
      code: campaign.code, refCode: campaign.refCode, title: campaign.title, type: campaign.campaignType, startsAt: campaign.startsAt, endsAt: campaign.endsAt,
      reviewAt: campaign.reviewAt, pageGroups: campaign.pageGroups, pinnedTopicIds: campaign.pinnedTopicIds, headline: campaign.headline, paused: campaign.paused,
    })) : [],
  };
}

/**
 * Owner-only save (and revert to a Sanity history revision, saved as a new revision). Every value is
 * validated with the same rules the website applies on read; topic ids, their reference numbers and
 * campaign codes can never be renamed or removed, only switched off or paused.
 */
export async function saveLineChatConfig(input: unknown, actor: string): Promise<{ revision: string; config: LineChatConfig }> {
  const request = lineChatMutationSchema.safeParse(input);
  if (!request.success) throw new Error("LINE_CHAT_INVALID");
  const client = writeClient();
  if (!client) throw new Error("LINE_CHAT_WRITE_UNAVAILABLE");

  const current = await client.fetch<{ _rev?: string; runtime?: unknown } | null>(defineQuery(`*[_id == $id][0]{_rev,"runtime":${LINE_CHAT_CONFIG_PROJECTION}}`), { id: LINE_CHAT_CONFIG_ID });
  if ((current?._rev ?? null) !== request.data.revision) throw new Error("LINE_CHAT_STALE");

  const previous = current?._rev ? parseLineChatConfig(lineChatConfigFromProjection(current.runtime)) : null;
  // Immutable ids are checked against what is published (or the shipped defaults on first save).
  const baseline = previous && !previous.invalid ? previous.config : LINE_CHAT_DEFAULTS;
  let next: LineChatConfig;
  if ("revertTo" in request.data) {
    const reverted = lineChatConfigSchema.safeParse(await documentAtRevision(request.data.revertTo));
    if (!reverted.success) throw new Error("LINE_CHAT_INVALID");
    next = lineChatMergeForRevert(baseline, reverted.data as LineChatConfig);
  } else {
    const parsed = lineChatConfigSchema.safeParse(request.data.config);
    if (!parsed.success) throw new Error("LINE_CHAT_INVALID");
    next = parsed.data as LineChatConfig;
  }
  if (!lineChatConfigSchema.safeParse(next).success) throw new Error("LINE_CHAT_INVALID");
  if (lineChatImmutabilityIssues(baseline, next).length) throw new Error("LINE_CHAT_IMMUTABLE");

  const fields = { ...lineChatConfigToSanityFields(next), updatedAt: new Date().toISOString(), updatedBy: lineChatActorDigest(actor) };
  try {
    if (!current?._rev) {
      const created = await client.create({ _id: LINE_CHAT_CONFIG_ID, _type: "lineChatConfig", ...fields });
      return { revision: created._rev, config: next };
    }
    const updated = await client.patch(LINE_CHAT_CONFIG_ID).ifRevisionId(current._rev).set(fields).commit();
    return { revision: updated._rev, config: next };
  } catch (error) {
    const statusCode = typeof error === "object" && error && "statusCode" in error ? Number((error as { statusCode?: unknown }).statusCode) : null;
    if (statusCode === 409) throw new Error("LINE_CHAT_STALE");
    throw new Error("LINE_CHAT_SAVE_UNAVAILABLE");
  }
}
