import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

/**
 * Monthly email digest: one more channel inside Admin Social.
 *
 * Pure lifecycle rules shared by the in-memory store (tests) and the Neon store
 * (`ccpun_social`). Admin is the control plane only: it prepares, reviews,
 * approves and audits. Delivery is done later by the n8n worker that claims a
 * `social_worker_job` outbox row. Nothing in this file performs I/O.
 */

export const EMAIL_DIGEST_CHANNEL = "email_digest" as const;
export const EMAIL_DIGEST_SEND_FLAG = "CCPUN_SOCIAL_EMAIL_DIGEST_SEND_ENABLED";
/** The owner must type this phrase before a schedule/send or an ambiguous retry. */
export const EMAIL_DIGEST_SEND_CONFIRMATION = "ยืนยันการส่ง";
export const EMAIL_DIGEST_MAX_ARTICLES = 20;
export const EMAIL_DIGEST_TIME_ZONE = "Asia/Bangkok";
export const EMAIL_DIGEST_RECIPIENTS_PLACEHOLDER = "จำนวนผู้รับ: ยังไม่เชื่อมต่อ";
export const WORKER_JOB_MAX_ATTEMPTS = 3;
export const WORKER_JOB_CLAIM_TIMEOUT_MS = 15 * 60_000;
export const EMAIL_DIGEST_MIN_LEAD_MS = 5 * 60_000;
export const EMAIL_DIGEST_MAX_LEAD_MS = 60 * 24 * 60 * 60_000;

const BANGKOK_OFFSET_MS = 7 * 60 * 60_000; // Asia/Bangkok has no DST.

export const emailDigestStatusSchema = z.enum(["draft", "reviewed", "scheduled", "sent", "cancelled"]);
export type EmailDigestStatus = z.infer<typeof emailDigestStatusSchema>;
export const workerJobStatusSchema = z.enum(["queued", "claimed", "succeeded", "failed", "needs_attention", "cancelled"]);
export type WorkerJobStatus = z.infer<typeof workerJobStatusSchema>;

const DIGEST_TRANSITIONS: Readonly<Record<EmailDigestStatus, ReadonlySet<EmailDigestStatus>>> = {
  draft: new Set(["draft", "reviewed", "cancelled"]),
  reviewed: new Set(["draft", "scheduled", "cancelled"]),
  scheduled: new Set(["reviewed", "sent"]),
  sent: new Set(),
  cancelled: new Set(),
};

const JOB_TRANSITIONS: Readonly<Record<WorkerJobStatus, ReadonlySet<WorkerJobStatus>>> = {
  queued: new Set(["claimed", "cancelled"]),
  claimed: new Set(["succeeded", "failed", "needs_attention"]),
  failed: new Set(["queued", "cancelled"]),
  needs_attention: new Set(["queued", "succeeded", "failed", "cancelled"]),
  succeeded: new Set(),
  cancelled: new Set(),
};

export function canTransitionEmailDigest(from: EmailDigestStatus, to: EmailDigestStatus) {
  return DIGEST_TRANSITIONS[from].has(to);
}

export function canTransitionWorkerJob(from: WorkerJobStatus, to: WorkerJobStatus) {
  return JOB_TRANSITIONS[from].has(to);
}

const boundedId = z.string().trim().min(1).max(120).regex(/^[A-Za-z0-9_.:-]+$/);
export const emailDigestIdSchema = z.string().regex(/^email-digest:[a-f0-9-]{36}$/);
export const workerJobIdSchema = z.string().regex(/^worker-job:[a-f0-9]{32}$/);
export const idempotencyKeySchema = z.string().trim().min(16).max(120).regex(/^[A-Za-z0-9_.:-]+$/);
export const monthSchema = z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/);
const singleLine = (max: number) => z.string().trim().min(1).max(max).refine((value) => !/[\r\n<>]/.test(value), "Single line text without angle brackets");

export const articleReferenceSchema = z.strictObject({
  documentId: boundedId.refine((value) => !value.startsWith("drafts."), "Logical (published) Sanity document ID only"),
  title: singleLine(200),
  canonicalUrl: z.string().trim().max(2_048).url().refine((value) => {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "ccpun.com" && !url.username && !url.password && !url.hash;
  }, "Canonical URL must be an https://ccpun.com article URL"),
});
export type ArticleReference = z.infer<typeof articleReferenceSchema>;

export const emailDigestContentSchema = z.strictObject({
  month: monthSchema,
  subject: singleLine(150),
  preheader: z.string().trim().max(200).refine((value) => !/[\r\n<>]/.test(value)).default(""),
  intro: z.string().trim().max(4_000).refine((value) => !/[<>]/.test(value), "Plain text only").default(""),
  closing: z.string().trim().max(1_000).refine((value) => !/[<>]/.test(value), "Plain text only").nullable().default(null),
  articles: z.array(articleReferenceSchema).max(EMAIL_DIGEST_MAX_ARTICLES).default([]),
}).superRefine((content, context) => {
  const ids = content.articles.map((article) => article.documentId);
  if (new Set(ids).size !== ids.length) context.addIssue({ code: "custom", path: ["articles"], message: "Each article appears once" });
});
export type EmailDigestContent = z.infer<typeof emailDigestContentSchema>;

const mutationBase = { idempotencyKey: idempotencyKeySchema };
const existingBase = { ...mutationBase, digestId: emailDigestIdSchema, expectedVersion: z.number().int().min(1) };

export const emailDigestMutationSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("create"), ...mutationBase, content: emailDigestContentSchema }),
  z.strictObject({ action: z.literal("update"), ...existingBase, content: emailDigestContentSchema }),
  z.strictObject({ action: z.literal("review"), ...existingBase }),
  z.strictObject({
    action: z.literal("schedule"),
    ...existingBase,
    scheduledAt: z.string().datetime().nullable(),
    confirmation: z.string().max(80),
  }),
  z.strictObject({ action: z.literal("unschedule"), ...existingBase, acknowledgeAmbiguous: z.boolean().default(false) }),
  z.strictObject({ action: z.literal("cancel"), ...existingBase }),
]);
export type EmailDigestMutation = z.infer<typeof emailDigestMutationSchema>;
export type EmailDigestAction = EmailDigestMutation["action"];

export const workerJobRetrySchema = z.strictObject({
  jobId: workerJobIdSchema,
  expectedVersion: z.number().int().min(1),
  idempotencyKey: idempotencyKeySchema,
  confirmation: z.string().max(80),
  acknowledgeAmbiguous: z.boolean().default(false),
});
export type WorkerJobRetry = z.infer<typeof workerJobRetrySchema>;

export const workerClaimSchema = z.strictObject({
  jobId: workerJobIdSchema,
  idempotencyKey: idempotencyKeySchema,
});

const externalIdsSchema = z.record(
  z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
  z.string().trim().min(1).max(200).regex(/^[A-Za-z0-9_.:@\/-]+$/),
).refine((value) => Object.keys(value).length <= 10, "At most 10 external IDs");

export const workerErrorCodeSchema = z.string().regex(/^[a-z0-9][a-z0-9_.-]{0,59}$/);
/** Error codes that do not prove the provider did nothing. They never auto-retry. */
export const AMBIGUOUS_WORKER_ERROR_CODES = new Set(["timeout", "unknown", "provider-unknown", "network-ambiguous", "claim-timeout"]);

export const workerResultSchema = z.strictObject({
  jobId: workerJobIdSchema,
  idempotencyKey: idempotencyKeySchema,
  claimToken: z.string().regex(/^[a-f0-9]{32}$/),
  outcome: z.enum(["succeeded", "failed"]),
  errorCode: workerErrorCodeSchema.nullable().default(null),
  externalIds: externalIdsSchema.default({}),
}).superRefine((result, context) => {
  if (result.outcome === "failed" && !result.errorCode) context.addIssue({ code: "custom", path: ["errorCode"], message: "Failed results name an error code" });
  if (result.outcome === "succeeded" && result.errorCode) context.addIssue({ code: "custom", path: ["errorCode"], message: "Succeeded results carry no error code" });
});
export type WorkerResult = z.infer<typeof workerResultSchema>;

export type Receipt = {
  action: string;
  actorRef: string;
  payloadDigest: string;
  result: { objectId: string; version: number; status: string };
};

export type EmailDigestRecord = EmailDigestContent & {
  id: string;
  status: EmailDigestStatus;
  version: number;
  contentVersion: number;
  reviewedContentVersion: number | null;
  reviewedAt: string | null;
  reviewedByRef: string | null;
  scheduledAt: string | null;
  jobId: string | null;
  sentAt: string | null;
  createdByRef: string;
  createdAt: string;
  updatedAt: string;
  receipts: Record<string, Receipt>;
};

export type WorkerJobRecord = {
  id: string;
  channel: typeof EMAIL_DIGEST_CHANNEL;
  action: "send_digest";
  objectId: string;
  objectVersion: number;
  scheduledAt: string;
  idempotencyKey: string;
  status: WorkerJobStatus;
  attempts: number;
  maxAttempts: number;
  claimToken: string | null;
  claimedAt: string | null;
  claimExpiresAt: string | null;
  lastErrorCode: string | null;
  externalIds: Record<string, string>;
  version: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  receipts: Record<string, Receipt>;
};

export type AuditEntry = {
  id: string;
  actorType: "human" | "system";
  actorRef: string;
  action: string;
  objectType: "publication" | "job";
  objectId: string;
  requestRef: string | null;
  outcome: "succeeded" | "failed";
};

export class EmailDigestError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "EmailDigestError";
  }
}
const fail = (code: string): never => { throw new EmailDigestError(code); };

export function safeActorRef(actor: string) {
  return `admin:${createHash("sha256").update(actor).digest("hex").slice(0, 32)}`;
}

export const WORKER_ACTOR_REF = "n8n-social-worker";
export const SYSTEM_ACTOR_REF = "ccpun-social-reconciler";

export function isEmailDigestSendEnabled(env: Record<string, string | undefined> = process.env) {
  return env[EMAIL_DIGEST_SEND_FLAG]?.trim() === "1";
}

// --- RBAC -------------------------------------------------------------------

export type DigestActor = { actorType: string; role: string } | null;

/** Reads need `social:read` (owner holds every permission); every state change is human owner only. */
export function authorizeEmailDigestActor(actor: DigestActor, intent: "read" | "mutate") {
  if (!actor) return { allowed: false as const, status: 401 as const, error: "unauthorized" };
  if (intent === "mutate" && (actor.actorType !== "human" || actor.role !== "owner")) {
    return { allowed: false as const, status: 403 as const, error: "forbidden" };
  }
  if (intent === "read" && actor.role !== "owner") return { allowed: false as const, status: 403 as const, error: "forbidden" };
  return { allowed: true as const };
}

// --- Month window and auto-assemble (Asia/Bangkok) --------------------------

export function bangkokMonthWindow(month: string) {
  const [year, monthNumber] = monthSchema.parse(month).split("-").map(Number) as [number, number];
  const start = Date.UTC(year, monthNumber - 1, 1) - BANGKOK_OFFSET_MS;
  const end = Date.UTC(year, monthNumber, 1) - BANGKOK_OFFSET_MS;
  return { startUtc: new Date(start).toISOString(), endUtc: new Date(end).toISOString() };
}

export function bangkokMonthOf(instant: Date) {
  const shifted = new Date(instant.getTime() + BANGKOK_OFFSET_MS);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

export type PublishedArticleCandidate = {
  documentId: string;
  title: string;
  canonicalUrl: string;
  publishedAt: string;
  noindex?: boolean | null;
};

/** Articles first published inside the Bangkok calendar month, oldest first, logical IDs only. */
export function assembleMonthArticles(candidates: readonly PublishedArticleCandidate[], month: string): ArticleReference[] {
  const { startUtc, endUtc } = bangkokMonthWindow(month);
  const start = Date.parse(startUtc);
  const end = Date.parse(endUtc);
  const seen = new Set<string>();
  return candidates
    .filter((candidate) => {
      const published = Date.parse(candidate.publishedAt);
      return Number.isFinite(published) && published >= start && published < end
        && !candidate.documentId.startsWith("drafts.") && candidate.noindex !== true;
    })
    .sort((a, b) => Date.parse(a.publishedAt) - Date.parse(b.publishedAt) || a.documentId.localeCompare(b.documentId))
    .flatMap((candidate) => {
      if (seen.has(candidate.documentId)) return [];
      seen.add(candidate.documentId);
      const parsed = articleReferenceSchema.safeParse({
        documentId: candidate.documentId,
        title: candidate.title.replace(/[\r\n<>]+/g, " ").trim().slice(0, 200),
        canonicalUrl: candidate.canonicalUrl,
      });
      return parsed.success ? [parsed.data] : [];
    })
    .slice(0, EMAIL_DIGEST_MAX_ARTICLES);
}

// --- Idempotency receipts -----------------------------------------------------

export function payloadDigest(action: string, actorRef: string, payload: unknown) {
  return createHash("sha256").update(JSON.stringify([action, actorRef, payload])).digest("hex");
}

export function receiptKey(idempotencyKey: string, action: string) {
  return `audit:${idempotencyKey}:${action}`;
}

/** `null` = first use. A matching receipt replays; any other payload under the same key is a conflict. */
export function replayFromReceipts(receipts: Record<string, Receipt>, key: string, digest: string) {
  const receipt = Object.hasOwn(receipts, key) ? receipts[key] : undefined;
  if (!receipt) return null;
  if (receipt.payloadDigest !== digest) fail("EMAIL_DIGEST_IDEMPOTENCY_CONFLICT");
  return receipt.result;
}

// --- Digest planner -------------------------------------------------------------

export type DigestPlan = {
  next: EmailDigestRecord;
  expectedVersion: number | null;
  audit: AuditEntry;
  receipt: { key: string; value: Receipt };
  createJob?: WorkerJobRecord;
  jobUpdate?: { expectedVersion: number; next: WorkerJobRecord };
  notifyJobId?: string;
};

function isComplete(content: EmailDigestContent) {
  return content.subject.trim().length > 0 && content.intro.trim().length > 0 && content.articles.length > 0;
}

/** Stable for one approved schedule (and all of its retries); a new schedule after unschedule is a new job. */
export function workerJobIdempotencyKey(digestId: string, contentVersion: number, scheduledFromVersion: number) {
  return `email-digest:${createHash("sha256").update(`${digestId}\0${contentVersion}\0${scheduledFromVersion}`).digest("hex").slice(0, 48)}`;
}

export function workerJobIdFor(idempotencyKey: string) {
  return `worker-job:${createHash("sha256").update(idempotencyKey).digest("hex").slice(0, 32)}`;
}

export function planEmailDigestMutation(input: {
  mutation: EmailDigestMutation;
  actorRef: string;
  current: EmailDigestRecord | null;
  currentJob: WorkerJobRecord | null;
  now: Date;
  sendEnabled: boolean;
  newDigestId?: string;
  /** Another non-cancelled digest already owns this month. */
  monthOwnerId?: string | null;
}): DigestPlan {
  const { mutation, actorRef, now } = input;
  const at = now.toISOString();
  const digest = payloadDigest(mutation.action, actorRef, mutation);
  const audit = (objectId: string, action = mutation.action): AuditEntry => ({
    id: receiptKey(mutation.idempotencyKey, `email-digest:${action}`),
    actorType: "human",
    actorRef,
    action: `email-digest:${action}`,
    objectType: "publication",
    objectId,
    requestRef: mutation.idempotencyKey,
    outcome: "succeeded",
  });
  const finish = (next: EmailDigestRecord, expectedVersion: number | null, extra: Partial<DigestPlan> = {}): DigestPlan => {
    const key = receiptKey(mutation.idempotencyKey, mutation.action);
    const value: Receipt = { action: mutation.action, actorRef, payloadDigest: digest, result: { objectId: next.id, version: next.version, status: next.status } };
    return { next: { ...next, receipts: { ...next.receipts, [key]: value } }, expectedVersion, audit: audit(next.id), receipt: { key, value }, ...extra };
  };

  if (mutation.action === "create") {
    if (input.monthOwnerId) fail("EMAIL_DIGEST_MONTH_TAKEN");
    const id = emailDigestIdSchema.parse(input.newDigestId);
    return finish({
      ...mutation.content,
      id,
      status: "draft",
      version: 1,
      contentVersion: 1,
      reviewedContentVersion: null,
      reviewedAt: null,
      reviewedByRef: null,
      scheduledAt: null,
      jobId: null,
      sentAt: null,
      createdByRef: actorRef,
      createdAt: at,
      updatedAt: at,
      receipts: {},
    }, null);
  }

  const current = input.current ?? fail("EMAIL_DIGEST_NOT_FOUND");
  if (current.id !== mutation.digestId) fail("EMAIL_DIGEST_NOT_FOUND");
  if (current.version !== mutation.expectedVersion) fail("EMAIL_DIGEST_VERSION_CONFLICT");
  const bump = (patch: Partial<EmailDigestRecord>): EmailDigestRecord => ({ ...current, ...patch, version: current.version + 1, updatedAt: at });

  switch (mutation.action) {
    case "update": {
      if (!["draft", "reviewed"].includes(current.status)) fail("EMAIL_DIGEST_INVALID_TRANSITION");
      if (mutation.content.month !== current.month && input.monthOwnerId && input.monthOwnerId !== current.id) fail("EMAIL_DIGEST_MONTH_TAKEN");
      // Every editorial change invalidates the earlier review, exactly like social drafts.
      return finish(bump({ ...mutation.content, status: "draft", contentVersion: current.contentVersion + 1, reviewedContentVersion: null, reviewedAt: null, reviewedByRef: null }), current.version);
    }
    case "review": {
      if (current.status !== "draft") fail("EMAIL_DIGEST_INVALID_TRANSITION");
      if (!isComplete(current)) fail("EMAIL_DIGEST_INCOMPLETE");
      return finish(bump({ status: "reviewed", reviewedContentVersion: current.contentVersion, reviewedAt: at, reviewedByRef: actorRef }), current.version);
    }
    case "schedule": {
      if (!input.sendEnabled) fail("EMAIL_DIGEST_SEND_DISABLED");
      if (mutation.confirmation !== EMAIL_DIGEST_SEND_CONFIRMATION) fail("EMAIL_DIGEST_CONFIRMATION_REQUIRED");
      if (current.status !== "reviewed" || current.reviewedContentVersion !== current.contentVersion) fail("EMAIL_DIGEST_INVALID_TRANSITION");
      if (!isComplete(current)) fail("EMAIL_DIGEST_INCOMPLETE");
      let scheduledAt = at;
      if (mutation.scheduledAt !== null) {
        const requested = Date.parse(mutation.scheduledAt);
        if (requested < now.getTime() + EMAIL_DIGEST_MIN_LEAD_MS || requested > now.getTime() + EMAIL_DIGEST_MAX_LEAD_MS) fail("EMAIL_DIGEST_SCHEDULE_TIME_INVALID");
        scheduledAt = new Date(requested).toISOString();
      }
      const jobKey = workerJobIdempotencyKey(current.id, current.contentVersion, current.version);
      const jobId = workerJobIdFor(jobKey);
      if (input.currentJob && input.currentJob.id === jobId) fail("EMAIL_DIGEST_JOB_EXISTS");
      const job: WorkerJobRecord = {
        id: jobId,
        channel: EMAIL_DIGEST_CHANNEL,
        action: "send_digest",
        objectId: current.id,
        objectVersion: current.contentVersion,
        scheduledAt,
        idempotencyKey: jobKey,
        status: "queued",
        attempts: 0,
        maxAttempts: WORKER_JOB_MAX_ATTEMPTS,
        claimToken: null,
        claimedAt: null,
        claimExpiresAt: null,
        lastErrorCode: null,
        externalIds: {},
        version: 1,
        createdAt: at,
        updatedAt: at,
        completedAt: null,
        receipts: {},
      };
      return finish(bump({ status: "scheduled", scheduledAt, jobId }), current.version, { createJob: job, notifyJobId: jobId });
    }
    case "unschedule": {
      if (current.status !== "scheduled") fail("EMAIL_DIGEST_INVALID_TRANSITION");
      const job = input.currentJob ?? fail("WORKER_JOB_NOT_FOUND");
      if (job.id !== current.jobId) fail("WORKER_JOB_NOT_FOUND");
      if (job.status === "claimed") fail("WORKER_JOB_IN_FLIGHT");
      if (job.status === "needs_attention" && !mutation.acknowledgeAmbiguous) fail("WORKER_JOB_AMBIGUOUS_ACK_REQUIRED");
      if (!canTransitionWorkerJob(job.status, "cancelled")) fail("EMAIL_DIGEST_INVALID_TRANSITION");
      const nextJob: WorkerJobRecord = { ...job, status: "cancelled", claimToken: null, claimExpiresAt: null, version: job.version + 1, updatedAt: at, completedAt: at };
      return finish(bump({ status: "reviewed", scheduledAt: null, jobId: null }), current.version, { jobUpdate: { expectedVersion: job.version, next: nextJob } });
    }
    case "cancel": {
      if (!["draft", "reviewed"].includes(current.status)) fail("EMAIL_DIGEST_INVALID_TRANSITION");
      return finish(bump({ status: "cancelled" }), current.version);
    }
  }
}

// --- Outbox (worker job) planner ------------------------------------------------------

export type JobPlan = {
  next: WorkerJobRecord;
  expectedVersion: number;
  audit: AuditEntry;
  digestUpdate?: { expectedVersion: number; next: EmailDigestRecord };
};

function jobAudit(job: WorkerJobRecord, action: string, id: string, actorType: AuditEntry["actorType"], actorRef: string, requestRef: string | null, outcome: AuditEntry["outcome"] = "succeeded"): AuditEntry {
  return { id, actorType, actorRef, action: `worker-job:${action}`, objectType: "job", objectId: job.id, requestRef, outcome };
}

export function newClaimToken() {
  return randomBytes(16).toString("hex");
}

export type ClaimDecision =
  | { state: "claimed"; plan: JobPlan; claimToken: string }
  | { state: "not-due" | "not-claimable" | "attempts-exhausted" | "unknown-job"; plan?: undefined };

export function planWorkerClaim(input: { job: WorkerJobRecord | null; idempotencyKey: string; now: Date; claimToken?: string }): ClaimDecision {
  const job = input.job;
  if (!job || job.idempotencyKey !== input.idempotencyKey) return { state: "unknown-job" };
  if (job.status !== "queued") return { state: "not-claimable" };
  if (Date.parse(job.scheduledAt) > input.now.getTime()) return { state: "not-due" };
  if (job.attempts >= job.maxAttempts) return { state: "attempts-exhausted" };
  const at = input.now.toISOString();
  const claimToken = input.claimToken ?? newClaimToken();
  const next: WorkerJobRecord = {
    ...job,
    status: "claimed",
    attempts: job.attempts + 1,
    claimToken,
    claimedAt: at,
    claimExpiresAt: new Date(input.now.getTime() + WORKER_JOB_CLAIM_TIMEOUT_MS).toISOString(),
    lastErrorCode: null,
    version: job.version + 1,
    updatedAt: at,
  };
  return { state: "claimed", claimToken, plan: { next, expectedVersion: job.version, audit: jobAudit(job, "claim", `audit:${job.id}:claim:${next.attempts}`, "system", WORKER_ACTOR_REF, job.idempotencyKey) } };
}

export type ResultDecision =
  | { state: "applied"; plan: JobPlan }
  | { state: "replay" | "ignored"; plan?: undefined };

/** Callbacks are idempotent by job ID + idempotency key + claim token; late or duplicate callbacks are no-ops. */
export function planWorkerResult(input: { job: WorkerJobRecord | null; digest: EmailDigestRecord | null; result: WorkerResult; now: Date }): ResultDecision {
  const { job, result } = input;
  if (!job || job.idempotencyKey !== result.idempotencyKey) return { state: "ignored" };
  const key = `result:${result.claimToken}`;
  const digest = payloadDigest("result", WORKER_ACTOR_REF, result);
  const existing = Object.hasOwn(job.receipts, key) ? job.receipts[key] : undefined;
  if (existing) return { state: existing.payloadDigest === digest ? "replay" : "ignored" };
  if (job.claimToken !== result.claimToken || !["claimed", "needs_attention"].includes(job.status)) return { state: "ignored" };
  const at = input.now.toISOString();
  const status: WorkerJobStatus = result.outcome === "succeeded"
    ? "succeeded"
    : AMBIGUOUS_WORKER_ERROR_CODES.has(result.errorCode ?? "") ? "needs_attention" : "failed";
  if (!canTransitionWorkerJob(job.status, status) && status !== job.status) return { state: "ignored" };
  const receipt: Receipt = { action: "result", actorRef: WORKER_ACTOR_REF, payloadDigest: digest, result: { objectId: job.id, version: job.version + 1, status } };
  const next: WorkerJobRecord = {
    ...job,
    status,
    claimExpiresAt: null,
    lastErrorCode: result.outcome === "failed" ? result.errorCode : null,
    externalIds: { ...job.externalIds, ...result.externalIds },
    version: job.version + 1,
    updatedAt: at,
    completedAt: status === "succeeded" ? at : null,
    receipts: { ...job.receipts, [key]: receipt },
  };
  const plan: JobPlan = {
    next,
    expectedVersion: job.version,
    audit: jobAudit(job, `result-${status.replace("_", "-")}`, `audit:${job.id}:${key}`, "system", WORKER_ACTOR_REF, job.idempotencyKey, status === "succeeded" ? "succeeded" : "failed"),
  };
  const digestRecord = input.digest;
  if (status === "succeeded" && digestRecord && digestRecord.id === job.objectId && digestRecord.jobId === job.id && digestRecord.status === "scheduled") {
    plan.digestUpdate = { expectedVersion: digestRecord.version, next: { ...digestRecord, status: "sent", sentAt: at, version: digestRecord.version + 1, updatedAt: at } };
  }
  return { state: "applied", plan };
}

/** A claim that outlived its lease is ambiguous: mark it for the owner, never retry automatically. */
export function planClaimTimeouts(jobs: readonly WorkerJobRecord[], now: Date): JobPlan[] {
  const at = now.toISOString();
  return jobs
    .filter((job) => job.status === "claimed" && job.claimExpiresAt !== null && Date.parse(job.claimExpiresAt) <= now.getTime())
    .map((job) => ({
      next: { ...job, status: "needs_attention" as const, lastErrorCode: "claim-timeout", version: job.version + 1, updatedAt: at },
      expectedVersion: job.version,
      audit: jobAudit(job, "claim-timeout", `audit:${job.id}:timeout:${job.claimToken ?? job.attempts}`, "system", SYSTEM_ACTOR_REF, job.idempotencyKey, "failed"),
    }));
}

export type RetryDecision = { state: "requeued" | "renotify"; plan: JobPlan | null; audit: AuditEntry; notifyJobId: string; replay: boolean };

/** Owner retry: queued = notify n8n again; failed / needs_attention = back to queued. Audited. */
export function planWorkerRetry(input: { job: WorkerJobRecord | null; request: WorkerJobRetry; actorRef: string; now: Date; sendEnabled: boolean }): RetryDecision {
  const { request, actorRef } = input;
  if (!input.sendEnabled) fail("EMAIL_DIGEST_SEND_DISABLED");
  if (request.confirmation !== EMAIL_DIGEST_SEND_CONFIRMATION) fail("EMAIL_DIGEST_CONFIRMATION_REQUIRED");
  const job = input.job ?? fail("WORKER_JOB_NOT_FOUND");
  const key = receiptKey(request.idempotencyKey, "retry");
  const digest = payloadDigest("retry", actorRef, request);
  const replay = replayFromReceipts(job.receipts, key, digest);
  const audit = jobAudit(job, job.status === "queued" ? "renotify" : "retry", receiptKey(request.idempotencyKey, "worker-job:retry"), "human", actorRef, request.idempotencyKey);
  if (replay) return { state: replay.status === "queued" && job.status === "queued" ? "renotify" : "requeued", plan: null, audit, notifyJobId: job.id, replay: true };
  if (job.version !== request.expectedVersion) fail("WORKER_JOB_VERSION_CONFLICT");
  if (job.status === "queued") return { state: "renotify", plan: null, audit, notifyJobId: job.id, replay: false };
  if (!["failed", "needs_attention"].includes(job.status)) fail("WORKER_JOB_NOT_RETRYABLE");
  if (job.status === "needs_attention" && !request.acknowledgeAmbiguous) fail("WORKER_JOB_AMBIGUOUS_ACK_REQUIRED");
  const at = input.now.toISOString();
  const receipt: Receipt = { action: "retry", actorRef, payloadDigest: digest, result: { objectId: job.id, version: job.version + 1, status: "queued" } };
  const next: WorkerJobRecord = {
    ...job,
    status: "queued",
    claimToken: null,
    claimedAt: null,
    claimExpiresAt: null,
    maxAttempts: Math.max(job.maxAttempts, job.attempts + 1),
    scheduledAt: Date.parse(job.scheduledAt) > input.now.getTime() ? job.scheduledAt : at,
    version: job.version + 1,
    updatedAt: at,
    receipts: { ...job.receipts, [key]: receipt },
  };
  return { state: "requeued", plan: { next, expectedVersion: job.version, audit }, audit, notifyJobId: job.id, replay: false };
}
