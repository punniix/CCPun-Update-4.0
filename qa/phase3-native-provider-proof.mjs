import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const sha = source => createHash('sha256').update(source).digest('hex');
const admitted = ['lib/runtime/deployment-identity.ts', 'lib/content/sanity-lane.ts', 'lib/deployment-environment.ts', 'proxy.ts', 'lib/runtime/deployment-contract.ts', 'apps/web/scripts/build-provider.mjs', 'apps/admin/scripts/build-provider.mjs'];
const sealedDependencies = ["apps/admin/scripts/build-provider.mjs", "apps/web/lib/line/private-ingestion.ts", "apps/web/scripts/build-provider.mjs", "lib/admin/auth-config.ts", "lib/admin/environment.ts", "lib/admin/host-routing.ts", "lib/admin/routes.ts", "lib/content/sanity-lane.ts", "lib/deployment-environment.ts", "lib/observability/ai-crawler.ts", "lib/routing/private-surfaces.ts", "lib/runtime/deployment-contract.ts", "lib/runtime/deployment-identity.ts", "lib/runtime/deployment-lanes.mjs", "lib/runtime/line-bridge-probe.ts", "lib/runtime/web-build-config.mjs", "proxy.ts", "scripts/build-root.mjs"];
const reviewedOutputTests = {"tests/phase3-native-provider-parity.test.mjs": "034fc4094ed729c7696f36bba36955f417bfc183d3b61fcb651b7504eb382c89", "tests/hostinger-native-app-contract.test.mjs": "41edd506167307164c31c48e38054f8ae64447c98afc054a80846b96e98ec44f", "tests/hostinger-shadow-config.test.mjs": "2b865e4bf79ea0ea541107641a8de56039630b0cc72dfabb304afcc48b1cbe7c"};

const reviewedBaselineBuilders = {"apps/web/scripts/build-provider.mjs": "35f61f91cbc11bcd463ba1d05d3fa91c5873cbdb7ffc81e53fd1bb44986d3c8e", "apps/admin/scripts/build-provider.mjs": "b7250de7598c57900f305aef8b0dbf64986518520026f60d219908cc4ea5b16c"};
const reviewedBuilderPreludes = {"apps/web/scripts/build-provider.mjs": "  // Reject unsupported platform inputs before assets, child processes or export.\n  if (Object.entries(process.env).some(([key, value]) => key.startsWith(\"VERCEL_\") && value?.trim())) throw new Error(\"UNSUPPORTED_PROVIDER_METADATA\");\n  if ([\"vercel\", \"@workflow/world-vercel\"].includes(process.env.WORKFLOW_TARGET_WORLD?.trim() ?? \"\")) throw new Error(\"UNSUPPORTED_WORKFLOW_WORLD\");\n  if (provider && ![\"hostinger\", \"local\"].includes(provider)) throw new Error(\"UNSUPPORTED_BUILD_PROVIDER\");\n  if (isHostinger && process.env.CCPUN_DEPLOYMENT_ROLE?.trim().toLowerCase() !== \"web\") throw new Error(\"HOSTINGER_BUILD_ROLE_REQUIRED\");\n", "apps/admin/scripts/build-provider.mjs": "  // Preserve native compiler behavior; reject retired provider inputs before build work.\n  if (Object.entries(process.env).some(([key, value]) => key.startsWith(\"VERCEL_\") && value?.trim())) throw new Error(\"UNSUPPORTED_PROVIDER_METADATA\");\n  if ([\"vercel\", \"@workflow/world-vercel\"].includes(process.env.WORKFLOW_TARGET_WORLD?.trim() ?? \"\")) throw new Error(\"UNSUPPORTED_WORKFLOW_WORLD\");\n  const provider = process.env.CCPUN_DEPLOYMENT_PROVIDER?.trim().toLowerCase() ?? \"\";\n  if (provider && ![\"hostinger\", \"local\"].includes(provider)) throw new Error(\"UNSUPPORTED_BUILD_PROVIDER\");\n  if (provider === \"hostinger\" && process.env.CCPUN_DEPLOYMENT_ROLE?.trim().toLowerCase() !== \"admin\") throw new Error(\"HOSTINGER_BUILD_ROLE_REQUIRED\");\n"};

// Exact reviewed Hostinger config-loader repair; original proof records stay frozen.
const reviewedAdminConfigBuild = {
  'apps/admin/scripts/build-provider.mjs': { before: '619fa6263ac85abb328b374319154a3d5f91bfa620657c808e0a507e4122b6e7', after: '9ef7eeb3cfa9f08b182a1036dd845231e8301553b25c772f2c2e42a9b0c60a9e' },
  'tests/hostinger-native-app-contract.test.mjs': { before: '41edd506167307164c31c48e38054f8ae64447c98afc054a80846b96e98ec44f', after: '413d7991b78b2b325f10dc73a1b9ec04330c14ebacb1f64be9a6144a13759fbd' },
  'scripts/build-root.mjs': { before: '00d8f879c1651f2c6e8f1c061ed187f47e29c7ce69b6887c4d627b20b10644d8', after: 'b3640b1f1dfd80bbe1cd59aed0b3e857398ce9ae374652c92c098260f39beb0f' },
  'apps/web/scripts/build-provider.mjs': { before: '90a606fc6d04947385989fac4f6ce2f43f10d214c4fabc72dcc465e378de84bd', after: '629f77a0037613a9acb7cdf5e28cd141c6bdb2c921a7ecee79dceca0d07092a4' },
  'tests/hostinger-shadow-config.test.mjs': { before: '2b865e4bf79ea0ea541107641a8de56039630b0cc72dfabb304afcc48b1cbe7c', after: '4c48e59ed5de59304237e09605e3857fe497cc88012447ade5a7cf2623742833' },
};
function assertCurrentNativeDigest(path, body, originalDigest) {
  const repair = reviewedAdminConfigBuild[path];
  if (repair) assert.equal(originalDigest, repair.before, path + ': original repair seal differs');
  assert.equal(sha(body), repair?.after ?? originalDigest, path + ': unreviewed native runtime change');
}

// Explicit current-source admission for the reviewed native policy retirement.
// No original source is returned to readers. Actual old/current native requests,
// policy/LINE outputs and unsupported-provider denials execute in the registered test.
export function assertNativeProviderRetirement(file, expectedBaselineDigest, proof = JSON.parse(read('qa/phase3-native-provider-parity.json')), current = read) {
  assert.ok(admitted.includes(file), file + ': not an admitted native policy path');
  assert.equal(proof.baselineSha, '95fa474ade99e621380dd76827830fe7ee136507');
  assert.equal(proof.deployedSourceBaseline, '91171d1a7988885f35e51dcd7b273919e8069057');
  assert.deepEqual(proof.admittedProtectedPaths, admitted);
  assert.equal(sha(proof.baselineSources[file]), expectedBaselineDigest, file + ': original protected baseline differs');
  assert.equal(proof.baselineHashes[file], expectedBaselineDigest);
  assert.deepEqual(Object.keys(proof.currentHashes).sort(), sealedDependencies, 'current dependency coverage differs');
  for (const [path, digest] of Object.entries(proof.currentHashes)) assertCurrentNativeDigest(path, current(path), digest);
  for (const [path, prelude] of Object.entries(reviewedBuilderPreludes)) {
    assert.equal(sha(proof.baselineSources[path]), reviewedBaselineBuilders[path], path + ': original builder fixture changed');
    assert.equal(proof.baselineHashes[path], reviewedBaselineBuilders[path]);
    const marker = 'if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {\n';
    assert.equal(proof.baselineSources[path].split(marker).length, 2, path + ': original CLI boundary differs');
    const originalBody = proof.baselineSources[path].replace(marker, marker + prelude);
    if (reviewedAdminConfigBuild[path]) assertCurrentNativeDigest(path, current(path), sha(originalBody));
    else assert.equal(current(path), originalBody, path + ': unreviewed compiler/helper/body change');
  }
  for (const path of admitted) assert.ok(proof.currentHashes[path], path + ': missing current source seal');
  for (const path of Object.keys(reviewedOutputTests)) {
    assert.equal(proof.outputTestHashes[path], reviewedOutputTests[path], path + ': reviewed evidence seal differs');
    assertCurrentNativeDigest(path, current(path), reviewedOutputTests[path]);
    assert.ok(JSON.parse(current('package.json')).scripts[path === 'tests/hostinger-shadow-config.test.mjs' ? 'test:hostinger' : 'test:foundation-contracts'].includes(path), path + ': output tests are not registered');
  }
  const identity = current('lib/runtime/deployment-identity.ts');
  assert.match(identity, /DEPLOYMENT_PROVIDERS = \["hostinger", "local", "unknown"\]/);
  assert.doesNotMatch(identity, /provider === "vercel"|normalized === "vercel"|inferredVercelEnvironment|roleForVercelProject/);
  assert.match(identity, /key\.startsWith\("VERCEL_"\)/);
  for (const path of ['lib/content/sanity-lane.ts', 'lib/runtime/web-build-config.mjs']) assert.doesNotMatch(current(path), /provider === "vercel"|vercel === "production"|vercel === "preview"|vercelEnvironment === "production"|vercelEnvironment === "preview"/);
  assert.doesNotMatch(current('lib/runtime/line-bridge-probe.ts'), /fetch\(|verifyToken\(|bearerToken|vercel-service-auth/);
  return true;
}

export function assertReviewedNativeShadowTest(expectedBaselineDigest, proof = JSON.parse(read('qa/phase3-native-provider-parity.json')), current = read) {
  const path = 'tests/hostinger-shadow-config.test.mjs';
  assert.equal(sha(proof.baselineSources[path]), expectedBaselineDigest);
  assert.equal(proof.baselineHashes[path], expectedBaselineDigest);
  assert.equal(proof.outputTestHashes[path], reviewedOutputTests[path]);
  assert.equal(sha(current(path)), reviewedOutputTests[path]);
  assert.equal(JSON.parse(current('package.json')).scripts['test:hostinger'], 'node --test ' + path);
  return true;
}

export function assertReviewedWebUatBuildProfile(expectedBaselineDigest, proof = JSON.parse(read('qa/phase3-native-provider-parity.json')), current = read) {
  const file = 'lib/runtime/deployment-lanes.mjs';
  const original = proof.baselineSources[file];
  assert.equal(sha(original), expectedBaselineDigest, 'original lane contract differs');
  assert.equal(proof.baselineHashes[file], expectedBaselineDigest);
  let expected = original;
  for (const [before, after] of [
    ['"rootDirectory": "apps/web"', '"rootDirectory": "./"'],
    ['"outputDirectory": ".next/standalone"', '"outputDirectory": "apps/web/.next/standalone"'],
    ['"entryFile": ".next/standalone/server.js"', '"entryFile": "apps/web/.next/standalone/server.js"'],
  ]) {
    assert.equal(expected.split(before).length, 2, 'profile field must occur exactly once');
    expected = expected.replace(before, after);
  }
  const actual = current(file);
  assert.equal(actual, expected, 'only the three reviewed Web UAT profile fields may change');
  assert.equal(sha(actual), proof.currentHashes[file], 'current lane contract seal differs');
  return true;
}
