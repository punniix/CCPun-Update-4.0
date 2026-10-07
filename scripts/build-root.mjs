#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { DEPLOYMENT_LANES } = await import(
  new URL("../lib/runtime/deployment-lanes.mjs", import.meta.url)
);
const webProductionLane = DEPLOYMENT_LANES["web-production"];
const webUatLane = DEPLOYMENT_LANES["web-uat"];
const adminUatLane = DEPLOYMENT_LANES["admin-uat"];

function gitValue(args) {
  const result = spawnSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  return result.status === 0 ? result.stdout.trim() : "";
}

function fillMissing(defaults) {
  for (const [key, value] of Object.entries(defaults)) {
    if (!process.env[key]?.trim()) process.env[key] = value;
  }
}

function applyHostingerReleaseFallback() {
  if (process.env.VERCEL_PROJECT_ID?.trim()) return;

  const symbolicBranch = gitValue(["symbolic-ref", "--short", "HEAD"]);
  const sha = gitValue(["rev-parse", "HEAD"]);
  if (!/^[0-9a-f]{40}$/i.test(sha)) return;

  const explicitProvider = process.env.CCPUN_DEPLOYMENT_PROVIDER?.trim().toLowerCase();
  const explicitRole = process.env.CCPUN_DEPLOYMENT_ROLE?.trim().toLowerCase();
  const configuredRef = process.env.CCPUN_GIT_REF?.trim() ?? "";
  const adminUatRefPattern = /^admin\/hostinger-release-uat-[a-f0-9]{40}$/;
  const adminUatRef = adminUatRefPattern.test(symbolicBranch)
    ? symbolicBranch
    : adminUatRefPattern.test(configuredRef)
      ? configuredRef
      : "";

  if (adminUatRef) {
    if (explicitProvider && explicitProvider !== "hostinger") throw new Error("ADMIN_UAT_RELEASE_PROVIDER_CONFLICT");
    if (explicitRole && explicitRole !== "admin") throw new Error("ADMIN_UAT_RELEASE_ROLE_CONFLICT");
    const defaults = {
      CCPUN_DEPLOYMENT_PROVIDER: adminUatLane.provider,
      CCPUN_DEPLOYMENT_ROLE: adminUatLane.role,
      CCPUN_RELEASE_STAGE: "shadow",
      CCPUN_APP_ENV: adminUatLane.environment,
      NEXT_PUBLIC_CCPUN_APP_ENV: adminUatLane.publicEnvironment,
      NEXT_PUBLIC_SANITY_PROJECT_ID: adminUatLane.sanityProjectId,
      NEXT_PUBLIC_SANITY_DATASET: adminUatLane.sanityDataset,
      CCPUN_UAT_MODE: adminUatLane.uatMode,
      CCPUN_ENABLE_PRODUCTION_ANALYTICS: adminUatLane.productionAnalytics,
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
      CCPUN_SOCIAL_ENABLED: "1",
      CCPUN_SOCIAL_DATA_MODE: "synthetic",
      CCPUN_SOCIAL_OPERATIONS_ENABLED: "1",
      CCPUN_SOCIAL_PROVIDER_READS_ENABLED: "0",
      CCPUN_SOCIAL_PROVIDER_WRITES_ENABLED: "0",
      CCPUN_SOCIAL_ANALYTICS_INGESTION_ENABLED: "0",
      CCPUN_NEON_PROJECT_ID: "young-term-47483330",
      CCPUN_NEON_BRANCH_ID: "br-crimson-mouse-az7ajkv8",
      CCPUN_NEON_ENDPOINT_ID: "ep-mute-frost-aztvz394",
      CCPUN_NEON_DATABASE: "neondb",
      AUTH_URL: "https://admin-test.ccpun.com",
      CCPUN_GIT_REF: adminUatRef,
      CCPUN_GIT_SHA: sha,
      CCPUN_RELEASE_ID: `hostinger-admin-uat-${sha.slice(0, 12)}`,
      NEXT_PUBLIC_CCPUN_GIT_REF: adminUatRef,
      NEXT_PUBLIC_CCPUN_GIT_SHA: sha,
      NEXT_PUBLIC_CCPUN_RELEASE_ID: `hostinger-admin-uat-${sha.slice(0, 12)}`,
    };
    // A dedicated Admin UAT release ref is the authority for non-secret lane
    // identity. The branch may act as a stable Hostinger slot; build provenance
    // is still bound to the checked-out ref -> actual SHA by build-provider.
    // It never synthesizes OAuth, DB or provider secrets.
    Object.assign(process.env, defaults);
    console.log(`Hostinger Admin UAT build identity inferred from pinned release ref ${adminUatRef} @ ${sha.slice(0, 12)}.`);
    return;
  }

  if (explicitProvider) return;
  const branch = symbolicBranch;
  if (!branch) return;
  const isProduction = branch === "v4-production";
  const isPinnedUat = branch.startsWith("codex/hostinger-release-uat-");
  if (!isProduction && !isPinnedUat) return;

  const lane = isProduction ? webProductionLane : webUatLane;
  fillMissing({
    CCPUN_DEPLOYMENT_PROVIDER: lane.provider,
    CCPUN_DEPLOYMENT_ROLE: lane.role,
    CCPUN_RELEASE_STAGE: isProduction ? "live" : "shadow",
    CCPUN_APP_ENV: lane.environment,
    NEXT_PUBLIC_CCPUN_APP_ENV: lane.publicEnvironment,
    NEXT_PUBLIC_SANITY_PROJECT_ID: lane.sanityProjectId,
    NEXT_PUBLIC_SANITY_DATASET: lane.sanityDataset,
    CCPUN_UAT_MODE: lane.uatMode,
    CCPUN_ENABLE_PRODUCTION_ANALYTICS: lane.productionAnalytics,
    CCPUN_GIT_REF: branch,
    CCPUN_GIT_SHA: sha,
    CCPUN_RELEASE_ID: `${isProduction ? "hostinger-web-prod" : "hostinger-web-uat"}-${sha.slice(0, 12)}`,
  });

  if (isProduction) {
    console.log(`Hostinger Production build identity inferred from v4-production @ ${sha.slice(0, 12)}.`);
  } else {
    console.log(`Hostinger Web UAT build identity inferred from ${branch} @ ${sha.slice(0, 12)}.`);
  }
}

applyHostingerReleaseFallback();

const provider = process.env.CCPUN_DEPLOYMENT_PROVIDER?.trim().toLowerCase();
const role = process.env.CCPUN_DEPLOYMENT_ROLE?.trim().toLowerCase();
const workspace = provider === "hostinger" && (role === "web" || role === "admin")
  ? `@ccpun/${role}`
  : null;

const command = workspace
  ? (process.platform === "win32" ? "npm.cmd" : "npm")
  : (process.platform === "win32" ? "next.cmd" : "next");
const args = workspace
  ? ["run", "build", "--workspace", workspace]
  : ["build"];

if (workspace) {
  console.log(`Hostinger monorepo root build: delegating to ${workspace}.`);
}

const result = spawnSync(command, args, {
  cwd: repositoryRoot,
  env: process.env,
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
