import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
const sha = value => createHash('sha256').update(value).digest('hex');
const serialized = readFileSync(new URL('./website-v5-c14-render-pins.json', import.meta.url), 'utf8');
assert.equal(sha(serialized), "a5e3bf5e49a6f92e10ac7f49bf28935161863265b5d720583d6097ec441a1890", 'C14 pins retain reviewed bytes');
export const websiteV5C14RenderPins = Object.freeze(JSON.parse(serialized));

/** Default fixtures only: admit a complete successor, invert exact approved DOM, verify the whole predecessor. */
export function inverseWebsiteV5C14(html, key) {
  assert.ok(Object.hasOwn(websiteV5C14RenderPins, key), 'C14 refuses unregistered render case');
  const pin = websiteV5C14RenderPins[key];
  if (sha(html) === pin.before) return html;
  assert.equal(sha(html), pin.after, 'C14 refuses unknown full render, including CMS edits and moved fragments');
  let restored = html;
  for (const [current, previous, count] of pin.edits) {
    assert.equal(restored.split(current).length - 1, count, 'C14 exact approved fragment count');
    restored = restored.replaceAll(current, previous);
  }
  assert.equal(sha(restored), pin.before, 'C14 reconstructs the entire predecessor');
  return restored;
}

/** The single owner-approved fallback label, with all other source bytes pinned. */
export function inverseWebsiteV5C14Copy(file, source) {
  if (file !== 'lib/content/site-copy-defaults.ts' || sha(source) !== "b35af3b81c3a50bf5c191dc445bb9a4f75915ea1cabaec5bb08a4a173f921328") return source;
  const current = '  "site.footer.about": "รู้จักปั้น",';
  assert.equal(source.split(current).length - 1, 1);
  const restored = source.replace(current, '  "site.footer.about": "เกี่ยวกับ Pun",');
  assert.equal(sha(restored), "d7cccd7984470aebb6b0496dade74d37a82bfd779e1b0be46620a1fb6a89fba0");
  return restored;
}
