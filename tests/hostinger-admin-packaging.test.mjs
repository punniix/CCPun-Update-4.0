import assert from "node:assert/strict";
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { stageAdminStandaloneRuntime } from "../apps/admin/scripts/build-provider.mjs";

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
