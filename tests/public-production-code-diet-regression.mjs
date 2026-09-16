import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';

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

// Phase 2 discovery audit. This is intentionally conservative: a selector is only
// reported when it has no textual runtime consumer anywhere in application source.
const trackedFiles = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);
const runtimeRoots = ['app/', 'components/', 'features/', 'hooks/', 'lib/', 'types/'];
const runtimeExtensions = new Set(['.js', '.jsx', '.mjs', '.ts', '.tsx']);
const runtimeFiles = trackedFiles.filter((file) =>
  runtimeRoots.some((root) => file.startsWith(root)) && runtimeExtensions.has(extname(file)),
);
const runtimeSources = runtimeFiles.map((file) => [file, read(file)]);

const extractClassSelectors = (css) => {
  const names = new Set();
  for (const match of css.matchAll(/\.([A-Za-z_][A-Za-z0-9_-]*(?:\\\/[A-Za-z0-9._-]+)?)/g)) {
    names.add(match[1].replaceAll('\\/', '/'));
  }
  return [...names].sort();
};

const globalCss = read('app/components.css');
const globalSelectors = extractClassSelectors(globalCss);
const unusedGlobal = globalSelectors.filter((selector) =>
  !runtimeSources.some(([, source]) => source.includes(selector)),
);

const website43Path = 'components/layout/website-43/Website43.module.css';
const website43Css = read(website43Path);
const website43Selectors = extractClassSelectors(website43Css);
const website43Importers = runtimeSources.filter(([, source]) => source.includes('Website43.module.css'));
const unusedWebsite43 = website43Selectors.filter((selector) =>
  !website43Importers.some(([, source]) =>
    source.includes(`styles.${selector}`)
    || source.includes(`styles['${selector}']`)
    || source.includes(`styles[\"${selector}\"]`),
  ),
);

console.log(`CSS_USAGE_AUDIT global total=${globalSelectors.length} unused=${unusedGlobal.length}`);
console.log(`CSS_USAGE_AUDIT global candidates=${JSON.stringify(unusedGlobal)}`);
console.log(`CSS_USAGE_AUDIT website43 total=${website43Selectors.length} importers=${website43Importers.length} unused=${unusedWebsite43.length}`);
console.log(`CSS_USAGE_AUDIT website43 candidates=${JSON.stringify(unusedWebsite43)}`);
console.log('public production code-diet regression checks passed');
