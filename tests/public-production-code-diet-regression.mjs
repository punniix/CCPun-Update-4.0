import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const transition = read('components/layout/website-43/Website43TransitionStyles.tsx');
const finalPolish = read('components/layout/website-43/Website43FinalPolishStyles.tsx');

const inlineCss = (source, label) => {
  const match = source.match(/const css = String\.raw`([\s\S]*?)`;\s*\n\s*return/);
  assert.ok(match, `${label} must keep a server-rendered inline CSS boundary`);
  return match[1];
};

const transitionCss = inlineCss(transition, 'Website43TransitionStyles');
const finalPolishCss = inlineCss(finalPolish, 'Website43FinalPolishStyles');

assert.doesNotMatch(
  finalPolishCss,
  /\/\*/,
  'runtime Website 4.3 final-polish CSS must not ship source comments in every public HTML response',
);
assert.doesNotMatch(
  transitionCss,
  /--w43-content-gutter:\s*80px/,
  'desktop content gutter is owned by final polish and must not be duplicated in the transition payload',
);
assert.doesNotMatch(
  transitionCss,
  /top:\s*clamp\(320px,\s*calc\(-33\.3333vw \+ 520px\),\s*390px\)/,
  'superseded mobile tool-hero geometry must not return to the transition payload',
);
assert.match(
  finalPolishCss,
  /\.\$\{styles\.toolHeroImage\}\s*\{[\s\S]*?top:\s*300px;[\s\S]*?height:\s*440px;/,
  'final polish remains the owner of current mobile tool-hero geometry',
);
assert.match(
  finalPolishCss,
  /\.\$\{styles\.root\}\s*\{\s*--w43-content-gutter:\s*var\(--w43-hero-gutter\);/,
  'final polish remains the owner of the mobile content-gutter override',
);

console.log('public production code-diet regression checks passed');
