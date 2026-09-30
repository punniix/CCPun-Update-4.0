import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { adminCapabilityLandingPath, getAdminCapabilityProfile, isAdminCapabilityPathAllowed, isAdminLineSystemDeliveryAllowed, safeAdminCapabilityReturnPath } from "../../lib/admin/capability-profile";

test("editorial profile is pinned by its build marker and invalid/mismatched profiles fail closed", () => {
  assert.equal(getAdminCapabilityProfile({}), "full");
  assert.equal(getAdminCapabilityProfile({ CCPUN_ADMIN_CAPABILITY_PROFILE: "editorial" }), "editorial");
  assert.equal(getAdminCapabilityProfile({ NEXT_PUBLIC_CCPUN_ADMIN_CAPABILITY_PROFILE: "editorial" }), "editorial");
  for (const variables of [
    { CCPUN_ADMIN_CAPABILITY_PROFILE: "other" },
    { CCPUN_ADMIN_CAPABILITY_PROFILE: "full", NEXT_PUBLIC_CCPUN_ADMIN_CAPABILITY_PROFILE: "editorial" },
    { CCPUN_ADMIN_CAPABILITY_PROFILE: "editorial", NEXT_PUBLIC_CCPUN_ADMIN_CAPABILITY_PROFILE: "full" },
  ]) assert.equal(getAdminCapabilityProfile(variables), "disabled");
});

test("editorial allowlist retains manual authoring/SEO/research/reviews and rejects operational or encoded alias escapes", () => {
  const allowed = ["/", "/login/", "/content/", "/content/articles/", "/content/articles/article-1/", "/content/research/", "/seo/", "/seo/audits/", "/seo/audits/article-1/", "/seo/opportunities/", "/dashboard/reviews/", "/studio/structure/article-1", "/blog/health-insurance/article/", "/assets/image.webp", "/api/auth/session", "/api/auth/callback/google", "/api/preview/enable", "/api/preview/disable/", "/api/admin/content/", "/api/admin/content/article-1/preview", "/api/admin/seo/suggestions", "/api/admin/seo/audit/article-1", "/api/admin/seo/audit/article-1/proposals", "/api/admin/seo/providers/readiness", "/api/admin/seo/opportunities", "/api/admin/research", "/api/admin/research/ubersuggest", "/api/admin/research/ubersuggest/import", "/api/admin/reviews", "/api/admin/reviews/item-1/approve", "/api/admin/reviews/item-1/edit", "/api/admin/reviews/item-1/reject", "/api/admin/reviews/item-1/apply", "/api/snt-admin/seo/suggestions", "/snt-admin/content", "/snt-admin/reviews", "/seo/keywords/", "/_next/static/chunk.js", "/_next/image", "/favicon.ico", "/robots.txt"];
  const denied = ["/dashboard/", "/dashboard/inbox/", "/dashboard/campaigns/", "/dashboard/reviews/item-1/", "/content/calendar/", "/content/articles/article-1/schedule", "/social/", "/analytics/", "/operations/", "/settings/", "/api/admin/content/article-1/schedule/", "/api/admin/content/article-1/line-copy/generate", "/api/admin/seo/opportunities/sync/gsc", "/api/admin/seo/opportunities/sync/ga4", "/api/internal/line/system-delivery/dispatch/", "/api/internal/analytics/daily", "/api/internal/local-ai/jobs/1", "/api/unknown/", "/api/admin/unknown", "/api/preview/other", "/api/snt-admin/content/article-1/schedule", "/snt-admin/health", "/snt-admin/dashboard", "/snt-admin/distribution", "/api/snt-admin/seo/audit/x%2F..%2Foperations", "/content/articles/../calendar/", "/content/articles/%2e%2e/calendar/", "/content//articles/", "/api/admin/content/x%5Cschedule/preview", "/api/admin/content/%zz/preview", "/.well-known/workflow/v1/flow", "/_next/unknown", "/favicon.unknown"];
  for (const path of allowed) assert.equal(isAdminCapabilityPathAllowed(path, "editorial"), true, path);
  for (const path of denied) assert.equal(isAdminCapabilityPathAllowed(path, "editorial"), false, path);
  for (const path of denied) assert.equal(isAdminCapabilityPathAllowed(path, "full"), true, `default profile: ${path}`);
});

test("editorial login landing and callback validation cannot escape its allowed pages", () => {
  assert.equal(adminCapabilityLandingPath("editorial"), "/content/articles/");
  assert.equal(adminCapabilityLandingPath("full"), "/dashboard/");
  assert.equal(safeAdminCapabilityReturnPath("/content/articles/?q=1", "editorial"), "/content/articles/?q=1");
  for (const value of ["/operations/", "/content/calendar/", "https://evil.example/content/", "//evil.example/content/", "/studio/#bad", "/content/articles/%2e%2e/calendar/"]) assert.equal(safeAdminCapabilityReturnPath(value, "editorial"), null, value);
});

function child(script: string, profile = "editorial", conditions: string[] = [], variables: Record<string, string | undefined> = {}) {
  const result = spawnSync(process.execPath, [...conditions, "--import", "tsx", "-e", script], {
    encoding: "utf8", timeout: 15000,
    env: { PATH: process.env.PATH, NODE_ENV: "production", CCPUN_DEPLOYMENT_PROVIDER: "hostinger", CCPUN_DEPLOYMENT_ROLE: "admin", CCPUN_APP_ENV: "admin-uat", NEXT_PUBLIC_CCPUN_APP_ENV: "admin-uat", NEXT_PUBLIC_SANITY_PROJECT_ID: "ccb9lnw5", NEXT_PUBLIC_SANITY_DATASET: "uat", AUTH_URL: "https://candidate.example", CCPUN_ADMIN_CAPABILITY_PROFILE: profile, ...variables },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

test("native candidate proxy denies unsupported APIs before internal/alias exemptions and preserves browser auth/origin boundaries", () => {
  const values = child(`
    const {NextRequest}=require('next/server'); const {adminProxy}=require('./apps/admin/proxy.ts');
    const cases=[['/api/internal/line/system-delivery/dispatch/',null],['/api/snt-admin/content/id/schedule/',null],['/api/unknown/',null],['/operations/', 'owner'],['/content/articles/',null],['/api/admin/content/',null],['/content/articles/','owner'],['/login/','owner'],['/','owner'],['/api/admin/reviews/id/apply/','owner','POST','https://evil.example']];
    console.log(JSON.stringify(cases.map(([path,role,method='GET',origin])=>{const req=new NextRequest('https://candidate.example'+path,{method,headers:{host:'candidate.example',...(origin?{origin}:{})}});req.auth=role?{user:{role}}:null;const res=adminProxy(req);return{path,status:res.status,location:res.headers.get('location'),robots:res.headers.get('x-robots-tag'),cache:res.headers.get('cache-control')};})));
  `);
  assert.deepEqual(values.map((value: { status: number }) => value.status), [404, 404, 404, 404, 307, 401, 200, 307, 307, 403]);
  for (const value of values.slice(0, 4)) { assert.match(value.robots, /noindex/); assert.match(value.cache, /no-store/); }
  assert.match(values[4].location, /\/login\/\?callbackUrl=/);
  assert.equal(values[7].location, "https://candidate.example/content/articles/");
  assert.equal(values[8].location, "https://candidate.example/content/articles/");
});

test("editorial native delivery requires the exact existing flag and valid Admin Hostinger lane/ref", () => {
  const base = { CCPUN_DEPLOYMENT_PROVIDER: "hostinger", CCPUN_DEPLOYMENT_ROLE: "admin", CCPUN_APP_ENV: "admin-uat", CCPUN_LINE_SYSTEM_DELIVERY_ENABLED: "true", CCPUN_GIT_REF: "codex/candidate" };
  assert.equal(isAdminLineSystemDeliveryAllowed("editorial", base), true);
  assert.equal(isAdminLineSystemDeliveryAllowed("editorial", { ...base, CCPUN_APP_ENV: "production-admin", CCPUN_GIT_REF: "v4-production" }), true);
  for (const patch of [{ CCPUN_LINE_SYSTEM_DELIVERY_ENABLED: undefined }, { CCPUN_LINE_SYSTEM_DELIVERY_ENABLED: "false" }, { CCPUN_LINE_SYSTEM_DELIVERY_ENABLED: "TRUE" }, { CCPUN_DEPLOYMENT_PROVIDER: "vercel" }, { CCPUN_DEPLOYMENT_PROVIDER: "local" }, { CCPUN_DEPLOYMENT_ROLE: "web" }, { CCPUN_APP_ENV: "production" }, { CCPUN_APP_ENV: "development" }, { CCPUN_APP_ENV: "production-admin" }, { VERCEL_PROJECT_ID: "conflicting-project" }]) {
    assert.equal(isAdminLineSystemDeliveryAllowed("editorial", { ...base, ...patch }), false, JSON.stringify(patch));
  }
  assert.equal(isAdminLineSystemDeliveryAllowed("disabled", base), false);
  assert.equal(isAdminLineSystemDeliveryAllowed("full", {}), true);
  const values = child(`const {NextRequest}=require('next/server');const {adminProxy}=require('./apps/admin/proxy.ts');console.log(JSON.stringify(['/api/internal/line/system-delivery/dispatch/','/api/internal/line/system-delivery/dispatch','/api/internal/line/system-delivery/other/','/api/internal/line/system-delivery%2fdispatch/'].map(path=>{const req=new NextRequest('https://candidate.example'+path,{method:'POST',headers:{host:'candidate.example'}});req.auth=null;return adminProxy(req).status;})));`, "editorial", [], { CCPUN_LINE_SYSTEM_DELIVERY_ENABLED: "true" });
  assert.deepEqual(values, [200, 200, 404, 404]);
});

test("native delivery handler denies before body/provider and preserves capability contract when explicitly eligible", () => {
  const script = `const Module=require('node:module');const load=Module._load;let calls=0,reads=0;Module._load=function(name,...args){if(name==='server-only')return{};if(name==='@/lib/admin/line/provider')return{async sendLineSystemOutboundByCapability(){calls++;return{ok:true}}};return load.call(this,name,...args)};const route=require('./apps/admin/app/api/internal/line/system-delivery/dispatch/route.ts');(async()=>{const req=new Request('https://candidate.example/api/internal/line/system-delivery/dispatch/',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({outboundId:'11111111-1111-4111-8111-111111111111',dispatchToken:'a'.repeat(64)})});const text=req.text.bind(req);req.text=()=>{reads++;return text()};const res=await route.POST(req);console.log(JSON.stringify({status:res.status,body:await res.json(),calls,reads,get:route.GET().status}));})();`;
  for (const [profile, vars] of [["editorial", {}], ["disabled", { CCPUN_LINE_SYSTEM_DELIVERY_ENABLED: "true" }], ["editorial", { CCPUN_LINE_SYSTEM_DELIVERY_ENABLED: "true", CCPUN_APP_ENV: "production-admin", CCPUN_GIT_REF: "feature" }]] as const) {
    assert.deepEqual(child(script, profile, [], vars), { status: 404, body: { error: "not-found" }, calls: 0, reads: 0, get: 404 });
  }
  for (const [profile, vars] of [["editorial", { CCPUN_LINE_SYSTEM_DELIVERY_ENABLED: "true" }], ["full", {}]] as const) {
    assert.deepEqual(child(script, profile, [], vars), { status: 200, body: { status: "sent" }, calls: 1, reads: 1, get: 404 });
  }
});

test("editorial ingress rejects raw and forwarded unknown hosts even after Auth.js rewrites the URL", () => {
  const values = child(`const {NextRequest}=require('next/server');const {adminProxy}=require('./apps/admin/proxy.ts');console.log(JSON.stringify([['evil.example',null],['candidate.example','evil.example'],['candidate.example','candidate.example'],['candidate.example',null],['evil.example','candidate.example'],['candidate.example','candidate.example, evil.example'],[null,null]].map(([host,forwarded])=>{const req=new NextRequest('https://candidate.example/content/articles/',{headers:{...(host?{host}:{}),...(forwarded?{'x-forwarded-host':forwarded}:{})}});req.auth=null;return adminProxy(req).status;})));`);
  assert.deepEqual(values, [404, 404, 307, 307, 404, 404, 404]);
});

test("native full Production pins canonical auth origin and rejects raw/forwarded host aliases", () => {
  const variables = { CCPUN_APP_ENV: "production-admin", NEXT_PUBLIC_CCPUN_APP_ENV: "production-admin", NEXT_PUBLIC_SANITY_PROJECT_ID: "kyfxgjnq", NEXT_PUBLIC_SANITY_DATASET: "production", AUTH_URL: "https://admin.ccpun.com" };
  const script = `const {NextRequest}=require('next/server');const {adminProxy}=require('./apps/admin/proxy.ts');console.log(JSON.stringify([['admin.ccpun.com',null],['admin.ccpun.com','admin.ccpun.com'],['evil.example',null],['ccpun-admin-prod.vercel.app',null],['admin.ccpun.com','evil.example'],['admin.ccpun.com','admin.ccpun.com, admin.ccpun.com'],['admin.ccpun.com',''],['admin.ccpun.com, evil.example',null],[null,null]].map(([host,forwarded])=>{const req=new NextRequest('https://admin.ccpun.com/content/articles/',{headers:{...(host?{host}:{}),...(forwarded!==null?{'x-forwarded-host':forwarded}:{})}});req.auth={user:{role:'owner'}};const res=adminProxy(req);return{status:res.status,robots:res.headers.get('x-robots-tag'),cache:res.headers.get('cache-control')};})));`;
  const values = child(script, "full", [], variables);
  assert.deepEqual(values.map((value: { status: number }) => value.status), [200, 200, 404, 404, 404, 404, 404, 404, 404]);
  for (const denied of values.slice(2)) { assert.match(denied.robots, /noindex/); assert.match(denied.cache, /no-store/); }
  for (const authUrl of ["https://evil.example", "https://admin.ccpun.com/", "https://admin.ccpun.com:444", "http://admin.ccpun.com", "https://admin.ccpun.com?fixture=1"]) {
    const results = child(script, "full", [], { ...variables, AUTH_URL: authUrl });
    assert.ok(results.every((value: { status: number }) => value.status === 404), authUrl);
  }
});

test("native full host fence runs before Auth.js while nonnative browser auth remains unchanged", () => {
  const script = `const Module=require('node:module');const load=Module._load;let calls=0;Module._load=function(name,...args){if(name==='@/auth')return{auth(){return()=>{calls++;return new Response('mock-auth',{status:218})}}};return load.call(this,name,...args)};const {NextRequest}=require('next/server');const {default:proxy}=require('./apps/admin/proxy.ts');const cases=[['admin.ccpun.com',null],['evil.example',null],['ccpun-admin-prod.vercel.app',null],['admin.ccpun.com','evil.example'],['admin.ccpun.com','admin.ccpun.com, admin.ccpun.com']];const statuses=cases.map(([host,forwarded])=>proxy(new NextRequest('https://admin.ccpun.com/api/auth/session',{headers:{host,...(forwarded?{'x-forwarded-host':forwarded}:{})}}),{}).status);console.log(JSON.stringify({statuses,calls}));`;
  const variables = { CCPUN_APP_ENV: "production-admin", AUTH_URL: "https://admin.ccpun.com" };
  assert.deepEqual(child(script, "full", [], variables), { statuses: [218, 404, 404, 404, 404], calls: 1 });
  assert.deepEqual(child(script, "full", [], { ...variables, CCPUN_DEPLOYMENT_PROVIDER: "vercel" }), { statuses: [218, 218, 218, 218, 218], calls: 5 });
  assert.deepEqual(child(script, "full", [], { ...variables, CCPUN_DEPLOYMENT_ROLE: "web" }), { statuses: [404, 404, 404, 404, 404], calls: 0 });
});

test("native public-page rejection returns a private 404 without external rewrite while authenticated preview and Vercel rendering remain", () => {
  const script = `const {NextRequest}=require('next/server');const {adminProxy}=require('./apps/admin/proxy.ts');const cases=[['/blog/',null,'candidate.example'],['/blog/health-insurance/article/','owner','candidate.example'],['/content/articles/',null,'candidate.example'],['/blog/',null,'evil.example'],['/.well-known/workflow/v1/flow',null,'candidate.example']];console.log(JSON.stringify(cases.map(([path,role,host])=>{const req=new NextRequest('https://candidate.example'+path,{headers:{host}});req.auth=role?{user:{role}}:null;const res=adminProxy(req);return{status:res.status,rewrite:res.headers.get('x-middleware-rewrite'),robots:res.headers.get('x-robots-tag'),cache:res.headers.get('cache-control'),csp:res.headers.get('content-security-policy')};})));`;
  const native = child(script, "full");
  assert.deepEqual(native.map((value: { status: number }) => value.status), [404, 200, 307, 404, 404]);
  assert.equal(native[0].rewrite, null);
  assert.match(native[0].robots, /noindex/);
  assert.match(native[0].cache, /private, no-store/);
  assert.match(native[0].csp, /default-src/);
  assert.equal(native[1].rewrite, null);
  const legacy = child(script, "full", [], { CCPUN_DEPLOYMENT_PROVIDER: "vercel" });
  assert.equal(legacy[0].status, 404);
  assert.equal(legacy[0].rewrite, "https://candidate.example/admin-not-found/");
  assert.equal(legacy[1].status, 200);
});

test("schedule handlers independently deny editorial before identity, body, params or Workflow start", () => {
  const result = child(`
    const Module=require('node:module');const load=Module._load;let starts=0;
    Module._load=function(name,...args){if(name==='server-only')return{};if(name==='workflow/api')return{start(){starts++;throw Error('unexpected Workflow start')}};return load.call(this,name,...args)};
    const route=require('./apps/admin/app/api/admin/content/[id]/schedule/route.ts');
    (async()=>{const result=[];for(const method of ['GET','POST','DELETE']){const res=await route[method](new Request('https://candidate.example/api/admin/content/id/schedule/',{method}),{params:new Promise(()=>{})});result.push({method,status:res.status,body:await res.json(),cache:res.headers.get('cache-control')});}console.log(JSON.stringify({result,starts}));})();
  `);
  assert.equal(result.starts, 0);
  for (const value of result.result) { assert.equal(value.status, 404); assert.deepEqual(value.body, { error: "not-found" }); assert.match(value.cache, /no-store/); }
});

test("editorial Next config has standalone assets and no Workflow integration", () => {
  const result = child(`const {default:config}=require('./apps/admin/next.config.ts');console.log(JSON.stringify({output:config.output,profile:config.env.NEXT_PUBLIC_CCPUN_ADMIN_CAPABILITY_PROFILE,webpack:typeof config.webpack,skipTrailing:config.skipTrailingSlashRedirect}));`);
  assert.deepEqual(result, { output: "standalone", profile: "editorial", webpack: "undefined", skipTrailing: true });
});

test("Studio editorial actions remove scheduler and LINE-copy while keeping guarded article actions", () => {
  const script = `const {sanityStudioConfig:config}=require('./sanity.config.ts');const action=()=>null;action.action='delete';action.displayName='base-delete';console.log(JSON.stringify(config.document.actions([action],{schemaType:'article',dataset:'uat'}).map(action=>action.displayName??action.action)));`;
  const full = child(script, "full");
  const editorial = child(script);
  const optional = ["CCPunArticleScheduleAction", "CCPunGenerateArticleLineCopyAction", "CCPunImproveArticleLineCopyAction", "CCPunPublishArticleLineOnlyAction"];
  assert.ok(full.includes("CCPunArticleScheduleAction"));
  assert.deepEqual(editorial, full.filter((name: string) => !optional.includes(name)));
});
