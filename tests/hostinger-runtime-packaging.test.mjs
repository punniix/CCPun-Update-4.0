import assert from "node:assert/strict";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { stageStandaloneRuntime } from "../apps/web/scripts/build-provider.mjs";

test("repeated standalone staging materializes public symlinks into an independently publishable runtime", () => {
  const fixture = mkdtempSync(join(tmpdir(), "ccpun-hostinger-package-"));
  const web = join(fixture, "apps/web");
  const standalone = join(web, ".next/standalone");
  const nested = join(standalone, "apps/web");
  const put = (path, value) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, value); };
  try {
    for (const path of ["llms.txt", ".well-known/security.txt", "favicon.ico", "assets/hero.png"]) put(join(fixture, "public", path), path);
    mkdirSync(web, { recursive: true });
    symlinkSync("../../public", join(web, "public"));
    put(join(nested, "server.js"), "server");
    put(join(nested, "package.json"), "{}");
    put(join(nested, ".next/BUILD_ID"), "build");
    put(join(standalone, "node_modules/next/package.json"), "{}");
    put(join(web, ".next/static/chunk.js"), "chunk");
    // Reproduces a restored provider tree whose published public paths were symlinks.
    symlinkSync(join(fixture, "public"), join(nested, "public"));
    symlinkSync(join(fixture, "public"), join(standalone, "public"));
    stageStandaloneRuntime(web);
    stageStandaloneRuntime(web);
    assert.equal(lstatSync(join(standalone, "public")).isDirectory(), true);
    assert.equal(lstatSync(join(nested, "public")).isDirectory(), true);
    assert.equal(readFileSync(join(standalone, ".next/static/ccpun-public/assets/hero.png"), "utf8"), "assets/hero.png");
    rmSync(join(fixture, "public"), { recursive: true });
    assert.equal(readFileSync(join(standalone, "public/assets/hero.png"), "utf8"), "assets/hero.png");
    assert.equal(existsSync(join(standalone, ".next/static/chunk.js")), true);
  } finally { rmSync(fixture, { recursive: true, force: true }); }
});
