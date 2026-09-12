import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const blogShell = read('features/blog/website-43/Website43Blog.tsx');
const blogInteractive = read('features/blog/website-43/Website43BlogInteractive.tsx');

assert.match(
  blogShell,
  /className=\{styles\.blogHeroImage\}[\s\S]*loading="eager"[\s\S]*fetchPriority="high"/,
  'Blog LCP hero must be eager and explicitly high fetch priority on every viewport',
);
assert.doesNotMatch(
  blogShell,
  /className=\{styles\.blogHeroImage\}[\s\S]{0,400}\bpriority\b/,
  'Blog LCP hero must not rely on the deprecated Next 16 priority prop',
);
assert.match(
  blogInteractive,
  /Object\.getPrototypeOf\(window\.history\)\.replaceState[\s\S]*nativeReplaceState\.call\(window\.history, window\.history\.state, '', url\.pathname \+ url\.search\)/,
  'Blog live search must update ?q= through the native History implementation without triggering App Router navigation',
);
assert.doesNotMatch(
  blogInteractive,
  /window\.history\.replaceState\(/,
  'Blog live search must not go through Next App Router patched replaceState for client-only filtering',
);

console.log('PASS: Blog mobile LCP priority and live-search URL state contracts');
