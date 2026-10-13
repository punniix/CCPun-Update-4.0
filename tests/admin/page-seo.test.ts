import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { PAGE_SEO_FIELDS, PAGE_SEO_PAGES, validatePageSeoFields } from "../../lib/content/page-seo-registry";
import * as registry from "../../lib/content/page-seo-registry";

const requireDependency = createRequire(import.meta.url);
const ts = requireDependency("typescript") as typeof import("typescript");
const zod = requireDependency("zod") as typeof import("zod");
type Doc = Record<string, unknown>;
const goodEnv: Record<string, string | undefined> = { CCPUN_APP_ENV: "admin-uat", NEXT_PUBLIC_CCPUN_APP_ENV: "admin-uat", CCPUN_DEPLOYMENT_PROVIDER: "hostinger", CCPUN_DEPLOYMENT_ROLE: "admin", NEXT_PUBLIC_SANITY_PROJECT_ID: "ccb9lnw5", NEXT_PUBLIC_SANITY_DATASET: "uat" };
const source = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

function compile(path: string, dependencies: Record<string, unknown>, globals: Record<string, unknown>) {
  const exports: Record<string, unknown> = {};
  const output = ts.transpileModule(source(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: path });
  runInNewContext(output.outputText, { exports, require: (name: string) => { if (!(name in dependencies)) throw new Error(`Unexpected fixture import: ${name}`); return dependencies[name]; }, Error, URL, Response, Request, AbortSignal, TextDecoder, TextEncoder, ...globals }, { filename: path });
  return exports;
}

function fixture(env: Record<string, string | undefined> = { ...goodEnv }) {
  const documents = new Map<string, Doc>();
  const calls = { clients: 0, tokens: 0, mutations: 0, network: 0, origin: true, native: true, identity: { actorType: "human", role: "owner" } as { actorType: string; role: string } | null, writeToken: "fixture-only-not-a-credential" };
  let serial = 0;
  const conflict = () => Object.assign(new Error("fixture-conflict"), { statusCode: 409 });
  const client = {
    fetch: async (_query: unknown, params: { ids?: string[]; id?: string }) => params.ids ? params.ids.flatMap(id => { const doc = documents.get(id); return doc?._type === "pageSeo" ? [{ ...doc }] : []; }) : documents.get(params.id ?? "") ?? null,
    create: async (doc: Doc) => { calls.mutations++; if (documents.has(String(doc._id))) throw conflict(); const result = { ...doc, _rev: `r${++serial}` }; documents.set(String(doc._id), result); return result; },
    patch: (id: string) => {
      let revision = "", fields: Doc = {};
      const patch = {
        ifRevisionId: (rev: string) => { revision = rev; return patch; },
        set: (value: Doc) => { fields = value; return patch; },
        commit: async () => { calls.mutations++; const doc = documents.get(id); if (!doc || doc._rev !== revision) throw conflict(); const result = { ...doc, ...fields, _rev: `r${++serial}` }; documents.set(id, result); return result; },
      };
      return patch;
    },
  };
  let fetchPublic: typeof fetch = async () => { throw new Error("No real network allowed in page SEO fixtures"); };
  const service = compile("lib/admin/page-seo.ts", {
    "server-only": {}, "zod": zod, "next-sanity": { createClient: (config: Doc) => { calls.clients++; assert.equal(config.dataset, "uat"); assert.equal(config.projectId, "ccb9lnw5"); assert.equal(config.useCdn, false); assert.equal(config.perspective, "published"); return client; }, groq: (parts: TemplateStringsArray) => parts.join("") },
    "../content/page-seo-registry": registry,
    "./environment": { isAdminDataPlaneAllowed: () => calls.native, isAdminReadDataPlaneAllowed: () => calls.native },
    "./sanity-credentials": { getAdminSanityReadToken: () => { calls.tokens++; return undefined; }, getAdminSanityWriteToken: () => { calls.tokens++; return calls.writeToken; } },
  }, { process: { env }, fetch: (...args: Parameters<typeof fetch>) => { calls.network++; return fetchPublic(...args); } }) as typeof import("../../lib/admin/page-seo");
  const api = compile("apps/admin/app/api/admin/page-seo/route.ts", {
    "@/lib/admin/page-seo": service, "@/lib/content/page-seo-registry": registry,
    "@/lib/admin/identity": { getAdminIdentity: async () => calls.identity },
    "@/lib/admin/rbac": { hasAdminPermission: (role: string, permission: string) => role === "owner" && ["draft:apply", "seo:read"].includes(permission) },
    "@/lib/admin/seo-intelligence/post-publish-origin": { isPostPublishAdminOriginAllowed: () => calls.origin },
  }, { process: { env } }) as typeof import("../../apps/admin/app/api/admin/page-seo/route");
  return { service, api, calls, documents, setFetch: (fn: typeof fetch) => { fetchPublic = fn; } };
}
const request = (body: unknown, headers: Record<string, string> = {}) => new Request("https://admin-test.ccpun.com/api/admin/page-seo/", { method: "PATCH", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
const saveBody = (fields: unknown = {}, revision: string | null = null, pathname = "/") => ({ pathname, revision, fields });
const getRequest = (query = "") => new Request("https://admin-test.ccpun.com/api/admin/page-seo/" + query);

test("page SEO: owner/auth/native UAT/origin denial precedes any SDK, credentials, body or public fetch", async () => {
  const f = fixture();
  f.calls.identity = null;
  assert.equal((await f.api.GET(getRequest())).status, 401);
  assert.equal((await f.api.PATCH(request(saveBody()))).status, 401);
  f.calls.identity = { actorType: "human", role: "viewer" };
  assert.equal((await f.api.GET(getRequest())).status, 403);
  f.calls.identity = { actorType: "agent", role: "owner" };
  assert.equal((await f.api.PATCH(request(saveBody()))).status, 403);
  for (const [key, value] of Object.entries({ CCPUN_APP_ENV: "admin-production", NEXT_PUBLIC_CCPUN_APP_ENV: "admin-production", CCPUN_DEPLOYMENT_PROVIDER: "vercel", CCPUN_DEPLOYMENT_ROLE: "web", NEXT_PUBLIC_SANITY_PROJECT_ID: "other", NEXT_PUBLIC_SANITY_DATASET: "production" })) {
    const denied = fixture({ ...goodEnv, [key]: value });
    assert.equal((await denied.api.PATCH(request(saveBody()))).status, 403, key);
    await assert.rejects(denied.service.listPageSeo(), /PAGE_SEO_UAT_REQUIRED/);
    assert.equal(denied.calls.tokens + denied.calls.clients + denied.calls.mutations + denied.calls.network, 0);
  }
  f.calls.identity = { actorType: "human", role: "owner" }; f.calls.native = false;
  assert.equal((await f.api.GET(getRequest())).status, 403);
  f.calls.native = true; f.calls.origin = false;
  assert.equal((await f.api.PATCH(request(saveBody()))).status, 403);
  f.calls.origin = true;
  assert.equal((await f.api.PATCH(request(saveBody(), { "sec-fetch-site": "cross-site" }))).status, 403);
  assert.equal(f.calls.tokens + f.calls.clients + f.calls.mutations + f.calls.network, 0);
});

test("page SEO: strict fields, singleton path, body limits and unsafe images fail before writes", async () => {
  const f = fixture();
  const invalid = [
    { ...saveBody(), canonical: "https://example.com" }, saveBody({ robots: "index" }), saveBody({ featureFlag: true }), saveBody({ body: "article" }),
    saveBody({}, null, "/blog/category/"), saveBody({ seoTitle: "a".repeat(121) }), saveBody({ seoDescription: "a".repeat(321) }),
    saveBody({ seoTitle: "<b>HTML</b>" }), saveBody({ seoTitle: "line\nline" }), saveBody({ seoTitle: 3 }), { pathname: "/", fields: {} },
    ...["javascript:alert(1)", "data:image/png;base64,AA", "http://ccpun.com/assets/a.webp", "https://localhost/assets/a.webp", "https://test.ccpun.com:8443/assets/a.webp", "https://cdn.sanity.io/images/ccb9lnw5/production/a.webp", "https://ccpun.com/assets/a.webp?token=private"].map(ogImageUrl => saveBody({ ogImageUrl })),
  ];
  for (const body of invalid) assert.equal((await f.api.PATCH(request(body))).status, 400);
  assert.equal((await f.api.PATCH(request(saveBody({ seoTitle: "a".repeat(9_000) })))).status, 400);
  assert.equal((await f.api.PATCH(request(saveBody(), { "content-length": "9000" }))).status, 400);
  assert.equal((await f.api.GET(getRequest("?pathname=https://localhost/"))).status, 400);
  assert.equal(f.calls.clients + f.calls.mutations + f.calls.network, 0);
  for (const image of ["https://ccpun.com/assets/example.webp", "https://cdn.sanity.io/images/ccb9lnw5/uat/example.webp?w=600"]) assert.doesNotThrow(() => validatePageSeoFields({ ogImageUrl: image }));
});

test("page SEO: atomic create/CAS conflict/type-path guard/reset preserve unrelated records and return saved separately", async () => {
  const f = fixture();
  const initial = await f.api.PATCH(request(saveBody({ seoTitle: "Test title", seoDescription: "Description" })));
  assert.equal(initial.status, 200);
  assert.match(initial.headers.get("cache-control") ?? "", /private.*no-store/);
  assert.match(initial.headers.get("x-robots-tag") ?? "", /noindex/);
  const first = await initial.json();
  assert.equal(first.saved, true); assert.equal(f.calls.network, 0);
  const doc = f.documents.get("pageSeo.home")!;
  assert.deepEqual(Object.keys(doc).sort(), ["_id", "_type", "_rev", "pathname", ...PAGE_SEO_FIELDS].sort());
  assert.equal((await f.api.PATCH(request(saveBody()))).status, 409);
  assert.equal((await f.api.PATCH(request(saveBody({}, "stale")))).status, 409);
  const before = f.calls.mutations;
  f.documents.set("pageSeo.home", { ...doc, _type: "article", body: "unchanged" });
  assert.equal((await f.api.PATCH(request(saveBody({}, first.revision)))).status, 409);
  assert.equal(f.calls.mutations, before); assert.equal(f.documents.get("pageSeo.home")!.body, "unchanged");
  f.documents.set("pageSeo.home", { ...doc, pathname: "/blog/" });
  assert.equal((await f.api.PATCH(request(saveBody({}, first.revision)))).status, 409);
  f.documents.set("pageSeo.home", doc);
  const reset = await f.api.PATCH(request(saveBody(Object.fromEntries(PAGE_SEO_FIELDS.map(key => [key, ""])), first.revision)));
  assert.equal(reset.status, 200);
  for (const key of PAGE_SEO_FIELDS) assert.equal(f.documents.get("pageSeo.home")![key], null);
  assert.equal(f.documents.size, 1); assert.equal(f.calls.network, 0);
  const list = await f.api.GET(getRequest());
  assert.equal(list.status, 200); assert.equal((await list.json()).pages.length, 8);
  f.calls.writeToken = "";
  assert.equal((await f.api.PATCH(request(saveBody({}, "r2")))).status, 503);
});

test("page SEO: served tag readback excludes serialized Flight/comments, uses fixed public host and bounds failure", async () => {
  const f = fixture();
  const head = `<head><script>self.__next_f.push('<meta name="description" content="FAKE">');</script><!-- <title>FAKE</title> --><title>Real &amp; Title</title><meta content='Actual &quot;description&quot;' name='description'><meta property="og:title" content="Social"><link href="https://ccpun.com/" rel="canonical"><meta name="robots" content="noindex,nofollow"></head>`;
  assert.equal(f.service.extractPageSeoTags(head).title, "Real & Title");
  assert.equal(f.service.extractPageSeoTags(head).description, 'Actual "description"');
  f.setFetch(async (url, options) => { assert.equal(url, "https://test.ccpun.com/"); assert.equal(options?.redirect, "manual"); assert.equal(options?.cache, "no-store"); assert.equal(new Headers(options?.headers).get("user-agent"), "Googlebot"); return new Response(`<html>${head}<body></body></html>`, { headers: { "Content-Type": "text/html" } }); });
  const live = await f.service.readPageSeoTags("/");
  assert.equal(live.verified, true); assert.match(live.tags!.robots!, /noindex/);
  assert.equal(Object.keys(live).join(","), "verified,status,tags,error");
  const streamed = `<html><head><title>Root default</title><meta name="description" content="Root default"></head><body><script>self.__next_f.push('<title>Flight FAKE</title><meta name="description" content="Flight FAKE">');</script><title>Streamed page title</title><meta name="description" content="Streamed page description"></body></html>`;
  f.setFetch(async () => new Response(streamed, { headers: { "Content-Type": "text/html" } }));
  const late = await f.service.readPageSeoTags("/");
  assert.equal(late.verified, true); assert.equal(late.tags!.title, "Streamed page title"); assert.equal(late.tags!.description, "Streamed page description");
  f.setFetch(async () => new Response(`<html>${head}<body>incomplete`, { headers: { "Content-Type": "text/html" } }));
  assert.equal((await f.service.readPageSeoTags("/")).verified, false);
  const network = f.calls.network;
  await assert.rejects(f.service.readPageSeoTags("https://localhost/"), /PAGE_SEO_PATH_INVALID/); assert.equal(f.calls.network, network);
  f.setFetch(async () => new Response(null, { status: 302, headers: { Location: "https://localhost/" } }));
  assert.equal((await f.service.readPageSeoTags("/")).verified, false);
  f.setFetch(async () => new Response("x".repeat(256_001) + head, { headers: { "Content-Type": "text/html" } }));
  const oversize = await f.service.readPageSeoTags("/"); assert.equal(oversize.verified, false); assert.equal(oversize.tags, null);
  f.setFetch(async () => { throw new Error("secret fixture error must not leak"); });
  const failed = await f.service.readPageSeoTags("/"); assert.equal(failed.error, "request-failed"); assert.doesNotMatch(JSON.stringify(failed), /secret/);
  assert.equal(PAGE_SEO_PAGES.length, 8);
});
