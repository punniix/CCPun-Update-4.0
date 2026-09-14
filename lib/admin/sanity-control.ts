import "server-only";

import { randomUUID } from "node:crypto";
import { createClient, groq } from "next-sanity";
import { z } from "zod";
import { getAdminEnvironment, isAdminDataPlaneAllowed, isAdminReadDataPlaneAllowed } from "./environment";
import { getAdminSanityReadToken, getAdminSanityWriteToken } from "./sanity-credentials";
import { appliedSuggestionReplay, patchArticleSeoField } from "./sanity-review-mutations";
import {
  approveAdminSeoSuggestion,
  buildAdminAudit,
  claimAdminSuggestionApply,
  createAdminSeoSuggestion,
  decideAdminSeoSuggestion,
  finalizeAdminSuggestionApply,
  isAdminOperationsWriteReady,
  mapSuggestionRow,
  readSeoSuggestion,
  readSeoSuggestions,
  requireApplyReconciliation,
} from "./operations/database";
import {
  approvedBaseIsCurrent,
  canApplySuggestion,
  canApproveSuggestion,
  canEditSuggestion,
  canRejectSuggestion,
  deterministicAuditSuggestionId,
  frozenControlsForApply,
  getApplyableFieldPath,
  isHumanReviewActor,
  isCompatibleReviewSuggestion,
  privateAdminDocumentId,
  storedFieldValue,
} from "./suggestion-lifecycle";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID?.trim();
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET?.trim();
const readToken = getAdminSanityReadToken();
const writeToken = getAdminSanityWriteToken();

const baseClient =
  projectId && dataset && isAdminReadDataPlaneAllowed(dataset)
    ? createClient({
        projectId,
        dataset,
        apiVersion: "2026-08-20",
        useCdn: false,
        stega: { enabled: false, studioUrl: "/studio" },
      })
    : null;

const articleRowSchema = z.object({
  id: z.string(),
  rawId: z.string(),
  title: z.string().nullish(),
  slug: z.string().nullish(),
  category: z.string().nullish(),
  categorySlug: z.string().nullish(),
  tags: z.array(z.string()).nullish(),
  reviewStatus: z.string().nullish(),
  primaryKeyword: z.string().nullish(),
  secondaryKeywords: z.array(z.string()).nullish(),
  searchIntent: z.string().nullish(),
  seoScore: z.number().nullish(),
  seoAuditedAt: z.string().nullish(),
  seoAuditVersion: z.number().nullish(),
  publishedAt: z.string().nullish(),
  updatedAt: z.string(),
  isDraft: z.boolean(),
  hasPublished: z.boolean().default(false),
});

const suggestionRowSchema = z.object({
  id: z.string(),
  articleId: z.string().nullish(),
  articleTitle: z.string().nullish(),
  type: z.string().nullish(),
  before: z.string().nullish(),
  after: z.string().nullish(),
  reason: z.string().nullish(),
  confidence: z.number().nullish(),
  riskLevel: z.string().nullish(),
  approvedAfter: z.string().nullish(),
  approvedType: z.string().nullish(),
  approvedRiskLevel: z.string().nullish(),
  status: z.string().nullish(),
  createdBy: z.string().nullish(),
  reviewedBy: z.string().nullish(),
  createdAt: z.string().nullish(),
  reviewedAt: z.string().nullish(),
  targetRevision: z.string().nullish(),
  approvedTargetRevision: z.string().nullish(),
  approvedTargetId: z.string().nullish(),
  targetCurrentRevision: z.string().nullish(),
});

export type AdminArticleRow = z.infer<typeof articleRowSchema>;
export type AdminSuggestionRow = z.infer<typeof suggestionRowSchema>;

export type AdminSanityStatus = {
  configured: boolean;
  readReady: boolean;
  writeReady: boolean;
  projectId: string | null;
  dataset: string | null;
  environment: string;
};

export type AdminContentResult = {
  status: AdminSanityStatus;
  rows: AdminArticleRow[];
  error: "not-configured" | "read-token-required" | "request-failed" | null;
};

export type AdminReviewResult = {
  status: AdminSanityStatus;
  rows: AdminSuggestionRow[];
  error: "not-configured" | "read-token-required" | "request-failed" | null;
};

const publishedSeoObservationArticleSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  category: z.string().min(1),
  categorySlug: z.string().min(1),
  focusKeyword: z.string().nullish(),
  secondaryKeywords: z.array(z.string()).nullish(),
  searchIntent: z.string().nullish(),
  noindex: z.boolean().nullish(),
  publishedAt: z.string().nullish(),
  updatedAt: z.string().datetime(),
});

export type PublishedSeoObservationArticle = z.infer<typeof publishedSeoObservationArticleSchema>;

export function getAdminSanityStatus(): AdminSanityStatus {
  return {
    configured: Boolean(baseClient),
    readReady: Boolean(baseClient && readToken),
    writeReady: Boolean(baseClient && writeToken && isAdminDataPlaneAllowed(dataset) && isAdminOperationsWriteReady()),
    projectId: projectId ?? null,
    dataset: dataset ?? null,
    environment: getAdminEnvironment(),
  };
}

function requireReadClient(perspective: "drafts" | "published" = "drafts") {
  if (!baseClient || !readToken) return null;
  return baseClient.withConfig({
    token: readToken,
    perspective,
    useCdn: false,
  });
}

function requireWriteClient() {
  if (!baseClient || !writeToken || !isAdminDataPlaneAllowed(dataset)) return null;
  return baseClient.withConfig({
    token: writeToken,
    perspective: "drafts",
    useCdn: false,
  });
}

const articleIndexQuery = groq`*[_type == "article"] | order(_updatedAt desc) {
  "id": coalesce(_originalId, _id),
  "rawId": _id,
  title,
  "slug": slug.current,
  "category": category->title,
  "categorySlug": category->slug.current,
  tags,
  "reviewStatus": review.status,
  "primaryKeyword": seo.focusKeyword,
  "secondaryKeywords": seo.secondaryKeywords,
  "searchIntent": seo.searchIntent,
  "seoScore": seo.auditSnapshot.score,
  "seoAuditedAt": seo.auditSnapshot.auditedAt,
  "seoAuditVersion": seo.auditSnapshot.version,
  publishedAt,
  "updatedAt": _updatedAt,
  "isDraft": defined(_originalId) && _originalId match "drafts.*"
}`;

const publishedArticleIdsQuery = groq`*[_type == "article"]._id`;

const publishedSeoObservationArticlesQuery = groq`*[_type == "article" && defined(slug.current)] {
  "id": _id,
  "slug": slug.current,
  "category": category->title,
  "categorySlug": category->slug.current,
  "focusKeyword": seo.focusKeyword,
  "secondaryKeywords": seo.secondaryKeywords,
  "searchIntent": seo.searchIntent,
  "noindex": seo.noindex,
  publishedAt,
  "updatedAt": _updatedAt
}`;

export async function listAdminArticles(): Promise<AdminContentResult> {
  const status = getAdminSanityStatus();
  if (!status.configured) return { status, rows: [], error: "not-configured" };

  const client = requireReadClient();
  if (!client) return { status, rows: [], error: "read-token-required" };

  try {
    const [rows, publishedIds] = await Promise.all([
      client.fetch(articleIndexQuery),
      requireReadClient("published")!.fetch(publishedArticleIdsQuery),
    ]);
    const publishedIdSet = new Set(z.array(z.string()).parse(publishedIds));
    const parsedRows = z.array(articleRowSchema).parse(rows);
    return {
      status,
      rows: parsedRows.map((row) => ({
        ...row,
        isDraft: row.isDraft || row.id.startsWith("drafts."),
        hasPublished: publishedIdSet.has(row.id.replace(/^drafts\./, "")),
      })),
      error: null,
    };
  } catch {
    return { status, rows: [], error: "request-failed" };
  }
}

export async function listPublishedSeoObservationArticles(): Promise<{
  rows: PublishedSeoObservationArticle[];
  error: "not-configured" | "read-token-required" | "request-failed" | null;
}> {
  if (!baseClient) return { rows: [], error: "not-configured" };
  const client = requireReadClient("published");
  if (!client) return { rows: [], error: "read-token-required" };
  try {
    return {
      rows: z.array(publishedSeoObservationArticleSchema).parse(await client.fetch(publishedSeoObservationArticlesQuery)),
      error: null,
    };
  } catch {
    return { rows: [], error: "request-failed" };
  }
}

export async function listSeoSuggestions(): Promise<AdminReviewResult> {
  const status = getAdminSanityStatus();
  if (!status.configured) return { status, rows: [], error: "not-configured" };

  const client = requireReadClient();
  if (!client) return { status, rows: [], error: "read-token-required" };

  try {
    const stored = await readSeoSuggestions();
    if (!stored) return { status, rows: [], error: "not-configured" };
    const ids = [...new Set(stored.map((row) => row.target_document_id.replace(/^drafts\./, "")))];
    const targets = await client.withConfig({ perspective: "raw" }).fetch(
      groq`*[_type == "article" && (_id in $ids || _id in $draftIds)]{
        "id": coalesce(_originalId, _id), "title": title, "revision": _rev, "isDraft": _id match "drafts.*"
      }`,
      { ids, draftIds: ids.map((id) => `drafts.${id}`) },
    ) as Array<{ id: string; title?: string; revision: string; isDraft: boolean }>;
    const targetById = new Map(targets.sort((a, b) => Number(b.isDraft) - Number(a.isDraft)).map((target) => [target.id, target]));
    const rows = stored.map((row) => {
      const mapped = mapSuggestionRow(row);
      const target = targetById.get(mapped.articleId ?? "");
      return { ...mapped, articleTitle: target?.title ?? null, targetCurrentRevision: target?.revision ?? null };
    });
    return {
      status,
      rows: z.array(suggestionRowSchema).parse(rows)
        .filter((row) => row.status === "reconciliation-required" || isCompatibleReviewSuggestion(row)),
      error: null,
    };
  } catch {
    return { status, rows: [], error: "request-failed" };
  }
}

const suggestionTypeSchema = z.enum([
  "seo-title",
  "meta-description",
  "primary-keyword",
  "secondary-keywords",
  "search-intent",
  "structure",
  "internal-links",
  "content",
]);

const riskLevelSchema = z.enum(["low", "medium", "high", "critical"]);
const evidenceSourceSchema = z.enum(["first-party", "provider", "serp", "competitor", "audit", "manual"]);
const evidenceUrlSchema = z.string().url().refine((value) => ["http:", "https:"].includes(new URL(value).protocol));
const suggestionEvidenceSchema = z.object({
  label: z.string().trim().min(1).max(200),
  sourceType: evidenceSourceSchema,
  url: evidenceUrlSchema.optional(),
  detail: z.string().trim().max(2000).optional(),
  capturedAt: z.string().datetime().optional(),
});
const documentIdSchema = z.string().min(1).max(200).regex(/^[A-Za-z0-9_.-]+$/);
const suggestionDocumentIdSchema = documentIdSchema.regex(
  /^(?:drafts\.)?seoSuggestion\.(?:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|audit\.[0-9a-f]{32})$/i,
);

const newSuggestionSchema = z.object({
  targetDocumentId: documentIdSchema,
  type: suggestionTypeSchema,
  before: z.string().max(12000).optional(),
  after: z.string().min(1).max(12000),
  reason: z.string().min(1).max(8000),
  confidence: z.number().min(0).max(1),
  riskLevel: riskLevelSchema,
  evidence: z.array(suggestionEvidenceSchema).max(8).optional(),
  createdBy: z.string().min(1).max(320),
});

export type NewSeoSuggestion = z.infer<typeof newSuggestionSchema>;

const mutationContextSchema = z.object({
  actorType: z.enum(["human", "ai", "system"]),
  requestId: z.string().uuid(),
});

type MutationContext = z.infer<typeof mutationContextSchema>;

const targetDraftSchema = z.object({
  _id: z.string(),
  _rev: z.string(),
  _type: z.literal("article"),
  seo: z.object({
    title: z.string().nullish(),
    description: z.string().nullish(),
    focusKeyword: z.string().nullish(),
    searchIntent: z.string().nullish(),
  }).nullish(),
});

function valueAtSeoPath(article: z.infer<typeof targetDraftSchema>, fieldPath: string) {
  if (fieldPath === "seo.title") return article.seo?.title;
  if (fieldPath === "seo.description") return article.seo?.description;
  if (fieldPath === "seo.focusKeyword") return article.seo?.focusKeyword;
  return article.seo?.searchIntent;
}

function parseSuggestionDocumentId(value: string) {
  const parsed = suggestionDocumentIdSchema.safeParse(value);
  if (!parsed.success) throw new Error("INVALID_SUGGESTION_ID");
  return parsed.data;
}

export function buildAuditLogDocument(input: {
  id: string;
  actor: string;
  actorType: "human" | "ai" | "system";
  action: string;
  objectType: string;
  objectId: string;
  before?: unknown;
  after?: unknown;
  requestId: string;
  timestamp: string;
}) {
  return buildAdminAudit({ ...input, id: privateAdminDocumentId(input.id) });
}

export function isRevisionConflict(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { statusCode?: unknown; response?: { statusCode?: unknown } };
  return candidate.statusCode === 409 || candidate.response?.statusCode === 409;
}

export async function createSeoSuggestion(
  input: NewSeoSuggestion,
  context: MutationContext & { idempotentForAuditRevision?: boolean; expectedTargetRevision?: string },
) {
  const client = requireWriteClient();
  if (!client) throw new Error("SANITY_WRITE_NOT_CONFIGURED");

  const parsed = newSuggestionSchema.parse(input);
  const auditContext = mutationContextSchema.parse(context);
  const now = new Date().toISOString();
  const cleanId = parsed.targetDocumentId.replace(/^drafts\./, "");
  const draftId = `drafts.${cleanId}`;
  const rawClient = client.withConfig({ perspective: "raw" });
  const targetRaw = await rawClient.fetch(
    groq`*[_id == $draftId && _type == "article"][0]{ _id, _rev, _type, seo { title, description, focusKeyword, searchIntent } }`,
    { draftId },
  );
  if (!targetRaw) throw new Error("TARGET_DRAFT_NOT_FOUND");
  const target = targetDraftSchema.parse(targetRaw);
  if (context.idempotentForAuditRevision && target._rev !== context.expectedTargetRevision) {
    throw new Error("PROPOSAL_SOURCE_STALE");
  }
  const fieldPath = getApplyableFieldPath(parsed.type);
  const before = fieldPath ? storedFieldValue(valueAtSeoPath(target, fieldPath)) : (parsed.before ?? null);
  const baseSuggestionId = context.idempotentForAuditRevision
    ? deterministicAuditSuggestionId({ draftId, revision: target._rev, type: parsed.type })
    : `seoSuggestion.${randomUUID()}`;
  const suggestionId = privateAdminDocumentId(baseSuggestionId);
  const auditDocument = buildAuditLogDocument({
    id: context.idempotentForAuditRevision
      ? `auditLog.${baseSuggestionId.slice("seoSuggestion.".length)}`
      : `auditLog.${randomUUID()}`,
    actor: parsed.createdBy,
    actorType: auditContext.actorType,
    action: context.idempotentForAuditRevision ? "seo-suggestion:generate-from-audit" : "seo-suggestion:create",
    objectType: "seoSuggestion",
    objectId: suggestionId,
    after: { targetDocumentId: draftId, type: parsed.type, riskLevel: parsed.riskLevel, status: "needs-human-review" },
    requestId: auditContext.requestId,
    timestamp: now,
  });

  const saved = await createAdminSeoSuggestion({
    id: suggestionId, targetDocumentId: cleanId, targetRevision: target._rev, type: parsed.type, before,
    after: parsed.after, reason: parsed.reason, confidence: parsed.confidence, riskLevel: parsed.riskLevel,
    evidence: parsed.evidence, status: "needs-human-review", createdBy: parsed.createdBy, createdAt: now,
  }, auditDocument, Boolean(context.idempotentForAuditRevision));
  return { _id: saved.id, status: saved.status };
}

const reviewableSuggestionSchema = z.object({
  _id: z.string(),
  _rev: z.string(),
  status: z.string(),
  type: suggestionTypeSchema,
  before: z.string().nullish(),
  after: z.string(),
  riskLevel: riskLevelSchema.nullish(),
  targetRevision: z.string().nullish(),
  targetId: documentIdSchema,
});

export async function approveSeoSuggestion(input: {
  id: string;
  reviewedBy: string;
  actorType: "human" | "ai" | "system";
  requestId: string;
}) {
  const parsedId = parseSuggestionDocumentId(input.id);
  const client = requireWriteClient();
  if (!client) throw new Error("SANITY_WRITE_NOT_CONFIGURED");

  const id = parsedId;
  const reviewedBy = z.string().min(1).max(320).parse(input.reviewedBy);
  const context = mutationContextSchema.parse(input);
  if (!isHumanReviewActor(context.actorType)) throw new Error("HUMAN_REVIEW_REQUIRED");
  const rawClient = client.withConfig({ perspective: "raw" });
  const stored = await readSeoSuggestion(id);
  if (!stored) throw new Error("SUGGESTION_NOT_FOUND");
  const suggestion = reviewableSuggestionSchema.parse({
    _id: stored.id, _rev: String(stored.row_version), status: stored.status, type: stored.suggestion_type,
    before: stored.before_value, after: stored.after_value, riskLevel: stored.risk_level,
    targetRevision: stored.target_revision, targetId: stored.target_document_id,
  });
  if (!canApproveSuggestion(suggestion.status)) throw new Error("SUGGESTION_STATUS_CONFLICT");
  if (!suggestion.targetRevision || !suggestion.riskLevel) throw new Error("SUGGESTION_APPROVAL_INCOMPLETE");

  const draftId = suggestion.targetId.startsWith("drafts.") ? suggestion.targetId : `drafts.${suggestion.targetId}`;
  const targetRaw = await rawClient.fetch(
    groq`*[_id == $draftId && _type == "article"][0]{ _id, _rev, _type, seo { title, description, focusKeyword, searchIntent } }`,
    { draftId },
  );
  if (!targetRaw) throw new Error("TARGET_DRAFT_NOT_FOUND");
  const target = targetDraftSchema.parse(targetRaw);
  const fieldPath = getApplyableFieldPath(suggestion.type);
  const currentValue = fieldPath ? valueAtSeoPath(target, fieldPath) : suggestion.before;
  if (!approvedBaseIsCurrent({
    currentRevision: target._rev,
    approvedRevision: suggestion.targetRevision,
    currentValue,
    approvedBaseValue: storedFieldValue(suggestion.before),
  })) {
    throw new Error("SUGGESTION_STALE_BASE");
  }

  const reviewedAt = new Date().toISOString();
  const auditDocument = buildAuditLogDocument({
    id: `auditLog.${randomUUID()}`,
    actor: reviewedBy,
    actorType: context.actorType,
    action: "seo-suggestion:approve",
    objectType: "seoSuggestion",
    objectId: id,
    before: { status: suggestion.status },
    after: {
      status: "approved",
      approvedType: suggestion.type,
      approvedRiskLevel: suggestion.riskLevel,
      approvedTargetId: suggestion.targetId,
      approvedTargetRevision: target._rev,
    },
    requestId: context.requestId,
    timestamp: reviewedAt,
  });

  await approveAdminSeoSuggestion({
    id, rowVersion: stored.row_version, reviewedBy, reviewedAt,
    approvedBaseValue: storedFieldValue(currentValue), approvedTargetRevision: target._rev,
    requestId: context.requestId, auditId: auditDocument.id,
  });

  return { id, status: "approved", reviewedAt };
}

const reviewDecisionSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("edit"), after: z.string().min(1).max(12000), reason: z.string().min(1).max(8000) }),
  z.object({ decision: z.literal("reject"), reason: z.string().min(1).max(2000) }),
]);

const pendingSuggestionSchema = z.object({
  _id: z.string(),
  _rev: z.string(),
  status: z.string(),
});

export async function reviewSeoSuggestion(input: {
  id: string;
  decision: "edit" | "reject";
  after?: string;
  reason: string;
  reviewedBy: string;
  actorType: "human" | "ai" | "system";
  requestId: string;
}) {
  const id = parseSuggestionDocumentId(input.id);
  const decision = reviewDecisionSchema.parse(input);
  const reviewer = z.string().min(1).max(320).parse(input.reviewedBy);
  const context = mutationContextSchema.parse(input);
  if (!isHumanReviewActor(context.actorType)) throw new Error("HUMAN_REVIEW_REQUIRED");

  const stored = await readSeoSuggestion(id);
  if (!stored) throw new Error("SUGGESTION_NOT_FOUND");
  const suggestion = pendingSuggestionSchema.parse({ _id: stored.id, _rev: String(stored.row_version), status: stored.status });
  if (decision.decision === "edit" ? !canEditSuggestion(suggestion.status) : !canRejectSuggestion(suggestion.status)) {
    throw new Error("SUGGESTION_STATUS_CONFLICT");
  }

  const decidedAt = new Date().toISOString();
  const nextStatus = decision.decision === "reject" ? "rejected" : "needs-human-review";
  const auditDocument = buildAuditLogDocument({
    id: `auditLog.${randomUUID()}`,
    actor: reviewer,
    actorType: context.actorType,
    action: decision.decision === "edit" ? "seo-suggestion:edit" : "seo-suggestion:reject",
    objectType: "seoSuggestion",
    objectId: id,
    before: { status: suggestion.status },
    after: { status: nextStatus, valuePresent: decision.decision === "edit", reasonPresent: true },
    requestId: context.requestId,
    timestamp: decidedAt,
  });

  await decideAdminSeoSuggestion({
    id, rowVersion: stored.row_version, decision: decision.decision,
    after: decision.decision === "edit" ? decision.after : undefined, reason: decision.reason,
    reviewer, decidedAt, requestId: context.requestId, auditId: auditDocument.id,
  });

  return decision.decision === "edit"
    ? { id, status: nextStatus, editedAt: decidedAt }
    : { id, status: nextStatus, reviewedAt: decidedAt };
}

const applyableSuggestionSchema = z.object({
  id: z.string(),
  revision: z.string(),
  status: z.string(),
  approvedAfter: z.string().nullish(),
  approvedBaseValue: z.string().nullish(),
  approvedType: suggestionTypeSchema.nullish(),
  approvedRiskLevel: riskLevelSchema.nullish(),
  approvedTargetId: documentIdSchema.nullish(),
  approvedTargetRevision: z.string().nullish(),
  appliedAt: z.string().nullish(),
});

export async function applyApprovedSeoSuggestion(input: {
  id: string;
  appliedBy: string;
  actorType: "human" | "ai" | "system";
  requestId: string;
}) {
  const parsedId = parseSuggestionDocumentId(input.id);
  const client = requireWriteClient();
  if (!client) throw new Error("SANITY_WRITE_NOT_CONFIGURED");

  const id = parsedId;
  const appliedBy = z.string().min(1).max(320).parse(input.appliedBy);
  const context = mutationContextSchema.parse(input);
  if (!isHumanReviewActor(context.actorType)) throw new Error("HUMAN_REVIEW_REQUIRED");

  const rawClient = client.withConfig({ perspective: "raw" });

  const stored = await readSeoSuggestion(id);
  if (!stored) throw new Error("SUGGESTION_NOT_FOUND");
  const suggestion = applyableSuggestionSchema.parse({
    id: stored.id, revision: String(stored.row_version), status: stored.status,
    approvedAfter: stored.approved_after, approvedBaseValue: stored.approved_base_value,
    approvedType: stored.approved_type, approvedRiskLevel: stored.approved_risk_level,
    approvedTargetId: stored.approved_target_id, approvedTargetRevision: stored.approved_target_revision,
    appliedAt: stored.applied_at instanceof Date ? stored.applied_at.toISOString() : stored.applied_at,
  });

  const replay = appliedSuggestionReplay({ suggestionId: id, ...suggestion });
  if (replay) return replay;
  const controls = frozenControlsForApply(suggestion);
  if (!canApplySuggestion(suggestion.status)) throw new Error("SUGGESTION_STATUS_CONFLICT");
  if (!controls || !suggestion.approvedAfter || !suggestion.approvedTargetRevision) {
    throw new Error("SUGGESTION_APPROVAL_INCOMPLETE");
  }
  if (controls.riskLevel === "high" || controls.riskLevel === "critical") {
    throw new Error("SUGGESTION_RISK_TOO_HIGH");
  }

  const fieldPath = getApplyableFieldPath(controls.type);
  if (!fieldPath) throw new Error("SUGGESTION_TYPE_NOT_APPLYABLE");

  const draftId = controls.targetId.startsWith("drafts.") ? controls.targetId : `drafts.${controls.targetId}`;
  const article = await rawClient.fetch(
    groq`*[_id == $draftId][0]{
      _id,
      _rev,
      _type,
      seo { title, description, focusKeyword, searchIntent }
    }`,
    { draftId },
  );
  if (!article?._id || article._type !== "article") throw new Error("TARGET_DRAFT_NOT_FOUND");
  const target = targetDraftSchema.parse(article);
  const before = valueAtSeoPath(target, fieldPath);
  if (!approvedBaseIsCurrent({
    currentRevision: target._rev,
    approvedRevision: suggestion.approvedTargetRevision,
    currentValue: before,
    approvedBaseValue: storedFieldValue(suggestion.approvedBaseValue),
  })) {
    throw new Error("SUGGESTION_STALE_BASE");
  }

  const appliedAt = new Date().toISOString();
  const auditDocument = buildAuditLogDocument({
    id: `auditLog.${randomUUID()}`,
    actor: appliedBy,
    actorType: context.actorType,
    action: "seo-suggestion:apply-to-draft",
    objectType: "article",
    objectId: draftId,
    before: { field: fieldPath, valuePresent: before !== null && before !== undefined && String(before).length > 0 },
    after: { field: fieldPath, valuePresent: suggestion.approvedAfter.length > 0 },
    requestId: context.requestId,
    timestamp: appliedAt,
  });

  const claimedVersion = await claimAdminSuggestionApply(id, stored.row_version, context.requestId, appliedAt);
  let appliedRevision: string;
  try {
    appliedRevision = await patchArticleSeoField(rawClient, {
      draftId, draftRevision: target._rev, fieldPath, value: suggestion.approvedAfter,
    });
  } catch (error) {
    await requireApplyReconciliation(id, context.requestId, isRevisionConflict(error) ? "sanity-revision-conflict" : "sanity-result-ambiguous");
    if (isRevisionConflict(error)) throw new Error("SUGGESTION_STALE_BASE");
    throw new Error("APPLY_RECONCILIATION_REQUIRED");
  }

  try {
    await finalizeAdminSuggestionApply({
      id, rowVersion: claimedVersion, requestId: context.requestId, appliedBy, appliedAt,
      appliedTargetRevision: appliedRevision, beforePresent: before !== null && before !== undefined && String(before).length > 0,
      fieldPath, auditId: auditDocument.id, objectId: draftId,
    });
  } catch {
    await requireApplyReconciliation(id, context.requestId, "neon-finalize-ambiguous");
    throw new Error("APPLY_RECONCILIATION_REQUIRED");
  }

  return {
    suggestionId: id,
    draftId,
    fieldPath,
    before: before ?? null,
    after: suggestion.approvedAfter,
    appliedAt,
    alreadyApplied: false,
  };
}
