import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { adminCapabilityLandingPath, getAdminCapabilityProfile, isAdminCapabilityPathAllowed, safeAdminCapabilityReturnPath } from "../../lib/admin/capability-profile";

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

function child(script: string, profile = "editorial", conditions: string[] = []) {
  const result = spawnSync(process.execPath, [...conditions, "--import", "tsx", "-e", script], {
    encoding: "utf8", timeout: 15000,
    env: { PATH: process.env.PATH, NODE_ENV: "production", CCPUN_DEPLOYMENT_PROVIDER: "hostinger", CCPUN_DEPLOYMENT_ROLE: "admin", CCPUN_APP_ENV: "admin-uat", NEXT_PUBLIC_CCPUN_APP_ENV: "admin-uat", NEXT_PUBLIC_SANITY_PROJECT_ID: "ccb9lnw5", NEXT_PUBLIC_SANITY_DATASET: "uat", AUTH_URL: "https://candidate.example", CCPUN_ADMIN_CAPABILITY_PROFILE: profile },
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

test("editorial ingress rejects raw and forwarded unknown hosts even after Auth.js rewrites the URL", () => {
  const values = child(`const {NextRequest}=require('next/server');const {adminProxy}=require('./apps/admin/proxy.ts');console.log(JSON.stringify([['evil.example',null],['candidate.example','evil.example'],['candidate.example','candidate.example'],['candidate.example',null]].map(([host,forwarded])=>{const req=new NextRequest('https://candidate.example/content/articles/',{headers:{host,...(forwarded?{'x-forwarded-host':forwarded}:{})}});req.auth=null;return adminProxy(req).status;})));`);
  assert.deepEqual(values, [404, 404, 307, 307]);
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
