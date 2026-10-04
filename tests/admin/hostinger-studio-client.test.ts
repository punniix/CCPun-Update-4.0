import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { build } from "esbuild";
import { validateNativeNeonBuild } from "../../apps/admin/scripts/build-provider.mjs";
import { isStudioConfigurationAllowed } from "../../cms/sanity/policy/studio-policy";

const SHA = "a".repeat(40);
const ADMIN = "prj_6tuUxJxYbQ4mpF7sMgNWx2p2jowN";
const native = {
  NEXT_PUBLIC_CCPUN_DEPLOYMENT_PROVIDER: "hostinger", NEXT_PUBLIC_CCPUN_DEPLOYMENT_ROLE: "admin",
  NEXT_PUBLIC_CCPUN_ADMIN_CAPABILITY_PROFILE: "full", NEXT_PUBLIC_CCPUN_ARTICLE_SCHEDULER_BACKEND: "disabled",
  NEXT_PUBLIC_CCPUN_GIT_SHA: SHA, NEXT_PUBLIC_CCPUN_GIT_REF: "v4-production", NEXT_PUBLIC_CCPUN_RELEASE_ID: "native-admin-test",
  NEXT_PUBLIC_CCPUN_VERCEL_PROJECT_ID: "", NEXT_PUBLIC_CCPUN_PRODUCTION_ADMIN_VERCEL_PROJECT_ID: "",
};

async function browser(values: Record<string, string | undefined>) {
  const result = await build({
    entryPoints: [fileURLToPath(new URL("../../cms/sanity/policy/studio-policy.ts", import.meta.url))],
    bundle: true, write: false, platform: "browser", format: "cjs", target: "es2022",
    define: { "process.release": "undefined", ...Object.fromEntries(Object.entries(values)
      .map(([key, value]) => [`process.env.${key}`, value === undefined ? "undefined" : JSON.stringify(value)])) },
  });
  const context = { module: { exports: {} }, process: { env: {} } };
  runInNewContext(result.outputFiles[0].text, context);
  return context.module.exports as typeof import("../../cms/sanity/policy/studio-policy");
}

test("actual browser bundle admits sealed native Studio and retains auth/editorial restrictions", async () => {
  const policy = await browser(native);
  assert.equal(policy.isStudioConfigurationAllowed("production", "production-admin", "kyfxgjnq"), true);
  assert.equal(policy.filterStudioAuthProviders([{ name: "google" }, { name: "github" }], "production", "production-admin", "kyfxgjnq").map(x => x.name).join(","), "google");
  const actions = [{ action: "publish" }, { action: "delete" }, { action: "unpublishVersion" }];
  assert.equal(policy.filterStudioDocumentActions(actions, "production", "production-admin", "article", "kyfxgjnq").map(x => x.action).join(","), "publish,delete");
  assert.equal(policy.filterStudioDocumentActions(actions, "production", "production-admin", "auditLog", "kyfxgjnq").length, 0);
  assert.equal(policy.filterStudioNewDocumentOptions([{ templateId: "article" }, { templateId: "category" }, { templateId: "auditLog" }], "production", "production-admin", "kyfxgjnq").map(x => x.templateId).join(","), "article");
  assert.equal(policy.isStudioConfigurationAllowed("uat", "production-admin", "ccb9lnw5"), false);
});

test("pinned Hostinger Production release ref is accepted only when it matches the compiled SHA", async () => {
  const pinned = {
    ...native,
    NEXT_PUBLIC_CCPUN_GIT_REF: `codex/hostinger-release-production-${SHA}`,
  };
  const policy = await browser(pinned);
  assert.equal(policy.isStudioConfigurationAllowed("production", "production-admin", "kyfxgjnq"), true);
  assert.equal(policy.isStudioConfigurationAllowed("production", "production-admin", "kyfxgjnq", {
    ...pinned,
    NEXT_PUBLIC_CCPUN_GIT_REF: `codex/hostinger-release-production-${"b".repeat(40)}`,
  }, false), false);
});

test("native browser markers fail closed without falling back to valid Vercel IDs", async () => {
  const policy = await browser(native);
  const mutations = [
    { NEXT_PUBLIC_CCPUN_DEPLOYMENT_PROVIDER: "vercel" }, { NEXT_PUBLIC_CCPUN_DEPLOYMENT_PROVIDER: "" },
    { NEXT_PUBLIC_CCPUN_DEPLOYMENT_PROVIDER: undefined }, { NEXT_PUBLIC_CCPUN_DEPLOYMENT_ROLE: "web" },
    { NEXT_PUBLIC_CCPUN_DEPLOYMENT_ROLE: undefined }, { NEXT_PUBLIC_CCPUN_ADMIN_CAPABILITY_PROFILE: "editorial" },
    { NEXT_PUBLIC_CCPUN_ADMIN_CAPABILITY_PROFILE: undefined }, { NEXT_PUBLIC_CCPUN_ARTICLE_SCHEDULER_BACKEND: "native-neon" },
    { NEXT_PUBLIC_CCPUN_ARTICLE_SCHEDULER_BACKEND: undefined }, { NEXT_PUBLIC_CCPUN_GIT_SHA: "bad" },
    { NEXT_PUBLIC_CCPUN_GIT_SHA: undefined }, { NEXT_PUBLIC_CCPUN_GIT_REF: "feature/not-production" },
    { NEXT_PUBLIC_CCPUN_RELEASE_ID: undefined }, { NEXT_PUBLIC_CCPUN_RELEASE_ID: "bad release" },
    { NEXT_PUBLIC_CCPUN_VERCEL_PROJECT_ID: ADMIN }, { NEXT_PUBLIC_CCPUN_PRODUCTION_ADMIN_VERCEL_PROJECT_ID: ADMIN },
  ];
  for (const change of mutations) {
    assert.equal(policy.isStudioConfigurationAllowed("production", "production-admin", "kyfxgjnq", { ...native, ...change }, false), false, JSON.stringify(change));
  }
  assert.equal(policy.isStudioConfigurationAllowed("production", "production-admin", "kyfxgjnq", {
    ...native, NEXT_PUBLIC_CCPUN_DEPLOYMENT_PROVIDER: "unknown", NEXT_PUBLIC_CCPUN_VERCEL_PROJECT_ID: ADMIN,
    NEXT_PUBLIC_CCPUN_PRODUCTION_ADMIN_VERCEL_PROJECT_ID: ADMIN,
  }, false), false);
});

test("existing Vercel browser and explicit native UAT stay isolated; public markers cannot grant server access", async () => {
  const legacy = await browser({ NEXT_PUBLIC_CCPUN_VERCEL_PROJECT_ID: ADMIN, NEXT_PUBLIC_CCPUN_PRODUCTION_ADMIN_VERCEL_PROJECT_ID: ADMIN });
  assert.equal(legacy.isStudioConfigurationAllowed("production", "production-admin", "kyfxgjnq"), true);
  const uat = await browser({ ...native, NEXT_PUBLIC_CCPUN_ARTICLE_SCHEDULER_BACKEND: "native-neon", NEXT_PUBLIC_CCPUN_GIT_REF: "codex/native-uat" });
  assert.equal(uat.isStudioConfigurationAllowed("uat", "admin-uat", "ccb9lnw5"), true);
  assert.equal(uat.isStudioConfigurationAllowed("production", "admin-uat", "kyfxgjnq"), false);
  assert.equal(isStudioConfigurationAllowed("production", "production-admin", "kyfxgjnq", native, true), false);
});

test("native validator emits only fixed provider/role markers and rejects conflicting caller markers", () => {
  const root = mkdtempSync(join(tmpdir(), "ccpun-studio-seal-"));
  try {
    const admin = join(root, "apps/admin"); mkdirSync(admin, { recursive: true });
    writeFileSync(join(root, "package-lock.json"), '{"lockfileVersion":3}\n');
    const values = {
      CCPUN_DEPLOYMENT_PROVIDER: "hostinger", CCPUN_DEPLOYMENT_ROLE: "admin", CCPUN_APP_ENV: "production-admin",
      NEXT_PUBLIC_CCPUN_APP_ENV: "production-admin", CCPUN_ADMIN_CAPABILITY_PROFILE: "full",
      CCPUN_ARTICLE_SCHEDULER_BACKEND: "disabled", NEXT_PUBLIC_CCPUN_ARTICLE_SCHEDULER_BACKEND: "disabled",
      CCPUN_ARTICLE_SCHEDULING_ENABLED: "0", CCPUN_ARTICLE_SCHEDULE_EXECUTOR_ENABLED: "0", CCPUN_NATIVE_WORKFLOW_ENABLED: "0", AUTH_URL: "https://admin.ccpun.com",
      NEXT_PUBLIC_SANITY_PROJECT_ID: "kyfxgjnq", NEXT_PUBLIC_SANITY_DATASET: "production",
      CCPUN_NEON_PROJECT_ID: "lively-bar-43618798", CCPUN_NEON_BRANCH_ID: "br-long-resonance-b3ys5xrv", CCPUN_NEON_DATABASE: "neondb",
      CCPUN_GIT_SHA: SHA, CCPUN_GIT_REF: "v4-production", CCPUN_RELEASE_ID: "native-admin-test",
    };
    const git = ((_cmd: string, args: string[]) => ({ status: 0, stdout: args[0] === "rev-parse" ? (args.includes("--abbrev-ref") ? "v4-production" : SHA) : "" })) as unknown as typeof spawnSync;
    const seal = validateNativeNeonBuild(admin, values, git); assert.ok(seal);
    assert.equal(seal.publicValues.NEXT_PUBLIC_CCPUN_DEPLOYMENT_PROVIDER, "hostinger");
    assert.equal(seal.publicValues.NEXT_PUBLIC_CCPUN_DEPLOYMENT_ROLE, "admin");
    for (const change of [{ NEXT_PUBLIC_CCPUN_DEPLOYMENT_PROVIDER: "vercel" }, { NEXT_PUBLIC_CCPUN_DEPLOYMENT_ROLE: "web" }]) {
      assert.throws(() => validateNativeNeonBuild(admin, { ...values, ...change }, git), /PRODUCTION_BUILD_DENIED/);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});
