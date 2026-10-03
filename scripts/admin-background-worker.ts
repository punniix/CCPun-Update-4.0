// One bounded private VPS invocation. Use an external timer, never a public route:
// node --conditions=react-server --import tsx scripts/admin-background-worker.ts social|line-rich-menu
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateNativeNeonSource } from "../apps/admin/scripts/build-provider.mjs";
import { resolveSocialRuntime, SOCIAL_UAT_RUNTIME_BRANCHES } from "../lib/admin/social/runtime";
import type { SocialWorkerResult } from "../lib/admin/social/worker";
import type { LineRichMenuReconcileResult } from "../lib/admin/line/rich-menu-reconciler";

const adminRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../apps/admin");
type Variables = Record<string, string | undefined>;

export function validateBackgroundWorker(workload: string, variables: Variables, run = spawnSync) {
  if (!["social", "line-rich-menu"].includes(workload)
    || variables.CCPUN_BACKGROUND_EXECUTION_PLANE !== "vps" || variables.CCPUN_BACKGROUND_WORKER_ENABLED !== "1"
    || variables.NEXT_RUNTIME !== undefined || variables.NEXT_PHASE !== undefined
    || variables.CCPUN_NATIVE_WORKFLOW_ENABLED !== "0"
    || Object.entries(variables).some(([key, value]) => key.startsWith("VERCEL_") && value)) {
    throw new Error("ADMIN_BACKGROUND_ACTIVATION_DENIED");
  }
  const seal = validateNativeNeonSource(adminRoot, variables, run);
  if (!seal || variables.NEXT_PUBLIC_CCPUN_APP_ENV !== seal.environment
    || variables.CCPUN_UAT_MODE !== (seal.environment === "admin-uat" ? "1" : "0")
    || variables.AUTH_URL !== (seal.environment === "admin-uat" ? "https://admin-test.ccpun.com" : "https://admin.ccpun.com")
    || variables.CCPUN_ENABLE_PRODUCTION_ANALYTICS !== "0") throw new Error("ADMIN_BACKGROUND_SOURCE_DENIED");
  const tracked = run("git", ["ls-files", "--error-unmatch", "scripts/admin-background-worker.ts",
    "lib/admin/social/worker.ts", "lib/admin/social/runtime.ts", "lib/admin/line/rich-menu-reconciler.ts",
    "lib/admin/line/assets/ccpun-line-rich-menu-v1.png", "lib/admin/line/assets/ccpun-line-rich-menu-v3.png"],
  { cwd: resolve(adminRoot, "../.."), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (tracked.error || tracked.status !== 0) throw new Error("ADMIN_BACKGROUND_SOURCE_DENIED");
  // Preserve the existing social branch and least-privilege connection contract.
  if (workload === "social" && !resolveSocialRuntime(variables, { uatBranches: SOCIAL_UAT_RUNTIME_BRANCHES, requireUatNeon: true })) {
    throw new Error("ADMIN_BACKGROUND_SOCIAL_LANE_DENIED");
  }
}

export async function runAdminBackgroundWorker(workload: string, variables: Variables = process.env, dependencies = {
  validate: () => validateBackgroundWorker(workload, variables),
  social: async (): Promise<SocialWorkerResult> => {
    const { runSocialWorker } = await import("../lib/admin/social/worker");
    return runSocialWorker({ env: variables, maxJobs: 6 });
  },
  richMenu: async (): Promise<LineRichMenuReconcileResult> => {
    // The existing reconciler reads process.env; a substitute lane must never authorize it.
    if (variables !== process.env) throw new Error("ADMIN_BACKGROUND_PROCESS_LANE_DENIED");
    const { reconcileDesiredLineRichMenu } = await import("../lib/admin/line/rich-menu-reconciler");
    return reconcileDesiredLineRichMenu();
  },
}) {
  dependencies.validate();
  if (workload === "social") {
    const result = await dependencies.social();
    // Report counts only, never job IDs, provider error strings or customer state.
    return { workload, scanned: result.scanned, eligible: result.eligible, executed: result.executed, skipped: result.skipped,
      reconciliationRequired: result.results.filter((item) => item.outcome === "needs-reconciliation").length,
      conflicts: result.results.filter((item) => item.outcome === "conflict").length,
      failed: result.results.filter((item) => item.outcome === "failed").length };
  }
  const result = await dependencies.richMenu();
  return { workload, status: result.status };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void (async () => {
    if (process.argv.length !== 3) throw new Error("ADMIN_BACKGROUND_ARGUMENT_DENIED");
    const result = await runAdminBackgroundWorker(process.argv[2]);
    console.log(JSON.stringify(result));
    if (result.status !== undefined ? !["verified", "hold", "idle"].includes(result.status)
      : result.failed || result.conflicts || result.reconciliationRequired) process.exitCode = 1;
  })().catch(() => {
    // No underlying source, credential, database or provider error reaches logs.
    console.error("ADMIN_BACKGROUND_RUN_DENIED");
    process.exitCode = 1;
  });
}
