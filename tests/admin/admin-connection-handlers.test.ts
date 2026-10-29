import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import { isConfiguredAdminOrigin, isSameOriginAdminMutation } from "../../lib/admin/auth-config";
import { aisvSnapshotImportSchema } from "../../lib/admin/seo-intelligence/aisv";

const require = createRequire(import.meta.url);
const origin = "https://admin-test.example.test";

function load(file: string, mocks: Record<string, unknown>) {
  const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const exports: Record<string, unknown> = {};
  // ponytail: inject only side-effect boundaries; unknown imports fail instead of reaching providers or env.
  new Function("require", "exports", "process", compiled)((id: string) => {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    if (["node:crypto", "zod", "react/jsx-runtime"].includes(id)) return require(id);
    throw new Error(`Unexpected test import: ${id}`);
  }, exports, { env: { AUTH_URL: origin } });
  return exports;
}

const snapshot = aisvSnapshotImportSchema.parse({
  source: "ubersuggest-aisv", sourceRuntime: "chatgpt-ubersuggest-connector",
  fetchedAt: "2026-10-28T00:00:00.000Z", reportStatus: "pending_update",
  reportWindow: { start: "2026-10-01", end: "2026-10-28" },
  providerFreshness: { promptsUpdatedAt: null, answerCollectedAt: null },
  account: { tier: null, domain: "ccpun.com", projectId: "synthetic-project", projectUpdateFrequency: null, brandUpdateFrequency: null, quotas: [] },
  geo: null, limitations: ["Synthetic local test; not measured provider data"],
});

function route() {
  const state = {
    identity: { actor: "synthetic-owner", actorType: "human", role: "owner" } as { actor: string; actorType: string; role: string } | null,
    environment: "admin-uat", policyAllowed: true, permissionAllowed: true,
    providerCalls: 0, saved: [] as unknown[], persistError: null as Error | null,
  };
  const handlerExports = load("apps/admin/app/api/admin/providers/ubersuggest/sync/route.ts", {
    "next/server": { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } },
    "@/lib/admin/auth-config": { isConfiguredAdminOrigin, isSameOriginAdminMutation },
    "@/lib/admin/environment": { getAdminEnvironment: () => state.environment },
    "@/lib/admin/identity": { getAdminIdentity: async () => state.identity },
    "@/lib/admin/policy": { evaluateAdminAction: () => ({ allowed: state.policyAllowed }) },
    "@/lib/admin/rbac": { hasAdminPermission: () => state.permissionAllowed },
    "@/lib/admin/seo-intelligence/aisv": { aisvSnapshotImportSchema },
    "@/lib/admin/ubersuggest-dashboard": { persistUbersuggestDashboardSync: async (value: unknown) => {
      if (state.persistError) throw state.persistError;
      state.saved.push(value);
      return { accountId: "synthetic-account", geoId: "synthetic-geo", checkedAt: "2026-10-28T00:00:00.000Z" };
    } },
    "@/lib/admin/ubersuggest-sync": {
      runUbersuggestSync: async () => { state.providerCalls++; return { reused: false }; },
      ubersuggestSyncFailure: () => Response.json({ error: "provider-tool-failed" }, { status: 502 }),
    },
  });
  const post = handlerExports.POST as (request: Request) => Promise<Response>;
  return { state, postRequest: post, post: (body: string, requestOrigin = origin) => post(new Request(`${origin}/api/admin/providers/ubersuggest/sync/`, {
    method: "POST", headers: { origin: requestOrigin, "content-type": "application/json" }, body,
  })) };
}

test("canonical AISV reviewed import persists only in UAT and never falls through to provider sync", async () => {
  for (const environment of ["admin-uat", "local-uat"]) {
    const fixture = route(); fixture.state.environment = environment;
    const response = await fixture.post(JSON.stringify({ mode: "reviewed-import", snapshot }));
    assert.equal(response.status, 201);
    assert.equal((await response.json()).imported, true);
    assert.deepEqual(fixture.state.saved, [snapshot]);
    assert.equal(fixture.state.providerCalls, 0);
  }
  const fixture = route(); fixture.state.persistError = new Error("ADMIN_DATABASE_NOT_CONFIGURED");
  assert.equal((await fixture.post(JSON.stringify({ mode: "reviewed-import", snapshot }))).status, 503);
  assert.equal(fixture.state.providerCalls, 0);
});

test("invalid or unauthorized import cannot persist data or trigger provider calls", async () => {
  const body = JSON.stringify({ mode: "reviewed-import", snapshot });
  for (const change of ["anonymous", "machine", "permission", "policy", "production-admin", "local-production", "origin", "json", "extra", "missing-snapshot"]) {
    const fixture = route(); let input = body; let requestOrigin = origin;
    if (change === "anonymous") fixture.state.identity = null;
    if (change === "machine") fixture.state.identity!.actorType = "machine";
    if (change === "permission") fixture.state.permissionAllowed = false;
    if (change === "policy") fixture.state.policyAllowed = false;
    if (change.endsWith("production") || change === "production-admin") fixture.state.environment = change;
    if (change === "origin") requestOrigin = "https://other.example.test";
    if (change === "json") input = "{";
    if (change === "extra") input = JSON.stringify({ mode: "reviewed-import", snapshot, unexpected: true });
    if (change === "missing-snapshot") input = JSON.stringify({ mode: "reviewed-import" });
    const response = await fixture.post(input, requestOrigin);
    assert.equal(response.status, change === "anonymous" ? 401 : ["json", "extra", "missing-snapshot"].includes(change) ? 400 : 403, change);
    assert.deepEqual(fixture.state.saved, [], change);
    assert.equal(fixture.state.providerCalls, 0, change);
  }
});

test("oversized announced or streamed bodies are rejected before provider or persistence", async () => {
  const fixture = route();
  const announced = new Request(`${origin}/api/admin/providers/ubersuggest/sync/`, {
    method: "POST", headers: { origin, "content-length": "1048577" }, body: "{}",
  });
  assert.equal((await fixture.postRequest(announced)).status, 413);
  let cancelled = false;
  let pulls = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) { pulls++; controller.enqueue(new Uint8Array(600_000)); },
    cancel() { cancelled = true; },
  });
  const streamed = new Request(`${origin}/api/admin/providers/ubersuggest/sync/`, {
    method: "POST", headers: { origin }, body, duplex: "half",
  } as RequestInit);
  assert.equal((await fixture.postRequest(streamed)).status, 413);
  assert.equal(cancelled, true);
  assert.ok(pulls <= 3);
  assert.equal(fixture.state.providerCalls, 0);
  assert.deepEqual(fixture.state.saved, []);
});

test("body limit counts UTF-8 bytes even with a false small content-length", async () => {
  const fixture = route();
  const body = "ก".repeat(350_000);
  assert.ok(body.length < 1_048_576 && Buffer.byteLength(body, "utf8") > 1_048_576);
  const request = new Request(`${origin}/api/admin/providers/ubersuggest/sync/`, {
    method: "POST", headers: { origin, "content-length": "1" }, body,
  });
  assert.equal((await fixture.postRequest(request)).status, 413);
  assert.equal(fixture.state.providerCalls, 0);
  assert.deepEqual(fixture.state.saved, []);
});

test("the import UI's largest schema-bounded Thai text collections fit the body limit", async () => {
  const text = (length: number) => "ก".repeat(length);
  const maximum = aisvSnapshotImportSchema.parse({
    ...snapshot,
    account: { ...snapshot.account, tier: text(80), projectId: text(160), projectUpdateFrequency: text(80), brandUpdateFrequency: text(80),
      quotas: Array.from({ length: 20 }, () => ({ key: text(120), label: text(160), limit: 0, used: 0, remaining: 0, status: "available" })) },
    limitations: Array.from({ length: 12 }, () => text(500)),
    geo: {
      domain: "ccpun.com", projectId: text(160), visibilityPercentage: null, totalMentions: null,
      shareOfVoice: null, averageRank: null, totalAnswers: null, totalPrompts: null, totalCompetitors: null,
      providers: Array.from({ length: 8 }, () => ({ provider: text(80), averageRank: null, totalMentions: null, visibilityPercentage: null })),
      competitors: Array.from({ length: 25 }, () => ({ brandName: text(255), brandDomain: text(255), averageRank: null, totalMentions: null, visibilityPercentage: null, sentimentLabel: text(80) })),
      intents: Array.from({ length: 12 }, () => ({ intent: text(80), value: null })),
      prompts: Array.from({ length: 25 }, () => ({ promptText: text(512), topic: text(255), language: text(40), locId: null,
        intents: Array.from({ length: 8 }, () => text(80)), totalAnswers: null, userAverageRank: null, userTotalMentions: null, userVisibilityPercentage: null,
        topBrands: Array.from({ length: 5 }, () => text(255)) })),
    },
  });
  const body = JSON.stringify({ mode: "reviewed-import", snapshot: maximum });
  assert.ok(Buffer.byteLength(body, "utf8") < 1_048_576);
  const fixture = route();
  assert.equal((await fixture.post(body)).status, 201);
  assert.equal(fixture.state.saved.length, 1);
  assert.equal(fixture.state.providerCalls, 0);
});

test("empty and explicit provider-sync requests keep the existing provider path", async () => {
  for (const body of ["", JSON.stringify({ mode: "provider-sync" })]) {
    const fixture = route();
    assert.equal((await fixture.post(body)).status, 201);
    assert.equal(fixture.state.providerCalls, 1);
    assert.deepEqual(fixture.state.saved, []);
  }
});

function hrefs(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(hrefs);
  if (!value || typeof value !== "object") return [];
  const props = (value as { props?: { href?: unknown; children?: unknown } }).props;
  return [...(typeof props?.href === "string" ? [props.href] : []), ...hrefs(props?.children)];
}

test("Social posts exposes the analytics link only when its destination gate is enabled", async () => {
  for (const enabled of [false, true]) {
    const pageExports = load("features/admin/social/posts-page.tsx", {
      "next/link": () => null,
      "next/navigation": { notFound: () => { throw new Error("not-found"); } },
      "@/lib/admin/require-permission": { requireAdminPermission: async () => undefined },
      "@/lib/admin/social/operations": { getSocialOperationsRuntimeStatus: () => ({ enabled: true, environment: "admin-uat" }) },
      "@/lib/admin/social/marketing-dashboard": { getSocialMarketingDashboardRuntimeStatus: () => ({ enabled }) },
      "@/lib/admin/social/publishing": { isSocialPublicationApprovalEnabled: () => false },
      "@/features/admin/social/SocialMediaMetadataPanel": () => null,
      "@/features/admin/social/SocialPostsWorkspace": () => null,
    });
    const page = pageExports.default as () => Promise<unknown>;
    const links = hrefs(await page());
    assert.equal(links.includes("/analytics/social/"), enabled);
    assert.ok(links.includes("/social/calendar/"));
    assert.ok(links.includes("/social/queue/"));
  }
});
