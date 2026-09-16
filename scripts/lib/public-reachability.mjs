import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, extname, join, normalize } from 'node:path';

export const trackedFiles = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);
export const trackedFileSet = new Set(trackedFiles);

export const runtimeExtensions = ['.js', '.jsx', '.mjs', '.ts', '.tsx'];
const runtimeExtensionSet = new Set(runtimeExtensions);
const excludedPrefixes = ['docs/', 'qa/', 'scripts/', 'tests/', '.agents/', '.qwen/', '.windsurf/', '.impeccable/'];

export const runtimeFiles = trackedFiles.filter((file) =>
  runtimeExtensionSet.has(extname(file)) && !excludedPrefixes.some((prefix) => file.startsWith(prefix)),
);
export const runtimeFileSet = new Set(runtimeFiles);
export const sourceByFile = new Map(runtimeFiles.map((file) => [file, readFileSync(file, 'utf8')]));

export function toRepoPath(value) {
  return normalize(value).replaceAll('\\', '/').replace(/^\.\//, '');
}

export function resolveLocalImport(fromFile, specifier) {
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

export const graph = new Map();
for (const file of runtimeFiles) graph.set(file, localImports(file, sourceByFile.get(file)));

const appEntryPattern = /^app\/(?:.*\/)?(?:page|layout|route|loading|error|not-found|default|template|manifest|robots|sitemap|opengraph-image|twitter-image|icon|apple-icon)\.(?:js|jsx|mjs|ts|tsx)$/;
export const entryFiles = runtimeFiles.filter((file) => appEntryPattern.test(file));
for (const rootEntry of ['proxy.ts', 'auth.ts']) {
  if (runtimeFileSet.has(rootEntry)) entryFiles.push(rootEntry);
}

export function walkReachable(roots) {
  const found = new Set();
  const queue = [...new Set(roots)];
  while (queue.length) {
    const file = queue.shift();
    if (!runtimeFileSet.has(file) || found.has(file)) continue;
    found.add(file);
    for (const dependency of graph.get(file) ?? []) {
      if (!found.has(dependency)) queue.push(dependency);
    }
  }
  return found;
}

export function sourcesFor(files) {
  return [...files]
    .filter((file) => sourceByFile.has(file))
    .map((file) => [file, sourceByFile.get(file)]);
}

export const reachable = walkReachable(entryFiles);
export const reachableSources = sourcesFor(reachable);

const publicExcludedEntryPrefixes = [
  'app/(control-plane',
  'app/api/',
  'app/studio/',
  'app/login/',
  'app/.well-known/workflow/',
];

export function isPublicPageEntry(file) {
  return appEntryPattern.test(file) && !publicExcludedEntryPrefixes.some((prefix) => file.startsWith(prefix));
}

// Public page reachability deliberately excludes Proxy/Auth/Admin/Studio/API roots.
// This graph answers “what can the user-facing site render/import?” rather than
// “what can any route in this repository import?”. Request-boundary infrastructure
// can be audited separately without contaminating Public component ownership.
export const publicEntryFiles = entryFiles.filter(isPublicPageEntry);
export const publicReachable = walkReachable(publicEntryFiles);
export const publicReachableSources = sourcesFor(publicReachable);

export function resolveCssImport(fromFile, specifier) {
  if (!specifier.endsWith('.css')) return null;
  if (specifier.startsWith('@/')) return toRepoPath(specifier.slice(2));
  if (specifier.startsWith('.')) return toRepoPath(join(dirname(fromFile), specifier));
  return null;
}

export function getReachableStyleFiles(sourceEntries = reachableSources) {
  const reachableStyleFiles = new Set();
  const styleQueue = [];

  for (const [file, source] of sourceEntries) {
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

  return reachableStyleFiles;
}
