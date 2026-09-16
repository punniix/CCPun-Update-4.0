import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, extname, join, normalize } from 'node:path';

const trackedFiles = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);

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

const globalCssPath = 'app/components.css';
const globalCss = readFileSync(globalCssPath, 'utf8');
const globalClasses = extractClasses(globalCss);
const globalUnused = globalClasses.filter((className) => !hasLiteralReachableUsage(className));

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

const unreachableFeatureFiles = runtimeFiles
  .filter((file) => (file.startsWith('features/') || file.startsWith('components/')) && !reachable.has(file))
  .sort();
const unreachableLegacyBlogFiles = unreachableFeatureFiles.filter((file) => file.startsWith('features/blog/components/'));

console.log('PUBLIC_CSS_AUDIT');
console.log(`runtime_files=${runtimeFiles.length}`);
console.log(`route_entries=${entryFiles.length}`);
console.log(`reachable_runtime_files=${reachable.size}`);
console.log(`unreachable_feature_component_files=${unreachableFeatureFiles.length}`);
console.log(`unreachable_legacy_blog_component_files=${unreachableLegacyBlogFiles.length}`);
console.log(`global_css_classes=${globalClasses.length}`);
console.log(`global_zero_reachable_reference=${globalUnused.length}`);
console.log(`website43_module_classes=${moduleClasses.length}`);
console.log(`website43_importers=${moduleImporters.length}`);
console.log(`website43_dynamic_access=${dynamicModuleAccess.length}`);
console.log(`website43_zero_reachable_reference=${moduleUnused.length}`);
console.log('GLOBAL_ZERO_REFERENCE_START');
for (const className of globalUnused) console.log(className);
console.log('GLOBAL_ZERO_REFERENCE_END');
console.log('WEBSITE43_ZERO_REFERENCE_START');
for (const className of moduleUnused) console.log(className);
console.log('WEBSITE43_ZERO_REFERENCE_END');
console.log('UNREACHABLE_LEGACY_BLOG_FILES_START');
for (const file of unreachableLegacyBlogFiles) console.log(file);
console.log('UNREACHABLE_LEGACY_BLOG_FILES_END');
if (dynamicModuleAccess.length > 0) {
  console.log('WEBSITE43_DYNAMIC_ACCESS_START');
  for (const { file, alias } of dynamicModuleAccess) console.log(`${file}: ${alias}`);
  console.log('WEBSITE43_DYNAMIC_ACCESS_END');
}

if (globalUnused.length > 0) {
  throw new Error(`Global CSS has ${globalUnused.length} class selector(s) with no reachable runtime reference: ${globalUnused.join(', ')}`);
}
if (dynamicModuleAccess.length > 0) {
  throw new Error('Website43.module.css uses dynamic property access; static reachability audit is no longer safe.');
}
