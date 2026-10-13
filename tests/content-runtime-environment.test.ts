import assert from "node:assert/strict";
import test from "node:test";
import {
  isContentDeploymentAllowed,
  isContentSanityLaneAllowed,
  resolveContentEnvironment,
} from "../lib/content/sanity-lane";

// Historical identities are rejection fixtures only.
const WEB_PROJECT_ID = "prj_dxwjITkd0av5QiJQv2snUlIASUWu";
const ADMIN_PROJECT_ID = "prj_6tuUxJxYbQ4mpF7sMgNWx2p2jowN";
const UAT_PROJECT_ID = "ccb9lnw5";
const PRODUCTION_PROJECT_ID = "kyfxgjnq";

test("retired Preview metadata cannot infer either UAT lane", () => {
  assert.equal(resolveContentEnvironment(undefined, "preview", WEB_PROJECT_ID), "unknown");
  assert.equal(resolveContentEnvironment(undefined, "preview", ADMIN_PROJECT_ID), "unknown");
  assert.equal(resolveContentEnvironment(undefined, "preview", "prj_unknown"), "unknown");
  assert.equal(resolveContentEnvironment(undefined, "preview", undefined), "unknown");
});

test("retired Production metadata cannot infer either production lane", () => {
  assert.equal(resolveContentEnvironment(undefined, "production", WEB_PROJECT_ID), "unknown");
  assert.equal(resolveContentEnvironment(undefined, "production", ADMIN_PROJECT_ID), "unknown");
  assert.equal(resolveContentEnvironment(undefined, "production", "prj_unknown"), "unknown");
});

test("an explicit application lane remains authoritative and invalid values fail closed", () => {
  assert.equal(resolveContentEnvironment("web-uat", "production", ADMIN_PROJECT_ID), "web-uat");
  assert.equal(resolveContentEnvironment("admin-uat", "production", WEB_PROJECT_ID), "admin-uat");
  assert.equal(resolveContentEnvironment("not-a-lane", "preview", WEB_PROJECT_ID), "unknown");
});

test("retired Web project identity cannot grant a UAT content lane", () => {
  assert.equal(isContentDeploymentAllowed("web-uat", WEB_PROJECT_ID), false);
  assert.equal(isContentDeploymentAllowed("web-uat", ADMIN_PROJECT_ID), false);
  assert.equal(isContentDeploymentAllowed("web-uat", undefined), false);

  assert.equal(isContentSanityLaneAllowed(UAT_PROJECT_ID, "uat", "web-uat", WEB_PROJECT_ID), false);
  assert.equal(isContentSanityLaneAllowed(PRODUCTION_PROJECT_ID, "production", "web-uat", WEB_PROJECT_ID), false);
  assert.equal(isContentSanityLaneAllowed(UAT_PROJECT_ID, "uat", "web-uat", ADMIN_PROJECT_ID), false);
});

test("retired Admin project identity cannot grant a UAT content lane", () => {
  assert.equal(isContentDeploymentAllowed("admin-uat", ADMIN_PROJECT_ID), false);
  assert.equal(isContentDeploymentAllowed("admin-uat", WEB_PROJECT_ID), false);
  assert.equal(isContentDeploymentAllowed("admin-uat", undefined), false);

  assert.equal(isContentSanityLaneAllowed(UAT_PROJECT_ID, "uat", "admin-uat", ADMIN_PROJECT_ID), false);
  assert.equal(isContentSanityLaneAllowed(PRODUCTION_PROJECT_ID, "production", "admin-uat", ADMIN_PROJECT_ID), false);
  assert.equal(isContentSanityLaneAllowed(UAT_PROJECT_ID, "uat", "admin-uat", WEB_PROJECT_ID), false);
});

test("Production content lanes cannot cross project or dataset boundaries", () => {
  assert.equal(isContentSanityLaneAllowed(PRODUCTION_PROJECT_ID, "production", "production", WEB_PROJECT_ID), false);
  assert.equal(isContentSanityLaneAllowed(PRODUCTION_PROJECT_ID, "production", "production-admin", ADMIN_PROJECT_ID), false);

  assert.equal(isContentSanityLaneAllowed(UAT_PROJECT_ID, "uat", "production", WEB_PROJECT_ID), false);
  assert.equal(isContentSanityLaneAllowed(UAT_PROJECT_ID, "uat", "production-admin", ADMIN_PROJECT_ID), false);
  assert.equal(isContentSanityLaneAllowed(PRODUCTION_PROJECT_ID, "production", "production", ADMIN_PROJECT_ID), false);
  assert.equal(isContentSanityLaneAllowed(PRODUCTION_PROJECT_ID, "production", "production-admin", WEB_PROJECT_ID), false);
});


test("legacy Sanity UAT project is rejected for all active UAT lanes", () => {
  for (const [environment, projectId] of [
    ["web-uat", WEB_PROJECT_ID],
    ["admin-uat", ADMIN_PROJECT_ID],
  ] as const) {
    assert.equal(
      isContentSanityLaneAllowed(PRODUCTION_PROJECT_ID, "uat", environment, projectId),
      false,
      environment,
    );
  }
});

test("Hostinger Web and Admin can use the same Sanity lanes without a fake Vercel project ID", () => {
  const web = {
    CCPUN_DEPLOYMENT_PROVIDER: "hostinger",
    CCPUN_DEPLOYMENT_ROLE: "web",
    CCPUN_APP_ENV: "production",
  };
  assert.equal(isContentDeploymentAllowed("production", undefined, web), true);
  assert.equal(
    isContentSanityLaneAllowed(PRODUCTION_PROJECT_ID, "production", "production", undefined, web),
    true,
  );

  const admin = {
    CCPUN_DEPLOYMENT_PROVIDER: "hostinger",
    CCPUN_DEPLOYMENT_ROLE: "admin",
    CCPUN_APP_ENV: "production-admin",
  };
  assert.equal(isContentDeploymentAllowed("production-admin", undefined, admin), true);
  assert.equal(
    isContentSanityLaneAllowed(PRODUCTION_PROJECT_ID, "production", "production-admin", undefined, admin),
    true,
  );
});

test("Hostinger content identity fails closed on role or lane mismatch", () => {
  const web = {
    CCPUN_DEPLOYMENT_PROVIDER: "hostinger",
    CCPUN_DEPLOYMENT_ROLE: "web",
    CCPUN_APP_ENV: "production",
  };
  assert.equal(isContentDeploymentAllowed("production-admin", undefined, web), false);
  assert.equal(
    isContentSanityLaneAllowed(PRODUCTION_PROJECT_ID, "production", "production-admin", undefined, web),
    false,
  );

  const fakeVercel = {
    ...web,
    VERCEL_PROJECT_ID: WEB_PROJECT_ID,
  };
  assert.equal(isContentDeploymentAllowed("production", WEB_PROJECT_ID, fakeVercel), false);
});
