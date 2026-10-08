import { isAdminOperationsRuntimeIdentityValid, adminOperationsRuntimeInputFromEnvironment } from "../operations/foundation";

export const UAT_POST_PUBLISH_MOCK_ID = "uat-seo-postpublish-acceptance-20261008";
export const UAT_POST_PUBLISH_MOCK_VERSION = "2026-10-08T13:30:00.000Z";

/** Fail closed: only Admin UAT Cloud's existing least-privilege Admin database role. */
export function isUatPostPublishMockAllowed(env: Record<string, string | undefined>): boolean {
  const sha = env.CCPUN_GIT_SHA;
  return Boolean(sha && /^[a-f0-9]{40}$/.test(sha)
    && env.CCPUN_GIT_REF === `admin/hostinger-release-uat-${sha}`
    && env.CCPUN_RELEASE_ID === `hostinger-admin-uat-${sha.slice(0, 12)}`)
    && env.CCPUN_SEO_POST_PUBLISH_UAT_MOCK_ENABLED === "1"
    && env.CCPUN_APP_ENV === "admin-uat"
    && env.NEXT_PUBLIC_CCPUN_APP_ENV === "admin-uat"
    && env.CCPUN_DEPLOYMENT_PROVIDER === "hostinger"
    && env.CCPUN_DEPLOYMENT_ROLE === "admin"
    && env.AUTH_URL === "https://admin-test.ccpun.com"
    && env.CCPUN_NEON_PROJECT_ID === "young-term-47483330"
    && env.CCPUN_NEON_BRANCH_ID === "br-crimson-mouse-az7ajkv8"
    && env.CCPUN_NEON_DATABASE === "neondb"
    && env.NEXT_PUBLIC_SANITY_PROJECT_ID === "ccb9lnw5"
    && env.NEXT_PUBLIC_SANITY_DATASET === "uat"
    && isAdminOperationsRuntimeIdentityValid(adminOperationsRuntimeInputFromEnvironment(env));
}
