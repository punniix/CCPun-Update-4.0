import assert from "node:assert/strict";
import test from "node:test";
import {
  CONTENT_VERCEL_PROJECT_IDS,
  isContentDeploymentAllowed,
  isContentSanityLaneAllowed,
  resolveContentEnvironment,
} from "../lib/content/sanity-lane";

const WEB_PROJECT_ID = CONTENT_VERCEL_PROJECT_IDS.web;
const ADMIN_PROJECT_ID = CONTENT_VERCEL_PROJECT_IDS.admin;
const UAT_PROJECT_ID = "ccb9lnw5";
const PRODUCTION_PROJECT_ID = "kyfxgjnq";

test("Vercel Preview resolves to the isolated UAT lane for each application", () => {
  assert.equal(resolveContentEnvironment(undefined, "preview", WEB_PROJECT_ID), "web-uat");
  assert.equal(resolveContentEnvironment(undefined, "preview", ADMIN_PROJECT_ID), "admin-uat");
  assert.equal(resolveContentEnvironment(undefined, "preview", "prj_unknown"), "unknown");
  assert.equal(resolveContentEnvironment(undefined, "preview", undefined), "development");
});

test("Vercel Production resolves only to the matching production application lane", () => {
  assert.equal(resolveContentEnvironment(undefined, "production", WEB_PROJECT_ID), "production");
  assert.equal(resolveContentEnvironment(undefined, "production", ADMIN_PROJECT_ID), "production-admin");
  assert.equal(resolveContentEnvironment(undefined, "production", "prj_unknown"), "unknown");
});

test("an explicit application lane remains authoritative and invalid values fail closed", () => {
  assert.equal(resolveContentEnvironment("web-uat", "production", ADMIN_PROJECT_ID), "web-uat");
  assert.equal(resolveContentEnvironment("admin-uat", "production", WEB_PROJECT_ID), "admin-uat");
  assert.equal(resolveContentEnvironment("not-a-lane", "preview", WEB_PROJECT_ID), "unknown");
});

test("Web Preview accepts only Web project identity plus the exact Sanity UAT lane", () => {
  assert.equal(isContentDeploymentAllowed("web-uat", WEB_PROJECT_ID), true);
  assert.equal(isContentDeploymentAllowed("web-uat", ADMIN_PROJECT_ID), false);
  assert.equal(isContentDeploymentAllowed("web-uat", undefined), false);

  assert.equal(isContentSanityLaneAllowed(UAT_PROJECT_ID, "uat", "web-uat", WEB_PROJECT_ID), true);
  assert.equal(isContentSanityLaneAllowed(PRODUCTION_PROJECT_ID, "production", "web-uat", WEB_PROJECT_ID), false);
  assert.equal(isContentSanityLaneAllowed(UAT_PROJECT_ID, "uat", "web-uat", ADMIN_PROJECT_ID), false);
});

test("Admin Preview accepts only Admin project identity plus the exact Sanity UAT lane", () => {
  assert.equal(isContentDeploymentAllowed("admin-uat", ADMIN_PROJECT_ID), true);
  assert.equal(isContentDeploymentAllowed("admin-uat", WEB_PROJECT_ID), false);
  assert.equal(isContentDeploymentAllowed("admin-uat", undefined), false);

  assert.equal(isContentSanityLaneAllowed(UAT_PROJECT_ID, "uat", "admin-uat", ADMIN_PROJECT_ID), true);
  assert.equal(isContentSanityLaneAllowed(PRODUCTION_PROJECT_ID, "production", "admin-uat", ADMIN_PROJECT_ID), false);
  assert.equal(isContentSanityLaneAllowed(UAT_PROJECT_ID, "uat", "admin-uat", WEB_PROJECT_ID), false);
});

test("Production content lanes cannot cross project or dataset boundaries", () => {
  assert.equal(isContentSanityLaneAllowed(PRODUCTION_PROJECT_ID, "production", "production", WEB_PROJECT_ID), true);
  assert.equal(isContentSanityLaneAllowed(PRODUCTION_PROJECT_ID, "production", "production-admin", ADMIN_PROJECT_ID), true);

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
