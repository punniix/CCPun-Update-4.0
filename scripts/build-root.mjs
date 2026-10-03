#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
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
