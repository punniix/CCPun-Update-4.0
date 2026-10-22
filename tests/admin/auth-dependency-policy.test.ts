import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { isSupportedNodeSecurityVersion } from "../../scripts/check-next-security-baseline.mjs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
const lock = JSON.parse(readFileSync(new URL("../../package-lock.json", import.meta.url), "utf8"));

test("Production Auth.js v5 beta is pinned exactly until stable migration is reviewed", () => {
  assert.equal(pkg.dependencies["next-auth"], "5.0.0-beta.32");
  assert.equal(lock.packages[""].dependencies["next-auth"], "5.0.0-beta.32");
  assert.equal(lock.packages["node_modules/next-auth"].version, "5.0.0-beta.32");
  assert.equal(lock.packages["node_modules/@auth/core"].version, "0.41.3");
  assert.doesNotMatch(pkg.dependencies["next-auth"], /^[~^]/);
});


test("actual dependency baseline rejects unpatched lock records and missing/ranged security overrides", () => {
  const root = mkdtempSync(join(tmpdir(), "ccpun-dependency-floor-"));
  const baseline = readFileSync(new URL("../../scripts/check-next-security-baseline.mjs", import.meta.url), "utf8");
  const manifests = new Map(["package.json", "apps/web/package.json", "apps/admin/package.json"].map(path => [path, readFileSync(new URL("../../" + path, import.meta.url), "utf8")]));
  const run = (manifest = pkg, candidateLock = lock) => {
    writeFileSync(join(root, "package.json"), JSON.stringify(manifest));
    writeFileSync(join(root, "package-lock.json"), JSON.stringify(candidateLock));
    return spawnSync(process.execPath, [join(root, "scripts/check-next-security-baseline.mjs")], { encoding: "utf8" });
  };
  try {
    for (const directory of ["scripts", "apps/web", "apps/admin", "lib/runtime"]) mkdirSync(join(root, directory), { recursive: true });
    writeFileSync(join(root, "scripts/check-next-security-baseline.mjs"), baseline);
    writeFileSync(join(root, "lib/runtime/node-security-baseline.mjs"), readFileSync(new URL("../../lib/runtime/node-security-baseline.mjs", import.meta.url), "utf8"));
    for (const [path, source] of manifests) writeFileSync(join(root, path), source);
    assert.equal(run().status, 0);
    for (const [name, oldVersion] of [["undici", "7.29.1"], ["dompurify", "3.4.16"]]) {
      const changed = structuredClone(lock);
      changed.packages["node_modules/" + name].version = oldVersion;
      const result = run(pkg, changed);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, new RegExp("below patched floor"));
    }
    for (const owner of ["undici", "dompurify", "@workflow/world-local", "@workflow/world-vercel"]) {
      const changed = structuredClone(pkg);
      delete changed.overrides[owner];
      assert.notEqual(run(changed).status, 0, "missing override " + owner);
    }
    const ranged = structuredClone(pkg);
    ranged.overrides.undici = "^7.30.1";
    assert.notEqual(run(ranged).status, 0, "range must not replace reviewed exact override");
    assert.equal(run().status, 0, "valid baseline still passes after negative cases");
  } finally { rmSync(root, { recursive: true, force: true }); }
});


test("runtime security floor stays on Node24 and rejects the unpatched 24.22.0 release", () => {
  for (const value of ["24.11.1", "24.22.0", "23.22.1", "25.0.0", "v24.22.1", "24.22.x", "24.22.1-extra"]) assert.equal(isSupportedNodeSecurityVersion(value), false, value);
  for (const value of ["24.22.1", "24.22.2", "24.23.0", "24.99.0"]) assert.equal(isSupportedNodeSecurityVersion(value), true, value);
});
