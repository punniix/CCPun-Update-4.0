import { randomUUID } from "node:crypto";
import {
  emailDigestMutationSchema,
  EmailDigestError,
  isEmailDigestSendEnabled,
  payloadDigest,
  planClaimTimeouts,
  planEmailDigestMutation,
  planWorkerClaim,
  planWorkerResult,
  planWorkerRetry,
  receiptKey,
  replayFromReceipts,
  safeActorRef,
  workerJobIdempotencyKey,
  workerJobIdFor,
  workerJobRetrySchema,
  workerResultSchema,
  type AuditEntry,
  type DigestPlan,
  type EmailDigestMutation,
  type EmailDigestRecord,
  type JobPlan,
  type WorkerJobRecord,
} from "./email-digest-model";
import { EMAIL_DIGEST_SENDER_NAME, renderEmailDigestHtml, renderEmailDigestText } from "./email-digest-render";
import type { WorkerNonceStore } from "./worker-signature";

/** Durable owner of digests, the worker outbox and the append-only audit. Implemented by Neon and by tests. */
export type EmailDigestStore = WorkerNonceStore & {
  getDigest(id: string): Promise<EmailDigestRecord | null>;
  findDigestByReceipt(key: string): Promise<EmailDigestRecord | null>;
  findMonthOwner(month: string): Promise<string | null>;
  listDigests(limit: number): Promise<EmailDigestRecord[]>;
  getJob(id: string): Promise<WorkerJobRecord | null>;
  listJobs(limit: number): Promise<WorkerJobRecord[]>;
  /** All writes of one plan commit atomically with compare-and-set on every version; `false` = CAS conflict. */
  commitDigestPlan(plan: DigestPlan): Promise<boolean>;
  commitJobPlan(plan: JobPlan): Promise<boolean>;
  /** Insert-only; `false` when the audit ID already exists. */
  appendAudit(entry: AuditEntry): Promise<boolean>;
};

/**
 * Server-only delivery boundary. Admin never talks to an email provider; the
 * n8n adapter only signals "job <id> is ready" and n8n pulls/claims it.
 */
export type EmailDigestSender = {
  sendDigest(input: { jobId: string }): Promise<{ accepted: boolean; errorCode: string | null }>;
};

export const disabledEmailDigestSender: EmailDigestSender = {
  async sendDigest() {
    return { accepted: false, errorCode: "send-disabled" };
  },
};

type Env = Record<string, string | undefined>;

async function notify(sender: EmailDigestSender, jobId: string | undefined, env: Env) {
  if (!jobId) return null;
  if (!isEmailDigestSendEnabled(env)) return { accepted: false, errorCode: "send-disabled" };
  try {
    return await sender.sendDigest({ jobId });
  } catch {
    // The job stays queued; the owner can re-notify from Admin and n8n also polls due jobs.
    return { accepted: false, errorCode: "notify-failed" };
  }
}

export async function mutateEmailDigest(input: {
  mutation: unknown;
  actor: string;
  store: EmailDigestStore;
  sender?: EmailDigestSender;
  env?: Env;
  now?: Date;
  newDigestId?: string;
}) {
  const mutation: EmailDigestMutation = emailDigestMutationSchema.parse(input.mutation);
  const env = input.env ?? process.env;
  const now = input.now ?? new Date();
  const actorRef = safeActorRef(input.actor);
  const key = receiptKey(mutation.idempotencyKey, mutation.action);
  const digest = payloadDigest(mutation.action, actorRef, mutation);

  const current = mutation.action === "create"
    ? await input.store.findDigestByReceipt(key)
    : await input.store.getDigest(mutation.digestId);
  if (current) {
    const replay = replayFromReceipts(current.receipts, key, digest);
    if (replay) return { state: "replay" as const, digest: current, notification: null };
  }
  if (mutation.action !== "create" && !current) throw new EmailDigestError("EMAIL_DIGEST_NOT_FOUND");

  let currentJob: WorkerJobRecord | null = null;
  if (current?.jobId) currentJob = await input.store.getJob(current.jobId);
  else if (current && mutation.action === "schedule") currentJob = await input.store.getJob(workerJobIdFor(workerJobIdempotencyKey(current.id, current.contentVersion, current.version)));
  const month = mutation.action === "create" || mutation.action === "update" ? mutation.content.month : null;
  const monthOwnerId = month ? await input.store.findMonthOwner(month) : null;

  const plan = planEmailDigestMutation({
    mutation,
    actorRef,
    current: mutation.action === "create" ? null : current,
    currentJob,
    now,
    sendEnabled: isEmailDigestSendEnabled(env),
    newDigestId: input.newDigestId ?? `email-digest:${randomUUID()}`,
    monthOwnerId: monthOwnerId === current?.id ? null : monthOwnerId,
  });

  if (!(await input.store.commitDigestPlan(plan))) {
    const reread = mutation.action === "create" ? await input.store.findDigestByReceipt(key) : await input.store.getDigest(mutation.digestId);
    const replay = reread ? replayFromReceipts(reread.receipts, key, digest) : null;
    if (replay && reread) return { state: "replay" as const, digest: reread, notification: null };
    throw new EmailDigestError(mutation.action === "create" ? "EMAIL_DIGEST_MONTH_TAKEN" : "EMAIL_DIGEST_VERSION_CONFLICT");
  }
  const notification = await notify(input.sender ?? disabledEmailDigestSender, plan.notifyJobId, env);
  return { state: "applied" as const, digest: plan.next, notification };
}

/** Claimed jobs past their lease become needs_attention (never retried automatically). */
export async function reconcileWorkerJobs(store: EmailDigestStore, now = new Date()) {
  const plans = planClaimTimeouts(await store.listJobs(200), now);
  let marked = 0;
  for (const plan of plans) if (await store.commitJobPlan(plan)) marked += 1;
  return { marked };
}

/** Owner-facing view: no idempotency receipts, actor references or claim tokens leave the server. */
export function publicDigestView(digest: EmailDigestRecord) {
  const view: Partial<EmailDigestRecord> = { ...digest };
  delete view.receipts;
  delete view.createdByRef;
  delete view.reviewedByRef;
  return view as Omit<EmailDigestRecord, "receipts" | "createdByRef" | "reviewedByRef">;
}

export function publicJobView(job: WorkerJobRecord) {
  const view: Partial<WorkerJobRecord> = { ...job };
  delete view.receipts;
  delete view.claimToken;
  return view as Omit<WorkerJobRecord, "receipts" | "claimToken">;
}

export async function getEmailDigestWorkspace(input: { store: EmailDigestStore; env?: Env; now?: Date }) {
  const now = input.now ?? new Date();
  await reconcileWorkerJobs(input.store, now);
  const [digests, jobs] = await Promise.all([input.store.listDigests(60), input.store.listJobs(100)]);
  return {
    sendEnabled: isEmailDigestSendEnabled(input.env ?? process.env),
    digests: digests.map(publicDigestView),
    jobs: jobs.map(publicJobView),
  };
}

export async function retryWorkerJob(input: {
  request: unknown;
  actor: string;
  store: EmailDigestStore;
  sender?: EmailDigestSender;
  env?: Env;
  now?: Date;
}) {
  const request = workerJobRetrySchema.parse(input.request);
  const env = input.env ?? process.env;
  const now = input.now ?? new Date();
  const actorRef = safeActorRef(input.actor);
  const job = await input.store.getJob(request.jobId);
  const decision = planWorkerRetry({ job, request, actorRef, now, sendEnabled: isEmailDigestSendEnabled(env) });
  if (decision.replay) return { state: "replay" as const, jobId: decision.notifyJobId, notification: null };
  if (decision.plan) {
    if (!(await input.store.commitJobPlan(decision.plan))) throw new EmailDigestError("WORKER_JOB_VERSION_CONFLICT");
  } else if (!(await input.store.appendAudit(decision.audit))) {
    // Same owner request already re-notified n8n once (audit IDs are unique).
    return { state: "replay" as const, jobId: decision.notifyJobId, notification: null };
  }
  const notification = await notify(input.sender ?? disabledEmailDigestSender, decision.notifyJobId, env);
  return { state: decision.state, jobId: decision.notifyJobId, notification };
}

// --- n8n worker side (HMAC-authenticated routes call these) ----------------------------

/**
 * Exactly what the worker needs to send one digest: rendered content, article
 * links and the audience key. No secrets, no recipients, no actor identities.
 */
export function buildWorkerJobPayload(job: WorkerJobRecord, digest: EmailDigestRecord) {
  return {
    jobId: job.id,
    channel: job.channel,
    action: job.action,
    idempotencyKey: job.idempotencyKey,
    status: job.status,
    scheduledAt: job.scheduledAt,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    claimExpiresAt: job.claimExpiresAt,
    email: {
      digestId: digest.id,
      contentVersion: job.objectVersion,
      month: digest.month,
      audience: "email-digest-subscribers",
      senderName: EMAIL_DIGEST_SENDER_NAME,
      subject: digest.subject,
      preheader: digest.preheader,
      html: renderEmailDigestHtml(digest),
      text: renderEmailDigestText(digest),
      unsubscribePlaceholder: "{{unsubscribe_url}}",
      articles: digest.articles.map((article) => ({ documentId: article.documentId, title: article.title, url: article.canonicalUrl })),
    },
  };
}

export async function getWorkerJobDetail(store: EmailDigestStore, jobId: string, now = new Date()) {
  await reconcileWorkerJobs(store, now);
  const job = await store.getJob(jobId);
  if (!job) return null;
  const digest = await store.getDigest(job.objectId);
  // A job whose content changed after approval is never handed out.
  if (!digest || digest.contentVersion !== job.objectVersion || digest.jobId !== job.id) return null;
  return buildWorkerJobPayload(job, digest);
}

export async function listDueWorkerJobIds(store: EmailDigestStore, now = new Date()) {
  await reconcileWorkerJobs(store, now);
  return (await store.listJobs(200))
    .filter((job) => job.status === "queued" && Date.parse(job.scheduledAt) <= now.getTime() && job.attempts < job.maxAttempts)
    .map((job) => job.id);
}

export async function claimWorkerJob(input: { store: EmailDigestStore; jobId: string; idempotencyKey: string; now?: Date }) {
  const now = input.now ?? new Date();
  await reconcileWorkerJobs(input.store, now);
  const job = await input.store.getJob(input.jobId);
  const digest = job ? await input.store.getDigest(job.objectId) : null;
  if (job && (!digest || digest.contentVersion !== job.objectVersion || digest.jobId !== job.id)) return { state: "not-claimable" as const };
  const decision = planWorkerClaim({ job, idempotencyKey: input.idempotencyKey, now });
  if (decision.state !== "claimed") return { state: decision.state };
  if (!(await input.store.commitJobPlan(decision.plan))) return { state: "not-claimable" as const };
  return { state: "claimed" as const, claimToken: decision.claimToken, job: buildWorkerJobPayload(decision.plan.next, digest!) };
}

export async function recordWorkerResult(input: { store: EmailDigestStore; result: unknown; now?: Date }) {
  const result = workerResultSchema.parse(input.result);
  const now = input.now ?? new Date();
  const job = await input.store.getJob(result.jobId);
  const digest = job ? await input.store.getDigest(job.objectId) : null;
  const decision = planWorkerResult({ job, digest, result, now });
  if (decision.state !== "applied") return { state: decision.state, status: job?.status ?? null };
  if (!(await input.store.commitJobPlan(decision.plan))) {
    const reread = await input.store.getJob(result.jobId);
    const again = planWorkerResult({ job: reread, digest: null, result, now });
    return { state: again.state === "replay" ? "replay" as const : "ignored" as const, status: reread?.status ?? null };
  }
  return { state: "applied" as const, status: decision.plan.next.status };
}

// --- In-memory store (tests and local previews only) ------------------------------------

export function createMemoryEmailDigestStore() {
  const digests = new Map<string, EmailDigestRecord>();
  const jobs = new Map<string, WorkerJobRecord>();
  const audits = new Map<string, AuditEntry>();
  const nonces = new Map<string, number>();
  const clone = <T>(value: T): T => structuredClone(value);
  const auditFree = (id: string) => !audits.has(id);
  const store: EmailDigestStore & { audits: Map<string, AuditEntry>; jobs: Map<string, WorkerJobRecord>; digests: Map<string, EmailDigestRecord> } = {
    audits,
    jobs,
    digests,
    async getDigest(id) { const value = digests.get(id); return value ? clone(value) : null; },
    async findDigestByReceipt(key) {
      for (const value of digests.values()) if (Object.hasOwn(value.receipts, key)) return clone(value);
      return null;
    },
    async findMonthOwner(month) {
      for (const value of digests.values()) if (value.month === month && value.status !== "cancelled") return value.id;
      return null;
    },
    async listDigests(limit) { return [...digests.values()].sort((a, b) => b.month.localeCompare(a.month)).slice(0, limit).map(clone); },
    async getJob(id) { const value = jobs.get(id); return value ? clone(value) : null; },
    async listJobs(limit) { return [...jobs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit).map(clone); },
    async commitDigestPlan(plan) {
      const existing = digests.get(plan.next.id);
      if (plan.expectedVersion === null ? Boolean(existing) : existing?.version !== plan.expectedVersion) return false;
      if (plan.expectedVersion === null || plan.next.month !== existing?.month) {
        for (const other of digests.values()) if (other.id !== plan.next.id && other.month === plan.next.month && other.status !== "cancelled") return false;
      }
      if (!auditFree(plan.audit.id)) return false; // same as the SQL 23505 rollback
      if (plan.createJob && jobs.has(plan.createJob.id)) return false;
      if (plan.jobUpdate && jobs.get(plan.jobUpdate.next.id)?.version !== plan.jobUpdate.expectedVersion) return false;
      digests.set(plan.next.id, clone(plan.next));
      if (plan.createJob) jobs.set(plan.createJob.id, clone(plan.createJob));
      if (plan.jobUpdate) jobs.set(plan.jobUpdate.next.id, clone(plan.jobUpdate.next));
      audits.set(plan.audit.id, clone(plan.audit));
      return true;
    },
    async commitJobPlan(plan) {
      if (jobs.get(plan.next.id)?.version !== plan.expectedVersion) return false;
      if (plan.digestUpdate && digests.get(plan.digestUpdate.next.id)?.version !== plan.digestUpdate.expectedVersion) return false;
      if (!auditFree(plan.audit.id)) return false;
      jobs.set(plan.next.id, clone(plan.next));
      if (plan.digestUpdate) digests.set(plan.digestUpdate.next.id, clone(plan.digestUpdate.next));
      audits.set(plan.audit.id, clone(plan.audit));
      return true;
    },
    async appendAudit(entry) {
      if (!auditFree(entry.id)) return false;
      audits.set(entry.id, clone(entry));
      return true;
    },
    async claimNonce(nonce, seenAt) {
      if (nonces.has(nonce)) return false;
      nonces.set(nonce, seenAt.getTime());
      return true;
    },
  };
  return store;
}
