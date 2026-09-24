import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
const lock = JSON.parse(readFileSync(new URL("../../package-lock.json", import.meta.url), "utf8"));

test("Production Auth.js v5 beta is pinned exactly until stable migration is reviewed", () => {
  assert.equal(pkg.dependencies["next-auth"], "5.0.0-beta.32");
  assert.equal(lock.packages[""].dependencies["next-auth"], "5.0.0-beta.32");
  assert.equal(lock.packages["node_modules/next-auth"].version, "5.0.0-beta.32");
  assert.equal(lock.packages["node_modules/@auth/core"].version, "0.41.3");
  assert.doesNotMatch(pkg.dependencies["next-auth"], /^[~^]/);
});
