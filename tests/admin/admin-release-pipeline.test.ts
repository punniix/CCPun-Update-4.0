import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(".github/workflows/seo-topic-hubs-ci.yml", "utf8");
const builder = readFileSync("apps/admin/scripts/build-provider.mjs", "utf8");
const config = readFileSync("apps/admin/next.config.ts", "utf8");
const readiness = readFileSync(".github/workflows/hostinger-migration-readiness.yml", "utf8");

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

test("retired vendor promotion cannot be invoked from the source tree", () => {
  assert.equal(existsSync("scripts/promote-admin-after-ci.mjs"), false);
  assert.equal(existsSync("apps/admin/vercel.json"), false);
  assert.equal(existsSync("scripts/vercel-ignore-build.mjs"), false);
  assert.doesNotMatch(workflow, /CCPUN_ADMIN_PROJECT_NAME|secrets\.VERCEL_TOKEN/);
});

test("native Admin build binds the checked-out ref and exact SHA before packaging", () => {
  assert.match(builder, /sha !== variables\.CCPUN_GIT_SHA/);
  assert.match(builder, /checkedOutRef !== variables\.CCPUN_GIT_REF/);
  assert.match(builder, /REF_RESOLUTION_MISMATCH/);
  assert.match(builder, /SHA_MISMATCH/);
  assert.match(builder, /NATIVE_ADMIN_PRODUCTION_BUILD_DENIED/);
  assert.match(builder, /HOSTINGER_BUILD_ROLE_REQUIRED/);
});

test("native Admin keeps standalone packaging and the existing Workflow plugin", () => {
  assert.match(config, /output: "standalone"/);
  assert.match(config, /withWorkflow\(nextConfig\)/);
  assert.match(builder, /Admin standalone entry is missing/);
  assert.match(builder, /Admin standalone runtime is incomplete/);
});

test("native CI builds remain verification-only without credentials or automatic promotion", () => {
  assert.match(readiness, /node-version: 24/);
  assert.match(readiness, /CCPUN_DEPLOYMENT_PROVIDER: hostinger/);
  assert.match(readiness, /CCPUN_DEPLOYMENT_ROLE: web/);
  assert.match(readiness, /CCPUN_GIT_SHA: \$\{\{ github\.sha \}\}/);
  assert.doesNotMatch(readiness, /secrets\.VERCEL_TOKEN|vercel_\w{10,}|promote-admin|start-build|(?:vercel|hostinger)\s+deploy/i);
  assert.doesNotMatch(workflow, /secrets\.VERCEL_TOKEN|VERCEL_TOKEN:\s*vercel_/);
});
