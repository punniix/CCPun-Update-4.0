import assert from "node:assert/strict";
import test from "node:test";
import {
  DEPLOYMENT_LANES,
  deploymentContractFailures,
  getDeploymentLaneByDomain,
  getDeploymentLaneByEnvironment,
} from "../lib/runtime/deployment-contract";

test("locks the four canonical CCPun deployment lanes", () => {
  assert.deepEqual(Object.keys(DEPLOYMENT_LANES).sort(), [
    "admin-production",
    "admin-uat",
    "web-production",
    "web-uat",
  ]);
  assert.equal(getDeploymentLaneByDomain("ccpun.com")?.environment, "production");
  assert.equal(getDeploymentLaneByDomain("test.ccpun.com")?.environment, "web-uat");
  assert.equal(getDeploymentLaneByDomain("admin.ccpun.com")?.environment, "production-admin");
  assert.equal(getDeploymentLaneByDomain("admin-test.ccpun.com")?.environment, "admin-uat");
});

test("Web Production rejects UAT, local, Vercel and wrong Sanity identity", () => {
  const lane = getDeploymentLaneByEnvironment("production")!;
  const base = {
    CCPUN_DEPLOYMENT_PROVIDER: "hostinger",
    CCPUN_DEPLOYMENT_ROLE: "web",
    CCPUN_APP_ENV: "production",
    NEXT_PUBLIC_CCPUN_APP_ENV: "production",
    NEXT_PUBLIC_SANITY_PROJECT_ID: "kyfxgjnq",
    NEXT_PUBLIC_SANITY_DATASET: "production",
    CCPUN_UAT_MODE: "0",
    CCPUN_ENABLE_PRODUCTION_ANALYTICS: "1",
  };
  assert.deepEqual(deploymentContractFailures(lane, base), []);
  assert.notDeepEqual(deploymentContractFailures(lane, {...base, CCPUN_APP_ENV:"web-uat"}), []);
  assert.notDeepEqual(deploymentContractFailures(lane, {...base, NEXT_PUBLIC_SANITY_PROJECT_ID:"ccb9lnw5", NEXT_PUBLIC_SANITY_DATASET:"uat"}), []);
  assert.notDeepEqual(deploymentContractFailures(lane, {...base, CCPUN_DEPLOYMENT_PROVIDER:"local"}), []);
  assert.notDeepEqual(deploymentContractFailures(lane, {...base, VERCEL_PROJECT_ID:"prj_fake"}), []);
});

test("Web UAT can never enable Production content or analytics", () => {
  const lane = getDeploymentLaneByEnvironment("web-uat")!;
  assert.equal(lane.indexable, false);
  assert.equal(lane.rootDirectory, "apps/web");
  assert.equal(lane.outputDirectory, ".next/standalone");
  assert.equal(lane.entryFile, ".next/standalone/server.js");
  assert.deepEqual(deploymentContractFailures(lane, {
    CCPUN_DEPLOYMENT_PROVIDER: "hostinger",
    CCPUN_DEPLOYMENT_ROLE: "web",
    CCPUN_APP_ENV: "web-uat",
    NEXT_PUBLIC_CCPUN_APP_ENV: "web-uat",
    NEXT_PUBLIC_SANITY_PROJECT_ID: "ccb9lnw5",
    NEXT_PUBLIC_SANITY_DATASET: "uat",
    CCPUN_UAT_MODE: "1",
    CCPUN_ENABLE_PRODUCTION_ANALYTICS: "0",
  }), []);
});

test("Admin lanes reflect the current Hostinger placement and reject stale Vercel identity", () => {
  const production = getDeploymentLaneByEnvironment("production-admin")!;
  const uat = getDeploymentLaneByEnvironment("admin-uat")!;
  assert.equal(production.provider, "hostinger");
  assert.equal(uat.provider, "hostinger");
  assert.equal(production.indexable, false);
  assert.equal(uat.indexable, false);

  const productionEnv = {
    CCPUN_DEPLOYMENT_PROVIDER: "hostinger",
    CCPUN_DEPLOYMENT_ROLE: "admin",
    CCPUN_APP_ENV: "production-admin",
    NEXT_PUBLIC_CCPUN_APP_ENV: "production-admin",
    NEXT_PUBLIC_SANITY_PROJECT_ID: "kyfxgjnq",
    NEXT_PUBLIC_SANITY_DATASET: "production",
    CCPUN_UAT_MODE: "0",
    CCPUN_ENABLE_PRODUCTION_ANALYTICS: "0",
  };
  assert.deepEqual(deploymentContractFailures(production, productionEnv), []);
  assert.notDeepEqual(deploymentContractFailures(production, {
    ...productionEnv,
    CCPUN_DEPLOYMENT_PROVIDER: "vercel",
    VERCEL_PROJECT_ID: "prj_6tuUxJxYbQ4mpF7sMgNWx2p2jowN",
    VERCEL_ENV: "production",
  }), []);

  const uatEnv = {
    CCPUN_DEPLOYMENT_PROVIDER: "hostinger",
    CCPUN_DEPLOYMENT_ROLE: "admin",
    CCPUN_APP_ENV: "admin-uat",
    NEXT_PUBLIC_CCPUN_APP_ENV: "admin-uat",
    NEXT_PUBLIC_SANITY_PROJECT_ID: "ccb9lnw5",
    NEXT_PUBLIC_SANITY_DATASET: "uat",
    CCPUN_UAT_MODE: "1",
    CCPUN_ENABLE_PRODUCTION_ANALYTICS: "0",
  };
  assert.deepEqual(deploymentContractFailures(uat, uatEnv), []);
  assert.notDeepEqual(deploymentContractFailures(uat, {
    ...uatEnv,
    VERCEL_PROJECT_ID: "prj_6tuUxJxYbQ4mpF7sMgNWx2p2jowN",
  }), []);
});
