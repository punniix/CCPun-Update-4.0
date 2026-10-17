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

// Exact new Google Connect bodies are checked before their six reviewed source
// admissions. The original Production maps and all other guards remain immutable.
function assertReviewedGoogleSessionProduction(file, originalDigest, value, reader, environment) {
  assert.equal(environment, 'production-admin', 'unreviewed Google session environment');
  const { reviewedGoogleSessionProduction: record, ...original } = value;
  assert.equal(sha(JSON.stringify(original)), '5299183ab8850885e12516aaa91b4fb01b21530ac81fbfbf7d0810d7f3898688', 'original Production proof drift');
  assert.equal(sha(JSON.stringify(record)), '221f259ec905734e36b59dab1cb82d7f23ee8839f126e4c70b82ebcda42e2d17', 'unreviewed Production Google session admission');
  assert.equal(record.baselineCommit, '0e88533a04bdad9d3cee6991431bd7be41f623b0');
  assert.equal(Object.keys(record.currentSourceDigests).length, 12);
  assert.equal(Object.keys(record.retainedSources).length, 6);
  assert.deepEqual(record.outputTests, ['tests/admin/google-session-connection.test.ts', 'tests/admin/google-session-auth.test.ts']);
  for (const [path, digest] of Object.entries(record.currentSourceDigests))
    assert.equal(sha(reader(path)), digest, path + ': unreviewed actual Google session body');
  const pins = record.retainedSources[file];
  assert.ok(pins, file + ': unreviewed Production Google session path');
  assert.equal(pins.originalSha256, originalDigest, file + ': original protected source drift');
  assert.equal(pins.baselineSha256, originalDigest, file + ': immutable 0e885 ancestor drift');
  assert.equal(pins.candidateSha256, record.currentSourceDigests[file], file + ': current source pin drift');
  return true;
}

test('original Production owners remain guarded alongside exact reviewed Google Connect feature sources', () => {
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
    else if (Object.hasOwn(proof.reviewedGoogleSessionProduction.retainedSources, file))
      assert.equal(assertReviewedGoogleSessionProduction(file, digest, proof, path => readFileSync(resolve(root, path), 'utf8'), 'production-admin'), true, file);
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


test('Production Google session admission rejects unknown lanes, source bodies, ancestors, proof and coverage', () => {
  const record = proof.reviewedGoogleSessionProduction, reader = path => readFileSync(resolve(root, path), 'utf8');
  const file = 'lib/admin/seo-intelligence/google-data-auth.ts', original = record.retainedSources[file].originalSha256;
  for (const [path, pins] of Object.entries(record.retainedSources))
    assert.equal(assertReviewedGoogleSessionProduction(path, pins.originalSha256, proof, reader, 'production-admin'), true);
  for (const environment of ['admin-uat', 'web-uat', 'local-production', 'unknown', undefined])
    assert.throws(() => assertReviewedGoogleSessionProduction(file, original, proof, reader, environment));
  assert.throws(() => assertReviewedGoogleSessionProduction('unknown.ts', original, proof, reader, 'production-admin'));
  assert.throws(() => assertReviewedGoogleSessionProduction(file, 'unknown', proof, reader, 'production-admin'));
  for (const path of Object.keys(record.currentSourceDigests))
    assert.throws(() => assertReviewedGoogleSessionProduction(file, original, proof, name => reader(name) + (name === path ? '//tamper' : ''), 'production-admin'));
  for (const mutate of [
    value => { value.reviewedGoogleSessionProduction.baselineCommit = 'unknown'; },
    value => { value.reviewedGoogleSessionProduction.retainedSources[file].baselineSha256 = 'unknown'; },
    value => { value.reviewedGoogleSessionProduction.retainedSources[file].originalSha256 = 'unknown'; },
    value => { delete value.reviewedGoogleSessionProduction.currentSourceDigests[file]; },
    value => { value.reviewedGoogleSessionProduction.currentSourceDigests['unknown.ts'] = 'unknown'; },
    value => { value.reviewedGoogleSessionProduction.outputTests.pop(); },
    value => { value.protected[file] = 'unknown'; },
  ]) {
    const changed = structuredClone(proof); mutate(changed);
    assert.throws(() => assertReviewedGoogleSessionProduction(file, original, changed, reader, 'production-admin'));
  }
});
