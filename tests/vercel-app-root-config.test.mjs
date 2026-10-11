import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const EXPECTED_INSTALL_COMMAND = "cd ../.. && npm ci";
const EXPECTED_IGNORE_COMMAND = "node ../../scripts/vercel-ignore-build.mjs";
const APP_CONFIGS = ["apps/web/vercel.json", "apps/admin/vercel.json"];

test("Web app-root delegates redirects to the same source as its Hostinger proxy", async () => {
  const { WEB_REDIRECTS } = await import('../lib/runtime/web-build-config.mjs');
  const webNextConfig = readFileSync(new URL("../apps/web/next.config.ts", import.meta.url), "utf8");
  const webProxy = readFileSync(new URL("../apps/web/proxy.ts", import.meta.url), "utf8");
  assert.deepEqual(WEB_REDIRECTS.find(({ prefix }) => prefix === "/financial-advisor"), { prefix: "/financial-advisor", destination: "/" });
  assert.match(webNextConfig, /WEB_REDIRECTS\.map\(\(\{ prefix, destination \}\) => \(\{[\s\S]*source: `\$\{prefix\}\/:path\*`,[\s\S]*destination,[\s\S]*permanent: true/);
  assert.match(webProxy, /for \(const \{ prefix, destination \} of WEB_REDIRECTS\)/);
});

test("isolated Vercel app roots preserve monorepo install and affected-build routing", () => {
  for (const relativePath of APP_CONFIGS) {
    const configUrl = new URL(`../${relativePath}`, import.meta.url);
    const configPath = fileURLToPath(configUrl);
    const config = JSON.parse(readFileSync(configPath, "utf8"));

    assert.equal(config.installCommand, EXPECTED_INSTALL_COMMAND, `${relativePath} must install the repository workspace`);
    assert.equal(config.ignoreCommand, EXPECTED_IGNORE_COMMAND, relativePath);

    assert.equal(
      Object.hasOwn(config, "crons"),
      false,
      `${relativePath} must not own autonomous operational cron jobs after Hostinger cutover`,
    );

    const scriptPath = resolve(dirname(configPath), "../../scripts/vercel-ignore-build.mjs");
    assert.equal(existsSync(scriptPath), true, `${relativePath} must resolve the shared ignore script`);
  }
});
