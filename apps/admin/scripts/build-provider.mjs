import { cpSync, existsSync, lstatSync, mkdirSync, rmSync, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const adminRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
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
  const nextBin = resolve(adminRoot, "../../node_modules/next/dist/bin/next");
  const result = spawnSync(process.execPath, [nextBin, "build", ...(hostinger ? ["--webpack"] : [])], { cwd: adminRoot, env: process.env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
  if (hostinger) stageAdminStandaloneRuntime();
}
