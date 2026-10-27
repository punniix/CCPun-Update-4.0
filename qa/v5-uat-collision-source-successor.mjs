import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
const sha = value => createHash('sha256').update(value).digest('hex');
const serialized = readFileSync(new URL('./v5-uat-collision-source-pins.json', import.meta.url), 'utf8');
assert.equal(sha(serialized), '3df379a3197c659f8de64450ea196f487c3b71e33a8f268d63972a14725f5f12', 'Reviewed additive collision CSS admission bytes');
export const collisionSourcePins = Object.freeze(JSON.parse(serialized));
// Complete source admission only: unknown bytes remain untouched and fail historical proofs.
export function collisionCssPredecessor(file, source) {
  const pin = Object.hasOwn(collisionSourcePins,file) ? collisionSourcePins[file] : null;
  if (!pin || sha(source) !== pin.after) return source;
  assert.ok(source.endsWith(pin.suffix), 'Only the unique approved CSS suffix can be removed');
  assert.equal(source.split(pin.suffix).length, 2);
  const prior = source.slice(0,-pin.suffix.length);
  assert.equal(sha(prior),pin.before,'Every pre-existing stylesheet byte retained');
  return prior;
}
