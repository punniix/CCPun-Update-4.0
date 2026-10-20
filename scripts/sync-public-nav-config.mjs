import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const canonical = fileURLToPath(new URL("../lib/nav-config.json", import.meta.url));
const mirror = fileURLToPath(new URL("../public/nav-config.json", import.meta.url));
const args = process.argv.slice(2);
assert.ok(args.length <= 1 && (!args.length || ["--check", "--write"].includes(args[0])), "only --check or --write is supported");

const original = readFileSync(canonical, "utf8");
const config = JSON.parse(original);
assert.deepEqual(Object.keys(config), ["tools"], "navigation schema drift");
assert.ok(Array.isArray(config.tools) && config.tools.length > 0, "navigation tools are required");
const slugs = new Set();
for (const entry of config.tools) {
  assert.deepEqual(Object.keys(entry).sort(), ["href", "label"], "navigation entry schema drift");
  assert.equal(typeof entry.label, "string");
  assert.ok(entry.label.trim().length > 0, "navigation label is required");
  assert.equal(typeof entry.href, "string");
  assert.match(entry.href, /^\/(?:tools\/[a-z0-9-]+|ci-planning)\/$/, "navigation link must be a known public route");
  assert.ok(!slugs.has(entry.href), "duplicate navigation path");
  slugs.add(entry.href);
}
assert.ok(original.endsWith("\n"), "canonical nav JSON must end in a newline");

if (args[0] === "--write") {
  // Only an explicitly invoked maintenance command may refresh this compatibility artifact.
  writeFileSync(mirror, original, "utf8");
}
assert.equal(readFileSync(mirror, "utf8"), original, "public nav compatibility mirror drifted: run npm run nav:sync:write");
console.log("P2.3 navigation owner and compatibility mirror: PASS");
