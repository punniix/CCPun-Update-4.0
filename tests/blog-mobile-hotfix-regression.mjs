import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const blogShell = read('features/blog/website-43/Website43Blog.tsx');
const blogInteractive = read('features/blog/website-43/Website43BlogInteractive.tsx');
const website43Styles = read('components/layout/website-43/Website43.module.css');

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

assert.match(
  website43Styles,
  /\/\* Website 4\.3 Blog hero responsive seam guard \*\/[\s\S]*?\.blogHeroImage\s*\{[\s\S]*?width:\s*max\(860px,\s*60vw\);[\s\S]*?mask-image:\s*linear-gradient\(90deg,[\s\S]*?#000 20%\);/,
  'Blog desktop hero must keep the locked left-edge image fade so the portrait does not render with a hard vertical seam',
);
assert.match(
  website43Styles,
  /\.blogHeroGradient\s*\{[\s\S]*?background:\s*\n\s*linear-gradient\(\s*\n\s*180deg,[\s\S]*?rgba\(37,24,24,1\) 0%[\s\S]*?rgba\(37,24,24,\.88\) 8%[\s\S]*?rgba\(37,24,24,0\) 48%[\s\S]*?\),\s*\n\s*linear-gradient\(\s*\n\s*90deg,/,
  'Blog desktop hero must keep a continuous top fade layered over the horizontal blend so the top-right photo edge cannot reappear',
);
assert.match(
  website43Styles,
  /@media \(max-width: 639px\)[\s\S]*?\.blogHeroImage\s*\{[\s\S]*?-webkit-mask-image:\s*none;[\s\S]*?mask-image:\s*none;/,
  'Blog mobile hero must disable the desktop horizontal mask',
);

console.log('PASS: Blog mobile LCP, live-search URL state, and hero seam contracts');
