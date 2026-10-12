import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { reviewedCompositionSource, productionBaselineSource } from '../qa/phase1-source-proof.mjs';
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
    assert.equal(sha(read(file)), record.candidateSha256, file);
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
