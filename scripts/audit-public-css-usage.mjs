import { readFileSync } from 'node:fs';
import {
  entryFiles,
  reachable,
  reachableSources,
  runtimeFiles,
  trackedFiles,
  trackedFileSet,
} from './lib/public-reachability.mjs';

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function normalizeCssIdentifier(value) {
  return value.replace(/\\(.)/g, '$1');
}

function extractClasses(css) {
  const classes = new Set();
  const source = stripComments(css);
  for (const match of source.matchAll(/\.([A-Za-z_-](?:\\.|[A-Za-z0-9_-])*)/g)) {
    classes.add(normalizeCssIdentifier(match[1]));
  }
  return [...classes].sort();
}

function hasLiteralReachableUsage(className) {
  return reachableSources.some(([, source]) => source.includes(className));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const globalsSource = readFileSync('components/styles/global-foundation.css', 'utf8');
const globalStylesheets = [
  { path: 'components/styles/public-compat.css', role: 'base' },
  { path: 'components/styles/public-motion.css', role: 'base' },
  { path: 'features/financial-health-check/styles/print.css', role: 'contextual' },
];
const requiredGlobalImports = [
  '@import "./public-compat.css";',
  '@import "./public-motion.css";',
  '@import "../../features/financial-health-check/styles/print.css";',
];
const requiredTailwindSources = [
  '@source "../../components";',
  '@source "../../features";',
];

// Next builds each app from its own directory; preserve automatic app discovery.
// Shared render owners stay explicit, while historical fixtures never become CSS.
if (!globalsSource.startsWith('@import "tailwindcss";')) {
  throw new Error('Preserve Tailwind native app-directory discovery.');
}
const positiveSources = [...globalsSource.matchAll(/@source "([^"\n]+)";/g)].map(([, owner]) => owner);
if (JSON.stringify(positiveSources) !== JSON.stringify(['../../components', '../../features'])) {
  throw new Error('Only the original shared render owners may extend native app CSS discovery.');
}
for (const directory of ['qa', 'tests', 'docs', 'scripts']) {
  if (!globalsSource.includes(`@source not "../../${directory}";`)) {
    throw new Error(`Historical CSS discovery must exclude ${directory}`);
  }
}

for (const requiredImport of requiredGlobalImports) {
  if (!globalsSource.includes(requiredImport)) {
    throw new Error(`components/styles/global-foundation.css must keep explicit style ownership import: ${requiredImport}`);
  }
}
for (const requiredSource of requiredTailwindSources) {
  if (!globalsSource.includes(requiredSource)) {
    throw new Error(`components/styles/global-foundation.css must keep shared Tailwind source coverage: ${requiredSource}`);
  }
}
if (trackedFileSet.has('app/components.css') || globalsSource.includes('./components.css')) {
  throw new Error('Do not recreate the generic app/components.css style bucket; use an explicit owner stylesheet.');
}

const globalClassOwners = new Map();
for (const stylesheet of globalStylesheets) {
  if (!trackedFileSet.has(stylesheet.path)) throw new Error(`Missing owned global stylesheet: ${stylesheet.path}`);
  const css = readFileSync(stylesheet.path, 'utf8');
  for (const className of extractClasses(css)) {
    const owners = globalClassOwners.get(className) ?? [];
    owners.push(stylesheet);
    globalClassOwners.set(className, owners);
  }
}

const globalUnused = [...globalClassOwners.keys()].filter((className) => !hasLiteralReachableUsage(className));
const duplicateBaseOwners = [...globalClassOwners.entries()].filter(([, owners]) => owners.filter((owner) => owner.role === 'base').length > 1);
const orphanContextualOverrides = [...globalClassOwners.entries()].filter(([, owners]) => {
  const hasContextual = owners.some((owner) => owner.role === 'contextual');
  const hasBase = owners.some((owner) => owner.role === 'base');
  return hasContextual && !hasBase;
});

const moduleCssPath = 'components/layout/website-43/Website43.module.css';
const moduleCss = readFileSync(moduleCssPath, 'utf8');
const moduleClasses = extractClasses(moduleCss);
const globalModuleClasses = new Set(
  [...moduleCss.matchAll(/:global\(([^)]+)\)/g)].flatMap(([, selector]) => extractClasses(selector)),
);
const moduleImporters = [];
for (const [file, source] of reachableSources) {
  const importPattern = /import\s+([A-Za-z_$][\w$]*)\s+from\s+['"][^'"]*Website43\.module\.css['"]/g;
  for (const match of source.matchAll(importPattern)) {
    moduleImporters.push({ file, alias: match[1], source });
  }
}

const dynamicModuleAccess = moduleImporters.filter(({ alias, source }) =>
  new RegExp(`${alias}\\s*\\[\\s*(?!['"])`).test(source),
);

function hasModuleUsage(className) {
  const escaped = escapeRegExp(className);
  for (const { alias, source } of moduleImporters) {
    const dot = new RegExp(`${alias}\\.${escaped}\\b`);
    const bracket = new RegExp(`${alias}\\s*\\[\\s*['"]${escaped}['"]\\s*\\]`);
    if (dot.test(source) || bracket.test(source)) return true;
  }
  return globalModuleClasses.has(className) && hasLiteralReachableUsage(className);
}

// Website v5 Phase B (UAT prototype): the shared article widgets (reading time, share
// controls, table access) moved to their own v5 stylesheet so v5 pages stop loading the
// 68 KB 4.3 module. Only these exact classes are admitted, and only while the v5 owner
// defines each one and a reachable widget source still references it.
const websiteV5MovedWidgetOwner = 'features/blog/v5/ArticleWidgets.module.css';
const websiteV5MovedWidgetClasses = Object.freeze([
  'articleReadingEstimate', 'articleReadingTime', 'articleShareButton', 'articleShareButtons', 'articleShareControls',
  'articleShareLabel', 'articleShareStatus', 'articleTableTrack', 'articleTableViewport', 'articleTableWrap', 'tableHint',
]);
const movedWidgetCss = readFileSync(websiteV5MovedWidgetOwner, 'utf8');
const movedWidgetClasses = new Set(extractClasses(movedWidgetCss));
function hasMovedWidgetUsage(className) {
  if (!websiteV5MovedWidgetClasses.includes(className) || !movedWidgetClasses.has(className)) return false;
  return [...reachableSources].some(([, source]) => source.includes('ArticleWidgets.module.css') && new RegExp(`styles\\.${escapeRegExp(className)}\\b`).test(source));
}

const moduleUnused = dynamicModuleAccess.length === 0
  ? moduleClasses.filter((className) => !hasModuleUsage(className) && !hasMovedWidgetUsage(className))
  : [];

const styleOwnerFiles = trackedFiles
  .filter((file) => /^components\/layout\/website-43\/Website43.*Styles\.tsx$/.test(file))
  .sort();
const canonicalResponsiveOwner = 'components/layout/website-43/Website43ResponsiveStyles.tsx';
const retiredResponsiveOwners = [
  'components/layout/website-43/Website43FinalPolishStyles.tsx',
  'components/layout/website-43/Website43TransitionStyles.tsx',
];
const unexpectedStyleOwners = styleOwnerFiles.filter((file) => file !== canonicalResponsiveOwner);
const layoutSource = readFileSync('apps/web/app/layout.tsx', 'utf8');

console.log('PUBLIC_STYLE_OWNERSHIP_AUDIT');
console.log(`runtime_files=${runtimeFiles.length}`);
console.log(`route_entries=${entryFiles.length}`);
console.log(`reachable_runtime_files=${reachable.size}`);
console.log(`owned_global_stylesheets=${globalStylesheets.length}`);
console.log(`global_class_selectors=${globalClassOwners.size}`);
console.log(`global_zero_reachable_reference=${globalUnused.length}`);
console.log(`global_duplicate_base_owners=${duplicateBaseOwners.length}`);
console.log(`global_orphan_contextual_overrides=${orphanContextualOverrides.length}`);
console.log(`website43_module_classes=${moduleClasses.length}`);
console.log(`website43_importers=${moduleImporters.length}`);
console.log(`website43_dynamic_access=${dynamicModuleAccess.length}`);
console.log(`website43_zero_reachable_reference=${moduleUnused.length}`);
console.log(`website43_responsive_style_owners=${styleOwnerFiles.length}`);
console.log('WEBSITE43_ZERO_REFERENCE_START');
for (const className of moduleUnused) console.log(className);
console.log('WEBSITE43_ZERO_REFERENCE_END');

if (globalUnused.length > 0) {
  throw new Error(`Owned global CSS has ${globalUnused.length} class selector(s) with no reachable runtime reference: ${globalUnused.join(', ')}`);
}
if (duplicateBaseOwners.length > 0) {
  const detail = duplicateBaseOwners
    .map(([name, owners]) => `${name}: ${owners.filter((owner) => owner.role === 'base').map((owner) => owner.path).join(' + ')}`)
    .join('; ');
  throw new Error(`Global base class ownership is ambiguous: ${detail}`);
}
if (orphanContextualOverrides.length > 0) {
  const detail = orphanContextualOverrides
    .map(([name, owners]) => `${name}: ${owners.filter((owner) => owner.role === 'contextual').map((owner) => owner.path).join(' + ')}`)
    .join('; ');
  throw new Error(`Contextual global overrides must point to an existing base-owned class: ${detail}`);
}
if (dynamicModuleAccess.length > 0) {
  throw new Error('Website43.module.css uses dynamic property access; static ownership auditing is no longer safe.');
}
if (moduleUnused.length > 0) {
  throw new Error(`Website43.module.css has ${moduleUnused.length} class selector(s) with no reachable runtime reference: ${moduleUnused.join(', ')}`);
}
if (!trackedFileSet.has(canonicalResponsiveOwner) || unexpectedStyleOwners.length > 0 || styleOwnerFiles.length !== 1) {
  throw new Error(`Website 4.3 responsive runtime must have one owner only: ${canonicalResponsiveOwner}. Found: ${styleOwnerFiles.join(', ')}`);
}
for (const retiredOwner of retiredResponsiveOwners) {
  if (trackedFileSet.has(retiredOwner)) throw new Error(`Retired responsive patch owner must stay removed: ${retiredOwner}`);
}
// Website v5 Phase B: every public route renders the v5 shell, so the root layout no longer mounts
// the 4.3 responsive owner (it shipped the whole 68 KB 4.3 module to every page). The owner stays
// canonical for the retained 4.3 presentation; no retired owner may come back either.
if (layoutSource.includes('Website43ResponsiveStyles') || retiredResponsiveOwners.some((file) => layoutSource.includes(file.split('/').at(-1).replace('.tsx', '')))) {
  throw new Error('apps/web/app/layout.tsx must not mount Website 4.3 responsive runtime CSS in the v5 shell.');
}
