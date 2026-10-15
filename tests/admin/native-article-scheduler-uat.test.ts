import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createNativeArticleScheduleClock, getArticleScheduleBackend, isArticleScheduleExecutionEnabled } from "../../lib/admin/article-schedule-clock";
import { resolveArticleSchedulerLane, type ArticleScheduleRow } from "../../lib/admin/operations/article-schedule-contract";
import type { NativeScheduleStore } from "../../lib/admin/operations/article-schedule-store";
import { executeArticleSchedule } from "../../lib/admin/article-schedule-executor";
import type { PublishableArticle } from "../../cms/sanity/policy/article-publication";

// Hostinger-only opt-in. Credentials enter through the reviewed protected
// launcher environment, never argv/fixtures/ledger/output. No Sanity client is
// imported. These fixtures do not prove authenticated HTTP or real CMS reads.
const repository = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const enabled = process.env.CCPUN_NATIVE_ARTICLE_SCHEDULER_UAT_TEST === "1";
const worker = process.env.CCPUN_NATIVE_ARTICLE_SCHEDULER_UAT_WORKER;
const actor = "native-neon-fixture@example.invalid";
const allowed = new Set(["PATH", "NODE_ENV", "NODE_TEST_CONTEXT", "TZ", "LANG", "LC_ALL", "TMPDIR",
  "CCPUN_NATIVE_ARTICLE_SCHEDULER_UAT_TEST", "CCPUN_NATIVE_ARTICLE_SCHEDULER_UAT_WORKER",
  "CCPUN_DEPLOYMENT_PROVIDER", "CCPUN_DEPLOYMENT_ROLE", "CCPUN_APP_ENV", "CCPUN_ADMIN_CAPABILITY_PROFILE",
  "NEXT_PUBLIC_CCPUN_ADMIN_CAPABILITY_PROFILE", "CCPUN_ARTICLE_SCHEDULER_BACKEND", "NEXT_PUBLIC_CCPUN_ARTICLE_SCHEDULER_BACKEND",
  "CCPUN_GIT_SHA", "CCPUN_GIT_REF", "CCPUN_RELEASE_ID", "NEXT_PUBLIC_CCPUN_GIT_SHA", "NEXT_PUBLIC_CCPUN_GIT_REF", "NEXT_PUBLIC_CCPUN_RELEASE_ID",
  "NEXT_PUBLIC_SANITY_PROJECT_ID", "NEXT_PUBLIC_SANITY_DATASET", "CCPUN_NEON_PROJECT_ID", "CCPUN_NEON_BRANCH_ID", "CCPUN_NEON_DATABASE",
  "CCPUN_ADMIN_DATABASE_URL", "CCPUN_ARTICLE_SCHEDULING_ENABLED", "CCPUN_NATIVE_WORKFLOW_ENABLED",
  "CCPUN_ARTICLE_SCHEDULE_EXECUTION_PLANE", "CCPUN_ARTICLE_SCHEDULE_EXECUTOR_ENABLED"]);
type GuardCode = "TARGET_DENIED" | "AMBIENT_ENV_DENIED" | "ENV_FILE_DENIED" | "UAT_BINDING_DENIED"
  | "DSN_POLICY_DENIED" | "SOURCE_DENIED" | "DURABLE_IDENTITY_DENIED" | "FIXTURE_ARGUMENT_DENIED"
  | "FIXTURE_CLAIM_DENIED" | "OWNERSHIP_DENIED" | "FIXTURE_STATE_DENIED" | "CMS_WRITE_DENIED"
  | "FIXTURE_EXECUTION_DENIED" | "CHILD_FAILED" | "CLOCK_DENIED" | "DUE_TIMEOUT";
class UatGuardError extends Error {
  constructor(readonly code: GuardCode) { super(code); }
}
// Only this harness's closed literal codes may reach output. Never forward a
// provider/parser/assertion error's message, stack, connection or actual value.
function diagnosticCode(error: unknown): GuardCode | "UNCLASSIFIED" {
  return error instanceof UatGuardError ? error.code : "UNCLASSIFIED";
}
function deny(code: GuardCode): never { throw new UatGuardError(code); }
function preflight() {
  if (!enabled || process.platform !== "linux" || process.versions.node.split(".")[0] !== "24") deny("TARGET_DENIED");
  if (Object.keys(process.env).some((key) => !allowed.has(key))
    || ![undefined, "child-v8"].includes(process.env.NODE_TEST_CONTEXT)) deny("AMBIENT_ENV_DENIED");
  for (const directory of new Set([repository, process.cwd()])) {
    if (readdirSync(directory).some((name) => /^\.env/i.test(name))) deny("ENV_FILE_DENIED");
  }
  if (process.env.CCPUN_APP_ENV !== "admin-uat" || resolveArticleSchedulerLane() !== "uat"
    || getArticleScheduleBackend() !== "native-neon" || process.env.CCPUN_ARTICLE_SCHEDULING_ENABLED !== "1"
    || process.env.CCPUN_ARTICLE_SCHEDULE_EXECUTION_PLANE !== "vps" || process.env.CCPUN_ARTICLE_SCHEDULE_EXECUTOR_ENABLED !== "1"
    || process.env.CCPUN_NATIVE_WORKFLOW_ENABLED !== "0" || !isArticleScheduleExecutionEnabled()) deny("UAT_BINDING_DENIED");
  // Existing resolver plus stricter URI policy: no duplicate or unexpected
  // options, pooling host allowed, no credentials/default connection fallback.
  const url = new URL(process.env.CCPUN_ADMIN_DATABASE_URL!);
  const options = [...url.searchParams];
  if (url.searchParams.getAll("sslmode").length !== 1 || url.searchParams.get("sslmode") !== "require"
    || url.searchParams.getAll("channel_binding").length > 1
    || options.some(([key, value]) => (key !== "sslmode" && key !== "channel_binding") || value !== "require")
    || /[\u0000-\u0020\u007f]/.test(decodeURIComponent(url.username)) || !url.password) deny("DSN_POLICY_DENIED");
  const git = (args: string[]) => {
    const result = spawnSync("git", args, { cwd: repository, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    if (result.status !== 0 || result.error) deny("SOURCE_DENIED"); return result.stdout.trim();
  };
  if (git(["rev-parse", "HEAD"]) !== process.env.CCPUN_GIT_SHA
    || git(["rev-parse", "--verify", `${process.env.CCPUN_GIT_REF}^{commit}`]) !== process.env.CCPUN_GIT_SHA
    || git(["status", "--porcelain", "--untracked-files=no"])) deny("SOURCE_DENIED");
}
async function open() {
  preflight();
  // The adapter's first query verifies actual database/user/UAT identity,
  // migration checksum and validate-only mode before any fixture mutation.
  const { openArticleScheduleStore } = await import("../../lib/admin/operations/article-schedule-store");
  const store = await openArticleScheduleStore();
  if (!store.enabled || store.mode !== "validate-only") deny("DURABLE_IDENTITY_DENIED");
  return store;
}
function fakePair(row: ArticleScheduleRow) {
  const draft: PublishableArticle = { _id: `drafts.${row.article_id}`, _type: "article", _rev: row.draft_revision,
    _createdAt: "2026-01-01T00:00:00Z", _updatedAt: "2026-01-01T00:00:00Z", title: "Synthetic UAT only", excerpt: "Synthetic",
    slug: { current: row.article_id }, body: [{ _type: "block", _key: "fixture", children: [{ _type: "span", text: "Synthetic only" }] }],
    author: { _type: "reference", _ref: "fixture-author" }, category: { _type: "reference", _ref: "fixture-category" }, seo: {}, review: { status: "approved" } };
  return { draft, published: null };
}
type Owned = { articleId: string; generation: string; executionId?: string };
function ownedFromArgument(): Owned[] {
  const parsed: unknown = JSON.parse(process.argv[2] ?? "null");
  if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 5) deny("FIXTURE_ARGUMENT_DENIED");
  for (const item of parsed) {
    if (!item || typeof item !== "object" || !/^native-neon-uat-[a-f0-9-]{36}$/.test(item.articleId)
      || !/^[a-f0-9-]{36}$/.test(item.generation) || (item.executionId !== undefined && !/^[a-f0-9-]{36}$/.test(item.executionId))
      || Object.keys(item).some((key) => !["articleId", "generation", "executionId"].includes(key))) deny("FIXTURE_ARGUMENT_DENIED");
  }
  return parsed as Owned[];
}
function createReadOnlyPollClock(listDue: () => Promise<{ articleId: string; generation: string }[]>) {
  return createNativeArticleScheduleClock({
    enabled: () => true,
    listDue,
    execute: async () => deny("FIXTURE_EXECUTION_DENIED"),
  });
}
async function child() {
  if (worker === "poll") {
    const store = await open();
    const clock = createReadOnlyPollClock(() => store.listNativeDue(10));
    try {
      const tick = await clock.tick();
      if (tick.failed !== tick.attempted) deny("FIXTURE_EXECUTION_DENIED");
      return { polled: true, dueObserved: tick.attempted > 0, executionPathBlocked: true };
    } finally { await clock.close(); }
  }
  const owned = ownedFromArgument(); const store = await open();
  if (worker === "claim") {
    if (owned.length !== 1 || !owned[0].executionId) deny("FIXTURE_ARGUMENT_DENIED");
    const row = await store.claim(owned[0].articleId, owned[0].generation, owned[0].executionId);
    if (!row || row.status !== "executing") deny("FIXTURE_CLAIM_DENIED");
    return { claimed: true };
  }
  if (worker !== "scan") deny("FIXTURE_ARGUMENT_DENIED");
  let unrelatedObserved = false; let publishedCalls = 0; let executed = 0;
  const clock = createNativeArticleScheduleClock({ enabled: () => true,
    listDue: async () => {
      const due = await store.listNativeDue(10);
      unrelatedObserved = due.some((item) => !owned.some((entry) => entry.articleId === item.articleId && entry.generation === item.generation));
      // Never read/execute/claim non-ledger rows. Only an aggregate boolean
      // survives observation of the scheduler's intended bounded ID query.
      return due.filter((item) => owned.some((entry) => entry.articleId === item.articleId && entry.generation === item.generation));
    },
    execute: async (input) => {
      if (!owned.some((item) => item.articleId === input.articleId && item.generation === input.generation)) deny("OWNERSHIP_DENIED");
      const row = await store.read(input.articleId); if (!row || row.generation !== input.generation) deny("FIXTURE_STATE_DENIED");
      const result = await executeArticleSchedule({ store, ownerAllowed: (value) => value === actor,
        readArticle: async () => fakePair(row), publish: async () => { publishedCalls++; return deny("CMS_WRITE_DENIED"); } }, input);
      if (result.status !== "validated") deny("FIXTURE_EXECUTION_DENIED"); executed++;
    },
  });
  try {
    const tick = await clock.tick();
    if (tick.failed || publishedCalls) deny("FIXTURE_EXECUTION_DENIED");
    return { executed, publishedCalls, unrelatedObserved };
  } finally { await clock.close(); }
}
async function runChildMode() {
  try { console.log(`NATIVE_UAT_RESULT=${JSON.stringify(await child())}`); }
  catch (error) { console.log(`NATIVE_UAT_RESULT=${JSON.stringify({ failed: true, code: diagnosticCode(error) })}`); process.exitCode = 1; }
}
if (worker) void runChildMode();

test("read-only scheduler poll observes due work without a writable executor", async () => {
  const clock = createReadOnlyPollClock(async () => [{ articleId: "synthetic", generation: "00000000-0000-4000-8000-000000000000" }]);
  const tick = await clock.tick();
  await clock.close();
  assert.deepEqual(tick, { attempted: 1, failed: 1 });
});

test("actual Hostinger UAT native registration/CAS/due/cancel and restarted claim exclusion", { skip: !enabled || Boolean(worker), timeout: 240_000 }, async () => {
  let phase = "preflight"; let store: NativeScheduleStore | undefined;
  let ledgerPath: string | undefined; const owned: Owned[] = []; const generationLedger = new Map<string, string[]>();
  let cleanupIncomplete = false; let verified = false;
  const save = () => { if (ledgerPath) writeFileSync(ledgerPath, JSON.stringify({ version: 1, sourceSha: process.env.CCPUN_GIT_SHA,
    lane: "uat", mode: "validate-only", phase, verified, cleanupIncomplete, owned, generationLedger: Object.fromEntries(generationLedger) }, null, 2) + "\n", { mode: 0o600 }); };
  const runChild = (mode: "claim" | "scan", fixtures: Owned[]) => {
    // Node --test injects this exact marker (Node24 runner.js). Raw worker
    // children must not inherit its binary test-report serialization context.
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => allowed.has(key) && key !== "NODE_TEST_CONTEXT"));
    const result = spawnSync(process.execPath, ["--conditions=react-server", "--import", "tsx", fileURLToPath(import.meta.url), JSON.stringify(fixtures)],
      { cwd: repository, env: { ...env, NODE_ENV: "test", CCPUN_NATIVE_ARTICLE_SCHEDULER_UAT_WORKER: mode }, encoding: "utf8", timeout: 60_000 });
    const line = result.stdout?.split("\n").find((value) => value.startsWith("NATIVE_UAT_RESULT="));
    if (result.status !== 0 || !line) deny("CHILD_FAILED");
    const receipt = JSON.parse(line.slice("NATIVE_UAT_RESULT=".length)); if (receipt.failed) deny("CHILD_FAILED"); return receipt;
  };
  try {
    store = await open();
    const directory = mkdtempSync(join(tmpdir(), "ccpun-native-neon-uat-")); ledgerPath = join(directory, "owned-ledger.json"); save();
    console.log(`NATIVE_UAT_LEDGER=${ledgerPath}`);
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(process.env.CCPUN_ADMIN_DATABASE_URL!);
    const dbNow = async () => {
      const rows = await sql.query("SELECT clock_timestamp() AS db_now");
      if (rows.length !== 1 || !Number.isFinite(Date.parse(rows[0].db_now))) deny("CLOCK_DENIED");
      return Date.parse(rows[0].db_now);
    };
    async function prepare(entry: Owned, previous?: ArticleScheduleRow) {
      if (!store) deny("FIXTURE_STATE_DENIED"); phase = "prepare";
      const generations = generationLedger.get(entry.articleId) ?? [];
      if (!generations.includes(entry.generation)) generations.push(entry.generation);
      generationLedger.set(entry.articleId, generations); save();
      const row = await store.prepare({ articleId: entry.articleId, generation: entry.generation, draftRevision: "fixture-revision",
        publishedRevision: null, scheduledAt: new Date(await dbNow() + 45_000).toISOString(), actor,
        expectedGeneration: previous?.generation ?? null, expectedVersion: previous?.row_version ?? 0 });
      assert.ok(row); assert.equal(row.mode, "validate-only"); assert.equal(row.status, "preparing"); return row;
    }
    for (let index = 0; index < 5; index++) { owned.push({ articleId: `native-neon-uat-${randomUUID()}`, generation: randomUUID() }); save(); await prepare(owned[index]); }
    phase = "ack"; save();
    for (const entry of owned.slice(0, 4)) {
      assert.equal(await store.registerNative(entry.articleId, randomUUID()), null);
      const row = await store.registerNative(entry.articleId, entry.generation); assert.ok(row);
      assert.equal(row.workflow_run_id, `native-neon:${entry.generation}`); assert.equal(await store.registerNative(entry.articleId, entry.generation), null);
    }
    // An owned legacy receipt is never taken over by the native scan.
    assert.ok(await store.acknowledge(owned[4].articleId, owned[4].generation, "fixture-legacy-sdk-registration"));
    phase = "cancel-generation"; save();
    const cancel = await store.read(owned[3].articleId); assert.ok(cancel);
    assert.equal(await store.cancel(cancel.article_id, cancel.generation, cancel.row_version + 1, actor), null);
    assert.ok(await store.cancel(cancel.article_id, cancel.generation, cancel.row_version, actor));
    const old = await store.read(owned[2].articleId); assert.ok(old);
    assert.ok(await store.cancel(old.article_id, old.generation, old.row_version, actor));
    const cancelled = await store.read(old.article_id); assert.ok(cancelled);
    const previousGeneration = owned[2].generation; owned[2].generation = randomUUID(); save();
    await prepare(owned[2], cancelled); assert.ok(await store.registerNative(owned[2].articleId, owned[2].generation));
    assert.equal(await store.claim(owned[2].articleId, previousGeneration, randomUUID()), null);
    assert.equal(await store.registerNative(owned[2].articleId, previousGeneration), null);
    phase = "wait-db-due"; save();
    const targets = await Promise.all(owned.slice(0, 3).map((entry) => store!.read(entry.articleId)));
    const dueAt = Math.max(...targets.map((row) => { assert.ok(row); return Date.parse(row.scheduled_at); }));
    const deadline = Date.now() + 80_000;
    while (await dbNow() < dueAt) { if (Date.now() > deadline) deny("DUE_TIMEOUT"); await new Promise((done) => setTimeout(done, 1_000)); }
    phase = "claim-exit"; owned[0].executionId = randomUUID(); save();
    assert.equal(runChild("claim", [owned[0]]).claimed, true);
    const retained = await store.read(owned[0].articleId); assert.ok(retained); assert.equal(retained.status, "executing");
    phase = "fresh-process-clock"; save();
    const receipt = runChild("scan", owned); assert.equal(receipt.executed, 2); assert.equal(receipt.publishedCalls, 0);
    const repeat = runChild("scan", owned); assert.equal(repeat.executed, 0); assert.equal(repeat.publishedCalls, 0);
    assert.equal(typeof receipt.unrelatedObserved, "boolean");
    store = await open();
    assert.equal((await store.read(owned[0].articleId))?.execution_id, owned[0].executionId);
    assert.equal((await store.read(owned[0].articleId))?.status, "executing");
    for (const entry of owned.slice(1, 3)) assert.equal((await store.read(entry.articleId))?.status, "validated");
    assert.equal((await store.read(owned[3].articleId))?.status, "cancelled");
    assert.equal((await store.read(owned[4].articleId))?.status, "scheduled");
    phase = "verified"; verified = true; save();
  } catch (error) { throw new Error(`NATIVE_NEON_UAT_FAILED phase=${phase} code=${diagnosticCode(error)}`); }
  finally {
    phase = "cleanup";
    if (store) for (const entry of owned) {
      try {
        const row = await store.read(entry.articleId); if (!row) continue;
        if (!generationLedger.get(entry.articleId)?.includes(row.generation)) { cleanupIncomplete = true; continue; }
        if (["preparing", "scheduled"].includes(row.status)) {
          if (!await store.cancel(row.article_id, row.generation, row.row_version, actor)) cleanupIncomplete = true;
        } else if (row.status === "executing") {
          // Only this intentionally abandoned synthetic claim is terminalized.
          // Never finish/reclaim a different executor or any uncertain CMS job.
          if (entry.executionId !== row.execution_id) { cleanupIncomplete = true; continue; }
          await store.finish(row, "failed", "UAT_FIXTURE_NO_EXTERNAL_WRITE");
        }
      } catch { cleanupIncomplete = true; }
    }
    save(); if (cleanupIncomplete) throw new Error("NATIVE_NEON_UAT_CLEANUP_INCOMPLETE owned-ledger-retained");
  }
});
