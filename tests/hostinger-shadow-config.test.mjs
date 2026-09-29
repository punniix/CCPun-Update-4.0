import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildNextSecurityHeaders } from "../apps/next-security-headers.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("shadow app configs use an explicit ESM-safe shared security helper", () => {
  const web = read("apps/web/next.config.ts");
  const admin = read("apps/admin/next.config.ts");
  assert.match(web, /from "\.\.\/next-security-headers\.mjs"/);
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

function runReadiness(extraEnv) {
  const env = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    NODE_ENV: "production",
    CCPUN_DEPLOYMENT_PROVIDER: "hostinger",
    CCPUN_DEPLOYMENT_ROLE: "web",
    CCPUN_APP_ENV: "production",
    NEXT_PUBLIC_SANITY_PROJECT_ID: "kyfxgjnq",
    NEXT_PUBLIC_SANITY_DATASET: "production",
    CCPUN_ENABLE_PRODUCTION_ANALYTICS: "1",
    ...extraEnv,
  };
  return spawnSync(process.execPath, ["scripts/check-hostinger-readiness.mjs"], {
    cwd: new URL("..", import.meta.url),
    env,
    encoding: "utf8",
  });
}

test("Hostinger Web readiness accepts only the explicit production identity", () => {
  const ok = runReadiness({});
  assert.equal(ok.status, 0, ok.stderr || ok.stdout);
  assert.match(ok.stdout, /"status": "ready"/);

  const fakeVercel = runReadiness({ VERCEL_PROJECT_ID: "prj_fake" });
  assert.notEqual(fakeVercel.status, 0);
  assert.match(fakeVercel.stdout, /VERCEL_PROJECT_ID must be unset/);

  const accidentalUat = runReadiness({ CCPUN_UAT_MODE: "1" });
  assert.notEqual(accidentalUat.status, 0);
  assert.match(accidentalUat.stdout, /Production Web must not set CCPUN_UAT_MODE=1/);
});
