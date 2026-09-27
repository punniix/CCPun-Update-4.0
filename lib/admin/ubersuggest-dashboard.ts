import "server-only";

import { randomUUID } from "node:crypto";
import { createClient, groq } from "next-sanity";
import { z } from "zod";
import { isAdminDataPlaneAllowed, isAdminReadDataPlaneAllowed } from "./environment";
import { getAdminSanityReadToken, getAdminSanityResearchWriteToken } from "./sanity-credentials";
import { buildAuditLogDocument } from "./sanity-control";
import { insertAdminAudit, isAdminOperationsWriteReady, readAdminResearch } from "./operations/database";
import { privateAdminDocumentId } from "./suggestion-lifecycle";
import { isUbersuggestSnapshotFresh } from "./ubersuggest-contracts";
import type { AisvSnapshotImport } from "./seo-intelligence/aisv";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID?.trim();
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET?.trim();
const readToken = getAdminSanityReadToken();
const writeToken = getAdminSanityResearchWriteToken();

const quotaSchema = z.object({
  key: z.string(),
  label: z.string(),
  limit: z.number().min(0),
  used: z.number().min(0),
  remaining: z.number().min(0),
  status: z.enum(["available", "near-limit", "full"]),
});

const accountSnapshotSchema = z.object({
  id: z.string(),
  tier: z.string().nullish(),
  domain: z.string(),
  projectId: z.string(),
  updateFrequency: z.string().nullish(),
  projectUpdateFrequency: z.string().nullish(),
  brandUpdateFrequency: z.string().nullish(),
  sourceRuntime: z.string().nullish(),
  fetchedAt: z.string().nullish(),
  quotas: z.array(quotaSchema).default([]),
  checkedAt: z.string(),
});

const geoProviderSchema = z.object({
  provider: z.string(),
  averageRank: z.number().nullish(),
  totalMentions: z.number().min(0).nullish(),
  visibilityPercentage: z.number().min(0).max(100).nullish(),
});

const geoCompetitorSchema = z.object({
  brandName: z.string(),
  brandDomain: z.string().nullish(),
  averageRank: z.number().nullish(),
  totalMentions: z.number().min(0).nullish(),
  visibilityPercentage: z.number().min(0).max(100).nullish(),
  sentimentLabel: z.string().nullish(),
});

const geoPromptSchema = z.object({
  promptText: z.string(),
  topic: z.string().nullish(),
  language: z.string().nullish(),
  locId: z.number().int().nullish(),
  intents: z.array(z.string()).default([]),
  totalAnswers: z.number().min(0).nullish(),
  userAverageRank: z.number().nullish(),
  userTotalMentions: z.number().min(0).nullish(),
  userVisibilityPercentage: z.number().min(0).max(100).nullish(),
  topBrands: z.array(z.string()).default([]),
});

const geoSnapshotSchema = z.object({
  id: z.string(),
  domain: z.string(),
  projectId: z.string(),
  windowStart: z.string(),
  windowEnd: z.string(),
  visibilityPercentage: z.number().min(0).max(100).nullish(),
  totalMentions: z.number().min(0).nullish(),
  shareOfVoice: z.number().min(0).nullish(),
  averageRank: z.number().nullish(),
  totalAnswers: z.number().min(0).nullish(),
  totalPrompts: z.number().min(0).nullish(),
  totalCompetitors: z.number().min(0).nullish(),
  providers: z.array(geoProviderSchema).default([]),
  competitors: z.array(geoCompetitorSchema).default([]),
  intents: z.array(z.object({ intent: z.string(), value: z.number().min(0).nullish() })).default([]),
  prompts: z.array(geoPromptSchema).default([]),
  reportStatus: z.enum(["ready", "partial", "pending_update"]).nullish(),
  sourceRuntime: z.string().nullish(),
  promptsUpdatedAt: z.string().nullish(),
  answerCollectedAt: z.string().nullish(),
  fetchedAt: z.string().nullish(),
  limitations: z.array(z.string()).nullish().transform((value) => value ?? []),
  checkedAt: z.string(),
});

const researchHistorySchema = z.object({
  id: z.string(),
  keyword: z.string(),
  scope: z.string().nullish(),
  volume: z.number().nullish(),
  difficulty: z.number().nullish(),
  intent: z.string().nullish(),
  serpCount: z.number().min(0).default(0),
  checkedAt: z.string(),
});

const dashboardSchema = z.object({
  account: accountSnapshotSchema.nullable(),
  geo: geoSnapshotSchema.nullable(),
  history: z.array(researchHistorySchema).default([]),
});

function readClient() {
  if (!projectId || !dataset || !readToken || !isAdminReadDataPlaneAllowed(dataset)) return null;
  return createClient({ projectId, dataset, token: readToken, apiVersion: "2026-08-20", useCdn: false, perspective: "raw" });
}

function writeClient() {
  if (!projectId || !dataset || !writeToken || !isAdminDataPlaneAllowed(dataset)) return null;
  return createClient({ projectId, dataset, token: writeToken, apiVersion: "2026-08-20", useCdn: false, perspective: "raw" });
}

function arrayKey(prefix: string, index: number) {
  return `${prefix}${index.toString(36)}`;
}

export function isUbersuggestSyncWriteReady() {
  return Boolean(writeClient() && isAdminOperationsWriteReady());
}

export function isSnapshotFresh(value: string | null | undefined, maxAgeHours: number, now = Date.now()) {
  return isUbersuggestSnapshotFresh(value, maxAgeHours, now);
}

export async function persistUbersuggestDashboardSync(
  input: AisvSnapshotImport,
  context: { actor: string; actorType: "human"; requestId: string },
) {
  const client = writeClient();
  if (!client) throw new Error("SANITY_WRITE_NOT_CONFIGURED");
  const accountId = privateAdminDocumentId(`ubersuggestAccountSnapshot.${randomUUID()}`);
  const geoId = privateAdminDocumentId(`ubersuggestGeoSnapshot.${randomUUID()}`);
  const auditId = `auditLog.${randomUUID()}`;

  const accountDocument = {
    _id: accountId,
    _type: "ubersuggestAccountSnapshot",
    provider: "ubersuggest",
    tier: input.account.tier,
    domain: input.account.domain,
    projectId: input.account.projectId,
    projectUpdateFrequency: input.account.projectUpdateFrequency,
    brandUpdateFrequency: input.account.brandUpdateFrequency,
    sourceRuntime: input.sourceRuntime,
    fetchedAt: input.fetchedAt,
    quotas: input.account.quotas.map((item, index) => ({ _key: arrayKey("q", index), _type: "providerQuota", ...item })),
    checkedAt: input.fetchedAt,
  };

  const geo = input.geo;
  const geoDocument = {
    _id: geoId,
    _type: "ubersuggestGeoSnapshot",
    provider: "ubersuggest",
    domain: geo?.domain ?? input.account.domain,
    projectId: geo?.projectId ?? input.account.projectId,
    windowStart: input.reportWindow.start,
    windowEnd: input.reportWindow.end,
    visibilityPercentage: geo?.visibilityPercentage ?? null,
    totalMentions: geo?.totalMentions ?? null,
    shareOfVoice: geo?.shareOfVoice ?? null,
    averageRank: geo?.averageRank ?? null,
    totalAnswers: geo?.totalAnswers ?? null,
    totalPrompts: geo?.totalPrompts ?? null,
    totalCompetitors: geo?.totalCompetitors ?? null,
    providers: (geo?.providers ?? []).map((item, index) => ({ _key: arrayKey("p", index), _type: "ubersuggestGeoProvider", ...item })),
    competitors: (geo?.competitors ?? []).map((item, index) => ({ _key: arrayKey("c", index), _type: "ubersuggestGeoCompetitor", ...item })),
    intents: (geo?.intents ?? []).map((item, index) => ({ _key: arrayKey("i", index), _type: "ubersuggestGeoIntent", ...item })),
    prompts: (geo?.prompts ?? []).map((item, index) => ({ _key: arrayKey("g", index), _type: "ubersuggestGeoPrompt", ...item })),
    reportStatus: input.reportStatus,
    sourceRuntime: input.sourceRuntime,
    promptsUpdatedAt: input.providerFreshness.promptsUpdatedAt,
    answerCollectedAt: input.providerFreshness.answerCollectedAt,
    fetchedAt: input.fetchedAt,
    limitations: input.limitations,
    checkedAt: input.fetchedAt,
  };

  const auditDocument = buildAuditLogDocument({
    id: auditId,
    actor: context.actor,
    actorType: context.actorType,
    action: "ubersuggest:sync-account-geo",
    objectType: "providerSnapshot",
    objectId: accountId,
    after: {
      domain: input.account.domain,
      quotaCount: input.account.quotas.length,
      geoPrompts: input.geo?.totalPrompts ?? null,
      geoMentions: input.geo?.totalMentions ?? null,
      reportStatus: input.reportStatus,
      sourceRuntime: input.sourceRuntime,
    },
    requestId: context.requestId,
    timestamp: input.fetchedAt,
  });
  const intentAudit = buildAuditLogDocument({
    id: `auditLog.${randomUUID()}`,
    actor: context.actor,
    actorType: context.actorType,
    action: "ubersuggest:sync-account-geo-intent",
    objectType: "providerSnapshot",
    objectId: accountId,
    after: { status: "started", provider: "ubersuggest", sourceRuntime: input.sourceRuntime },
    requestId: context.requestId,
    timestamp: input.fetchedAt,
  });

  await insertAdminAudit(intentAudit);
  await client.transaction().create(accountDocument).create(geoDocument).commit();
  await insertAdminAudit(auditDocument);
  return { accountId, geoId, checkedAt: input.fetchedAt };
}

export async function getUbersuggestDashboardData(historyLimit = 20) {
  const client = readClient();
  if (!client) return { account: null, geo: null, history: [], error: "not-configured" as const };
  const limit = Math.max(1, Math.min(historyLimit, 100));
  try {
    const raw = await client.fetch(groq`{
      "account": *[_type == "ubersuggestAccountSnapshot"] | order(checkedAt desc)[0]{
        "id": _id,
        tier,
        domain,
        projectId,
        updateFrequency,
        projectUpdateFrequency,
        brandUpdateFrequency,
        sourceRuntime,
        "fetchedAt": coalesce(fetchedAt, checkedAt),
        quotas[]{key, label, limit, used, remaining, status},
        checkedAt
      },
      "geo": *[_type == "ubersuggestGeoSnapshot"] | order(checkedAt desc)[0]{
        "id": _id,
        domain,
        projectId,
        windowStart,
        windowEnd,
        visibilityPercentage,
        totalMentions,
        shareOfVoice,
        averageRank,
        totalAnswers,
        totalPrompts,
        totalCompetitors,
        providers[]{provider, averageRank, totalMentions, visibilityPercentage},
        competitors[]{brandName, brandDomain, averageRank, totalMentions, visibilityPercentage, sentimentLabel},
        intents[]{intent, value},
        prompts[]{promptText, topic, language, locId, intents, totalAnswers, userAverageRank, userTotalMentions, userVisibilityPercentage, topBrands},
        reportStatus,
        sourceRuntime,
        promptsUpdatedAt,
        answerCollectedAt,
        "fetchedAt": coalesce(fetchedAt, checkedAt),
        limitations,
        checkedAt
      }
    }`, { limit });
    const history = (await readAdminResearch(limit) ?? []).filter((row) => row.provider === "ubersuggest").slice(0, limit);
    return { ...dashboardSchema.parse({ ...raw, history }), error: null };
  } catch {
    return { account: null, geo: null, history: [], error: "request-failed" as const };
  }
}
