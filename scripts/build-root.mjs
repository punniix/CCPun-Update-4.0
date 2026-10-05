#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function gitValue(args) {
  const result = spawnSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  return result.status === 0 ? result.stdout.trim() : "";
}

function applyHostingerProductionFallback() {
  if (process.env.CCPUN_DEPLOYMENT_PROVIDER?.trim() || process.env.VERCEL_PROJECT_ID?.trim()) return;

  const branch = gitValue(["symbolic-ref", "--short", "HEAD"]);
  if (branch !== "v4-production") return;

  const sha = gitValue(["rev-parse", "HEAD"]);
  if (!/^[0-9a-f]{40}$/i.test(sha)) return;

  const defaults = {
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
    CCPUN_GIT_SHA: sha,
    CCPUN_RELEASE_ID: `hostinger-web-prod-${sha.slice(0, 12)}`,
  };

  for (const [key, value] of Object.entries(defaults)) {
    if (!process.env[key]?.trim()) process.env[key] = value;
  }

  console.log(`Hostinger Production build identity inferred from v4-production @ ${sha.slice(0, 12)}.`);
}

applyHostingerProductionFallback();

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
