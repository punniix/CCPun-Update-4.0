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
  /const nativeReplaceState = window\.history\.replaceState;[\s\S]*nativeReplaceState\.call\(window\.history, null, '', `\$\{url\.pathname\}\$\{url\.search\}\$\{url\.hash\}`\)/,
  'Blog live search must use the Next-integrated browser History method without triggering a server navigation',
);
assert.doesNotMatch(
  blogInteractive,
  /Object\.getPrototypeOf\(window\.history\)\.replaceState|router\.replace\(/,
  'Blog live search must not bypass the Next-integrated History method or trigger App Router server navigation',
);

console.log('PASS: Blog mobile LCP priority and live-search URL state contracts');
