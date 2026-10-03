import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { build } from "esbuild";
import { createNativeArticleScheduleClock, getArticleScheduleBackend, isArticleScheduleExecutionEnabled } from "../../lib/admin/article-schedule-clock";
import { SCHEDULER_LANES } from "../../lib/admin/operations/article-schedule-contract";
import { ACK_NATIVE_ARTICLE_DISPATCH, READ_NATIVE_DUE_ARTICLE_SCHEDULES } from "../../lib/admin/operations/article-schedule-sql";
import { ARTICLE_SCHEDULER_CHECKSUM, ARTICLE_SCHEDULER_MIGRATION } from "../../db/migrations/20260911_article_scheduling_v1";

// Execute this synthetic suite on the authorized Hostinger lab, alongside the
// unchanged article-schedule-executor suite. No ambient DB/CMS connection is
// used. Real UAT SQL + compiled HTTP/restart acceptance remains a separate gate.
const sha = "a".repeat(40);
function variables(): Record<string, string | undefined> {
  const lane = SCHEDULER_LANES.uat;
  return {
    CCPUN_ARTICLE_SCHEDULER_BACKEND: "native-neon", NEXT_PUBLIC_CCPUN_ARTICLE_SCHEDULER_BACKEND: "native-neon",
    CCPUN_DEPLOYMENT_PROVIDER: "hostinger", CCPUN_DEPLOYMENT_ROLE: "admin", CCPUN_APP_ENV: "admin-uat",
    CCPUN_ADMIN_CAPABILITY_PROFILE: "full", NEXT_PUBLIC_CCPUN_ADMIN_CAPABILITY_PROFILE: "full",
    CCPUN_GIT_SHA: sha, NEXT_PUBLIC_CCPUN_GIT_SHA: sha,
    CCPUN_GIT_REF: "codex/native-neon-fixture", NEXT_PUBLIC_CCPUN_GIT_REF: "codex/native-neon-fixture",
    CCPUN_RELEASE_ID: "native-neon-fixture", NEXT_PUBLIC_CCPUN_RELEASE_ID: "native-neon-fixture",
    NEXT_PUBLIC_SANITY_PROJECT_ID: lane.sanityProjectId, NEXT_PUBLIC_SANITY_DATASET: lane.dataset,
    CCPUN_NEON_PROJECT_ID: lane.projectId, CCPUN_NEON_BRANCH_ID: lane.branchId, CCPUN_NEON_DATABASE: "neondb",
    CCPUN_ADMIN_DATABASE_URL: `postgresql://ccpun_admin_runtime:FIXTURE_ONLY@${lane.endpointId}.${lane.hostSuffix}/neondb?sslmode=require`,
  };
}

test("native registration requires sealed Hostinger full identity and the existing exact UAT lane", () => {
  const values = variables();
  assert.equal(getArticleScheduleBackend(values), "native-neon");
  for (const change of [
    { CCPUN_ARTICLE_SCHEDULER_BACKEND: undefined }, { NEXT_PUBLIC_CCPUN_ARTICLE_SCHEDULER_BACKEND: undefined },
    { CCPUN_DEPLOYMENT_PROVIDER: "vercel" }, { CCPUN_DEPLOYMENT_ROLE: "web" }, { CCPUN_APP_ENV: "production-admin" },
    { CCPUN_ADMIN_CAPABILITY_PROFILE: "editorial" }, { NEXT_PUBLIC_CCPUN_ADMIN_CAPABILITY_PROFILE: "editorial" },
    { CCPUN_GIT_SHA: "b".repeat(40) }, { NEXT_PUBLIC_CCPUN_GIT_SHA: "bad" }, { CCPUN_GIT_REF: "wrong" },
    { CCPUN_RELEASE_ID: "wrong" }, { CCPUN_NEON_BRANCH_ID: "wrong" }, { CCPUN_NEON_PROJECT_ID: "wrong" },
    { NEXT_PUBLIC_SANITY_PROJECT_ID: "wrong" }, { NEXT_PUBLIC_SANITY_DATASET: "production" },
    { CCPUN_ADMIN_DATABASE_URL: undefined }, { CCPUN_NATIVE_WORKFLOW_ENABLED: "1" }, { VERCEL_PROJECT_ID: "conflict" },
  ]) assert.equal(getArticleScheduleBackend({ ...values, ...change }), "disabled");
  // Execution flags remain separate so reads/cancel retain their existing behavior.
  assert.equal(getArticleScheduleBackend({ ...values, CCPUN_ARTICLE_SCHEDULING_ENABLED: "0" }), "native-neon");
  assert.equal(getArticleScheduleBackend({ CCPUN_DEPLOYMENT_PROVIDER: "vercel" }), "workflow");
  assert.equal(getArticleScheduleBackend({ CCPUN_DEPLOYMENT_PROVIDER: "hostinger" }), "disabled");
});

test("native execution requires the explicit private VPS plane independently of Cloud producer activation", () => {
  const producer = { ...variables(), CCPUN_ARTICLE_SCHEDULING_ENABLED: "1", CCPUN_NATIVE_WORKFLOW_ENABLED: "0" };
  assert.equal(getArticleScheduleBackend(producer), "native-neon");
  assert.equal(isArticleScheduleExecutionEnabled(producer), false);
  const worker = { ...producer, CCPUN_ARTICLE_SCHEDULE_EXECUTION_PLANE: "vps", CCPUN_ARTICLE_SCHEDULE_EXECUTOR_ENABLED: "1" };
  assert.equal(isArticleScheduleExecutionEnabled(worker), true);
  for (const change of [{ CCPUN_ARTICLE_SCHEDULE_EXECUTION_PLANE: "cloud" }, { CCPUN_ARTICLE_SCHEDULE_EXECUTOR_ENABLED: "0" },
    { CCPUN_ARTICLE_SCHEDULING_ENABLED: "0" }, { NEXT_RUNTIME: "nodejs" }, { NEXT_PHASE: "phase-production-build" },
    { CCPUN_NATIVE_WORKFLOW_ENABLED: undefined }, { CCPUN_GIT_SHA: "b".repeat(40) }, { CCPUN_NEON_BRANCH_ID: "wrong" }]) {
    assert.equal(isArticleScheduleExecutionEnabled({ ...worker, ...change }), false);
  }
  assert.equal(isArticleScheduleExecutionEnabled({ CCPUN_DEPLOYMENT_PROVIDER: "vercel", CCPUN_ARTICLE_SCHEDULING_ENABLED: "1" }), true);
});

test("Cloud store still prepares and cancels but does not query due, claim or authorize execution", async () => {
  const root = mkdtempSync(join(tmpdir(), "ccpun-cloud-store-fixture-"));
  try {
    const lane = SCHEDULER_LANES.uat;
    const identity = { database_name: "neondb", role_name: "ccpun_admin_runtime", lane: "uat", project_id: lane.projectId,
      branch_id: lane.branchId, endpoint_id: lane.endpointId, sanity_project_id: lane.sanityProjectId, sanity_dataset: lane.dataset,
      mode: lane.mode, enabled: true, migration_version: ARTICLE_SCHEDULER_MIGRATION, migration_checksum: ARTICLE_SCHEDULER_CHECKSUM };
    const output = join(root, "store.mjs");
    await build({ entryPoints: [fileURLToPath(new URL("../../lib/admin/operations/article-schedule-store.ts", import.meta.url))], outfile: output,
      bundle: true, platform: "node", format: "esm", target: "node24",
      plugins: [{ name: "synthetic-neon-only", setup(builder) {
        builder.onResolve({ filter: /^server-only$/ }, () => ({ path: "server-only", namespace: "fixture" }));
        builder.onResolve({ filter: /^@neondatabase\/serverless$/ }, () => ({ path: "neon", namespace: "fixture" }));
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({ contents: args.path === "server-only" ? "export {};"
          : `export const neon=()=>({query:async(statement)=>{if(statement.includes('current_database()'))return[${JSON.stringify(identity)}];globalThis.fixtureQueries++;return[];}});`, loader: "js" }));
      } }] });
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", `
      import assert from 'node:assert/strict';
      const {openArticleScheduleStore}=await import(process.argv[1]);globalThis.fixtureQueries=0;
      const store=await openArticleScheduleStore();assert.equal(store.enabled,true);
      assert.deepEqual(await store.listNativeDue(10),[]);assert.equal(await store.claim('fixture','generation','execution'),null);
      assert.equal(await store.authorize({}),false);assert.equal(globalThis.fixtureQueries,0);
      await store.prepare({});await store.cancel('fixture','generation',1,'owner');assert.equal(globalThis.fixtureQueries,2);
      process.env.CCPUN_ARTICLE_SCHEDULING_ENABLED='0';await store.cancel('fixture','generation',1,'owner');assert.equal(globalThis.fixtureQueries,3);
      process.env.CCPUN_ARTICLE_SCHEDULING_ENABLED='1';process.env.CCPUN_ARTICLE_SCHEDULE_EXECUTION_PLANE='vps';process.env.CCPUN_ARTICLE_SCHEDULE_EXECUTOR_ENABLED='1';
      await store.claim('fixture','generation','execution');assert.equal(globalThis.fixtureQueries,4);
      `, output], { env: { PATH: process.env.PATH, NODE_ENV: "test", ...variables(), CCPUN_ARTICLE_SCHEDULING_ENABLED: "1", CCPUN_NATIVE_WORKFLOW_ENABLED: "0" }, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("production registration cannot use a feature ref, UAT data or a mismatched compiled release", () => {
  const lane = SCHEDULER_LANES.production;
  const values = { ...variables(), CCPUN_APP_ENV: "production-admin", CCPUN_GIT_REF: "v4-production", NEXT_PUBLIC_CCPUN_GIT_REF: "v4-production",
    NEXT_PUBLIC_SANITY_PROJECT_ID: lane.sanityProjectId, NEXT_PUBLIC_SANITY_DATASET: lane.dataset,
    CCPUN_NEON_PROJECT_ID: lane.projectId, CCPUN_NEON_BRANCH_ID: lane.branchId,
    CCPUN_ADMIN_DATABASE_URL: `postgresql://ccpun_admin_runtime:FIXTURE_ONLY@${lane.endpointId}.${lane.hostSuffix}/neondb?sslmode=require` };
  assert.equal(getArticleScheduleBackend(values), "native-neon");
  assert.equal(getArticleScheduleBackend({ ...values, CCPUN_GIT_REF: "feature/test", NEXT_PUBLIC_CCPUN_GIT_REF: "feature/test" }), "disabled");
  assert.equal(getArticleScheduleBackend({ ...values, CCPUN_ADMIN_DATABASE_URL: variables().CCPUN_ADMIN_DATABASE_URL }), "disabled");
});

test("overlapping ticks cannot scan twice; close prevents late scan results from executing", async () => {
  let resolve!: (value: { articleId: string; generation: string }[]) => void;
  let scans = 0; let executions = 0;
  const clock = createNativeArticleScheduleClock({ enabled: () => true,
    listDue: () => { scans++; return new Promise((done) => { resolve = done; }); },
    execute: async () => { executions++; },
  });
  const first = clock.tick();
  assert.deepEqual(await clock.tick(), { attempted: 0, failed: 0 });
  const closing = clock.close();
  resolve([{ articleId: "article-fixture", generation: "00000000-0000-4000-8000-000000000001" }]);
  await first; await closing;
  assert.equal(scans, 1); assert.equal(executions, 0);
  assert.deepEqual(await clock.tick(), { attempted: 0, failed: 0 });
  assert.throws(() => clock.start(), /CLOCK_CLOSED/);
});

test("one five-second timer starts once and is removed on close", async (context) => {
  context.mock.timers.enable({ apis: ["setInterval"] });
  let scans = 0;
  const clock = createNativeArticleScheduleClock({ enabled: () => true, listDue: async () => { scans++; return []; }, execute: async () => {} });
  clock.start(); clock.start(); context.mock.timers.tick(4_999); assert.equal(scans, 0);
  context.mock.timers.tick(1); assert.equal(scans, 1);
  await clock.close(); context.mock.timers.tick(10_000); assert.equal(scans, 1);
});

test("disabled execution and oversized batches never call the publication executor", async () => {
  let executions = 0; let scans = 0;
  const clock = createNativeArticleScheduleClock({ enabled: () => false, listDue: async () => { scans++; return []; }, execute: async () => { executions++; } });
  await clock.tick(); assert.equal(scans, 0); await clock.close();
  const oversized = createNativeArticleScheduleClock({ enabled: () => true,
    listDue: async () => Array.from({ length: 11 }, () => ({ articleId: "fixture", generation: "00000000-0000-4000-8000-000000000001" })),
    execute: async () => { executions++; } });
  assert.deepEqual(await oversized.tick(), { attempted: 0, failed: 1 });
  await oversized.close(); assert.equal(executions, 0);
});

test("clock errors expose only aggregate counts and do not leak connection/provider errors", async () => {
  const clock = createNativeArticleScheduleClock({ enabled: () => true,
    listDue: async () => { throw new Error("SYNTHETIC_PRIVATE_ERROR_MUST_NOT_REPLAY"); }, execute: async () => {} });
  assert.deepEqual(await clock.tick(), { attempted: 0, failed: 1 }); await clock.close();
  const execution = createNativeArticleScheduleClock({ enabled: () => true,
    listDue: async () => [{ articleId: "fixture", generation: "00000000-0000-4000-8000-000000000001" }],
    execute: async () => { throw new Error("SYNTHETIC_PRIVATE_CMS_ERROR"); } });
  assert.deepEqual(await execution.tick(), { attempted: 1, failed: 1 }); await execution.close();
});

test("native SQL registration and scan preserve CAS/audit and never take over SDK or uncertain rows", () => {
  assert.match(ACK_NATIVE_ARTICLE_DISPATCH, /workflow_run_id='native-neon:'\|\|generation::text/);
  assert.match(ACK_NATIVE_ARTICLE_DISPATCH, /article_id=\$1 AND generation=\$2::uuid AND status='preparing'/);
  assert.match(ACK_NATIVE_ARTICLE_DISPATCH, /native-neon-registration/);
  assert.match(ACK_NATIVE_ARTICLE_DISPATCH, /article_schedule_audit/);
  assert.match(READ_NATIVE_DUE_ARTICLE_SCHEDULES, /status='scheduled' AND scheduled_at<=clock_timestamp\(\)/);
  assert.match(READ_NATIVE_DUE_ARTICLE_SCHEDULES, /workflow_run_id='native-neon:'\|\|generation::text/);
  assert.match(READ_NATIVE_DUE_ARTICLE_SCHEDULES, /LIMIT \$1/);
  assert.doesNotMatch(READ_NATIVE_DUE_ARTICLE_SCHEDULES, /UPDATE|DELETE|executing|preparing|reconciliation|required.*lease/i);
});

test("Admin native branch loads no SDK until the explicit retained legacy branch", () => {
  const route = readFileSync(new URL("../../apps/admin/app/api/admin/content/[id]/schedule/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(route, /^import .*from ["']workflow\/api["']/m);
  assert.ok(route.indexOf('if (backend === "native-neon")') < route.indexOf('await import("workflow/api")'));
  assert.match(route, /registerNativeArticleSchedule/);
  assert.match(route, /await import\("@\/lib\/admin\/article-publication-workflow"\)/);
  assert.match(route, /cancelArticleSchedule/);
});
