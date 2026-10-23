#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// Direct CLI entry must enforce the same floor even when npm lifecycle hooks are disabled.
await import(new URL("./check-next-security-baseline.mjs", import.meta.url));
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

async function applyHostingerReleaseFallback() {
  if (Object.entries(process.env).some(([key, value]) => key.startsWith("VERCEL_") && value?.trim())) throw new Error("UNSUPPORTED_PROVIDER_METADATA");
  if (["vercel", "@workflow/world-vercel"].includes(process.env.WORKFLOW_TARGET_WORLD?.trim() ?? "")) throw new Error("UNSUPPORTED_WORKFLOW_WORLD");

  const symbolicBranch = gitValue(["symbolic-ref", "--short", "HEAD"]);
  const sha = gitValue(["rev-parse", "HEAD"]);
  if (!/^[0-9a-f]{40}$/i.test(sha)) return;

  const explicitProvider = process.env.CCPUN_DEPLOYMENT_PROVIDER?.trim().toLowerCase();
  const explicitRole = process.env.CCPUN_DEPLOYMENT_ROLE?.trim().toLowerCase();
  const configuredRef = process.env.CCPUN_GIT_REF?.trim() ?? "";
  const productionRefPrefix = "codex/hostinger-release-production-";
  if (symbolicBranch.startsWith(productionRefPrefix)
    || (configuredRef.startsWith(productionRefPrefix) && symbolicBranch !== `admin/hostinger-release-uat-${sha}`)) {
    // Only the actual checkout can authorize a refresh; configured Git metadata
    // may be stale, but must never choose another lane or invent Production flags.
    if (symbolicBranch !== `${productionRefPrefix}${sha}` || !/^[a-f0-9]{40}$/.test(sha)) {
      throw new Error("PRODUCTION_RELEASE_REF_DENIED");
    }
    const releaseId = `hostinger-${explicitRole}-prod-${sha.slice(0, 12)}`;
    const identity = {
      CCPUN_GIT_REF: symbolicBranch, CCPUN_GIT_SHA: sha, CCPUN_RELEASE_ID: releaseId,
      NEXT_PUBLIC_CCPUN_GIT_REF: symbolicBranch, NEXT_PUBLIC_CCPUN_GIT_SHA: sha, NEXT_PUBLIC_CCPUN_RELEASE_ID: releaseId,
    };
    const prospective = { ...process.env, ...identity };
    let accepted = false;
    if (explicitProvider === "hostinger" && explicitRole === "admin") {
      const { isPinnedCloudProductionRelease } = await import("../lib/runtime/hostinger-production-release.mjs");
      accepted = isPinnedCloudProductionRelease(prospective, prospective, false);
    } else if (explicitProvider === "hostinger" && explicitRole === "web" && prospective.CCPUN_APP_ENV === "production"
      && [undefined, "hostinger"].includes(prospective.NEXT_PUBLIC_CCPUN_DEPLOYMENT_PROVIDER)
      && [undefined, "web"].includes(prospective.NEXT_PUBLIC_CCPUN_DEPLOYMENT_ROLE)) {
      // The existing read-only Web validator checks live/candidate, Sanity and
      // analytics/UAT policy. Suppress its configuration output, including errors.
      accepted = spawnSync(process.execPath, [resolve(repositoryRoot, "scripts/check-hostinger-readiness.mjs"), "--strict"], {
        cwd: repositoryRoot, env: prospective, stdio: "ignore",
      }).status === 0;
    }
    if (!accepted) throw new Error("PRODUCTION_RELEASE_IDENTITY_DENIED");
    Object.assign(process.env, identity);
    console.log(`Hostinger Production ${explicitRole} Git identity bound to checked-out pinned release @ ${sha.slice(0, 12)}.`);
    return;
  }
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

await applyHostingerReleaseFallback();

const provider = process.env.CCPUN_DEPLOYMENT_PROVIDER?.trim().toLowerCase();
const role = process.env.CCPUN_DEPLOYMENT_ROLE?.trim().toLowerCase();
if (provider && !["hostinger", "local"].includes(provider)) throw new Error("UNSUPPORTED_BUILD_PROVIDER");
if (provider === "hostinger" && !["web", "admin"].includes(role)) throw new Error("HOSTINGER_BUILD_ROLE_REQUIRED");
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
