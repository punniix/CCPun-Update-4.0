import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import path, { join } from "node:path";
import test, { after, before } from "node:test";
import { pathToFileURL } from "node:url";
import {
  assembleMonthArticles,
  authorizeEmailDigestActor,
  bangkokMonthOf,
  bangkokMonthWindow,
  canTransitionEmailDigest,
  EMAIL_DIGEST_SEND_CONFIRMATION,
  EMAIL_DIGEST_SEND_FLAG,
  EmailDigestError,
  planClaimTimeouts,
  safeActorRef,
  WORKER_JOB_CLAIM_TIMEOUT_MS,
  type EmailDigestContent,
} from "../../lib/admin/social/email-digest-model";
import { renderEmailDigestHtml, renderEmailDigestText, UNSUBSCRIBE_PLACEHOLDER } from "../../lib/admin/social/email-digest-render";
import {
  buildWorkerJobPayload,
  claimWorkerJob,
  createMemoryEmailDigestStore,
  getEmailDigestWorkspace,
  getWorkerJobDetail,
  listDueWorkerJobIds,
  mutateEmailDigest,
  recordWorkerResult,
  retryWorkerJob,
  type EmailDigestSender,
} from "../../lib/admin/social/email-digest-service";
import { createMemoryNonceStore, signWorkerRequest, verifyWorkerRequest, WORKER_SIGNATURE_WINDOW_SECONDS } from "../../lib/admin/social/worker-signature";
import { isInternalServiceApiPath } from "../../lib/admin/host-routing";

const root = path.resolve(import.meta.dirname, "../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const directory = mkdtempSync(join(tmpdir(), "ccpun-email-digest-"));
const stub = join(directory, "empty.cjs");
writeFileSync(stub, "module.exports={};");
registerHooks({ resolve(specifier, context, next) { return specifier === "server-only" ? { url: pathToFileURL(stub).href, shortCircuit: true } : next(specifier, context); } });
after(() => rmSync(directory, { recursive: true, force: true }));

let dispatch: typeof import("../../lib/admin/social/social-worker-dispatch");
let neonStore: typeof import("../../lib/admin/social/email-digest-neon-store");
before(async () => {
  dispatch = await import("../../lib/admin/social/social-worker-dispatch");
  neonStore = await import("../../lib/admin/social/email-digest-neon-store");
});

const OWNER = "owner@example.test";
const ON = { [EMAIL_DIGEST_SEND_FLAG]: "1" };
const OFF = {};
const NOW = new Date("2026-10-25T03:00:00.000Z"); // 10:00 Bangkok
const DIGEST_ID = "email-digest:00000000-0000-4000-8000-000000000001";
const content = (patch: Partial<EmailDigestContent> = {}): EmailDigestContent => ({
  month: "2026-10",
  subject: "สรุปบทความเดือนตุลาคม",
  preheader: "ประกันสุขภาพและการวางแผนการเงิน",
  intro: "สวัสดีครับ เดือนนี้มีบทความใหม่ที่อยากชวนอ่าน",
  closing: null,
  articles: [
    { documentId: "article-health-1", title: "ประกันสุขภาพเลือกอย่างไร", canonicalUrl: "https://ccpun.com/blog/health-insurance/how-to-choose/" },
    { documentId: "article-ci-2", title: "โรคร้ายแรงกับเงินก้อน", canonicalUrl: "https://ccpun.com/blog/critical-illness-insurance/lump-sum/" },
  ],
  ...patch,
});
let counter = 0;
const key = (label = "key") => `test-${label}-${String(++counter).padStart(8, "0")}`;
const recordingSender = () => {
  const calls: string[] = [];
  const sender: EmailDigestSender = { async sendDigest({ jobId }) { calls.push(jobId); return { accepted: true, errorCode: null }; } };
  return { sender, calls };
};

async function scheduledDigest(env: Record<string, string> = ON) {
  const store = createMemoryEmailDigestStore();
  const { sender, calls } = recordingSender();
  const created = await mutateEmailDigest({ store, actor: OWNER, now: NOW, env, newDigestId: DIGEST_ID, mutation: { action: "create", idempotencyKey: key("create"), content: content() } });
  const reviewed = await mutateEmailDigest({ store, actor: OWNER, now: NOW, env, mutation: { action: "review", digestId: DIGEST_ID, expectedVersion: created.digest.version, idempotencyKey: key("review") } });
  const scheduled = await mutateEmailDigest({ store, actor: OWNER, now: NOW, env, sender, mutation: { action: "schedule", digestId: DIGEST_ID, expectedVersion: reviewed.digest.version, idempotencyKey: key("schedule"), scheduledAt: null, confirmation: EMAIL_DIGEST_SEND_CONFIRMATION } });
  const job = (await store.getJob(scheduled.digest.jobId!))!;
  return { store, calls, digest: scheduled.digest, job };
}

const code = (fn: () => Promise<unknown>, expected: string) => assert.rejects(fn, (error: unknown) => error instanceof EmailDigestError && error.code === expected);

// --- lifecycle ---------------------------------------------------------------------

test("digest lifecycle draft -> reviewed -> scheduled -> sent reuses review/schedule rules and edits invalidate review", async () => {
  const store = createMemoryEmailDigestStore();
  const created = await mutateEmailDigest({ store, actor: OWNER, now: NOW, env: ON, newDigestId: DIGEST_ID, mutation: { action: "create", idempotencyKey: key(), content: content() } });
  assert.equal(created.digest.status, "draft");
  const reviewed = await mutateEmailDigest({ store, actor: OWNER, now: NOW, env: ON, mutation: { action: "review", digestId: DIGEST_ID, expectedVersion: 1, idempotencyKey: key() } });
  assert.equal(reviewed.digest.status, "reviewed");
  assert.equal(reviewed.digest.reviewedContentVersion, 1);
  const edited = await mutateEmailDigest({ store, actor: OWNER, now: NOW, env: ON, mutation: { action: "update", digestId: DIGEST_ID, expectedVersion: 2, idempotencyKey: key(), content: content({ subject: "หัวเรื่องใหม่" }) } });
  assert.equal(edited.digest.status, "draft", "every editorial edit sends the digest back to draft");
  assert.equal(edited.digest.reviewedContentVersion, null);
  assert.equal(edited.digest.contentVersion, 2);
  await code(() => mutateEmailDigest({ store, actor: OWNER, now: NOW, env: ON, mutation: { action: "schedule", digestId: DIGEST_ID, expectedVersion: 3, idempotencyKey: key(), scheduledAt: null, confirmation: EMAIL_DIGEST_SEND_CONFIRMATION } }), "EMAIL_DIGEST_INVALID_TRANSITION");

  const { store: s2, digest, job } = await scheduledDigest();
  assert.equal(digest.status, "scheduled");
  assert.equal(job.status, "queued");
  assert.equal(job.objectVersion, digest.contentVersion);
  const claim = await claimWorkerJob({ store: s2, jobId: job.id, idempotencyKey: job.idempotencyKey, now: NOW });
  assert.equal(claim.state, "claimed");
  const result = await recordWorkerResult({ store: s2, now: NOW, result: { jobId: job.id, idempotencyKey: job.idempotencyKey, claimToken: claim.state === "claimed" ? claim.claimToken : "", outcome: "succeeded", externalIds: { campaign_id: "cmp_123" } } });
  assert.deepEqual(result, { state: "applied", status: "succeeded" });
  const sent = (await s2.getDigest(DIGEST_ID))!;
  assert.equal(sent.status, "sent");
  assert.ok(sent.sentAt);
  assert.equal(canTransitionEmailDigest("sent", "draft"), false);
  await code(() => mutateEmailDigest({ store: s2, actor: OWNER, now: NOW, env: ON, mutation: { action: "update", digestId: DIGEST_ID, expectedVersion: sent.version, idempotencyKey: key(), content: content() } }), "EMAIL_DIGEST_INVALID_TRANSITION");
});

test("incomplete digests cannot be reviewed; one active digest per month; cancel keeps the record", async () => {
  const store = createMemoryEmailDigestStore();
  await mutateEmailDigest({ store, actor: OWNER, now: NOW, env: OFF, newDigestId: DIGEST_ID, mutation: { action: "create", idempotencyKey: key(), content: content({ articles: [] }) } });
  await code(() => mutateEmailDigest({ store, actor: OWNER, now: NOW, env: OFF, mutation: { action: "review", digestId: DIGEST_ID, expectedVersion: 1, idempotencyKey: key() } }), "EMAIL_DIGEST_INCOMPLETE");
  await code(() => mutateEmailDigest({ store, actor: OWNER, now: NOW, env: OFF, newDigestId: "email-digest:00000000-0000-4000-8000-000000000002", mutation: { action: "create", idempotencyKey: key(), content: content() } }), "EMAIL_DIGEST_MONTH_TAKEN");
  const cancelled = await mutateEmailDigest({ store, actor: OWNER, now: NOW, env: OFF, mutation: { action: "cancel", digestId: DIGEST_ID, expectedVersion: 1, idempotencyKey: key() } });
  assert.equal(cancelled.digest.status, "cancelled");
  assert.ok(await store.getDigest(DIGEST_ID), "cancel never deletes");
  const again = await mutateEmailDigest({ store, actor: OWNER, now: NOW, env: OFF, newDigestId: "email-digest:00000000-0000-4000-8000-000000000003", mutation: { action: "create", idempotencyKey: key(), content: content() } });
  assert.equal(again.state, "applied", "a cancelled digest releases its month");
});

// --- RBAC / audit / idempotency ------------------------------------------------------------

test("RBAC: 401 without identity, 403 for non-owner or non-human mutations, owner allowed", () => {
  assert.deepEqual(authorizeEmailDigestActor(null, "read"), { allowed: false, status: 401, error: "unauthorized" });
  for (const role of ["editor", "seo-manager", "reviewer", "analyst", "viewer"]) {
    assert.equal(authorizeEmailDigestActor({ actorType: "human", role }, "read").allowed, false, role);
    assert.deepEqual(authorizeEmailDigestActor({ actorType: "human", role }, "mutate"), { allowed: false, status: 403, error: "forbidden" });
  }
  assert.deepEqual(authorizeEmailDigestActor({ actorType: "system", role: "owner" }, "mutate"), { allowed: false, status: 403, error: "forbidden" });
  assert.deepEqual(authorizeEmailDigestActor({ actorType: "human", role: "owner" }, "mutate"), { allowed: true });
  for (const file of [
    "apps/admin/app/api/admin/social/email-digests/route.ts",
    "apps/admin/app/api/admin/social/email-digests/preview/route.ts",
    "apps/admin/app/api/admin/social/worker-jobs/retry/route.ts",
  ]) {
    const source = read(file);
    assert.match(source, /export async function POST[\s\S]*requireEmailDigestActor\(request, "mutate"\)/, file);
  }
  assert.match(read("lib/admin/social/email-digest-http.ts"), /isSameOriginAdminMutation\(request\.url, request\.headers\.get\("origin"\)\)/);
  assert.match(read("features/admin/social/email-digest-page.tsx"), /requireAdminPermission\("social:read"\)/);
});

test("audit: one append-only row per state change with a hashed actor; replays add nothing", async () => {
  const { store } = await scheduledDigest();
  const audits = [...store.audits.values()];
  assert.deepEqual(audits.map((entry) => entry.action), ["email-digest:create", "email-digest:review", "email-digest:schedule"]);
  for (const entry of audits) {
    assert.equal(entry.actorRef, safeActorRef(OWNER));
    assert.match(entry.actorRef, /^admin:[a-f0-9]{32}$/);
    assert.equal(entry.objectType, "publication");
    assert.match(entry.id, /^audit:test-[a-z]+-\d{8}:email-digest:[a-z]+$/);
    assert.ok(!JSON.stringify(entry).includes(OWNER));
  }
});

test("idempotency: same key + payload replays, same key + other payload conflicts, stale version conflicts", async () => {
  const store = createMemoryEmailDigestStore();
  const idempotencyKey = key("create");
  const mutation = { action: "create" as const, idempotencyKey, content: content() };
  const first = await mutateEmailDigest({ store, actor: OWNER, now: NOW, env: OFF, newDigestId: DIGEST_ID, mutation });
  const replay = await mutateEmailDigest({ store, actor: OWNER, now: NOW, env: OFF, newDigestId: "email-digest:00000000-0000-4000-8000-000000000009", mutation });
  assert.equal(first.state, "applied");
  assert.equal(replay.state, "replay");
  assert.equal(replay.digest.id, DIGEST_ID);
  assert.equal(store.digests.size, 1);
  assert.equal(store.audits.size, 1);
  await code(() => mutateEmailDigest({ store, actor: OWNER, now: NOW, env: OFF, mutation: { ...mutation, content: content({ subject: "อื่น" }) } }), "EMAIL_DIGEST_IDEMPOTENCY_CONFLICT");
  await code(() => mutateEmailDigest({ store, actor: "someone-else@example.test", now: NOW, env: OFF, mutation }), "EMAIL_DIGEST_IDEMPOTENCY_CONFLICT");
  await mutateEmailDigest({ store, actor: OWNER, now: NOW, env: OFF, mutation: { action: "review", digestId: DIGEST_ID, expectedVersion: 1, idempotencyKey: key() } });
  await code(() => mutateEmailDigest({ store, actor: OWNER, now: NOW, env: OFF, mutation: { action: "cancel", digestId: DIGEST_ID, expectedVersion: 1, idempotencyKey: key() } }), "EMAIL_DIGEST_VERSION_CONFLICT");
});

// --- flag & confirmation ----------------------------------------------------------------------

test("flag off (default everywhere) blocks schedule/send and retry, keeps unschedule, and the sender stays disabled", async () => {
  const store = createMemoryEmailDigestStore();
  const { sender, calls } = recordingSender();
  await mutateEmailDigest({ store, actor: OWNER, now: NOW, env: OFF, newDigestId: DIGEST_ID, mutation: { action: "create", idempotencyKey: key(), content: content() } });
  await mutateEmailDigest({ store, actor: OWNER, now: NOW, env: OFF, mutation: { action: "review", digestId: DIGEST_ID, expectedVersion: 1, idempotencyKey: key() } });
  for (const env of [OFF, { [EMAIL_DIGEST_SEND_FLAG]: "0" }, { [EMAIL_DIGEST_SEND_FLAG]: "true" }]) {
    await code(() => mutateEmailDigest({ store, actor: OWNER, now: NOW, env, sender, mutation: { action: "schedule", digestId: DIGEST_ID, expectedVersion: 2, idempotencyKey: key(), scheduledAt: null, confirmation: EMAIL_DIGEST_SEND_CONFIRMATION } }), "EMAIL_DIGEST_SEND_DISABLED");
  }
  assert.equal(store.jobs.size, 0);
  assert.deepEqual(calls, []);
  await code(() => mutateEmailDigest({ store, actor: OWNER, now: NOW, env: ON, sender, mutation: { action: "schedule", digestId: DIGEST_ID, expectedVersion: 2, idempotencyKey: key(), scheduledAt: null, confirmation: "ok" } }), "EMAIL_DIGEST_CONFIRMATION_REQUIRED");

  const { store: s2, job, digest } = await scheduledDigest();
  await code(() => retryWorkerJob({ store: s2, actor: OWNER, now: NOW, env: OFF, request: { jobId: job.id, expectedVersion: job.version, idempotencyKey: key(), confirmation: EMAIL_DIGEST_SEND_CONFIRMATION } }), "EMAIL_DIGEST_SEND_DISABLED");
  const stopped = await mutateEmailDigest({ store: s2, actor: OWNER, now: NOW, env: OFF, mutation: { action: "unschedule", digestId: DIGEST_ID, expectedVersion: digest.version, idempotencyKey: key() } });
  assert.equal(stopped.digest.status, "reviewed");
  assert.equal((await s2.getJob(job.id))!.status, "cancelled");

  assert.equal(await dispatch.createEmailDigestSender(OFF).sendDigest({ jobId: job.id }).then((r) => r.accepted), false);
  const secret = "s".repeat(40);
  const noUrl = dispatch.createEmailDigestSender({ ...ON, CCPUN_SOCIAL_WORKER_HMAC_SECRET: secret });
  assert.deepEqual(await noUrl.sendDigest({ jobId: job.id }), { accepted: false, errorCode: "send-disabled" });
  const plainHttp = dispatch.createEmailDigestSender({ ...ON, CCPUN_SOCIAL_WORKER_HMAC_SECRET: secret, CCPUN_SOCIAL_WORKER_WEBHOOK_URL: "http://n8n.example.test/webhook" });
  assert.deepEqual(await plainHttp.sendDigest({ jobId: job.id }), { accepted: false, errorCode: "send-disabled" });
});

test("schedule time must be 5 minutes to 60 days ahead; null means as soon as the worker claims", async () => {
  const store = createMemoryEmailDigestStore();
  await mutateEmailDigest({ store, actor: OWNER, now: NOW, env: ON, newDigestId: DIGEST_ID, mutation: { action: "create", idempotencyKey: key(), content: content() } });
  await mutateEmailDigest({ store, actor: OWNER, now: NOW, env: ON, mutation: { action: "review", digestId: DIGEST_ID, expectedVersion: 1, idempotencyKey: key() } });
  for (const offset of [60_000, 61 * 24 * 60 * 60_000]) {
    await code(() => mutateEmailDigest({ store, actor: OWNER, now: NOW, env: ON, mutation: { action: "schedule", digestId: DIGEST_ID, expectedVersion: 2, idempotencyKey: key(), scheduledAt: new Date(NOW.getTime() + offset).toISOString(), confirmation: EMAIL_DIGEST_SEND_CONFIRMATION } }), "EMAIL_DIGEST_SCHEDULE_TIME_INVALID");
  }
  const later = new Date(NOW.getTime() + 2 * 60 * 60_000).toISOString();
  const scheduled = await mutateEmailDigest({ store, actor: OWNER, now: NOW, env: ON, mutation: { action: "schedule", digestId: DIGEST_ID, expectedVersion: 2, idempotencyKey: key(), scheduledAt: later, confirmation: EMAIL_DIGEST_SEND_CONFIRMATION } });
  const job = (await store.getJob(scheduled.digest.jobId!))!;
  assert.deepEqual(await listDueWorkerJobIds(store, NOW), []);
  assert.equal((await claimWorkerJob({ store, jobId: job.id, idempotencyKey: job.idempotencyKey, now: NOW })).state, "not-due");
  assert.deepEqual(await listDueWorkerJobIds(store, new Date(Date.parse(later))), [job.id]);
});

// --- auto-assemble month boundaries (Asia/Bangkok) -----------------------------------------------

test("auto-assemble uses the Asia/Bangkok calendar month, including year boundaries", () => {
  assert.deepEqual(bangkokMonthWindow("2026-10"), { startUtc: "2026-09-30T17:00:00.000Z", endUtc: "2026-10-31T17:00:00.000Z" });
  assert.deepEqual(bangkokMonthWindow("2026-12"), { startUtc: "2026-11-30T17:00:00.000Z", endUtc: "2026-12-31T17:00:00.000Z" });
  assert.deepEqual(bangkokMonthWindow("2027-01"), { startUtc: "2026-12-31T17:00:00.000Z", endUtc: "2027-01-31T17:00:00.000Z" });
  assert.equal(bangkokMonthOf(new Date("2026-10-31T16:59:59.999Z")), "2026-10");
  assert.equal(bangkokMonthOf(new Date("2026-10-31T17:00:00.000Z")), "2026-11");
  const candidate = (documentId: string, publishedAt: string, extra: Record<string, unknown> = {}) => ({
    documentId, title: `บทความ ${documentId}`, canonicalUrl: `https://ccpun.com/blog/health-insurance/${documentId}/`, publishedAt, ...extra,
  });
  const picked = assembleMonthArticles([
    candidate("late-sept-utc", "2026-09-30T16:59:59.999Z"),
    candidate("first-bkk-minute", "2026-09-30T17:00:00.000Z"),
    candidate("mid", "2026-10-15T05:00:00.000Z"),
    candidate("last-bkk-ms", "2026-10-31T16:59:59.999Z"),
    candidate("next-month", "2026-10-31T17:00:00.000Z"),
    candidate("drafts.mid-draft", "2026-10-10T05:00:00.000Z"),
    candidate("noindex", "2026-10-11T05:00:00.000Z", { noindex: true }),
    candidate("mid", "2026-10-15T05:00:00.000Z"),
    candidate("bad-url", "2026-10-12T05:00:00.000Z", { canonicalUrl: "https://example.com/x/" }),
  ], "2026-10");
  assert.deepEqual(picked.map((article) => article.documentId), ["first-bkk-minute", "mid", "last-bkk-ms"]);
  const many = Array.from({ length: 30 }, (_, index) => candidate(`a-${index}`, new Date(Date.parse("2026-10-01T00:00:00Z") + index * 3_600_000).toISOString()));
  assert.equal(assembleMonthArticles(many, "2026-10").length, 20);
  assert.throws(() => bangkokMonthWindow("2026-13"));
});

// --- preview -------------------------------------------------------------------------------------

test("preview is email-safe Thai HTML with the unsubscribe placeholder and sender identity, no tracking", () => {
  const html = renderEmailDigestHtml(content({ intro: "บรรทัดแรก & <script>alert(1)</script>\n\nย่อหน้าสอง", closing: "ขอบคุณครับ" }));
  assert.ok(html.includes(UNSUBSCRIBE_PLACEHOLDER));
  assert.ok(html.includes("ยกเลิกการรับอีเมล"));
  assert.ok(html.includes("ส่งโดย ประกันที่ปั้นเลือก กับ CCPun · ccpun.com"));
  assert.ok(html.includes('lang="th"'));
  assert.ok(html.includes("ตุลาคม 2569"));
  assert.ok(html.includes("#e0c985") && html.includes("#faf6f0"), "v5 palette");
  assert.doesNotMatch(html, /<img|<script|<iframe|utm_|pixel|track/i);
  assert.ok(html.includes("&lt;script&gt;"), "owner text is escaped");
  assert.ok(html.includes('href="https://ccpun.com/blog/health-insurance/how-to-choose/"'));
  const text = renderEmailDigestText(content());
  assert.ok(text.includes(UNSUBSCRIBE_PLACEHOLDER));
  assert.ok(text.includes("1. ประกันสุขภาพเลือกอย่างไร"));
});

// --- HMAC -------------------------------------------------------------------------------------------

test("worker signature: good, bad, expired, replayed, malformed, tampered and unconfigured requests", async () => {
  const secret = "x".repeat(48);
  const body = JSON.stringify({ jobId: "worker-job:" + "a".repeat(32), idempotencyKey: "email-digest:" + "b".repeat(48) });
  const path = "/api/internal/social/jobs/claim/";
  const headers = signWorkerRequest({ secret, method: "POST", path, body, now: NOW, nonce: "nonce_0000000000000001" });
  const verify = (overrides: Partial<Parameters<typeof verifyWorkerRequest>[0]> = {}, nonces = createMemoryNonceStore()) => verifyWorkerRequest({
    secret, method: "POST", path, body, headers: new Headers(headers), nonces, now: NOW, ...overrides,
  });
  const nonces = createMemoryNonceStore();
  assert.deepEqual(await verify({}, nonces), { ok: true });
  assert.deepEqual(await verify({}, nonces), { ok: false, reason: "replayed" });
  assert.deepEqual(await verify({ path: "/api/internal/social/jobs/claim" }), { ok: true }, "trailing slash is canonicalized");
  assert.deepEqual(await verify({ secret: "y".repeat(48) }), { ok: false, reason: "bad-signature" });
  assert.deepEqual(await verify({ body: body.replace("a", "c") }), { ok: false, reason: "bad-signature" });
  assert.deepEqual(await verify({ path: "/api/internal/social/jobs/result/" }), { ok: false, reason: "bad-signature" });
  assert.deepEqual(await verify({ method: "GET" }), { ok: false, reason: "bad-signature" });
  assert.deepEqual(await verify({ now: new Date(NOW.getTime() + (WORKER_SIGNATURE_WINDOW_SECONDS + 1) * 1000) }), { ok: false, reason: "expired" });
  assert.deepEqual(await verify({ now: new Date(NOW.getTime() - (WORKER_SIGNATURE_WINDOW_SECONDS + 1) * 1000) }), { ok: false, reason: "expired" });
  assert.deepEqual(await verify({ headers: new Headers({ ...headers, "x-ccpun-signature": "deadbeef" }) }), { ok: false, reason: "malformed" });
  assert.deepEqual(await verify({ headers: new Headers({ ...headers, "x-ccpun-nonce": "short" }) }), { ok: false, reason: "malformed" });
  assert.deepEqual(await verify({ secret: undefined }), { ok: false, reason: "not-configured" });
  assert.deepEqual(await verify({ secret: "too-short" }), { ok: false, reason: "not-configured" });
  const burnt = createMemoryNonceStore();
  await verify({ secret: "y".repeat(48) }, burnt);
  assert.equal(burnt.size(), 0, "a forged request cannot spend a nonce");
});

test("outbound webhook is signed, carries the job ID only and never calls a provider", async () => {
  const requests: Array<{ url: string; init: RequestInit }> = [];
  const fetcher = (async (url: URL | string, init?: RequestInit) => { requests.push({ url: String(url), init: init! }); return new Response(null, { status: 200 }); }) as typeof fetch;
  const secret = "z".repeat(40);
  const sender = dispatch.createEmailDigestSender({ ...ON, CCPUN_SOCIAL_WORKER_HMAC_SECRET: secret, CCPUN_SOCIAL_WORKER_WEBHOOK_URL: "https://n8n.example.test/webhook/ccpun-social-worker" }, fetcher);
  assert.deepEqual(await sender.sendDigest({ jobId: "worker-job:" + "1".repeat(32) }), { accepted: true, errorCode: null });
  assert.equal(requests.length, 1);
  assert.equal(requests[0]!.url, "https://n8n.example.test/webhook/ccpun-social-worker");
  assert.equal(requests[0]!.init.body, JSON.stringify({ jobId: "worker-job:" + "1".repeat(32) }));
  const headers = new Headers(requests[0]!.init.headers);
  assert.deepEqual(await verifyWorkerRequest({ secret, method: "POST", path: "/webhook/ccpun-social-worker", body: String(requests[0]!.init.body), headers, nonces: createMemoryNonceStore() }), { ok: true });
  for (const file of ["apps/admin/app/api/admin/social/email-digests/route.ts", "apps/admin/app/api/internal/social/jobs/claim/route.ts", "apps/admin/app/api/internal/social/jobs/result/route.ts", "apps/admin/app/api/internal/social/jobs/route.ts", "lib/admin/social/email-digest-service.ts", "lib/admin/social/email-digest-model.ts"]) {
    assert.doesNotMatch(read(file), /\bfetch\(|resend|sendgrid|mailgun|postmark|nodemailer|ses\./i, file);
  }
});

// --- outbox callbacks, timeouts, retries -------------------------------------------------------------

test("callbacks are idempotent by job + key + claim token; duplicates replay and late callbacks are no-ops", async () => {
  const { store, job } = await scheduledDigest();
  const claim = await claimWorkerJob({ store, jobId: job.id, idempotencyKey: job.idempotencyKey, now: NOW });
  assert.equal(claim.state, "claimed");
  const token = claim.state === "claimed" ? claim.claimToken : "";
  assert.equal((await claimWorkerJob({ store, jobId: job.id, idempotencyKey: job.idempotencyKey, now: NOW })).state, "not-claimable", "a claimed job is never claimed twice");
  assert.equal((await claimWorkerJob({ store, jobId: job.id, idempotencyKey: "email-digest:" + "f".repeat(48), now: NOW })).state, "unknown-job");
  const failed = { jobId: job.id, idempotencyKey: job.idempotencyKey, claimToken: token, outcome: "failed" as const, errorCode: "provider-rejected" };
  assert.deepEqual(await recordWorkerResult({ store, now: NOW, result: failed }), { state: "applied", status: "failed" });
  const auditCount = store.audits.size;
  assert.deepEqual(await recordWorkerResult({ store, now: NOW, result: failed }), { state: "replay", status: "failed" });
  assert.deepEqual(await recordWorkerResult({ store, now: NOW, result: { ...failed, outcome: "succeeded", errorCode: null } }), { state: "ignored", status: "failed" });
  assert.deepEqual(await recordWorkerResult({ store, now: NOW, result: { ...failed, idempotencyKey: "email-digest:" + "e".repeat(48) } }), { state: "ignored", status: "failed" });
  assert.equal(store.audits.size, auditCount, "no-ops never write");

  const retried = await retryWorkerJob({ store, actor: OWNER, now: NOW, env: ON, request: { jobId: job.id, expectedVersion: (await store.getJob(job.id))!.version, idempotencyKey: key("retry"), confirmation: EMAIL_DIGEST_SEND_CONFIRMATION } });
  assert.equal(retried.state, "requeued");
  const second = await claimWorkerJob({ store, jobId: job.id, idempotencyKey: job.idempotencyKey, now: NOW });
  assert.equal(second.state, "claimed");
  assert.deepEqual(await recordWorkerResult({ store, now: NOW, result: { ...failed, outcome: "succeeded", errorCode: null } }), { state: "ignored", status: "claimed" }, "late callback of attempt 1 cannot finish attempt 2");
  assert.deepEqual(await recordWorkerResult({ store, now: NOW, result: { jobId: job.id, idempotencyKey: job.idempotencyKey, claimToken: second.state === "claimed" ? second.claimToken : "", outcome: "succeeded" } }), { state: "applied", status: "succeeded" });
  assert.equal((await store.getDigest(DIGEST_ID))!.status, "sent");
});

test("a claim past its lease becomes needs_attention, is never auto-retried, and retry needs explicit acknowledgement", async () => {
  const { store, job } = await scheduledDigest();
  const claim = await claimWorkerJob({ store, jobId: job.id, idempotencyKey: job.idempotencyKey, now: NOW });
  assert.equal(claim.state, "claimed");
  const later = new Date(NOW.getTime() + WORKER_JOB_CLAIM_TIMEOUT_MS + 1);
  assert.equal(planClaimTimeouts([(await store.getJob(job.id))!], new Date(NOW.getTime() + 60_000)).length, 0);
  const workspace = await getEmailDigestWorkspace({ store, now: later, env: ON });
  const marked = workspace.jobs.find((item) => item.id === job.id)!;
  assert.equal(marked.status, "needs_attention");
  assert.equal(marked.lastErrorCode, "claim-timeout");
  assert.ok([...store.audits.values()].some((entry) => entry.action === "worker-job:claim-timeout" && entry.actorType === "system"));
  assert.deepEqual(await listDueWorkerJobIds(store, new Date(later.getTime() + 3_600_000)), [], "needs_attention is never handed out again automatically");
  assert.equal((await claimWorkerJob({ store, jobId: job.id, idempotencyKey: job.idempotencyKey, now: later })).state, "not-claimable");
  // An ambiguous worker error behaves the same way.
  const ambiguous = await recordWorkerResult({ store, now: later, result: { jobId: job.id, idempotencyKey: job.idempotencyKey, claimToken: claim.state === "claimed" ? claim.claimToken : "", outcome: "failed", errorCode: "timeout" } });
  assert.deepEqual(ambiguous, { state: "applied", status: "needs_attention" });
  const current = (await store.getJob(job.id))!;
  await code(() => retryWorkerJob({ store, actor: OWNER, now: later, env: ON, request: { jobId: job.id, expectedVersion: current.version, idempotencyKey: key(), confirmation: EMAIL_DIGEST_SEND_CONFIRMATION } }), "WORKER_JOB_AMBIGUOUS_ACK_REQUIRED");
  const { sender, calls } = recordingSender();
  const retryKey = key("retry");
  const request = { jobId: job.id, expectedVersion: current.version, idempotencyKey: retryKey, confirmation: EMAIL_DIGEST_SEND_CONFIRMATION, acknowledgeAmbiguous: true };
  const retried = await retryWorkerJob({ store, actor: OWNER, now: later, env: ON, sender, request });
  assert.equal(retried.state, "requeued");
  assert.deepEqual(calls, [job.id]);
  assert.equal((await retryWorkerJob({ store, actor: OWNER, now: later, env: ON, sender, request })).state, "replay");
  assert.deepEqual(calls, [job.id], "a replayed retry does not notify twice");
  const requeued = (await store.getJob(job.id))!;
  assert.equal(requeued.status, "queued");
  assert.equal(requeued.maxAttempts, 3);
  const renotify = await retryWorkerJob({ store, actor: OWNER, now: later, env: ON, sender, request: { jobId: job.id, expectedVersion: requeued.version, idempotencyKey: key("renotify"), confirmation: EMAIL_DIGEST_SEND_CONFIRMATION } });
  assert.equal(renotify.state, "renotify");
  assert.equal((await store.getJob(job.id))!.version, requeued.version, "re-notify changes no state, only audit");
});

test("unschedule refuses an in-flight claim and needs acknowledgement for an ambiguous job", async () => {
  const { store, job, digest } = await scheduledDigest();
  await claimWorkerJob({ store, jobId: job.id, idempotencyKey: job.idempotencyKey, now: NOW });
  await code(() => mutateEmailDigest({ store, actor: OWNER, now: NOW, env: ON, mutation: { action: "unschedule", digestId: DIGEST_ID, expectedVersion: digest.version, idempotencyKey: key() } }), "WORKER_JOB_IN_FLIGHT");
  await getEmailDigestWorkspace({ store, now: new Date(NOW.getTime() + WORKER_JOB_CLAIM_TIMEOUT_MS + 1) });
  await code(() => mutateEmailDigest({ store, actor: OWNER, now: NOW, env: ON, mutation: { action: "unschedule", digestId: DIGEST_ID, expectedVersion: digest.version, idempotencyKey: key() } }), "WORKER_JOB_AMBIGUOUS_ACK_REQUIRED");
  const done = await mutateEmailDigest({ store, actor: OWNER, now: NOW, env: ON, mutation: { action: "unschedule", digestId: DIGEST_ID, expectedVersion: digest.version, idempotencyKey: key(), acknowledgeAmbiguous: true } });
  assert.equal(done.digest.status, "reviewed");
  const again = await mutateEmailDigest({ store, actor: OWNER, now: NOW, env: ON, mutation: { action: "schedule", digestId: DIGEST_ID, expectedVersion: done.digest.version, idempotencyKey: key(), scheduledAt: null, confirmation: EMAIL_DIGEST_SEND_CONFIRMATION } });
  assert.equal(again.digest.status, "scheduled", "the same reviewed content can be scheduled again as a new job");
  assert.notEqual(again.digest.jobId, job.id);
  assert.equal((await store.getJob(job.id))!.status, "cancelled");
});

// --- payload hygiene -----------------------------------------------------------------------------------

test("job rows, webhook body and pull payloads carry no secrets and no personal data", async () => {
  const secret = "q".repeat(48);
  const { store, job, digest } = await scheduledDigest({ ...ON, CCPUN_SOCIAL_WORKER_HMAC_SECRET: secret });
  const payload = await getWorkerJobDetail(store, job.id, NOW);
  assert.ok(payload);
  const serialized = [JSON.stringify(payload), JSON.stringify(job), dispatch.workerWebhookBody(job.id)];
  for (const text of serialized) {
    assert.ok(!text.includes(secret));
    assert.ok(!text.includes(OWNER));
    assert.ok(!text.includes(safeActorRef(OWNER)), "no actor identity");
    assert.doesNotMatch(text, /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/, "no e-mail addresses");
    assert.doesNotMatch(text, /"(secret|token|password|apiKey|accessToken|recipients?|phone|email_address)"\s*:/i);
  }
  assert.deepEqual(JSON.parse(dispatch.workerWebhookBody(job.id)), { jobId: job.id });
  assert.deepEqual(Object.keys(job).sort(), ["action", "attempts", "channel", "claimExpiresAt", "claimToken", "claimedAt", "completedAt", "createdAt", "externalIds", "id", "idempotencyKey", "lastErrorCode", "maxAttempts", "objectId", "objectVersion", "receipts", "scheduledAt", "status", "updatedAt", "version"]);
  assert.equal(payload!.email.audience, "email-digest-subscribers");
  assert.ok(payload!.email.html.includes(UNSUBSCRIBE_PLACEHOLDER));
  assert.deepEqual(payload, buildWorkerJobPayload(job, digest));
  const workspace = await getEmailDigestWorkspace({ store, now: NOW });
  assert.ok(!JSON.stringify(workspace).includes("receipts"));
  assert.ok(!JSON.stringify(workspace).includes(safeActorRef(OWNER)));
  // A job whose digest changed after approval is never handed to the worker.
  const changed = { ...(await store.getDigest(DIGEST_ID))!, contentVersion: 99 };
  store.digests.set(DIGEST_ID, changed);
  assert.equal(await getWorkerJobDetail(store, job.id, NOW), null);
  assert.equal((await claimWorkerJob({ store, jobId: job.id, idempotencyKey: job.idempotencyKey, now: NOW })).state, "not-claimable");
});

// --- persistence contract ---------------------------------------------------------------------------------

test("migration is UAT-only, additive, checksum-pinned, append-only for audit and grants no DELETE", () => {
  const migration = read(neonStore.EMAIL_DIGEST_MIGRATION_FILE);
  const body = migration.split("-- checksum-source-begin\n")[1]?.split("-- checksum-source-end")[0];
  assert.ok(body);
  assert.equal(neonStore.EMAIL_DIGEST_MIGRATION_CHECKSUM, "sha256:" + createHash("sha256").update(body).digest("hex"));
  assert.equal(migration.split(neonStore.EMAIL_DIGEST_MIGRATION_CHECKSUM.slice(7)).length, 3, "guard and ledger pin the same checksum");
  assert.match(migration, /project_id='young-term-47483330'/);
  assert.doesNotMatch(migration, /lively-bar|br-long-resonance|ep-broad-butterfly|kyfxgjnq/, "no Production identity");
  assert.doesNotMatch(body, /GRANT[^;]*DELETE|TRUNCATE|DROP |ALTER TABLE ccpun_social\.social_(publication|execution_audit)|CREATE TRIGGER/i);
  assert.doesNotMatch(body, /social_execution_audit/, "the existing audit table and its grants are untouched");
  const readback = read("db/migrations/20261025_social_email_digest_v1_uat_readback.sql");
  assert.ok(readback.includes(neonStore.EMAIL_DIGEST_MIGRATION_CHECKSUM));
  assert.match(readback, /^BEGIN READ ONLY;/);
});

test("Neon writes are one statement with CAS on every version, INSERT-only audit and a partial-write abort", async () => {
  const { store } = await scheduledDigest();
  const createPlan = (await import("../../lib/admin/social/email-digest-model")).planEmailDigestMutation({
    mutation: { action: "create", idempotencyKey: key(), content: content({ month: "2026-11" }) },
    actorRef: safeActorRef(OWNER), current: null, currentJob: null, now: NOW, sendEnabled: false,
    newDigestId: "email-digest:00000000-0000-4000-8000-000000000004",
  });
  const create = neonStore.digestPlanStatement(createPlan);
  assert.match(create.text, /INSERT INTO ccpun_social\.social_email_digest SELECT \* FROM jsonb_populate_record[\s\S]*ON CONFLICT DO NOTHING/);
  assert.match(create.text, /INSERT INTO ccpun_social\.social_execution_audit/);
  assert.match(create.text, /social_require_write/);
  assert.doesNotMatch(create.text, /DELETE|UPDATE ccpun_social\.social_execution_audit/);
  const digest = (await store.getDigest(DIGEST_ID))!;
  const jobPlan = planClaimTimeouts([{ ...(await store.getJob(digest.jobId!))!, status: "claimed", claimToken: "a".repeat(32), claimExpiresAt: NOW.toISOString() }], NOW)[0]!;
  const statement = neonStore.jobPlanStatement(jobPlan);
  assert.match(statement.text, /WHERE id=\$2 AND version=\$3/);
  assert.equal(statement.params[2], jobPlan.expectedVersion);
  assert.ok(!JSON.stringify(statement.params).includes(OWNER));
});

test("host routing admits exactly the worker prefix as an internal service path", () => {
  for (const value of ["/api/internal/social/jobs", "/api/internal/social/jobs/", "/api/internal/social/jobs/claim/", "/api/internal/social/jobs/result"]) {
    assert.equal(isInternalServiceApiPath(value), true, value);
  }
  for (const value of ["/api/internal/social", "/api/internal/social/jobsx", "/api/internal/social/worker", "/api/admin/social/email-digests/"]) {
    assert.equal(isInternalServiceApiPath(value), false, value);
  }
  for (const file of ["apps/admin/app/api/internal/social/jobs/route.ts", "apps/admin/app/api/internal/social/jobs/claim/route.ts", "apps/admin/app/api/internal/social/jobs/result/route.ts"]) {
    assert.match(read(file), /authenticateWorkerRequest\(request, (""|body)\)/, file);
  }
  assert.match(read("lib/admin/social/worker-http.ts"), /if \(!isEmailDigestSendEnabled\(\) \|\| !process\.env\[WORKER_HMAC_SECRET_ENV\]\)[\s\S]*status: 404/);
});
