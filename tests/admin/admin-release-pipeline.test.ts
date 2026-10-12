import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";

const workflow = readFileSync(".github/workflows/seo-topic-hubs-ci.yml", "utf8");
const nativeEntry = readFileSync("scripts/build-root.mjs", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

test("Foundation CI verifies Production changes without automatic deployment", () => {
  assert.match(workflow, /push:\s*\n\s*branches: \[v4-production\]/);
  assert.match(workflow, /pull_request:\s*\n\s*branches: \[v4-production\]/);
  const jobs = workflow.split("\njobs:\n")[1];
  assert.deepEqual(jobs?.match(/^  [a-z][a-z-]*:$/gm), ["  verify:"]);
  assert.match(workflow, /run: npm ci/);
  assert.match(workflow, /run: npm run lint/);
  assert.match(workflow, /run: npx tsc --noEmit --incremental false/);
  assert.match(workflow, /run: npm run test:architecture/);
  assert.match(workflow, /run: npm run test:foundation-contracts/);
  assert.match(workflow, /run: npm run test:public/);
  assert.match(workflow, /run: npm run build/);
  assert.doesNotMatch(workflow, /promote-admin|promote-admin-after-ci|secrets\.VERCEL_TOKEN/);
  assert.doesNotMatch(workflow, /(?:vercel|hostinger)\s+deploy|start-build|docker\s+(?:push|compose)/i);
});


test("Retired provider promoter and config cannot grant an Admin release authority", () => {
  for (const file of ["scripts/promote-admin-after-ci.mjs", "scripts/vercel-ignore-build.mjs", "apps/admin/vercel.json"]) {
    assert.equal(existsSync(file), false, file);
  }
  assert.doesNotMatch(workflow, /CCPUN_ADMIN_PROJECT_NAME/);
  assert.doesNotMatch(nativeEntry, /ccpun-admin-prod/);
  assert.equal(packageJson.scripts.build, "node scripts/build-root.mjs");
  assert.equal(packageJson.scripts["build:hostinger"], "npm run build --workspace @ccpun/web");
  assert.match(packageJson.scripts["test:foundation-contracts"], /tests\/hostinger-native-app-contract\.test\.mjs/);
});

test("Native dispatcher rejects retired provider and missing Admin role before build", () => {
  for (const { patch, code } of [
    { patch: { CCPUN_DEPLOYMENT_PROVIDER: "vercel", CCPUN_DEPLOYMENT_ROLE: "admin" }, code: "UNSUPPORTED_BUILD_PROVIDER" },
    { patch: { CCPUN_DEPLOYMENT_PROVIDER: "hostinger" }, code: "HOSTINGER_BUILD_ROLE_REQUIRED" },
  ]) {
    const result = spawnSync(process.execPath, ["scripts/build-root.mjs"], {
      encoding: "utf8", env: { PATH: "/usr/local/bin:/usr/bin:/bin", ...patch },
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, new RegExp(code));
    assert.equal(result.stdout, "");
  }
});

test("Native dispatcher rejects retired workflow targets and deployment metadata before build", () => {
  for (const patch of [
    { WORKFLOW_TARGET_WORLD: "vercel" },
    { WORKFLOW_TARGET_WORLD: " @workflow/world-vercel " },
    { VERCEL_DEPLOYMENT_ID: "retired-fixture-only" },
  ]) {
    const result = spawnSync(process.execPath, ["scripts/build-root.mjs"], {
      encoding: "utf8", env: { PATH: "/usr/local/bin:/usr/bin:/bin", CCPUN_DEPLOYMENT_PROVIDER: "hostinger", CCPUN_DEPLOYMENT_ROLE: "admin", ...patch },
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /UNSUPPORTED_WORKFLOW_WORLD|UNSUPPORTED_PROVIDER_METADATA/);
    assert.equal(result.stdout, "");
  }
});

test("Native release checks remain credential-free and cannot initiate automatic provider deployment", () => {
  assert.doesNotMatch(workflow, /secrets\.VERCEL_TOKEN/);
  assert.doesNotMatch(workflow, /VERCEL_TOKEN:\s*vercel_/);
  assert.doesNotMatch(nativeEntry, /vercel_[A-Za-z0-9_-]{10,}/);
  assert.doesNotMatch(nativeEntry, /api\.vercel\.com|VERCEL_TOKEN|required\("VERCEL_TOKEN"/);
  assert.match(nativeEntry, /CCPUN_GIT_SHA: sha/);
  assert.match(nativeEntry, /gitValue\(\["rev-parse", "HEAD"\]\)/);
});
