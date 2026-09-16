import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const contract = readFileSync(new URL("../../docs/admin-layer/social-product-contract.md", import.meta.url), "utf8");
const handoff = readFileSync(new URL("../../HANDOFF.md", import.meta.url), "utf8");

test("repository handoff points PR57 agents to the canonical acceptance contract", () => {
  assert.match(handoff, /PR57 social workspace work/);
  assert.ok(handoff.includes("[`docs/admin-layer/social-product-contract.md`](./docs/admin-layer/social-product-contract.md)"));
  assert.match(handoff, /acceptance source of truth/);
});

test("PR57 contract cannot silently collapse Facebook publishing to text only", () => {
  for (const capability of [
    "Text", "Link", "Single image", "Multi-image / album", "Video", "Reel", "Meta native",
  ]) assert.match(contract, new RegExp(`\\b${capability.replace(" / ", " \\/ ")}\\b`, "i"));
  assert.match(contract, /One approved revision may have only one active execution/);
});

test("PR57 contract retains future content, human gates, native metrics and export", () => {
  for (const requirement of [
    /current and future `socialVariant` Drafts/,
    /configurable bounded overlap/,
    /bounded batches rather than scanning the full history/,
    /resets review to `drafting`/,
    /never sums unlike metrics/,
    /Google Sheets export/,
    /no n8n/i,
  ]) assert.match(contract, requirement);
});
