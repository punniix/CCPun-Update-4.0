import { assertNativeProviderRetirement, assertReviewedNativeShadowTest, assertReviewedWebUatBuildProfile } from '../qa/phase3-native-provider-proof.mjs';
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
    if (file === 'features/admin/operations/DeploymentsPage.tsx') {
      assert.equal(digest, '3664b01ea11471d9c4d421adf82c206704ac7859b4503acc0e2a9e44bfd3271e', 'own original UI identity');
      const actual = readFileSync(resolve(root, file), 'utf8');
      const nativeLabel = 'const provider = hostinger ? "Hostinger Cloud Startup" : "ยังไม่ยืนยันผู้ให้บริการ";';
      const retiredLabel = 'const provider = hostinger ? "Hostinger Cloud Startup" : model.provider === "vercel" ? "Vercel" : "ยังไม่ยืนยันผู้ให้บริการ";';
      assert.equal(actual.split(nativeLabel).length, 2);
      assert.equal(sha(actual.replace(nativeLabel, retiredLabel)), digest, 'whole page changes only unreachable provider label');
    } else if (file === 'lib/admin/agent-os/privacy-routing.ts') {
      // Intentional strict privacy contract adoption; current source is the reviewed UAT policy.
      assert.equal(sha(readFileSync(resolve(root, file), 'utf8')), '227a394bccab9f0a65d83a273375f8fcc310bb9a0378dcf5d8e3663cc1a91691', file);
    } else if (file === 'scripts/build-provider.mjs') {
      assert.equal(digest, '2368b223e7fb9d8ccbae5f9c44340621346307363766e1a7fe2f8bce0cdc96f9', 'own frozen legacy builder identity');
      assert.equal(existsSync(resolve(root, file)), false, 'duplicate legacy dispatcher is retired');
      const scripts = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).scripts;
      assert.equal(scripts['build:hostinger'], 'npm run build --workspace @ccpun/web');
      assert.equal(JSON.parse(readFileSync(resolve(root, 'apps/web/package.json'), 'utf8')).scripts.build, 'node scripts/build-provider.mjs');
      assert.equal(assertNativeProviderRetirement('apps/web/scripts/build-provider.mjs', '35f61f91cbc11bcd463ba1d05d3fa91c5873cbdb7ffc81e53fd1bb44986d3c8e'), true, 'reviewed current canonical Web builder');
      assert.equal(assertNativeProviderRetirement('apps/admin/scripts/build-provider.mjs', 'a3fb133f632da4027996ec96976a912dd25e5402961fc16825d2e2050dcc31fe'), true, 'own native SWC body retained');
      assert.equal(scripts['test:hostinger'], 'node --test tests/hostinger-shadow-config.test.mjs');
      assert.equal(assertReviewedNativeShadowTest('361a2e85907145b763e6b2611e3a4092957f6f2c76ae8af23da1c2664a96ef32'), true, 'registered real npm workspace cwd and exit0/7 assertions');
    } else if (file === 'scripts/build-root.mjs') {
      const original = JSON.parse(readFileSync(resolve(root, 'qa/phase3-native-provider-parity.json'), 'utf8')).baselineSources[file];
      const actual = readFileSync(resolve(root, file), 'utf8');
      assert.equal(sha(original), digest, 'own original root dispatcher identity');
      const prior = actual
        .replace('  if (Object.entries(process.env).some(([key, value]) => key.startsWith("VERCEL_") && value?.trim())) throw new Error("UNSUPPORTED_PROVIDER_METADATA");\n', '  if (process.env.VERCEL_PROJECT_ID?.trim()) return;\n')
        .replace('  if (["vercel", "@workflow/world-vercel"].includes(process.env.WORKFLOW_TARGET_WORLD?.trim() ?? "")) throw new Error("UNSUPPORTED_WORKFLOW_WORLD");\n', '')
        .replace('if (provider && !["hostinger", "local"].includes(provider)) throw new Error("UNSUPPORTED_BUILD_PROVIDER");\n', '')
        .replace('if (provider === "hostinger" && !["web", "admin"].includes(role)) throw new Error("HOSTINGER_BUILD_ROLE_REQUIRED");\n', '');
      assert.equal(prior, original, 'only four reviewed native dispatch guards change');
      assert.equal(sha(actual), '00d8f879c1651f2c6e8f1c061ed187f47e29c7ce69b6887c4d627b20b10644d8', 'reviewed root CLI output evidence');
    } else if (file === 'apps/web/proxy.ts') {
      const original = JSON.parse(readFileSync(resolve(root, 'qa/phase3-native-provider-parity.json'), 'utf8')).baselineSources[file];
      const actual = readFileSync(resolve(root, file), 'utf8');
      assert.equal(sha(original), digest, 'own original Web proxy identity');
      assert.equal(actual, original.replace('    vercelRequestId: headers.get("x-vercel-id"),\n', ''), 'only retired optional crawler diagnostic is removed');
      assert.equal(sha(actual), 'aa2f049adf19bea587ff45ff61969e181e307ae2fbde904413cca53a86bd7e2f', 'reviewed own current Web proxy');
    } else if (['lib/runtime/deployment-identity.ts', 'lib/content/sanity-lane.ts', 'lib/deployment-environment.ts', 'proxy.ts', 'lib/runtime/deployment-contract.ts', 'apps/web/scripts/build-provider.mjs', 'apps/admin/scripts/build-provider.mjs'].includes(file)) assert.equal(assertNativeProviderRetirement(file, digest), true, file);
    else if (phase3AdminNativeEntries.includes(file)) assert.equal(assertPhase3AdminNativeBoundaries(file, digest), true, file);
    else if (phase3AdminEntries.includes(file)) assert.equal(assertPhase3AdminContracts(file, digest), true, file);
    else if (phase2AdminEntries.includes(file)) assert.equal(assertPhase2AdminComposition(file, digest), true, file);
    else if (file === phase2FoundationPath) assert.equal(assertPhase2FoundationSource(file, digest), true, file);
    else if (file === 'lib/runtime/deployment-lanes.mjs') assert.equal(assertReviewedWebUatBuildProfile(digest), true, file);
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
