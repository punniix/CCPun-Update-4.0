import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { websiteV5C11RenderSuccessors, websiteV5PhaseBRenderGoldens } from './website-v5-phase-a-proof.mjs';
const sha = value => createHash('sha256').update(value).digest('hex');
const serialized = readFileSync(new URL('./website-v5-c17-render-pins.json', import.meta.url), 'utf8');
assert.equal(sha(serialized), '26cb8b4257ac5c86aef6085cfe0507ddc2e27fdd701e3e36ea4e9e3be0c5cb23', 'C17 render pins are immutable reviewed bytes');
const pins = JSON.parse(serialized);
assert.deepEqual(Object.keys(pins), Object.keys(websiteV5C11RenderSuccessors.renders));

// Only the exact complete approved C17 default renders admit the label span. Earlier full
// renders and every historical C11/Phase B pin remain unchanged. CMS edits are never inverted.
export function inverseWebsiteV5C17Dock(html, index) {
  const key = String(index);
  assert.ok(Object.hasOwn(pins, key), 'C17 refuses an unregistered render case');
  const pin = pins[key];
  assert.equal(pin.before, websiteV5C11RenderSuccessors.renders[key].after);
  const actual = sha(html);
  if (actual === pin.before || actual === websiteV5PhaseBRenderGoldens.v5[key]) return html;
  assert.equal(actual, pin.after, 'C17 refuses any unknown full render, including copy, placement or unrelated changes');
  const span = '<span class="triggerLabel">คุยกับปั้นทาง LINE</span>';
  assert.equal(html.split(span).length - 1, 1, 'C17 inverts exactly one unchanged dock label');
  const restored = html.replace(span, 'คุยกับปั้นทาง LINE');
  assert.equal(sha(restored), pin.before, 'C17 restores the full verified predecessor');
  return restored;
}
