import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, rmSync, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const adminRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function installAdminMonorepoDependencies(root = adminRoot, run = spawnSync, variables = process.env) {
  const repository = resolve(root, "../..");
  const manifest = resolve(repository, "package.json");
  const lock = resolve(repository, "package-lock.json");
  if (!existsSync(manifest) || !existsSync(lock)) throw new Error("Hostinger Admin build requires the complete monorepo root package.json and package-lock.json.");
  const pkg = JSON.parse(readFileSync(manifest, "utf8"));
  if (!Array.isArray(pkg.workspaces) || !pkg.workspaces.includes("apps/*")) throw new Error("Hostinger Admin build requires the repository workspace manifest.");
  // Hostinger initially installs the selected Admin workspace only. Its shared
  // source imports root Sanity/auth/Workflow packages even in editorial mode.
  // Clear inherited workspace selection so npm installs the root lock exactly.
  const env = { ...variables };
  for (const key of Object.keys(env)) {
    if (/^npm_config_(?:workspace|workspaces|include_workspace_root|prefix|local_prefix)$/i.test(key)) delete env[key];
  }
  const result = run(process.platform === "win32" ? "npm.cmd" : "npm", ["ci", "--ignore-scripts", "--include=dev", "--include=optional", "--workspaces", "--include-workspace-root", "--no-audit", "--no-fund"], { cwd: repository, env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Hostinger Admin monorepo dependency install failed (exit ${result.status ?? "unknown"}).`);
}
function replaceDirectory(source, destination) {
  if (!existsSync(source)) throw new Error(`Required Admin build input is missing: ${source}`);
  try {
    if (lstatSync(destination).isSymbolicLink()) unlinkSync(destination);
    else rmSync(destination, { recursive: true, force: true });
  } catch (error) { if (error?.code !== "ENOENT") throw error; }
  mkdirSync(dirname(destination), { recursive: true });
  cpSync(source, destination, { recursive: true, dereference: true });
}

export function stageAdminStandaloneRuntime(root = adminRoot) {
  const standalone = resolve(root, ".next/standalone");
  const nested = resolve(standalone, "apps/admin");
  const runtime = existsSync(resolve(nested, "server.js")) ? nested : standalone;
  if (!existsSync(resolve(runtime, "server.js"))) throw new Error("Admin standalone entry is missing.");
  // The Admin source public/ contains only its favicon. Draft preview also
  // needs the repository's public assets; preserve the Admin favicon override.
  const repositoryPublic = resolve(root, "../../public");
  replaceDirectory(existsSync(repositoryPublic) ? repositoryPublic : resolve(root, "public"), resolve(runtime, "public"));
  if (existsSync(resolve(root, "public"))) cpSync(resolve(root, "public"), resolve(runtime, "public"), { recursive: true, dereference: true });
  replaceDirectory(resolve(runtime, "public"), resolve(root, ".next/static/ccpun-public"));
  replaceDirectory(resolve(root, ".next/static"), resolve(runtime, ".next/static"));
  if (runtime !== standalone) {
    cpSync(resolve(runtime, "server.js"), resolve(standalone, "server.js"));
    if (existsSync(resolve(runtime, "package.json"))) cpSync(resolve(runtime, "package.json"), resolve(standalone, "package.json"));
    replaceDirectory(resolve(runtime, ".next"), resolve(standalone, ".next"));
    replaceDirectory(resolve(runtime, "public"), resolve(standalone, "public"));
  }
  for (const required of ["server.js", "node_modules/next/package.json", ".next/BUILD_ID", ".next/static", "public/favicon.ico", ".next/static/ccpun-public/favicon.ico"]) {
    if (!existsSync(resolve(standalone, required))) throw new Error(`Admin standalone runtime is incomplete: ${required}`);
  }
  console.log(`Hostinger editorial Admin runtime ready at ${standalone}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const hostinger = process.env.CCPUN_DEPLOYMENT_PROVIDER?.trim().toLowerCase() === "hostinger";
  if (hostinger && process.env.CCPUN_ADMIN_CAPABILITY_PROFILE?.trim().toLowerCase() !== "editorial") throw new Error("Hostinger Admin requires editorial profile.");
  if (hostinger) installAdminMonorepoDependencies();
  const nextBin = resolve(adminRoot, "../../node_modules/next/dist/bin/next");
  const result = spawnSync(process.execPath, [nextBin, "build", ...(hostinger ? ["--webpack"] : [])], { cwd: adminRoot, env: process.env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
  if (hostinger) stageAdminStandaloneRuntime();
}
