import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadFixtureModule } from '../qa/phase1-fixture-loader.mjs';
import { assertPhase3AdminNativeBoundaries, phase3AdminNativeEntries } from '../qa/phase3-admin-native-boundaries-proof.mjs';

const proof = JSON.parse(readFileSync('qa/phase3-admin-native-boundaries.json', 'utf8'));
// Own original native behavior executes its complete before dependency graph.
const commonBefore = JSON.parse(readFileSync('qa/phase3-native-provider-parity.json', 'utf8'));
assert.equal(commonBefore.baselineSha, '70ed4ab00fe9533c88ca5bd3342134195ee70341');
assert.equal(proof.baseline, '3eefd7e5fbb801bab0f8991e9333790136e77df9');
const sources = new Map([...Object.entries(commonBefore.baselineSources), ...Object.entries(proof.baselineSources)]);
const sha = text => createHash('sha256').update(text).digest('hex');
const globals = env => ({ process: { env }, console: { log() {}, error() {}, warn() {} } });
function load(file, env, old = false, mocks = new Map()) {
  return loadFixtureModule(file, { sources: old ? sources : new Map(), globals: globals(env), mocks });
}
const native = (environment, provider = 'hostinger') => ({
  CCPUN_APP_ENV: environment, CCPUN_DEPLOYMENT_PROVIDER: provider, CCPUN_DEPLOYMENT_ROLE: 'admin',
  CCPUN_GIT_SHA: 'a'.repeat(40), CCPUN_GIT_REF: environment === 'production-admin' ? 'v4-production' : 'admin/native-contract',
  CCPUN_RELEASE_ID: 'native-fixture', AUTH_URL: 'https://admin.ccpun.com',
});

class FixtureResponse extends Response {
  static json(value, init) { return new FixtureResponse(JSON.stringify(value), init); }
  static next() { return new FixtureResponse(null, { headers: { 'x-middleware-next': '1' } }); }
  static redirect(url) { return new FixtureResponse(null, { status: 307, headers: { location: String(url) } }); }
}

test('retired LINE bridge methods retain exact native private404 without auth, payload, SDK, DB or fetch', async () => {
  for (const file of phase3AdminNativeEntries.slice(0, 2)) {
    for (const environment of ['production-admin', 'admin-uat']) {
      const env = native(environment); const calls = [];
      const mocks = new Map([
        ['next/server', { NextResponse: FixtureResponse }],
        ['@/lib/admin/line/web-service-auth', { async isProductionWebServiceRequestAuthorized() { calls.push('oidc'); throw new Error('must not call'); } }],
        ['@/lib/admin/line/private-ingestion', { probeLinePrivateIngestRuntime() { calls.push('db'); throw new Error('must not call'); }, resolveLineIngestRuntime() { calls.push('runtime'); throw new Error('must not call'); }, createLinePrivateIngestor() { calls.push('write'); throw new Error('must not call'); } }],
        ['@/lib/admin/line/encrypted-ingest', { encryptedLineEventSchema: {}, readEncryptedLineEventBody() { calls.push('body'); throw new Error('must not call'); } }],
      ]);
      for (const old of [true, false]) {
        const handler = load(file, env, old, mocks);
        assert.equal(handler.runtime, 'nodejs'); assert.equal(handler.dynamic, 'force-dynamic');
        for (const method of file.includes('bridge-health') ? ['HEAD', 'GET'] : ['POST', 'GET']) {
          const result = await handler[method](new Proxy({}, { get() { throw new Error('no request reads'); } }));
          assert.equal(result.status, 404); assert.equal(await result.text(), '');
          assert.deepEqual(Object.fromEntries(result.headers), {
            'cache-control': 'private, no-cache, no-store, max-age=0, must-revalidate',
            'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff',
            'x-robots-tag': 'noindex, nofollow, noarchive',
          });
        }
      }
      assert.deepEqual(calls, []);
    }
    const handler = load(file, { CCPUN_DEPLOYMENT_PROVIDER: 'vercel' }, false, new Map([['next/server', { NextResponse: FixtureResponse }]]));
    for (const method of file.includes('bridge-health') ? ['HEAD', 'GET'] : ['POST', 'GET']) assert.equal((await handler[method]()).status, 404);
  }
});

test('explicit Hostinger/local surface, dataset, read, write and labels preserve own native outputs', () => {
  const file = 'lib/admin/environment.ts'; let comparisons = 0;
  for (const environment of ['development', 'web-uat', 'local-uat', 'local-production', 'lab', 'uat', 'admin-uat', 'production-admin', 'production', 'unknown']) {
    for (const provider of ['hostinger', 'local', undefined]) {
      const env = native(environment, provider); if (provider === undefined) delete env.CCPUN_DEPLOYMENT_PROVIDER;
      for (const flag of [undefined, '0', '1', 'true']) {
        env.CCPUN_LOCAL_PRODUCTION_DRAFT_WRITES = flag;
        const before = load(file, env, true), after = load(file, env);
        for (const fn of ['getAdminEnvironment', 'getEnvironmentLabel', 'isProductionEnvironment', 'isLocalProductionDraftWriteEnabled']) {
          assert.deepEqual(after[fn](), before[fn](), fn); comparisons++;
        }
        for (const fn of ['isDeploymentProjectAllowed', 'isAdminSurfaceAllowed', 'isAdminMutationEnvironment']) {
          assert.equal(after[fn](environment, undefined, undefined, env), before[fn](environment, undefined, undefined, env), fn); comparisons++;
        }
        for (const dataset of ['uat', 'production', undefined, 'UAT']) for (const project of ['ccb9lnw5', 'kyfxgjnq', undefined, 'wrong']) {
          for (const fn of ['isSanityLaneAllowed', 'isAdminReadDataPlaneAllowed', 'isAdminDataPlaneAllowed', 'isStudioDataPlaneAllowed']) {
            const args = [dataset, environment, undefined, undefined, project, env];
            assert.equal(after[fn](...args), before[fn](...args), fn); comparisons++;
          }
        }
      }
    }
  }
  assert.equal(comparisons, 8520);
  const retired = load(file, {});
  for (const legacy of ['preview', 'production']) {
    assert.equal(retired.resolveAdminEnvironment(undefined, legacy, 'prj_6tuUxJxYbQ4mpF7sMgNWx2p2jowN'), 'unknown');
    for (const environment of ['admin-uat', 'production-admin', 'web-uat', 'production']) assert.equal(retired.isDeploymentProjectAllowed(environment, 'prj_6tuUxJxYbQ4mpF7sMgNWx2p2jowN', undefined, { CCPUN_DEPLOYMENT_PROVIDER: 'vercel' }), false);
  }
});

test('native LINE SQL/crypto body and Social/operations/SEO data-plane decisions remain unchanged', () => {
  const mocks = new Map([['@neondatabase/serverless', { neon() { throw new Error('no database'); } }], ['next/server', { after() { throw new Error('no async side effect'); } }]]);
  let comparisons = 0;
  for (const environment of ['admin-uat', 'production-admin', 'local-uat', 'local-production', 'unknown']) {
    for (const provider of ['hostinger', 'local']) {
      const env = native(environment, provider);
      const file = 'lib/admin/line/private-ingestion.ts';
      const before = load(file, env, true, mocks), after = load(file, env, false, mocks);
      const lane = before.LINE_INGEST_LANES[environment === 'production-admin' ? 'production' : 'uat'];
      Object.assign(env, { CCPUN_NEON_PROJECT_ID: lane.projectId, CCPUN_NEON_BRANCH_ID: lane.branchId, CCPUN_NEON_DATABASE: lane.database,
        CCPUN_ADMIN_DATABASE_URL: `postgresql://${lane.runtimeRole}:synthetic@${lane.endpointId}.${lane.hostSuffix}/${lane.database}?sslmode=require` });
      for (const change of [{}, { CCPUN_NEON_BRANCH_ID: 'wrong' }, { CCPUN_ADMIN_DATABASE_URL: 'https://invalid' }, { CCPUN_NEON_DATABASE: 'wrong' }, { CCPUN_GIT_REF: 'wrong' }, { CCPUN_DEPLOYMENT_ROLE: 'web' }]) {
        const input = { ...env, ...change }; assert.deepEqual(after.resolveLineIngestRuntime(input), before.resolveLineIngestRuntime(input)); comparisons++;
      }
      const operationsFile = 'lib/admin/operations/foundation.ts'; const oldOps = load(operationsFile, {}, true), newOps = load(operationsFile, {});
      for (const change of [{}, { connectionString: 'invalid' }, { branchId: 'wrong' }, { gitBranch: 'wrong' }, { deploymentRole: 'web' }]) {
        const input = { environment, deploymentProvider: provider, deploymentRole: 'admin', gitSha: env.CCPUN_GIT_SHA, gitBranch: env.CCPUN_GIT_REF, releaseId: env.CCPUN_RELEASE_ID,
          projectId: lane.projectId, branchId: lane.branchId, database: lane.database, connectionString: env.CCPUN_ADMIN_DATABASE_URL, ...change };
        assert.deepEqual(newOps.resolveAdminOperationsRuntimeIdentity(input), oldOps.resolveAdminOperationsRuntimeIdentity(input)); comparisons++;
      }
      const socialFile = 'lib/admin/social/runtime.ts'; const oldSocial = load(socialFile, {}, true), newSocial = load(socialFile, {});
      const dataProject = environment === 'production-admin' ? 'kyfxgjnq' : 'ccb9lnw5';
      const input = { environment, deploymentProvider: provider, deploymentRole: 'admin', gitSha: env.CCPUN_GIT_SHA, gitBranch: env.CCPUN_GIT_REF, releaseId: env.CCPUN_RELEASE_ID,
        sanityProjectId: dataProject, sanityDataset: environment === 'production-admin' ? 'production' : 'uat',
        neonProjectId: lane.projectId, neonBranchId: lane.branchId, neonEndpointId: lane.endpointId, neonDatabase: lane.database,
        connectionString: `postgresql://ccpun_social_runtime:synthetic@${lane.endpointId}.${lane.hostSuffix}/${lane.database}` };
      for (const change of [{}, { gitBranch: 'wrong' }, { sanityProjectId: 'wrong' }, { connectionString: 'https://invalid' }, { deploymentRole: 'web' }]) {
        assert.deepEqual(newSocial.resolveSocialRuntimeDescriptor({ ...input, ...change }), oldSocial.resolveSocialRuntimeDescriptor({ ...input, ...change })); comparisons++;
      }
      const seoFile = 'lib/admin/seo-intelligence/foundation.ts'; const oldSeo = load(seoFile, {}, true), newSeo = load(seoFile, {});
      for (const flag of ['1', '0', 'true', undefined]) {
        const seoInput = { ...input, flag }; assert.equal(newSeo.isSeoIntelligenceEnabled(seoInput), oldSeo.isSeoIntelligenceEnabled(seoInput)); comparisons++;
      }
      for (const retired of ['lib/admin/social/runtime.ts', 'lib/admin/operations/foundation.ts', 'lib/admin/seo-intelligence/foundation.ts']) {
        const actual = load(retired, {}, false);
        if (retired.includes('/social/')) assert.equal(actual.resolveSocialRuntimeDescriptor({ ...input, deploymentProvider: 'vercel', projectId: 'prj_retired' }), null);
        if (retired.includes('/operations/')) assert.equal(actual.resolveAdminOperationsRuntimeIdentity({ environment, connectionString: env.CCPUN_ADMIN_DATABASE_URL, deploymentProvider: 'vercel' }), null);
        if (retired.includes('/seo-intelligence/')) assert.equal(actual.isSeoIntelligenceEnabled({ ...input, flag: '1', deploymentProvider: 'vercel' }), false);
      }
    }
  }
  assert.equal(comparisons, 200);
});

test('native host classifier and actual proxy preserve host/origin/auth/capability outputs', async () => {
  const hostFile = 'lib/admin/host-routing.ts';
  const before = load(hostFile, {}, true), after = load(hostFile, {});
  let hostComparisons = 0;
  for (const environment of ['development', 'local-uat', 'local-production', 'admin-uat', 'production-admin', 'production', 'unknown']) {
    for (const host of ['admin.ccpun.com', 'admin-test.ccpun.com', 'candidate.example', 'localhost:3000', '127.0.0.1:3000', 'ccpun.com', null]) {
      assert.equal(after.isAdminRequestBoundary({ environment, host }), before.isAdminRequestBoundary({ environment, host }));
      assert.equal(after.isExactAdminPreviewOrigin({ environment, host }), before.isExactAdminPreviewOrigin({ environment, host })); hostComparisons++;
    }
  }
  assert.equal(hostComparisons, 49);
  for (const host of ['ccpun-admin.vercel.app', 'ccpun-admin-preview-team.vercel.app']) assert.equal(after.isKnownAdminDeploymentHost(host), false);
  const file = 'apps/admin/proxy.ts'; let proxyComparisons = 0, preserved = 0, retired = 0, sdkAllowed = 0, sdkDenied = 0;
  const retiredBypassCases = new Set([
    'local-uat:full:null:admin.ccpun.com', 'local-uat:full:null:evil.example',
    'local-uat:full:owner:admin.ccpun.com', 'local-uat:full:owner:evil.example',
    'local-uat:full:viewer:admin.ccpun.com', 'local-uat:full:viewer:evil.example',
    'local-production:full:null:admin.ccpun.com', 'local-production:full:owner:admin.ccpun.com',
    'local-production:full:viewer:admin.ccpun.com',
  ]);
  for (const environment of ['admin-uat', 'production-admin', 'local-uat', 'local-production']) {
    for (const profile of ['full', 'editorial']) {
      const env = { ...native(environment, environment.startsWith('local-') ? 'local' : 'hostinger'),
        CCPUN_ADMIN_CAPABILITY_PROFILE: profile, NEXT_PUBLIC_CCPUN_ADMIN_CAPABILITY_PROFILE: profile,
        NEXT_PUBLIC_CCPUN_APP_ENV: environment, NEXT_PUBLIC_SANITY_PROJECT_ID: environment.includes('production') ? 'kyfxgjnq' : 'ccb9lnw5',
        NEXT_PUBLIC_SANITY_DATASET: environment.includes('production') ? 'production' : 'uat' };
      const mocks = new Map([['@/auth', { auth: fn => fn }], ['next/server', { NextResponse: FixtureResponse }],
        ['@/lib/ai-crawler-log', { observeAiCrawlerRequest() {} }]]);
      const oldProxy = load(file, env, true, mocks), newProxy = load(file, env, false, mocks);
      for (const path of ['/', '/dashboard/', '/login/', '/api/admin/session/', '/api/internal/line/ingest/', '/api/internal/line/system-delivery/dispatch/', '/api/internal/line/ingest-event/', '/studio/', '/blog/example/', '/definitely-missing/', '/.well-known/workflow/v1/flow']) {
        for (const role of [null, 'owner', 'viewer']) for (const host of ['admin.ccpun.com', 'evil.example']) {
          const url = new URL('https://admin.ccpun.com' + path);
          const request = { nextUrl: url, url: url.href, method: 'GET', headers: new Headers({ host, 'user-agent': 'synthetic-test' }), auth: role ? { user: { role } } : null };
          const oldResult = await oldProxy.adminProxy(request), newResult = await newProxy.adminProxy(request);
          const key = environment + ':' + profile + ':' + role + ':' + host;
          const actual = { status: newResult.status, headers: Object.fromEntries(newResult.headers), text: await newResult.text() };
          const original = { status: oldResult.status, headers: Object.fromEntries(oldResult.headers), text: await oldResult.text() };
          if (path === '/.well-known/workflow/v1/flow' && retiredBypassCases.has(key)) {
            assert.deepEqual(original, { status: 200, headers: { 'x-middleware-next': '1' }, text: '' }, 'exact old full-profile bypass:' + key);
            assert.deepEqual(actual, { status: 404, headers: { 'content-type': 'text/plain;charset=UTF-8' }, text: 'Not Found' }, 'same existing browser fence after bypass retirement:' + key);
            retired++;
          } else {
            assert.deepEqual(actual, original, key + ':' + path); preserved++;
          }
          if (path === '/.well-known/workflow/v1/flow') {
            if (actual.status === 200) sdkAllowed++; else sdkDenied++;
          }
          proxyComparisons++;
        }
      }
    }
  }
  assert.equal(proxyComparisons, 528);
  assert.equal(preserved, 519); assert.equal(retired, 9);
  assert.equal(sdkAllowed, 3); assert.equal(sdkDenied, 45);
});

test('Hostinger deployment reader preserves actual native models, fetch traces and safe errors; retired providers never fetch', async (context) => {
  const file = 'lib/admin/operations/deployment-read-model.ts'; let trace = [], behavior;
  context.mock.method(AbortSignal, 'timeout', delay => { trace.push(['timeout', delay]); return new AbortController().signal; });
  context.mock.method(globalThis, 'fetch', async (url, init) => {
    trace.push(['fetch', String(url), init.headers, init.next, init.signal instanceof AbortSignal]);
    if (behavior === 'throw') throw new Error('private credential detail must not escape');
    if (behavior === 'timeout') throw new DOMException('private timeout detail', 'TimeoutError');
    if (behavior === 'http503') return new Response(null, { status: 503 });
    if (behavior === 'invalid') return Response.json({ check_runs: [{ invalid: true }] });
    const check = { name: 'Foundation', head_sha: 'a'.repeat(40), status: 'completed', conclusion: 'success', completed_at: '2026-10-12T00:00:00.000Z', app: { slug: 'github-actions' } };
    return Response.json({ check_runs: [check, { ...check, head_sha: 'b'.repeat(40) }, { ...check, app: { slug: 'vercel' } },
      { ...check, name: 'queued', status: 'queued', conclusion: null, completed_at: null }, { ...check, name: 'failure', conclusion: 'failure' }] });
  });
  let compared = 0;
  for (const environment of ['admin-uat', 'production-admin']) for (const host of ['admin.ccpun.com', 'admin-test.ccpun.com', 'evil.example', null]) {
    for (const mode of ['valid', 'throw', 'timeout', 'http503', 'invalid']) {
      behavior = mode;
      const env = native(environment); trace = [];
      const before = await load(file, env, true).readAdminDeployments(host, env); const oldTrace = structuredClone(trace); trace = [];
      const after = await load(file, env).readAdminDeployments(host, env);
      assert.deepEqual(after, before); assert.deepEqual(trace, oldTrace); assert.doesNotMatch(JSON.stringify(after), /private credential|private timeout/); compared++;
      if (mode === 'valid') { assert.equal(after.status, 'partial'); assert.equal(after.history.length, 0); assert.deepEqual(after.githubChecks.map(check => check.name), ['Foundation', 'queued', 'failure']); }
    }
    for (const change of [{ CCPUN_GIT_SHA: 'wrong' }, { CCPUN_GIT_REF: 'wrong' }, { CCPUN_DEPLOYMENT_ROLE: 'web' }, { NEXT_PUBLIC_CCPUN_GIT_SHA: 'b'.repeat(40) }]) {
      behavior = 'valid'; const env = { ...native(environment), ...change }; trace = [];
      const before = await load(file, env, true).readAdminDeployments(host, env); const oldTrace = structuredClone(trace); trace = [];
      const after = await load(file, env).readAdminDeployments(host, env); assert.deepEqual(after, before); assert.deepEqual(trace, oldTrace); compared++;
    }
  }
  assert.equal(compared, 72);
  for (const patch of [
    { CCPUN_DEPLOYMENT_PROVIDER: 'vercel' },
    { CCPUN_DEPLOYMENT_PROVIDER: undefined, VERCEL_PROJECT_ID: 'prj_6tuUxJxYbQ4mpF7sMgNWx2p2jowN', VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'v4-production', VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40) },
    { CCPUN_DEPLOYMENT_PROVIDER: 'unknown' },
  ]) {
    const env = { ...native('production-admin'), ...patch }; trace = [];
    const after = await load(file, env).readAdminDeployments('admin.ccpun.com', env);
    assert.equal(after.status, 'unavailable'); assert.equal(after.vercelEnvironment, null); assert.equal(after.region, null); assert.equal(after.projectProductionUrl, null);
    assert.deepEqual(after.history, []); assert.deepEqual(after.githubChecks, []); assert.deepEqual(trace, []);
  }
});

test('native article lane identity, Neon URL and schedule schemas preserve existing actual contracts', () => {
  const file = 'lib/admin/operations/article-schedule-contract.ts'; let comparisons = 0;
  for (const environment of ['admin-uat', 'production-admin', 'local-uat', 'local-production', 'development', 'unknown']) for (const provider of ['hostinger', 'local']) {
    const env = native(environment, provider); const before = load(file, env, true), after = load(file, env);
    assert.deepEqual(after.SCHEDULER_LANES, before.SCHEDULER_LANES);
    const lane = before.SCHEDULER_LANES[environment === 'production-admin' ? 'production' : 'uat'];
    Object.assign(env, { NEXT_PUBLIC_SANITY_PROJECT_ID: lane.sanityProjectId, NEXT_PUBLIC_SANITY_DATASET: lane.dataset,
      CCPUN_NEON_PROJECT_ID: lane.projectId, CCPUN_NEON_BRANCH_ID: lane.branchId, CCPUN_NEON_DATABASE: 'neondb',
      CCPUN_ADMIN_DATABASE_URL: `postgresql://ccpun_admin_runtime:synthetic@${lane.endpointId}.${lane.hostSuffix}/neondb?sslmode=require` });
    for (const change of [{}, { CCPUN_NEON_BRANCH_ID: 'wrong' }, { CCPUN_NEON_DATABASE: 'postgres' }, { NEXT_PUBLIC_SANITY_PROJECT_ID: 'wrong' },
      { CCPUN_GIT_REF: 'wrong' }, { CCPUN_DEPLOYMENT_ROLE: 'web' }, { CCPUN_ADMIN_DATABASE_URL: env.CCPUN_ADMIN_DATABASE_URL.replace('ccpun_admin_runtime', 'neondb_owner') },
      { CCPUN_ADMIN_DATABASE_URL: env.CCPUN_ADMIN_DATABASE_URL.replace('.neon.tech/', '.neon.tech.attacker.test/') }, { CCPUN_ADMIN_DATABASE_URL: env.CCPUN_ADMIN_DATABASE_URL.replace('sslmode=require', 'sslmode=disable') }]) {
      const input = { ...env, ...change }; assert.equal(after.resolveArticleSchedulerLane(input), before.resolveArticleSchedulerLane(input)); comparisons++;
    }
    assert.equal(after.resolveArticleSchedulerLane({ ...env, CCPUN_DEPLOYMENT_PROVIDER: 'vercel', VERCEL_PROJECT_ID: 'prj_6tuUxJxYbQ4mpF7sMgNWx2p2jowN', VERCEL_ENV: 'production' }), null);
  }
  assert.equal(comparisons, 108);
  const before = load(file, {}, true), after = load(file, {});
  const valid = { scheduledLocal: '2026-10-12T12:00', draftRevision: 'draft-1', publishedRevision: null, expectedGeneration: null, expectedVersion: 0, requestId: '11111111-1111-4111-8111-111111111111' };
  for (const input of [{}, valid, { ...valid, unknown: true }, { ...valid, expectedVersion: 1 }, { ...valid, scheduledLocal: 'invalid' }, { ...valid, expectedVersion: NaN }, { ...valid, requestId: 'wrong' }]) {
    const old = before.scheduleRequestSchema.safeParse(input), current = after.scheduleRequestSchema.safeParse(input);
    assert.equal(current.success, old.success);
    assert.deepEqual(current.success ? current.data : current.error.issues, old.success ? old.data : old.error.issues);
  }
});

test('retired platform exporter always denies without request, identity or variables reads', () => {
  const loaded = load('lib/admin/migrations/google-data-transfer.ts', {});
  const opaque = new Proxy({}, { get() { throw new Error('no transport reads'); } });
  assert.throws(() => loaded.migrationOwnerMetadata(opaque, opaque, opaque), /^Error: MIGRATION_DENIED$/);
});

test('native proof retains original protections and rejects tampering or additional admissions', () => {
  assert.equal(phase3AdminNativeEntries.length, 14);
  for (const file of phase3AdminNativeEntries) assert.equal(assertPhase3AdminNativeBoundaries(file, proof.originalHashes[file]), true);
  for (const file of phase3AdminNativeEntries.slice(2, 4)) assert.equal(existsSync(file), false);
  const broken = structuredClone(proof); broken.baseline = 'wrong';
  assert.throws(() => assertPhase3AdminNativeBoundaries(phase3AdminNativeEntries[0], proof.originalHashes[phase3AdminNativeEntries[0]], { proof: broken }));
  assert.throws(() => assertPhase3AdminNativeBoundaries('lib/admin/sanity-control.ts', 'wrong'));
  const wrongOriginal = structuredClone(proof); wrongOriginal.originalHashes[phase3AdminNativeEntries[0]] = 'wrong';
  assert.throws(() => assertPhase3AdminNativeBoundaries(phase3AdminNativeEntries[0], proof.originalHashes[phase3AdminNativeEntries[0]], { proof: wrongOriginal }));
  const wrongSnapshot = structuredClone(proof); wrongSnapshot.baselineSources[phase3AdminNativeEntries[0]] += '// changed';
  assert.throws(() => assertPhase3AdminNativeBoundaries(phase3AdminNativeEntries[0], proof.originalHashes[phase3AdminNativeEntries[0]], { proof: wrongSnapshot }));
  const missingAssertion = readFileSync(proof.outputEvidence.file, 'utf8').replace("assert.equal(comparisons, 8520);", '');
  const alteredEvidence = structuredClone(proof); alteredEvidence.outputEvidence.sha256 = sha(missingAssertion);
  assert.throws(() => assertPhase3AdminNativeBoundaries(phase3AdminNativeEntries[0], proof.originalHashes[phase3AdminNativeEntries[0]], {
    proof: alteredEvidence, read: p => p === proof.outputEvidence.file ? missingAssertion : readFileSync(p, 'utf8'),
  }));
  const file = 'lib/admin/line/private-ingestion.ts'; const altered = readFileSync(file, 'utf8') + '\n// tamper';
  const resealed = structuredClone(proof); resealed.currentHashes[file] = sha(altered);
  assert.throws(() => assertPhase3AdminNativeBoundaries(file, proof.originalHashes[file], { proof: resealed, read: p => p === file ? altered : readFileSync(p, 'utf8') }));
});

test('retired provider label preserves complete actual native Deployments markup and permission traces', async () => {
  const file = 'features/admin/operations/DeploymentsPage.tsx';
  const current = readFileSync(file, 'utf8');
  const nativeLabel = 'const provider = hostinger ? "Hostinger Cloud Startup" : "ยังไม่ยืนยันผู้ให้บริการ";';
  const oldLabel = 'const provider = hostinger ? "Hostinger Cloud Startup" : model.provider === "vercel" ? "Vercel" : "ยังไม่ยืนยันผู้ให้บริการ";';
  assert.equal(current.split(nativeLabel).length, 2);
  const original = current.replace(nativeLabel, oldLabel);
  assert.equal(sha(original), '3664b01ea11471d9c4d421adf82c206704ac7859b4503acc0e2a9e44bfd3271e');
  for (const provider of ['hostinger', 'local', 'unknown']) {
    const outputs = [];
    for (const source of [original, current]) {
      const trace = [];
      const model = { provider, status: 'ready', exactShaProduction: null, environment: 'production-admin',
        canonicalHost: 'admin.ccpun.com', requestHost: 'admin.ccpun.com', gitBranch: 'native-fixture',
        gitSha: 'a'.repeat(40), releaseId: 'native-fixture', canonicalHostMatched: true,
        runtimeIdentityValid: true, error: null, history: [], githubChecks: [], source: 'synthetic' };
      const mocks = new Map([
        ['next/headers', { headers: async () => { trace.push(['headers']); return new Headers({ host: 'admin.ccpun.com' }); } }],
        ['@/lib/admin/require-permission', { requireAdminPermission: async permission => { trace.push(['permission', permission]); } }],
        ['@/lib/admin/operations/deployment-read-model', { readAdminDeployments: async host => { trace.push(['model', host]); return model; } }],
      ]);
      const page = loadFixtureModule(file, { sources: new Map([[file, source]]), mocks, globals: globals({}) });
      outputs.push({ html: renderToStaticMarkup(await page.default()), trace });
    }
    assert.deepEqual(outputs[1], outputs[0], provider);
    assert.match(outputs[1].html, provider === 'hostinger' ? /Hostinger Cloud Startup/ : /ยังไม่ยืนยันผู้ให้บริการ/);
    assert.doesNotMatch(outputs[1].html, /Vercel/);
  }
});
