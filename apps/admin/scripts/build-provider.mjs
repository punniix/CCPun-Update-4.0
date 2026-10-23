import { isPinnedCloudProductionRelease } from "../../../lib/runtime/hostinger-production-release.mjs";
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

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
// No provider connection is created here. Production manual authoring is
// compiled with publication execution disabled; this seal never claims live readiness.
/** @param {string} root @param {Record<string, string | undefined>} variables */
export function validateNativeNeonSource(root = adminRoot, variables = process.env, run = spawnSync) {
  return validateNativeNeonSourceInternal(root, variables, run, false);
}

/** @param {string} root @param {Record<string, string | undefined>} variables */
function validateNativeNeonSourceInternal(root, variables, run, allowCloudRelease) {
  if (![variables.CCPUN_ARTICLE_SCHEDULER_BACKEND, variables.NEXT_PUBLIC_CCPUN_ARTICLE_SCHEDULER_BACKEND]
    .some((backend) => backend === "native-neon" || backend === "disabled")) return null;
  const production = variables.CCPUN_APP_ENV === "production-admin"
    || variables.CCPUN_ARTICLE_SCHEDULER_BACKEND === "disabled"
    || variables.NEXT_PUBLIC_CCPUN_ARTICLE_SCHEDULER_BACKEND === "disabled";
  const deny = (reason = "") => { throw new Error(`${production ? "NATIVE_ADMIN_PRODUCTION_BUILD_DENIED" : "NATIVE_NEON_UAT_BUILD_DENIED"}${reason ? `:${reason}` : ""}`); };
  const lane = production ? {
    environment: "production-admin", backend: variables.CCPUN_ARTICLE_SCHEDULER_BACKEND === "native-neon" ? "native-neon" : "disabled", sanityProjectId: "kyfxgjnq", sanityDataset: "production",
    neonProjectId: "lively-bar-43618798", neonBranchId: "br-long-resonance-b3ys5xrv",
  } : {
    environment: "admin-uat", backend: "native-neon", sanityProjectId: "ccb9lnw5", sanityDataset: "uat",
    neonProjectId: "young-term-47483330", neonBranchId: "br-crimson-mouse-az7ajkv8",
  };
  if (variables.CCPUN_DEPLOYMENT_PROVIDER !== "hostinger" || variables.CCPUN_DEPLOYMENT_ROLE !== "admin"
    || variables.CCPUN_APP_ENV !== lane.environment || variables.CCPUN_ADMIN_CAPABILITY_PROFILE !== "full"
    || variables.CCPUN_ARTICLE_SCHEDULER_BACKEND !== lane.backend
    || variables.NEXT_PUBLIC_SANITY_PROJECT_ID !== lane.sanityProjectId || variables.NEXT_PUBLIC_SANITY_DATASET !== lane.sanityDataset
    || variables.CCPUN_NEON_PROJECT_ID !== lane.neonProjectId
    || variables.CCPUN_NEON_BRANCH_ID !== lane.neonBranchId || variables.CCPUN_NEON_DATABASE !== "neondb"
    || (variables.NEXT_PUBLIC_CCPUN_APP_ENV !== undefined && variables.NEXT_PUBLIC_CCPUN_APP_ENV !== lane.environment)
    || variables.VERCEL_PROJECT_ID || variables.VERCEL_DEPLOYMENT_ID
    || ![undefined, "0"].includes(variables.CCPUN_NATIVE_WORKFLOW_ENABLED)
    || !/^[a-f0-9]{40}$/.test(variables.CCPUN_GIT_SHA ?? "")
    || !/^[a-zA-Z0-9._/-]{1,128}$/.test(variables.CCPUN_GIT_REF ?? "")
    || !/^[a-zA-Z0-9._-]{1,128}$/.test(variables.CCPUN_RELEASE_ID ?? "")) deny();
  const pinnedCloudRelease = allowCloudRelease && isPinnedCloudProductionRelease(variables, variables, false);
  if (production && (variables.NEXT_PUBLIC_CCPUN_APP_ENV !== "production-admin"
    || variables.NEXT_PUBLIC_CCPUN_ARTICLE_SCHEDULER_BACKEND !== lane.backend
    || (variables.CCPUN_GIT_REF !== "v4-production" && !pinnedCloudRelease) || variables.AUTH_URL !== "https://admin.ccpun.com"
    || variables.CCPUN_NATIVE_WORKFLOW_ENABLED !== "0")) deny();
  const repository = resolve(root, "../..");
  const git = (args, failureReason = "") => {
    const result = run("git", args, { cwd: repository, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    if (result.error || result.status !== 0 || typeof result.stdout !== "string") deny(failureReason);
    return result.stdout.trim();
  };
  const sha = git(["rev-parse", "HEAD"]);
  const checkedOutRef = git(["rev-parse", "--abbrev-ref", "HEAD"]);
  if (variables.CCPUN_GIT_REF === "HEAD" || (checkedOutRef !== "HEAD" && checkedOutRef !== variables.CCPUN_GIT_REF)) deny();
  // Fixed reason codes distinguish source failures without logging Git output,
  // environment values or changed paths. Every original predicate still denies.
  if (sha !== variables.CCPUN_GIT_SHA) deny("SHA_MISMATCH");
  const sourceRef = pinnedCloudRelease ? `refs/heads/${variables.CCPUN_GIT_REF}` : variables.CCPUN_GIT_REF;
  if (git(["rev-parse", "--verify", `${sourceRef}^{commit}`], "REF_RESOLUTION_MISMATCH") !== sha) deny("REF_RESOLUTION_MISMATCH");
  if (git(["status", "--porcelain", "--untracked-files=no"])) deny("TRACKED_DIRTY");
  // The new runtime must be committed as well: a clean tracked diff alone
  // cannot attest an untracked implementation left in the build workspace.
  git(["ls-files", "--error-unmatch", "package-lock.json", "apps/admin/next.config.ts", "apps/admin/scripts/build-provider.mjs", "lib/runtime/hostinger-production-release.mjs",
    "apps/admin/instrumentation.ts", "lib/admin/article-schedule-clock.ts", "lib/admin/article-scheduling.ts",
    "lib/admin/operations/article-schedule-sql.ts", "lib/admin/operations/article-schedule-store.ts",
    "lib/admin/operations/jobs-read-model.ts", "apps/admin/app/api/admin/content/[id]/schedule/route.ts", "scripts/article-schedule-worker.ts"]);
  const publicValues = {
    NEXT_PUBLIC_CCPUN_DEPLOYMENT_PROVIDER: "hostinger",
    NEXT_PUBLIC_CCPUN_DEPLOYMENT_ROLE: "admin",
    NEXT_PUBLIC_CCPUN_ARTICLE_SCHEDULER_BACKEND: lane.backend,
    NEXT_PUBLIC_CCPUN_ADMIN_CAPABILITY_PROFILE: "full",
    NEXT_PUBLIC_CCPUN_GIT_SHA: sha,
    NEXT_PUBLIC_CCPUN_GIT_REF: variables.CCPUN_GIT_REF,
    NEXT_PUBLIC_CCPUN_RELEASE_ID: variables.CCPUN_RELEASE_ID,
  };
  for (const [key, value] of Object.entries(publicValues)) {
    if (variables[key] !== undefined && variables[key] !== value) deny();
  }
  return { schemaVersion: 1, provider: "hostinger", role: "admin", environment: lane.environment,
    capabilityProfile: "full", schedulerBackend: lane.backend, gitSha: sha, gitRef: variables.CCPUN_GIT_REF,
    releaseId: variables.CCPUN_RELEASE_ID, lockSha256: createHash("sha256").update(readFileSync(resolve(repository, "package-lock.json"))).digest("hex"),
    sanityProjectId: lane.sanityProjectId, sanityDataset: lane.sanityDataset, neonProjectId: lane.neonProjectId,
    neonBranchId: lane.neonBranchId, neonDatabase: "neondb", productionReady: false, publicValues };
}

/** Build activation remains off; source provenance is reusable by the private worker.
 * @param {string} root @param {Record<string, string | undefined>} variables */
export function validateNativeNeonBuild(root = adminRoot, variables = process.env, run = spawnSync) {
  const seal = validateNativeNeonSourceInternal(root, variables, run, true);
  if (seal && (![undefined, "0", "1"].includes(variables.CCPUN_ARTICLE_SCHEDULING_ENABLED)
    || variables.CCPUN_ARTICLE_SCHEDULE_EXECUTOR_ENABLED !== "0"
    || variables.CCPUN_NATIVE_WORKFLOW_ENABLED !== "0"
    || ![undefined, "cloud"].includes(variables.CCPUN_ARTICLE_SCHEDULE_EXECUTION_PLANE)
    || (seal.environment === "production-admin" && (variables.CCPUN_ARTICLE_SCHEDULING_ENABLED === undefined
      || (seal.schedulerBackend === "disabled" && variables.CCPUN_ARTICLE_SCHEDULING_ENABLED !== "0"))))) {
    throw new Error(seal.environment === "production-admin" ? "NATIVE_ADMIN_PRODUCTION_BUILD_DENIED" : "NATIVE_NEON_UAT_BUILD_DENIED");
  }
  return seal ? { ...seal, articleScheduleProducerEnabled: variables.CCPUN_ARTICLE_SCHEDULING_ENABLED === "1",
    articleScheduleExecutorEnabled: false, executionPlane: "cloud" } : null;
}

export function sealNativeNeonRuntime(root, seal) {
  if (!seal) return;
  const standalone = resolve(root, ".next/standalone");
  const paths = JSON.parse(readFileSync(resolve(standalone, ".next/server/app-paths-manifest.json"), "utf8"));
  if (Object.keys(paths).some((path) => path === "/.well-known/workflow" || path.startsWith("/.well-known/workflow/"))) {
    throw new Error("NATIVE_NEON_SDK_ROUTE_PRESENT");
  }
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const item = resolve(directory, entry.name);
      if (/^\.env|\.(?:pem|p12|pfx|key)$/i.test(entry.name)
        || entry.name === "ccpun-native-workflow-world.cjs") throw new Error("NATIVE_NEON_RUNTIME_INPUT_DENIED");
      if (entry.isSymbolicLink()) {
        const target = relative(standalone, realpathSync(item));
        if (target === ".." || target.startsWith("../") || isAbsolute(target)) throw new Error("NATIVE_NEON_RUNTIME_LINK_DENIED");
      } else if (entry.isDirectory()) visit(item);
    }
  };
  visit(standalone);
  const { publicValues, ...manifest } = seal;
  void publicValues;

  if (seal.environment === "admin-uat") {
    const serverPath = resolve(standalone, "server.js");
    if (!existsSync(serverPath)) throw new Error("NATIVE_NEON_UAT_RUNTIME_ENTRY_MISSING");
    const runtimeIdentity = {
      CCPUN_DEPLOYMENT_PROVIDER: "hostinger",
      CCPUN_DEPLOYMENT_ROLE: "admin",
      CCPUN_RELEASE_STAGE: "shadow",
      CCPUN_APP_ENV: "admin-uat",
      NEXT_PUBLIC_CCPUN_APP_ENV: "admin-uat",
      NEXT_PUBLIC_CCPUN_DEPLOYMENT_PROVIDER: "hostinger",
      NEXT_PUBLIC_CCPUN_DEPLOYMENT_ROLE: "admin",
      NEXT_PUBLIC_SANITY_PROJECT_ID: "ccb9lnw5",
      NEXT_PUBLIC_SANITY_DATASET: "uat",
      CCPUN_UAT_MODE: "1",
      CCPUN_ENABLE_PRODUCTION_ANALYTICS: "0",
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
      CCPUN_NEON_PROJECT_ID: seal.neonProjectId,
      CCPUN_NEON_BRANCH_ID: seal.neonBranchId,
      CCPUN_NEON_DATABASE: seal.neonDatabase,
      AUTH_URL: "https://admin-test.ccpun.com",
      CCPUN_GIT_REF: seal.gitRef,
      CCPUN_GIT_SHA: seal.gitSha,
      CCPUN_RELEASE_ID: seal.releaseId,
      NEXT_PUBLIC_CCPUN_GIT_REF: seal.gitRef,
      NEXT_PUBLIC_CCPUN_GIT_SHA: seal.gitSha,
      NEXT_PUBLIC_CCPUN_RELEASE_ID: seal.releaseId,
      CCPUN_SOCIAL_ENABLED: "1",
      CCPUN_SOCIAL_DATA_MODE: "synthetic",
      CCPUN_SOCIAL_OPERATIONS_ENABLED: "1",
      CCPUN_SOCIAL_PROVIDER_READS_ENABLED: "0",
      CCPUN_SOCIAL_PROVIDER_WRITES_ENABLED: "0",
      CCPUN_SOCIAL_ANALYTICS_INGESTION_ENABLED: "0",
    };
    const prelude = `/* CCPun sealed Admin UAT runtime identity */\nObject.assign(process.env,${JSON.stringify(runtimeIdentity)});\n`;
    const server = readFileSync(serverPath, "utf8");
    if (server.includes("CCPun sealed Admin UAT runtime identity")) throw new Error("NATIVE_NEON_UAT_RUNTIME_ALREADY_SEALED");
    writeFileSync(serverPath, prelude + server, { mode: 0o600 });
  }

  writeFileSync(resolve(standalone, "ccpun-native-admin-manifest.json"), JSON.stringify({ ...manifest,
    nodeVersion: process.version, platform: process.platform, architecture: process.arch,
    buildId: readFileSync(resolve(standalone, ".next/BUILD_ID"), "utf8").trim() }, null, 2) + "\n", { mode: 0o600 });
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

export function applyPinnedAdminUatBuildFallback(root = adminRoot, variables = process.env, run = spawnSync) {
  const repository = resolve(root, "../..");
  const git = (args) => {
    const result = run("git", args, { cwd: repository, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return result.error || result.status !== 0 || typeof result.stdout !== "string" ? "" : result.stdout.trim();
  };
  const branch = git(["symbolic-ref", "--short", "HEAD"]);
  const sha = git(["rev-parse", "HEAD"]);
  if (!branch || !/^[a-f0-9]{40}$/i.test(sha) || !/^admin\/hostinger-release-uat-[a-f0-9]{40}$/.test(branch)) return null;
  if (variables.VERCEL_PROJECT_ID?.trim() || variables.VERCEL_DEPLOYMENT_ID?.trim()) throw new Error("ADMIN_UAT_RELEASE_VERCEL_CONFLICT");
  const explicitProvider = variables.CCPUN_DEPLOYMENT_PROVIDER?.trim().toLowerCase();
  const explicitRole = variables.CCPUN_DEPLOYMENT_ROLE?.trim().toLowerCase();
  if (explicitProvider && explicitProvider !== "hostinger") throw new Error("ADMIN_UAT_RELEASE_PROVIDER_CONFLICT");
  if (explicitRole && explicitRole !== "admin") throw new Error("ADMIN_UAT_RELEASE_ROLE_CONFLICT");

  const defaults = {
    CCPUN_DEPLOYMENT_PROVIDER: "hostinger",
    CCPUN_DEPLOYMENT_ROLE: "admin",
    CCPUN_RELEASE_STAGE: "shadow",
    CCPUN_APP_ENV: "admin-uat",
    NEXT_PUBLIC_CCPUN_APP_ENV: "admin-uat",
    NEXT_PUBLIC_SANITY_PROJECT_ID: "ccb9lnw5",
    NEXT_PUBLIC_SANITY_DATASET: "uat",
    CCPUN_UAT_MODE: "1",
    CCPUN_ENABLE_PRODUCTION_ANALYTICS: "0",
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
    CCPUN_NEON_PROJECT_ID: "young-term-47483330",
    CCPUN_NEON_BRANCH_ID: "br-crimson-mouse-az7ajkv8",
    CCPUN_NEON_ENDPOINT_ID: "ep-mute-frost-aztvz394",
    CCPUN_NEON_DATABASE: "neondb",
    AUTH_URL: "https://admin-test.ccpun.com",
    CCPUN_GIT_REF: branch,
    CCPUN_GIT_SHA: sha,
    CCPUN_RELEASE_ID: `hostinger-admin-uat-${sha.slice(0, 12)}`,
  };
  // Dedicated UAT release refs may replace stale non-secret editorial markers.
  // The source validator below binds the checked-out branch to the actual SHA;
  // secret runtime inputs are intentionally absent from this defaults object.
  for (const [key, value] of Object.entries(defaults)) variables[key] = value;
  return { branch, sha };
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
  console.log("Hostinger Admin standalone runtime staged.");
}

// A single explicitly requested acceptance run inherits the protected UAT DSN
// in memory. The ordinary build and sealed runtime retain cloud/executor-off.
/** @param {Record<string, string | undefined>} variables @returns {Record<string, string | undefined>} */
export function nativeSchedulerUatTestEnvironment(variables, seal) {
  const deny = () => { throw new Error("NATIVE_SCHEDULER_UAT_ACCEPTANCE_TARGET_DENIED"); };
  if (!seal || seal.environment !== "admin-uat" || seal.provider !== "hostinger" || seal.role !== "admin"
    || seal.capabilityProfile !== "full" || seal.schedulerBackend !== "native-neon"
    || seal.gitRef !== `admin/hostinger-release-uat-${seal.gitSha}`
    || variables.CCPUN_DEPLOYMENT_PROVIDER !== "hostinger" || variables.CCPUN_DEPLOYMENT_ROLE !== "admin"
    || variables.CCPUN_APP_ENV !== "admin-uat" || variables.CCPUN_ARTICLE_SCHEDULE_EXECUTOR_ENABLED !== "0"
    || variables.CCPUN_NATIVE_WORKFLOW_ENABLED !== "0"
    || ![undefined, "cloud"].includes(variables.CCPUN_ARTICLE_SCHEDULE_EXECUTION_PLANE)
    || !variables.CCPUN_ADMIN_DATABASE_URL) deny();
  const keys = ["PATH", "TZ", "LANG", "LC_ALL", "TMPDIR", "CCPUN_DEPLOYMENT_PROVIDER", "CCPUN_DEPLOYMENT_ROLE", "CCPUN_APP_ENV",
    "CCPUN_ADMIN_CAPABILITY_PROFILE", "NEXT_PUBLIC_CCPUN_ADMIN_CAPABILITY_PROFILE", "CCPUN_ARTICLE_SCHEDULER_BACKEND", "NEXT_PUBLIC_CCPUN_ARTICLE_SCHEDULER_BACKEND",
    "CCPUN_GIT_SHA", "CCPUN_GIT_REF", "CCPUN_RELEASE_ID", "NEXT_PUBLIC_CCPUN_GIT_SHA", "NEXT_PUBLIC_CCPUN_GIT_REF", "NEXT_PUBLIC_CCPUN_RELEASE_ID",
    "NEXT_PUBLIC_SANITY_PROJECT_ID", "NEXT_PUBLIC_SANITY_DATASET", "CCPUN_NEON_PROJECT_ID", "CCPUN_NEON_BRANCH_ID", "CCPUN_NEON_DATABASE", "CCPUN_ADMIN_DATABASE_URL"];
  const env = Object.fromEntries(keys.filter(key => variables[key] !== undefined).map(key => [key, variables[key]]));
  return { ...env, NODE_ENV: "test", CCPUN_NATIVE_ARTICLE_SCHEDULER_UAT_TEST: "1", CCPUN_ARTICLE_SCHEDULING_ENABLED: "1",
    CCPUN_ARTICLE_SCHEDULE_EXECUTION_PLANE: "vps", CCPUN_ARTICLE_SCHEDULE_EXECUTOR_ENABLED: "1", CCPUN_NATIVE_WORKFLOW_ENABLED: "0" };
}

export function assertNativeSchedulerUatTestResult(result) {
  // Never relay child output: provider/parser diagnostics could contain secrets.
  const tap = typeof result.stdout === "string" ? result.stdout : "";
  const expected = "actual Hostinger UAT native registration/CAS/due/cancel and restarted claim exclusion";
  const lines = tap.split("\n");
  if (result.error || result.status !== 0 || lines.filter(line => /^ok /.test(line)).join("\n") !== `ok 1 - ${expected}`
    || ["tests 1", "pass 1", "fail 0", "skipped 0", "cancelled 0"].some(value => lines.filter(line => line.startsWith(`# ${value.split(" ")[0]} `)).join("\n") !== `# ${value}`)
    || /# SKIP|# TODO|^not ok /m.test(tap)) {
    // Only the harness's exact TAP error record may supply closed diagnostics.
    // Do not forward stderr, stack, assertions, provider messages or raw lines.
    const phases = new Set(["preflight", "prepare", "ack", "cancel-generation", "wait-db-due", "claim-exit", "fresh-process-clock", "verified", "cleanup"]);
    const codes = new Set(["TARGET_DENIED", "AMBIENT_ENV_DENIED", "ENV_FILE_DENIED", "UAT_BINDING_DENIED", "DSN_POLICY_DENIED", "SOURCE_DENIED",
      "DURABLE_IDENTITY_DENIED", "FIXTURE_ARGUMENT_DENIED", "FIXTURE_CLAIM_DENIED", "OWNERSHIP_DENIED", "FIXTURE_STATE_DENIED", "CMS_WRITE_DENIED",
      "FIXTURE_EXECUTION_DENIED", "CHILD_FAILED", "CLOCK_DENIED", "DUE_TIMEOUT", "UNCLASSIFIED"]);
    const records = lines.map(line => line.match(/^  error: 'NATIVE_NEON_UAT_FAILED phase=([a-z-]+) code=([A-Z_]+)'$/)).filter(Boolean);
    const record = records.length === 1 ? records[0] : null;
    const diagnostic = record && phases.has(record[1]) && codes.has(record[2]) ? ` phase=${record[1]} code=${record[2]}` : "";
    throw new Error(`NATIVE_SCHEDULER_UAT_ACCEPTANCE_FAILED${diagnostic}`);
  }
  return "NATIVE_SCHEDULER_UAT_ACCEPTANCE_PASS tests=1 pass=1 fail=0 skipped=0";
}

/** @param {string} root @param {Record<string, string | undefined>} variables */
export function runNativeSchedulerUatAcceptance(root = adminRoot, variables = process.env, seal, run = spawnSync) {
  if (process.platform !== "linux" || process.versions.node.split(".")[0] !== "24") throw new Error("NATIVE_SCHEDULER_UAT_ACCEPTANCE_RUNTIME_DENIED");
  const env = nativeSchedulerUatTestEnvironment(variables, seal);
  const result = run(process.execPath, ["--conditions=react-server", "--import", "tsx", "--test", "--test-reporter=tap", "tests/admin/native-article-scheduler-uat.test.ts"],
    { cwd: resolve(root, "../.."), env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 300_000, maxBuffer: 1024 * 1024 });
  console.log(assertNativeSchedulerUatTestResult(result));
}

// Hostinger's older glibc image can use SWC WASM while loading config. Bundle
// the canonical TS graph so Node never resolves its extensionless TS imports.
// Keep the source validator external: it must use its real path and Git gates.
export function runAdminNextBuild(root = adminRoot, variables = process.env, run = spawnSync) {
  const hostinger = variables.CCPUN_DEPLOYMENT_PROVIDER?.trim().toLowerCase() === "hostinger";
  const compiled = resolve(root, "next.config.mjs");
  if (hostinger && lstatSync(compiled, { throwIfNoEntry: false })) throw new Error("HOSTINGER_ADMIN_CONFIG_OUTPUT_EXISTS");
  try {
    if (hostinger) {
      const { buildSync } = createRequire(import.meta.url)("esbuild");
      buildSync({ entryPoints: [resolve(root, "next.config.ts")], outfile: compiled,
        bundle: true, platform: "node", format: "esm", target: "node24", packages: "external",
        external: ["./scripts/build-provider.mjs"], logLevel: "info" });
    }
    const nextBin = resolve(root, "../../node_modules/next/dist/bin/next");
    return run(process.execPath, [nextBin, "build", ...(hostinger ? ["--webpack"] : [])],
      { cwd: root, env: variables, stdio: "inherit" });
  } finally {
    if (hostinger) rmSync(compiled, { force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // Preserve native compiler behavior; reject retired provider inputs before build work.
  if (Object.entries(process.env).some(([key, value]) => key.startsWith("VERCEL_") && value?.trim())) throw new Error("UNSUPPORTED_PROVIDER_METADATA");
  if (["vercel", "@workflow/world-vercel"].includes(process.env.WORKFLOW_TARGET_WORLD?.trim() ?? "")) throw new Error("UNSUPPORTED_WORKFLOW_WORLD");
  const provider = process.env.CCPUN_DEPLOYMENT_PROVIDER?.trim().toLowerCase() ?? "";
  if (provider && !["hostinger", "local"].includes(provider)) throw new Error("UNSUPPORTED_BUILD_PROVIDER");
  if (provider === "hostinger" && process.env.CCPUN_DEPLOYMENT_ROLE?.trim().toLowerCase() !== "admin") throw new Error("HOSTINGER_BUILD_ROLE_REQUIRED");
  // Run before materialization, native acceptance, dependency installation or compiler work.
  createRequire(import.meta.url)("../../../scripts/check-next-security-baseline.mjs");
  const inferredAdminUat = applyPinnedAdminUatBuildFallback();
  if (inferredAdminUat) console.log(`Hostinger Admin UAT build identity inferred from exact release ref ${inferredAdminUat.branch} @ ${inferredAdminUat.sha.slice(0, 12)}.`);
  const hostinger = process.env.CCPUN_DEPLOYMENT_PROVIDER?.trim().toLowerCase() === "hostinger";
  const nativeSeal = validateNativeNeonBuild();
  const acceptance = process.argv.slice(2).includes("--native-scheduler-uat-acceptance");
  if (acceptance && process.argv.slice(2).length !== 1) throw new Error("NATIVE_SCHEDULER_UAT_ACCEPTANCE_ARGUMENT_DENIED");
  // Validate the explicit opt-in before dependency installation or compiler work.
  if (acceptance) nativeSchedulerUatTestEnvironment({ ...process.env, ...(nativeSeal?.publicValues ?? {}) }, nativeSeal);
  if (hostinger && process.env.CCPUN_ADMIN_CAPABILITY_PROFILE?.trim().toLowerCase() !== "editorial" && !nativeSeal) throw new Error("Hostinger full Admin build requires a sealed native Admin lane.");
  if (hostinger) installAdminMonorepoDependencies();
  const buildEnvironment = { ...process.env, ...(nativeSeal?.publicValues ?? {}), ...(nativeSeal ? { CCPUN_ARTICLE_SCHEDULE_EXECUTOR_ENABLED: "0", CCPUN_NATIVE_WORKFLOW_ENABLED: "0" } : {}) };
  if (acceptance) runNativeSchedulerUatAcceptance(adminRoot, buildEnvironment, nativeSeal);
  const result = runAdminNextBuild(adminRoot, buildEnvironment);
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
  if (hostinger) {
    stageAdminStandaloneRuntime();
    sealNativeNeonRuntime(adminRoot, nativeSeal ? validateNativeNeonBuild(adminRoot, buildEnvironment) : null);
  }
}
