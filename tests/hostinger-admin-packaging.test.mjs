import assert from "node:assert/strict";
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { installAdminMonorepoDependencies, stageAdminStandaloneRuntime } from "../apps/admin/scripts/build-provider.mjs";

test("Hostinger Admin replaces the selected workspace install with the exact complete root lock before Next", () => {
  const fixture = mkdtempSync(join(tmpdir(), "ccpun-admin-install-"));
  const admin = join(fixture, "apps/admin");
  mkdirSync(admin, { recursive: true });
  let calls = 0;
  const run = (command, args, options) => {
    calls++;
    assert.match(command, /^npm(?:\.cmd)?$/);
    assert.deepEqual(args, ["ci", "--ignore-scripts", "--include=dev", "--include=optional", "--workspaces", "--include-workspace-root", "--no-audit", "--no-fund"]);
    assert.equal(options.cwd, fixture);
    assert.equal(options.env.CCPUN_ADMIN_CAPABILITY_PROFILE, "editorial");
    assert.equal(options.env.npm_config_workspace, undefined);
    assert.equal(options.env.NPM_CONFIG_PREFIX, undefined);
    return { status: 0 };
  };
  try {
    assert.throws(() => installAdminMonorepoDependencies(admin, run, {}), /complete monorepo/);
    writeFileSync(join(fixture, "package.json"), JSON.stringify({ workspaces: ["apps/*"] }));
    writeFileSync(join(fixture, "package-lock.json"), "{}");
    installAdminMonorepoDependencies(admin, run, { CCPUN_ADMIN_CAPABILITY_PROFILE: "editorial", npm_config_workspace: "@ccpun/admin", NPM_CONFIG_PREFIX: admin });
    assert.equal(calls, 1);
    assert.throws(() => installAdminMonorepoDependencies(admin, () => ({ status: 1 }), {}), /dependency install failed/);
    writeFileSync(join(fixture, "package.json"), "{}");
    assert.throws(() => installAdminMonorepoDependencies(admin, run, {}), /workspace manifest/);
    assert.equal(calls, 1);
  } finally { rmSync(fixture, { recursive: true, force: true }); }
});

test("editorial Admin staging is repeatable and retains assets after publication without its source tree", () => {
  const fixture = mkdtempSync(join(tmpdir(), "ccpun-admin-package-"));
  const admin = join(fixture, "apps/admin");
  const standalone = join(admin, ".next/standalone");
  const nested = join(standalone, "apps/admin");
  const put = (path, value) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, value); };
  try {
    put(join(fixture, "public/favicon.ico"), "favicon");
    put(join(fixture, "public/assets/logo.webp"), "logo");
    put(join(admin, "public/favicon.png"), "admin-favicon");
    put(join(nested, "server.js"), "server");
    put(join(nested, "package.json"), "{}");
    put(join(nested, ".next/BUILD_ID"), "build");
    put(join(standalone, "node_modules/next/package.json"), "{}");
    put(join(admin, ".next/static/chunk.js"), "chunk");
    symlinkSync(join(fixture, "public"), join(nested, "public"));
    symlinkSync(join(fixture, "public"), join(standalone, "public"));
    stageAdminStandaloneRuntime(admin);
    stageAdminStandaloneRuntime(admin);
    assert.equal(lstatSync(join(standalone, "public")).isDirectory(), true);
    rmSync(join(fixture, "public"), { recursive: true });
    assert.equal(readFileSync(join(standalone, "public/assets/logo.webp"), "utf8"), "logo");
    assert.equal(readFileSync(join(standalone, "public/favicon.png"), "utf8"), "admin-favicon");
    assert.equal(readFileSync(join(standalone, ".next/static/ccpun-public/assets/logo.webp"), "utf8"), "logo");
    assert.equal(readFileSync(join(standalone, ".next/static/chunk.js"), "utf8"), "chunk");
  } finally { rmSync(fixture, { recursive: true, force: true }); }
});
