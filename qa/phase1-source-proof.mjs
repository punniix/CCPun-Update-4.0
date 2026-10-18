import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const sha = source => createHash('sha256').update(source).digest('hex');

// Exact inherited C645 UAT outputs; original Production proof and golden sources stay intact.
// Recorded from immutable C645, never from the PR418 candidate. No DOM normalization.
const ORIGINAL_PROOF_SHA256 = '25a140b4e82b161fb652253f5dc9aa87308ddf78d575f1f07e20c74cf349cafb';
const INHERITED_UAT_SHA256 = 'a4eddc7e2fe30c12a034f980386752d1c16b4a8079cd54cebef1255c17c61c82';
function inheritedUatAdmission(proof) {
  const { reviewedInheritedUat, reviewedSeoUat, reviewedGoogleSessionUat, ...original } = proof;
  void reviewedGoogleSessionUat;
  void reviewedSeoUat;
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

// Only the two explicit UAT retention guards opt into these exact accepted sources.
// Production projections and every original protected digest remain unchanged.
export function assertReviewedUatRetention(file, originalDigest, proof, readSource, environment) {
  assert.equal(environment, 'admin-uat', 'unreviewed retention environment');
  const record = inheritedUatAdmission(proof).retainedSources[file];
  assert.ok(record, file + ': unreviewed UAT retained source');
  assert.equal(record.originalSha256, originalDigest, file + ': original protected digest drift');
  assert.equal(sha(readSource(file)), record.candidateSha256, file + ': unreviewed UAT retained body');
  return true;
}

// Current Google Connect bodies remain fully pinned before any explicit UAT-only
// retained-source projection. This does not certify new behavior against old DOM goldens.
const REVIEWED_GOOGLE_SESSION_UAT_SHA256 = 'cea161bb83a5206c667a2366fe8086ce94d4d22101ddeb1c0825db25c14aec30';
function googleSessionAdmission(proof, readSource, environment) {
  assert.equal(environment, 'admin-uat', 'unreviewed Google session environment');
  inheritedUatAdmission(proof);
  const record = proof.reviewedGoogleSessionUat;
  assert.equal(sha(JSON.stringify(record)), REVIEWED_GOOGLE_SESSION_UAT_SHA256, 'unreviewed Google session admission');
  assert.equal(record.baselineCommit, '6bfe13a538ee0daeaa3b5c9edaadb3d08fe70327');
  assert.equal(Object.keys(record.existingSources).length, 9);
  assert.equal(Object.keys(record.currentSourceDigests).length, 14);
  assert.deepEqual(record.outputTests, ['tests/admin/google-session-connection.test.ts', 'tests/admin/google-session-auth.test.ts', 'tests/admin/google-connect-native-submit.test.ts']);
  for (const [path, digest] of Object.entries(record.currentSourceDigests))
    assert.equal(sha(readSource(path)), digest, path + ': unreviewed actual Google session body');
  for (const [path, pins] of Object.entries(record.existingSources)) {
    assert.equal(proof.protected[path] ?? null, pins.originalProtectedSha256, path + ': original Google session protection drift');
    assert.equal(sha(pins.baselineSource), pins.baseSha256, path + ': immutable 6b source drift');
    assert.ok(record.currentSourceDigests[path], path + ': missing actual source pin');
  }
  return record;
}
export function reviewedGoogleSessionBaselineSource(file, proof, readSource, environment) {
  const pins = googleSessionAdmission(proof, readSource, environment).existingSources[file];
  assert.ok(pins, file + ': unreviewed Google session projection path');
  return pins.baselineSource;
}

// Separate reviewed SEO compatibility. The old Production and inherited C645 objects stay sealed.
const REVIEWED_SEO_UAT_SHA256 = 'be40d4cf031d17c97adcce92d3a44cbb766f634c21d57cd13eedf0405f655096';
function seoUatAdmission(proof, readSource, environment) {
  assert.equal(environment, 'admin-uat', 'unreviewed SEO admission environment');
  inheritedUatAdmission(proof);
  const record = proof.reviewedSeoUat;
  assert.equal(sha(JSON.stringify(record)), REVIEWED_SEO_UAT_SHA256, 'unreviewed SEO admission');
  const { testOverlays, ...originalSeoReview } = record;
  assert.equal(sha(JSON.stringify(originalSeoReview)), 'e31bb7f61e1e7e879190d0380f7e06d4e9de213b6ef963cd2dd07f33a40d751a', 'original reviewed D0 SEO evidence drift');
  for (const [path, digest] of Object.entries(record.outputTests)) {
    const source = readSource(path), overlay = testOverlays?.[path];
    if (overlay) {
      assert.equal(overlay.sourceCommit, record.sourceCommit, 'test overlay source provenance');
      assert.equal(overlay.originalSha256, digest, 'original D0 test hash stays frozen');
      assert.equal(sha(source), overlay.candidateSha256, path + ': reviewed test overlay body drift');
      assert.equal(source.split(overlay.after).length, 2, 'exactly one reviewed test-only environment overlay');
      assert.equal(sha(source.replace(overlay.after, overlay.before)), digest, 'test overlay reverse must recover whole immutable D0 bytes');
    } else assert.equal(sha(source), digest, path + ': reviewed SEO output coverage drift');
  }
  // D0 remains the same evidence. For the separately reviewed Google session delta,
  // validate every current body first, then compare its immutable 6b ancestor to D0.
  const google = proof.reviewedGoogleSessionUat
    ? googleSessionAdmission(proof, readSource, environment) : null;
  for (const [path, pins] of Object.entries(record.sources)) {
    const source = google?.existingSources[path]?.baselineSource ?? readSource(path);
    assert.equal(sha(source), pins.reviewedSha256, path + ': reviewed SEO source drift');
  }
  return record;
}
export function assertReviewedSeoUatSource(file, originalDigest, proof, readSource, environment) {
  const record = seoUatAdmission(proof, readSource, environment).sources[file];
  assert.ok(record, file + ': unreviewed SEO source path');
  assert.equal(record.originalSha256, originalDigest, file + ': original SEO source drift');
  return true;
}
export function assertReviewedSeoUatEvidence(file, originalDigest, proof, readSource, environment) {
  const record = seoUatAdmission(proof, readSource, environment).appendOnlyEvidence[file];
  assert.ok(record, file + ': unreviewed SEO evidence path');
  assert.equal(record.originalSha256, originalDigest, file + ': original evidence seal drift');
  const source = readSource(file);
  assert.equal(sha(source), record.reviewedSha256, file + ': reviewed evidence body drift');
  const insertion = source.slice(record.insertionOffset, record.insertionOffset + record.insertionLength);
  assert.equal(sha(insertion), record.insertionSha256, 'exact reviewed evidence insertion');
  assert.equal(sha(source.slice(0, record.insertionOffset) + source.slice(record.insertionOffset + record.insertionLength)),
    originalDigest, 'removing only the exact reviewed insertion must recover the immutable old evidence');
  return true;
}
