import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CCPUN_VERCEL_PROJECT_IDS,
  isAdminDataPlaneAllowed,
  isAdminReadDataPlaneAllowed,
  isAdminMutationEnvironment,
  isAdminSurfaceAllowed,
  isDeploymentProjectAllowed,
  isSanityProjectAllowed,
  isSanityLaneAllowed,
  isStudioDataPlaneAllowed,
  isLocalProductionDraftWriteEnabled,
  parseAdminEnvironment,
  resolveAdminEnvironment,
  resolveSanityConfigEnvironment,
} from "../../lib/admin/environment";
import { shouldEnforceHttps } from "../../lib/security-policy";

const WEB_PROJECT_ID = CCPUN_VERCEL_PROJECT_IDS.web;
const PRODUCTION_ADMIN_PROJECT_ID = CCPUN_VERCEL_PROJECT_IDS.adminProduction;
const LAB_PROJECT_ID = "prj_retired_lab";
const UAT_PROJECT_ID = "prj_retired_uat";
const UAT_SANITY_PROJECT_ID = "ccb9lnw5";
const PRODUCTION_SANITY_PROJECT_ID = "kyfxgjnq";

const retiredPublisher = readFileSync(new URL("../../scripts/publish-wordpress-migration-to-sanity.mjs", import.meta.url), "utf8");
const publishedDraftImporter = readFileSync(new URL("../../scripts/import-wordpress-published-to-sanity.mjs", import.meta.url), "utf8");
const draftImporter = readFileSync(new URL("../../scripts/import-wordpress-drafts-to-sanity.mjs", import.meta.url), "utf8");
const draftSeeder = readFileSync(new URL("../../scripts/create-sanity-uat-draft.mjs", import.meta.url), "utf8");
const survivorGuard = readFileSync(new URL("../../scripts/guard-survivor-deploy.mjs", import.meta.url), "utf8");
const proxySource = readFileSync(new URL("../../proxy.ts", import.meta.url), "utf8");
const studioConfig = readFileSync(new URL("../../sanity.config.ts", import.meta.url), "utf8");
const studioCli = readFileSync(new URL("../../sanity.cli.ts", import.meta.url), "utf8");
const packageJson = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));

test("legacy Lab and UAT deployments fail closed after Legacy Freeze", () => {
  assert.equal(isAdminDataPlaneAllowed("uat", "development", undefined, undefined, UAT_SANITY_PROJECT_ID), true);
  assert.equal(isAdminDataPlaneAllowed("uat", "lab", LAB_PROJECT_ID, undefined, UAT_SANITY_PROJECT_ID), false);
  assert.equal(isAdminDataPlaneAllowed("uat", "uat", UAT_PROJECT_ID, undefined, UAT_SANITY_PROJECT_ID), false);
  assert.equal(isAdminDataPlaneAllowed("production", "lab", LAB_PROJECT_ID, undefined, UAT_SANITY_PROJECT_ID), false);
  assert.equal(isAdminDataPlaneAllowed("production", "uat", UAT_PROJECT_ID, undefined, UAT_SANITY_PROJECT_ID), false);
  assert.equal(isAdminDataPlaneAllowed(undefined, "lab", LAB_PROJECT_ID, undefined, UAT_SANITY_PROJECT_ID), false);
  assert.equal(isAdminDataPlaneAllowed("UAT", "lab", LAB_PROJECT_ID, undefined, UAT_SANITY_PROJECT_ID), false);
  assert.equal(isAdminDataPlaneAllowed("uat", "lab", UAT_PROJECT_ID, undefined, UAT_SANITY_PROJECT_ID), false);
  assert.equal(isAdminDataPlaneAllowed("uat", "uat", LAB_PROJECT_ID, undefined, UAT_SANITY_PROJECT_ID), false);
});

test("Admin survivor Preview has a dedicated UAT lane without Production access", () => {
  assert.equal(parseAdminEnvironment("ADMIN-UAT"), "admin-uat");
  assert.equal(isSanityProjectAllowed(UAT_SANITY_PROJECT_ID, "admin-uat"), true);
  assert.equal(isDeploymentProjectAllowed("admin-uat", PRODUCTION_ADMIN_PROJECT_ID), true);
  assert.equal(isAdminSurfaceAllowed("admin-uat", PRODUCTION_ADMIN_PROJECT_ID), true);
  assert.equal(
    isAdminDataPlaneAllowed("uat", "admin-uat", PRODUCTION_ADMIN_PROJECT_ID, undefined, UAT_SANITY_PROJECT_ID),
    true,
  );
  assert.equal(
    isAdminDataPlaneAllowed(
      "production",
      "admin-uat",
      PRODUCTION_ADMIN_PROJECT_ID,
      undefined,
      PRODUCTION_SANITY_PROJECT_ID,
    ),
    false,
  );
  assert.equal(isAdminDataPlaneAllowed("uat", "admin-uat", UAT_PROJECT_ID, undefined, UAT_SANITY_PROJECT_ID), false);
  assert.equal(isAdminDataPlaneAllowed("uat", "admin-uat", WEB_PROJECT_ID, undefined, UAT_SANITY_PROJECT_ID), false);
});

test("only the exact Admin Vercel Preview may infer admin-uat when the explicit lane is absent", () => {
  assert.equal(resolveAdminEnvironment(undefined, "preview", PRODUCTION_ADMIN_PROJECT_ID), "admin-uat");
  assert.equal(resolveAdminEnvironment("", "PREVIEW", PRODUCTION_ADMIN_PROJECT_ID), "admin-uat");

  assert.equal(resolveAdminEnvironment(undefined, "preview", WEB_PROJECT_ID), "unknown");
  assert.equal(resolveAdminEnvironment(undefined, "preview", "prj_unapproved"), "unknown");
  assert.equal(resolveAdminEnvironment(undefined, "preview", undefined), "unknown");
  assert.equal(resolveAdminEnvironment(undefined, "production", PRODUCTION_ADMIN_PROJECT_ID), "unknown");
  assert.equal(resolveAdminEnvironment("staging", "preview", PRODUCTION_ADMIN_PROJECT_ID), "unknown");

  assert.equal(resolveAdminEnvironment("web-uat", "preview", PRODUCTION_ADMIN_PROJECT_ID), "web-uat");
  assert.equal(resolveAdminEnvironment("production", "preview", PRODUCTION_ADMIN_PROJECT_ID), "production");
  assert.equal(resolveAdminEnvironment("production-admin", "preview", WEB_PROJECT_ID), "production-admin");
});

test("inferred Admin Preview stays pinned to the exact Sanity UAT lane", () => {
  const environment = resolveAdminEnvironment(undefined, "preview", PRODUCTION_ADMIN_PROJECT_ID);
  assert.equal(environment, "admin-uat");
  assert.equal(
    isSanityLaneAllowed("uat", environment, PRODUCTION_ADMIN_PROJECT_ID, undefined, UAT_SANITY_PROJECT_ID),
    true,
  );
  assert.equal(
    isAdminDataPlaneAllowed("uat", environment, PRODUCTION_ADMIN_PROJECT_ID, undefined, UAT_SANITY_PROJECT_ID),
    true,
  );
  assert.equal(
    isSanityLaneAllowed(
      "production",
      environment,
      PRODUCTION_ADMIN_PROJECT_ID,
      undefined,
      PRODUCTION_SANITY_PROJECT_ID,
    ),
    false,
  );
  assert.equal(
    isAdminDataPlaneAllowed(
      "production",
      environment,
      PRODUCTION_ADMIN_PROJECT_ID,
      undefined,
      PRODUCTION_SANITY_PROJECT_ID,
    ),
    false,
  );
});

test("each deployed application lane accepts only its approved Vercel project and Sanity lane", () => {
  assert.equal(isSanityLaneAllowed("uat", "development", undefined, undefined, UAT_SANITY_PROJECT_ID), true);
  assert.equal(isSanityLaneAllowed("uat", "development", WEB_PROJECT_ID, undefined, UAT_SANITY_PROJECT_ID), false);
  assert.equal(isSanityLaneAllowed("uat", "web-uat", WEB_PROJECT_ID, undefined, UAT_SANITY_PROJECT_ID), true);
  assert.equal(isSanityLaneAllowed("uat", "web-uat", LAB_PROJECT_ID, undefined, UAT_SANITY_PROJECT_ID), false);
  assert.equal(isSanityLaneAllowed("uat", "lab", LAB_PROJECT_ID, undefined, UAT_SANITY_PROJECT_ID), false);
  assert.equal(isSanityLaneAllowed("uat", "uat", UAT_PROJECT_ID, undefined, UAT_SANITY_PROJECT_ID), false);
  assert.equal(
    isSanityLaneAllowed(
      "production",
      "production-admin",
      PRODUCTION_ADMIN_PROJECT_ID,
      PRODUCTION_ADMIN_PROJECT_ID,
      PRODUCTION_SANITY_PROJECT_ID,
    ),
    true,
  );
  assert.equal(
    isSanityLaneAllowed("production", "production", WEB_PROJECT_ID, undefined, PRODUCTION_SANITY_PROJECT_ID),
    true,
  );
  assert.equal(isSanityLaneAllowed("production", "lab", LAB_PROJECT_ID, undefined, UAT_SANITY_PROJECT_ID), false);
  assert.equal(
    isSanityLaneAllowed(
      "uat",
      "production-admin",
      PRODUCTION_ADMIN_PROJECT_ID,
      PRODUCTION_ADMIN_PROJECT_ID,
      PRODUCTION_SANITY_PROJECT_ID,
    ),
    false,
  );
  assert.equal(isSanityLaneAllowed("uat", "production", WEB_PROJECT_ID, undefined, PRODUCTION_SANITY_PROJECT_ID), false);
  assert.equal(isSanityLaneAllowed(undefined, "unknown"), false);
});

test("public Web Preview, Web UAT and Production cannot mount Admin clients or Studio", () => {
  assert.equal(isAdminSurfaceAllowed("development", WEB_PROJECT_ID), false);
  assert.equal(isSanityLaneAllowed("uat", "development", WEB_PROJECT_ID, undefined, UAT_SANITY_PROJECT_ID), false);
  assert.equal(isAdminReadDataPlaneAllowed("uat", "development", WEB_PROJECT_ID, undefined, UAT_SANITY_PROJECT_ID), false);

  assert.equal(isAdminSurfaceAllowed("web-uat", WEB_PROJECT_ID), false);
  assert.equal(isSanityLaneAllowed("uat", "web-uat", WEB_PROJECT_ID, undefined, UAT_SANITY_PROJECT_ID), true);
  assert.equal(isAdminReadDataPlaneAllowed("uat", "web-uat", WEB_PROJECT_ID, undefined, UAT_SANITY_PROJECT_ID), false);
  assert.equal(isAdminDataPlaneAllowed("uat", "web-uat", WEB_PROJECT_ID, undefined, UAT_SANITY_PROJECT_ID), false);
  assert.equal(isStudioDataPlaneAllowed("uat", "web-uat", WEB_PROJECT_ID, undefined, UAT_SANITY_PROJECT_ID), false);

  assert.equal(isAdminSurfaceAllowed("production", WEB_PROJECT_ID), false);
  assert.equal(isAdminDataPlaneAllowed("production", "production", WEB_PROJECT_ID, undefined, PRODUCTION_SANITY_PROJECT_ID), false);
  assert.equal(isStudioDataPlaneAllowed("production", "production", WEB_PROJECT_ID, undefined, PRODUCTION_SANITY_PROJECT_ID), false);

  assert.equal(
    isAdminDataPlaneAllowed(
      "production",
      "production-admin",
      PRODUCTION_ADMIN_PROJECT_ID,
      PRODUCTION_ADMIN_PROJECT_ID,
      PRODUCTION_SANITY_PROJECT_ID,
    ),
    true,
  );
  assert.equal(
    isStudioDataPlaneAllowed(
      "production",
      "production-admin",
      PRODUCTION_ADMIN_PROJECT_ID,
      PRODUCTION_ADMIN_PROJECT_ID,
      PRODUCTION_SANITY_PROJECT_ID,
    ),
    true,
  );
  assert.equal(isAdminDataPlaneAllowed("uat", "unknown"), false);
  assert.equal(isAdminMutationEnvironment("production", WEB_PROJECT_ID), false);
  assert.equal(isAdminMutationEnvironment("unknown"), false);
});

test("deployed lane identity fails closed on cross-project or missing-project mismatches", () => {
  assert.equal(isDeploymentProjectAllowed("production", WEB_PROJECT_ID), true);
  assert.equal(isDeploymentProjectAllowed("production", PRODUCTION_ADMIN_PROJECT_ID), false);
  assert.equal(isDeploymentProjectAllowed("production", undefined), false);

  assert.equal(isDeploymentProjectAllowed("web-uat", WEB_PROJECT_ID), true);
  assert.equal(isDeploymentProjectAllowed("web-uat", UAT_PROJECT_ID), false);
  assert.equal(isDeploymentProjectAllowed("web-uat", undefined), false);

  assert.equal(isDeploymentProjectAllowed("lab", LAB_PROJECT_ID), false);
  assert.equal(isDeploymentProjectAllowed("lab", UAT_PROJECT_ID), false);
  assert.equal(isDeploymentProjectAllowed("uat", UAT_PROJECT_ID), false);
  assert.equal(isDeploymentProjectAllowed("uat", LAB_PROJECT_ID), false);

  assert.equal(isDeploymentProjectAllowed("development", undefined), true);
  assert.equal(isDeploymentProjectAllowed("development", WEB_PROJECT_ID), false);
  assert.equal(isDeploymentProjectAllowed("development", LAB_PROJECT_ID), false);
  assert.equal(isDeploymentProjectAllowed("development", UAT_PROJECT_ID), false);
  assert.equal(isDeploymentProjectAllowed("development", PRODUCTION_ADMIN_PROJECT_ID), false);
  assert.equal(isDeploymentProjectAllowed("development", "prj_unapproved"), false);

  assert.equal(isDeploymentProjectAllowed("local-uat", undefined), true);
  assert.equal(isDeploymentProjectAllowed("local-uat", WEB_PROJECT_ID), false);
  assert.equal(isDeploymentProjectAllowed("local-production", undefined), true);
  assert.equal(isDeploymentProjectAllowed("local-production", PRODUCTION_ADMIN_PROJECT_ID), false);
});

test("Local Production reads only the exact Production lane and writes fail closed by default", () => {
  delete process.env.CCPUN_LOCAL_PRODUCTION_DRAFT_WRITES;
  assert.equal(isAdminReadDataPlaneAllowed("production", "local-production", undefined, undefined, PRODUCTION_SANITY_PROJECT_ID), true);
  assert.equal(isAdminReadDataPlaneAllowed("uat", "local-production", undefined, undefined, PRODUCTION_SANITY_PROJECT_ID), false);
  assert.equal(isAdminReadDataPlaneAllowed("production", "local-production", undefined, undefined, UAT_SANITY_PROJECT_ID), false);
  assert.equal(isAdminMutationEnvironment("local-production"), false);
  assert.equal(isAdminDataPlaneAllowed("production", "local-production", undefined, undefined, PRODUCTION_SANITY_PROJECT_ID), false);
  assert.equal(isStudioDataPlaneAllowed("production", "local-production", undefined, undefined, PRODUCTION_SANITY_PROJECT_ID), false);
});

test("Local Production Draft mode requires one explicit exact flag", () => {
  assert.equal(isLocalProductionDraftWriteEnabled("local-production", "0"), false);
  assert.equal(isLocalProductionDraftWriteEnabled("local-production", "true"), false);
  assert.equal(isLocalProductionDraftWriteEnabled("local-production", "1"), true);
  process.env.CCPUN_LOCAL_PRODUCTION_DRAFT_WRITES = "1";
  assert.equal(isAdminMutationEnvironment("local-production"), true);
  assert.equal(isAdminDataPlaneAllowed("production", "local-production", undefined, undefined, PRODUCTION_SANITY_PROJECT_ID), true);
  assert.equal(isStudioDataPlaneAllowed("production", "local-production", undefined, undefined, PRODUCTION_SANITY_PROJECT_ID), true);
  delete process.env.CCPUN_LOCAL_PRODUCTION_DRAFT_WRITES;
});

test("production-admin requires both the immutable Admin project ID and the configured expected ID", () => {
  assert.equal(isDeploymentProjectAllowed("production-admin", undefined, PRODUCTION_ADMIN_PROJECT_ID), false);
  assert.equal(
    isDeploymentProjectAllowed("production-admin", WEB_PROJECT_ID, PRODUCTION_ADMIN_PROJECT_ID),
    false,
  );
  assert.equal(
    isDeploymentProjectAllowed("production-admin", PRODUCTION_ADMIN_PROJECT_ID, "prj_wrong_expected_admin"),
    false,
  );
  assert.equal(
    isDeploymentProjectAllowed("production-admin", PRODUCTION_ADMIN_PROJECT_ID, PRODUCTION_ADMIN_PROJECT_ID),
    true,
  );
  assert.equal(
    isAdminDataPlaneAllowed(
      "production",
      "production-admin",
      WEB_PROJECT_ID,
      PRODUCTION_ADMIN_PROJECT_ID,
      PRODUCTION_SANITY_PROJECT_ID,
    ),
    false,
  );
  assert.equal(
    isStudioDataPlaneAllowed(
      "production",
      "production-admin",
      PRODUCTION_ADMIN_PROJECT_ID,
      "prj_wrong_expected_admin",
      PRODUCTION_SANITY_PROJECT_ID,
    ),
    false,
  );
  assert.equal(
    isAdminMutationEnvironment("production-admin", PRODUCTION_ADMIN_PROJECT_ID, PRODUCTION_ADMIN_PROJECT_ID),
    true,
  );
  assert.equal(
    isAdminMutationEnvironment("production-admin", WEB_PROJECT_ID, PRODUCTION_ADMIN_PROJECT_ID),
    false,
  );
});

test("missing and unrecognized application lanes fail closed", () => {
  assert.equal(parseAdminEnvironment(undefined), "unknown");
  assert.equal(parseAdminEnvironment(""), "unknown");
  assert.equal(parseAdminEnvironment("staging"), "unknown");
  assert.equal(parseAdminEnvironment("LAB"), "lab");
  assert.equal(parseAdminEnvironment("WEB-UAT"), "web-uat");
  assert.equal(parseAdminEnvironment("LOCAL-UAT"), "local-uat");
  assert.equal(parseAdminEnvironment("LOCAL-PRODUCTION"), "local-production");
});

test("Sanity projects are pinned to their environment lane", () => {
  assert.equal(isSanityProjectAllowed(UAT_SANITY_PROJECT_ID, "development"), true);
  assert.equal(isSanityProjectAllowed(UAT_SANITY_PROJECT_ID, "web-uat"), true);
  assert.equal(isSanityProjectAllowed(UAT_SANITY_PROJECT_ID, "lab"), true);
  assert.equal(isSanityProjectAllowed(UAT_SANITY_PROJECT_ID, "uat"), true);
  assert.equal(isSanityProjectAllowed(UAT_SANITY_PROJECT_ID, "local-uat"), true);
  assert.equal(isSanityProjectAllowed(PRODUCTION_SANITY_PROJECT_ID, "production-admin"), true);
  assert.equal(isSanityProjectAllowed(PRODUCTION_SANITY_PROJECT_ID, "local-production"), true);
  assert.equal(isSanityProjectAllowed(PRODUCTION_SANITY_PROJECT_ID, "production"), true);
  assert.equal(isSanityProjectAllowed(PRODUCTION_SANITY_PROJECT_ID, "web-uat"), false);
  assert.equal(isSanityProjectAllowed(PRODUCTION_SANITY_PROJECT_ID, "local-uat"), false);
  assert.equal(isSanityProjectAllowed(UAT_SANITY_PROJECT_ID, "production-admin"), false);
  assert.equal(isSanityProjectAllowed(undefined, "local-uat"), false);
});

test("Local UAT keeps HTTP on loopback while deployed lanes enforce HTTPS", () => {
  assert.equal(shouldEnforceHttps("local-uat"), false);
  assert.equal(shouldEnforceHttps("local-production"), false);
  assert.equal(shouldEnforceHttps("web-uat"), true);
  assert.equal(shouldEnforceHttps("lab"), true);
  assert.equal(shouldEnforceHttps("uat"), true);
  assert.equal(shouldEnforceHttps("production-admin"), true);
  assert.equal(shouldEnforceHttps(undefined), true);
});

test("Admin proxy uses the project-aware surface guard", () => {
  assert.match(proxySource, /isAdminSurfaceAllowed/);
  assert.match(proxySource, /if \(!adminSurfaceAllowed\)/);
  assert.match(proxySource, /status: 404/);
});

test("survivor deploy guard allows only immutable survivor IDs and rejects every unknown project", () => {
  assert.match(survivorGuard, /project\.projectId/);
  assert.match(survivorGuard, new RegExp(WEB_PROJECT_ID));
  assert.match(survivorGuard, new RegExp(PRODUCTION_ADMIN_PROJECT_ID));
  assert.match(survivorGuard, /unapproved Vercel project ID/);
  assert.doesNotMatch(survivorGuard, /LEGACY_PROJECT_IDS|LEGACY-FROZEN/);
  assert.doesNotMatch(survivorGuard, /project\.projectName/);
});

test("Local Production launch scripts pin the exact project, dataset, host, and Draft switch", () => {
  const readScript = packageJson.scripts["local:production:read"];
  const draftScript = packageJson.scripts["local:production:draft"];
  for (const script of [readScript, draftScript]) {
    assert.match(script, /CCPUN_APP_ENV=local-production/);
    assert.match(script, /NEXT_PUBLIC_SANITY_PROJECT_ID=kyfxgjnq/);
    assert.match(script, /NEXT_PUBLIC_SANITY_DATASET=production/);
    assert.match(script, /AUTH_URL=http:\/\/localhost:3000/);
    assert.match(script, /next dev --webpack/);
    assert.match(script, /--hostname 127\.0\.0\.1 --port 3000/);
    assert.doesNotMatch(script, /SANITY_(?:PRODUCTION_)?API_(?:READ|WRITE)_TOKEN=/);
  }
  assert.match(readScript, /CCPUN_LOCAL_PRODUCTION_DRAFT_WRITES=0/);
  assert.match(readScript, /NEXT_PUBLIC_CCPUN_LOCAL_PRODUCTION_DRAFT_WRITES=0/);
  assert.match(draftScript, /CCPUN_LOCAL_PRODUCTION_DRAFT_WRITES=1/);
  assert.match(draftScript, /NEXT_PUBLIC_CCPUN_LOCAL_PRODUCTION_DRAFT_WRITES=1/);
});

test("Local UAT uses a dedicated port separate from Local Production", () => {
  const uatScript = packageJson.scripts["local:uat"];
  assert.match(uatScript, /AUTH_URL=http:\/\/localhost:3100/);
  assert.match(uatScript, /--hostname 127\.0\.0\.1 --port 3100/);
  assert.doesNotMatch(uatScript, /localhost:3000|--port 3000/);
});

test("server-side Studio config rejects missing or conflicting public lanes", () => {
  assert.equal(resolveSanityConfigEnvironment("lab", "lab", true), "lab");
  assert.equal(resolveSanityConfigEnvironment(undefined, "lab", true), "lab");
  assert.equal(resolveSanityConfigEnvironment("production-admin", "lab", true), "unknown");
  assert.equal(resolveSanityConfigEnvironment("production-admin", undefined, true), "unknown");
  assert.equal(resolveSanityConfigEnvironment("web-uat", "web-uat", true), "web-uat");
  assert.equal(resolveSanityConfigEnvironment("lab", undefined, false), "lab");
  assert.equal(resolveSanityConfigEnvironment(undefined, "lab", false), "unknown");
  assert.match(studioConfig, /isStudioDataPlaneAllowed\(dataset, environment, undefined, undefined, projectId\)/);
  assert.match(studioCli, /isStudioDataPlaneAllowed\(dataset, getAdminEnvironment\(\), undefined, undefined, projectId\)/);
});

test("legacy migration scripts cannot publish or write outside UAT", () => {
  assert.match(retiredPublisher, /PRODUCTION_PUBLISH_SCRIPT_DISABLED/);
  assert.doesNotMatch(retiredPublisher, /createClient|transaction|SANITY_API_WRITE_TOKEN/);
  assert.match(publishedDraftImporter, /commit && process\.env\.CCPUN_UAT_MODE !== '1'/);
  assert.match(publishedDraftImporter, /commit && dataset\.trim\(\) !== 'uat'/);
  for (const script of [publishedDraftImporter, draftImporter, draftSeeder]) {
    assert.match(script, /projectId\.trim\(\) !== UAT_PROJECT_ID/);
  }
  assert.ok(publishedDraftImporter.indexOf("CCPUN_UAT_MODE") < publishedDraftImporter.indexOf("readFile(inputPath"));
});
