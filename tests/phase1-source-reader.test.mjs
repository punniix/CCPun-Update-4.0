import test from 'node:test';
import assert from 'node:assert/strict';
import { readPhase1Source } from '../qa/read-phase1-source.mjs';

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
