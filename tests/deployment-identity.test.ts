import assert from "node:assert/strict";
import test from "node:test";
import {
  CCPUN_VERCEL_PROJECT_IDS,
  isDeploymentIdentityAllowed,
  resolveDeploymentIdentity,
} from "../lib/runtime/deployment-identity";
import { shouldBlockWebIndexing } from "../apps/web/runtime-environment";

test("adapts Vercel Web production and preview identity", () => {
  const production = resolveDeploymentIdentity({
    VERCEL_PROJECT_ID: CCPUN_VERCEL_PROJECT_IDS.web,
    VERCEL_ENV: "production",
    VERCEL_GIT_COMMIT_REF: "v4-production",
    VERCEL_GIT_COMMIT_SHA: "a".repeat(40),
  }, "web");
  assert.deepEqual(
    {
      provider: production.provider,
      role: production.role,
      environment: production.environment,
      valid: production.valid,
      gitRef: production.gitRef,
    },
    {
      provider: "vercel",
      role: "web",
      environment: "production",
      valid: true,
      gitRef: "v4-production",
    },
  );

  const preview = resolveDeploymentIdentity({
    VERCEL_PROJECT_ID: CCPUN_VERCEL_PROJECT_IDS.web,
    VERCEL_ENV: "preview",
  }, "web");
  assert.equal(preview.environment, "web-uat");
  assert.equal(preview.valid, true);
});

test("adapts Vercel Admin production and preview identity", () => {
  const production = resolveDeploymentIdentity({
    CCPUN_APP_ENV: "production-admin",
    VERCEL_PROJECT_ID: CCPUN_VERCEL_PROJECT_IDS.admin,
    VERCEL_ENV: "production",
    VERCEL_GIT_COMMIT_REF: "v4-production",
  }, "admin");
  assert.equal(production.provider, "vercel");
  assert.equal(production.role, "admin");
  assert.equal(production.environment, "production-admin");
  assert.equal(production.valid, true);

  const preview = resolveDeploymentIdentity({
    CCPUN_APP_ENV: "admin-uat",
    VERCEL_PROJECT_ID: CCPUN_VERCEL_PROJECT_IDS.admin,
    VERCEL_ENV: "preview",
  }, "admin");
  assert.equal(preview.environment, "admin-uat");
  assert.equal(preview.valid, true);
});

test("supports explicit Hostinger identity without any Vercel project ID", () => {
  const web = resolveDeploymentIdentity({
    CCPUN_DEPLOYMENT_PROVIDER: "hostinger",
    CCPUN_DEPLOYMENT_ROLE: "web",
    CCPUN_APP_ENV: "production",
    CCPUN_GIT_REF: "v4-production",
    CCPUN_GIT_SHA: "b".repeat(40),
    CCPUN_RELEASE_ID: "release-123",
  }, "web");
  assert.equal(web.valid, true);
  assert.equal(web.provider, "hostinger");
  assert.equal(web.role, "web");
  assert.equal(web.environment, "production");
  assert.equal(web.gitRef, "v4-production");
  assert.equal(web.releaseId, "release-123");
  assert.equal(isDeploymentIdentityAllowed(web, "web", "production"), true);

  const admin = resolveDeploymentIdentity({
    CCPUN_DEPLOYMENT_PROVIDER: "hostinger",
    CCPUN_DEPLOYMENT_ROLE: "admin",
    CCPUN_APP_ENV: "production-admin",
    CCPUN_GIT_REF: "v4-production",
  }, "admin");
  assert.equal(admin.valid, true);
  assert.equal(admin.role, "admin");
  assert.equal(admin.environment, "production-admin");
});

test("contradictory provider role and environment identities fail closed", () => {
  const fakeHostinger = resolveDeploymentIdentity({
    CCPUN_DEPLOYMENT_PROVIDER: "hostinger",
    CCPUN_DEPLOYMENT_ROLE: "web",
    CCPUN_APP_ENV: "production",
    VERCEL_PROJECT_ID: CCPUN_VERCEL_PROJECT_IDS.web,
    VERCEL_ENV: "production",
  }, "web");
  assert.equal(fakeHostinger.valid, false);
  assert.equal(fakeHostinger.provider, "unknown");

  const wrongRole = resolveDeploymentIdentity({
    CCPUN_DEPLOYMENT_PROVIDER: "hostinger",
    CCPUN_DEPLOYMENT_ROLE: "admin",
    CCPUN_APP_ENV: "production",
  }, "web");
  assert.equal(wrongRole.valid, false);

  const wrongVercelLane = resolveDeploymentIdentity({
    CCPUN_APP_ENV: "production-admin",
    VERCEL_PROJECT_ID: CCPUN_VERCEL_PROJECT_IDS.web,
    VERCEL_ENV: "production",
  }, "web");
  assert.equal(wrongVercelLane.valid, false);
});

test("robots indexing gate preserves production SEO parity for Vercel and Hostinger", () => {
  const vercel = resolveDeploymentIdentity({
    VERCEL_PROJECT_ID: CCPUN_VERCEL_PROJECT_IDS.web,
    VERCEL_ENV: "production",
  }, "web");
  assert.equal(shouldBlockWebIndexing({
    environment: "production",
    deployment: vercel,
    uatMode: "0",
  }), false);

  const hostinger = resolveDeploymentIdentity({
    CCPUN_DEPLOYMENT_PROVIDER: "hostinger",
    CCPUN_DEPLOYMENT_ROLE: "web",
    CCPUN_APP_ENV: "production",
  }, "web");
  assert.equal(shouldBlockWebIndexing({
    environment: "production",
    deployment: hostinger,
    uatMode: "0",
  }), false);

  assert.equal(shouldBlockWebIndexing({
    environment: "web-uat",
    deployment: resolveDeploymentIdentity({
      CCPUN_DEPLOYMENT_PROVIDER: "hostinger",
      CCPUN_DEPLOYMENT_ROLE: "web",
      CCPUN_APP_ENV: "web-uat",
    }, "web"),
    uatMode: "0",
  }), true);
  assert.equal(shouldBlockWebIndexing({
    environment: "production",
    deployment: hostinger,
    uatMode: "1",
  }), true);
});

test("plain local development remains valid when the app supplies its role", () => {
  const local = resolveDeploymentIdentity({}, "web");
  assert.equal(local.provider, "local");
  assert.equal(local.role, "web");
  assert.equal(local.environment, "development");
  assert.equal(local.valid, true);
});
