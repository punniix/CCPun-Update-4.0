import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { buildNextSecurityHeaders } from "../apps/next-security-headers.mjs";
import { blockedRobotsErrors, runParity, shadowSchemaTypes } from "../scripts/hostinger-seo-parity.mjs";
import { archiveStandaloneRuntime, captureStandaloneProvenance, sealStandaloneProvenance } from "../apps/web/scripts/build-provider.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("shadow app configs keep security headers provider-safe", () => {
  const web = read("apps/web/next.config.ts");
  const admin = read("apps/admin/next.config.ts");
  assert.doesNotMatch(web, /from "\.\.\/next-security-headers\.mjs"/);
  assert.match(web, /function buildNextSecurityHeaders/);
  assert.match(web, /Content-Security-Policy/);
  assert.doesNotMatch(web, /runtime-environment/);
  assert.match(web, /WEB_VERCEL_PROJECT_ID/);
  assert.match(web, /function isWebSanityLaneAllowed/);
  assert.match(admin, /from "\.\.\/next-security-headers\.mjs"/);
  assert.doesNotMatch(web, /\.\.\/\.\.\/lib\/security-policy/);
  assert.doesNotMatch(admin, /\.\.\/\.\.\/lib\/security-policy/);
});

test("shared shadow security policy preserves production HTTPS and review Sanity access", () => {
  const production = buildNextSecurityHeaders({
    isReviewEnvironment: false,
    sanityProjectId: "kyfxgjnq",
    nodeEnv: "production",
    appEnvironment: "production",
  });
  const csp = production.find((header) => header.key === "Content-Security-Policy")?.value ?? "";
  assert.match(csp, /upgrade-insecure-requests/);
  assert.match(csp, /https:\/\/kyfxgjnq\.api\.sanity\.io/);
  assert.ok(production.some((header) => header.key === "Strict-Transport-Security"));
  assert.doesNotMatch(csp, /core\.sanity-cdn\.com/);

  const review = buildNextSecurityHeaders({
    isReviewEnvironment: true,
    sanityProjectId: "ccb9lnw5",
    nodeEnv: "production",
    appEnvironment: "web-uat",
  });
  const reviewCsp = review.find((header) => header.key === "Content-Security-Policy")?.value ?? "";
  assert.match(reviewCsp, /core\.sanity-cdn\.com/);
  assert.match(reviewCsp, /https:\/\/ccb9lnw5\.api\.sanity\.io/);
});

function runReadiness(extraEnv = {}) {
  const env = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    NODE_ENV: "production",
    CCPUN_DEPLOYMENT_PROVIDER: "hostinger",
    CCPUN_DEPLOYMENT_ROLE: "web",
    CCPUN_RELEASE_STAGE: "live",
    CCPUN_APP_ENV: "production",
    NEXT_PUBLIC_CCPUN_APP_ENV: "production",
    NEXT_PUBLIC_SANITY_PROJECT_ID: "kyfxgjnq",
    NEXT_PUBLIC_SANITY_DATASET: "production",
    CCPUN_UAT_MODE: "0",
    CCPUN_ENABLE_PRODUCTION_ANALYTICS: "1",
    CCPUN_GIT_REF: "v4-production",
    CCPUN_GIT_SHA: "5fc13ac7f18c4200b02d09c4a812869c2c0b57af",
    CCPUN_RELEASE_ID: "hostinger-web-5fc13ac7",
    ...extraEnv,
  };
  return spawnSync(process.execPath, ["scripts/check-hostinger-readiness.mjs"], {
    cwd: new URL("..", import.meta.url),
    env,
    encoding: "utf8",
  });
}

function runAdminReadiness(environment = "admin-uat", extraEnv = {}) {
  const production = environment === "production-admin";
  const sha = "a".repeat(40);
  const endpointId = production ? "ep-broad-butterfly-b3ro7u8w" : "ep-mute-frost-aztvz394";
  const hostSuffix = production ? "c-4.ap-southeast-1.aws.neon.tech" : "c-3.ap-southeast-1.aws.neon.tech";
  const env = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    NODE_ENV: "production",
    CCPUN_DEPLOYMENT_PROVIDER: "hostinger",
    CCPUN_DEPLOYMENT_ROLE: "admin",
    CCPUN_RELEASE_STAGE: production ? "live" : "shadow",
    CCPUN_APP_ENV: environment,
    NEXT_PUBLIC_CCPUN_APP_ENV: environment,
    NEXT_PUBLIC_SANITY_PROJECT_ID: production ? "kyfxgjnq" : "ccb9lnw5",
    NEXT_PUBLIC_SANITY_DATASET: production ? "production" : "uat",
    CCPUN_UAT_MODE: production ? "0" : "1",
    CCPUN_ENABLE_PRODUCTION_ANALYTICS: "0",
    CCPUN_ADMIN_CAPABILITY_PROFILE: "full",
    NEXT_PUBLIC_CCPUN_ADMIN_CAPABILITY_PROFILE: "full",
    CCPUN_ARTICLE_SCHEDULER_BACKEND: "native-neon",
    NEXT_PUBLIC_CCPUN_ARTICLE_SCHEDULER_BACKEND: "native-neon",
    CCPUN_ARTICLE_SCHEDULING_ENABLED: "1",
    CCPUN_ARTICLE_SCHEDULE_EXECUTION_PLANE: "cloud",
    CCPUN_ARTICLE_SCHEDULE_EXECUTOR_ENABLED: "0",
    CCPUN_NATIVE_WORKFLOW_ENABLED: "0",
    CCPUN_BACKGROUND_EXECUTION_PLANE: "cloud",
    CCPUN_BACKGROUND_WORKER_ENABLED: "0",
    ...(production ? {} : {
      CCPUN_SOCIAL_ENABLED: "1",
      CCPUN_SOCIAL_DATA_MODE: "synthetic",
      CCPUN_SOCIAL_OPERATIONS_ENABLED: "1",
      CCPUN_SOCIAL_PROVIDER_READS_ENABLED: "0",
      CCPUN_SOCIAL_PROVIDER_WRITES_ENABLED: "0",
      CCPUN_SOCIAL_ANALYTICS_INGESTION_ENABLED: "0",
    }),
    AUTH_URL: production ? "https://admin.ccpun.com" : "https://admin-test.ccpun.com",
    CCPUN_NEON_PROJECT_ID: production ? "lively-bar-43618798" : "young-term-47483330",
    CCPUN_NEON_BRANCH_ID: production ? "br-long-resonance-b3ys5xrv" : "br-crimson-mouse-az7ajkv8",
    CCPUN_NEON_ENDPOINT_ID: endpointId,
    CCPUN_NEON_DATABASE: "neondb",
    CCPUN_ADMIN_DATABASE_URL: `postgresql://ccpun_admin_runtime:FIXTURE_ONLY@${endpointId}.${hostSuffix}/neondb?sslmode=require`,
    CCPUN_GIT_REF: production ? "v4-production" : `admin/hostinger-release-uat-${sha}`,
    CCPUN_GIT_SHA: sha,
    CCPUN_RELEASE_ID: `hostinger-admin-${production ? "prod" : "uat"}-${sha.slice(0, 12)}`,
    ...extraEnv,
  };
  return spawnSync(process.execPath, ["scripts/check-hostinger-readiness.mjs"], {
    cwd: new URL("..", import.meta.url), env, encoding: "utf8",
  });
}

test("Hostinger root build routes both workspaces and preserves native builds and child failures", { skip: process.platform === "win32" }, () => {
  const rootPackage = JSON.parse(read("package.json"));
  assert.equal(rootPackage.scripts.build, "node scripts/build-root.mjs");
  const fixture = mkdtempSync(join(tmpdir(), "ccpun-root-build-"));
  try {
    mkdirSync(join(fixture, "scripts"));
    mkdirSync(join(fixture, "lib/runtime"), { recursive: true });
    writeFileSync(join(fixture, "scripts/build-root.mjs"), read("scripts/build-root.mjs"));
    writeFileSync(join(fixture, "lib/runtime/deployment-lanes.mjs"), read("lib/runtime/deployment-lanes.mjs"));
    for (const command of ["npm", "next"]) {
      const executable = join(fixture, command);
      writeFileSync(executable, `#!${process.execPath}\nconsole.log(JSON.stringify({ command: ${JSON.stringify(command)}, args: process.argv.slice(2), cwd: process.cwd() })); process.exit(Number(process.env.FIXTURE_EXIT ?? 0));\n`);
      chmodSync(executable, 0o755);
    }
    for (const [provider, role, command, args] of [
      ["hostinger", "web", "npm", ["run", "build", "--workspace", "@ccpun/web"]],
      [" HOSTINGER ", " ADMIN ", "npm", ["run", "build", "--workspace", "@ccpun/admin"]],
      ["vercel", "admin", "next", ["build"]],
      ["local", "web", "next", ["build"]],
      ["", "", "next", ["build"]],
      ["hostinger", "unknown", "next", ["build"]],
    ]) {
      for (const exitCode of [0, 7]) {
        const result = spawnSync(process.execPath, [join(fixture, "scripts/build-root.mjs")], {
          cwd: tmpdir(), encoding: "utf8",
          env: { PATH: fixture, CCPUN_DEPLOYMENT_PROVIDER: provider, CCPUN_DEPLOYMENT_ROLE: role, FIXTURE_EXIT: String(exitCode) },
        });
        assert.equal(result.status, exitCode, result.stderr);
        const invocation = JSON.parse(result.stdout.trim().split("\n").at(-1));
        assert.deepEqual({ command: invocation.command, args: invocation.args }, { command, args });
        assert.equal(invocation.cwd, realpathSync(fixture));
      }
    }
  } finally { rmSync(fixture, { recursive: true, force: true }); }
});


test("v4-production root build self-identifies the Hostinger Web production lane when hPanel env is empty", { skip: process.platform === "win32" }, () => {
  const fixture = mkdtempSync(join(tmpdir(), "ccpun-root-prod-build-"));
  try {
    mkdirSync(join(fixture, "scripts"));
    mkdirSync(join(fixture, "lib/runtime"), { recursive: true });
    writeFileSync(join(fixture, "scripts/build-root.mjs"), read("scripts/build-root.mjs"));
    writeFileSync(join(fixture, "lib/runtime/deployment-lanes.mjs"), read("lib/runtime/deployment-lanes.mjs"));
    writeFileSync(join(fixture, "package.json"), '{"private":true}\n');

    const npm = join(fixture, "npm");
    writeFileSync(npm, `#!${process.execPath}
console.log(JSON.stringify({
  command: "npm",
  args: process.argv.slice(2),
  env: {
    provider: process.env.CCPUN_DEPLOYMENT_PROVIDER,
    role: process.env.CCPUN_DEPLOYMENT_ROLE,
    appEnv: process.env.CCPUN_APP_ENV,
    publicAppEnv: process.env.NEXT_PUBLIC_CCPUN_APP_ENV,
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET,
    uat: process.env.CCPUN_UAT_MODE,
    analytics: process.env.CCPUN_ENABLE_PRODUCTION_ANALYTICS,
    gitRef: process.env.CCPUN_GIT_REF,
    gitSha: process.env.CCPUN_GIT_SHA,
    releaseId: process.env.CCPUN_RELEASE_ID,
    stage: process.env.CCPUN_RELEASE_STAGE,
  },
}));
`);
    chmodSync(npm, 0o755);

    for (const args of [
      ["init", "-b", "v4-production"],
      ["config", "user.email", "fixture@example.invalid"],
      ["config", "user.name", "Fixture"],
      ["add", "."],
      ["commit", "-m", "fixture"],
    ]) {
      const git = spawnSync("git", args, { cwd: fixture, encoding: "utf8" });
      assert.equal(git.status, 0, git.stderr);
    }
    const sha = spawnSync("git", ["rev-parse", "HEAD"], { cwd: fixture, encoding: "utf8" }).stdout.trim();

    const result = spawnSync(process.execPath, [join(fixture, "scripts/build-root.mjs")], {
      cwd: fixture,
      encoding: "utf8",
      env: { PATH: `${fixture}:${process.env.PATH ?? ""}`, HOME: process.env.HOME },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Hostinger Production build identity inferred from v4-production/);
    const invocation = JSON.parse(result.stdout.trim().split("\n").at(-1));
    assert.deepEqual(invocation.args, ["run", "build", "--workspace", "@ccpun/web"]);
    assert.deepEqual(invocation.env, {
      provider: "hostinger",
      role: "web",
      appEnv: "production",
      publicAppEnv: "production",
      projectId: "kyfxgjnq",
      dataset: "production",
      uat: "0",
      analytics: "1",
      gitRef: "v4-production",
      gitSha: sha,
      releaseId: `hostinger-web-prod-${sha.slice(0, 12)}`,
      stage: "live",
    });
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("pinned Hostinger Web UAT root build self-identifies the isolated shadow lane when hPanel env is empty", { skip: process.platform === "win32" }, () => {
  const fixture = mkdtempSync(join(tmpdir(), "ccpun-root-uat-build-"));
  try {
    mkdirSync(join(fixture, "scripts"));
    mkdirSync(join(fixture, "lib/runtime"), { recursive: true });
    writeFileSync(join(fixture, "scripts/build-root.mjs"), read("scripts/build-root.mjs"));
    writeFileSync(join(fixture, "lib/runtime/deployment-lanes.mjs"), read("lib/runtime/deployment-lanes.mjs"));
    writeFileSync(join(fixture, "package.json"), '{"private":true}\n');

    const npm = join(fixture, "npm");
    writeFileSync(npm, `#!${process.execPath}
console.log(JSON.stringify({
  command: "npm",
  args: process.argv.slice(2),
  env: {
    provider: process.env.CCPUN_DEPLOYMENT_PROVIDER,
    role: process.env.CCPUN_DEPLOYMENT_ROLE,
    appEnv: process.env.CCPUN_APP_ENV,
    publicAppEnv: process.env.NEXT_PUBLIC_CCPUN_APP_ENV,
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET,
    uat: process.env.CCPUN_UAT_MODE,
    analytics: process.env.CCPUN_ENABLE_PRODUCTION_ANALYTICS,
    gitRef: process.env.CCPUN_GIT_REF,
    gitSha: process.env.CCPUN_GIT_SHA,
    releaseId: process.env.CCPUN_RELEASE_ID,
    stage: process.env.CCPUN_RELEASE_STAGE,
  },
}));
`);
    chmodSync(npm, 0o755);

    const branch = "codex/hostinger-release-uat-fixture123";
    for (const args of [
      ["init", "-b", branch],
      ["config", "user.email", "fixture@example.invalid"],
      ["config", "user.name", "Fixture"],
      ["add", "."],
      ["commit", "-m", "fixture"],
    ]) {
      const git = spawnSync("git", args, { cwd: fixture, encoding: "utf8" });
      assert.equal(git.status, 0, git.stderr);
    }
    const sha = spawnSync("git", ["rev-parse", "HEAD"], { cwd: fixture, encoding: "utf8" }).stdout.trim();

    const result = spawnSync(process.execPath, [join(fixture, "scripts/build-root.mjs")], {
      cwd: fixture,
      encoding: "utf8",
      env: { PATH: `${fixture}:${process.env.PATH ?? ""}`, HOME: process.env.HOME },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Hostinger Web UAT build identity inferred from codex\/hostinger-release-uat-/);
    const invocation = JSON.parse(result.stdout.trim().split("\n").at(-1));
    assert.deepEqual(invocation.args, ["run", "build", "--workspace", "@ccpun/web"]);
    assert.deepEqual(invocation.env, {
      provider: "hostinger",
      role: "web",
      appEnv: "web-uat",
      publicAppEnv: "web-uat",
      projectId: "ccb9lnw5",
      dataset: "uat",
      uat: "1",
      analytics: "0",
      gitRef: branch,
      gitSha: sha,
      releaseId: `hostinger-web-uat-${sha.slice(0, 12)}`,
      stage: "shadow",
    });
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("pinned Admin UAT release slot self-identifies full native-neon and binds the actual checked-out SHA without inventing secrets", { skip: process.platform === "win32" }, () => {
  const fixture = mkdtempSync(join(tmpdir(), "ccpun-root-admin-uat-build-"));
  try {
    mkdirSync(join(fixture, "scripts"));
    mkdirSync(join(fixture, "lib/runtime"), { recursive: true });
    writeFileSync(join(fixture, "scripts/build-root.mjs"), read("scripts/build-root.mjs"));
    writeFileSync(join(fixture, "lib/runtime/deployment-lanes.mjs"), read("lib/runtime/deployment-lanes.mjs"));
    writeFileSync(join(fixture, "package.json"), '{"private":true}\n');
    const npm = join(fixture, "npm");
    writeFileSync(npm, `#!${process.execPath}\nconsole.log(JSON.stringify({args:process.argv.slice(2),env:{provider:process.env.CCPUN_DEPLOYMENT_PROVIDER,role:process.env.CCPUN_DEPLOYMENT_ROLE,appEnv:process.env.CCPUN_APP_ENV,profile:process.env.CCPUN_ADMIN_CAPABILITY_PROFILE,backend:process.env.CCPUN_ARTICLE_SCHEDULER_BACKEND,producer:process.env.CCPUN_ARTICLE_SCHEDULING_ENABLED,executor:process.env.CCPUN_ARTICLE_SCHEDULE_EXECUTOR_ENABLED,plane:process.env.CCPUN_ARTICLE_SCHEDULE_EXECUTION_PLANE,nativeWorkflow:process.env.CCPUN_NATIVE_WORKFLOW_ENABLED,social:process.env.CCPUN_SOCIAL_ENABLED,socialMode:process.env.CCPUN_SOCIAL_DATA_MODE,socialOps:process.env.CCPUN_SOCIAL_OPERATIONS_ENABLED,socialReads:process.env.CCPUN_SOCIAL_PROVIDER_READS_ENABLED,socialWrites:process.env.CCPUN_SOCIAL_PROVIDER_WRITES_ENABLED,socialAnalytics:process.env.CCPUN_SOCIAL_ANALYTICS_INGESTION_ENABLED,project:process.env.CCPUN_NEON_PROJECT_ID,branch:process.env.CCPUN_NEON_BRANCH_ID,endpoint:process.env.CCPUN_NEON_ENDPOINT_ID,database:process.env.CCPUN_NEON_DATABASE,authUrl:process.env.AUTH_URL,gitRef:process.env.CCPUN_GIT_REF,gitSha:process.env.CCPUN_GIT_SHA,publicGitRef:process.env.NEXT_PUBLIC_CCPUN_GIT_REF,publicGitSha:process.env.NEXT_PUBLIC_CCPUN_GIT_SHA,publicReleaseId:process.env.NEXT_PUBLIC_CCPUN_RELEASE_ID,releaseId:process.env.CCPUN_RELEASE_ID,dbUrl:process.env.CCPUN_ADMIN_DATABASE_URL}}));`);
    chmodSync(npm, 0o755);
    for (const args of [["init", "-b", "phase3-fixture"], ["config", "user.email", "fixture@example.invalid"], ["config", "user.name", "Fixture"], ["add", "."], ["commit", "-m", "fixture"]]) {
      const git = spawnSync("git", args, { cwd: fixture, encoding: "utf8" }); assert.equal(git.status, 0, git.stderr);
    }
    const sha = spawnSync("git", ["rev-parse", "HEAD"], { cwd: fixture, encoding: "utf8" }).stdout.trim();
    const branch = `admin/hostinger-release-uat-${"1".repeat(40)}`;
    assert.equal(spawnSync("git", ["branch", "-m", branch], { cwd: fixture }).status, 0);
    const result = spawnSync(process.execPath, [join(fixture, "scripts/build-root.mjs")], {
      cwd: fixture, encoding: "utf8", env: { PATH: `${fixture}:${process.env.PATH ?? ""}`, HOME: process.env.HOME },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Hostinger Admin UAT build identity inferred from pinned release ref/);
    const invocation = JSON.parse(result.stdout.trim().split("\n").at(-1));
    assert.deepEqual(invocation.args, ["run", "build", "--workspace", "@ccpun/admin"]);
    assert.deepEqual(invocation.env, {
      provider: "hostinger", role: "admin", appEnv: "admin-uat", profile: "full", backend: "native-neon",
      producer: "1", executor: "0", plane: "cloud", nativeWorkflow: "0",
      social: "1", socialMode: "synthetic", socialOps: "1", socialReads: "0", socialWrites: "0", socialAnalytics: "0",
      project: "young-term-47483330", branch: "br-crimson-mouse-az7ajkv8", endpoint: "ep-mute-frost-aztvz394", database: "neondb",
      authUrl: "https://admin-test.ccpun.com", gitRef: branch, gitSha: sha,
      publicGitRef: branch, publicGitSha: sha,
      publicReleaseId: `hostinger-admin-uat-${sha.slice(0, 12)}`,
      releaseId: `hostinger-admin-uat-${sha.slice(0, 12)}`,
    });
    assert.equal(invocation.env.dbUrl, undefined, "release bootstrap must never synthesize the Admin database secret");

    assert.equal(spawnSync("git", ["checkout", "--detach"], { cwd: fixture }).status, 0);
    const detached = spawnSync(process.execPath, [join(fixture, "scripts/build-root.mjs")], {
      cwd: fixture,
      encoding: "utf8",
      env: {
        PATH: `${fixture}:${process.env.PATH ?? ""}`,
        HOME: process.env.HOME,
        CCPUN_DEPLOYMENT_PROVIDER: "hostinger",
        CCPUN_DEPLOYMENT_ROLE: "admin",
        CCPUN_GIT_REF: branch,
        CCPUN_GIT_SHA: "a".repeat(40),
        CCPUN_RELEASE_ID: "stale-release",
        NEXT_PUBLIC_CCPUN_GIT_REF: branch,
        NEXT_PUBLIC_CCPUN_GIT_SHA: "b".repeat(40),
        NEXT_PUBLIC_CCPUN_RELEASE_ID: "stale-public-release",
      },
    });
    assert.equal(detached.status, 0, detached.stderr);
    const detachedEnv = JSON.parse(detached.stdout.trim().split("\n").at(-1)).env;
    assert.equal(detachedEnv.gitRef, branch);
    assert.equal(detachedEnv.gitSha, sha);
    assert.equal(detachedEnv.publicGitRef, branch);
    assert.equal(detachedEnv.publicGitSha, sha);
    assert.equal(detachedEnv.releaseId, `hostinger-admin-uat-${sha.slice(0, 12)}`);
    assert.equal(detachedEnv.publicReleaseId, `hostinger-admin-uat-${sha.slice(0, 12)}`);

    assert.equal(spawnSync("git", ["checkout", branch], { cwd: fixture }).status, 0);
    const legacyEditorial = spawnSync(process.execPath, [join(fixture, "scripts/build-root.mjs")], {
      cwd: fixture, encoding: "utf8", env: {
        PATH: `${fixture}:${process.env.PATH ?? ""}`, HOME: process.env.HOME,
        CCPUN_DEPLOYMENT_PROVIDER: "hostinger", CCPUN_DEPLOYMENT_ROLE: "admin",
        CCPUN_ADMIN_CAPABILITY_PROFILE: "editorial", NEXT_PUBLIC_CCPUN_ADMIN_CAPABILITY_PROFILE: "editorial",
        CCPUN_ARTICLE_SCHEDULER_BACKEND: "disabled", NEXT_PUBLIC_CCPUN_ARTICLE_SCHEDULER_BACKEND: "disabled",
      },
    });
    assert.equal(legacyEditorial.status, 0, legacyEditorial.stderr);
    const promoted = JSON.parse(legacyEditorial.stdout.trim().split("\n").at(-1)).env;
    assert.equal(promoted.profile, "full");
    assert.equal(promoted.backend, "native-neon");
    for (const conflict of [
      { CCPUN_DEPLOYMENT_PROVIDER: "vercel" },
      { CCPUN_DEPLOYMENT_PROVIDER: "hostinger", CCPUN_DEPLOYMENT_ROLE: "web" },
    ]) {
      const denied = spawnSync(process.execPath, [join(fixture, "scripts/build-root.mjs")], {
        cwd: fixture, encoding: "utf8", env: { PATH: `${fixture}:${process.env.PATH ?? ""}`, HOME: process.env.HOME, ...conflict },
      });
      assert.notEqual(denied.status, 0);
      assert.match(denied.stderr, /ADMIN_UAT_RELEASE_(?:PROVIDER|ROLE)_CONFLICT/);
    }
  } finally { rmSync(fixture, { recursive: true, force: true }); }
});

test("Hostinger Admin readiness certifies only full native-neon pinned lanes without echoing database secrets", () => {
  for (const environment of ["admin-uat", "production-admin"]) {
    const ok = runAdminReadiness(environment);
    assert.equal(ok.status, 0, ok.stderr || ok.stdout);
    const receipt = JSON.parse(ok.stdout);
    assert.equal(receipt.status, "ready");
    assert.deepEqual(receipt.warnings, []);
    assert.doesNotMatch(ok.stdout, /FIXTURE_ONLY/);
  }
  for (const [key, value] of [
    ["CCPUN_ADMIN_CAPABILITY_PROFILE", "editorial"],
    ["NEXT_PUBLIC_CCPUN_ADMIN_CAPABILITY_PROFILE", "editorial"],
    ["CCPUN_ARTICLE_SCHEDULER_BACKEND", "disabled"],
    ["CCPUN_ARTICLE_SCHEDULE_EXECUTOR_ENABLED", "1"],
    ["CCPUN_BACKGROUND_WORKER_ENABLED", "1"],
    ["CCPUN_NATIVE_WORKFLOW_ENABLED", "1"],
    ["CCPUN_SOCIAL_ENABLED", "0"],
    ["CCPUN_SOCIAL_DATA_MODE", "live"],
    ["CCPUN_SOCIAL_OPERATIONS_ENABLED", "0"],
    ["CCPUN_SOCIAL_PROVIDER_READS_ENABLED", "1"],
    ["CCPUN_SOCIAL_PROVIDER_WRITES_ENABLED", "1"],
    ["CCPUN_SOCIAL_ANALYTICS_INGESTION_ENABLED", "1"],
    ["CCPUN_NEON_BRANCH_ID", "wrong"],
    ["AUTH_URL", "https://admin.ccpun.com"],
    ["CCPUN_GIT_REF", "admin/hostinger-release-uat-wrong"],
    ["CCPUN_ADMIN_DATABASE_URL", "postgresql://ccpun_admin_runtime:SECRET_SHOULD_NOT_LEAK@evil.example/neondb?sslmode=require"],
  ]) {
    const blocked = runAdminReadiness("admin-uat", { [key]: value });
    assert.notEqual(blocked.status, 0, `${key} must fail closed`);
    assert.equal(JSON.parse(blocked.stdout).status, "blocked");
    assert.doesNotMatch(blocked.stdout, /FIXTURE_ONLY|SECRET_SHOULD_NOT_LEAK/);
  }
});

test("Hostinger Web readiness accepts only the explicit live production identity", () => {
  const ok = runReadiness();
  assert.equal(ok.status, 0, ok.stderr || ok.stdout);
  assert.match(ok.stdout, /"status": "ready"/);
  assert.match(ok.stdout, /"releaseStage": "live"/);
  assert.match(ok.stdout, /"gitRef": "v4-production"/);

  const fakeVercel = runReadiness({ VERCEL_PROJECT_ID: "prj_fake" });
  assert.notEqual(fakeVercel.status, 0);
  assert.match(fakeVercel.stdout, /VERCEL_PROJECT_ID must be unset/);

  for (const [key, value] of [
    ["CCPUN_UAT_MODE", "1"],
    ["CCPUN_ENABLE_PRODUCTION_ANALYTICS", "0"],
    ["CCPUN_GIT_REF", "wrong-branch"],
    ["CCPUN_GIT_SHA", ""],
    ["CCPUN_RELEASE_ID", ""],
  ]) {
    const result = runReadiness({ [key]: value });
    assert.notEqual(result.status, 0, `${key} must block an uncertified live release`);
  }
});

test("Hostinger Web live readiness preserves a truthful SHA-matching pinned release identity", () => {
  const sha = "215990493dbcc61bf23c187d8288c17809907d17";
  const ref = `codex/hostinger-release-production-${sha}`;
  const result = runReadiness({ CCPUN_GIT_REF: ref, CCPUN_GIT_SHA: sha });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const receipt = JSON.parse(result.stdout);
  assert.equal(receipt.status, "ready");
  assert.equal(receipt.releaseStage, "live");
  assert.equal(receipt.release.gitRef, ref);
  assert.equal(receipt.release.gitSha, sha);
});

test("Hostinger Web live readiness denies malformed and mismatched pinned release metadata", () => {
  const sha = "215990493dbcc61bf23c187d8288c17809907d17";
  const prefix = "codex/hostinger-release-production-";
  for (const [ref, configuredSha] of [
    [`${prefix}${sha}`, "0".repeat(40)],
    [`${prefix}${sha.slice(1)}`, sha.slice(1)],
    [`${prefix}${sha}0`, `${sha}0`],
    [`${prefix}${sha.toUpperCase()}`, sha.toUpperCase()],
    [`${prefix}${"g".repeat(40)}`, "g".repeat(40)],
    [`${prefix}${sha}`, ""],
    [prefix, sha],
    [`refs/heads/${prefix}${sha}`, sha],
    [`${prefix}${sha}/extra`, sha],
    [`codex/hostinger-release-uat-${sha}`, sha],
    [`v4-production-${sha}`, sha],
  ]) {
    const result = runReadiness({ CCPUN_GIT_REF: ref, CCPUN_GIT_SHA: configuredSha });
    assert.notEqual(result.status, 0, `${ref} must fail with SHA ${configuredSha}`);
    assert.equal(JSON.parse(result.stdout).status, "blocked");
  }
});

test("pinned Web release refs do not bypass existing Production identity or live policy", () => {
  const sha = "215990493dbcc61bf23c187d8288c17809907d17";
  const pinned = { CCPUN_GIT_REF: `codex/hostinger-release-production-${sha}`, CCPUN_GIT_SHA: sha };
  for (const [key, value] of [
    ["CCPUN_DEPLOYMENT_PROVIDER", "vercel"],
    ["CCPUN_DEPLOYMENT_PROVIDER", "local"],
    ["CCPUN_DEPLOYMENT_ROLE", "admin"],
    ["CCPUN_DEPLOYMENT_ROLE", "unknown"],
    ["CCPUN_APP_ENV", "web-uat"],
    ["NEXT_PUBLIC_CCPUN_APP_ENV", "web-uat"],
    ["NEXT_PUBLIC_SANITY_PROJECT_ID", "ccb9lnw5"],
    ["NEXT_PUBLIC_SANITY_DATASET", "uat"],
    ["CCPUN_RELEASE_STAGE", "shadow"],
    ["CCPUN_UAT_MODE", "1"],
    ["CCPUN_ENABLE_PRODUCTION_ANALYTICS", "0"],
    ["CCPUN_RELEASE_ID", ""],
    ["VERCEL_PROJECT_ID", "prj_fake"],
    ["VERCEL_ENV", "production"],
  ]) {
    const result = runReadiness({ ...pinned, [key]: value });
    assert.notEqual(result.status, 0, `${key} must retain its existing denial`);
    assert.equal(JSON.parse(result.stdout).status, "blocked");
  }
});

test("Hostinger production candidate uses Production Sanity while remaining noindex and analytics-off", () => {
  const candidate = runReadiness({
    CCPUN_RELEASE_STAGE: "candidate",
    CCPUN_UAT_MODE: "1",
    CCPUN_ENABLE_PRODUCTION_ANALYTICS: "0",
    CCPUN_GIT_REF: "prep/hostinger-migration-readiness-20260929",
    CCPUN_GIT_SHA: "candidate-sha",
    CCPUN_RELEASE_ID: "hostinger-candidate-candidate-sha",
  });
  assert.equal(candidate.status, 0, candidate.stderr || candidate.stdout);
  assert.match(candidate.stdout, /"releaseStage": "candidate"/);

  const indexableCandidate = runReadiness({
    CCPUN_RELEASE_STAGE: "candidate",
    CCPUN_UAT_MODE: "0",
    CCPUN_ENABLE_PRODUCTION_ANALYTICS: "0",
    CCPUN_GIT_REF: "prep/hostinger-migration-readiness-20260929",
  });
  assert.notEqual(indexableCandidate.status, 0);
  assert.match(indexableCandidate.stdout, /CCPUN_UAT_MODE=.*expected.*1/);

  const trackedCandidate = runReadiness({
    CCPUN_RELEASE_STAGE: "candidate",
    CCPUN_UAT_MODE: "1",
    CCPUN_ENABLE_PRODUCTION_ANALYTICS: "1",
    CCPUN_GIT_REF: "prep/hostinger-migration-readiness-20260929",
  });
  assert.notEqual(trackedCandidate.status, 0);
  assert.match(trackedCandidate.stdout, /CCPUN_ENABLE_PRODUCTION_ANALYTICS=.*expected.*0/);
});

test("Hostinger Web readiness accepts the explicit Shadow UAT identity and rejects an indexable UAT mode", () => {
  const uat = runReadiness({
    CCPUN_RELEASE_STAGE: "shadow",
    CCPUN_APP_ENV: "web-uat",
    NEXT_PUBLIC_CCPUN_APP_ENV: "web-uat",
    NEXT_PUBLIC_SANITY_PROJECT_ID: "ccb9lnw5",
    NEXT_PUBLIC_SANITY_DATASET: "uat",
    CCPUN_UAT_MODE: "1",
    CCPUN_ENABLE_PRODUCTION_ANALYTICS: "0",
    CCPUN_GIT_REF: "",
    CCPUN_GIT_SHA: "",
    CCPUN_RELEASE_ID: "",
  });
  assert.equal(uat.status, 0, uat.stderr || uat.stdout);
  assert.match(uat.stdout, /"status": "ready"/);

  const unsafeUat = runReadiness({
    CCPUN_RELEASE_STAGE: "shadow",
    CCPUN_APP_ENV: "web-uat",
    NEXT_PUBLIC_CCPUN_APP_ENV: "web-uat",
    NEXT_PUBLIC_SANITY_PROJECT_ID: "ccb9lnw5",
    NEXT_PUBLIC_SANITY_DATASET: "uat",
    CCPUN_UAT_MODE: "0",
    CCPUN_ENABLE_PRODUCTION_ANALYTICS: "0",
    CCPUN_GIT_REF: "",
    CCPUN_GIT_SHA: "",
    CCPUN_RELEASE_ID: "",
  });
  assert.notEqual(unsafeUat.status, 0);
  assert.match(unsafeUat.stdout, /CCPUN_UAT_MODE=.*expected.*1/);
});

test("Hostinger standalone packaging traces and preserves public assets", () => {
  const buildProvider = read("apps/web/scripts/build-provider.mjs");
  const web = read("apps/web/next.config.ts");
  assert.match(web, /outputFileTracingIncludes/);
  assert.match(web, /"public\/\*\*\/\*"/);
  assert.match(web, /"\.\.\/\.\.\/public\/\*\*\/\*"/);
  assert.match(web, /HOSTINGER_PUBLIC_FALLBACK/);
  assert.match(web, /source: "\/assets\/:path\*"/);
  assert.match(web, /source: "\/llms\.txt"/);
  assert.match(web, /source: "\/\.well-known\/:path\*"/);
  assert.match(buildProvider, /\.next\/static\/ccpun-public/);
  assert.match(buildProvider, /replaceDirectory\(extractedPublic, webPublic\)/);
  assert.match(buildProvider, /"public\/llms\.txt"/);
  assert.match(buildProvider, /"public\/\.well-known\/security\.txt"/);
  assert.match(buildProvider, /"public\/favicon\.ico"/);
  assert.match(buildProvider, /"\.next\/static\/ccpun-public\/llms\.txt"/);
  assert.match(buildProvider, /"\.next\/static\/ccpun-public\/\.well-known\/security\.txt"/);
});

test("shadow schema parity ignores only content-dependent Blog ItemList", () => {
  const schema = [{ "@type": "WebSite" }, { "@type": "ItemList" }, { "@type": "BreadcrumbList" }];
  assert.deepEqual(shadowSchemaTypes("/blog/", schema), ["BreadcrumbList", "WebSite"]);
  assert.deepEqual(shadowSchemaTypes("/", schema), ["BreadcrumbList", "ItemList", "WebSite"]);
});

test("Hostinger parity gate keeps mode boundaries and fails closed on missing runtime or incorrectly grouped robots", async () => {
  const unavailable = async () => new Response("missing", { status: 404 });
  for (const targetMode of ["shadow", "candidate", "production"]) {
    const result = await runParity({ source: "https://source.example", target: "https://target.example", targetMode, fetcher: unavailable });
    assert.equal(result.blockedTarget, targetMode !== "production");
    assert.equal(result.fullContentParity, targetMode !== "shadow");
    assert.equal(result.status, "blocked");
    assert.ok(result.failures.length > 0);
  }
  await assert.rejects(() => runParity({ source: "https://source.example", target: "https://target.example", targetMode: "unknown", fetcher: unavailable }), /invalid mode/);
  assert.deepEqual(blockedRobotsErrors("User-agent: *\nDisallow: /\n"), []);
  assert.ok(blockedRobotsErrors("User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nAllow: /\n").length > 0);
});

function artifactFixture(t) {
  const repository = mkdtempSync(join(tmpdir(), "ccpun-artifact-fixture-"));
  const output = mkdtempSync(join(tmpdir(), "ccpun-artifact-output-"));
  t.after(() => { rmSync(repository, { recursive: true, force: true }); rmSync(output, { recursive: true, force: true }); });
  const root = join(repository, "apps/web");
  const runtime = join(root, ".next/standalone");
  const write = (path, content = "fixture") => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, content); };
  mkdirSync(root, { recursive: true });
  write(join(repository, ".gitignore"), ".next/\n");
  write(join(repository, "package-lock.json"), '{"lockfileVersion":3}\n');
  const git = (args) => { const result = spawnSync("git", args, { cwd: repository, encoding: "utf8" }); assert.equal(result.status, 0, result.stderr); return result.stdout.trim(); };
  git(["init", "--initial-branch=fixture"]);
  git(["add", "."]);
  git(["-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-m", "Fixture"]);
  const variables = { CCPUN_DEPLOYMENT_PROVIDER: "hostinger", CCPUN_DEPLOYMENT_ROLE: "web", CCPUN_RELEASE_STAGE: "shadow", CCPUN_APP_ENV: "web-uat", NEXT_PUBLIC_CCPUN_APP_ENV: "web-uat", NEXT_PUBLIC_SANITY_PROJECT_ID: "ccb9lnw5", NEXT_PUBLIC_SANITY_DATASET: "uat", CCPUN_UAT_MODE: "1", CCPUN_ENABLE_PRODUCTION_ANALYTICS: "0", CCPUN_GIT_REF: "fixture", CCPUN_GIT_SHA: git(["rev-parse", "HEAD"]), UNRELATED_PRIVATE_SETTING: "fixture-not-for-manifest" };
  for (const file of [".next/BUILD_ID", ".next/static/bootstrap.js", "public/llms.txt", "public/favicon.ico"]) write(join(runtime, file));
  write(join(runtime, "node_modules/next/package.json"), '{"name":"next"}');
  write(join(runtime, "server.js"), 'console.log("restored-launch-ok")');
  return { repository, root, runtime, output, variables, write, git, seal: () => sealStandaloneProvenance(captureStandaloneProvenance(root, variables), root) };
}

test("native UAT artifact extracts with launch inputs, relative workspace links, and verified archive digest", (t) => {
  const f = artifactFixture(t);
  symlinkSync("next", join(f.runtime, "node_modules/workspace-link"));
  f.seal();
  const result = archiveStandaloneRuntime(f.output, f.root);
  assert.equal(result.digest, createHash("sha256").update(readFileSync(result.archive)).digest("hex"));
  const restored = join(f.output, "restored");
  mkdirSync(restored);
  const extraction = spawnSync("tar", ["-xzf", result.archive, "-C", restored]);
  assert.equal(extraction.status, 0);
  assert.ok(existsSync(join(restored, ".next/BUILD_ID")));
  assert.ok(existsSync(join(restored, "public/llms.txt")));
  assert.ok(lstatSync(join(restored, "node_modules/workspace-link")).isSymbolicLink());
  const launch = spawnSync(process.execPath, ["server.js"], { cwd: restored, encoding: "utf8" });
  assert.equal(launch.status, 0);
  assert.match(launch.stdout, /restored-launch-ok/);
  assert.doesNotMatch(readFileSync(join(restored, "ccpun-build-provenance.json"), "utf8"), /UNRELATED_PRIVATE_SETTING|fixture-not-for-manifest/);
  assert.throws(() => archiveStandaloneRuntime(f.output, f.root), /already exists/);
});

test("artifact source provenance denies fake SHA/ref, dirty source, wrong lane, and stale commits", (t) => {
  const f = artifactFixture(t);
  assert.throws(() => captureStandaloneProvenance(f.root, { ...f.variables, CCPUN_GIT_SHA: "0".repeat(40) }), /SHA/);
  assert.throws(() => captureStandaloneProvenance(f.root, { ...f.variables, CCPUN_GIT_REF: "v4-production" }), /ref/);
  assert.throws(() => captureStandaloneProvenance(f.root, { ...f.variables, CCPUN_UAT_MODE: "0" }), /UAT contract/);
  f.seal();
  f.write(join(f.repository, "package-lock.json"), '{"lockfileVersion":3,"changed":true}');
  assert.throws(() => archiveStandaloneRuntime(f.output, f.root), /clean source/);
  f.git(["add", "package-lock.json"]);
  f.git(["-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-m", "Changed fixture"]);
  assert.throws(() => archiveStandaloneRuntime(f.output, f.root), /stale/);
});

test("artifact denies changed runtime bytes and unsupported provenance fields", (t) => {
  const f = artifactFixture(t);
  f.seal();
  f.write(join(f.runtime, "public/llms.txt"), "changed-bytes");
  assert.throws(() => archiveStandaloneRuntime(f.output, f.root), /digest mismatch/);
  const path = join(f.runtime, "ccpun-build-provenance.json");
  const provenance = JSON.parse(readFileSync(path, "utf8"));
  f.write(path, JSON.stringify({ ...provenance, unexpectedSetting: "fixture" }));
  assert.throws(() => archiveStandaloneRuntime(f.output, f.root), /Unsupported artifact provenance/);
});

test("artifact rejects escaping links and forbidden config filenames before creating an archive", async (t) => {
  for (const kind of ["escape-link", "absolute-link", "dangling-link", ".env.fixture", "auth-fixture.json", "private-secret.json", ".npmrc", "credentials"]) {
    await t.test(kind, (t) => {
      const f = artifactFixture(t);
      if (kind === "escape-link") symlinkSync("../../../../package-lock.json", join(f.runtime, "outside"));
      else if (kind === "absolute-link") symlinkSync(join(f.runtime, "server.js"), join(f.runtime, "absolute"));
      else if (kind === "dangling-link") symlinkSync("missing", join(f.runtime, "dangling"));
      else f.write(join(f.runtime, kind));
      assert.throws(() => f.seal(), /escapes|relocatable|Forbidden|unresolved/);
      assert.deepEqual(readdirSync(f.output), []);
    });
  }
});

test("artifact preflight rejects local environment files without opening them", (t) => {
  const f = artifactFixture(t);
  f.write(join(f.root, ".env.fixture"));
  assert.throws(() => captureStandaloneProvenance(f.root, f.variables), /local environment files/);
});

test("artifact refuses missing provenance and incomplete standalone launch shape", (t) => {
  const f = artifactFixture(t);
  assert.throws(() => archiveStandaloneRuntime(f.output, f.root), /Missing same-build/);
  rmSync(join(f.runtime, ".next/BUILD_ID"));
  f.seal();
  assert.throws(() => archiveStandaloneRuntime(f.output, f.root), /launch input/);
});

test("artifact output cannot alias back into the runtime being archived", (t) => {
  const f = artifactFixture(t);
  f.seal();
  const outputLink = join(f.output, "runtime-alias");
  symlinkSync(f.runtime, outputLink);
  assert.throws(() => archiveStandaloneRuntime(outputLink, f.root), /outside the runtime tree/);
  assert.equal(readdirSync(f.runtime).some((name) => name.endsWith(".tar.gz")), false);
});

test("native archive upload is manual opt-in UAT and does not add provider credentials or deployment", () => {
  const workflow = read(".github/workflows/hostinger-migration-readiness.yml");
  assert.match(workflow, /export_web_uat_artifact:[\s\S]*?type: boolean[\s\S]*?default: false/);
  assert.match(workflow, /if: github\.event_name == 'workflow_dispatch' && inputs\.export_web_uat_artifact/g);
  assert.match(workflow, /--archive-standalone \/tmp\/ccpun-native-web-artifact/);
  assert.match(workflow, /actions\/upload-artifact@v7\.0\.1/);
  assert.match(workflow, /if-no-files-found: error/);
  assert.doesNotMatch(workflow, /secrets\.|ssh |scp |hostinger.*deploy|VERCEL_TOKEN/);
});
