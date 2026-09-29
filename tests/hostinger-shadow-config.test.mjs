import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildNextSecurityHeaders } from "../apps/next-security-headers.mjs";

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

test("Hostinger standalone packaging preserves public assets through Next static fallback rewrites", () => {
  const buildProvider = read("apps/web/scripts/build-provider.mjs");
  const web = read("apps/web/next.config.ts");
  assert.match(buildProvider, /\.next\/static\/ccpun-public/);
  assert.match(buildProvider, /\.next\/static\/ccpun-public\/llms\.txt/);
  assert.match(buildProvider, /\.next\/static\/ccpun-public\/\.well-known\/security\.txt/);
  assert.match(buildProvider, /\.next\/static\/ccpun-public\/favicon\.ico/);
  assert.match(web, /HOSTINGER_PUBLIC_FALLBACK/);
  assert.match(web, /source: "\/assets\/:path\*"/);
  assert.match(web, /source: "\/llms\.txt"/);
  assert.match(web, /source: "\/\.well-known\/:path\*"/);
});

test("Hostinger parity gate separates UAT Shadow checks from full production-content candidate parity", () => {
  const parity = read("scripts/hostinger-seo-parity.mjs");
  assert.match(parity, /\["shadow", "candidate", "production"\]/);
  assert.match(parity, /blockedTarget = targetMode === "shadow" \|\| targetMode === "candidate"/);
  assert.match(parity, /fullContentParity = targetMode === "candidate" \|\| targetMode === "production"/);
  assert.match(parity, /path !== "\/sitemaps\/blog\.xml"/);
  assert.match(parity, /BLOCKED_ROBOTS_DIRECTIVES = \["noindex", "nofollow", "noarchive"\]/);
  assert.match(parity, /assertBlockedRobotsTxt\(targetRules\)/);
  assert.match(parity, /aiRepresentativePaths = fullContentParity/);
});
