import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (file) => readFileSync(path.join(root, file), "utf8");
const manifest = JSON.parse(read("qa/p2-source-mirror-inventory.json"));
const baseline = JSON.parse(read("qa/monorepo-compatibility-mirrors.json"));
const retention = JSON.parse(read("qa/p24-legacy-retention-policy.json"));

assert.deepEqual(manifest.summary, {
  pairs: 104, identical: 74, divergent: 30, sharedRouteHandlers: 7,
}, "P2.2 inventory must be updated intentionally if the grandfathered source contract changes");
const allowlist = new Set(baseline.existingPairs.map(([a,b]) => JSON.stringify([a,b])));
assert.equal(manifest.pairs.length, allowlist.size);
const matched = new Set();
for (const item of manifest.pairs) {
  const pairKey = JSON.stringify([item.legacy, item.canonical]);
  assert.ok(allowlist.has(pairKey), "unapproved compatibility mirror: " + pairKey);
  assert.ok(!matched.has(pairKey), "duplicate inventory entry: " + pairKey);
  matched.add(pairKey);
  assert.match(item.legacy, /^app\//);
  assert.ok(item.canonical === "apps/" + item.lane + "/" + item.legacy, "not canonical lane ownership");
  assert.ok(existsSync(path.join(root, item.legacy)) && existsSync(path.join(root, item.canonical)), "deleted live/rollback entrypoint");
  const identical = read(item.legacy) === read(item.canonical);
  assert.equal(identical, item.identical, "existing mirror unexpectedly diverged: " + pairKey);
  const category = item.classification;
  assert.ok(["shared-handler-routing-wrapper", "identical-compatibility-retained", "divergent-compatibility-retained"].includes(category));
  if (category === "shared-handler-routing-wrapper") {
    assert.equal(item.lane, "web", "shared Web sitemap/legal must stay Web-owned");
    assert.ok(identical, "shared implementation wrapper drifted");
    assert.match(read(item.legacy), /export \{/);
  } else {
    assert.equal(category, identical ? "identical-compatibility-retained" : "divergent-compatibility-retained");
  }
}
assert.equal(matched.size, allowlist.size, "P2.2 inventory must classify every original pair");

const storedNav = read("lib/nav-config.json");
assert.equal(storedNav, read("public/nav-config.json"), "P2.3 public navigation mirror drift");
assert.deepEqual(JSON.parse(storedNav).tools.map(x => x.href), ["/tools/financial-health-check/", "/ci-planning/"], "P2.3 canonical navigation route contract");

for (const item of retention.retained) {
  assert.ok(existsSync(path.join(root, item.path)), "P2.4 removed protected historical/compatibility evidence " + item.path);
  assert.ok(typeof item.reason === "string" && item.reason.length > 30);
}
for (const file of ["vercel.json", "apps/web/vercel.json", "apps/admin/vercel.json"]) {
  const config = JSON.parse(read(file));
  assert.equal(config.crons, undefined, "Vercel operational cron must not reappear: " + file);
  assert.equal(config.functions, undefined, "Vercel autonomous functions must not be silently re-enabled");
  assert.ok(typeof config.ignoreCommand === "string" && config.ignoreCommand.includes("vercel-ignore-build.mjs"));
}
assert.equal(retention.authority, "docs/architecture/ccpun-four-lane-deployment-contract.md");
assert.match(read(retention.authority), /Hostinger/);
console.log("P2.2/P2.3/P2.4 inventory, owner configs, legacy retention, and Vercel retirement guard: PASS");
