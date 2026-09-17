import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const adminConfig = JSON.parse(
  readFileSync(new URL("../apps/admin/vercel.json", import.meta.url), "utf8"),
);
const webConfig = JSON.parse(
  readFileSync(new URL("../apps/web/vercel.json", import.meta.url), "utf8"),
);

const expectedIgnoreCommand = "node ../../scripts/vercel-ignore-build.mjs";

test("Vercel app roots keep the runtime ignore router as a safety net", () => {
  assert.equal(adminConfig.ignoreCommand, expectedIgnoreCommand);
  assert.equal(webConfig.ignoreCommand, expectedIgnoreCommand);
});

test("Admin blocks known Web-only branch families before a deployment is created", () => {
  assert.deepEqual(adminConfig.git?.deploymentEnabled, {
    "web/**": false,
    "ux/**": false,
    "**/*website-43*": false,
  });
  assert.notEqual(adminConfig.git.deploymentEnabled["v4-production"], false);
});

test("Web blocks known Admin-only branch families before a deployment is created", () => {
  assert.deepEqual(webConfig.git?.deploymentEnabled, {
    "admin/**": false,
    "codex/admin-*": false,
    "**/*website-42*": false,
  });
  assert.notEqual(webConfig.git.deploymentEnabled["v4-production"], false);
});
