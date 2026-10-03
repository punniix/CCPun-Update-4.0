import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { runAdminBackgroundWorker, validateBackgroundWorker } from "../../scripts/admin-background-worker";

const sha = "a".repeat(40);
const production = {
  CCPUN_BACKGROUND_EXECUTION_PLANE: "vps", CCPUN_BACKGROUND_WORKER_ENABLED: "1",
  CCPUN_DEPLOYMENT_PROVIDER: "hostinger", CCPUN_DEPLOYMENT_ROLE: "admin", CCPUN_ADMIN_CAPABILITY_PROFILE: "full",
  CCPUN_APP_ENV: "production-admin", NEXT_PUBLIC_CCPUN_APP_ENV: "production-admin", CCPUN_UAT_MODE: "0",
  AUTH_URL: "https://admin.ccpun.com", CCPUN_ENABLE_PRODUCTION_ANALYTICS: "0",
  CCPUN_ARTICLE_SCHEDULER_BACKEND: "disabled", NEXT_PUBLIC_CCPUN_ARTICLE_SCHEDULER_BACKEND: "disabled",
  CCPUN_NATIVE_WORKFLOW_ENABLED: "0", CCPUN_GIT_REF: "v4-production", CCPUN_GIT_SHA: sha, CCPUN_RELEASE_ID: "fixture-only",
  NEXT_PUBLIC_SANITY_PROJECT_ID: "kyfxgjnq", NEXT_PUBLIC_SANITY_DATASET: "production",
  CCPUN_NEON_PROJECT_ID: "lively-bar-43618798", CCPUN_NEON_BRANCH_ID: "br-long-resonance-b3ys5xrv",
  CCPUN_NEON_DATABASE: "neondb", CCPUN_NEON_ENDPOINT_ID: "ep-broad-butterfly-b3ro7u8w",
  CCPUN_SOCIAL_DATABASE_URL: "postgresql://ccpun_social_runtime:FIXTURE_ONLY@ep-broad-butterfly-b3ro7u8w.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
};
function git(ref = "v4-production", mismatch = "") {
  return ((_command: string, args: string[]) => {
    const text = args.join(" ");
    return { status: mismatch === "untracked" && text.includes("scripts/admin-background-worker.ts") ? 1 : 0,
      stdout: text === "rev-parse HEAD" ? (mismatch === "sha" ? "b".repeat(40) : sha)
        : text === "rev-parse --abbrev-ref HEAD" ? ref
          : text.startsWith("rev-parse --verify") ? (mismatch === "ref" ? "b".repeat(40) : sha)
            : text.startsWith("status") && mismatch === "dirty" ? " M scripts/admin-background-worker.ts" : "",
      stderr: "" };
  }) as typeof spawnSync;
}

test("private background runner denies activation, source/lane drift and untracked runner before execution", () => {
  for (const workload of ["social", "line-rich-menu"]) {
    assert.doesNotThrow(() => validateBackgroundWorker(workload, production, git()));
    for (const change of [{ CCPUN_BACKGROUND_WORKER_ENABLED: undefined }, { CCPUN_BACKGROUND_EXECUTION_PLANE: "cloud" },
      { NEXT_RUNTIME: "nodejs" }, { NEXT_PHASE: "phase-production-build" }, { CCPUN_DEPLOYMENT_ROLE: "web" },
      { CCPUN_DEPLOYMENT_PROVIDER: "vercel" }, { CCPUN_ADMIN_CAPABILITY_PROFILE: "editorial" },
      { CCPUN_NATIVE_WORKFLOW_ENABLED: "1" }, { VERCEL_ENV: "production" }, { VERCEL_URL: "legacy.example" },
      { CCPUN_NEON_BRANCH_ID: "br-wrong" }, { NEXT_PUBLIC_SANITY_DATASET: "uat" }, { CCPUN_UAT_MODE: "1" },
      { AUTH_URL: "https://admin-test.ccpun.com" }, { CCPUN_ENABLE_PRODUCTION_ANALYTICS: "1" }]) {
      assert.throws(() => validateBackgroundWorker(workload, { ...production, ...change }, git()));
    }
    for (const mismatch of ["sha", "ref", "dirty", "untracked"]) {
      assert.throws(() => validateBackgroundWorker(workload, production, git("v4-production", mismatch)));
    }
  }
  assert.throws(() => validateBackgroundWorker("unknown", production, git()));
  assert.throws(() => validateBackgroundWorker("social", { ...production,
    CCPUN_SOCIAL_DATABASE_URL: production.CCPUN_SOCIAL_DATABASE_URL.replace("ccpun_social_runtime", "neondb_owner") }, git()));
});

test("social UAT on production ref remains denied; approved UAT ref and richmenu retain exact isolated lanes", () => {
  const uat = { ...production, CCPUN_APP_ENV: "admin-uat", NEXT_PUBLIC_CCPUN_APP_ENV: "admin-uat", CCPUN_UAT_MODE: "1",
    AUTH_URL: "https://admin-test.ccpun.com", CCPUN_ARTICLE_SCHEDULER_BACKEND: "native-neon", NEXT_PUBLIC_CCPUN_ARTICLE_SCHEDULER_BACKEND: "native-neon",
    NEXT_PUBLIC_SANITY_PROJECT_ID: "ccb9lnw5", NEXT_PUBLIC_SANITY_DATASET: "uat",
    CCPUN_NEON_PROJECT_ID: "young-term-47483330", CCPUN_NEON_BRANCH_ID: "br-crimson-mouse-az7ajkv8", CCPUN_NEON_ENDPOINT_ID: "ep-mute-frost-aztvz394",
    CCPUN_SOCIAL_DATABASE_URL: "postgresql://ccpun_social_runtime:FIXTURE_ONLY@ep-mute-frost-aztvz394.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require" };
  assert.throws(() => validateBackgroundWorker("social", uat, git()), /SOCIAL_LANE_DENIED/);
  assert.doesNotThrow(() => validateBackgroundWorker("line-rich-menu", uat, git()));
  const ref = "admin/private-background-fixture";
  assert.doesNotThrow(() => validateBackgroundWorker("social", { ...uat, CCPUN_GIT_REF: ref }, git(ref)));
  assert.throws(() => validateBackgroundWorker("line-rich-menu", { ...uat, CCPUN_NEON_BRANCH_ID: production.CCPUN_NEON_BRANCH_ID }, git()));
});

test("one-shot runner does not load either executor on denial and returns only bounded outcome counts or fixed HOLD", async () => {
  let socialCalls = 0; let menuCalls = 0;
  const actions = {
    social: async () => { socialCalls++; return { scanned: 4, eligible: 3, executed: 1, skipped: 1,
      results: [{ publicationId: "PRIVATE_ID", outcome: "executed" as const },
        { publicationId: "PRIVATE_ID", outcome: "needs-reconciliation" as const, code: "PRIVATE_PROVIDER_ERROR" },
        { publicationId: "PRIVATE_ID", outcome: "conflict" as const }] }; },
    richMenu: async () => { menuCalls++; return { status: "hold" as const }; },
  };
  await assert.rejects(runAdminBackgroundWorker("social", production, { ...actions,
    validate: () => validateBackgroundWorker("social", { ...production, CCPUN_BACKGROUND_WORKER_ENABLED: "0" }, git()) }));
  assert.equal(socialCalls + menuCalls, 0);
  const result = await runAdminBackgroundWorker("social", production, { ...actions,
    validate: () => validateBackgroundWorker("social", production, git()) });
  assert.deepEqual(result, { workload: "social", scanned: 4, eligible: 3, executed: 1, skipped: 1,
    reconciliationRequired: 1, conflicts: 1, failed: 0 });
  assert.equal(JSON.stringify(result).includes("PRIVATE"), false);
  assert.deepEqual(await runAdminBackgroundWorker("line-rich-menu", production, { ...actions,
    validate: () => validateBackgroundWorker("line-rich-menu", production, git()) }), { workload: "line-rich-menu", status: "hold" });
  assert.equal(socialCalls, 1); assert.equal(menuCalls, 1);
});
