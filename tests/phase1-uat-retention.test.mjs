import { assertNativeProviderRetirement, assertReviewedNativeShadowTest, assertReviewedWebUatBuildProfile } from '../qa/phase3-native-provider-proof.mjs';
import { assertPhase3AdminNativeBoundaries, phase3AdminNativeEntries } from '../qa/phase3-admin-native-boundaries-proof.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { productionBaselineBytes, assertReviewedUatRetention, assertReviewedSeoUatSource, reviewedGoogleSessionBaselineSource } from '../qa/phase1-source-proof.mjs';
import { assertPhase3AdminContracts, phase3AdminEntries } from '../qa/phase3-admin-contracts-proof.mjs';
import { assertPhase2AdminComposition, phase2AdminEntries } from '../qa/phase2-admin-modularity-proof.mjs';
import { assertPhase2FoundationSource, phase2FoundationPath } from '../qa/phase2-css-source-contract.mjs';
const proof = JSON.parse(readFileSync('qa/phase1-source-ownership.json', 'utf8'));
const native = JSON.parse(readFileSync('qa/phase3-native-provider-parity.json', 'utf8'));
const sha = value => createHash('sha256').update(value).digest('hex');

test('own UAT 1f baseline retains every root alias and all P1/private/provider/tracking sources outside exact canonical extraction', () => {
  assert.equal(proof.baseline, '1f19562560e5e2de47cf643a4dbe7f27a9a91348');
  assert.equal(Object.keys(proof.compositions).length, 21);
  assert.equal(Object.keys(proof.owners).length, 22);
  assert.equal(proof.rootAliasCount, 73);
  for (const file of Object.keys(proof.compositions)) assert.ok(file.startsWith('apps/admin/app/'), 'no legacy root or Web entry adoption');
  const root = Object.keys(proof.protected).filter(file => file.startsWith('app/'));
  assert.equal(root.length, 99);
  for (const file of root) assert.equal(sha(readFileSync(file)), proof.protected[file], file + ': root source must stay byte exact');
  assert.equal(Object.keys(proof.protected).length, 764);
  for (const [file, digest] of Object.entries(proof.protected)) {
    if (Object.hasOwn(proof.reviewedGoogleSessionUat.existingSources, file)) {
      const pins = proof.reviewedGoogleSessionUat.existingSources[file];
      assert.equal(pins.originalProtectedSha256, digest, file + ': original protection is frozen');
      assert.equal(sha(reviewedGoogleSessionBaselineSource(file, proof, path => readFileSync(path, 'utf8'), 'admin-uat')), pins.baseSha256);
    } else if (file === 'features/admin/operations/DeploymentsPage.tsx') {
      assert.equal(digest, '3664b01ea11471d9c4d421adf82c206704ac7859b4503acc0e2a9e44bfd3271e', 'own original UI identity');
      const actual = readFileSync(file, 'utf8');
      const nativeLabel = 'const provider = hostinger ? "Hostinger Cloud Startup" : "ยังไม่ยืนยันผู้ให้บริการ";';
      const retiredLabel = 'const provider = hostinger ? "Hostinger Cloud Startup" : model.provider === "vercel" ? "Vercel" : "ยังไม่ยืนยันผู้ให้บริการ";';
      assert.equal(actual.split(nativeLabel).length, 2);
      assert.equal(sha(actual.replace(nativeLabel, retiredLabel)), digest, 'whole page changes only unreachable provider label');
    } else if (file === 'scripts/build-provider.mjs') {
      assert.equal(digest, '2368b223e7fb9d8ccbae5f9c44340621346307363766e1a7fe2f8bce0cdc96f9', 'own frozen legacy builder identity');
      assert.equal(existsSync(file), false, 'duplicate legacy dispatcher is retired');
      const scripts = JSON.parse(readFileSync('package.json', 'utf8')).scripts;
      assert.equal(scripts['build:hostinger'], 'npm run build --workspace @ccpun/web');
      assert.equal(JSON.parse(readFileSync('apps/web/package.json', 'utf8')).scripts.build, 'node scripts/build-provider.mjs');
      assert.equal(assertNativeProviderRetirement('apps/web/scripts/build-provider.mjs', '35f61f91cbc11bcd463ba1d05d3fa91c5873cbdb7ffc81e53fd1bb44986d3c8e'), true, 'reviewed current canonical Web builder');
      assert.equal(assertNativeProviderRetirement('apps/admin/scripts/build-provider.mjs', 'e69bcb852a0b4c3dc78c5f06eb96bed78014d74a8c899d05c0c96702069abdd3'), true, 'own native SWC body retained');
      assert.equal(scripts['test:hostinger'], 'node --test tests/hostinger-shadow-config.test.mjs');
      assert.equal(assertReviewedNativeShadowTest('361a2e85907145b763e6b2611e3a4092957f6f2c76ae8af23da1c2664a96ef32'), true, 'registered real npm workspace cwd and exit0/7 assertions');
    } else if (['lib/runtime/deployment-identity.ts', 'lib/content/sanity-lane.ts', 'lib/deployment-environment.ts', 'lib/runtime/deployment-contract.ts', 'proxy.ts', 'apps/admin/scripts/build-provider.mjs'].includes(file)) {
      assert.equal(assertNativeProviderRetirement(file, digest), true, file);
    } else if (['apps/admin/vercel.json', 'lib/runtime/vercel-service-auth.ts'].includes(file)) {
      assert.equal(sha(native.baselineSources[file]), digest, file + ': own retired source identity');
      assert.equal(native.baselineHashes[file], digest);
      assert.equal(existsSync(file), false, file + ': retired operative entry must not return');
    } else if (['lib/observability/ai-crawler.ts', 'lib/runtime/web-build-config.mjs', 'lib/runtime/line-bridge-probe.ts', 'next.config.ts'].includes(file)) {
      const original = native.baselineSources[file];
      assert.equal(sha(original), digest, file + ': original whole body identity');
      assert.equal(native.baselineHashes[file], digest);
      let expected = original;
      if (file === 'lib/observability/ai-crawler.ts') {
        for (const line of ['  CCPUN_VERCEL_PROJECT_IDS,\n', '  vercel_request_id?: string;\n', 'export const CCPUN_WEB_VERCEL_PROJECT_ID = CCPUN_VERCEL_PROJECT_IDS.web;\n',
          '  projectId = process.env.VERCEL_PROJECT_ID,\n', '  environment = process.env.VERCEL_ENV,\n', '  vercelRequestId,\n',
          '  projectId?: string;\n', '  environment?: string;\n', '  vercelRequestId?: string | null;\n']) expected = expected.replace(line, '');
        expected = expected.replace('  const identity = resolveDeploymentIdentity({\n    ...variables,\n    VERCEL_PROJECT_ID: projectId,\n    VERCEL_ENV: projectId ? environment : variables.VERCEL_ENV,\n  }, "web");\n', '  const identity = resolveDeploymentIdentity(variables, "web");\n')
          .replace('    environment: environment?.trim() || variables.CCPUN_APP_ENV?.trim() || "local",\n', '    environment: variables.CCPUN_APP_ENV?.trim() || "local",\n')
          .replace('    ...(requestId || vercelRequestId ? { request_id: requestId || vercelRequestId! } : {}),\n    ...(vercelRequestId ? { vercel_request_id: vercelRequestId } : {}),\n', '    ...(requestId ? { request_id: requestId } : {}),\n');
      } else if (file === 'lib/runtime/web-build-config.mjs') {
        expected = expected.replace('const WEB_VERCEL_PROJECT_ID = "prj_dxwjITkd0av5QiJQv2snUlIASUWu";\n', '')
          .replace('    if (vercelEnvironment === "production" && deploymentProjectId === WEB_VERCEL_PROJECT_ID)\n        return "production";\n    if (vercelEnvironment === "preview" && deploymentProjectId === WEB_VERCEL_PROJECT_ID)\n        return "web-uat";\n    if (!deploymentProjectId)\n        return "development";\n    return "unknown";', '    if (vercelEnvironment || deploymentProjectId)\n        return "unknown";\n    return "development";')
          .replace('    if (provider && provider !== "vercel")\n        return false;\n    if (deploymentProjectId)\n        return deploymentProjectId === WEB_VERCEL_PROJECT_ID;\n    return environment === "development";', '    return !provider && !deploymentProjectId && environment === "development";');
      } else if (file === 'lib/runtime/line-bridge-probe.ts') {
        expected = original.slice(original.indexOf('export const LINE_BRIDGE_PROBE_STATUSES'), original.indexOf('type Variables =')) + "// This former provider-specific transport is retired. Native LINE ingress and\n// one-time system-delivery tokens have separate handlers and are unaffected.\nexport async function probeLineBridgeFromAdmin(..._arguments: unknown[]): Promise<LineBridgeProbeResult> {\n  void _arguments;\n  return { status: \"runtime-unavailable\", webSha: null };\n}\n\nexport async function probeLineBridgeFromWeb(..._arguments: unknown[]): Promise<LineBridgeProbeResult> {\n  void _arguments;\n  return { status: \"unauthorized\", webSha: null };\n}\n";
      } else {
        expected = expected.replace('    NEXT_PUBLIC_CCPUN_VERCEL_PROJECT_ID: process.env.VERCEL_PROJECT_ID?.trim() ?? "",\n    NEXT_PUBLIC_CCPUN_PRODUCTION_ADMIN_VERCEL_PROJECT_ID:\n      process.env.CCPUN_PRODUCTION_ADMIN_VERCEL_PROJECT_ID?.trim() ?? "",\n', '');
        assert.match(expected, /export default withWorkflow\(nextConfig\);/);
      }
      assert.equal(readFileSync(file, 'utf8'), expected, file + ': only exact reviewed retirement changes the whole body');
    } else if (file === 'cms/sanity/schema/index.ts') {
      assert.equal(digest, '1f48f385bff3a64d53a1c5cfa97eeed0f00ad9e0e140e477377a0822ffa01577', 'own original schema registry identity');
      const actual = readFileSync(file, 'utf8');
      const addedImport = 'import { pageSeo } from "./documents/page-seo";\n';
      const addedEntry = '  pageSeo,\n';
      assert.equal(actual.split(addedImport).length, 2, 'one additive page SEO import');
      assert.equal(actual.split(addedEntry).length, 2, 'one additive page SEO registry entry');
      assert.equal(sha(actual.replace(addedImport, '').replace(addedEntry, '')), digest, 'all original schema owners/order remain byte exact');
    } else if (phase3AdminNativeEntries.includes(file)) assert.equal(assertPhase3AdminNativeBoundaries(file, digest), true, file);
    else if (phase3AdminEntries.includes(file)) assert.equal(assertPhase3AdminContracts(file, digest), true, file);
    else if (phase2AdminEntries.includes(file)) assert.equal(assertPhase2AdminComposition(file, digest), true, file);
    else if (file === phase2FoundationPath) assert.equal(assertPhase2FoundationSource(file, digest), true, file);
    else if (file === 'lib/runtime/deployment-lanes.mjs') assert.equal(assertReviewedWebUatBuildProfile(digest), true, file);
    else if (Object.hasOwn(proof.reviewedInheritedUat.retainedSources, file)) assert.equal(assertReviewedUatRetention(file, digest, proof, path => readFileSync(path), 'admin-uat'), true, file);
    else if (proof.reviewedSeoUat.retainedRoutes.includes(file)) assert.equal(assertReviewedSeoUatSource(file, digest, proof, path => readFileSync(path, 'utf8'), 'admin-uat'), true, file);
    else assert.equal(sha(productionBaselineBytes(file)), digest, file);
  }
});


test('new SEO route retention stays distinct from accepted C645 and rejects environment/source/admission drift', () => {
  assert.equal(proof.reviewedSeoUat.sourceCommit, 'd0bcfdaef62f2fae8b3b727836527dd25e22ebbe');
  assert.equal(proof.reviewedSeoUat.retainedRoutes.length, 3);
  assert.equal(Object.keys(proof.reviewedInheritedUat.retainedSources).length, 19);
  assert.equal(Object.keys(proof.reviewedInheritedUat.outputs).length, 180);
  for (const file of proof.reviewedSeoUat.retainedRoutes) {
    const original = proof.protected[file], read = path => readFileSync(path, 'utf8');
    assert.equal(assertReviewedSeoUatSource(file, original, proof, read, 'admin-uat'), true);
    for (const environment of ['production-admin', 'web-uat', 'local-uat', 'unknown', undefined])
      assert.throws(() => assertReviewedSeoUatSource(file, original, proof, read, environment));
    assert.throws(() => assertReviewedSeoUatSource(file, 'unknown', proof, read, 'admin-uat'));
    assert.throws(() => assertReviewedSeoUatSource('unknown.ts', original, proof, read, 'admin-uat'));
    assert.throws(() => assertReviewedSeoUatSource(file, original, proof, path => read(path) + (path === file ? '// tamper' : ''), 'admin-uat'));
    const changed = structuredClone(proof); changed.reviewedSeoUat.sources[file].reviewedSha256 = 'unknown';
    assert.throws(() => assertReviewedSeoUatSource(file, original, changed, read, 'admin-uat'));
  }
});


test('hermetic NODE_ENV test overlay reverses to the exact immutable D0 evidence and rejects all unreviewed variants', () => {
  const file = 'tests/admin/seo-google-provider-readiness.test.ts';
  const read = path => readFileSync(path, 'utf8');
  const record = proof.reviewedSeoUat.testOverlays[file];
  assert.equal(Object.keys(proof.reviewedSeoUat.testOverlays).length, 1);
  assert.equal(record.sourceCommit, 'd0bcfdaef62f2fae8b3b727836527dd25e22ebbe');
  assert.equal(proof.reviewedSeoUat.outputTests[file], 'ab5a3a31cbda12f6da76ec1283d76f857de804f74f8070502e48aa34d011d761');
  assert.equal(record.originalSha256, proof.reviewedSeoUat.outputTests[file]);
  assert.equal(record.after, 'env: { NODE_ENV: "test", PATH: process.env.PATH, NODE_PATH: process.env.NODE_PATH },');
  assert.equal(sha(read(file).replace(record.after, record.before)), record.originalSha256);
  const owner = proof.reviewedSeoUat.retainedRoutes[0], digest = proof.protected[owner];
  assert.equal(assertReviewedSeoUatSource(owner, digest, proof, read, 'admin-uat'), true);
  for (const field of ['sourceCommit', 'originalSha256', 'candidateSha256', 'before', 'after']) {
    const changed = structuredClone(proof); changed.reviewedSeoUat.testOverlays[file][field] = 'unknown';
    assert.throws(() => assertReviewedSeoUatSource(owner, digest, changed, read, 'admin-uat'));
  }
  const unknown = structuredClone(proof); unknown.reviewedSeoUat.testOverlays['unknown.test.ts'] = record;
  assert.throws(() => assertReviewedSeoUatSource(owner, digest, unknown, read, 'admin-uat'));
  const changedOriginal = structuredClone(proof); changedOriginal.reviewedSeoUat.outputTests[file] = record.candidateSha256;
  assert.throws(() => assertReviewedSeoUatSource(owner, digest, changedOriginal, read, 'admin-uat'));
  for (const after of [record.before, record.after.replace('"test"', '"production"'), record.after + '// unrelated test change'])
    assert.throws(() => assertReviewedSeoUatSource(owner, digest, proof,
      path => path === file ? read(path).replace(record.after, after) : read(path), 'admin-uat'));
});


test('Google session admission pins all actual bodies before UAT-only retained-source projection', () => {
  const read = path => readFileSync(path, 'utf8'), record = proof.reviewedGoogleSessionUat;
  assert.equal(record.baselineCommit, '6bfe13a538ee0daeaa3b5c9edaadb3d08fe70327');
  assert.equal(Object.keys(record.currentSourceDigests).length, 14);
  for (const [file, pins] of Object.entries(record.existingSources)) {
    assert.equal(sha(reviewedGoogleSessionBaselineSource(file, proof, read, 'admin-uat')), pins.baseSha256);
    for (const environment of ['production-admin', 'web-uat', 'local-uat', 'unknown', undefined])
      assert.throws(() => reviewedGoogleSessionBaselineSource(file, proof, read, environment));
  }
  const file = 'auth.ts';
  assert.throws(() => reviewedGoogleSessionBaselineSource('unknown.ts', proof, read, 'admin-uat'));
  for (const path of Object.keys(record.currentSourceDigests))
    assert.throws(() => reviewedGoogleSessionBaselineSource(file, proof, name => read(name) + (name === path ? '//tamper' : ''), 'admin-uat'));
  for (const mutate of [
    value => { value.reviewedGoogleSessionUat.baselineCommit = 'unknown'; },
    value => { value.reviewedGoogleSessionUat.existingSources[file].baseSha256 = 'unknown'; },
    value => { value.reviewedGoogleSessionUat.existingSources[file].baselineSource += '//tamper'; },
    value => { value.reviewedGoogleSessionUat.existingSources[file].originalProtectedSha256 = 'unknown'; },
    value => { delete value.reviewedGoogleSessionUat.currentSourceDigests[file]; },
    value => { value.reviewedGoogleSessionUat.currentSourceDigests['unknown.ts'] = 'unknown'; },
    value => { value.reviewedGoogleSessionUat.outputTests.pop(); },
    value => { value.protected[file] = 'unknown'; },
  ]) {
    const changed = structuredClone(proof); mutate(changed);
    assert.throws(() => reviewedGoogleSessionBaselineSource(file, changed, read, 'admin-uat'));
  }
});
