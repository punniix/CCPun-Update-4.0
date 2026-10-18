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

// Exact new Google Connect bodies are checked before their eight reviewed source
// admissions. The original Production maps and all other guards remain immutable.
export function assertReviewedGoogleSessionProduction(file, originalDigest, value, reader, environment) {
  assert.equal(environment, 'production-admin', 'unreviewed Google session environment');
  const { reviewedGoogleSessionProduction: record, ...original } = value;
  assert.equal(sha(JSON.stringify(original)), '5299183ab8850885e12516aaa91b4fb01b21530ac81fbfbf7d0810d7f3898688', 'original Production proof drift');
  assert.equal(sha(JSON.stringify(record)), '0fcffc5371c977c0f817edbab1c0ca09b263ee1199f1d7850ed5a391e7594f9d', 'unreviewed Production Google session admission');
  assert.equal(record.baselineCommit, '0e88533a04bdad9d3cee6991431bd7be41f623b0');
  assert.equal(Object.keys(record.currentSourceDigests).length, 14);
  assert.equal(Object.keys(record.retainedSources).length, 8);
  assert.deepEqual(record.outputTests, ['tests/admin/google-session-connection.test.ts', 'tests/admin/google-session-auth.test.ts']);
  for (const [path, digest] of Object.entries(record.currentSourceDigests))
    assert.equal(sha(reader(path)), digest, path + ': unreviewed actual Google session body');
  const pins = record.retainedSources[file];
  assert.ok(pins, file + ': unreviewed Production Google session path');
  assert.equal(pins.originalSha256, originalDigest, file + ': original protected source drift');
  assert.equal(pins.baselineSha256, originalDigest, file + ': immutable 0e885 ancestor drift');
  assert.equal(pins.candidateSha256, record.currentSourceDigests[file], file + ': current source pin drift');
  return true;
}
