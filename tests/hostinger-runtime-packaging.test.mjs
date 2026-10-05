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


test("standalone Web runtime carries only the safe Hostinger lane identity it was built with", () => {
  const fixture = mkdtempSync(join(tmpdir(), "ccpun-hostinger-runtime-env-"));
  const web = join(fixture, "apps/web");
  const standalone = join(web, ".next/standalone");
  const nested = join(standalone, "apps/web");
  const put = (path, value) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, value); };
  try {
    for (const path of ["llms.txt", ".well-known/security.txt", "favicon.ico"]) put(join(fixture, "public", path), path);
    mkdirSync(web, { recursive: true });
    symlinkSync("../../public", join(web, "public"));
    put(join(nested, "server.js"), "console.log(process.env.CCPUN_APP_ENV);\n");
    put(join(nested, "package.json"), "{}");
    put(join(nested, ".next/BUILD_ID"), "build");
    put(join(standalone, "node_modules/next/package.json"), "{}");
    put(join(web, ".next/static/chunk.js"), "chunk");

    stageStandaloneRuntime(web, {
      CCPUN_DEPLOYMENT_PROVIDER: "hostinger",
      CCPUN_DEPLOYMENT_ROLE: "web",
      CCPUN_RELEASE_STAGE: "live",
      CCPUN_APP_ENV: "production",
      NEXT_PUBLIC_CCPUN_APP_ENV: "production",
      NEXT_PUBLIC_SANITY_PROJECT_ID: "kyfxgjnq",
      NEXT_PUBLIC_SANITY_DATASET: "production",
      CCPUN_UAT_MODE: "0",
      CCPUN_ENABLE_PRODUCTION_ANALYTICS: "1",
      CCPUN_GIT_REF: "v4-production",
      CCPUN_GIT_SHA: "a".repeat(40),
      CCPUN_RELEASE_ID: "hostinger-web-prod-aaaaaaaaaaaa",
      CCPUN_PRIVATE_SECRET: "must-not-ship",
    });

    const server = readFileSync(join(standalone, "server.js"), "utf8");
    assert.match(server, /CCPUN_RUNTIME_ENV_BOOTSTRAP/);
    assert.match(server, /CCPUN_APP_ENV.*production/);
    assert.match(server, /NEXT_PUBLIC_SANITY_PROJECT_ID.*kyfxgjnq/);
    assert.match(server, /CCPUN_ENABLE_PRODUCTION_ANALYTICS.*1/);
    assert.doesNotMatch(server, /CCPUN_PRIVATE_SECRET|must-not-ship/);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
