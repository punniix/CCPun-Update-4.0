#!/usr/bin/env node

const args = new Set(process.argv.slice(2));
const strict = args.has("--strict");
const env = process.env;
const failures = [];
const warnings = [];

function requireExact(key, expected) {
  const actual = env[key]?.trim();
  if (actual !== expected) failures.push(`${key}=${JSON.stringify(actual ?? "")}; expected ${JSON.stringify(expected)}`);
}

function requirePresent(key) {
  if (!env[key]?.trim()) failures.push(`${key} is required`);
}

function forbidPresent(key) {
  if (env[key]?.trim()) failures.push(`${key} must be unset on Hostinger`);
}

const provider = env.CCPUN_DEPLOYMENT_PROVIDER?.trim();
const role = env.CCPUN_DEPLOYMENT_ROLE?.trim();
const appEnv = env.CCPUN_APP_ENV?.trim();
const releaseStage = env.CCPUN_RELEASE_STAGE?.trim();

requireExact("CCPUN_DEPLOYMENT_PROVIDER", "hostinger");
forbidPresent("VERCEL_PROJECT_ID");
forbidPresent("VERCEL_ENV");

if (role === "web") {
  if (!["production", "web-uat"].includes(appEnv ?? "")) {
    failures.push("Web Hostinger lane must be production or web-uat");
  }

  if (appEnv === "web-uat") {
    requireExact("CCPUN_RELEASE_STAGE", "shadow");
    requireExact("NEXT_PUBLIC_CCPUN_APP_ENV", "web-uat");
    requireExact("NEXT_PUBLIC_SANITY_PROJECT_ID", "ccb9lnw5");
    requireExact("NEXT_PUBLIC_SANITY_DATASET", "uat");
    requireExact("CCPUN_UAT_MODE", "1");
    requireExact("CCPUN_ENABLE_PRODUCTION_ANALYTICS", "0");
  }

  if (appEnv === "production") {
    requireExact("NEXT_PUBLIC_CCPUN_APP_ENV", "production");
    requireExact("NEXT_PUBLIC_SANITY_PROJECT_ID", "kyfxgjnq");
    requireExact("NEXT_PUBLIC_SANITY_DATASET", "production");
    requirePresent("CCPUN_GIT_REF");
    requirePresent("CCPUN_GIT_SHA");
    requirePresent("CCPUN_RELEASE_ID");

    if (releaseStage === "candidate") {
      requireExact("CCPUN_UAT_MODE", "1");
      requireExact("CCPUN_ENABLE_PRODUCTION_ANALYTICS", "0");
    } else if (releaseStage === "live") {
      requireExact("CCPUN_UAT_MODE", "0");
      requireExact("CCPUN_ENABLE_PRODUCTION_ANALYTICS", "1");
      requireExact("CCPUN_GIT_REF", "v4-production");
    } else {
      failures.push("Production Web Hostinger lane must set CCPUN_RELEASE_STAGE=candidate or live");
    }
  }
} else if (role === "admin") {
  if (!["production-admin", "admin-uat"].includes(appEnv ?? "")) {
    failures.push("Admin Hostinger lane must be production-admin or admin-uat");
  }
  const production = appEnv === "production-admin";
  requireExact("NEXT_PUBLIC_SANITY_PROJECT_ID", production ? "kyfxgjnq" : "ccb9lnw5");
  requireExact("NEXT_PUBLIC_SANITY_DATASET", production ? "production" : "uat");
  requirePresent("AUTH_URL");
  requirePresent("CCPUN_ADMIN_DATABASE_URL");
  warnings.push(
    "Admin cutover is not certified by this gate: Workflow SDK self-host handler authentication must be resolved or Article Scheduler must move to the approved n8n runtime."
  );
} else {
  failures.push("CCPUN_DEPLOYMENT_ROLE must be web or admin");
}

if (env.WORKFLOW_TARGET_WORLD === "local" && appEnv !== "development") {
  failures.push("WORKFLOW_TARGET_WORLD=local is forbidden for deployed Hostinger lanes");
}

const result = {
  status: failures.length ? "blocked" : warnings.length && strict ? "blocked" : "ready",
  provider,
  role,
  environment: appEnv,
  releaseStage: releaseStage || null,
  release: {
    gitRef: env.CCPUN_GIT_REF?.trim() || null,
    gitSha: env.CCPUN_GIT_SHA?.trim() || null,
    releaseId: env.CCPUN_RELEASE_ID?.trim() || null,
  },
  failures,
  warnings,
};

console.log(JSON.stringify(result, null, 2));
if (failures.length || (strict && warnings.length)) process.exit(1);
