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

const globalsSource = readFileSync('app/globals.css', 'utf8');
const ownedGlobalCssPaths = [
  'components/styles/public-compat.css',
  'components/styles/public-motion.css',
  'features/financial-health-check/styles/print.css',
];
const requiredGlobalImports = [
  '@import "../components/styles/public-compat.css";',
  '@import "../components/styles/public-motion.css";',
  '@import "../features/financial-health-check/styles/print.css";',
];

for (const requiredImport of requiredGlobalImports) {
  if (!globalsSource.includes(requiredImport)) {
    throw new Error(`app/globals.css must keep explicit style ownership import: ${requiredImport}`);
  }
}
if (trackedFileSet.has('app/components.css') || globalsSource.includes('./components.css')) {
  throw new Error('Do not recreate the generic app/components.css style bucket; use an explicit owner stylesheet.');
}

const globalClassOwners = new Map();
for (const cssPath of ownedGlobalCssPaths) {
  if (!trackedFileSet.has(cssPath)) throw new Error(`Missing owned global stylesheet: ${cssPath}`);
  const css = readFileSync(cssPath, 'utf8');
  for (const className of extractClasses(css)) {
    const owners = globalClassOwners.get(className) ?? [];
    owners.push(cssPath);
    globalClassOwners.set(className, owners);
  }
}
const globalUnused = [...globalClassOwners.keys()].filter((className) => !hasLiteralReachableUsage(className));
const duplicateGlobalOwners = [...globalClassOwners.entries()].filter(([, owners]) => owners.length > 1);

const moduleCssPath = 'components/layout/website-43/Website43.module.css';
const moduleCss = readFileSync(moduleCssPath, 'utf8');
const moduleClasses = extractClasses(moduleCss);
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
  return hasLiteralReachableUsage(className);
}

const moduleUnused = dynamicModuleAccess.length === 0
  ? moduleClasses.filter((className) => !hasModuleUsage(className))
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
const layoutSource = readFileSync('app/layout.tsx', 'utf8');

console.log('PUBLIC_STYLE_OWNERSHIP_AUDIT');
console.log(`runtime_files=${runtimeFiles.length}`);
console.log(`route_entries=${entryFiles.length}`);
console.log(`reachable_runtime_files=${reachable.size}`);
console.log(`owned_global_stylesheets=${ownedGlobalCssPaths.length}`);
console.log(`global_class_selectors=${globalClassOwners.size}`);
console.log(`global_zero_reachable_reference=${globalUnused.length}`);
console.log(`global_duplicate_owners=${duplicateGlobalOwners.length}`);
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
if (duplicateGlobalOwners.length > 0) {
  const detail = duplicateGlobalOwners.map(([name, owners]) => `${name}: ${owners.join(' + ')}`).join('; ');
  throw new Error(`Global class ownership is ambiguous: ${detail}`);
}
if (dynamicModuleAccess.length > 0) {
  throw new Error('Website43.module.css uses dynamic property access; static ownership auditing is no longer safe.');
}
if (!trackedFileSet.has(canonicalResponsiveOwner) || unexpectedStyleOwners.length > 0 || styleOwnerFiles.length !== 1) {
  throw new Error(`Website 4.3 responsive runtime must have one owner only: ${canonicalResponsiveOwner}. Found: ${styleOwnerFiles.join(', ')}`);
}
for (const retiredOwner of retiredResponsiveOwners) {
  if (trackedFileSet.has(retiredOwner)) throw new Error(`Retired responsive patch owner must stay removed: ${retiredOwner}`);
}
if (!layoutSource.includes('Website43ResponsiveStyles') || retiredResponsiveOwners.some((file) => layoutSource.includes(file.split('/').at(-1).replace('.tsx', '')))) {
  throw new Error('app/layout.tsx must mount only Website43ResponsiveStyles for Website 4.3 responsive runtime CSS.');
}
