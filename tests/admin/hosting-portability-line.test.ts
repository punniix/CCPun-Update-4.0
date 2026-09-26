import assert from "node:assert/strict";
import test from "node:test";
import { resolveLineIngestRuntime } from "../../lib/admin/line/private-ingestion";
import {
  ADMIN_OPERATIONS_LANES,
  resolveAdminOperationsRuntimeIdentity,
} from "../../lib/admin/operations/foundation";

const productionDb = "postgresql://ccpun_admin_runtime:TEST_ONLY@ep-broad-butterfly-b3ro7u8w.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

test("Admin LINE ingestion accepts explicit Hostinger production identity and exact Neon lane", () => {
  const runtime = resolveLineIngestRuntime({
    CCPUN_DEPLOYMENT_PROVIDER: "hostinger",
    CCPUN_DEPLOYMENT_ROLE: "admin",
    CCPUN_APP_ENV: "production-admin",
    CCPUN_GIT_REF: "v4-production",
    CCPUN_NEON_PROJECT_ID: "lively-bar-43618798",
    CCPUN_NEON_BRANCH_ID: "br-long-resonance-b3ys5xrv",
    CCPUN_NEON_DATABASE: "neondb",
    CCPUN_ADMIN_DATABASE_URL: productionDb,
  });
  assert.equal(runtime?.lane, "production");
  assert.equal(runtime?.provider, "hostinger");
});

test("Admin Operations accepts Hostinger production identity while preserving exact Neon identity", () => {
  const identity = ADMIN_OPERATIONS_LANES.production;
  const runtime = resolveAdminOperationsRuntimeIdentity({
    environment: "production-admin",
    projectId: identity.projectId,
    branchId: identity.branchId,
    database: identity.database,
    connectionString: `postgresql://${identity.runtimeRole}:TEST_ONLY@${identity.endpointId}.${identity.hostSuffix}/${identity.database}?sslmode=require`,
    deploymentProvider: "hostinger",
    deploymentRole: "admin",
    gitBranch: "v4-production",
  });
  assert.equal(runtime?.lane, "production");

  assert.equal(resolveAdminOperationsRuntimeIdentity({
    environment: "production-admin",
    projectId: identity.projectId,
    branchId: identity.branchId,
    database: identity.database,
    connectionString: `postgresql://${identity.runtimeRole}:TEST_ONLY@${identity.endpointId}.${identity.hostSuffix}/${identity.database}?sslmode=require`,
    deploymentProvider: "hostinger",
    deploymentRole: "web",
    gitBranch: "v4-production",
  }), null);
});

test("Admin LINE ingestion remains fail closed for wrong role or production ref", () => {
  const base = {
    CCPUN_DEPLOYMENT_PROVIDER: "hostinger",
    CCPUN_DEPLOYMENT_ROLE: "admin",
    CCPUN_APP_ENV: "production-admin",
    CCPUN_GIT_REF: "v4-production",
    CCPUN_NEON_PROJECT_ID: "lively-bar-43618798",
    CCPUN_NEON_BRANCH_ID: "br-long-resonance-b3ys5xrv",
    CCPUN_NEON_DATABASE: "neondb",
    CCPUN_ADMIN_DATABASE_URL: productionDb,
  };
  assert.equal(resolveLineIngestRuntime({ ...base, CCPUN_DEPLOYMENT_ROLE: "web" }), null);
  assert.equal(resolveLineIngestRuntime({ ...base, CCPUN_GIT_REF: "feature/not-production" }), null);
});
