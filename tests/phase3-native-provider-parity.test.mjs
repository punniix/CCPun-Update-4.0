import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { loadFixtureModule } from '../qa/phase1-fixture-loader.mjs';

const proof = JSON.parse(readFileSync('qa/phase3-native-provider-parity.json', 'utf8'));
const sha = value => createHash('sha256').update(value).digest('hex');
const old = new Map(Object.entries(proof.baselineSources));
const load = (file, env, before = false) => loadFixtureModule(file, {
  sources: before ? old : new Map(), globals: { process: { env } },
  mocks: new Map([['next/server', { after: () => { throw new Error('Unexpected background work'); } }], ['@neondatabase/serverless', { neon: () => { throw new Error('Unexpected database call'); } }]]),
});
const nativeCases = [];
for (const [role, environment] of [['web','production'],['web','web-uat'],['admin','production-admin'],['admin','admin-uat']]) {
  for (const review of ['0','1']) for (const ref of ['v4-production','codex/hostinger-release-production-' + 'a'.repeat(40)]) {
    const production = environment === 'production' || environment === 'production-admin';
    nativeCases.push({ CCPUN_DEPLOYMENT_PROVIDER: 'hostinger', CCPUN_DEPLOYMENT_ROLE: role, CCPUN_APP_ENV: environment,
      NEXT_PUBLIC_CCPUN_APP_ENV: environment, NEXT_PUBLIC_SANITY_PROJECT_ID: production ? 'kyfxgjnq' : 'ccb9lnw5', NEXT_PUBLIC_SANITY_DATASET: production ? 'production' : 'uat',
      CCPUN_UAT_MODE: review, CCPUN_ENABLE_PRODUCTION_ANALYTICS: role === 'web' && production ? '1' : '0', CCPUN_GIT_REF: ref, CCPUN_GIT_SHA: 'a'.repeat(40), CCPUN_RELEASE_ID: 'synthetic-native-release', NODE_ENV: 'production' });
  }
}
for (const role of ['web','admin']) for (const environment of ['development','local-uat','local-production']) nativeCases.push({
  CCPUN_DEPLOYMENT_PROVIDER: 'local', CCPUN_DEPLOYMENT_ROLE: role, CCPUN_APP_ENV: environment, CCPUN_UAT_MODE: '1', CCPUN_ENABLE_PRODUCTION_ANALYTICS: '0',
  NEXT_PUBLIC_SANITY_PROJECT_ID: environment === 'local-production' ? 'kyfxgjnq' : 'ccb9lnw5', NEXT_PUBLIC_SANITY_DATASET: environment === 'local-production' ? 'production' : 'uat', NODE_ENV: 'development',
});
function observe(env, before) {
  const identity = load('lib/runtime/deployment-identity.ts', env, before);
  const content = load('lib/content/sanity-lane.ts', env, before);
  const contract = load('lib/runtime/deployment-contract.ts', env, before);
  const build = load('lib/runtime/web-build-config.mjs', env, before);
  const lane = contract.getDeploymentLaneByEnvironment(env.CCPUN_APP_ENV);
  return { identity: identity.resolveDeploymentIdentity(env, env.CCPUN_DEPLOYMENT_ROLE), contentEnvironment: content.resolveContentEnvironment(),
    contentAllowed: content.isContentDeploymentAllowed(env.CCPUN_APP_ENV, undefined, env), sanityAllowed: content.isContentSanityLaneAllowed(env.NEXT_PUBLIC_SANITY_PROJECT_ID, env.NEXT_PUBLIC_SANITY_DATASET, env.CCPUN_APP_ENV, undefined, env),
    contract: lane ? contract.deploymentContractFailures(lane, env) : [], webEnvironment: build.resolveWebEnvironment(), webSanityAllowed: build.isWebSanityLaneAllowed(env.NEXT_PUBLIC_SANITY_PROJECT_ID, env.NEXT_PUBLIC_SANITY_DATASET),
    rootPolicy: load('lib/deployment-environment.ts', env, before) };
}

test('actual 95fa fixtures are sealed and every explicit native policy output stays identical', () => {
  assert.equal(proof.baselineSha, '95fa474ade99e621380dd76827830fe7ee136507');
  assert.equal(proof.deployedSourceBaseline, '91171d1a7988885f35e51dcd7b273919e8069057');
  for (const [file, source] of old) assert.equal(sha(source), proof.baselineHashes[file], file);
  assert.equal(nativeCases.length, 22);
  for (const env of nativeCases) for (const target of [undefined, 'local', '@workflow/world-postgres', '/opt/ccpun/ccpun-native-workflow-world.cjs']) {
    const value = { ...env, WORKFLOW_TARGET_WORLD: target };
    assert.deepEqual(observe(value, false), observe(value, true), JSON.stringify(value));
  }
});

test('unsupported providers and retired metadata cannot supply identity, provenance, content or indexing authority', () => {
  for (const patch of [{ CCPUN_DEPLOYMENT_PROVIDER: 'vercel' }, { CCPUN_DEPLOYMENT_PROVIDER: 'future-cloud' },
    { VERCEL_PROJECT_ID: 'retired-project' }, { VERCEL_ENV: 'production' }, { VERCEL_GIT_COMMIT_REF: 'v4-production' }, { VERCEL_GIT_COMMIT_SHA: 'b'.repeat(40) }, { VERCEL_URL: 'retired.example' },
    { WORKFLOW_TARGET_WORLD: 'vercel' }, { WORKFLOW_TARGET_WORLD: ' @workflow/world-vercel ' }]) {
    const env = { ...nativeCases[0], ...patch };
    const identity = load('lib/runtime/deployment-identity.ts', env).resolveDeploymentIdentity(env, 'web');
    assert.equal(identity.valid, false, JSON.stringify(patch));
    assert.equal(identity.provider, 'unknown');
    assert.equal(load('lib/content/sanity-lane.ts', env).isContentDeploymentAllowed('production', env.VERCEL_PROJECT_ID, env), false);
    assert.equal(load('lib/deployment-environment.ts', env).PRODUCTION_ANALYTICS_ENABLED, false);
  }
  const forged = load('lib/runtime/deployment-identity.ts', {}).resolveDeploymentIdentity({ VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_SHA: 'b'.repeat(40), VERCEL_GIT_COMMIT_REF: 'v4-production' }, 'web');
  assert.equal(forged.gitRef, null); assert.equal(forged.gitSha, null); assert.equal(forged.releaseId, null); assert.equal(forged.valid, false);
});

test('native LINE admission preserves original lane, role, release and database rejection outcomes without external calls', () => {
  for (const env of nativeCases.filter(env => env.CCPUN_DEPLOYMENT_ROLE === 'web' && env.CCPUN_DEPLOYMENT_PROVIDER === 'hostinger')) {
    const production = env.CCPUN_APP_ENV === 'production';
    const variables = { ...env, CCPUN_LINE_NEON_PROJECT_ID: production ? 'lively-bar-43618798' : 'young-term-47483330',
      CCPUN_LINE_NEON_BRANCH_ID: production ? 'br-long-resonance-b3ys5xrv' : 'br-crimson-mouse-az7ajkv8', CCPUN_LINE_NEON_DATABASE: 'neondb',
      CCPUN_LINE_INGEST_DATABASE_URL: production ? 'postgresql://ccpun_line_ingress:TEST_ONLY@ep-broad-butterfly-b3ro7u8w.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require' : 'postgresql://ccpun_line_ingress:TEST_ONLY@ep-mute-frost-aztvz394.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require' };
    for (const patch of [{}, { CCPUN_DEPLOYMENT_ROLE: 'admin' }, { CCPUN_GIT_REF: 'not-production' }, { CCPUN_LINE_NEON_DATABASE: 'wrong' }, { CCPUN_LINE_INGEST_DATABASE_URL: undefined }]) {
      const value = { ...variables, ...patch };
      const before = load('apps/web/lib/line/private-ingestion.ts', value, true).resolveLineIngestRuntime(value);
      const after = load('apps/web/lib/line/private-ingestion.ts', value).resolveLineIngestRuntime(value);
      assert.deepEqual(after, before, JSON.stringify({ environment: env.CCPUN_APP_ENV, patch }));
    }
  }
});

test('retired bridge probe returns the current native negative contract and never accesses dependencies or request secrets', async () => {
  const probe = load('lib/runtime/line-bridge-probe.ts', {});
  const forbidden = new Proxy({}, { get() { throw new Error('Retired transport must not read or send'); } });
  assert.deepEqual(await probe.probeLineBridgeFromAdmin(forbidden, forbidden, forbidden), { status: 'runtime-unavailable', webSha: null });
  assert.deepEqual(await probe.probeLineBridgeFromWeb(forbidden, forbidden, forbidden), { status: 'unauthorized', webSha: null });
});

test('mixed root native requests preserve route denials, owner permissions, redirects and response headers', async () => {
  const { createRequire } = await import('node:module');
  const { NextResponse } = createRequire(import.meta.url)('next/server');
  for (const env of nativeCases.filter(env => env.CCPUN_DEPLOYMENT_PROVIDER === 'hostinger')) {
    const host = env.CCPUN_DEPLOYMENT_ROLE === 'admin' ? (env.CCPUN_APP_ENV === 'admin-uat' ? 'admin-test.ccpun.com' : 'admin.ccpun.com') : 'ccpun.com';
    const values = { ...env, AUTH_URL: 'https://' + host };
    for (const role of [null, 'owner', 'viewer']) for (const pathname of ['/', '/dashboard/', '/api/admin/content/', '/studio/', '/api/internal/line/ingest-event']) {
      const request = { nextUrl: new URL('https://' + host + pathname), url: 'https://' + host + pathname,
        headers: new Headers({ host }), method: 'GET', auth: role ? { user: { role } } : null };
      const observations = [];
      for (const before of [true, false]) {
        const candidateModule = loadFixtureModule('proxy.ts', { sources: before ? old : new Map(), globals: { process: { env: values } },
          mocks: new Map([['@/auth', { auth: callback => callback }], ['next/server', { NextResponse }], ['@/lib/observability/ai-crawler', { observeAiCrawlerRequest: () => null }]]) });
        const response = await candidateModule.default(request);
        observations.push({ status: response.status, headers: [...response.headers], body: await response.text() });
      }
      assert.deepEqual(observations[1], observations[0], JSON.stringify({ environment: env.CCPUN_APP_ENV, role, pathname }));
    }
  }
});

test('native source admission rejects unknown paths, baseline drift, runtime tampering and missing output coverage', async () => {
  const { assertNativeProviderRetirement } = await import('../qa/phase3-native-provider-proof.mjs');
  const file = 'lib/runtime/deployment-identity.ts';
  const read = path => readFileSync(path, 'utf8');
  assert.equal(assertNativeProviderRetirement(file, proof.baselineHashes[file]), true);
  assert.throws(() => assertNativeProviderRetirement('features/money-story/engine.ts', proof.baselineHashes[file]));
  assert.throws(() => assertNativeProviderRetirement(file, '0'.repeat(64)));
  assert.throws(() => assertNativeProviderRetirement(file, proof.baselineHashes[file], proof, path => read(path) + (path === file ? '\n// unreviewed change' : '')));
  const missing = structuredClone(proof); delete missing.currentHashes[file];
  assert.throws(() => assertNativeProviderRetirement(file, proof.baselineHashes[file], missing));
  assert.throws(() => assertNativeProviderRetirement(file, proof.baselineHashes[file], proof, path => path === 'package.json' ? JSON.stringify({ scripts: { 'test:foundation-contracts': 'node old-tests.mjs' } }) : read(path)));
  const malformed = structuredClone(proof); malformed.baselineSources[file] += '\n// drift';
  assert.throws(() => assertNativeProviderRetirement(file, proof.baselineHashes[file], malformed));
  const changedOutput = path => read(path) + (path === 'tests/phase3-native-provider-parity.test.mjs' ? '\n// removed output case' : '');
  for (const builder of ['apps/web/scripts/build-provider.mjs', 'apps/admin/scripts/build-provider.mjs']) {
    for (const source of [read(builder) + '\nconst unreviewedBuilderBody = true;\n', read(builder).replace(/^.*UNSUPPORTED_WORKFLOW_WORLD.*\n/m, '')]) {
      const resealed = structuredClone(proof); resealed.currentHashes[builder] = sha(source);
      assert.throws(() => assertNativeProviderRetirement(file, proof.baselineHashes[file], resealed, path => path === builder ? source : read(path)));
    }
  }
  assert.throws(() => assertNativeProviderRetirement(file, proof.baselineHashes[file], proof, changedOutput));
  const path = 'tests/phase3-native-provider-parity.test.mjs';
  const reduced = read(path).replace('  assert.equal(nativeCases.length, 22);', '');
  assert.notEqual(reduced, read(path));
  const resealed = structuredClone(proof); resealed.outputTestHashes[path] = sha(reduced);
  assert.throws(() => assertNativeProviderRetirement(file, proof.baselineHashes[file], resealed, entry => entry === path ? reduced : read(entry)));
  const extraSeal = structuredClone(proof); extraSeal.currentHashes['lib/unreviewed.ts'] = sha('unreviewed');
  assert.throws(() => assertNativeProviderRetirement(file, proof.baselineHashes[file], extraSeal, entry => entry === 'lib/unreviewed.ts' ? 'unreviewed' : read(entry)));

});
