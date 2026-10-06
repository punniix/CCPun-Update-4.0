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

function gitValue(args) {
  const result = spawnSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  return result.status === 0 ? result.stdout.trim() : "";
}

function applyHostingerWebFallback() {
  if (process.env.CCPUN_DEPLOYMENT_PROVIDER?.trim() || process.env.VERCEL_PROJECT_ID?.trim()) return;

  const branch = gitValue(["symbolic-ref", "--short", "HEAD"]);
  const sha = gitValue(["rev-parse", "HEAD"]);
  if (!branch || !/^[0-9a-f]{40}$/i.test(sha)) return;

  const isProduction = branch === "v4-production";
  const isPinnedUat = branch.startsWith("codex/hostinger-release-uat-");
  if (!isProduction && !isPinnedUat) return;

  const lane = isProduction ? webProductionLane : webUatLane;
  const defaults = {
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
  };

  for (const [key, value] of Object.entries(defaults)) {
    if (!process.env[key]?.trim()) process.env[key] = value;
  }

  if (isProduction) {
    console.log(`Hostinger Production build identity inferred from v4-production @ ${sha.slice(0, 12)}.`);
  } else {
    console.log(`Hostinger Web UAT build identity inferred from ${branch} @ ${sha.slice(0, 12)}.`);
  }
}

applyHostingerWebFallback();

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
