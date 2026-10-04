// Pure Cloud release predicate. Actual Git provenance remains the build driver's responsibility.
/** @param {Record<string, string | undefined>} values
 * @param {Record<string, string | undefined>} compiled
 * @param {boolean} requireCompiled */
export function isPinnedCloudProductionRelease(values, compiled = {
  NEXT_PUBLIC_CCPUN_DEPLOYMENT_PROVIDER: process.env.NEXT_PUBLIC_CCPUN_DEPLOYMENT_PROVIDER,
  NEXT_PUBLIC_CCPUN_DEPLOYMENT_ROLE: process.env.NEXT_PUBLIC_CCPUN_DEPLOYMENT_ROLE,
  NEXT_PUBLIC_CCPUN_APP_ENV: process.env.NEXT_PUBLIC_CCPUN_APP_ENV,
  NEXT_PUBLIC_CCPUN_ADMIN_CAPABILITY_PROFILE: process.env.NEXT_PUBLIC_CCPUN_ADMIN_CAPABILITY_PROFILE,
  NEXT_PUBLIC_CCPUN_GIT_SHA: process.env.NEXT_PUBLIC_CCPUN_GIT_SHA,
  NEXT_PUBLIC_CCPUN_GIT_REF: process.env.NEXT_PUBLIC_CCPUN_GIT_REF,
  NEXT_PUBLIC_CCPUN_RELEASE_ID: process.env.NEXT_PUBLIC_CCPUN_RELEASE_ID,
  NEXT_PUBLIC_CCPUN_ARTICLE_SCHEDULER_BACKEND: process.env.NEXT_PUBLIC_CCPUN_ARTICLE_SCHEDULER_BACKEND,
}, requireCompiled = true) {
  const sha = values.CCPUN_GIT_SHA;
  if (!/^[a-f0-9]{40}$/.test(sha ?? "")
    || values.CCPUN_GIT_REF !== `codex/hostinger-release-production-${sha}`
    || values.CCPUN_DEPLOYMENT_PROVIDER !== "hostinger" || values.CCPUN_DEPLOYMENT_ROLE !== "admin"
    || values.CCPUN_APP_ENV !== "production-admin" || values.NEXT_PUBLIC_CCPUN_APP_ENV !== "production-admin"
    || values.CCPUN_ADMIN_CAPABILITY_PROFILE !== "full" || values.AUTH_URL !== "https://admin.ccpun.com"
    || values.NEXT_PUBLIC_SANITY_PROJECT_ID !== "kyfxgjnq" || values.NEXT_PUBLIC_SANITY_DATASET !== "production"
    || values.CCPUN_NEON_PROJECT_ID !== "lively-bar-43618798" || values.CCPUN_NEON_BRANCH_ID !== "br-long-resonance-b3ys5xrv"
    || values.CCPUN_NEON_DATABASE !== "neondb" || !/^[a-zA-Z0-9._-]{1,128}$/.test(values.CCPUN_RELEASE_ID ?? "")
    || !["disabled", "native-neon"].includes(values.CCPUN_ARTICLE_SCHEDULER_BACKEND ?? "")
    || values.NEXT_PUBLIC_CCPUN_ARTICLE_SCHEDULER_BACKEND !== values.CCPUN_ARTICLE_SCHEDULER_BACKEND
    || !["0", "1"].includes(values.CCPUN_ARTICLE_SCHEDULING_ENABLED ?? "")
    || (values.CCPUN_ARTICLE_SCHEDULER_BACKEND === "disabled" && values.CCPUN_ARTICLE_SCHEDULING_ENABLED !== "0")
    || values.CCPUN_ARTICLE_SCHEDULE_EXECUTOR_ENABLED !== "0" || values.CCPUN_NATIVE_WORKFLOW_ENABLED !== "0"
    || ![undefined, "cloud"].includes(values.CCPUN_ARTICLE_SCHEDULE_EXECUTION_PLANE)
    || ![undefined, "cloud"].includes(values.CCPUN_BACKGROUND_EXECUTION_PLANE)
    || ![undefined, "0"].includes(values.CCPUN_BACKGROUND_WORKER_ENABLED)
    || Object.entries(values).some(([key, value]) => key.startsWith("VERCEL_") && value)) return false;
  const expected = {
    NEXT_PUBLIC_CCPUN_DEPLOYMENT_PROVIDER: "hostinger", NEXT_PUBLIC_CCPUN_DEPLOYMENT_ROLE: "admin",
    NEXT_PUBLIC_CCPUN_APP_ENV: "production-admin", NEXT_PUBLIC_CCPUN_ADMIN_CAPABILITY_PROFILE: "full",
    NEXT_PUBLIC_CCPUN_GIT_SHA: sha, NEXT_PUBLIC_CCPUN_GIT_REF: values.CCPUN_GIT_REF,
    NEXT_PUBLIC_CCPUN_RELEASE_ID: values.CCPUN_RELEASE_ID,
    NEXT_PUBLIC_CCPUN_ARTICLE_SCHEDULER_BACKEND: values.CCPUN_ARTICLE_SCHEDULER_BACKEND,
  };
  return Object.entries(expected).every(([key, value]) =>
    (values[key] === undefined || values[key] === value)
    && (requireCompiled ? compiled[key] === value : compiled[key] === undefined || compiled[key] === value));
}
