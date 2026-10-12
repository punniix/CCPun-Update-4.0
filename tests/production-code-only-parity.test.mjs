import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { productionBaselineSource, productionBaselineBytes } from '../qa/phase1-source-proof.mjs';
import { assertPhase3AdminNativeBoundaries, phase3AdminNativeEntries } from '../qa/phase3-admin-native-boundaries-proof.mjs';
import { assertPhase3AdminContracts, phase3AdminEntries } from '../qa/phase3-admin-contracts-proof.mjs';
import { assertPhase2AdminComposition, phase2AdminEntries } from '../qa/phase2-admin-modularity-proof.mjs';
import { assertPhase2FoundationSource, phase2FoundationPath } from '../qa/phase2-css-source-contract.mjs';

const root = resolve(import.meta.dirname, '..');
const read = file => productionBaselineSource(file);
const sha = value => createHash('sha256').update(value).digest('hex');
const proof = JSON.parse(read('qa/production-code-only-parity.json'));

test('code-only release preserves its own Production canonical owners, UI, tracking, SEO and auth sources', () => {
  assert.equal(Object.keys(proof.canonical).length, 48);
  for (const [file, digest] of Object.entries({ ...proof.canonical, ...proof.protected, ...proof.retainedVariants, ...proof.workerEntrySources })) {
    if (file === 'lib/admin/agent-os/privacy-routing.ts') {
      // Intentional strict privacy contract adoption; current source is the reviewed UAT policy.
      assert.equal(sha(readFileSync(resolve(root, file), 'utf8')), '227a394bccab9f0a65d83a273375f8fcc310bb9a0378dcf5d8e3663cc1a91691', file);
    } else if (file === 'scripts/build-provider.mjs') {
      assert.equal(digest, '2368b223e7fb9d8ccbae5f9c44340621346307363766e1a7fe2f8bce0cdc96f9', 'own frozen legacy builder identity');
      assert.equal(existsSync(resolve(root, file)), false, 'duplicate legacy dispatcher is retired');
      const scripts = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).scripts;
      assert.equal(scripts['build:hostinger'], 'npm run build --workspace @ccpun/web');
      assert.equal(JSON.parse(readFileSync(resolve(root, 'apps/web/package.json'), 'utf8')).scripts.build, 'node scripts/build-provider.mjs');
      assert.equal(sha(readFileSync(resolve(root, 'apps/web/scripts/build-provider.mjs'))), '35f61f91cbc11bcd463ba1d05d3fa91c5873cbdb7ffc81e53fd1bb44986d3c8e', 'unchanged actual canonical Web builder');
      assert.equal(sha(readFileSync(resolve(root, 'apps/admin/scripts/build-provider.mjs'))), 'a3fb133f632da4027996ec96976a912dd25e5402961fc16825d2e2050dcc31fe', 'own native SWC builder unchanged');
      assert.equal(scripts['test:hostinger'], 'node --test tests/hostinger-shadow-config.test.mjs');
      assert.equal(sha(readFileSync(resolve(root, 'tests/hostinger-shadow-config.test.mjs'))), '361a2e85907145b763e6b2611e3a4092957f6f2c76ae8af23da1c2664a96ef32', 'registered real npm workspace cwd and exit0/7 assertions');
    } else if (phase3AdminNativeEntries.includes(file)) assert.equal(assertPhase3AdminNativeBoundaries(file, digest), true, file);
    else if (phase3AdminEntries.includes(file)) assert.equal(assertPhase3AdminContracts(file, digest), true, file);
    else if (phase2AdminEntries.includes(file)) assert.equal(assertPhase2AdminComposition(file, digest), true, file);
    else if (file === phase2FoundationPath) assert.equal(assertPhase2FoundationSource(file, digest), true, file);
    else assert.equal(sha(productionBaselineBytes(file)), digest, file);
  }
  for (const file of ['features/investment-allocation', 'apps/web/app/tools/investment-allocation', 'apps/web/app/api/investment-allocation', 'lib/runtime/investment-availability.ts']) {
    assert.equal(existsSync(resolve(root, file)), false, file + ': unfinished tool must remain absent');
  }
});

test('critical first-paint CSS and three layout compositions preserve the exact Production baseline', () => {
  const css = read('components/styles/critical-foundation.ts').match(/= `([\s\S]*?)`;\s*$/)?.[1];
  assert.equal(Buffer.byteLength(css), proof.criticalCssBytes);
  assert.equal(sha(css), proof.criticalCssSha256);
  for (const [file, digest] of Object.entries(proof.layouts)) {
    const source = read(file);
    assert.equal((source.match(/__html: CRITICAL_FOUNDATION_CSS/g) ?? []).length, 1, file);
    const baseline = source.replace('import { CRITICAL_FOUNDATION_CSS } from "@/components/styles/critical-foundation";\n', '')
      .replace('__html: CRITICAL_FOUNDATION_CSS', '__html: `' + css + '`');
    assert.equal(sha(baseline), digest, file);
  }
});

test('moving global CSS changes only import resolution and retains all declaration bodies in order', () => {
  const foundation = read('components/styles/global-foundation.css');
  assert.equal(sha(foundation.slice(foundation.indexOf('/*'))), proof.globalBodySha256);
});


test('only eight unreachable class declarations are removed; every retained CSS declaration stays ordered', () => {
  for (const [file, { baselineSource, selectors }] of Object.entries(proof.removedDeadStyles)) {
    let expected = baselineSource;
    for (const selector of selectors) {
      const rule = new RegExp('\\.' + selector + '\\s*\\{[^{}]*\\}', 'g');
      assert.equal([...expected.matchAll(rule)].length, 1);
      expected = expected.replace(rule, '');
    }
    assert.equal(read(file), expected.replace(/^[ \t]+$/gm, ""), file);
  }
});
