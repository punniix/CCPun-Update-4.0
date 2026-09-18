import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ADMIN_PROJECT_ID = "prj_6tuUxJxYbQ4mpF7sMgNWx2p2jowN";
const PROJECT_ID = "kyfxgjnq";
const DATASET = "production";
const CONFIRM = "CCPUN-CONTENT-ID-NORMALIZE-PRODUCTION";

const productionAdminBuild =
  process.env.VERCEL_ENV === "production" &&
  process.env.VERCEL_PROJECT_ID === ADMIN_PROJECT_ID &&
  process.env.VERCEL_GIT_COMMIT_REF === "v4-production";

if (!productionAdminBuild) {
  console.log("[sanity-id-migration] skipped: not the exact Admin Production build lane");
  process.exit(0);
}

const token = process.env.SANITY_API_WRITE_TOKEN?.trim();
if (!token) {
  console.error("[sanity-id-migration] refusing: SANITY_API_WRITE_TOKEN is unavailable in Admin Production");
  process.exit(1);
}

if (
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID !== PROJECT_ID ||
  process.env.NEXT_PUBLIC_SANITY_DATASET !== DATASET
) {
  console.error("[sanity-id-migration] refusing: Admin Production is not pinned to kyfxgjnq/production");
  process.exit(1);
}

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const env = {
  ...process.env,
  CCPUN_APP_ENV: "local-production",
  NEXT_PUBLIC_CCPUN_APP_ENV: "local-production",
  NEXT_PUBLIC_SANITY_PROJECT_ID: PROJECT_ID,
  NEXT_PUBLIC_SANITY_DATASET: DATASET,
  SANITY_STUDIO_PROJECT_ID: PROJECT_ID,
  SANITY_STUDIO_DATASET: DATASET,
  SANITY_API_TOKEN: token,
  SANITY_AUTH_TOKEN: token,
};

function run(label, args) {
  console.log(`[sanity-id-migration] ${label}`);
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "scripts/migrate-canonical-content-ids.ts", ...args],
    {
      cwd: repoRoot,
      env,
      stdio: "inherit",
      timeout: 10 * 60 * 1000,
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status ?? "unknown"}`);
  }
}

run("preflight dry-run", ["--dry-run"]);
run("apply", ["--apply", `--confirm=${CONFIRM}`]);
run("zero-plan readback", ["--dry-run"]);
console.log("[sanity-id-migration] completed");
