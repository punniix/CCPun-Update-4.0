import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(".github/workflows/seo-topic-hubs-ci.yml", "utf8");
const promoter = readFileSync("scripts/promote-admin-after-ci.mjs", "utf8");

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
  assert.match(workflow, /run: npm run test:vercel/);
  assert.match(workflow, /run: npm run build/);
  assert.doesNotMatch(workflow, /promote-admin|promote-admin-after-ci|secrets\.VERCEL_TOKEN/);
  assert.doesNotMatch(workflow, /(?:vercel|hostinger)\s+deploy|start-build|docker\s+(?:push|compose)/i);
});

test("Retained rollback promoter is pinned to the Admin project and exact commit SHA", () => {
  assert.match(promoter, /DEFAULT_PROJECT_ID = "prj_6tuUxJxYbQ4mpF7sMgNWx2p2jowN"/);
  assert.match(promoter, /DEFAULT_TEAM_ID = "team_GbcO71LS2dLHwiBV6Cs39Kax"/);
  assert.match(promoter, /deployment\?\.meta\?\.githubCommitSha === sha/);
  assert.doesNotMatch(workflow, /CCPUN_ADMIN_PROJECT_NAME/);
  assert.doesNotMatch(promoter, /ccpun-admin-prod/);
  assert.match(promoter, /deployment\?\.state === "READY"/);
});

test("Admin promotion accepts Vercel uid or id and fails closed without either", () => {
  assert.match(promoter, /deployment\?\.uid \?\? deployment\?\.id/);
  assert.match(promoter, /ADMIN_DEPLOYMENT_ID_MISSING/);
  assert.match(promoter, /const candidateId = deploymentIdentifier\(candidate\.deployment\)/);
  assert.match(promoter, /deploymentId: candidateId/);
  assert.match(promoter, /const productionId = deploymentIdentifier\(production\)/);
  assert.doesNotMatch(promoter, /candidate\.deployment\.id/);
});

test("Preview Admin promotion creates a Production deployment like the Vercel CLI", () => {
  assert.match(promoter, /\/v13\/deployments\?\$\{params\.toString\(\)\}/);
  assert.match(promoter, /deploymentId,/);
  assert.match(promoter, /candidate\.deployment\?\.name/);
  assert.match(promoter, /ADMIN_DEPLOYMENT_NAME/);
  assert.match(promoter, /name: projectName/);
  assert.match(promoter, /target: "production"/);
  assert.match(promoter, /meta: \{ action: "promote" \}/);
  assert.match(promoter, /"Content-Type": "application\/json"/);
  assert.match(promoter, /VERCEL_PRODUCTION_CREATE_FAILED_/);
  assert.doesNotMatch(promoter, /\/v10\/projects\/.*\/promote\//);
});

test("Admin promotion remains credential-gated and confirms the exact Production SHA", () => {
  assert.match(promoter, /required\("VERCEL_TOKEN", env\.VERCEL_TOKEN\)/);
  assert.match(promoter, /throw new Error\(`\$\{name\}_MISSING`\)/);
  assert.match(promoter, /ADMIN_READY_DEPLOYMENT_NOT_FOUND/);
  assert.match(promoter, /ADMIN_PRODUCTION_PROMOTION_NOT_CONFIRMED/);
  assert.match(promoter, /ADMIN_PRODUCTION_DEPLOYMENT_/);
  assert.match(promoter, /target === "production"/);
  assert.doesNotMatch(workflow, /secrets\.VERCEL_TOKEN/);
  assert.doesNotMatch(workflow, /VERCEL_TOKEN:\s*vercel_/);
  assert.doesNotMatch(promoter, /vercel_[A-Za-z0-9_-]{10,}/);
});
