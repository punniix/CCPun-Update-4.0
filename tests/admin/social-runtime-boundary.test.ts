import assert from "node:assert/strict";
import test from "node:test";
import { CCPUN_VERCEL_PROJECT_IDS } from "../../lib/admin/environment";
import { isSocialFoundationEnabled, WEBSITE_42_SOCIAL_BRANCH } from "../../lib/admin/social/foundation";
import { isSocialOperationsEnabled } from "../../lib/admin/social/operations";
import {
  isSocialProviderExecutionGateEnabled,
  isSocialPublicationApprovalEnabled,
} from "../../lib/admin/social/publishing";
import {
  resolveSocialRuntime,
  SOCIAL_PRODUCTION_BRANCH,
  SOCIAL_UAT_ANALYTICS_BRANCH,
  SOCIAL_UAT_NEON_IDENTITY,
  SOCIAL_UAT_SANITY_DATASET,
  SOCIAL_UAT_SANITY_PROJECT_ID,
} from "../../lib/admin/social/runtime";

const uatEnv = {
  CCPUN_APP_ENV: "admin-uat",
  VERCEL_ENV: "preview",
  VERCEL_PROJECT_ID: CCPUN_VERCEL_PROJECT_IDS.adminProduction,
  CCPUN_PRODUCTION_ADMIN_VERCEL_PROJECT_ID: CCPUN_VERCEL_PROJECT_IDS.adminProduction,
  VERCEL_GIT_COMMIT_REF: SOCIAL_UAT_ANALYTICS_BRANCH,
  NEXT_PUBLIC_SANITY_PROJECT_ID: SOCIAL_UAT_SANITY_PROJECT_ID,
  NEXT_PUBLIC_SANITY_DATASET: SOCIAL_UAT_SANITY_DATASET,
  CCPUN_SOCIAL_DATABASE_URL: `postgresql://${SOCIAL_UAT_NEON_IDENTITY.role}:secret@${SOCIAL_UAT_NEON_IDENTITY.endpointId}-pooler.c-3.ap-southeast-1.aws.neon.tech/${SOCIAL_UAT_NEON_IDENTITY.database}`,
};

const productionEnv = {
  CCPUN_APP_ENV: "production-admin",
  VERCEL_ENV: "production",
  VERCEL_PROJECT_ID: CCPUN_VERCEL_PROJECT_IDS.adminProduction,
  CCPUN_PRODUCTION_ADMIN_VERCEL_PROJECT_ID: CCPUN_VERCEL_PROJECT_IDS.adminProduction,
  VERCEL_GIT_COMMIT_REF: SOCIAL_PRODUCTION_BRANCH,
  NEXT_PUBLIC_SANITY_PROJECT_ID: "kyfxgjnq",
  NEXT_PUBLIC_SANITY_DATASET: "production",
  CCPUN_NEON_PROJECT_ID: "production-project-id",
  CCPUN_NEON_BRANCH_ID: "br-production-id",
  CCPUN_NEON_ENDPOINT_ID: "ep-production-id",
  CCPUN_NEON_DATABASE: "production_social",
  CCPUN_SOCIAL_DATABASE_URL: "postgresql://ccpun_social_runtime:production-secret@ep-production-id-pooler.ap-southeast-1.aws.neon.tech/production_social",
};

test("central social runtime authorizes UAT by immutable data plane rather than feature branch name", () => {
  const runtime = resolveSocialRuntime(uatEnv, {
    uatBranches: [SOCIAL_UAT_ANALYTICS_BRANCH],
    requireUatNeon: true,
  });
  assert.equal(runtime?.lane, "uat");
  assert.deepEqual(runtime?.neonIdentity, SOCIAL_UAT_NEON_IDENTITY);

  const futureFeature = resolveSocialRuntime({
    ...uatEnv,
    VERCEL_GIT_COMMIT_REF: "admin/openquok-sdk-v0-0-13",
  }, {
    uatBranches: ["some-old-branch-that-must-not-be-an-auth-boundary"],
    requireUatNeon: true,
  });
  assert.equal(futureFeature?.lane, "uat");
  assert.equal(futureFeature?.gitBranch, "admin/openquok-sdk-v0-0-13");

  for (const change of [
    { VERCEL_GIT_COMMIT_REF: "v4-production" },
    { VERCEL_ENV: "production" },
    { VERCEL_PROJECT_ID: CCPUN_VERCEL_PROJECT_IDS.web },
    { CCPUN_PRODUCTION_ADMIN_VERCEL_PROJECT_ID: CCPUN_VERCEL_PROJECT_IDS.web },
    { NEXT_PUBLIC_SANITY_PROJECT_ID: "kyfxgjnq" },
    { NEXT_PUBLIC_SANITY_DATASET: "production" },
    { CCPUN_SOCIAL_DATABASE_URL: "postgresql://ccpun_social_runtime:secret@ep-other-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb" },
  ]) {
    assert.equal(resolveSocialRuntime({ ...uatEnv, ...change }, {
      requireUatNeon: true,
    }), null, JSON.stringify(change));
  }
});

test("Production social runtime requires every immutable deployment and data identity", () => {
  const runtime = resolveSocialRuntime(productionEnv, { uatBranches: [] });
  assert.equal(runtime?.lane, "production");
  assert.equal(runtime?.environment, "production-admin");
  assert.deepEqual(runtime?.neonIdentity, {
    projectId: "production-project-id",
    branchId: "br-production-id",
    endpointId: "ep-production-id",
    database: "production_social",
    role: "ccpun_social_runtime",
  });
  assert.equal(JSON.stringify(runtime).includes("production-secret"), false);
  assert.equal(JSON.stringify(runtime).includes("postgresql://"), false);

  for (const change of [
    { CCPUN_APP_ENV: "admin-uat" },
    { VERCEL_ENV: "preview" },
    { VERCEL_PROJECT_ID: CCPUN_VERCEL_PROJECT_IDS.web },
    { CCPUN_PRODUCTION_ADMIN_VERCEL_PROJECT_ID: CCPUN_VERCEL_PROJECT_IDS.web },
    { VERCEL_GIT_COMMIT_REF: SOCIAL_UAT_ANALYTICS_BRANCH },
    { NEXT_PUBLIC_SANITY_PROJECT_ID: "ccb9lnw5" },
    { NEXT_PUBLIC_SANITY_DATASET: "uat" },
    { CCPUN_NEON_PROJECT_ID: "" },
    { CCPUN_NEON_BRANCH_ID: "" },
    { CCPUN_NEON_ENDPOINT_ID: "ep-other" },
    { CCPUN_NEON_DATABASE: "other" },
    { CCPUN_SOCIAL_DATABASE_URL: "postgresql://ccpun_social_runtime:secret@ep-other.ap-southeast-1.aws.neon.tech/production_social" },
    { CCPUN_SOCIAL_DATABASE_URL: "postgresql://neondb_owner:secret@ep-production-id.ap-southeast-1.aws.neon.tech/production_social" },
  ]) {
    assert.equal(resolveSocialRuntime({ ...productionEnv, ...change }, { uatBranches: [] }), null, JSON.stringify(change));
  }
});

test("Social runtime accepts explicit Hostinger Admin identity without Vercel project variables", () => {
  const hostingerUat = resolveSocialRuntime({
    ...uatEnv,
    CCPUN_DEPLOYMENT_PROVIDER: "hostinger",
    CCPUN_DEPLOYMENT_ROLE: "admin",
    CCPUN_GIT_REF: "admin/hostinger-uat",
    VERCEL_ENV: undefined,
    VERCEL_PROJECT_ID: undefined,
    CCPUN_PRODUCTION_ADMIN_VERCEL_PROJECT_ID: undefined,
    VERCEL_GIT_COMMIT_REF: undefined,
  }, { requireUatNeon: true });
  assert.equal(hostingerUat?.lane, "uat");
  assert.equal(hostingerUat?.provider, "hostinger");
  assert.equal(hostingerUat?.projectId, null);

  const hostingerProduction = resolveSocialRuntime({
    ...productionEnv,
    CCPUN_DEPLOYMENT_PROVIDER: "hostinger",
    CCPUN_DEPLOYMENT_ROLE: "admin",
    CCPUN_GIT_REF: SOCIAL_PRODUCTION_BRANCH,
    VERCEL_ENV: undefined,
    VERCEL_PROJECT_ID: undefined,
    CCPUN_PRODUCTION_ADMIN_VERCEL_PROJECT_ID: undefined,
    VERCEL_GIT_COMMIT_REF: undefined,
  }, { uatBranches: [] });
  assert.equal(hostingerProduction?.lane, "production");
  assert.equal(hostingerProduction?.provider, "hostinger");
  assert.equal(hostingerProduction?.projectId, null);

  assert.equal(resolveSocialRuntime({
    ...productionEnv,
    CCPUN_DEPLOYMENT_PROVIDER: "hostinger",
    CCPUN_DEPLOYMENT_ROLE: "web",
    CCPUN_GIT_REF: SOCIAL_PRODUCTION_BRANCH,
    VERCEL_ENV: undefined,
    VERCEL_PROJECT_ID: undefined,
    CCPUN_PRODUCTION_ADMIN_VERCEL_PROJECT_ID: undefined,
    VERCEL_GIT_COMMIT_REF: undefined,
  }, { uatBranches: [] }), null);
});

test("Production feature gates share the boundary and provider writes remain explicit", () => {
  const enabled = {
    ...productionEnv,
    CCPUN_SOCIAL_ENABLED: "1",
    CCPUN_SOCIAL_DATA_MODE: "live",
    CCPUN_SOCIAL_OPERATIONS_ENABLED: "1",
    CCPUN_SOCIAL_ANALYTICS_INGESTION_ENABLED: "1",
  };
  assert.equal(isSocialPublicationApprovalEnabled(enabled), true);
  assert.equal(isSocialProviderExecutionGateEnabled(enabled), false);
  assert.equal(isSocialProviderExecutionGateEnabled({ ...enabled, CCPUN_SOCIAL_PROVIDER_WRITES_ENABLED: "1" }), true);

  assert.equal(isSocialFoundationEnabled({
    flag: enabled.CCPUN_SOCIAL_ENABLED,
    dataMode: enabled.CCPUN_SOCIAL_DATA_MODE,
    environment: "production-admin",
    vercelEnvironment: enabled.VERCEL_ENV,
    projectId: enabled.VERCEL_PROJECT_ID,
    productionAdminProjectId: enabled.CCPUN_PRODUCTION_ADMIN_VERCEL_PROJECT_ID,
    gitBranch: enabled.VERCEL_GIT_COMMIT_REF,
    sanityProjectId: enabled.NEXT_PUBLIC_SANITY_PROJECT_ID,
    sanityDataset: enabled.NEXT_PUBLIC_SANITY_DATASET,
    connectionString: enabled.CCPUN_SOCIAL_DATABASE_URL,
    neonProjectId: enabled.CCPUN_NEON_PROJECT_ID,
    neonBranchId: enabled.CCPUN_NEON_BRANCH_ID,
    neonEndpointId: enabled.CCPUN_NEON_ENDPOINT_ID,
    neonDatabase: enabled.CCPUN_NEON_DATABASE,
  }), false);
  assert.equal(isSocialOperationsEnabled({
    flag: enabled.CCPUN_SOCIAL_OPERATIONS_ENABLED,
    environment: "production-admin",
    vercelEnvironment: enabled.VERCEL_ENV,
    projectId: enabled.VERCEL_PROJECT_ID,
    productionAdminProjectId: enabled.CCPUN_PRODUCTION_ADMIN_VERCEL_PROJECT_ID,
    gitBranch: enabled.VERCEL_GIT_COMMIT_REF,
    sanityProjectId: enabled.NEXT_PUBLIC_SANITY_PROJECT_ID,
    sanityDataset: enabled.NEXT_PUBLIC_SANITY_DATASET,
    connectionString: enabled.CCPUN_SOCIAL_DATABASE_URL,
    neonProjectId: enabled.CCPUN_NEON_PROJECT_ID,
    neonBranchId: enabled.CCPUN_NEON_BRANCH_ID,
    neonEndpointId: enabled.CCPUN_NEON_ENDPOINT_ID,
    neonDatabase: enabled.CCPUN_NEON_DATABASE,
  }), true);
  assert.equal(isSocialFoundationEnabled({
    flag: "1",
    dataMode: "synthetic",
    environment: "admin-uat",
    vercelEnvironment: "preview",
    projectId: CCPUN_VERCEL_PROJECT_IDS.adminProduction,
    gitBranch: WEBSITE_42_SOCIAL_BRANCH,
    sanityProjectId: SOCIAL_UAT_SANITY_PROJECT_ID,
    sanityDataset: SOCIAL_UAT_SANITY_DATASET,
  }), true);
});
