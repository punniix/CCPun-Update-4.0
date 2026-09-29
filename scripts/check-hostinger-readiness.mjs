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

requireExact("CCPUN_DEPLOYMENT_PROVIDER", "hostinger");
forbidPresent("VERCEL_PROJECT_ID");
forbidPresent("VERCEL_ENV");

if (role === "web") {
  if (!["production", "web-uat"].includes(appEnv ?? "")) {
    failures.push("Web Hostinger lane must be production or web-uat");
  }
  if (appEnv === "production" || appEnv === "web-uat") {
    requireExact("NEXT_PUBLIC_CCPUN_APP_ENV", appEnv);
  }
  const production = appEnv === "production";
  requireExact("NEXT_PUBLIC_SANITY_PROJECT_ID", production ? "kyfxgjnq" : "ccb9lnw5");
  requireExact("NEXT_PUBLIC_SANITY_DATASET", production ? "production" : "uat");
  requireExact("CCPUN_UAT_MODE", production ? "0" : "1");
  if (production) {
    requireExact("CCPUN_GIT_REF", "v4-production");
    requirePresent("CCPUN_GIT_SHA");
    requirePresent("CCPUN_RELEASE_ID");
    if (env.CCPUN_ENABLE_PRODUCTION_ANALYTICS !== "1") {
      warnings.push("CCPUN_ENABLE_PRODUCTION_ANALYTICS is not 1; production analytics would stay disabled");
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
