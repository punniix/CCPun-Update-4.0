import { cpSync, existsSync, lstatSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, readlinkSync, realpathSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const provider = process.env.CCPUN_DEPLOYMENT_PROVIDER?.trim().toLowerCase() ?? "";
const isHostinger = provider === "hostinger";
const PROVENANCE = "ccpun-build-provenance.json";
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function git(root, args) {
  const result = spawnSync("git", args, { cwd: resolve(root, "../.."), encoding: "utf8" });
  if (result.status !== 0) throw new Error("Cannot verify artifact source identity.");
  return result.stdout.trim();
}

function sourceIdentity(root, ref) {
  if (!ref || !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(ref)) throw new Error("Invalid source ref.");
  git(root, ["check-ref-format", "--branch", ref]);
  const sha = git(root, ["rev-parse", "HEAD"]);
  const branch = spawnSync("git", ["symbolic-ref", "--short", "HEAD"], { cwd: resolve(root, "../.."), encoding: "utf8" });
  if (branch.status === 0) {
    if (branch.stdout.trim() !== ref) throw new Error("Artifact source ref does not match checkout.");
  } else if (git(root, ["rev-parse", "--verify", `refs/remotes/origin/${ref}^{commit}`]) !== sha) {
    throw new Error("Artifact source ref does not match checkout.");
  }
  const status = spawnSync("git", ["status", "--porcelain=v1", "-z", "--untracked-files=normal"], { cwd: resolve(root, "../.."), encoding: "utf8" });
  if (status.status !== 0) throw new Error("Cannot verify artifact source identity.");
  if (status.stdout) {
    const counts = { trackedManifestChanged: false, trackedLockChanged: false, otherTrackedCount: 0, untrackedNestedNodeModulesCount: 0, otherUntrackedCount: 0 };
    const records = status.stdout.split("\0");
    for (let index = 0; index < records.length; index++) {
      const record = records[index];
      if (!record) continue;
      const state = record.slice(0, 2), path = record.slice(3);
      if (state === "??") {
        if (/^(?:[^/]+\/)+node_modules(?:\/|$)/.test(path)) counts.untrackedNestedNodeModulesCount++;
        else counts.otherUntrackedCount++;
      } else {
        // Porcelain -z includes a second, unprinted path for rename/copy records.
        const paths = /[RC]/.test(state) ? [path, records[++index] ?? ""] : [path];
        if (paths.some((name) => /(?:^|\/)package\.json$/.test(name))) counts.trackedManifestChanged = true;
        else if (paths.some((name) => /(?:^|\/)package-lock\.json$/.test(name))) counts.trackedLockChanged = true;
        else counts.otherTrackedCount++;
      }
    }
    throw new Error(`Artifact requires a clean source checkout. ${JSON.stringify(counts)}`);
  }
  return { gitSha: sha, gitRef: ref, lockSha256: sha256(readFileSync(resolve(root, "../../package-lock.json"))) };
}

export function preparePinnedHostingerWebUatLock(root = webRoot, variables = process.env) {
  const repository = resolve(root, "../..");
  // Only the observed ephemeral provider checkout may undo its installer-generated lock drift.
  const providerRepository = "/home/u320222331/domains/test.ccpun.com/hbuilds/source/repository";
  if (repository !== providerRepository || variables.CCPUN_DEPLOYMENT_PROVIDER !== "hostinger" ||
      variables.CCPUN_DEPLOYMENT_ROLE !== "web" || variables.CCPUN_APP_ENV !== "web-uat") return false;
  if (realpathSync(repository) !== providerRepository || variables.CCPUN_RELEASE_STAGE !== "shadow" ||
      variables.NEXT_PUBLIC_CCPUN_APP_ENV !== "web-uat" || variables.NEXT_PUBLIC_SANITY_PROJECT_ID !== "ccb9lnw5" ||
      variables.NEXT_PUBLIC_SANITY_DATASET !== "uat" || variables.CCPUN_UAT_MODE !== "1" ||
      variables.CCPUN_ENABLE_PRODUCTION_ANALYTICS !== "0") throw new Error("Provider lock preparation requires the isolated Web UAT checkout.");
  const ref = git(root, ["symbolic-ref", "--short", "HEAD"]);
  const pin = ref.match(/^codex\/hostinger-release-uat-([0-9a-f]{40})$/);
  if (!pin || git(root, ["rev-parse", "HEAD"]) !== pin[1] ||
      git(root, ["rev-parse", "--verify", `refs/heads/${ref}^{commit}`]) !== pin[1]) throw new Error("Provider lock preparation requires the exact attached immutable pin.");
  const status = spawnSync("git", ["status", "--porcelain=v1", "-z", "--untracked-files=normal"], { cwd: repository, encoding: "utf8" });
  if (status.status !== 0) throw new Error("Cannot verify artifact source identity.");
  if (!status.stdout) return false;
  if (status.stdout !== " M package-lock.json\0" ||
      !/^100644 [0-9a-f]{40} 0\tpackage-lock\.json$/.test(git(root, ["ls-files", "--stage", "--", "package-lock.json"]))) {
    throw new Error("Provider lock preparation rejects non-lock source changes.");
  }
  const lock = resolve(repository, "package-lock.json"), lockStat = lstatSync(lock);
  if (!lockStat.isFile() || lockStat.isSymbolicLink()) throw new Error("Provider lock preparation requires a regular tracked lock.");
  const committed = spawnSync("git", ["show", "HEAD:package-lock.json"], { cwd: repository, maxBuffer: 16 * 1024 * 1024 });
  if (committed.status !== 0) throw new Error("Cannot verify committed provider lock.");
  writeFileSync(lock, committed.stdout);
  const installEnv = { ...variables };
  for (const key of Object.keys(installEnv)) if (/^npm_config_(?:workspace|workspaces|prefix|include_workspace_root)$/i.test(key)) delete installEnv[key];
  const install = spawnSync("npm", ["ci", "--ignore-scripts", "--include=dev", "--include=optional", "--workspaces", "--include-workspace-root", "--no-audit", "--no-fund"], { cwd: repository, env: installEnv, stdio: "ignore" });
  if (install.status !== 0) throw new Error("Provider canonical dependency installation failed.");
  sourceIdentity(root, ref);
  return true;
}

export function derivePinnedHostingerWebUatGitMetadata(root = webRoot, variables = process.env) {
  if (variables.CCPUN_DEPLOYMENT_PROVIDER !== "hostinger" || variables.CCPUN_DEPLOYMENT_ROLE !== "web" || variables.CCPUN_APP_ENV !== "web-uat") return null;
  const checkout = spawnSync("git", ["symbolic-ref", "--short", "HEAD"], { cwd: resolve(root, "../.."), encoding: "utf8" });
  if (checkout.status !== 0) {
    if (/^codex\/hostinger-release-uat-[0-9a-f]{40}$/.test(variables.CCPUN_GIT_REF ?? "")) throw new Error("Pinned Web UAT metadata requires an attached Git checkout.");
    return null;
  }
  const ref = checkout.stdout.trim();
  const pin = ref.match(/^codex\/hostinger-release-uat-([0-9a-f]{40})$/);
  if (!pin) return null;
  if (variables.CCPUN_RELEASE_STAGE !== "shadow" || variables.NEXT_PUBLIC_CCPUN_APP_ENV !== "web-uat" ||
      variables.NEXT_PUBLIC_SANITY_PROJECT_ID !== "ccb9lnw5" || variables.NEXT_PUBLIC_SANITY_DATASET !== "uat" ||
      variables.CCPUN_UAT_MODE !== "1" || variables.CCPUN_ENABLE_PRODUCTION_ANALYTICS !== "0") {
    throw new Error("Pinned Web UAT metadata requires the isolated lane contract.");
  }
  const identity = sourceIdentity(root, ref);
  if (identity.gitSha !== pin[1]) throw new Error("Pinned Web UAT ref does not match checkout SHA.");
  const releaseId = `hostinger-web-uat-${identity.gitSha.slice(0, 12)}`;
  return {
    CCPUN_GIT_REF: ref, CCPUN_GIT_SHA: identity.gitSha, CCPUN_RELEASE_ID: releaseId,
    NEXT_PUBLIC_CCPUN_GIT_REF: ref, NEXT_PUBLIC_CCPUN_GIT_SHA: identity.gitSha, NEXT_PUBLIC_CCPUN_RELEASE_ID: releaseId,
  };
}

export function captureStandaloneProvenance(root = webRoot, variables = process.env) {
  if (Number(process.versions.node.split(".")[0]) !== 24) throw new Error("Artifact requires Node 24.");
  // Next loads ignored .env files too. Export must use the explicit CI contract,
  // without opening or importing any local credential file.
  for (const directory of [root, resolve(root, "../..")]) {
    if (readdirSync(directory).some((name) => /^\.env(?:\.|$)/i.test(name))) throw new Error("Artifact export forbids local environment files.");
  }
  if (variables.CCPUN_DEPLOYMENT_PROVIDER !== "hostinger" || variables.CCPUN_DEPLOYMENT_ROLE !== "web" ||
      variables.CCPUN_RELEASE_STAGE !== "shadow" || variables.CCPUN_APP_ENV !== "web-uat" ||
      variables.NEXT_PUBLIC_CCPUN_APP_ENV !== "web-uat" || variables.NEXT_PUBLIC_SANITY_PROJECT_ID !== "ccb9lnw5" ||
      variables.NEXT_PUBLIC_SANITY_DATASET !== "uat" || variables.CCPUN_UAT_MODE !== "1" || variables.CCPUN_ENABLE_PRODUCTION_ANALYTICS !== "0") {
    throw new Error("Artifact export supports only the isolated Web Shadow UAT contract.");
  }
  const identity = sourceIdentity(root, variables.CCPUN_GIT_REF);
  if (identity.gitSha !== variables.CCPUN_GIT_SHA) throw new Error("Artifact SHA does not match checkout.");
  // No generic environment serialization: these values are fixed public contracts.
  return { schemaVersion: 1, ...identity, provider: "hostinger", role: "web", lane: "web-uat", stage: "shadow", capabilityProfile: "public-web", node: process.version, platform: process.platform, architecture: process.arch, sanity: { projectId: "ccb9lnw5", dataset: "uat" }, uat: true, productionAnalytics: false };
}

function runtimeEntries(directory) {
  const root = realpathSync(directory);
  const entries = [];
  function walk(path) {
    const name = relative(root, path).split(sep).join("/");
    if (name === PROVENANCE) return;
    if (name.split("/").some((part) => [".git", ".ssh", ".aws"].includes(part))) throw new Error("Forbidden configuration directory in runtime artifact.");
    const filename = name.split("/").at(-1);
    if (/^\.env(?:\.|$)/i.test(filename) || /^(?:auth-|state-).*\.json$/i.test(filename) || /(?:credentials|secret).*\.json$/i.test(filename) || /^(?:credentials|\.npmrc|\.netrc|id_rsa|id_ed25519)$/i.test(filename) || /\.(?:pem|key|p12|pfx)$/i.test(filename)) throw new Error("Forbidden configuration file in runtime artifact.");
    const stat = lstatSync(path);
    let resolved;
    try { resolved = realpathSync(path); } catch { throw new Error("Runtime contains an unresolved link."); }
    const rel = relative(root, resolved);
    if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error("Runtime link escapes standalone root.");
    if (stat.isSymbolicLink()) {
      const target = readlinkSync(path);
      if (isAbsolute(target)) throw new Error("Runtime link is not relocatable.");
      entries.push({ path: name, type: "symlink", target });
    } else if (stat.isDirectory()) {
      entries.push({ path: name, type: "directory", mode: stat.mode & 0o777 });
      for (const child of readdirSync(path).sort()) walk(join(path, child));
    } else if (stat.isFile()) {
      entries.push({ path: name, type: "file", mode: stat.mode & 0o777, size: stat.size, sha256: sha256(readFileSync(path)) });
    } else throw new Error("Unsupported runtime file type.");
  }
  for (const entry of readdirSync(root).sort()) walk(join(root, entry));
  return entries;
}

export function sealStandaloneProvenance(provenance, root = webRoot) {
  const standalone = resolve(root, ".next/standalone");
  const manifest = { ...provenance, runtimeEntries: runtimeEntries(standalone) };
  writeFileSync(join(standalone, PROVENANCE), `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
  return manifest;
}

export function archiveStandaloneRuntime(output, root = webRoot) {
  const standalone = resolve(root, ".next/standalone");
  if (!existsSync(join(standalone, PROVENANCE))) throw new Error("Missing same-build artifact provenance.");
  let manifest;
  try { manifest = JSON.parse(readFileSync(join(standalone, PROVENANCE), "utf8")); } catch { throw new Error("Invalid artifact provenance."); }
  const keys = ["schemaVersion", "gitSha", "gitRef", "lockSha256", "provider", "role", "lane", "stage", "capabilityProfile", "node", "platform", "architecture", "sanity", "uat", "productionAnalytics", "runtimeEntries"].sort();
  if (JSON.stringify(Object.keys(manifest).sort()) !== JSON.stringify(keys) || manifest.schemaVersion !== 1 || manifest.provider !== "hostinger" || manifest.role !== "web" || manifest.lane !== "web-uat" || manifest.stage !== "shadow" || manifest.capabilityProfile !== "public-web" || !/^v24\./.test(manifest.node) || manifest.platform !== process.platform || manifest.architecture !== process.arch || manifest.uat !== true || manifest.productionAnalytics !== false || JSON.stringify(manifest.sanity) !== JSON.stringify({ projectId: "ccb9lnw5", dataset: "uat" })) throw new Error("Unsupported artifact provenance.");
  const current = sourceIdentity(root, manifest.gitRef);
  for (const key of ["gitSha", "gitRef", "lockSha256"]) if (current[key] !== manifest[key]) throw new Error("Artifact source provenance is stale.");
  if (JSON.stringify(runtimeEntries(standalone)) !== JSON.stringify(manifest.runtimeEntries)) throw new Error("Runtime artifact digest mismatch.");
  for (const required of ["server.js", "node_modules/next/package.json", ".next/BUILD_ID", ".next/static", "public/llms.txt", "public/favicon.ico"]) {
    if (!existsSync(join(standalone, required))) throw new Error("Required standalone launch input is missing.");
  }
  const outputRoot = resolve(output);
  mkdirSync(outputRoot, { recursive: true });
  const rel = relative(realpathSync(standalone), realpathSync(outputRoot));
  if (rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel))) throw new Error("Archive output must be outside the runtime tree.");
  const basename = `ccpun-web-uat-${manifest.gitSha}-${manifest.platform}-${manifest.architecture}`;
  const archive = join(outputRoot, `${basename}.tar.gz`);
  if ([archive, join(outputRoot, `${basename}.manifest.json`), join(outputRoot, `${basename}.sha256`)].some(existsSync)) throw new Error("Archive output already exists.");
  const result = spawnSync("tar", ["-czf", archive, "-C", standalone, "."], { stdio: "pipe" });
  if (result.error || result.status !== 0) { rmSync(archive, { force: true }); throw new Error("Unable to archive standalone runtime."); }
  if (JSON.stringify(runtimeEntries(standalone)) !== JSON.stringify(manifest.runtimeEntries)) {
    rmSync(archive, { force: true });
    throw new Error("Runtime artifact changed during archive creation.");
  }
  const digest = sha256(readFileSync(archive));
  writeFileSync(join(outputRoot, `${basename}.manifest.json`), `${JSON.stringify({ ...manifest, archiveSha256: digest, entrypoint: "node server.js", format: "standalone-tar-gzip", productionReady: false }, null, 2)}\n`, { flag: "wx" });
  writeFileSync(join(outputRoot, `${basename}.sha256`), `${digest}  ${basename}.tar.gz\n`, { flag: "wx" });
  console.log(`Web UAT standalone archive verified: ${basename}.tar.gz`);
  return { archive, digest, manifest };
}

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

const RUNTIME_ENV_KEYS = [
  "CCPUN_DEPLOYMENT_PROVIDER",
  "CCPUN_DEPLOYMENT_ROLE",
  "CCPUN_RELEASE_STAGE",
  "CCPUN_APP_ENV",
  "NEXT_PUBLIC_CCPUN_APP_ENV",
  "NEXT_PUBLIC_SANITY_PROJECT_ID",
  "NEXT_PUBLIC_SANITY_DATASET",
  "CCPUN_UAT_MODE",
  "CCPUN_ENABLE_PRODUCTION_ANALYTICS",
  "CCPUN_GIT_REF",
  "CCPUN_GIT_SHA",
  "CCPUN_RELEASE_ID",
];

function injectStandaloneRuntimeEnvironment(serverFile, variables, sealedGitMetadata) {
  if (variables.CCPUN_DEPLOYMENT_PROVIDER?.trim().toLowerCase() !== "hostinger"
    || variables.CCPUN_DEPLOYMENT_ROLE?.trim().toLowerCase() !== "web") return;

  const values = Object.fromEntries(
    RUNTIME_ENV_KEYS.map((key) => [key, variables[key]?.trim()]).filter(([, value]) => Boolean(value)),
  );
  if (!values.CCPUN_APP_ENV || !values.NEXT_PUBLIC_CCPUN_APP_ENV) return;

  if (sealedGitMetadata) {
    if (variables.CCPUN_APP_ENV !== "web-uat" || variables.NEXT_PUBLIC_CCPUN_APP_ENV !== "web-uat" || variables.CCPUN_RELEASE_STAGE !== "shadow" ||
        variables.NEXT_PUBLIC_SANITY_PROJECT_ID !== "ccb9lnw5" || variables.NEXT_PUBLIC_SANITY_DATASET !== "uat" || variables.CCPUN_UAT_MODE !== "1" || variables.CCPUN_ENABLE_PRODUCTION_ANALYTICS !== "0") throw new Error("Pinned Git metadata seal is isolated Web UAT only.");
    const keys = ["CCPUN_GIT_REF", "CCPUN_GIT_SHA", "CCPUN_RELEASE_ID", "NEXT_PUBLIC_CCPUN_GIT_REF", "NEXT_PUBLIC_CCPUN_GIT_SHA", "NEXT_PUBLIC_CCPUN_RELEASE_ID"];
    const sha = sealedGitMetadata.CCPUN_GIT_SHA;
    if (JSON.stringify(Object.keys(sealedGitMetadata).sort()) !== JSON.stringify(keys.sort()) || !/^[0-9a-f]{40}$/.test(sha ?? "") ||
        sealedGitMetadata.CCPUN_GIT_REF !== `codex/hostinger-release-uat-${sha}` || sealedGitMetadata.CCPUN_RELEASE_ID !== `hostinger-web-uat-${sha.slice(0, 12)}` ||
        keys.slice().filter(key => key.startsWith("NEXT_PUBLIC_")).some(key => sealedGitMetadata[key] !== sealedGitMetadata[key.slice("NEXT_PUBLIC_".length)])) {
      throw new Error("Invalid pinned Web UAT Git metadata seal.");
    }
  }
  const source = readFileSync(serverFile, "utf8");
  const marker = "// CCPUN_RUNTIME_ENV_BOOTSTRAP";
  const seal = sealedGitMetadata ? `Object.assign(process.env, ${JSON.stringify(sealedGitMetadata)});\n` : "";
  const bootstrap = `${marker}\nconst __ccpunRuntimeEnv = ${JSON.stringify(values)};\nfor (const [key, value] of Object.entries(__ccpunRuntimeEnv)) {\n  if (!process.env[key]) process.env[key] = value;\n}\n${seal}`;
  writeFileSync(serverFile, `${bootstrap}${source}`);
}

export function stageStandaloneRuntime(root = webRoot, variables = process.env, sealedGitMetadata = null) {
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

  injectStandaloneRuntimeEnvironment(resolve(standaloneRoot, "server.js"), variables, sealedGitMetadata);

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
  // Reject unsupported platform inputs before assets, child processes or export.
  if (Object.entries(process.env).some(([key, value]) => key.startsWith("VERCEL_") && value?.trim())) throw new Error("UNSUPPORTED_PROVIDER_METADATA");
  if (["vercel", "@workflow/world-vercel"].includes(process.env.WORKFLOW_TARGET_WORLD?.trim() ?? "")) throw new Error("UNSUPPORTED_WORKFLOW_WORLD");
  if (provider && !["hostinger", "local"].includes(provider)) throw new Error("UNSUPPORTED_BUILD_PROVIDER");
  if (isHostinger && process.env.CCPUN_DEPLOYMENT_ROLE?.trim().toLowerCase() !== "web") throw new Error("HOSTINGER_BUILD_ROLE_REQUIRED");
  if (process.argv[2] === "--archive-standalone") {
    if (!process.argv[3] || process.argv.length !== 4) throw new Error("Provide one archive output directory.");
    archiveStandaloneRuntime(process.argv[3]);
  } else {
    preparePinnedHostingerWebUatLock();
    const sealedGitMetadata = derivePinnedHostingerWebUatGitMetadata();
    if (sealedGitMetadata) Object.assign(process.env, sealedGitMetadata);
    const provenance = process.env.CCPUN_EXPORT_STANDALONE === "1" ? captureStandaloneProvenance() : null;
    if (provenance) rmSync(resolve(webRoot, ".next/standalone", PROVENANCE), { force: true });
    if (isHostinger) await materializePublicDirectory();
    run(process.platform === "win32" ? "next.cmd" : "next", ["build", "--webpack"]);
    if (isHostinger) stageStandaloneRuntime(webRoot, process.env, sealedGitMetadata);
    if (provenance) sealStandaloneProvenance(provenance);
  }
}
