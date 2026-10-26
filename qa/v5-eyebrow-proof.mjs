import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
const sha = value => createHash('sha256').update(value).digest('hex');
const serialized = readFileSync(new URL('./v5-eyebrow-source-successors.json', import.meta.url), 'utf8');
assert.equal(sha(serialized), '695d2447de5b19e9637cf9bb689b4e854dcfe84159ebf3520f85a07941ff27d0', 'C15 reviewed replacements immutable');
export const eyebrowSourceSuccessors = JSON.parse(serialized);
/** Exact source inverse, before the existing C8/C6/CMS/Phase B normalizers. No test-source substitution. */
export function eyebrowPredecessor(file, source) {
  const pin = Object.hasOwn(eyebrowSourceSuccessors, file) ? eyebrowSourceSuccessors[file] : null;
  if (!pin || sha(source) === pin.before) return source;
  if (sha(source) !== pin.after) return source;
  for (const [index, [before, after]] of [...pin.replacements.entries()].reverse()) {
    if (after) {
      assert.equal(source.split(after).length, 2, file + ': exactly one bound replacement');
      source = source.replace(after, before);
    } else {
      // The reviewed byte offset is part of the immutable exact-source manifest.
      // Splice the removed node into the actual successor, then check the complete predecessor.
      const offset = pin.removalOffsets[index];
      assert.ok(Number.isInteger(offset) && offset >= 0 && offset <= source.length);
      source = source.slice(0, offset) + before + source.slice(offset);
    }
  }
  assert.equal(sha(source), pin.before, file + ': every other predecessor byte retained');
  return source;
}
