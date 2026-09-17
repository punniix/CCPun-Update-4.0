import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("Admin Preview uses the admin feature-branch convention plus exact data-plane guards", () => {
  const runtime = read("lib/admin/social/runtime.ts");
  assert.match(runtime, /SOCIAL_UAT_SANITY_PROJECT_ID = "ccb9lnw5"/);
  assert.match(runtime, /SOCIAL_UAT_SANITY_DATASET = "uat"/);
  assert.match(runtime, /SOCIAL_PRODUCTION_BRANCH = "v4-production"/);
  assert.match(runtime, /branch\.startsWith\("admin\/"\)/);
  assert.match(runtime, /compatibilityBranches\.includes\(branch\)/);
  assert.match(runtime, /gitBranch !== SOCIAL_PRODUCTION_BRANCH/);
});

test("Sanity Free privacy is checked on PR, Production push and manual dispatch without scheduled workload", () => {
  const workflow = read(".github/workflows/sanity-free-plan-privacy.yml");
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /push:\n\s+branches: \[v4-production\]/);
  assert.match(workflow, /pull_request:\n\s+branches: \[v4-production\]/);
  assert.match(workflow, /node qa\/sanity-free-plan-privacy\.mjs/);
  assert.doesNotMatch(workflow, /^\s*schedule\s*:/m);
});

test("Admin extension contract keeps one auth authority and no-cost data ownership", () => {
  const contract = read("docs/architecture/admin-platform-extension-contract.md");
  assert.match(contract, /Auth\.js is the only application authentication authority/);
  assert.match(contract, /Sanity/);
  assert.match(contract, /Neon `ccpun_admin`/);
  assert.match(contract, /Neon `ccpun_social`/);
  assert.match(contract, /No upstream feature may automatically provision a paid Vercel, Sanity, Neon or third-party resource/);
  assert.match(contract, /openquok/);
});

test("Admin app root remains private and independently deployable", () => {
  const nextConfig = read("apps/admin/next.config.ts");
  const vercel = read("apps/admin/vercel.json");
  assert.match(nextConfig, /noindex, nofollow, noarchive/);
  assert.match(nextConfig, /private, no-cache, no-store/);
  assert.match(nextConfig, /withWorkflow\(nextConfig\)/);
  assert.match(vercel, /node \.\.\/\.\.\/scripts\/vercel-ignore-build\.mjs/);
});

test("Admin auth configuration is Auth.js/Google-oriented and does not depend on Neon Auth", () => {
  const authConfig = read("lib/admin/auth-config.ts");
  assert.match(authConfig, /AUTH_GOOGLE_ID/);
  assert.match(authConfig, /AUTH_GOOGLE_SECRET/);
  assert.doesNotMatch(authConfig, /neon_auth|Neon Auth|@neondatabase\/auth/i);
});
