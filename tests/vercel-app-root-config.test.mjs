import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const EXPECTED_INSTALL_COMMAND = "cd ../.. && npm ci";
const EXPECTED_IGNORE_COMMAND = "node ../../scripts/vercel-ignore-build.mjs";
const APP_CONFIGS = ["apps/web/vercel.json", "apps/admin/vercel.json"];

test("isolated Vercel app roots preserve monorepo install and affected-build routing", () => {
  for (const relativePath of APP_CONFIGS) {
    const configUrl = new URL(`../${relativePath}`, import.meta.url);
    const configPath = fileURLToPath(configUrl);
    const config = JSON.parse(readFileSync(configPath, "utf8"));

    assert.equal(config.installCommand, EXPECTED_INSTALL_COMMAND, `${relativePath} must install the repository workspace`);
    assert.equal(config.ignoreCommand, EXPECTED_IGNORE_COMMAND, relativePath);

    if (relativePath === "apps/admin/vercel.json") {
      assert.deepEqual(config.crons, [{ path: "/api/admin/social/worker", schedule: "*/5 * * * *" }], "Admin may own the Social worker cron only");
    } else {
      assert.equal(Object.hasOwn(config, "crons"), false, `${relativePath} must not own Admin operational cron jobs`);
    }

    const scriptPath = resolve(dirname(configPath), "../../scripts/vercel-ignore-build.mjs");
    assert.equal(existsSync(scriptPath), true, `${relativePath} must resolve the shared ignore script`);
  }
});