import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, extname, join, normalize } from 'node:path';

const trackedFiles = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);
const trackedFileSet = new Set(trackedFiles);

const runtimeExtensions = ['.js', '.jsx', '.mjs', '.ts', '.tsx'];
const runtimeExtensionSet = new Set(runtimeExtensions);
const excludedPrefixes = ['docs/', 'qa/', 'scripts/', 'tests/', '.agents/', '.qwen/', '.windsurf/', '.impeccable/'];
const runtimeFiles = trackedFiles.filter((file) =>
  runtimeExtensionSet.has(extname(file)) && !excludedPrefixes.some((prefix) => file.startsWith(prefix)),
);
const runtimeFileSet = new Set(runtimeFiles);
const sourceByFile = new Map(runtimeFiles.map((file) => [file, readFileSync(file, 'utf8')]));

function toRepoPath(value) {
  return normalize(value).replaceAll('\\', '/').replace(/^\.\//, '');
}

function resolveLocalImport(fromFile, specifier) {
  let base;
  if (specifier.startsWith('@/')) base = specifier.slice(2);
  else if (specifier.startsWith('.')) base = toRepoPath(join(dirname(fromFile), specifier));
  else return null;

  const candidates = [base];
  if (!runtimeExtensionSet.has(extname(base))) {
    for (const extension of runtimeExtensions) candidates.push(`${base}${extension}`);
    for (const extension of runtimeExtensions) candidates.push(`${base}/index${extension}`);
  }
  return candidates.find((candidate) => runtimeFileSet.has(toRepoPath(candidate))) ?? null;
}

function localImports(file, source) {
  const imports = new Set();
  const patterns = [
    /\b(?:import|export)\s+(?:type\s+)?(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const resolved = resolveLocalImport(file, match[1]);
      if (resolved) imports.add(toRepoPath(resolved));
    }
  }
  return [...imports];
}

const graph = new Map();
for (const file of runtimeFiles) graph.set(file, localImports(file, sourceByFile.get(file)));

const appEntryPattern = /^app\/(?:.*\/)?(?:page|layout|route|loading|error|not-found|default|template)\.(?:js|jsx|mjs|ts|tsx)$/;
const entryFiles = runtimeFiles.filter((file) => appEntryPattern.test(file));
for (const rootEntry of ['proxy.ts', 'auth.ts']) {
  if (runtimeFileSet.has(rootEntry)) entryFiles.push(rootEntry);
}

const reachable = new Set();
const queue = [...new Set(entryFiles)];
while (queue.length) {
  const file = queue.shift();
  if (reachable.has(file)) continue;
  reachable.add(file);
  for (const dependency of graph.get(file) ?? []) {
    if (!reachable.has(dependency)) queue.push(dependency);
  }
}

const reachableSources = [...reachable]
  .filter((file) => sourceByFile.has(file))
  .map((file) => [file, sourceByFile.get(file)]);

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

const globalsPath = 'app/globals.css';
const globalsSource = readFileSync(globalsPath, 'utf8');
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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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

// Static asset ownership: only files that can be sent as binary/media payloads are
// audited here. Operational public files (llms.txt, .well-known, JSON configs) have
// explicit protocol/tooling owners and are outside the asset lifecycle.
const assetExtensions = new Set([
  '.avif', '.gif', '.ico', '.jpeg', '.jpg', '.mp3', '.mp4', '.otf', '.pdf', '.png', '.svg', '.ttf', '.webm', '.webp', '.woff', '.woff2',
]);
const publicAssets = trackedFiles
  .filter((file) => file.startsWith('public/') && assetExtensions.has(extname(file).toLowerCase()))
  .sort();
const implicitlyOwnedAssets = new Set(['public/favicon.ico']);

function resolveCssImport(fromFile, specifier) {
  if (!specifier.endsWith('.css')) return null;
  if (specifier.startsWith('@/')) return toRepoPath(specifier.slice(2));
  if (specifier.startsWith('.')) return toRepoPath(join(dirname(fromFile), specifier));
  return null;
}

const reachableStyleFiles = new Set();
const styleQueue = [];
for (const [file, source] of reachableSources) {
  const importPatterns = [
    /\bimport\s+['"]([^'"]+\.css)['"]/g,
    /\bimport\s+[^'";]+?\s+from\s+['"]([^'"]+\.css)['"]/g,
  ];
  for (const pattern of importPatterns) {
    for (const match of source.matchAll(pattern)) {
      const resolved = resolveCssImport(file, match[1]);
      if (resolved && trackedFileSet.has(resolved)) styleQueue.push(resolved);
    }
  }
}
while (styleQueue.length) {
  const cssPath = styleQueue.shift();
  if (reachableStyleFiles.has(cssPath)) continue;
  reachableStyleFiles.add(cssPath);
  const cssSource = readFileSync(cssPath, 'utf8');
  for (const match of cssSource.matchAll(/@import\s+['"]([^'"]+\.css)['"]/g)) {
    const resolved = resolveCssImport(cssPath, match[1]);
    if (resolved && trackedFileSet.has(resolved) && !reachableStyleFiles.has(resolved)) styleQueue.push(resolved);
  }
}

const assetReferenceSources = [
  ...reachableSources,
  ...[...reachableStyleFiles].map((file) => [file, readFileSync(file, 'utf8')]),
  ...['next.config.ts', 'vercel.json'].filter((file) => trackedFileSet.has(file)).map((file) => [file, readFileSync(file, 'utf8')]),
];
const dynamicAssetPrefixes = new Set();
for (const [, source] of assetReferenceSources) {
  for (const match of source.matchAll(/([/][A-Za-z0-9._/-]*[/])[^`'"\n]*\$\{/g)) {
    if (match[1].startsWith('/assets/')) dynamicAssetPrefixes.add(match[1]);
  }
}

function publicUrlFor(file) {
  return `/${file.slice('public/'.length)}`;
}

function assetHasReference(file) {
  if (implicitlyOwnedAssets.has(file)) return true;
  const publicUrl = publicUrlFor(file);
  if ([...dynamicAssetPrefixes].some((prefix) => publicUrl.startsWith(prefix))) return true;
  const relativeUrl = publicUrl.slice(1);
  return assetReferenceSources.some(([, source]) => source.includes(publicUrl) || source.includes(relativeUrl));
}

const zeroReferenceAssets = publicAssets.filter((file) => !assetHasReference(file));
const zeroReferenceAssetBytes = zeroReferenceAssets.reduce((sum, file) => {
  const row = execFileSync('git', ['ls-tree', '-l', 'HEAD', file], { encoding: 'utf8' }).trim();
  const size = Number(row.split(/\s+/)[3] ?? 0);
  return sum + (Number.isFinite(size) ? size : 0);
}, 0);

console.log('PUBLIC_OWNERSHIP_AUDIT');
console.log(`runtime_files=${runtimeFiles.length}`);
console.log(`route_entries=${entryFiles.length}`);
console.log(`reachable_runtime_files=${reachable.size}`);
console.log(`reachable_style_files=${reachableStyleFiles.size}`);
console.log(`owned_global_stylesheets=${ownedGlobalCssPaths.length}`);
console.log(`global_class_selectors=${globalClassOwners.size}`);
console.log(`global_zero_reachable_reference=${globalUnused.length}`);
console.log(`global_duplicate_owners=${duplicateGlobalOwners.length}`);
console.log(`website43_module_classes=${moduleClasses.length}`);
console.log(`website43_importers=${moduleImporters.length}`);
console.log(`website43_dynamic_access=${dynamicModuleAccess.length}`);
console.log(`website43_zero_reachable_reference=${moduleUnused.length}`);
console.log(`website43_responsive_style_owners=${styleOwnerFiles.length}`);
console.log(`public_binary_assets=${publicAssets.length}`);
console.log(`public_dynamic_asset_prefixes=${dynamicAssetPrefixes.size}`);
console.log(`public_zero_code_reference_assets=${zeroReferenceAssets.length}`);
console.log(`public_zero_code_reference_bytes=${zeroReferenceAssetBytes}`);
console.log('WEBSITE43_ZERO_REFERENCE_START');
for (const className of moduleUnused) console.log(className);
console.log('WEBSITE43_ZERO_REFERENCE_END');
console.log('PUBLIC_ZERO_REFERENCE_ASSETS_START');
for (const file of zeroReferenceAssets) console.log(`${file}\t${publicUrlFor(file)}`);
console.log('PUBLIC_ZERO_REFERENCE_ASSETS_END');

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
