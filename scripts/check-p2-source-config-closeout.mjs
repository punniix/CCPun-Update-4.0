import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (file) => readFileSync(path.join(root, file), "utf8");
const manifest = JSON.parse(read("qa/p2-source-mirror-inventory.json"));
const baseline = JSON.parse(read("qa/monorepo-compatibility-mirrors.json"));
const retention = JSON.parse(read("qa/p24-legacy-retention-policy.json"));
// The P2 inventory is frozen historical evidence; current delegations have explicit owners.
const migration = JSON.parse(read("qa/root-runtime-owner-migration.json"));
const migratedOwners = new Map(migration.pairs.map(item => [item.legacy, item]));
assert.equal(migratedOwners.size, 73, "canonical delegation inventory must remain explicit");
const metadata = JSON.parse(read("qa/page-seo-compat-owners.json"));
const metadataBeforeHashes = {
  "app/page.tsx": "814c4f422df23d52812e47838606bfd339417cf7e80ead1854af453e8c8cfec9",
  "app/blog/page.tsx": "29a233316183374446d117aeb0d9fc9ccba52d43055e5552e4f3f80ec550f5ce",
  "app/ci-planning/page.tsx": "1bcec72d36fbf2cb3239620f21399ca9192eb259043f8f175bfeaec3a4868048",
  "app/tools/financial-health-check/page.tsx": "3e572c982951b4ecea1e5d0786841ff28535f80cfccacb7907de290fd452e396",
  "app/play/money-story/page.tsx": "82d0e4b963086b418224683ae699f51b6b1604e6969f01c297e0b8b521e1f00f",
  "app/privacy/page.tsx": "3b5d431637f269a409327d38e6d9cb9f2d8af255d7cbf24cab9ba78e35fe421d",
  "app/cookie-policy/page.tsx": "44b8f8a62b3f3e8fe363dd5ed38bfe8ef3aa7c1490fa5626616272f3ca72c2f7"
};
assert.equal(metadata.baseline, "7148dcdf3283a079a5f9bdc929867ea0ba7312d6");
assert.deepEqual(metadata.pairs.map(item => item.legacy).sort(), Object.keys(metadataBeforeHashes).sort(), "metadata ownership is exactly seven existing static Root routes");
for (const owner of metadata.pairs) {
  assert.equal(owner.canonical, "apps/web/" + owner.legacy);
  assert.equal(owner.status, "migrated");
  assert.equal(owner.beforeSha256, metadataBeforeHashes[owner.legacy]);
  assert.equal(createHash("sha256").update(owner.beforeSource).digest("hex"), owner.beforeSha256, "metadata pre-source proof drift");
  assert.equal(owner.wrapper, `export { default, generateMetadata } from "@/${owner.canonical.replace(/\.tsx$/, "")}";\n`);
  migratedOwners.set(owner.legacy, owner);
}
assert.equal(migratedOwners.size, 79, "73 historical owners plus six new static owners");
const adminMirror = metadata.adminMirror;
assert.equal(adminMirror.legacy, "app/blog/page.tsx");
assert.equal(adminMirror.canonical, "apps/admin/app/blog/page.tsx");
assert.equal(adminMirror.feature, "@/features/blog/pages/BlogArchivePage");
assert.equal(adminMirror.sha256, metadataBeforeHashes["app/blog/page.tsx"]);
assert.equal(createHash("sha256").update(read(adminMirror.canonical)).digest("hex"), adminMirror.sha256, "the retained Admin mirror cannot change");
assert.equal(read(adminMirror.canonical), `export { metadata, default } from "${adminMirror.feature}";\n`);

const verifiedDelegations = new Set();

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
  const owner = migratedOwners.get(item.legacy);
  if (owner && owner.canonical === item.canonical) {
    assert.equal(owner.status, "migrated", "unfinished canonical delegation: " + item.legacy);
    assert.equal(owner.canonical, item.canonical, "canonical delegation changed lane owner");
    assert.equal(read(item.legacy), owner.wrapper, "canonical entry wrapper drift: " + item.legacy);
    for (const config of read(item.canonical).matchAll(/export const (dynamic|dynamicParams|revalidate|fetchCache|runtime|preferredRegion|maxDuration|experimental_ppr)\s*=\s*([^;]+);/g)) {
      assert.ok(owner.wrapper.includes(`export const ${config[1]} = ${config[2]};`), "static Next route config drift: " + item.legacy);
    }
    assert.ok(owner.wrapper.includes(`from "@/${item.canonical.replace(/\.[^.]+$/, "")}"`), "wrapper must import its declared owner");
    assert.ok(["shared-handler-routing-wrapper", "identical-compatibility-retained", "divergent-compatibility-retained"].includes(item.classification));
    verifiedDelegations.add(item.legacy);
    continue;
  }

  if (item.legacy === adminMirror.legacy && item.canonical === adminMirror.canonical) {
    assert.equal(item.lane, "admin");
    assert.equal(item.identical, true);
    assert.equal(item.classification, "identical-compatibility-retained");
    const webOwner = migratedOwners.get(item.legacy);
    assert.equal(read(item.legacy), webOwner.wrapper);
    const source = read(webOwner.canonical);
    assert.ok(source.includes(`import { metadata as defaults } from "${adminMirror.feature}";`), "Admin/Web fallback metadata must have the same feature owner");
    assert.ok(source.includes(`export { default } from "${adminMirror.feature}";`), "Admin/Web bodies must have the same feature owner");
    continue;
  }
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
assert.equal(verifiedDelegations.size, migratedOwners.size, "every new delegation must belong to the grandfathered compatibility inventory");

const storedNav = read("lib/nav-config.json");
assert.equal(storedNav, read("public/nav-config.json"), "P2.3 public navigation mirror drift");
assert.deepEqual(JSON.parse(storedNav).tools.map(x => x.href), ["/play/money-story/", "/tools/financial-health-check/", "/ci-planning/"], "P2.3 canonical navigation route contract");

const retiredProviderArtifacts = new Set(["vercel.json", "apps/web/vercel.json", "apps/admin/vercel.json", "scripts/vercel-ignore-build.mjs", "lib/runtime/vercel-service-auth.ts"]);
for (const item of retention.retained) {
  if (retiredProviderArtifacts.has(item.path)) assert.equal(existsSync(path.join(root, item.path)), false, "retired provider configuration must not reactivate: " + item.path);
  else assert.ok(existsSync(path.join(root, item.path)), "P2.4 removed protected historical/compatibility evidence " + item.path);
  assert.ok(typeof item.reason === "string" && item.reason.length > 30);
}
for (const file of ["vercel.json", "apps/web/vercel.json", "apps/admin/vercel.json"]) {
  assert.equal(existsSync(path.join(root, file)), false, "retired provider configuration, cron and autonomous functions must not reactivate: " + file);
}
assert.equal(retention.authority, "docs/architecture/ccpun-four-lane-deployment-contract.md");
assert.match(read(retention.authority), /Hostinger/);
console.log("P2.2/P2.3/P2.4 inventory, owner configs, legacy retention, and Vercel retirement guard: PASS");
