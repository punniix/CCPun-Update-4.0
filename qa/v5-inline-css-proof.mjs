import { ownerReviewSourcePredecessor } from './v5-owner-review-source-successor.mjs';
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const file = "apps/web/next.config.ts";
export const inlineCssPredecessorSha =
  "d4cf8aa0725fdf58263e3f68776db192fa39bfa1e7578b8cb7f715a7e5face9f";
export const inlineCssSuccessorSha =
  "0e4e2029ba44044d103da94cb10b60359e0e53f4c8ba19cf0ad338bf8be0d3aa";
const sha = (source) => createHash("sha256").update(source).digest("hex");
// Admit only the full reviewed Web source. Unknown or mutated sources stay intact
// so the original whole-source owner proof rejects them.
export function inlineCssPredecessor(path, source) {
  source = ownerReviewSourcePredecessor(path, source);
  if (path !== file || sha(source) !== inlineCssSuccessorSha) return source;
  const addition = "  experimental: {\n    inlineCss: true,\n";
  assert.equal(source.split(addition).length, 2);
  const predecessor = source.replace(addition, "  experimental: {\n");
  assert.equal(sha(predecessor), inlineCssPredecessorSha);
  return predecessor;
}
export function inlineCssObservationPredecessor(observation, source) {
  if (inlineCssPredecessor(file, source) === source) return observation;
  assert.equal(observation.config.experimental.inlineCss, true);
  const experimental = { ...observation.config.experimental };
  delete experimental.inlineCss;
  return { ...observation, config: { ...observation.config, experimental } };
}
