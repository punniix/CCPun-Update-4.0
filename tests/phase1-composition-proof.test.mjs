import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { reviewedCompositionSource, productionBaselineSource, inheritedUatSourceDigest, assertInheritedUatFixtureSources, assertInheritedUatOutput, assertReviewedUatRetention } from '../qa/phase1-source-proof.mjs';
import { readPhase1Source } from '../qa/read-phase1-source.mjs';
const sha = value => createHash('sha256').update(value).digest('hex');
const read = file => readFileSync(file, 'utf8');
const proof = JSON.parse(read('qa/phase1-source-ownership.json'));

test('reviewed composition projection rejects entry, owner, baseline and coverage tampering; unlisted paths read actual current source', () => {
  const source = new Map([['route.ts', 'new route'], ['owner.ts', 'actual owner'], ['unlisted.ts', 'actual current']]);
  const fixture = { compositions: { 'route.ts': { candidateSha256: sha('new route'), baselineSha256: sha('original route') } }, owners: { 'owner.ts': sha('actual owner') }, baselineSources: { 'route.ts': 'original route' }, coverage: { 'route.ts': ['actual old/current fixture'] } };
  const current = p => source.get(p);
  assert.equal(reviewedCompositionSource('route.ts', fixture, current), 'original route');
  source.set('route.ts', 'tampered route');
  assert.throws(() => reviewedCompositionSource('route.ts', fixture, current), /unreviewed route/);
  source.set('route.ts', 'new route'); source.set('owner.ts', 'tampered owner');
  assert.throws(() => reviewedCompositionSource('route.ts', fixture, current), /shared owner changed/);
  source.set('owner.ts', 'actual owner'); fixture.baselineSources['route.ts'] = 'tampered original';
  assert.throws(() => reviewedCompositionSource('route.ts', fixture, current), /original Production fixture drift/);
  fixture.baselineSources['route.ts'] = 'original route'; fixture.coverage['route.ts'] = [];
  assert.throws(() => reviewedCompositionSource('route.ts', fixture, current), /missing registered output coverage/);
  assert.equal(reviewedCompositionSource('unlisted.ts', fixture, current), 'actual current');
  source.set('unlisted.ts', 'changed current');
  assert.equal(reviewedCompositionSource('unlisted.ts', fixture, current), 'changed current');
});

test('every admitted source has exact original and current hashes, registered output coverage, and real shared owners are reachable', () => {
  const owners = new Set(Object.keys(proof.owners));
  const reached = new Set();
  assert.ok(Object.keys(proof.compositions).length > 0, 'must seal actual authorized compositions');
  for (const [file, record] of Object.entries(proof.compositions)) {
    assert.equal(sha(read(file)), inheritedUatSourceDigest(file, record.candidateSha256, proof), file);
    assert.equal(sha(proof.baselineSources[file]), record.baselineSha256, file);
    assert.notEqual(record.candidateSha256, record.baselineSha256, file + ': no no-op projection');
    for (const suite of proof.coverage[file]) assert.ok(read(suite.file).includes(suite.title), file + ': registered actual fixture missing');
    assert.equal(productionBaselineSource(file), proof.baselineSources[file]);
    const current = readPhase1Source(file, { owners });
    for (const owner of owners) if (current.includes('/* current imported owner: ' + owner + ' */')) reached.add(owner);
  }
  assert.deepEqual([...reached].sort(), [...owners].sort(), 'every new owner must have an actual entry import consumer');
  assert.equal(productionBaselineSource('apps/admin/scripts/build-provider.mjs'), read('apps/admin/scripts/build-provider.mjs'), 'unlisted SWC driver reads actual bytes');
});

test('inherited C645 admission rejects unknown commits, hashes, owner bodies, environments and output changes', () => {
  assertInheritedUatFixtureSources(proof, read);
  const admission = proof.reviewedInheritedUat;
  assert.equal(admission.sourceCommit, 'c64540ec7bd31c9380880173a03d996902b23b64');
  assert.equal(Object.keys(admission.sourceDigests).length, 8);
  assert.equal(Object.keys(admission.outputs).length, 180);
  for (const mutate of [
    p => { p.reviewedInheritedUat.sourceCommit = 'unknown'; },
    p => { p.reviewedInheritedUat.sourceDigests['unknown.ts'] = { originalSha256: 'unknown', c645Sha256: 'unknown' }; },
    p => { Object.values(p.reviewedInheritedUat.sourceDigests)[0].c645Sha256 = 'unknown'; },
    p => { Object.values(p.reviewedInheritedUat.sourceDigests)[0].originalSha256 = 'unknown'; },
    p => { Object.values(p.reviewedInheritedUat.outputs)[0].c645OutputSha256 = 'unknown'; },
    p => { p.owners[Object.keys(p.owners)[0]] = 'unknown'; },
    p => { p.baselineSources[Object.keys(p.baselineSources)[0]] += 'tampered'; },
  ]) {
    const tampered = structuredClone(proof); mutate(tampered);
    assert.throws(() => assertInheritedUatFixtureSources(tampered, read), /proof drift|admission/);
  }
  const owner = Object.keys(admission.sourceDigests)[0];
  assert.throws(() => assertInheritedUatFixtureSources(proof, file => read(file) + (file === owner ? 'tampered' : '')), /owner body/);
  const firstKey = JSON.parse(Object.keys(admission.outputs)[0]);
  assert.throws(() => assertInheritedUatOutput({}, {}, { ...firstKey, environment: 'unknown-lane' }, proof), /unregistered/);
  assert.throws(() => assertInheritedUatOutput({ trace: ['tampered'] }, { trace: [] }, firstKey, proof), /non-DOM invariant/);
  assert.throws(() => assertInheritedUatOutput({}, {}, firstKey, proof), /Production output drift/);
});

test('explicit Admin UAT retention admits only sixteen C645 and three reviewed PR418 bodies; rejects unknown environment, source, original digest and admission tampering', () => {
  const records = proof.reviewedInheritedUat.retainedSources;
  const c645 = 'c64540ec7bd31c9380880173a03d996902b23b64', f008 = 'f0081b17a3a6ed86976597a248fc7c2bc697c70d';
  assert.equal(Object.keys(records).length, 19);
  assert.equal(Object.values(records).filter(record => record.sourceCommit === c645).length, 16);
  assert.equal(Object.values(records).filter(record => record.sourceCommit === f008).length, 3);
  for (const [file, record] of Object.entries(records)) {
    assert.equal(record.originalSha256, proof.protected[file], 'original protected map remains frozen');
    assert.equal(record.sourceCommit === c645, record.candidateSha256 === record.c645Sha256, 'inherited source equality is explicit; PR418 safety is distinct');
    assert.equal(assertReviewedUatRetention(file, proof.protected[file], proof, read, 'admin-uat'), true);
  }
  const file = Object.keys(records)[0], original = proof.protected[file];
  for (const environment of ['production-admin', 'local-production', 'web-uat', 'unknown', undefined]) {
    assert.throws(() => assertReviewedUatRetention(file, original, proof, read, environment), /environment/);
  }
  assert.throws(() => assertReviewedUatRetention('unknown.ts', original, proof, read, 'admin-uat'), /unreviewed UAT retained source/);
  assert.throws(() => assertReviewedUatRetention(file, 'unknown', proof, read, 'admin-uat'), /original protected digest/);
  assert.throws(() => assertReviewedUatRetention(file, original, proof, path => read(path) + 'tampered', 'admin-uat'), /retained body/);
  for (const field of ['sourceCommit', 'originalSha256', 'c645Sha256', 'candidateSha256']) {
    const tampered = structuredClone(proof); tampered.reviewedInheritedUat.retainedSources[file][field] = 'unknown';
    assert.throws(() => assertReviewedUatRetention(file, original, tampered, read, 'admin-uat'), /admission/);
  }
  const tampered = structuredClone(proof); tampered.reviewedInheritedUat.retainedSources['unknown.ts'] = records[file];
  assert.throws(() => assertReviewedUatRetention(file, original, tampered, read, 'admin-uat'), /admission/);
});
