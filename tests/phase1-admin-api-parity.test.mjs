import { adminConnectionPredecessor } from '../qa/admin-phase1-quick-wins-proof.mjs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { loadFixtureModule } from '../qa/phase1-fixture-loader.mjs';
const require = createRequire(import.meta.url);
const { z } = require('zod');
const proof = JSON.parse(readFileSync('qa/phase1-admin-api-parity.json', 'utf8'));
const originals = new Map(Object.entries(proof.originalSources));
const rootUb = 'app/api/admin/providers/ubersuggest/sync/route.ts';
const canonicalUb = 'apps/admin/' + rootUb;
const rootSchedule = 'app/api/admin/content/[id]/schedule/route.ts';
const canonicalSchedule = 'apps/admin/' + rootSchedule;
const rootAuth = 'app/api/auth/[...nextauth]/route.ts';
const canonicalAuth = 'apps/admin/' + rootAuth;
const NextResponse = { json: (body, options = {}) => Response.json(body, options) };
async function outcome(run) {
  try { const response = await run(); return { status: response.status, headers: Object.fromEntries(response.headers), body: await response.json() }; }
  catch (error) { return { thrown: { name: error.name, message: error.message } }; }
}
function identity(c) { return c.identity === null ? null : { actorType: c.actorType ?? 'human', role: c.role ?? 'owner', actor: 'fixture-owner' }; }
function request(trace, method, body, badJson = false) {
  const input = new Request('https://admin.example/api/admin/content/fixture-article/schedule/', { method, headers: { origin: 'https://admin.example' }, ...(method === 'GET' ? {} : { body: badJson ? 'not-json' : JSON.stringify(body === undefined ? {} : body) }) });
  for (const fn of ['json', 'text']) { const original = input[fn].bind(input); input[fn] = () => { trace.push('body:' + fn); return original(); }; }
  return input;
}
function loader(file, old, mocks, trace, env = {}) {
  const sources = old ? originals : file === canonicalUb ? new Map([[file, adminConnectionPredecessor(file, readFileSync(file, 'utf8'))]]) : new Map();
  return loadFixtureModule(file, { sources, mocks, globals: { process: { env: { AUTH_URL: 'https://admin.example', ...env } }, console: { warn: (...args) => trace.push(['warn', ...args]) } } });
}
async function observeUb(file, old, c) {
  const trace = []; let uuid = 0; let release;
  const pending = c.concurrent ? new Promise(resolve => { release = resolve; }) : null;
  const mocks = new Map([
    ['next/server', { NextResponse }], ['node:crypto', { randomUUID: () => { const id = 'fixture-request-' + ++uuid; trace.push(['uuid', id]); return id; } }],
    ['zod', { z }], ['@/lib/admin/seo-intelligence/aisv', { aisvSnapshotImportSchema: z.object({ fixture: z.literal(true) }).strict() }],
    ['@/lib/admin/auth-config', { isConfiguredAdminOrigin: () => { trace.push('configured-origin'); return !c.badConfiguredOrigin; }, isSameOriginAdminMutation: () => { trace.push('same-origin'); return !c.badOrigin; } }],
    ['@/lib/admin/environment', { getAdminEnvironment: () => { trace.push('environment'); return c.environment ?? 'admin-uat'; } }],
    ['@/lib/admin/identity', { getAdminIdentity: async () => { trace.push('identity'); return identity(c); } }],
    ['@/lib/admin/policy', { evaluateAdminAction: input => { trace.push(['policy', input]); return { allowed: !c.policyDenied }; } }],
    ['@/lib/admin/rbac', { hasAdminPermission: (...args) => { trace.push(['permission', ...args]); return !c.permissionDenied; } }],
    ['@/lib/admin/ubersuggest-dashboard-provider', { fetchUbersuggestDashboardSync: async domain => { trace.push(['provider', domain]); if (pending) await pending; if (c.providerError) throw new Error(c.providerError); return { fixture: true }; } }],
    ['@/lib/admin/ubersuggest-dashboard', {
      getUbersuggestDashboardData: async limit => { trace.push(['snapshot', limit]); return c.fresh ? { account: { id: 'fixture-account', checkedAt: '2026-10-12T00:00:00Z' }, geo: { id: 'fixture-geo', checkedAt: '2026-10-12T00:00:00Z' } } : { account: null, geo: null }; },
      isSnapshotFresh: (...args) => { trace.push(['freshness', ...args]); return true; },
      persistUbersuggestDashboardSync: async (data, context) => { trace.push(['persist', data, context]); if (c.persistError) throw new Error(c.persistError); return { accountId: 'fixture-account', geoId: 'fixture-geo', checkedAt: '2026-10-12T00:00:00Z' }; },
    }],
  ]);
  const route = loader(file, old, mocks, trace);
  const body = Object.hasOwn(c, 'body') ? c.body : { mode: 'provider-sync' };
  const first = outcome(() => route.POST(request(trace, 'POST', body, c.badJson)));
  if (!c.concurrent) return { result: await first, trace };
  const second = outcome(() => route.POST(request(trace, 'POST', body)));
  for (let i = 0; i < 12; i++) await Promise.resolve();
  release();
  return { result: await Promise.all([first, second]), trace };
}
const ubCases = [
  {}, { identity: null }, { actorType: 'agent' }, { role: 'viewer', permissionDenied: true }, { policyDenied: true }, { fresh: true }, { badOrigin: true }, { badConfiguredOrigin: true },
  { badJson: true }, { body: { mode: 'unexpected' } }, { body: { mode: 'provider-sync', unexpected: true } },
  { environment: 'production-admin', body: { mode: 'reviewed-import', snapshot: { fixture: true } } },
  { environment: 'admin-uat', body: { mode: 'reviewed-import', snapshot: { fixture: true } } },
  { environment: 'local-uat', body: { mode: 'reviewed-import', snapshot: { fixture: true } }, persistError: 'fixture-unknown' },
  ...['UBERSUGGEST_LOCAL_ONLY', 'UBERSUGGEST_AUTH_REQUIRED', 'UBERSUGGEST_PROJECT_NOT_FOUND', 'UBERSUGGEST_TIMEOUT', 'UBERSUGGEST_INVALID_RESPONSE', 'SANITY_WRITE_NOT_CONFIGURED', 'ADMIN_DATABASE_NOT_CONFIGURED', 'fixture-unknown'].map(providerError => ({ providerError })),
  ...['SANITY_WRITE_NOT_CONFIGURED', 'ADMIN_DATABASE_NOT_CONFIGURED', 'fixture-unknown'].map(persistError => ({ persistError, body: { mode: 'reviewed-import', snapshot: { fixture: true } } })), { concurrent: true },
];
test('both Ubersuggest routes preserve responses, identity/origin/import fences, cache and in-flight request provenance', async () => {
  for (const file of [rootUb, canonicalUb]) for (const c of ubCases) assert.deepEqual(await observeUb(file, false, c), await observeUb(file, true, c), file + ':' + JSON.stringify(c));
  for (const file of [rootUb, canonicalUb]) {
    const concurrent = await observeUb(file, false, { concurrent: true });
    assert.equal(concurrent.trace.filter(x => Array.isArray(x) && x[0] === 'provider').length, 1);
    assert.deepEqual(concurrent.result.map(x => x.body.requestId), ['fixture-request-1', 'fixture-request-2']);
  }
});
class ArticleScheduleError extends Error { constructor(code) { super(code); this.code = code; } }
const articleIdSchema = z.string().min(1).max(128).regex(/^[A-Za-z0-9_][A-Za-z0-9_.-]*$/).refine(x => !/^(drafts\.|versions\.)/.test(x));
const scheduleRequestSchema = z.object({ scheduledLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/), draftRevision: z.string(), publishedRevision: z.string().nullable(), expectedGeneration: z.string().uuid().nullable(), expectedVersion: z.number().int().nonnegative(), requestId: z.string().uuid() }).strict();
const cancelScheduleRequestSchema = z.object({ expectedGeneration: z.string().uuid(), expectedVersion: z.number().int().positive() }).strict();
const scheduleBody = { scheduledLocal: '2026-10-12T09:00', draftRevision: 'fixture-revision', publishedRevision: null, expectedGeneration: null, expectedVersion: 0, requestId: '00000000-0000-4000-8000-000000000001' };
const cancelBody = { expectedGeneration: '00000000-0000-4000-8000-000000000002', expectedVersion: 1 };
async function observeSchedule(file, old, c) {
  const trace = []; const row = { status: c.preparing ? 'preparing' : 'scheduled', generation: 'fixture-generation' };
  const domainCall = (name, value) => async (...args) => { trace.push([name, ...args]); if (c.errorAt === name || (name === 'mark-failed' && c.markFailure)) throw new ArticleScheduleError(c.errorCode ?? 'not-ready'); if (c.unknownAt === name) throw new Error('fixture-unknown'); return value; };
  const workflow = function fixtureWorkflow() {};
  class TracedMocks extends Map { get(id) { if (['workflow/api', '@/lib/admin/article-publication-workflow'].includes(id)) trace.push(['import', id]); return super.get(id); } }
  const mocks = new TracedMocks([
    ['next/server', { NextResponse }], ['@/lib/admin/identity', { getAdminIdentity: async () => { trace.push('identity'); return identity(c); } }],
    ['@/lib/admin/rbac', { hasAdminPermission: (...args) => { trace.push(['permission', ...args]); return !c.permissionDenied; } }],
    ['@/lib/admin/auth-config', { isSameOriginAdminMutation: () => { trace.push('same-origin'); return !c.badOrigin; }, isConfiguredAdminOrigin: (url, configured) => !c.badConfiguredOrigin && new URL(url).origin === new URL(configured).origin }],
    ['@/lib/admin/environment', { getAdminEnvironment: () => c.environment ?? 'admin-uat' }],
    ['@/lib/admin/capability-profile', { getAdminCapabilityProfile: () => { trace.push('capability'); return c.profile ?? 'full'; } }],
    ['@/lib/admin/article-schedule-clock', { getArticleScheduleBackend: () => { trace.push('backend'); return c.backend ?? 'native-neon'; } }],
    ['@/lib/admin/operations/article-schedule-contract', { ArticleScheduleError, articleIdSchema, scheduleRequestSchema, cancelScheduleRequestSchema, scheduleView: x => { trace.push(['view', x]); return { status: x.status, generation: x.generation }; } }],
    ['@/cms/sanity/policy/article-scheduling', { bangkokLocalDateTimeToIso: value => { trace.push(['date', value]); return c.badDate ? null : '2026-10-12T02:00:00Z'; } }],
    ['@/lib/admin/article-scheduling', {
      getArticleScheduleState: domainCall('read', { schedule: null }), cancelArticleSchedule: domainCall('cancel', { status: 'cancelled' }),
      prepareArticleSchedule: domainCall('prepare', { dispatch: !c.noDispatch, row }), markScheduleStartFailed: domainCall('mark-failed', null),
      acknowledgeArticleSchedule: domainCall('acknowledge', { status: 'scheduled' }), registerNativeArticleSchedule: domainCall('register-native', { status: 'scheduled' }),
    }], ['workflow/api', { start: domainCall('start-workflow', { runId: 'fixture-run' }) }], ['@/lib/admin/article-publication-workflow', { scheduledArticlePublicationWorkflow: workflow }],
  ]);
  const route = loader(file, old, mocks, trace);
  const id = c.badId ? 'drafts.fixture-article' : 'fixture-article';
  const params = { then: (resolve, reject) => { trace.push('params'); return c.paramsReject ? Promise.reject(new Error('fixture-params')).then(resolve, reject) : Promise.resolve({ id }).then(resolve, reject); } };
  const method = c.method ?? 'POST'; const body = Object.hasOwn(c, 'body') ? c.body : (method === 'DELETE' ? cancelBody : scheduleBody);
  const result = await outcome(() => route[method](request(trace, method, body, c.badJson), { params }));
  // The Workflow function reference belongs to each independently loaded synthetic fixture.
  const normalize = value => JSON.parse(JSON.stringify(value, (_, x) => typeof x === 'function' ? x.name : x));
  return normalize({ result, trace });
}
const scheduleCases = [
  {}, { identity: null }, { actorType: 'agent' }, { role: 'editor' }, { permissionDenied: true }, { profile: 'editorial' }, { badOrigin: true }, { badId: true }, { paramsReject: true }, { badJson: true }, { body: null }, { body: { ...scheduleBody, extra: true } }, { badDate: true }, { backend: 'disabled' }, { backend: 'workflow' }, { noDispatch: true }, { noDispatch: true, preparing: true },
  ...['not-ready', 'invalid-request', 'conflict', 'article-not-ready', 'dispatch-failed', 'outcome-unknown'].map(errorCode => ({ errorAt: 'prepare', errorCode })),
  { unknownAt: 'prepare' }, { errorAt: 'read' }, { errorAt: 'cancel' }, { errorAt: 'register-native' }, { errorAt: 'register-native', markFailure: true }, { errorAt: 'start-workflow', backend: 'workflow' }, { errorAt: 'acknowledge', backend: 'workflow' },
];
test('schedule handlers retain both lane contracts, validation/capability order, eager/lazy dispatch and all private errors', async () => {
  for (const file of [rootSchedule, canonicalSchedule]) for (const method of ['GET', 'POST', 'DELETE']) for (const c of scheduleCases) assert.deepEqual(await observeSchedule(file, false, { ...c, method }), await observeSchedule(file, true, { ...c, method }), file + ':' + JSON.stringify({ ...c, method }));
  assert.equal((await observeSchedule(canonicalSchedule, false, { profile: 'editorial' })).result.status, 404);
  assert.equal((await observeSchedule(rootSchedule, false, { identity: null })).result.status, 403);
  assert.equal((await observeSchedule(canonicalSchedule, false, { badConfiguredOrigin: true })).result.status, 403);
  const native = await observeSchedule(canonicalSchedule, false, {});
  assert.equal(native.trace.some(x => Array.isArray(x) && x[0] === 'import'), false, 'native scheduling never loads legacy Workflow');
  const legacy = await observeSchedule(rootSchedule, false, { identity: null });
  assert.deepEqual(legacy.trace.slice(0, 2), [['import', 'workflow/api'], ['import', '@/lib/admin/article-publication-workflow']], 'root keeps eager import ownership');
});
async function observeAuth(file, old, c) {
  const trace = []; const handlers = {}; let lastResponse; let lastError;
  for (const method of ['GET', 'POST']) handlers[method] = async function authHandler(request) {
    trace.push(['auth', method, this === handlers, request.url]); if (c.fail) { lastError = new Error('fixture-auth-failure'); throw lastError; } lastResponse = new Response('fixture-response', { status: c.status ?? 200, headers: c.redirect ? { location: 'https://admin.example/login/?error=fixture' } : {} }); return lastResponse;
  };
  const mocks = new Map([
    ['@/auth', { handlers }], ['@/lib/admin/environment', { getAdminEnvironment: () => { trace.push('environment'); return 'production-admin'; } }],
    ['@/lib/admin/auth-config', { getAdminCookieNamespace: environment => { trace.push(['cookie-namespace', environment]); return '__Secure-ccpun-admin.authjs'; } }],
  ]);
  const route = loader(file, old, mocks, trace);
  if (file === rootAuth) { assert.equal(route.GET, handlers.GET); assert.equal(route.POST, handlers.POST); }
  const method = c.method ?? 'GET'; const req = new Request('https://admin.example/api/auth/' + (c.callback ? 'callback/google/' : 'session/'), { method, headers: { cookie: '__Secure-ccpun-admin.authjs.state=fixture-cookie-do-not-log', host: 'admin.example' } });
  let result;
  try { const response = await route[method](req); assert.equal(response, lastResponse, 'auth returns the exact original Response object'); result = { status: response.status, headers: Object.fromEntries(response.headers), text: await response.text() }; }
  catch (error) { assert.equal(error, lastError, 'auth rethrows the exact original Error object'); result = { thrown: { name: error.name, message: error.message } }; }
  assert.equal(JSON.stringify(trace).includes('fixture-cookie-do-not-log'), false, 'diagnostics never contain cookie values');
  return { result, trace };
}
test('auth keeps direct legacy handler identities, canonical receivers, responses/errors and redacted observation', async () => {
  for (const file of [rootAuth, canonicalAuth]) for (const method of ['GET', 'POST']) for (const c of [{}, { callback: true }, { status: 401 }, { status: 302, redirect: true }, { fail: true }]) assert.deepEqual(await observeAuth(file, false, { ...c, method }), await observeAuth(file, true, { ...c, method }), file + ':' + JSON.stringify({ ...c, method }));
  const canonical = await observeAuth(canonicalAuth, false, { callback: true });
  assert.equal(canonical.trace[0][2], true, 'observed handlers retain their original receiver');
});

// This admission is restricted to historical parity; actual current handler tests do not import it.
test('canonical AISV legacy source inverse retains old bytes and rejects unknown or partial source', () => {
  const sha = text => createHash('sha256').update(text).digest('hex');
  const source = readFileSync(canonicalUb, 'utf8');
  assert.equal(sha(source), '019ae4b216e94e4968c307aca743bf0e3c3fb2ea307cc2f55d47c31af129774f');
  const prior = adminConnectionPredecessor(canonicalUb, source);
  assert.equal(sha(prior), 'c617f08feca0f38d6330405f6bb880e945c8dcf1ecdf13766258d5df8a425b73');
  assert.equal(adminConnectionPredecessor(canonicalUb, prior), prior);
  for (const mutation of [source + ' ', source.replace(/\S/, 'X'), source.replace('isConfiguredAdminOrigin(request.url, process.env.AUTH_URL)', 'true'), source.replace('const maxBodyBytes = 1_048_576;', 'const maxBodyBytes = 1_048_576;\nconst maxBodyBytes = 1_048_576;')]) {
    assert.notEqual(mutation, source);
    assert.equal(adminConnectionPredecessor(canonicalUb, mutation), mutation, 'No unknown/partial/duplicate source is admitted');
  }
  assert.equal(adminConnectionPredecessor(rootUb, source), source, 'No root route exemption');
  assert.doesNotMatch(readFileSync('tests/admin/admin-connection-handlers.test.ts', 'utf8'), /adminConnectionPredecessor|admin-phase1-quick-wins-proof/, 'Current handler tests keep executing raw source');
});
