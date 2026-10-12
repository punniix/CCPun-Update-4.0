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
  const { productionBaselineSource: project } = loadFixtureModule('qa/phase1-source-proof.mjs', { sources: new Map([['qa/phase1-source-proof.mjs', source]]), mocks: new Map([['node:fs', { readFileSync: url => { const file = url.pathname.replace('/virtual/', ''); return file === 'qa/phase1-source-ownership.json' ? JSON.stringify(proof) : files.get(file); } }]]) });
  assert.equal(project('app/reviewed.ts'), 'ORIGINAL_ENTRY');
  assert.equal(project('app/unlisted.ts'), 'CURRENT_UNLISTED');
  files.set('app/reviewed.ts', 'UNREVIEWED_ENTRY');
  assert.throws(() => project('app/reviewed.ts'), /unreviewed route composition/);
  files.set('app/reviewed.ts', 'CURRENT_ENTRY'); files.set('lib/reviewed.ts', 'UNREVIEWED_OWNER');
  assert.throws(() => project('app/reviewed.ts'), /shared owner changed/);
  files.set('lib/reviewed.ts', 'CURRENT_OWNER'); proof.baselineSources['app/reviewed.ts'] = 'INCORRECT_ORIGINAL';
  assert.throws(() => project('app/reviewed.ts'), /original Production fixture drift/);
});
