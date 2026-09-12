import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const layout = read('app/layout.tsx');

assert.match(
  layout,
  /preload:\s*false/,
  'Kanit must not preload every Thai and Latin weight ahead of the Home LCP image',
);
assert.match(
  layout,
  /const isDraftMode = IS_DRAFT_PREVIEW_ALLOWED \? \(await draftMode\(\)\)\.isEnabled : false;/,
  'Public web must not read Draft Mode when Draft Preview is unavailable',
);
assert.match(
  layout,
  /\{IS_DRAFT_PREVIEW_ALLOWED \? <SanityLive includeDrafts=\{isDraftMode\} \/> : null\}/,
  'Sanity Live must stay confined to environments that support Draft Preview',
);
assert.doesNotMatch(
  layout,
  /^\s*<SanityLive includeDrafts=/m,
  'Sanity Live must never mount unconditionally on the public shell',
);

console.log('Public shell performance regression checks passed.');
