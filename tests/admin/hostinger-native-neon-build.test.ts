import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { build } from "esbuild";
import { sealNativeNeonRuntime, validateNativeNeonBuild, validateNativeNeonSource } from "../../apps/admin/scripts/build-provider.mjs";
import { applyHostingerAdminUatSafeRuntimeFlags } from "../../apps/admin/instrumentation";
import { getArticleScheduleBackend } from "../../lib/admin/article-schedule-clock";
import { startArticleScheduleWorker } from "../../scripts/article-schedule-worker";

// Prepared for actual Hostinger execution. No application DB/CMS/provider is
// contacted; fake Git/artifact/config fixtures belong only to this suite.
const source = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const tracked = ["package-lock.json", "apps/admin/next.config.ts", "apps/admin/scripts/build-provider.mjs", "lib/runtime/hostinger-production-release.mjs",
  "apps/admin/instrumentation.ts", "lib/admin/article-schedule-clock.ts", "lib/admin/article-scheduling.ts",
  "lib/admin/operations/article-schedule-sql.ts", "lib/admin/operations/article-schedule-store.ts",
  "lib/admin/operations/jobs-read-model.ts", "apps/admin/app/api/admin/content/[id]/schedule/route.ts", "scripts/article-schedule-worker.ts"];
function put(path: string, value: string) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, value); }
function fixture() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "ccpun-native-build-fixture-")));
  const git = (...args: string[]) => {
    const result = spawnSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    assert.equal(result.status, 0, "fixture Git operation failed"); return result.stdout.trim();
  };
  git("init", "--initial-branch=fixture-native-neon");
  git("config", "user.name", "Synthetic Fixture"); git("config", "user.email", "fixture@example.invalid");
  for (const path of tracked) put(join(root, path), path === "package-lock.json" ? '{"lockfileVersion":3}\n' : "// fixture\n");
  put(join(root, "apps/admin/scripts/build-provider.mjs"), source("apps/admin/scripts/build-provider.mjs"));
  put(join(root, "apps/admin/next.config.ts"), source("apps/admin/next.config.ts"));
  put(join(root, "lib/runtime/hostinger-production-release.mjs"), source("lib/runtime/hostinger-production-release.mjs"));
  put(join(root, "apps/next-security-headers.mjs"), "export function buildNextSecurityHeaders(){return [];}\n");
  git("add", "."); git("commit", "-m", "Synthetic native build fixture");
  const values: Record<string, string | undefined> = {
    CCPUN_DEPLOYMENT_PROVIDER: "hostinger", CCPUN_DEPLOYMENT_ROLE: "admin", CCPUN_APP_ENV: "admin-uat",
    CCPUN_ADMIN_CAPABILITY_PROFILE: "full", CCPUN_ARTICLE_SCHEDULER_BACKEND: "native-neon",
    NEXT_PUBLIC_SANITY_PROJECT_ID: "ccb9lnw5", NEXT_PUBLIC_SANITY_DATASET: "uat",
    CCPUN_NEON_PROJECT_ID: "young-term-47483330", CCPUN_NEON_BRANCH_ID: "br-crimson-mouse-az7ajkv8", CCPUN_NEON_DATABASE: "neondb",
    CCPUN_GIT_SHA: git("rev-parse", "HEAD"), CCPUN_GIT_REF: "fixture-native-neon", CCPUN_RELEASE_ID: "fixture-release",
    CCPUN_ARTICLE_SCHEDULING_ENABLED: "0", CCPUN_ARTICLE_SCHEDULE_EXECUTOR_ENABLED: "0", CCPUN_NATIVE_WORKFLOW_ENABLED: "0",
  };
  return { root, admin: join(root, "apps/admin"), git, values, close: () => rmSync(root, { recursive: true, force: true }) };
}
function productionValues(f: ReturnType<typeof fixture>): Record<string, string | undefined> {
  return { ...f.values, CCPUN_APP_ENV: "production-admin", NEXT_PUBLIC_CCPUN_APP_ENV: "production-admin",
    CCPUN_ARTICLE_SCHEDULER_BACKEND: "disabled", NEXT_PUBLIC_CCPUN_ARTICLE_SCHEDULER_BACKEND: "disabled",
    NEXT_PUBLIC_SANITY_PROJECT_ID: "kyfxgjnq", NEXT_PUBLIC_SANITY_DATASET: "production",
    CCPUN_NEON_PROJECT_ID: "lively-bar-43618798", CCPUN_NEON_BRANCH_ID: "br-long-resonance-b3ys5xrv",
    CCPUN_GIT_REF: "v4-production", AUTH_URL: "https://admin.ccpun.com" };
}

test("seal binds committed source, exact ref and root lock rather than declared provenance", () => {
  const f = fixture(); try {
    const seal = validateNativeNeonBuild(f.admin, f.values);
    assert.ok(seal); assert.equal(seal.gitSha, f.values.CCPUN_GIT_SHA); assert.equal(seal.productionReady, false);
    assert.equal(seal.lockSha256, createHash("sha256").update(readFileSync(join(f.root, "package-lock.json"))).digest("hex"));
    for (const change of [
      { CCPUN_GIT_SHA: "a".repeat(40) }, { CCPUN_GIT_REF: "unknown-ref" }, { CCPUN_RELEASE_ID: undefined },
      { CCPUN_APP_ENV: "production-admin" }, { CCPUN_DEPLOYMENT_ROLE: "web" }, { CCPUN_DEPLOYMENT_PROVIDER: "vercel" },
      { CCPUN_ADMIN_CAPABILITY_PROFILE: "editorial" }, { NEXT_PUBLIC_SANITY_PROJECT_ID: "kyfxgjnq" },
      { CCPUN_NEON_PROJECT_ID: "wrong" }, { CCPUN_NEON_BRANCH_ID: "wrong" }, { CCPUN_NEON_DATABASE: "wrong" },
      { NEXT_PUBLIC_SANITY_DATASET: "production" }, { NEXT_PUBLIC_CCPUN_APP_ENV: "production-admin" },
      { NEXT_PUBLIC_CCPUN_GIT_SHA: "b".repeat(40) }, { NEXT_PUBLIC_CCPUN_RELEASE_ID: "spoofed" },
      { NEXT_PUBLIC_CCPUN_ADMIN_CAPABILITY_PROFILE: "editorial" }, { CCPUN_ARTICLE_SCHEDULING_ENABLED: "invalid" },
      { CCPUN_NATIVE_WORKFLOW_ENABLED: "1" }, { VERCEL_PROJECT_ID: "conflicting" },
      { CCPUN_ARTICLE_SCHEDULE_EXECUTOR_ENABLED: "1" }, { CCPUN_ARTICLE_SCHEDULE_EXECUTOR_ENABLED: undefined },
      { CCPUN_NATIVE_WORKFLOW_ENABLED: undefined }, { CCPUN_ARTICLE_SCHEDULE_EXECUTION_PLANE: "vps" },
    ]) assert.throws(() => validateNativeNeonBuild(f.admin, { ...f.values, ...change }),
      change.CCPUN_APP_ENV === "production-admin" ? /NATIVE_ADMIN_PRODUCTION_BUILD_DENIED/ : /NATIVE_NEON_UAT_BUILD_DENIED/);
    put(join(f.root, "package-lock.json"), '{"lockfileVersion":3,"tampered":true}\n');
    assert.throws(() => validateNativeNeonBuild(f.admin, f.values), /UAT_BUILD_DENIED/);
    f.git("checkout", "--", "package-lock.json");
    f.git("rm", "--cached", "lib/admin/article-schedule-clock.ts"); f.git("commit", "-m", "Remove required tracked runtime");
    assert.throws(() => validateNativeNeonBuild(f.admin, { ...f.values, CCPUN_GIT_SHA: f.git("rev-parse", "HEAD") }), /UAT_BUILD_DENIED/);
  } finally { f.close(); }
});

test("Production native producer builds with both executors off and source validation keeps real Git gates", () => {
  const f = fixture(); try {
    f.git("branch", "v4-production"); f.git("checkout", "v4-production");
    const values: Record<string, string | undefined> = { ...productionValues(f), CCPUN_ARTICLE_SCHEDULER_BACKEND: "native-neon",
      NEXT_PUBLIC_CCPUN_ARTICLE_SCHEDULER_BACKEND: "native-neon", CCPUN_ARTICLE_SCHEDULE_EXECUTOR_ENABLED: "0" };
    const seal = validateNativeNeonBuild(f.admin, values);
    assert.ok(seal); assert.equal(seal.environment, "production-admin"); assert.equal(seal.schedulerBackend, "native-neon");
    assert.equal(seal.gitRef, "v4-production"); assert.equal(seal.productionReady, false);
    const producer = validateNativeNeonBuild(f.admin, { ...values, CCPUN_ARTICLE_SCHEDULING_ENABLED: "1" });
    assert.equal(producer?.articleScheduleProducerEnabled, true); assert.equal(producer?.articleScheduleExecutorEnabled, false);
    assert.equal(producer?.executionPlane, "cloud");
    const worker = { ...values, ...seal.publicValues, CCPUN_ARTICLE_SCHEDULING_ENABLED: "1",
      CCPUN_ARTICLE_SCHEDULE_EXECUTION_PLANE: "vps", CCPUN_ARTICLE_SCHEDULE_EXECUTOR_ENABLED: "1" };
    assert.throws(() => validateNativeNeonBuild(f.admin, worker), /NATIVE_ADMIN_PRODUCTION_BUILD_DENIED/);
    assert.equal(validateNativeNeonSource(f.admin, worker)?.gitSha, values.CCPUN_GIT_SHA);
    for (const change of [{ CCPUN_GIT_SHA: "b".repeat(40) }, { CCPUN_GIT_REF: "feature/incorrect" },
      { NEXT_PUBLIC_SANITY_PROJECT_ID: "ccb9lnw5" }, { CCPUN_NEON_BRANCH_ID: "br-crimson-mouse-az7ajkv8" },
      { AUTH_URL: "https://admin-test.ccpun.com" }, { CCPUN_NATIVE_WORKFLOW_ENABLED: "1" },
      { NEXT_PUBLIC_CCPUN_ARTICLE_SCHEDULER_BACKEND: "disabled" }]) {
      assert.throws(() => validateNativeNeonSource(f.admin, { ...worker, ...change }), /NATIVE_ADMIN_PRODUCTION_BUILD_DENIED/);
    }
    put(join(f.root, "package-lock.json"), '{"lockfileVersion":3,"tampered":true}\n');
    assert.throws(() => validateNativeNeonSource(f.admin, worker), { message: "NATIVE_ADMIN_PRODUCTION_BUILD_DENIED:TRACKED_DIRTY" });
  } finally { f.close(); }
});

test("editorial fallback without a native selector remains outside the full seal", () => {
  assert.equal(validateNativeNeonBuild(undefined, { CCPUN_DEPLOYMENT_PROVIDER: "hostinger", CCPUN_APP_ENV: "production-admin",
    CCPUN_ADMIN_CAPABILITY_PROFILE: "editorial" }), null);
});

test("source denial reports only fixed SHA, ref and dirty-tree reasons while preserving the gate", () => {
  const f = fixture(); try {
    assert.ok(validateNativeNeonBuild(f.admin, f.values));
    assert.throws(() => validateNativeNeonBuild(f.admin, { ...f.values, CCPUN_GIT_SHA: "a".repeat(40) }),
      { message: "NATIVE_NEON_UAT_BUILD_DENIED:SHA_MISMATCH" });
    f.git("branch", "fixture-stale-ref");
    put(join(f.root, "fixture-source.ts"), "// new committed source\n");
    f.git("add", "fixture-source.ts"); f.git("commit", "-m", "Advance synthetic source");
    f.git("checkout", "--detach");
    const values = { ...f.values, CCPUN_GIT_SHA: f.git("rev-parse", "HEAD") };
    for (const ref of ["fixture-stale-ref", "fixture-missing-ref"]) {
      assert.throws(() => validateNativeNeonBuild(f.admin, { ...values, CCPUN_GIT_REF: ref }),
        { message: "NATIVE_NEON_UAT_BUILD_DENIED:REF_RESOLUTION_MISMATCH" });
    }
    assert.ok(validateNativeNeonBuild(f.admin, values), "detached source with the exact real ref remains accepted");
    put(join(f.root, "package-lock.json"), '{"lockfileVersion":3,"tampered":true}\n');
    assert.throws(() => validateNativeNeonBuild(f.admin, values),
      { message: "NATIVE_NEON_UAT_BUILD_DENIED:TRACKED_DIRTY" });
  } finally { f.close(); }
});

test("native config omits Workflow for UAT and sealed manual Production while active or unsealed builds stay denied", async () => {
  const f = fixture(); try {
    // A fake SDK throws if loaded, independently detecting an accidental wrapper.
    put(join(f.root, "node_modules/workflow/package.json"), '{"exports":{"./next":"./next.cjs"}}');
    put(join(f.root, "node_modules/workflow/next.cjs"), 'throw new Error("SDK_WRAPPER_WAS_LOADED");');
    const stub = join(f.root, "config-stub.mjs");
    put(stub, 'export function getAdminEnvironment(){return process.env.CCPUN_APP_ENV;} export function isSanityLaneAllowed(){return true;} export function getAdminCapabilityProfile(){return process.env.CCPUN_ADMIN_CAPABILITY_PROFILE;}');
    const entry = join(f.admin, "next.config.compiled.mjs");
    await build({ entryPoints: [join(f.admin, "next.config.ts")], outfile: entry, bundle: true, platform: "node", format: "esm", target: "node24",
      external: ["./scripts/build-provider.mjs", "../next-security-headers.mjs"],
      plugins: [{ name: "synthetic-config-dependencies", setup(build) {
        build.onResolve({ filter: /^\.\.\/\.\.\/lib\/admin\/(?:environment|capability-profile)$/ }, () => ({ path: stub }));
      } }] });
    const run = (values: Record<string, string | undefined>) => spawnSync(process.execPath,
      ["--input-type=module", "-e", 'const {default:c}=await import("./next.config.compiled.mjs"); if(c.output!=="standalone"||(process.env.CCPUN_ARTICLE_SCHEDULER_BACKEND&&c.env.NEXT_PUBLIC_CCPUN_ARTICLE_SCHEDULER_BACKEND!==process.env.CCPUN_ARTICLE_SCHEDULER_BACKEND))process.exit(9);'],
      { cwd: f.admin, env: { PATH: process.env.PATH, NODE_ENV: "test", ...values }, encoding: "utf8" });
    assert.equal(run(f.values).status, 0, "native config must not load SDK or application data clients");
    const editorial = { ...f.values, CCPUN_ADMIN_CAPABILITY_PROFILE: "editorial", CCPUN_ARTICLE_SCHEDULER_BACKEND: undefined };
    assert.equal(run(editorial).status, 0, "existing editorial wrapper omission remains intact");
    const legacy = run({ ...f.values, CCPUN_DEPLOYMENT_PROVIDER: "vercel", CCPUN_ARTICLE_SCHEDULER_BACKEND: undefined });
    assert.notEqual(legacy.status, 0); assert.match(legacy.stderr, /SDK_WRAPPER_WAS_LOADED/);
    assert.equal(run({ ...f.values, CCPUN_ARTICLE_SCHEDULING_ENABLED: "1" }).status, 0, "Cloud producer must compile without SDK execution");
    const active = run({ ...f.values, CCPUN_ARTICLE_SCHEDULE_EXECUTOR_ENABLED: "1" });
    assert.notEqual(active.status, 0); assert.match(active.stderr, /NATIVE_NEON_UAT_BUILD_DENIED/);
    const production = run({ ...f.values, CCPUN_APP_ENV: "production-admin" });
    assert.notEqual(production.status, 0); assert.match(production.stderr, /NATIVE_ADMIN_PRODUCTION_BUILD_DENIED/);
    f.git("checkout", "-b", "v4-production");
    assert.equal(run(productionValues(f)).status, 0, "sealed manual Production must not load SDK or data clients");
    for (const change of [{ CCPUN_ARTICLE_SCHEDULING_ENABLED: "1" }, { CCPUN_NATIVE_WORKFLOW_ENABLED: "1" }, { AUTH_URL: "https://evil.example" }]) {
      const invalid = run({ ...productionValues(f), ...change });
      assert.notEqual(invalid.status, 0); assert.match(invalid.stderr, /NATIVE_ADMIN_PRODUCTION_BUILD_DENIED/);
    }
  } finally { f.close(); }
});

test("manual Production seal binds the real lane/ref and permanently disabled scheduler without claiming readiness", () => {
  const f = fixture(); try {
    f.git("checkout", "-b", "v4-production");
    const values = productionValues(f);
    const seal = validateNativeNeonBuild(f.admin, values);
    assert.ok(seal); assert.equal(seal.environment, "production-admin");
    assert.equal(seal.schedulerBackend, "disabled"); assert.equal(seal.productionReady, false);
    assert.equal(seal.sanityProjectId, "kyfxgjnq"); assert.equal(seal.sanityDataset, "production");
    assert.equal(seal.neonProjectId, "lively-bar-43618798"); assert.equal(seal.neonBranchId, "br-long-resonance-b3ys5xrv");
    assert.equal(seal.gitRef, "v4-production"); assert.equal(seal.gitSha, values.CCPUN_GIT_SHA);
    const bound = { ...values, ...seal.publicValues };
    assert.equal(getArticleScheduleBackend(bound), "disabled");
    assert.equal(getArticleScheduleBackend({ ...bound, CCPUN_ARTICLE_SCHEDULER_BACKEND: "native-neon", CCPUN_ARTICLE_SCHEDULING_ENABLED: "1" }), "disabled");
    for (const change of [
      { CCPUN_APP_ENV: "admin-uat" }, { NEXT_PUBLIC_CCPUN_APP_ENV: undefined }, { NEXT_PUBLIC_CCPUN_APP_ENV: "admin-uat" },
      { CCPUN_DEPLOYMENT_PROVIDER: "vercel" }, { CCPUN_DEPLOYMENT_ROLE: "web" }, { CCPUN_ADMIN_CAPABILITY_PROFILE: "editorial" },
      { CCPUN_ARTICLE_SCHEDULER_BACKEND: "native-neon" }, { NEXT_PUBLIC_CCPUN_ARTICLE_SCHEDULER_BACKEND: "native-neon" },
      { NEXT_PUBLIC_CCPUN_ARTICLE_SCHEDULER_BACKEND: undefined }, { NEXT_PUBLIC_SANITY_PROJECT_ID: "ccb9lnw5" }, { NEXT_PUBLIC_SANITY_DATASET: "uat" },
      { CCPUN_NEON_PROJECT_ID: "young-term-47483330" }, { CCPUN_NEON_BRANCH_ID: "br-crimson-mouse-az7ajkv8" }, { CCPUN_NEON_DATABASE: "wrong" },
      { CCPUN_GIT_REF: "fixture-native-neon" }, { CCPUN_GIT_SHA: "a".repeat(40) }, { CCPUN_RELEASE_ID: undefined },
      { AUTH_URL: undefined }, { AUTH_URL: "http://admin.ccpun.com" }, { AUTH_URL: "https://admin.ccpun.com/" },
      { CCPUN_ARTICLE_SCHEDULING_ENABLED: undefined }, { CCPUN_ARTICLE_SCHEDULING_ENABLED: "1" },
      { CCPUN_NATIVE_WORKFLOW_ENABLED: undefined }, { CCPUN_NATIVE_WORKFLOW_ENABLED: "1" }, { VERCEL_PROJECT_ID: "conflicting" },
      { NEXT_PUBLIC_CCPUN_GIT_SHA: "b".repeat(40) }, { NEXT_PUBLIC_CCPUN_ADMIN_CAPABILITY_PROFILE: "editorial" },
    ]) assert.throws(() => validateNativeNeonBuild(f.admin, { ...values, ...change }), /PRODUCTION_BUILD_DENIED/);
    const runtime = join(f.admin, ".next/standalone");
    put(join(runtime, ".next/server/app-paths-manifest.json"), '{}'); put(join(runtime, ".next/BUILD_ID"), "manual-fixture-build");
    sealNativeNeonRuntime(f.admin, seal);
    const manifest = JSON.parse(readFileSync(join(runtime, "ccpun-native-admin-manifest.json"), "utf8"));
    assert.equal(manifest.environment, "production-admin"); assert.equal(manifest.schedulerBackend, "disabled");
    assert.equal(manifest.productionReady, false); assert.equal("publicValues" in manifest, false);
    put(join(f.root, "package-lock.json"), '{"lockfileVersion":3,"tampered":true}\n');
    assert.throws(() => validateNativeNeonBuild(f.admin, values), /PRODUCTION_BUILD_DENIED/);
  } finally { f.close(); }
});

test("native standalone seal permits internal workspace links and denies escapes, credentials and SDK mounts", () => {
  const f = fixture(); try {
    const seal = validateNativeNeonBuild(f.admin, f.values); assert.ok(seal);
    const runtime = join(f.admin, ".next/standalone");
    put(join(runtime, ".next/server/app-paths-manifest.json"), '{}'); put(join(runtime, ".next/BUILD_ID"), "fixture-build");
    put(join(runtime, "server.js"), 'console.log(JSON.stringify({sha:process.env.CCPUN_GIT_SHA,ref:process.env.CCPUN_GIT_REF,profile:process.env.CCPUN_ADMIN_CAPABILITY_PROFILE,backend:process.env.CCPUN_ARTICLE_SCHEDULER_BACKEND,social:process.env.CCPUN_SOCIAL_ENABLED,socialWrites:process.env.CCPUN_SOCIAL_PROVIDER_WRITES_ENABLED,secret:process.env.AUTH_SECRET}))\n');
    put(join(runtime, "packages/shared/index.js"), "module.exports={}"); mkdirSync(join(runtime, "node_modules"));
    symlinkSync("../packages/shared", join(runtime, "node_modules/shared")); sealNativeNeonRuntime(f.admin, seal);
    const manifest = JSON.parse(readFileSync(join(runtime, "ccpun-native-admin-manifest.json"), "utf8"));
    assert.equal(manifest.gitSha, f.values.CCPUN_GIT_SHA); assert.equal(manifest.schedulerBackend, "native-neon");
    assert.equal(manifest.productionReady, false); assert.equal("publicValues" in manifest, false);
    const sealedServer = readFileSync(join(runtime, "server.js"), "utf8");
    assert.match(sealedServer, /^\/\* CCPun sealed Admin UAT runtime identity \*\//);
    const runtimeProof = spawnSync(process.execPath, [join(runtime, "server.js")], {
      env: {
        PATH: process.env.PATH,
        CCPUN_GIT_SHA: "stale-sha",
        CCPUN_GIT_REF: "stale-ref",
        CCPUN_ADMIN_CAPABILITY_PROFILE: "editorial",
        CCPUN_ARTICLE_SCHEDULER_BACKEND: "disabled",
        CCPUN_SOCIAL_ENABLED: "0",
        CCPUN_SOCIAL_PROVIDER_WRITES_ENABLED: "1",
        AUTH_SECRET: "SECRET_MUST_STAY",
      },
      encoding: "utf8",
    });
    assert.equal(runtimeProof.status, 0, runtimeProof.stderr);
    assert.deepEqual(JSON.parse(runtimeProof.stdout.trim()), {
      sha: f.values.CCPUN_GIT_SHA,
      ref: f.values.CCPUN_GIT_REF,
      profile: "full",
      backend: "native-neon",
      social: "1",
      socialWrites: "0",
      secret: "SECRET_MUST_STAY",
    });
    symlinkSync(f.root, join(runtime, "escape")); assert.throws(() => sealNativeNeonRuntime(f.admin, seal), /LINK_DENIED/); unlinkSync(join(runtime, "escape"));
    put(join(runtime, ".env.fixture"), "SYNTHETIC_ONLY"); assert.throws(() => sealNativeNeonRuntime(f.admin, seal), /INPUT_DENIED/); rmSync(join(runtime, ".env.fixture"));
    put(join(runtime, ".next/server/app-paths-manifest.json"), '{"/.well-known/workflow/v1/flow/route":"fake.js"}');
    assert.throws(() => sealNativeNeonRuntime(f.admin, seal), /SDK_ROUTE_PRESENT/);
  } finally { f.close(); }
});

test("exact Hostinger Admin UAT artifact seals synthetic Social operations and keeps providers isolated", () => {
  const sha = "9".repeat(40);
  const compiled = {
    provider: "hostinger",
    role: "admin",
    environment: "admin-uat",
    profile: "full",
    schedulerBackend: "native-neon",
    gitSha: sha,
    gitRef: `admin/hostinger-release-uat-${"1".repeat(40)}`,
    releaseId: `hostinger-admin-uat-${sha.slice(0, 12)}`,
  };
  const variables: Record<string, string | undefined> = {
    NEXT_RUNTIME: "nodejs",
    CCPUN_SOCIAL_ENABLED: "0",
    CCPUN_SOCIAL_DATA_MODE: "live",
    CCPUN_SOCIAL_OPERATIONS_ENABLED: "0",
    CCPUN_SOCIAL_PROVIDER_READS_ENABLED: "1",
    CCPUN_SOCIAL_PROVIDER_WRITES_ENABLED: "1",
    CCPUN_SOCIAL_ANALYTICS_INGESTION_ENABLED: "1",
    AUTH_SECRET: "SECRET_MUST_STAY",
  };
  assert.equal(applyHostingerAdminUatSafeRuntimeFlags(variables, compiled), true);
  assert.deepEqual({
    social: variables.CCPUN_SOCIAL_ENABLED,
    mode: variables.CCPUN_SOCIAL_DATA_MODE,
    operations: variables.CCPUN_SOCIAL_OPERATIONS_ENABLED,
    reads: variables.CCPUN_SOCIAL_PROVIDER_READS_ENABLED,
    writes: variables.CCPUN_SOCIAL_PROVIDER_WRITES_ENABLED,
    analytics: variables.CCPUN_SOCIAL_ANALYTICS_INGESTION_ENABLED,
  }, { social: "1", mode: "synthetic", operations: "1", reads: "0", writes: "0", analytics: "0" });
  assert.equal(variables.AUTH_SECRET, "SECRET_MUST_STAY");

  for (const invalid of [
    { ...compiled, provider: "vercel" },
    { ...compiled, environment: "production-admin" },
    { ...compiled, profile: "editorial" },
    { ...compiled, schedulerBackend: "disabled" },
    { ...compiled, gitSha: "invalid" },
    { ...compiled, gitRef: "feature/not-uat" },
    { ...compiled, releaseId: "wrong-release" },
  ]) {
    const denied = { NEXT_RUNTIME: "nodejs", CCPUN_SOCIAL_ENABLED: "unchanged" };
    assert.equal(applyHostingerAdminUatSafeRuntimeFlags(denied, invalid), false);
    assert.equal(denied.CCPUN_SOCIAL_ENABLED, "unchanged");
  }
});

test("Cloud startup accepts producer activation without a timer and rejects private executor activation", async () => {
  const root = mkdtempSync(join(tmpdir(), "ccpun-cloud-clock-fixture-"));
  try {
    const entry = join(root, "instrumentation.mjs");
    await build({ entryPoints: [fileURLToPath(new URL("../../apps/admin/instrumentation.ts", import.meta.url))], outfile: entry,
      bundle: true, platform: "node", format: "esm", target: "node24" });
    const run = (values: Record<string, string | undefined>) => spawnSync(process.execPath, ["--input-type=module", "-e",
      'globalThis.setInterval=()=>{throw new Error("CLOUD_TIMER_STARTED")}; const {register}=await import(process.argv[1]); await register();', entry],
      { env: { PATH: process.env.PATH, NODE_ENV: "test", NEXT_RUNTIME: "nodejs", CCPUN_ARTICLE_SCHEDULER_BACKEND: "native-neon",
        CCPUN_NATIVE_WORKFLOW_ENABLED: "0", ...values }, encoding: "utf8" });
    assert.equal(run({ CCPUN_ARTICLE_SCHEDULING_ENABLED: "1" }).status, 0);
    assert.equal(run({ CCPUN_ARTICLE_SCHEDULING_ENABLED: "1", NEXT_PHASE: "phase-production-build" }).status, 0);
    for (const values of [{ CCPUN_ARTICLE_SCHEDULE_EXECUTOR_ENABLED: "1" }, { CCPUN_ARTICLE_SCHEDULE_EXECUTION_PLANE: "vps" },
      { CCPUN_ARTICLE_SCHEDULE_EXECUTOR_ENABLED: "invalid" }]) {
      assert.notEqual(run(values).status, 0);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("private runner validates actual source before starting and never starts for Cloud or bad source", async () => {
  const f = fixture(); try {
    const seal = validateNativeNeonBuild(f.admin, f.values); assert.ok(seal);
    const worker = { ...f.values, ...seal.publicValues,
      CCPUN_ADMIN_DATABASE_URL: "postgresql://ccpun_admin_runtime:FIXTURE_ONLY@ep-mute-frost-aztvz394.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
      CCPUN_ARTICLE_SCHEDULING_ENABLED: "1", CCPUN_ARTICLE_SCHEDULE_EXECUTION_PLANE: "vps", CCPUN_ARTICLE_SCHEDULE_EXECUTOR_ENABLED: "1" };
    let starts = 0;
    const dependencies = { validateSource: () => validateNativeNeonSource(f.admin, worker),
      startClock: async () => { starts++; return { close: async () => {} }; } };
    for (const change of [{ CCPUN_ARTICLE_SCHEDULE_EXECUTION_PLANE: undefined }, { CCPUN_ARTICLE_SCHEDULE_EXECUTOR_ENABLED: "0" },
      { NEXT_RUNTIME: "nodejs" }, { NEXT_PHASE: "phase-production-build" }, { CCPUN_NEON_BRANCH_ID: "wrong" }]) {
      await assert.rejects(startArticleScheduleWorker({ ...worker, ...change }, dependencies), /WORKER_ACTIVATION_DENIED/);
    }
    assert.equal(starts, 0);
    put(join(f.root, "package-lock.json"), '{"lockfileVersion":3,"tampered":true}\n');
    await assert.rejects(startArticleScheduleWorker(worker, dependencies), /TRACKED_DIRTY/); assert.equal(starts, 0);
    f.git("checkout", "--", "package-lock.json");
    await startArticleScheduleWorker(worker, dependencies); assert.equal(starts, 1);
  } finally { f.close(); }
});


test("Cloud pinned Production ref builds from real Git while both private CLI source validation remains strict", async () => {
  const f = fixture(); try {
    const sha = f.git("rev-parse", "HEAD"), ref = `codex/hostinger-release-production-${sha}`;
    f.git("checkout", "-b", ref);
    const values = { ...productionValues(f), CCPUN_GIT_REF: ref };
    const seal = validateNativeNeonBuild(f.admin, values);
    assert.ok(seal); assert.equal(seal.gitSha, sha); assert.equal(seal.gitRef, ref);
    assert.equal(seal.articleScheduleExecutorEnabled, false); assert.equal(seal.productionReady, false);
    assert.equal(seal.publicValues.NEXT_PUBLIC_CCPUN_GIT_REF, ref);
    assert.throws(() => validateNativeNeonSource(f.admin, values), /NATIVE_ADMIN_PRODUCTION_BUILD_DENIED/);
    await assert.rejects(startArticleScheduleWorker({ ...values, ...seal.publicValues,
      CCPUN_ARTICLE_SCHEDULER_BACKEND: "native-neon", NEXT_PUBLIC_CCPUN_ARTICLE_SCHEDULER_BACKEND: "native-neon",
      CCPUN_ARTICLE_SCHEDULING_ENABLED: "1", CCPUN_ARTICLE_SCHEDULE_EXECUTION_PLANE: "vps", CCPUN_ARTICLE_SCHEDULE_EXECUTOR_ENABLED: "1" }), /NATIVE_SCHEDULE_WORKER_ACTIVATION_DENIED/);
    for (const change of [
      { CCPUN_GIT_REF: `codex/hostinger-release-production-${"b".repeat(40)}` },
      { CCPUN_GIT_REF: `codex/hostinger-release-uat-${sha}` }, { CCPUN_GIT_REF: "feature/production" },
      { CCPUN_GIT_SHA: "b".repeat(40) }, { CCPUN_APP_ENV: "admin-uat" },
      { CCPUN_DEPLOYMENT_PROVIDER: "vercel" }, { CCPUN_DEPLOYMENT_ROLE: "web" },
      { CCPUN_ADMIN_CAPABILITY_PROFILE: "editorial" }, { NEXT_PUBLIC_SANITY_PROJECT_ID: "ccb9lnw5" },
      { CCPUN_NEON_BRANCH_ID: "br-crimson-mouse-az7ajkv8" }, { AUTH_URL: "https://admin-test.ccpun.com" },
      { CCPUN_NATIVE_WORKFLOW_ENABLED: "1" }, { CCPUN_ARTICLE_SCHEDULE_EXECUTOR_ENABLED: "1" },
      { CCPUN_BACKGROUND_WORKER_ENABLED: "1" }, { CCPUN_BACKGROUND_EXECUTION_PLANE: "vps" },
      { CCPUN_ARTICLE_SCHEDULE_EXECUTION_PLANE: "vps" }, { CCPUN_RELEASE_ID: undefined },
      { NEXT_PUBLIC_CCPUN_GIT_REF: "v4-production" }, { NEXT_PUBLIC_CCPUN_RELEASE_ID: "wrong-release" },
    ]) assert.throws(() => validateNativeNeonBuild(f.admin, { ...values, ...change }), /BUILD_DENIED/);
    put(join(f.root, "package-lock.json"), '{"lockfileVersion":3,"changed":true}\n');
    assert.throws(() => validateNativeNeonBuild(f.admin, values), { message: "NATIVE_ADMIN_PRODUCTION_BUILD_DENIED:TRACKED_DIRTY" });
  } finally { f.close(); }
});


test("pinned Cloud ref must be a real refs/heads branch, never only a tag in detached source", () => {
  const f = fixture(); try {
    const sha = f.git("rev-parse", "HEAD"), ref = `codex/hostinger-release-production-${sha}`;
    f.git("checkout", "-b", ref);
    const values = { ...productionValues(f), CCPUN_GIT_REF: ref };
    assert.ok(validateNativeNeonBuild(f.admin, values));
    f.git("checkout", "--detach");
    assert.ok(validateNativeNeonBuild(f.admin, values), "detached checkout still requires the exact real branch");
    f.git("branch", "-D", ref); f.git("tag", ref);
    assert.equal(f.git("rev-parse", "--verify", `${ref}^{commit}`), sha, "a tag could satisfy the former unqualified lookup");
    assert.throws(() => validateNativeNeonBuild(f.admin, values), { message: "NATIVE_ADMIN_PRODUCTION_BUILD_DENIED:REF_RESOLUTION_MISMATCH" });
    f.git("tag", "-d", ref);
    assert.throws(() => validateNativeNeonBuild(f.admin, values), { message: "NATIVE_ADMIN_PRODUCTION_BUILD_DENIED:REF_RESOLUTION_MISMATCH" });
    assert.throws(() => validateNativeNeonSource(f.admin, values), /NATIVE_ADMIN_PRODUCTION_BUILD_DENIED/);
  } finally { f.close(); }
});
