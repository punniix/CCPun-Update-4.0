#!/usr/bin/env node
// Security floor: October 2026 Next.js and React advisories.
// Run before local dev, builds, and on every PR. No network or secrets required.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { isSupportedNodeSecurityVersion } from "../lib/runtime/node-security-baseline.mjs";
export { isSupportedNodeSecurityVersion } from "../lib/runtime/node-security-baseline.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (p) => JSON.parse(readFileSync(resolve(root, p), "utf8"));
const manifestPaths = ["package.json", "apps/web/package.json", "apps/admin/package.json"];
const lock = readJson("package-lock.json");
const failures = [];
if (!isSupportedNodeSecurityVersion(process.versions.node)) failures.push("NODE_SECURITY_BASELINE_DENIED: require Node24.22.1 or a later Node24 release");

function parseVersion(value, context) {
  if (typeof value !== "string" || !/^\d+\.\d+\.\d+$/.test(value)) {
    failures.push(context + ": expected exact semantic version, got " + JSON.stringify(value));
    return null;
  }
  return value.split(".").map(Number);
}
function gteVersion(actual, minimum) {
  if (!actual) return false;
  for (let i = 0; i < 3; i++) {
    if (actual[i] !== minimum[i]) return actual[i] > minimum[i];
  }
  return true;
}
function enforce(actual, floor, context) {
  const parsed = parseVersion(actual, context);
  if (parsed && !gteVersion(parsed, floor)) failures.push(context + ": " + actual + " is below patched floor " + floor.join("."));
  return actual;
}
const floors = { next: [16, 4, 2], react: [19, 2, 9], "react-dom": [19, 2, 9] };
const versions = {};
for (const path of manifestPaths) {
  const pkg = readJson(path);
  for (const [name, floor] of Object.entries(floors)) {
    const value = enforce(pkg.dependencies?.[name], floor, path + " dependencies." + name);
    if (versions[name] && versions[name] !== value) failures.push(path + ": " + name + " differs from root pinned baseline " + versions[name]);
    versions[name] ??= value;
  }
  const lockPkg = lock.packages?.[path === "package.json" ? "" : path.replace("/package.json", "")];
  if (!lockPkg) failures.push(path + ": missing lockfile workspace metadata");
  else for (const name of Object.keys(floors)) {
    if (pkg.dependencies?.[name] !== lockPkg.dependencies?.[name]) failures.push(path + ": lockfile metadata mismatch for " + name);
  }
}
const eslint = enforce(readJson("package.json").devDependencies?.["eslint-config-next"], [16,4,2], "root eslint-config-next");
if (versions.next !== eslint) failures.push("eslint-config-next must match next exactly");
for (const [name, minimum] of [
  ["next", [16,4,2]], ["react", [19,2,9]], ["react-dom", [19,2,9]],
  ["eslint-config-next", [16,4,2]], ["sharp", [0,35,5]],
  ["undici", [7,30,1]], ["dompurify", [3,4,17]]
]) {
  enforce(lock.packages?.["node_modules/" + name]?.version, minimum, "package-lock installed " + name);
}
const overrides = readJson("package.json").overrides;
for (const [context, actual, expected] of [
  ["undici", overrides?.undici, "7.30.1"],
  ["@workflow/world-local.undici", overrides?.["@workflow/world-local"]?.undici, "7.30.1"],
  ["@workflow/world-vercel.undici", overrides?.["@workflow/world-vercel"]?.undici, "7.30.1"],
  ["dompurify", overrides?.dompurify, "3.4.17"],
]) {
  if (actual !== expected) failures.push("root override " + context + ": expected exact reviewed patch " + expected);
}
for (const [name, expected] of Object.entries({ ...versions, "eslint-config-next": eslint })) {
  if (lock.packages?.["node_modules/" + name]?.version !== expected) failures.push("lockfile version mismatch for " + name);
}
enforce(process.versions.undici, [7,30,1], "Node bundled Undici");
if (failures.length) {
  console.error("CCPun Next.js security baseline FAILED:\n" + failures.map(s => "- " + s).join("\n"));
  process.exit(1);
}
console.log("CCPun patched dependency baseline OK: next " + versions.next + ", react " + versions.react + ", react-dom " + versions["react-dom"] + ", sharp " + lock.packages["node_modules/sharp"].version + ", undici " + lock.packages["node_modules/undici"].version + ", dompurify " + lock.packages["node_modules/dompurify"].version);

// Only numeric runtime metadata, never generic environment/provider output.
console.log("CCPun runtime security baseline OK: Node " + process.versions.node + ", bundled Undici " + process.versions.undici);
