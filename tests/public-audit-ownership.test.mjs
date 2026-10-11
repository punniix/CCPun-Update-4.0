import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';
import {
  entryFiles,
  getReachableStyleFiles,
  isPublicPageEntry,
  publicEntryFiles,
  publicReachable,
  publicReachableSources,
  reachable,
} from '../scripts/lib/public-reachability.mjs';

test('Public audit follows actual Web routes and excludes compatibility, Admin and API roots', () => {
  for (const file of [
    'apps/web/app/layout.tsx',
    'apps/web/app/page.tsx',
    'apps/web/app/blog/[category]/[slug]/page.tsx',
    'apps/web/app/play/money-story/page.tsx',
    'apps/web/app/sitemaps/blog.xml/route.ts',
  ]) {
    assert(publicEntryFiles.includes(file), `missing active Public entry: ${file}`);
    assert(publicReachable.has(file));
  }
  for (const file of [
    'app/layout.tsx',
    'app/page.tsx',
    'apps/admin/app/layout.tsx',
    'apps/web/app/api/line/webhook/route.ts',
    'apps/web/app/login/page.tsx',
    'apps/web/app/studio/[[...tool]]/page.tsx',
    'apps/web/app/(control-plane)/dashboard/page.tsx',
    'apps/web/app/.well-known/workflow/route.ts',
    'apps/web/proxy.ts',
  ]) {
    assert.equal(isPublicPageEntry(file), false, `not a Public page entry: ${file}`);
    assert.equal(publicReachable.has(file), false, `not a Public render dependency: ${file}`);
  }
  assert.equal(entryFiles.some((file) => file.startsWith('app/')), false);
  assert(reachable.has('apps/admin/app/layout.tsx'));
  assert(reachable.has('apps/web/app/api/line/webhook/route.ts'));
  assert(entryFiles.includes('apps/web/proxy.ts'));
  assert(entryFiles.includes('apps/admin/proxy.ts'));
});

test('active Web stylesheet still reaches the shared global foundation and Money Story style', () => {
  const styles = getReachableStyleFiles(publicReachableSources);
  for (const file of [
    'apps/web/app/globals.css',
    'app/globals.css',
    'components/styles/public-compat.css',
    'components/styles/public-motion.css',
    'features/financial-health-check/styles/print.css',
    'features/money-story/MoneyStory.module.css',
  ]) assert(styles.has(file), `missing reachable style: ${file}`);
});

test('actual architecture auditor reports Money Story under its own owner without legacy Public entries', () => {
  const result = spawnSync(process.execPath, ['scripts/audit-public-architecture.mjs'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const publicEntries = result.stdout.split('PUBLIC_ENTRY_FILES_START\n')[1].split('PUBLIC_ENTRY_FILES_END')[0].trim().split('\n');
  assert(publicEntries.every((file) => file.startsWith('apps/web/app/')));
  assert(publicEntries.includes('apps/web/app/layout.tsx'));
  assert.match(result.stdout, /^money-story\ttotal=[1-9]\d*\tpublic=[1-9]\d*\tinternal=0\torphan=0\tclient=1$/m);
  assert.match(result.stdout, /^money-story\tfeatures\/money-story\/components\/MoneyStoryGame\.tsx$/m);
  assert.match(result.stdout, /status=intentional\treason=frozen CI formula parity reference/);
  assert.match(result.stdout, /status=intentional\treason=frozen FHC formula parity reference/);
});

test('actual audit test-reference matcher recognizes real basenames and relative paths', () => {
  const source = readFileSync('scripts/audit-public-architecture.mjs', 'utf8');
  const matcher = source.slice(source.indexOf('function testsReferencing(file)'), source.indexOf('\nconst areaRows'));
  const testsReferencing = runInNewContext(`(${matcher.trim()})`, { testSources: [
    ['tests/full.mjs', "read('features/ci-planning/legacy/calculator.ts')"],
    ['tests/basename.mjs', "read('calculator.ts')"],
    ['tests/relative.mjs', 'import "../legacy/calculator.ts"'],
    ['tests/unrelated.mjs', "read('other-calculator.ts')"],
    ['tests/literal.mjs', "read('${basename}')"],
  ] });
  assert.deepEqual(Array.from(testsReferencing('features/ci-planning/legacy/calculator.ts')), [
    'tests/full.mjs', 'tests/basename.mjs', 'tests/relative.mjs',
  ]);
});
