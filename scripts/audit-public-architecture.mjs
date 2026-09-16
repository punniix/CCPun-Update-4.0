import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import {
  graph,
  publicEntryFiles,
  publicReachable,
  publicReachableSources,
  reachable,
  runtimeFiles,
  sourceByFile,
  trackedFiles,
} from './lib/public-reachability.mjs';

// Order matters: the first matching owner wins, so specific feature/layout owners
// stay distinct from broader shared directories.
const areas = [
  ['blog', ['features/blog/']],
  ['home', ['features/home/']],
  ['ci-planning', ['features/ci-planning/']],
  ['financial-health-check', ['features/financial-health-check/']],
  ['analytics', ['features/analytics/']],
  ['website-43-shared', ['components/layout/website-43/']],
  ['layout-shared', ['components/layout/']],
  ['ui-shared', ['components/ui/']],
  ['preview-shared', ['components/preview/']],
  ['content-platform', ['lib/content/']],
  ['seo-platform', ['lib/seo/']],
  ['shared-lib', ['lib/shared/']],
];

function areaFor(file) {
  for (const [area, prefixes] of areas) {
    if (prefixes.some((prefix) => file.startsWith(prefix))) return area;
  }
  return null;
}

function isClientModule(file) {
  const source = sourceByFile.get(file) ?? '';
  return /^\s*["']use client["'];?/m.test(source);
}

// These files are intentionally not route-reachable. Each entry has an explicit
// non-runtime contract, so it is safer to keep it than to disguise it as active
// application code. Any new orphan outside this list fails CI.
function intentionalOrphanReason(file) {
  if (file.startsWith('features/blog/components/')) return 'test-bound pre-Website43 Blog renderer';
  if (file === 'features/ci-planning/components/CIPreToolWalkthrough.tsx') return 'regression fixture for retired walkthrough behavior';
  if (file === 'features/ci-planning/legacy/calculator.ts') return 'frozen CI formula parity reference';
  if (file.startsWith('features/financial-health-check/calculator/')) return 'frozen FHC formula parity reference';
  if (file === 'components/layout/Navbar.tsx') return 'test-bound pre-Website43 navbar contract';
  if (file === 'components/preview/DraftPreviewRuntimeNoop.tsx') return 'build-time Turbopack alias boundary';
  if (file === 'lib/content/legacy.ts') return 'migration/test fixture for frozen legacy article mappings';
  return null;
}

const reverseGraph = new Map();
for (const [importer, dependencies] of graph) {
  for (const dependency of dependencies) {
    const importers = reverseGraph.get(dependency) ?? [];
    importers.push(importer);
    reverseGraph.set(dependency, importers);
  }
}

const testFiles = trackedFiles.filter((file) => file.startsWith('tests/') && ['.js', '.jsx', '.mjs', '.ts', '.tsx'].includes(extname(file)));
const testSources = testFiles.map((file) => [file, readFileSync(file, 'utf8')]);

function testsReferencing(file) {
  const basename = file.split('/').at(-1);
  return testSources
    .filter(([, source]) => source.includes(file) || (basename && source.includes(basename)))
    .map(([testFile]) => testFile);
}

const areaRows = [];
const orphanRows = [];
const internalOnlyRows = [];
const publicClientRows = [];
const publicLargeRows = [];

for (const [area] of areas) {
  const files = runtimeFiles.filter((file) => areaFor(file) === area).sort();
  const publicFiles = files.filter((file) => publicReachable.has(file));
  const internalOnly = files.filter((file) => !publicReachable.has(file) && reachable.has(file));
  const orphanFiles = files.filter((file) => !reachable.has(file));
  const clientFiles = publicFiles.filter(isClientModule);
  areaRows.push({ area, total: files.length, public: publicFiles.length, internal: internalOnly.length, orphan: orphanFiles.length, clients: clientFiles.length });

  for (const file of orphanFiles) {
    orphanRows.push({
      area,
      file,
      tests: testsReferencing(file),
      importers: reverseGraph.get(file) ?? [],
      reason: intentionalOrphanReason(file),
    });
  }
  for (const file of internalOnly) internalOnlyRows.push({ area, file });
  for (const file of clientFiles) publicClientRows.push({ area, file });
  for (const file of publicFiles) {
    const source = sourceByFile.get(file) ?? '';
    const bytes = Buffer.byteLength(source, 'utf8');
    if (bytes >= 8000) publicLargeRows.push({ area, file, bytes });
  }
}

const unclassifiedPublic = [...publicReachable]
  .filter((file) => !file.startsWith('app/') && areaFor(file) === null)
  .sort();

function importSpecifiers(source) {
  const values = new Set();
  const patterns = [
    /\b(?:import|export)\s+(?:type\s+)?(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) values.add(match[1]);
  }
  return [...values];
}

function packageRoot(specifier) {
  if (!specifier || specifier.startsWith('.') || specifier.startsWith('@/') || specifier.startsWith('/') || specifier.startsWith('node:')) return null;
  if (specifier.startsWith('@')) return specifier.split('/').slice(0, 2).join('/');
  return specifier.split('/')[0];
}

function sourceImportsDependency(source, dependency) {
  return importSpecifiers(source).some((specifier) => packageRoot(specifier) === dependency);
}

function dependencyCounts(sourceEntries, dependencies) {
  const counts = new Map(dependencies.map((dependency) => [dependency, 0]));
  for (const [, source] of sourceEntries) {
    const imported = new Set(importSpecifiers(source).map(packageRoot).filter(Boolean));
    for (const dependency of imported) {
      if (counts.has(dependency)) counts.set(dependency, counts.get(dependency) + 1);
    }
  }
  return counts;
}

function dependencyConsumers(sourceEntries, dependency) {
  return sourceEntries.filter(([, source]) => sourceImportsDependency(source, dependency)).map(([file]) => file).sort();
}

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const dependencies = Object.keys(packageJson.dependencies ?? {}).sort();
const allRouteSources = [...reachable].filter((file) => sourceByFile.has(file)).map((file) => [file, sourceByFile.get(file)]);
const repoCodeFiles = trackedFiles.filter((file) => ['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx'].includes(extname(file)));
const repoCodeSources = repoCodeFiles.map((file) => [file, readFileSync(file, 'utf8')]);
const publicDependencyCounts = dependencyCounts(publicReachableSources, dependencies);
const routeDependencyCounts = dependencyCounts(allRouteSources, dependencies);
const repoDependencyCounts = dependencyCounts(repoCodeSources, dependencies);

const unexpectedOrphans = orphanRows.filter((row) => !row.reason);
const intentionalOrphans = orphanRows.filter((row) => row.reason);

console.log('PUBLIC_ARCHITECTURE_AUDIT');
console.log(`public_entry_files=${publicEntryFiles.length}`);
console.log(`public_reachable_runtime_files=${publicReachable.size}`);
console.log(`all_route_reachable_runtime_files=${reachable.size}`);
console.log(`unclassified_public_runtime_files=${unclassifiedPublic.length}`);
console.log(`intentional_orphan_runtime_files=${intentionalOrphans.length}`);
console.log(`unexpected_orphan_runtime_files=${unexpectedOrphans.length}`);
console.log('PUBLIC_ENTRY_FILES_START');
for (const file of [...publicEntryFiles].sort()) console.log(file);
console.log('PUBLIC_ENTRY_FILES_END');

console.log('AREA_SUMMARY_START');
for (const row of areaRows) {
  console.log(`${row.area}\ttotal=${row.total}\tpublic=${row.public}\tinternal=${row.internal}\torphan=${row.orphan}\tclient=${row.clients}`);
}
console.log('AREA_SUMMARY_END');

console.log('ORPHAN_RUNTIME_START');
for (const row of orphanRows.sort((a, b) => a.file.localeCompare(b.file))) {
  console.log(`${row.area}\t${row.file}\tstatus=${row.reason ? 'intentional' : 'unexpected'}\treason=${row.reason ?? 'none'}\ttest_refs=${row.tests.length}\timporters=${row.importers.length}`);
  for (const testFile of row.tests) console.log(`  test:${testFile}`);
  for (const importer of row.importers) console.log(`  importer:${importer}`);
}
console.log('ORPHAN_RUNTIME_END');

console.log('INTERNAL_ONLY_RUNTIME_START');
for (const row of internalOnlyRows.sort((a, b) => a.file.localeCompare(b.file))) console.log(`${row.area}\t${row.file}`);
console.log('INTERNAL_ONLY_RUNTIME_END');

console.log('PUBLIC_UNCLASSIFIED_RUNTIME_START');
for (const file of unclassifiedPublic) console.log(file);
console.log('PUBLIC_UNCLASSIFIED_RUNTIME_END');

console.log('PUBLIC_CLIENT_ISLANDS_START');
for (const row of publicClientRows.sort((a, b) => a.file.localeCompare(b.file))) console.log(`${row.area}\t${row.file}`);
console.log('PUBLIC_CLIENT_ISLANDS_END');

console.log('PUBLIC_LARGE_MODULES_START');
for (const row of publicLargeRows.sort((a, b) => b.bytes - a.bytes || a.file.localeCompare(b.file))) console.log(`${row.bytes}\t${row.area}\t${row.file}`);
console.log('PUBLIC_LARGE_MODULES_END');

console.log('DEPENDENCY_USAGE_START');
for (const dependency of dependencies) {
  console.log(`${dependency}\tpublic=${publicDependencyCounts.get(dependency)}\tall_routes=${routeDependencyCounts.get(dependency)}\trepo_code=${repoDependencyCounts.get(dependency)}`);
}
console.log('DEPENDENCY_USAGE_END');

console.log('NON_PUBLIC_DEPENDENCY_OWNERS_START');
for (const dependency of dependencies.filter((name) => publicDependencyCounts.get(name) === 0)) {
  console.log(dependency);
  for (const file of dependencyConsumers(allRouteSources, dependency)) console.log(`  route:${file}`);
  for (const file of dependencyConsumers(repoCodeSources, dependency).filter((file) => !reachable.has(file))) console.log(`  non_route:${file}`);
}
console.log('NON_PUBLIC_DEPENDENCY_OWNERS_END');

const repoZeroDependencies = dependencies.filter((dependency) => repoDependencyCounts.get(dependency) === 0);
console.log('ZERO_REPO_CODE_DEPENDENCIES_START');
for (const dependency of repoZeroDependencies) console.log(dependency);
console.log('ZERO_REPO_CODE_DEPENDENCIES_END');

if (unexpectedOrphans.length > 0) {
  throw new Error(`Public ownership audit found ${unexpectedOrphans.length} unexpected orphan runtime file(s): ${unexpectedOrphans.map((row) => row.file).join(', ')}`);
}
