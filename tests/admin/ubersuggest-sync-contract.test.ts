import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import test from "node:test";

const { build } = createRequire(import.meta.url)("esbuild") as typeof import("esbuild");
const root = resolve(import.meta.dirname, "../..");

// Execute real route bodies, real strict AISV schema, RBAC, origin and capability
// helpers. Only authentication/environment/provider/persistence/backend/SDK edges are fixtures.
interface FixtureState {
  identity: { actor: string; actorType: string; role: string } | null;
  policyAllowed: boolean;
  environment: string;
  cache: unknown;
  providerCalls: number;
  providerData: unknown;
  persisted: { value: unknown; audit: { actorType: string } }[];
  providerError: string;
  providerWait?: Promise<void>;
  writeError: string;
  authResponse: Response;
  authError?: Error;
  backend?: "disabled" | "native-neon" | "workflow";
  preparedCalls?: number;
  nativeCalls?: number;
  sdkCalls?: number;
  sdkLoads?: number;
  sdkError?: boolean;
  failedStarts?: number;
}
interface FixtureExports {
  GET(request: Request, context?: { params: Promise<{ id: string }> }): Promise<Response>;
  POST(request: Request, context?: { params: Promise<{ id: string }> }): Promise<Response>;
  default(request: unknown): Response;
}
async function loadFixture(entry: string, state: FixtureState) {
  const key = `ccpun-structure-fixture-${randomUUID()}`;
  (globalThis as unknown as Record<string, unknown>)[key] = state;
  const mocks = `const s = globalThis[${JSON.stringify(key)}];
    export class NextResponse extends Response {
      static json(body, options) { return new NextResponse(JSON.stringify(body), { ...options, headers: { ...Object.fromEntries(new Headers(options?.headers)), 'content-type': 'application/json' } }); }
      static next(options) { return new NextResponse(null, { ...options, headers: { 'x-fixture-next': '1' } }); }
      static redirect(url) { return new NextResponse(null, { status: 307, headers: { location: String(url) } }); }
      static rewrite(url, options) { return new NextResponse(null, { ...options, headers: { 'x-fixture-rewrite': String(url) } }); }
    }
    export const getAdminIdentity = async () => s.identity;
    export const getAdminEnvironment = () => s.environment;
    export const isAdminSurfaceAllowed = () => s.environment !== 'production';
    export const isProductionEnvironment = () => s.environment === 'production';
    export const evaluateAdminAction = () => ({ allowed: s.policyAllowed });
    export const fetchUbersuggestDashboardSync = async () => { s.providerCalls++; if (s.providerError) throw new Error(s.providerError); if (s.providerWait) await s.providerWait; return s.providerData; };
    export const getUbersuggestDashboardData = async () => s.cache;
    export const isSnapshotFresh = checkedAt => checkedAt === 'fresh';
    export const persistUbersuggestDashboardSync = async (value, audit) => { s.persisted.push({ value, audit }); if (s.writeError) throw new Error(s.writeError); return { accountId: 'fixture-account', geoId: 'fixture-geo', checkedAt: 'fixture-time' }; };
    export const getArticleScheduleBackend = () => s.backend;
    export const getArticleScheduleState = async () => ({ schedule: null });
    export const prepareArticleSchedule = async () => { s.preparedCalls++; return { dispatch: true, row: { generation: 'fixture-generation' } }; };
    export const registerNativeArticleSchedule = async () => { s.nativeCalls++; return { status: 'scheduled', mode: 'validate-only' }; };
    export const acknowledgeArticleSchedule = async () => ({ status: 'scheduled', mode: 'legacy-fixture' });
    export const cancelArticleSchedule = async () => ({ status: 'cancelled' });
    export const markScheduleStartFailed = async () => { s.failedStarts++; };
    export const scheduledArticlePublicationWorkflow = () => {};
    export const auth = fn => fn;
    export const handlers = { GET: async () => { if (s.authError) throw s.authError; return s.authResponse; }, POST: async () => { if (s.authError) throw s.authError; return s.authResponse; } };
    export const observeAiCrawlerRequest = () => {};
    export const classifyProductionAdminPath = path => path === '/' ? 'entry' : 'allow';
    export const isAdminRequestBoundary = ({host}) => host === 'admin-test.ccpun.com' || host === 'wrong-admin.example';
    export const isExactAdminPreviewOrigin = () => false;
    export const isAuthenticatedAdminPreviewPath = () => false;
    export const isInternalServiceApiPath = path => path.startsWith('/api/internal/');`;
  const realAliases = new Set(["ubersuggest-sync", "article-schedule-handler", "auth-route-observer", "auth-config", "rbac", "capability-profile", "routes", "auth-diagnostics", "seo-intelligence/aisv", "operations/article-schedule-contract"].map(name => `@/lib/admin/${name}`));
  const result = await build({ entryPoints: [resolve(root, entry)], bundle: true, write: false, format: "esm", platform: "node", nodePaths: (process.env.NODE_PATH ?? "").split(":"), plugins: [{ name: "fixture-boundaries", setup(builder) {
    builder.onResolve({ filter: /^(?:@\/|next\/server$|workflow\/api$)/ }, (args) => {
      if (args.path === "workflow/api") return { path: "sdk", namespace: "sdk" };
      if (realAliases.has(args.path) || args.path.startsWith("@/apps/admin/app/") || args.path === "@/cms/sanity/policy/article-scheduling") return { path: resolve(root, args.path.slice(2) + ".ts") };
      return { path: "fixture", namespace: "fixture" };
    });
    builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: mocks, loader: "js" }));
    builder.onLoad({ filter: /.*/, namespace: "sdk" }, () => ({ contents: `const s = globalThis[${JSON.stringify(key)}]; s.sdkLoads++; export const start = async () => { s.sdkCalls++; if (s.sdkError) throw new Error('fixture-private-sdk-error'); return { runId: 'fixture-run' }; };`, loader: "js" }));
  } }] });
  const exports = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
  return { exports: exports as FixtureExports, close() { delete (globalThis as unknown as Record<string, unknown>)[key]; } };
}

function initialState(): FixtureState {
  return { identity: { actor: "fixture-owner", actorType: "human", role: "owner" }, policyAllowed: true, environment: "admin-uat", cache: {}, providerCalls: 0, providerData: { source: "fixture-provider" }, persisted: [], providerError: "", writeError: "", authResponse: new Response(null, { status: 302, headers: { location: "/dashboard/", "set-cookie": "fixture-session=fixture-only; HttpOnly; Secure" } }) };
}
const snapshot = {
  source: "ubersuggest-aisv", sourceRuntime: "chatgpt-ubersuggest-connector", fetchedAt: "2026-10-11T00:00:00.000Z", reportStatus: "partial",
  reportWindow: { start: "2026-10-01", end: "2026-10-11" }, providerFreshness: { promptsUpdatedAt: null, answerCollectedAt: null },
  account: { tier: null, domain: "ccpun.com", projectId: "fixture-project", projectUpdateFrequency: null, brandUpdateFrequency: null, quotas: [] }, geo: null, limitations: ["Synthetic route contract test only"],
};
const request = (body?: unknown, origin = "https://admin-test.ccpun.com") => new Request("https://admin-test.ccpun.com/api/admin/providers/ubersuggest/sync/", { method: "POST", headers: { origin }, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body) });

test("canonical Ubersuggest POST distinguishes reviewed imports from provider execution and denies unsafe inputs", async (t) => {
  const previousAuthUrl = process.env.AUTH_URL;
  process.env.AUTH_URL = "https://admin-test.ccpun.com";
  try {
    const cases = [
      { name: "valid UAT import never calls provider", body: { mode: "reviewed-import", snapshot }, status: 201, saves: 1 },
      { name: "production import denied", body: { mode: "reviewed-import", snapshot }, environment: "production-admin", status: 403, saves: 0 },
      { name: "malformed JSON", body: "{", status: 400, saves: 0 },
      { name: "unknown request field", body: { mode: "provider-sync", extra: true }, status: 400, saves: 0 },
      { name: "credential-shaped snapshot field", body: { mode: "reviewed-import", snapshot: { ...snapshot, accessToken: "fixture-forbidden" } }, status: 400, saves: 0 },
      { name: "cross-origin request", body: { mode: "reviewed-import", snapshot }, origin: "https://other.example", status: 403, saves: 0 },
      { name: "missing origin", body: { mode: "reviewed-import", snapshot }, origin: "", status: 403, saves: 0 },
      { name: "no identity", body: { mode: "reviewed-import", snapshot }, identity: null, status: 401, saves: 0 },
      { name: "service actor denied", body: { mode: "reviewed-import", snapshot }, identity: { actor: "fixture-service", actorType: "agent", role: "owner" }, status: 403, saves: 0 },
      { name: "viewer denied", body: { mode: "reviewed-import", snapshot }, identity: { actor: "fixture-viewer", actorType: "human", role: "viewer" }, status: 403, saves: 0 },
      { name: "policy denied", body: { mode: "reviewed-import", snapshot }, policyAllowed: false, status: 403, saves: 0 },
      { name: "import write failure is redacted", body: { mode: "reviewed-import", snapshot }, writeError: "fixture-private-detail", status: 502, saves: 1 },
    ];
    for (const c of cases) await t.test(c.name, async () => {
      const state = { ...initialState(), ...c }; const fixture = await loadFixture("apps/admin/app/api/admin/providers/ubersuggest/sync/route.ts", state);
      try {
        const response = await fixture.exports.POST(request(c.body, c.origin));
        assert.equal(response.status, c.status);
        const payload = await response.json();
        assert.equal(state.providerCalls, 0); assert.equal(state.persisted.length, c.saves);
        assert.doesNotMatch(JSON.stringify(payload), /fixture-private-detail|fixture-forbidden/);
        if (c.status === 201) { assert.equal(payload.imported, true); assert.equal(state.persisted[0].audit.actorType, "human"); assert.deepEqual(state.persisted[0].value, snapshot); }
      } finally { fixture.close(); }
    });
    await t.test("empty-body provider sync preserves fresh-cache and in-flight behavior", async () => {
      const state = initialState(); const fixture = await loadFixture("apps/admin/app/api/admin/providers/ubersuggest/sync/route.ts", state);
      try {
        state.cache = { account: { id: "cached-account", checkedAt: "fresh" }, geo: { id: "cached-geo", checkedAt: "fresh" } };
        assert.equal((await fixture.exports.POST(request())).status, 200); assert.equal(state.providerCalls, 0); assert.equal(state.persisted.length, 0);
        state.cache = {}; let release: () => void; state.providerWait = new Promise<void>(r => { release = r; });
        const one = fixture.exports.POST(request()); const two = fixture.exports.POST(request({ mode: "provider-sync" }));
        await new Promise(r => setImmediate(r)); release!();
        assert.deepEqual((await Promise.all([one, two])).map(r => r.status), [201, 201]); assert.equal(state.providerCalls, 1); assert.equal(state.persisted.length, 1);
        state.providerError = "UBERSUGGEST_LOCAL_ONLY"; state.providerWait = undefined;
        assert.equal((await fixture.exports.POST(request())).status, 409);
      } finally { fixture.close(); }
    });
  } finally { if (previousAuthUrl === undefined) delete process.env.AUTH_URL; else process.env.AUTH_URL = previousAuthUrl; }
});

test("root Auth.js adapter preserves canonical status/cookies and rethrows errors without logging private payloads", async () => {
  const state = initialState(); const fixture = await loadFixture("app/api/auth/[...nextauth]/route.ts", state);
  const warnings: unknown[] = []; const warn = console.warn; console.warn = (...args) => { warnings.push(args); };
  try {
    const req = new Request("https://admin-test.ccpun.com/api/auth/callback/google?code=fixture-private-code", { headers: { cookie: "fixture-private-cookie=fixture-private-value" } });
    for (const method of ["GET", "POST"] as const) { const response = await fixture.exports[method](req); assert.equal(response, state.authResponse); assert.equal(response.status, 302); assert.equal(response.headers.get("set-cookie"), state.authResponse.headers.get("set-cookie")); }
    state.authError = new Error("fixture-private-error");
    await assert.rejects(fixture.exports.GET(req), error => error === state.authError);
    assert.ok(warnings.length > 0); assert.doesNotMatch(JSON.stringify(warnings), /fixture-private-code|fixture-private-cookie|fixture-private-value|fixture-private-error|fixture-session/);
  } finally { console.warn = warn; fixture.close(); }
});

test("mixed root proxy preserves public Web routes and applies Admin capability/origin/landing gates", async () => {
  const values = { AUTH_URL: "https://admin-test.ccpun.com", CCPUN_ADMIN_CAPABILITY_PROFILE: "full", NEXT_PUBLIC_CCPUN_ADMIN_CAPABILITY_PROFILE: "full" };
  const before = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]])); Object.assign(process.env, values);
  const state = initialState(); const fixture = await loadFixture("proxy.ts", state);
  const req = (path: string, host = "admin-test.ccpun.com", method = "GET", origin?: string, role: string | null = "owner") => {
    const url = new URL(`https://${host}${path}`); return { url: String(url), nextUrl: url, method, headers: new Headers({ host, ...(origin ? { origin } : {}) }), auth: role ? { user: { role } } : null };
  };
  try {
    assert.equal(fixture.exports.default(req("/dashboard/")).headers.get("x-fixture-next"), "1");
    assert.match(fixture.exports.default(req("/", "admin-test.ccpun.com")).headers.get("location") ?? "", /\/dashboard\/$/);
    process.env.CCPUN_ADMIN_CAPABILITY_PROFILE = process.env.NEXT_PUBLIC_CCPUN_ADMIN_CAPABILITY_PROFILE = "editorial";
    assert.equal(fixture.exports.default(req("/dashboard/")).status, 404);
    assert.equal(fixture.exports.default(req("/content/articles/")).headers.get("x-fixture-next"), "1");
    assert.match(fixture.exports.default(req("/login/")).headers.get("location") ?? "", /\/content\/articles\/$/);
    assert.equal(fixture.exports.default(req("/api/admin/content/", "admin-test.ccpun.com", "POST", "https://other.example")).status, 403);
    assert.equal(fixture.exports.default(req("/content/articles/", "wrong-admin.example")).status, 404);
    assert.equal(fixture.exports.default(req("/blog/", "ccpun.com")).headers.get("x-fixture-next"), "1");
    process.env.CCPUN_ADMIN_CAPABILITY_PROFILE = process.env.NEXT_PUBLIC_CCPUN_ADMIN_CAPABILITY_PROFILE = "invalid";
    assert.equal(fixture.exports.default(req("/api/admin/content/")).status, 404);
    assert.equal(fixture.exports.default(req("/", "ccpun.com")).headers.get("x-fixture-next"), "1");
  } finally { fixture.close(); for (const [key, value] of Object.entries(before)) if (value === undefined) delete process.env[key]; else process.env[key] = value; }
});

test("UAT root schedule adapter keeps native, disabled, legacy, identity, origin and strict-input boundaries", async (t) => {
  const variables = { AUTH_URL: "https://admin-test.ccpun.com", CCPUN_ADMIN_CAPABILITY_PROFILE: "full", NEXT_PUBLIC_CCPUN_ADMIN_CAPABILITY_PROFILE: "full" };
  const before = Object.fromEntries(Object.keys(variables).map(key => [key, process.env[key]])); Object.assign(process.env, variables);
  const body = { scheduledLocal: "2026-10-12T16:00", draftRevision: "fixture-revision", publishedRevision: null, expectedGeneration: null, expectedVersion: 0, requestId: randomUUID() };
  const cases = [
    { name: "native-neon schedules without importing the SDK", backend: "native-neon", status: 201, prepares: 1, native: 1, sdk: 0 },
    { name: "disabled backend never prepares or imports SDK", backend: "disabled", status: 503, prepares: 0, native: 0, sdk: 0 },
    { name: "retained legacy backend uses only the mocked SDK", backend: "workflow", status: 201, prepares: 1, native: 0, sdk: 1 },
    { name: "legacy dispatch failure is redacted and marks preparing row failed", backend: "workflow", sdkError: true, status: 502, prepares: 1, native: 0, sdk: 1 },
    { name: "editorial capability denies before preparation", backend: "native-neon", profile: "editorial", status: 404, prepares: 0, native: 0, sdk: 0 },
    { name: "missing identity denied", backend: "native-neon", identity: null, status: 403, prepares: 0, native: 0, sdk: 0 },
    { name: "service actor denied", backend: "native-neon", identity: { actor: "fixture-service", actorType: "agent", role: "owner" }, status: 403, prepares: 0, native: 0, sdk: 0 },
    { name: "viewer denied", backend: "native-neon", identity: { actor: "fixture-viewer", actorType: "human", role: "viewer" }, status: 403, prepares: 0, native: 0, sdk: 0 },
    { name: "foreign origin denied", backend: "native-neon", origin: "https://foreign.example", status: 403, prepares: 0, native: 0, sdk: 0 },
    { name: "unknown request field denied", backend: "native-neon", body: { ...body, credential: "fixture-forbidden" }, status: 400, prepares: 0, native: 0, sdk: 0 },
    { name: "draft-prefixed article ID denied", backend: "native-neon", id: "drafts.fixture", status: 400, prepares: 0, native: 0, sdk: 0 },
    { name: "impossible Bangkok date denied", backend: "native-neon", body: { ...body, scheduledLocal: "2026-02-31T16:00" }, status: 400, prepares: 0, native: 0, sdk: 0 },
  ] as const;
  try {
    for (const c of cases) await t.test(c.name, async () => {
      process.env.CCPUN_ADMIN_CAPABILITY_PROFILE = process.env.NEXT_PUBLIC_CCPUN_ADMIN_CAPABILITY_PROFILE = "profile" in c ? c.profile : "full";
      const state: FixtureState = { ...initialState(), ...c, preparedCalls: 0, nativeCalls: 0, sdkCalls: 0, sdkLoads: 0, failedStarts: 0 };
      const fixture = await loadFixture("app/api/admin/content/[id]/schedule/route.ts", state);
      try {
        const input = "body" in c ? c.body : body;
        const req = new Request("https://admin-test.ccpun.com/api/admin/content/fixture/schedule/", { method: "POST", headers: { origin: "origin" in c ? c.origin : variables.AUTH_URL, "content-type": "application/json" }, body: JSON.stringify(input) });
        const response = await fixture.exports.POST(req, { params: Promise.resolve({ id: "id" in c ? c.id : "fixture-article" }) });
        assert.equal(response.status, c.status);
        assert.equal(response.headers.get("cache-control"), "private, no-store");
        assert.equal(state.preparedCalls, c.prepares); assert.equal(state.nativeCalls, c.native); assert.equal(state.sdkCalls, c.sdk); assert.equal(state.sdkLoads, c.sdk);
        assert.equal(state.failedStarts, "sdkError" in c ? 1 : 0);
        assert.doesNotMatch(JSON.stringify(await response.json()), /fixture-private-sdk-error|fixture-forbidden/);
      } finally { fixture.close(); }
    });
  } finally { for (const [key, value] of Object.entries(before)) if (value === undefined) delete process.env[key]; else process.env[key] = value; }
});
