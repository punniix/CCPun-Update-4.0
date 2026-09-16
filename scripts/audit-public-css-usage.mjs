import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';

const trackedFiles = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);

const runtimeExtensions = new Set(['.js', '.jsx', '.mjs', '.ts', '.tsx']);
const excludedPrefixes = ['docs/', 'qa/', 'scripts/', 'tests/', '.agents/', '.qwen/', '.windsurf/', '.impeccable/'];
const runtimeFiles = trackedFiles.filter((file) =>
  runtimeExtensions.has(extname(file)) && !excludedPrefixes.some((prefix) => file.startsWith(prefix)),
);
const runtimeSources = runtimeFiles.map((file) => [file, readFileSync(file, 'utf8')]);

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

function hasLiteralRuntimeUsage(className, excludedFile) {
  return runtimeSources.some(([file, source]) => file !== excludedFile && source.includes(className));
}

const globalCssPath = 'app/components.css';
const globalCss = readFileSync(globalCssPath, 'utf8');
const globalClasses = extractClasses(globalCss);
const globalUnused = globalClasses.filter((className) => !hasLiteralRuntimeUsage(className, globalCssPath));

const moduleCssPath = 'components/layout/website-43/Website43.module.css';
const moduleCss = readFileSync(moduleCssPath, 'utf8');
const moduleClasses = extractClasses(moduleCss);
const moduleImporters = [];
for (const [file, source] of runtimeSources) {
  const importPattern = /import\s+([A-Za-z_$][\w$]*)\s+from\s+['"][^'"]*Website43\.module\.css['"]/g;
  for (const match of source.matchAll(importPattern)) {
    moduleImporters.push({ file, alias: match[1], source });
  }
}

const dynamicModuleAccess = moduleImporters.filter(({ alias, source }) =>
  new RegExp(`${alias}\\s*\\[\\s*(?!['"])`).test(source),
);

function hasModuleUsage(className) {
  for (const { alias, source } of moduleImporters) {
    const dot = new RegExp(`${alias}\\.${className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
    const bracket = new RegExp(`${alias}\\s*\\[\\s*['"]${className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]\\s*\\]`);
    if (dot.test(source) || bracket.test(source)) return true;
  }
  return hasLiteralRuntimeUsage(className, moduleCssPath);
}

const moduleUnused = dynamicModuleAccess.length === 0
  ? moduleClasses.filter((className) => !hasModuleUsage(className))
  : [];

console.log('PUBLIC_CSS_AUDIT');
console.log(`runtime_files=${runtimeFiles.length}`);
console.log(`global_css_classes=${globalClasses.length}`);
console.log(`global_zero_runtime_reference=${globalUnused.length}`);
console.log(`website43_module_classes=${moduleClasses.length}`);
console.log(`website43_importers=${moduleImporters.length}`);
console.log(`website43_dynamic_access=${dynamicModuleAccess.length}`);
console.log(`website43_zero_runtime_reference=${moduleUnused.length}`);
console.log('GLOBAL_ZERO_REFERENCE_START');
for (const className of globalUnused) console.log(className);
console.log('GLOBAL_ZERO_REFERENCE_END');
console.log('WEBSITE43_ZERO_REFERENCE_START');
for (const className of moduleUnused) console.log(className);
console.log('WEBSITE43_ZERO_REFERENCE_END');
if (dynamicModuleAccess.length > 0) {
  console.log('WEBSITE43_DYNAMIC_ACCESS_START');
  for (const { file, alias } of dynamicModuleAccess) console.log(`${file}: ${alias}`);
  console.log('WEBSITE43_DYNAMIC_ACCESS_END');
}
