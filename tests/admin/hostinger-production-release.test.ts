import assert from "node:assert/strict";
import test from "node:test";
import { isPinnedCloudProductionRelease } from "../../lib/runtime/hostinger-production-release.mjs";
import { resolveSocialRuntime } from "../../lib/admin/social/runtime";
import { validateBackgroundWorker } from "../../scripts/admin-background-worker";
import { resolveArticleSchedulerLane } from "../../lib/admin/operations/article-schedule-contract";
import { getArticleScheduleBackend, isArticleScheduleExecutionEnabled } from "../../lib/admin/article-schedule-clock";
import { adminOperationsRuntimeInputFromEnvironment, resolveAdminOperationsRuntimeIdentity } from "../../lib/admin/operations/foundation";

function values(): Record<string, string | undefined> {
  const sha = "a".repeat(40), ref = `codex/hostinger-release-production-${sha}`;
  return {
    CCPUN_DEPLOYMENT_PROVIDER: "hostinger", CCPUN_DEPLOYMENT_ROLE: "admin", CCPUN_APP_ENV: "production-admin",
    NEXT_PUBLIC_CCPUN_APP_ENV: "production-admin", CCPUN_ADMIN_CAPABILITY_PROFILE: "full",
    CCPUN_GIT_SHA: sha, CCPUN_GIT_REF: ref, CCPUN_RELEASE_ID: "reviewed-cloud-release",
    AUTH_URL: "https://admin.ccpun.com", NEXT_PUBLIC_SANITY_PROJECT_ID: "kyfxgjnq", NEXT_PUBLIC_SANITY_DATASET: "production",
    CCPUN_NEON_PROJECT_ID: "lively-bar-43618798", CCPUN_NEON_BRANCH_ID: "br-long-resonance-b3ys5xrv", CCPUN_NEON_DATABASE: "neondb",
    CCPUN_ADMIN_DATABASE_URL: "postgresql://ccpun_admin_runtime:fake@ep-broad-butterfly-b3ro7u8w-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
    CCPUN_ARTICLE_SCHEDULER_BACKEND: "native-neon", NEXT_PUBLIC_CCPUN_ARTICLE_SCHEDULER_BACKEND: "native-neon",
    CCPUN_ARTICLE_SCHEDULING_ENABLED: "1", CCPUN_ARTICLE_SCHEDULE_EXECUTOR_ENABLED: "0", CCPUN_NATIVE_WORKFLOW_ENABLED: "0",
    NEXT_PUBLIC_CCPUN_DEPLOYMENT_PROVIDER: "hostinger", NEXT_PUBLIC_CCPUN_DEPLOYMENT_ROLE: "admin",
    NEXT_PUBLIC_CCPUN_ADMIN_CAPABILITY_PROFILE: "full", NEXT_PUBLIC_CCPUN_GIT_SHA: sha,
    NEXT_PUBLIC_CCPUN_GIT_REF: ref, NEXT_PUBLIC_CCPUN_RELEASE_ID: "reviewed-cloud-release",
  };
}
test("pinned Cloud predicate binds exact lowercase SHA/ref, lane, compile mirrors and executors off", () => {
  const v = values(); assert.equal(isPinnedCloudProductionRelease(v, v), true);
  for (const change of [
    { CCPUN_GIT_REF: "v4-production" }, { CCPUN_GIT_REF: `codex/hostinger-release-production-${"b".repeat(40)}` },
    { CCPUN_GIT_SHA: "A".repeat(40) }, { CCPUN_DEPLOYMENT_PROVIDER: "vercel" }, { CCPUN_DEPLOYMENT_ROLE: "web" },
    { CCPUN_APP_ENV: "admin-uat" }, { CCPUN_ADMIN_CAPABILITY_PROFILE: "editorial" },
    { CCPUN_NEON_PROJECT_ID: "young-term-47483330" }, { NEXT_PUBLIC_SANITY_DATASET: "uat" },
    { AUTH_URL: "https://admin-test.ccpun.com" }, { CCPUN_NATIVE_WORKFLOW_ENABLED: "1" },
    { CCPUN_ARTICLE_SCHEDULE_EXECUTOR_ENABLED: "1" }, { CCPUN_ARTICLE_SCHEDULE_EXECUTION_PLANE: "vps" },
    { CCPUN_BACKGROUND_WORKER_ENABLED: "1" }, { CCPUN_BACKGROUND_EXECUTION_PLANE: "vps" },
    { CCPUN_RELEASE_ID: "wrong-release" }, { VERCEL_URL: "legacy.vercel.app" },
  ]) assert.equal(isPinnedCloudProductionRelease({ ...v, ...change }, v), false);
  for (const key of ["NEXT_PUBLIC_CCPUN_GIT_SHA", "NEXT_PUBLIC_CCPUN_GIT_REF", "NEXT_PUBLIC_CCPUN_RELEASE_ID", "NEXT_PUBLIC_CCPUN_ADMIN_CAPABILITY_PROFILE"]) {
    assert.equal(isPinnedCloudProductionRelease(v, { ...v, [key]: undefined }), false);
    assert.equal(isPinnedCloudProductionRelease(v, { ...v, [key]: "different" }), false);
  }
});
test("actual runtime producer/read lane accepts compiled pinned Cloud identity without executing or changing least privilege", () => {
  const saved = { ...process.env }, v = values();
  try {
    Object.assign(process.env, v);
    assert.equal(resolveArticleSchedulerLane(v), "production");
    assert.equal(getArticleScheduleBackend(v), "native-neon");
    assert.equal(isArticleScheduleExecutionEnabled(v), false);
    assert.equal(resolveAdminOperationsRuntimeIdentity(adminOperationsRuntimeInputFromEnvironment(v))?.lane, "production");
    const social = { ...v, CCPUN_NEON_ENDPOINT_ID: "ep-broad-butterfly-b3ro7u8w", CCPUN_SOCIAL_DATABASE_URL: v.CCPUN_ADMIN_DATABASE_URL!.replace("ccpun_admin_runtime", "ccpun_social_runtime") };
    assert.equal(resolveSocialRuntime(social)?.lane, "production");
    assert.equal(resolveSocialRuntime({ ...social, CCPUN_BACKGROUND_WORKER_ENABLED: "1" }), null);
    assert.equal(resolveAdminOperationsRuntimeIdentity(adminOperationsRuntimeInputFromEnvironment({ ...v, CCPUN_BACKGROUND_WORKER_ENABLED: "1" })), null);
    assert.equal(resolveArticleSchedulerLane({ ...v, CCPUN_ADMIN_DATABASE_URL: v.CCPUN_ADMIN_DATABASE_URL!.replace("ccpun_admin_runtime", "neondb_owner") }), null);
    for (const change of [{ CCPUN_ARTICLE_SCHEDULE_EXECUTOR_ENABLED: "1" }, { CCPUN_BACKGROUND_EXECUTION_PLANE: "vps" }, { NEXT_PUBLIC_CCPUN_GIT_REF: "v4-production" }]) {
      assert.equal(resolveArticleSchedulerLane({ ...v, ...change }), null);
      assert.equal(getArticleScheduleBackend({ ...v, ...change }), "disabled");
    }
    assert.throws(() => validateBackgroundWorker("social", { ...v, CCPUN_BACKGROUND_EXECUTION_PLANE: "vps", CCPUN_BACKGROUND_WORKER_ENABLED: "1" }), /NATIVE_ADMIN_PRODUCTION_BUILD_DENIED/);
  } finally { for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key]; Object.assign(process.env, saved); }
});
