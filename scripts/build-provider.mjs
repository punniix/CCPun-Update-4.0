import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const provider = process.env.CCPUN_DEPLOYMENT_PROVIDER?.trim().toLowerCase() ?? "";
const isHostinger = provider === "hostinger";
const nextBin = resolve(repoRoot, "node_modules/next/dist/bin/next");

function runNext(cwd, extraArgs = []) {
  const result = spawnSync(process.execPath, [nextBin, "build", ...extraArgs], {
    cwd,
    env: process.env,
    stdio: "inherit",
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function replaceDirectory(source, destination) {
  if (!existsSync(source)) {
    throw new Error(`Required build input is missing: ${source}`);
  }

  rmSync(destination, { recursive: true, force: true });
  mkdirSync(dirname(destination), { recursive: true });
  cpSync(source, destination, { recursive: true });
}

if (!isHostinger) {
  runNext(repoRoot);
  process.exit(0);
}

const webRoot = resolve(repoRoot, "apps/web");
runNext(webRoot, ["--webpack"]);

const standaloneRoot = resolve(webRoot, ".next/standalone");
const runtimeRoot = resolve(standaloneRoot, "apps/web");
const serverFile = resolve(runtimeRoot, "server.js");

if (!existsSync(serverFile)) {
  throw new Error(`Hostinger standalone entry file is missing: ${serverFile}`);
}

replaceDirectory(resolve(repoRoot, "public"), resolve(runtimeRoot, "public"));
replaceDirectory(resolve(webRoot, ".next/static"), resolve(runtimeRoot, ".next/static"));

console.log(
  `Hostinger standalone runtime packaged at ${standaloneRoot} with public and static assets.`,
);
