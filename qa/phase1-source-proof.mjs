import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const sha = source => createHash('sha256').update(source).digest('hex');

// Exact inherited C645 UAT outputs; original Production proof and golden sources stay intact.
// Recorded from immutable C645, never from the PR418 candidate. No DOM normalization.
const ORIGINAL_PROOF_SHA256 = '25a140b4e82b161fb652253f5dc9aa87308ddf78d575f1f07e20c74cf349cafb';
const INHERITED_UAT_SHA256 = '3c17aa020d6233010d6c2b8d4877eff9bf215d453595267642a919b043dafb9f';
function inheritedUatAdmission(proof) {
  const { reviewedInheritedUat, ...original } = proof;
  assert.equal(sha(JSON.stringify(original)), ORIGINAL_PROOF_SHA256, 'original Production proof drift');
  assert.equal(sha(JSON.stringify(reviewedInheritedUat)), INHERITED_UAT_SHA256, 'unreviewed inherited UAT admission');
  return reviewedInheritedUat;
}
export function inheritedUatSourceDigest(file, originalDigest, proof) {
  if (!proof.reviewedInheritedUat) return originalDigest;
  const record = inheritedUatAdmission(proof).sourceDigests[file];
  if (!record) return originalDigest;
  assert.equal(record.originalSha256, originalDigest, file + ': inherited original source drift');
  return record.c645Sha256;
}
export function assertInheritedUatFixtureSources(proof, readSource) {
  for (const [file, record] of Object.entries(inheritedUatAdmission(proof).sourceDigests)) {
    assert.equal(sha(readSource(file)), record.c645Sha256, file + ': unreviewed inherited owner body');
  }
}
export function assertInheritedUatOutput(current, original, key, proof) {
  const record = inheritedUatAdmission(proof).outputs[JSON.stringify(key)];
  assert.ok(record, 'unregistered inherited UAT fixture: ' + JSON.stringify(key));
  const { html: currentHtml, ...currentNonDom } = current;
  const { html: originalHtml, ...originalNonDom } = original;
  assert.deepEqual(currentNonDom, originalNonDom, 'original non-DOM invariant drift: ' + JSON.stringify(key));
  assert.equal(sha(JSON.stringify(original)), record.originalOutputSha256, 'original Production output drift');
  assert.equal(sha(JSON.stringify(current)), record.c645OutputSha256, 'inherited C645 full output drift');
}

// An explicit, reviewed composition projection, not a protected-path exemption.
// Every admitted route AND every new implementation owner remains hash-checked.
// The same original modules execute in the registered Phase 1 DOM/API/denial fixtures.
export function reviewedCompositionSource(file, proof, readSource) {
  const projection = proof.compositions?.[file];
  if (!projection) return readSource(file);
  assert.equal(sha(readSource(file)), inheritedUatSourceDigest(file, projection.candidateSha256, proof), file + ': unreviewed route composition change');
  for (const [owner, digest] of Object.entries(proof.owners)) {
    assert.equal(sha(readSource(owner)), inheritedUatSourceDigest(owner, digest, proof), owner + ': shared owner changed without output review');
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
