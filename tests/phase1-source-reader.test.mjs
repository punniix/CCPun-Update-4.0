import test from 'node:test';
import assert from 'node:assert/strict';
import { readPhase1Source } from '../qa/read-phase1-source.mjs';
import { loadFixtureModule } from '../qa/phase1-fixture-loader.mjs';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

test('source guards follow only current runtime owner imports, preserve changes and stop cycles', () => {
  const sources = new Map([
    ['app/example.ts', 'import { value, type Thing } from "@/lib/one"; import type { Secret } from "@/lib/type-only"; import { type Other } from "@/lib/type-only"; import "../node_modules/private"; export { value } from "@/lib/one";'],
    ['lib/one.ts', 'export { detail } from "./two"; export const value = "actual-current";'],
    ['lib/two.ts', 'export { value } from "./one"; export const detail = "actual-detail";'],
    ['lib/type-only.ts', 'SHOULD_NOT_READ_TYPES'], ['lib/unimported.ts', 'SHOULD_NOT_READ_UNIMPORTED'],
  ]);
  const owners = new Set([...sources.keys()].filter(p => p.startsWith('lib/')));
  const calls = [];
  const options = { owners, read: p => { calls.push(p); assert.ok(sources.has(p), 'unknown/external source must not be read'); return sources.get(p); } };
  const result = readPhase1Source('app/example.ts', options);
  assert.match(result, /actual-current/); assert.match(result, /actual-detail/);
  assert.doesNotMatch(result, /SHOULD_NOT_READ/);
  assert.deepEqual(calls, ['app/example.ts', 'lib/one.ts', 'lib/two.ts']);
  sources.set('lib/one.ts', 'export const value = "changed-current";');
  assert.match(readPhase1Source('app/example.ts', options), /changed-current/);
  for (const file of ['../private.ts', '/private.ts', '.env.local', 'node_modules/private.ts', '.ccpun-private/x.ts']) assert.throws(() => readPhase1Source(file, options), /outside reviewed source/);
});

test('frozen composition projection rejects entry, owner and original-fixture tampering and leaves unlisted source current', () => {
  const sha = value => createHash('sha256').update(value).digest('hex');
  const proof = { compositions: { 'app/reviewed.ts': { candidateSha256: sha('CURRENT_ENTRY'), baselineSha256: sha('ORIGINAL_ENTRY') } }, owners: { 'lib/reviewed.ts': sha('CURRENT_OWNER') }, baselineSources: { 'app/reviewed.ts': 'ORIGINAL_ENTRY' } };
  const files = new Map([['app/reviewed.ts', 'CURRENT_ENTRY'], ['lib/reviewed.ts', 'CURRENT_OWNER'], ['app/unlisted.ts', 'CURRENT_UNLISTED']]);
  const source = readFileSync(new URL('../qa/phase1-source-proof.mjs', import.meta.url), 'utf8').replaceAll('import.meta.url', '"file:///virtual/qa/phase1-source-proof.mjs"');
  const { productionBaselineSource: project } = loadFixtureModule('qa/phase1-source-proof.mjs', { sources: new Map([['qa/phase1-source-proof.mjs', source]]), mocks: new Map([['./phase2-source-proof.mjs', { hasReviewedMasterUatOwner: () => false, assertReviewedMasterUatOwner: () => assert.fail('synthetic paths must never use a real UAT admission') }], ['node:fs', { readFileSync: url => { const file = url.pathname.replace('/virtual/', ''); return file === 'qa/phase1-source-ownership.json' ? JSON.stringify(proof) : files.get(file); } }]]) });
  assert.equal(project('app/reviewed.ts'), 'ORIGINAL_ENTRY');
  assert.equal(project('app/unlisted.ts'), 'CURRENT_UNLISTED');
  files.set('app/reviewed.ts', 'UNREVIEWED_ENTRY');
  assert.throws(() => project('app/reviewed.ts'), /unreviewed route composition/);
  files.set('app/reviewed.ts', 'CURRENT_ENTRY'); files.set('lib/reviewed.ts', 'UNREVIEWED_OWNER');
  assert.throws(() => project('app/reviewed.ts'), /shared owner changed/);
  files.set('lib/reviewed.ts', 'CURRENT_OWNER'); proof.baselineSources['app/reviewed.ts'] = 'INCORRECT_ORIGINAL';
  assert.throws(() => project('app/reviewed.ts'), /original Production fixture drift/);
});

test('every frozen entry has a registered original-output fixture and every sealed owner is actually reachable', () => {
  const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
  const proof = JSON.parse(read('qa/phase1-source-ownership.json'));
  const originalApi = JSON.parse(read('qa/phase1-admin-api-parity.json')).originalSources;
  const packageScripts = JSON.parse(read('package.json')).scripts;
  function assertCoverage(candidate) {
    assert.deepEqual(Object.keys(candidate.outputCoverage).sort(), Object.keys(candidate.compositions).sort(), 'no admitted entry may lack output coverage');
    for (const [entry, coverage] of Object.entries(candidate.outputCoverage)) {
      assert.ok(packageScripts['test:foundation-contracts'].includes(coverage.test), entry + ': output test must be registered in CI');
      const testSource = read(coverage.test);
      if (coverage.fixture === 'qa/phase1-admin-api-parity.json') assert.equal(originalApi[entry], candidate.baselineSources[entry], entry + ': actual original API/boundary fixture');
      else assert.equal(coverage.fixture, 'qa/phase1-source-ownership.json', entry + ': reviewed source fixture');
      if (coverage.case.startsWith(entry + ':')) {
        assert.ok(candidate.sharedPages.some(page => page.root === entry || page.canonical === entry), entry + ': actual shared-page execution loop');
        assert.ok(testSource.includes('for (const page of proof.sharedPages)') && testSource.includes('for (const file of [page.root, page.canonical])'));
      } else assert.ok(testSource.includes(coverage.case), entry + ': actual named output case');
    }
  }
  assertCoverage(proof);
  const missing = structuredClone(proof); delete missing.outputCoverage[Object.keys(missing.compositions)[0]];
  assert.throws(() => assertCoverage(missing), /no admitted entry may lack output coverage/);
  const reached = new Set();
  for (const entry of Object.keys(proof.compositions)) readPhase1Source(entry, { read: file => { reached.add(file); return read(file); } });
  assert.deepEqual(Object.keys(proof.owners).filter(owner => !reached.has(owner)), [], 'only actual current runtime imports may cover sealed owners');
  assert.equal(Object.keys(proof.compositions).length, 45);
  assert.equal(Object.keys(proof.owners).length, 24); // 23 new owners + existing canonical Studio client.
});
