import { inverseEyebrowHtml } from "./v5-eyebrow-html.mjs";
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { websiteV5C11RenderSuccessors, websiteV5PhaseBRenderGoldens } from './website-v5-phase-a-proof.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
const serialized = readFileSync(new URL('./website-v5-c11-header-fixtures.json', import.meta.url), 'utf8');
assert.equal(sha(serialized), websiteV5C11RenderSuccessors.fixtureSha256, 'C11 header fixtures are immutable reviewed bytes');
const fixtures = JSON.parse(serialized);
assert.deepEqual(Object.keys(fixtures).sort(), Object.keys(websiteV5C11RenderSuccessors.renders).sort(), 'C11 has exactly the five existing shell cases');

/** Only default-shell golden assertions use this inverse. CMS edits keep their actual render. */
export function inverseWebsiteV5C11Header(html, index) {
  html = inverseEyebrowHtml(html, index);
  const key = String(index);
  assert.ok(Object.hasOwn(websiteV5C11RenderSuccessors.renders, key), 'C11 refuses an unregistered render case');
  const pin = websiteV5C11RenderSuccessors.renders[key];
  assert.equal(pin.before, websiteV5PhaseBRenderGoldens.v5[key], 'C11 predecessor is the unchanged Phase B golden');
  const actual = sha(html);
  if (actual === pin.before) return html;
  assert.equal(actual, pin.after, 'C11 refuses any unknown full render, including CMS, placement or unrelated changes');
  const { predecessorHeader, successorHeader } = fixtures[key];
  assert.equal(html.split(successorHeader).length - 1, 1, 'C11 replaces exactly one complete bound header');
  assert.equal((html.match(/<header\b[^>]*data-v5-header=""/g) ?? []).length, 1, 'C11 refuses duplicate shell headers');
  const restored = html.replace(successorHeader, predecessorHeader);
  assert.equal(sha(restored), pin.before, 'C11 restores the entire verified predecessor, not a guessed hash');
  return restored;
}
