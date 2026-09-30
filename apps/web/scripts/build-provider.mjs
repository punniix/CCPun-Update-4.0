import { cpSync, existsSync, lstatSync, mkdtempSync, mkdirSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const provider = process.env.CCPUN_DEPLOYMENT_PROVIDER?.trim().toLowerCase() ?? "";
const isHostinger = provider === "hostinger";

function run(command, args, cwd = webRoot) {
  const result = spawnSync(command, args, {
    cwd,
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function removePath(path) {
  try {
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) unlinkSync(path);
    else rmSync(path, { recursive: true, force: true });
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

function replaceDirectory(source, destination) {
  if (!existsSync(source)) {
    throw new Error(`Required build input is missing: ${source}`);
  }
  removePath(destination);
  mkdirSync(dirname(destination), { recursive: true });
  // ponytail: publish real files; the tracked public symlink cannot survive a root-only runtime upload.
  cpSync(source, destination, { recursive: true, dereference: true });
}

async function materializePublicDirectory() {
  const webPublic = resolve(webRoot, "public");
  const repoPublic = resolve(webRoot, "../../public");

  if (existsSync(webPublic)) return;

  removePath(webPublic);

  if (existsSync(repoPublic)) {
    replaceDirectory(repoPublic, webPublic);
    return;
  }

  const gitSha = process.env.CCPUN_GIT_SHA?.trim() ?? "";
  const gitRef = process.env.CCPUN_GIT_REF?.trim() ?? "";
  const safeSha = /^[0-9a-f]{40}$/i.test(gitSha) ? gitSha : "";
  const safeRef = /^[A-Za-z0-9._/-]+$/.test(gitRef) ? gitRef : "";
  const archiveRef = safeSha || (safeRef ? `refs/heads/${safeRef}` : "");
  if (!archiveRef) {
    throw new Error("Hostinger build needs CCPUN_GIT_SHA or CCPUN_GIT_REF to materialize public assets.");
  }

  const url = `https://codeload.github.com/punniix/CCPun-Update-4.0/tar.gz/${archiveRef}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to download public assets from GitHub: ${response.status} ${response.statusText}`);
  }

  const tempRoot = mkdtempSync(join(tmpdir(), "ccpun-hostinger-public-"));
  const archive = join(tempRoot, "source.tgz");
  const extracted = join(tempRoot, "source");
  mkdirSync(extracted, { recursive: true });
  writeFileSync(archive, Buffer.from(await response.arrayBuffer()));

  const tar = spawnSync("tar", ["-xzf", archive, "--strip-components=1", "-C", extracted], {
    env: process.env,
    stdio: "inherit",
  });
  if (tar.error) throw tar.error;
  if (tar.status !== 0) throw new Error("Unable to extract Hostinger source archive.");

  const extractedPublic = resolve(extracted, "public");
  if (!existsSync(extractedPublic)) {
    throw new Error("GitHub source archive did not contain public assets.");
  }
  replaceDirectory(extractedPublic, webPublic);
  rmSync(tempRoot, { recursive: true, force: true });
}

export function stageStandaloneRuntime(root = webRoot) {
  const standaloneRoot = resolve(root, ".next/standalone");
  const nestedRuntimeRoot = resolve(standaloneRoot, "apps/web");
  const runtimeRoot = existsSync(resolve(nestedRuntimeRoot, "server.js"))
    ? nestedRuntimeRoot
    : standaloneRoot;

  const serverFile = resolve(runtimeRoot, "server.js");
  if (!existsSync(serverFile)) {
    throw new Error(`Hostinger standalone entry file is missing: ${serverFile}`);
  }

  // Hostinger may omit standalone public/ files from the published runtime.
  // Mirror the same assets into .next/static, which Hostinger reliably retains,
  // while Hostinger-only rewrites preserve the original public URLs.
  replaceDirectory(resolve(root, "public"), resolve(root, ".next/static/ccpun-public"));
  // Keep public assets in the standalone runtime. next.config.ts also traces
  // them explicitly so Hostinger's publisher retains these files.
  replaceDirectory(resolve(root, "public"), resolve(runtimeRoot, "public"));
  replaceDirectory(resolve(root, ".next/static"), resolve(runtimeRoot, ".next/static"));

  if (runtimeRoot !== standaloneRoot) {
    cpSync(serverFile, resolve(standaloneRoot, "server.js"));
    if (existsSync(resolve(runtimeRoot, "package.json"))) {
      cpSync(resolve(runtimeRoot, "package.json"), resolve(standaloneRoot, "package.json"));
    }
    replaceDirectory(resolve(runtimeRoot, ".next"), resolve(standaloneRoot, ".next"));
    replaceDirectory(resolve(runtimeRoot, "public"), resolve(standaloneRoot, "public"));
  }

  for (const required of [
    "server.js",
    "node_modules/next/package.json",
    ".next/BUILD_ID",
    ".next/static",
    "public/llms.txt",
    "public/.well-known/security.txt",
    "public/favicon.ico",
    ".next/static/ccpun-public/llms.txt",
    ".next/static/ccpun-public/.well-known/security.txt",
    ".next/static/ccpun-public/favicon.ico",
  ]) {
    const absolute = resolve(standaloneRoot, required);
    if (!existsSync(absolute)) {
      throw new Error(`Hostinger standalone runtime is incomplete: ${required}`);
    }
  }

  console.log(`Hostinger standalone runtime ready at ${standaloneRoot}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (isHostinger) await materializePublicDirectory();
  run(process.platform === "win32" ? "next.cmd" : "next", ["build", "--webpack"]);
  if (isHostinger) stageStandaloneRuntime();
}
