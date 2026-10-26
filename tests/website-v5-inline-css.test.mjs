import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  inlineCssPredecessor,
  inlineCssPredecessorSha,
  inlineCssSuccessorSha,
  inlineCssObservationPredecessor,
} from "../qa/v5-inline-css-proof.mjs";
const file = "apps/web/next.config.ts";
const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const sha = (source) => createHash("sha256").update(source).digest("hex");

test("only the exact Web config successor enables inline CSS", () => {
  const source = read(file);
  assert.equal(sha(source), inlineCssSuccessorSha);
  assert.equal(
    sha(inlineCssPredecessor(file, source)),
    inlineCssPredecessorSha,
  );
  assert.match(source, /experimental: \{\n    inlineCss: true,/);
  for (const path of ["next.config.ts", "apps/admin/next.config.ts"])
    assert.doesNotMatch(read(path), /inlineCss/);
});
test("unknown edits and duplicate additions never receive the reviewed inverse", () => {
  const source = read(file);
  for (const mutated of [
    source + "\n",
    source.replace("inlineCss: true", "inlineCss: false"),
    source.replace(
      "inlineCss: true,",
      "inlineCss: true,\n    inlineCss: true,",
    ),
    source.replace("compress: true", "compress: false"),
  ]) {
    assert.equal(inlineCssPredecessor(file, mutated), mutated);
    assert.notEqual(sha(mutated), inlineCssPredecessorSha);
  }
  assert.equal(
    inlineCssPredecessor("apps/admin/next.config.ts", source),
    source,
  );
});
test("the exact observation inverse preserves every other output and leaves actual input intact", () => {
  const actual = {
    config: {
      experimental: {
        inlineCss: true,
        optimizePackageImports: ["lucide-react"],
      },
      compress: true,
    },
    csp: "unchanged",
  };
  assert.deepEqual(inlineCssObservationPredecessor(actual, read(file)), {
    config: {
      experimental: { optimizePackageImports: ["lucide-react"] },
      compress: true,
    },
    csp: "unchanged",
  });
  assert.equal(actual.config.experimental.inlineCss, true);
  assert.equal(
    inlineCssObservationPredecessor(actual, read(file) + "\n"),
    actual,
  );
});
