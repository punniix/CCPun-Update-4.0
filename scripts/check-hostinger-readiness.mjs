#!/usr/bin/env node
import { DEPLOYMENT_LANES } from "../lib/runtime/deployment-lanes.mjs";

const webProductionLane = DEPLOYMENT_LANES["web-production"];
const webUatLane = DEPLOYMENT_LANES["web-uat"];
const adminProductionLane = DEPLOYMENT_LANES["admin-production"];
const adminUatLane = DEPLOYMENT_LANES["admin-uat"];

const ADMIN_NATIVE_LANES = {
  "admin-uat": {
    projectId: "young-term-47483330",
    branchId: "br-crimson-mouse-az7ajkv8",
    endpointId: "ep-mute-frost-aztvz394",
    hostSuffix: "c-3.ap-southeast-1.aws.neon.tech",
    authUrl: "https://admin-test.ccpun.com",
  },
  "production-admin": {
    projectId: "lively-bar-43618798",
    branchId: "br-long-resonance-b3ys5xrv",
    endpointId: "ep-broad-butterfly-b3ro7u8w",
    hostSuffix: "c-4.ap-southeast-1.aws.neon.tech",
    authUrl: "https://admin.ccpun.com",
  },
};

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

function requireAdminDatabaseLane(key, expected) {
  try {
    const url = new URL(env[key]?.trim() ?? "");
    const hosts = [expected.endpointId, `${expected.endpointId}-pooler`].map((id) => `${id}.${expected.hostSuffix}`);
    if (url.protocol !== "postgresql:" || !hosts.includes(url.hostname) || url.port || url.hash
      || decodeURIComponent(url.username) !== "ccpun_admin_runtime" || !url.password
      || url.pathname !== "/neondb" || url.searchParams.get("sslmode") !== "require") {
      failures.push(`${key} does not match the approved Admin Neon lane`);
    }
  } catch {
    failures.push(`${key} does not match the approved Admin Neon lane`);
  }
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
    requireExact("NEXT_PUBLIC_CCPUN_APP_ENV", webUatLane.publicEnvironment);
    requireExact("NEXT_PUBLIC_SANITY_PROJECT_ID", webUatLane.sanityProjectId);
    requireExact("NEXT_PUBLIC_SANITY_DATASET", webUatLane.sanityDataset);
    requireExact("CCPUN_UAT_MODE", webUatLane.uatMode);
    requireExact("CCPUN_ENABLE_PRODUCTION_ANALYTICS", webUatLane.productionAnalytics);
  }

  if (appEnv === "production") {
    requireExact("NEXT_PUBLIC_CCPUN_APP_ENV", webProductionLane.publicEnvironment);
    requireExact("NEXT_PUBLIC_SANITY_PROJECT_ID", webProductionLane.sanityProjectId);
    requireExact("NEXT_PUBLIC_SANITY_DATASET", webProductionLane.sanityDataset);
    requirePresent("CCPUN_GIT_REF");
    requirePresent("CCPUN_GIT_SHA");
    requirePresent("CCPUN_RELEASE_ID");

    if (releaseStage === "candidate") {
      requireExact("CCPUN_UAT_MODE", "1");
      requireExact("CCPUN_ENABLE_PRODUCTION_ANALYTICS", "0");
    } else if (releaseStage === "live") {
      requireExact("CCPUN_UAT_MODE", "0");
      requireExact("CCPUN_ENABLE_PRODUCTION_ANALYTICS", "1");
      const gitRef = env.CCPUN_GIT_REF?.trim();
      const gitSha = env.CCPUN_GIT_SHA?.trim() ?? "";
      // Policy acceptance only; provider checkout and live SHA still require verification.
      if (gitRef !== "v4-production" && (
        !/^[a-f0-9]{40}$/.test(gitSha)
        || gitRef !== `codex/hostinger-release-production-${gitSha}`
      )) {
        failures.push("CCPUN_GIT_REF must be v4-production or an exact SHA-matching pinned Production release ref");
      }
    } else {
      failures.push("Production Web Hostinger lane must set CCPUN_RELEASE_STAGE=candidate or live");
    }
  }
} else if (role === "admin") {
  if (!["production-admin", "admin-uat"].includes(appEnv ?? "")) {
    failures.push("Admin Hostinger lane must be production-admin or admin-uat");
  } else {
    const production = appEnv === "production-admin";
    const lane = production ? adminProductionLane : adminUatLane;
    const native = ADMIN_NATIVE_LANES[appEnv];
    requireExact("NEXT_PUBLIC_CCPUN_APP_ENV", lane.publicEnvironment);
    requireExact("NEXT_PUBLIC_SANITY_PROJECT_ID", lane.sanityProjectId);
    requireExact("NEXT_PUBLIC_SANITY_DATASET", lane.sanityDataset);
    requireExact("CCPUN_UAT_MODE", lane.uatMode);
    requireExact("CCPUN_ENABLE_PRODUCTION_ANALYTICS", lane.productionAnalytics);
    requireExact("CCPUN_ADMIN_CAPABILITY_PROFILE", "full");
    requireExact("NEXT_PUBLIC_CCPUN_ADMIN_CAPABILITY_PROFILE", "full");
    requireExact("CCPUN_ARTICLE_SCHEDULER_BACKEND", "native-neon");
    requireExact("NEXT_PUBLIC_CCPUN_ARTICLE_SCHEDULER_BACKEND", "native-neon");
    requireExact("CCPUN_ARTICLE_SCHEDULING_ENABLED", "1");
    requireExact("CCPUN_ARTICLE_SCHEDULE_EXECUTION_PLANE", "cloud");
    requireExact("CCPUN_ARTICLE_SCHEDULE_EXECUTOR_ENABLED", "0");
    requireExact("CCPUN_NATIVE_WORKFLOW_ENABLED", "0");
    requireExact("CCPUN_BACKGROUND_EXECUTION_PLANE", "cloud");
    requireExact("CCPUN_BACKGROUND_WORKER_ENABLED", "0");
    requireExact("AUTH_URL", native.authUrl);
    requireExact("CCPUN_NEON_PROJECT_ID", native.projectId);
    requireExact("CCPUN_NEON_BRANCH_ID", native.branchId);
    requireExact("CCPUN_NEON_ENDPOINT_ID", native.endpointId);
    requireExact("CCPUN_NEON_DATABASE", "neondb");
    requireAdminDatabaseLane("CCPUN_ADMIN_DATABASE_URL", native);
    requirePresent("CCPUN_GIT_REF");
    requirePresent("CCPUN_GIT_SHA");
    requirePresent("CCPUN_RELEASE_ID");

    const gitRef = env.CCPUN_GIT_REF?.trim() ?? "";
    const gitSha = env.CCPUN_GIT_SHA?.trim() ?? "";
    if (!/^[a-f0-9]{40}$/.test(gitSha)) failures.push("CCPUN_GIT_SHA must be a lowercase 40-character Git SHA");
    if (production) {
      requireExact("CCPUN_RELEASE_STAGE", "live");
      if (gitRef !== "v4-production" && gitRef !== `codex/hostinger-release-production-${gitSha}`) {
        failures.push("Admin Production CCPUN_GIT_REF must be v4-production or an exact SHA-matching pinned Production release ref");
      }
    } else {
      requireExact("CCPUN_RELEASE_STAGE", "shadow");
      requireExact("CCPUN_SOCIAL_ENABLED", "1");
      requireExact("CCPUN_SOCIAL_DATA_MODE", "synthetic");
      requireExact("CCPUN_SOCIAL_OPERATIONS_ENABLED", "1");
      requireExact("CCPUN_SOCIAL_PROVIDER_READS_ENABLED", "0");
      requireExact("CCPUN_SOCIAL_PROVIDER_WRITES_ENABLED", "0");
      requireExact("CCPUN_SOCIAL_ANALYTICS_INGESTION_ENABLED", "0");
      if (!/^admin\/hostinger-release-uat-[a-f0-9]{40}$/.test(gitRef)) {
        failures.push("Admin UAT CCPUN_GIT_REF must be a dedicated pinned Admin UAT release ref");
      }
    }
  }
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
