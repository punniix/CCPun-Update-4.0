import { adminCmsBridgePredecessor } from "../qa/admin-cms-web-bridge-successor.mjs";
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

// 1843dbc Production CSS after excluding only the nine proven inactive owner blocks.
// Fingerprints preserve every remaining declaration and its order, with no Git-history dependency.
const baseline = {
  "components/styles/public-compat.css": "6e872a01a74b02157765b83e43890ae81fd23e49b0ef170eb7b907ba7f8e9255",
  "components/styles/public-motion.css": "43219cc22c110351f609c72a5cf73eed620d7da2eab7698924266b8ca4461aa3"
};

test('remaining shared foundation CSS preserves the Production declaration/order baseline', () => {
  for (const [file, expected] of Object.entries(baseline)) {
    const source = adminCmsBridgePredecessor(file, readFileSync(file, 'utf8')).replace(/\n{3,}/g, '\n\n').trim();
    assert.equal(createHash('sha256').update(source).digest('hex'), expected, file);
  }
});
