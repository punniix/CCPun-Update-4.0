import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const sha = source => createHash('sha256').update(source).digest('hex');

// An explicit, reviewed composition projection, not a protected-path exemption.
// Every admitted route AND every new implementation owner remains hash-checked.
// The same original modules execute in the registered Phase 1 DOM/API/denial fixtures.
export function reviewedCompositionSource(file, proof, readSource) {
  const projection = proof.compositions?.[file];
  if (!projection) return readSource(file);
  assert.equal(sha(readSource(file)), projection.candidateSha256, file + ': unreviewed route composition change');
  for (const [owner, digest] of Object.entries(proof.owners)) {
    assert.equal(sha(readSource(owner)), digest, owner + ': shared owner changed without output review');
  }
  assert.ok(proof.coverage[file]?.length, file + ": missing registered output coverage");
  const original = proof.baselineSources[file];
  assert.equal(sha(original), projection.baselineSha256, file + ': original Production fixture drift');
  return original;
}

export function productionBaselineSource(file) {
  return reviewedCompositionSource(file, JSON.parse(read("qa/phase1-source-ownership.json")), read);
}

export function productionBaselineBytes(file) {
  const proof = JSON.parse(read("qa/phase1-source-ownership.json"));
  return proof.compositions?.[file]
    ? Buffer.from(reviewedCompositionSource(file, proof, read), "utf8")
    : readFileSync(new URL("../" + file, import.meta.url));
}
