import { assertNativeProviderRetirement, assertReviewedNativeShadowTest, assertReviewedWebUatBuildProfile } from '../qa/phase3-native-provider-proof.mjs';
import { assertPhase3AdminNativeBoundaries, phase3AdminNativeEntries } from '../qa/phase3-admin-native-boundaries-proof.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { productionBaselineBytes } from '../qa/phase1-source-proof.mjs';
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
    if (file === 'features/admin/operations/DeploymentsPage.tsx') {
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
    } else if (phase3AdminNativeEntries.includes(file)) assert.equal(assertPhase3AdminNativeBoundaries(file, digest), true, file);
    else if (phase3AdminEntries.includes(file)) assert.equal(assertPhase3AdminContracts(file, digest), true, file);
    else if (phase2AdminEntries.includes(file)) assert.equal(assertPhase2AdminComposition(file, digest), true, file);
    else if (file === phase2FoundationPath) assert.equal(assertPhase2FoundationSource(file, digest), true, file);
    else if (file === 'lib/runtime/deployment-lanes.mjs') assert.equal(assertReviewedWebUatBuildProfile(digest), true, file);
    else assert.equal(sha(productionBaselineBytes(file)), digest, file);
  }
});
