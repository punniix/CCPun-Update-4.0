import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const sha = source => createHash('sha256').update(source).digest('hex');
const admitted = ['lib/runtime/deployment-identity.ts', 'lib/content/sanity-lane.ts', 'lib/deployment-environment.ts', 'proxy.ts', 'lib/runtime/deployment-contract.ts', 'apps/web/scripts/build-provider.mjs', 'apps/admin/scripts/build-provider.mjs'];
const sealedDependencies = ["apps/admin/scripts/build-provider.mjs", "apps/web/lib/line/private-ingestion.ts", "apps/web/scripts/build-provider.mjs", "lib/admin/auth-config.ts", "lib/admin/environment.ts", "lib/admin/host-routing.ts", "lib/admin/routes.ts", "lib/content/sanity-lane.ts", "lib/deployment-environment.ts", "lib/observability/ai-crawler.ts", "lib/routing/private-surfaces.ts", "lib/runtime/deployment-contract.ts", "lib/runtime/deployment-identity.ts", "lib/runtime/deployment-lanes.mjs", "lib/runtime/line-bridge-probe.ts", "lib/runtime/web-build-config.mjs", "proxy.ts", "scripts/build-root.mjs"];
const reviewedOutputTests = {"tests/phase3-native-provider-parity.test.mjs": "75c251322eba6b798fc0bfe240fa7c78ec2a94ac62e092d25f7f23bb79d8363e", "tests/hostinger-native-app-contract.test.mjs": "47dc70e65c1cbaa8cc45c008d7cc994657de35315953938d507e49d0765436ca", "tests/hostinger-shadow-config.test.mjs": "2b865e4bf79ea0ea541107641a8de56039630b0cc72dfabb304afcc48b1cbe7c"};

const reviewedBaselineBuilders = {"apps/web/scripts/build-provider.mjs": "35f61f91cbc11bcd463ba1d05d3fa91c5873cbdb7ffc81e53fd1bb44986d3c8e", "apps/admin/scripts/build-provider.mjs": "b7250de7598c57900f305aef8b0dbf64986518520026f60d219908cc4ea5b16c"};
const reviewedBuilderPreludes = {"apps/web/scripts/build-provider.mjs": "  // Reject unsupported platform inputs before assets, child processes or export.\n  if (Object.entries(process.env).some(([key, value]) => key.startsWith(\"VERCEL_\") && value?.trim())) throw new Error(\"UNSUPPORTED_PROVIDER_METADATA\");\n  if ([\"vercel\", \"@workflow/world-vercel\"].includes(process.env.WORKFLOW_TARGET_WORLD?.trim() ?? \"\")) throw new Error(\"UNSUPPORTED_WORKFLOW_WORLD\");\n  if (provider && ![\"hostinger\", \"local\"].includes(provider)) throw new Error(\"UNSUPPORTED_BUILD_PROVIDER\");\n  if (isHostinger && process.env.CCPUN_DEPLOYMENT_ROLE?.trim().toLowerCase() !== \"web\") throw new Error(\"HOSTINGER_BUILD_ROLE_REQUIRED\");\n", "apps/admin/scripts/build-provider.mjs": "  // Preserve native compiler behavior; reject retired provider inputs before build work.\n  if (Object.entries(process.env).some(([key, value]) => key.startsWith(\"VERCEL_\") && value?.trim())) throw new Error(\"UNSUPPORTED_PROVIDER_METADATA\");\n  if ([\"vercel\", \"@workflow/world-vercel\"].includes(process.env.WORKFLOW_TARGET_WORLD?.trim() ?? \"\")) throw new Error(\"UNSUPPORTED_WORKFLOW_WORLD\");\n  const provider = process.env.CCPUN_DEPLOYMENT_PROVIDER?.trim().toLowerCase() ?? \"\";\n  if (provider && ![\"hostinger\", \"local\"].includes(provider)) throw new Error(\"UNSUPPORTED_BUILD_PROVIDER\");\n  if (provider === \"hostinger\" && process.env.CCPUN_DEPLOYMENT_ROLE?.trim().toLowerCase() !== \"admin\") throw new Error(\"HOSTINGER_BUILD_ROLE_REQUIRED\");\n"};

// Separate current-source admission for immutable UAT Git derivation and count-only dirty-source diagnostics.
// This is a new builder body, not a recovered historical body or a ledger reseal.
export function assertReviewedUatGitMetadataBuilder(file, source, previousDigest, current = read) {
  if (file !== 'apps/web/scripts/build-provider.mjs' || sha(source) !== 'a72a3d0e2aab13a11574fdfc7f1174a20bb6fb9aa1796af02546ed4374945054') return false;
  assert.equal(previousDigest, '90a606fc6d04947385989fac4f6ce2f43f10d214c4fabc72dcc465e378de84bd', 'historical current builder seal must remain unchanged');
  assert.equal(sha(current('tests/hostinger-runtime-packaging.test.mjs')), '62dc81881d954325399e9a2bb55a8accafde52045fdfc9b670935844500f8bf6', 'actual UAT pin/lane/source/runtime and non-disclosing diagnostics vectors must remain reviewed');
  assert.match(JSON.parse(current('package.json')).scripts['test:foundation-contracts'], /node --test tests\/phase3-native-provider-parity\.test\.mjs tests\/hostinger-native-app-contract\.test\.mjs tests\/hostinger-runtime-packaging\.test\.mjs$/, 'the actual reviewed Web UAT vectors must execute in Foundation CI');
  return true;
}

// Explicit current-source admission for the reviewed native policy retirement.
// No original source is returned to readers. Actual old/current native requests,
// policy/LINE outputs and unsupported-provider denials execute in the registered test.
export function assertNativeProviderRetirement(file, expectedBaselineDigest, proof = JSON.parse(read('qa/phase3-native-provider-parity.json')), current = read) {
  assert.ok(admitted.includes(file), file + ': not an admitted native policy path');
  assert.equal(proof.baselineSha, 'e6ba41dfc874d10f872290030ddce0fae99a3854');
  assert.equal(proof.deployedSourceBaseline, '9ce64717459d37df9477eb9c487a25335bbd1e70');
  assert.deepEqual(proof.admittedProtectedPaths, admitted);
  assert.equal(sha(proof.baselineSources[file]), expectedBaselineDigest, file + ': original protected baseline differs');
  assert.equal(proof.baselineHashes[file], expectedBaselineDigest);
  assert.deepEqual(Object.keys(proof.currentHashes).sort(), sealedDependencies, 'current dependency coverage differs');
  for (const [path, digest] of Object.entries(proof.currentHashes)) {
    const source = current(path);
    if (!assertReviewedUatGitMetadataBuilder(path, source, digest, current)) assert.equal(sha(source), digest, path + ': unreviewed native runtime change');
  }
  for (const [path, prelude] of Object.entries(reviewedBuilderPreludes)) {
    assert.equal(sha(proof.baselineSources[path]), reviewedBaselineBuilders[path], path + ': original builder fixture changed');
    assert.equal(proof.baselineHashes[path], reviewedBaselineBuilders[path]);
    const marker = 'if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {\n';
    assert.equal(proof.baselineSources[path].split(marker).length, 2, path + ': original CLI boundary differs');
    const source = current(path), originalCurrent = proof.baselineSources[path].replace(marker, marker + prelude);
    assert.equal(sha(originalCurrent), proof.currentHashes[path], path + ': original reviewed builder body must remain sealed');
    if (!assertReviewedUatGitMetadataBuilder(path, source, proof.currentHashes[path], current)) assert.equal(source, originalCurrent, path + ': unreviewed compiler/helper/body change');
  }
  for (const path of admitted) assert.ok(proof.currentHashes[path], path + ': missing current source seal');
  for (const path of Object.keys(reviewedOutputTests)) {
    assert.equal(proof.outputTestHashes[path], reviewedOutputTests[path], path + ': reviewed evidence seal differs');
    assert.equal(sha(current(path)), reviewedOutputTests[path], path + ': output coverage changed without review');
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
