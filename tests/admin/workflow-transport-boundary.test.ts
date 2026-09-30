import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { nativeWorkflowTransportDisposition } from "../../lib/admin/workflow-transport-boundary";

const variables = {
  CCPUN_DEPLOYMENT_PROVIDER: "hostinger", CCPUN_DEPLOYMENT_ROLE: "admin",
  CCPUN_APP_ENV: "admin-uat", CCPUN_GIT_REF: "fixture",
  WORKFLOW_TARGET_WORLD: "@workflow/world-postgres",
  WORKFLOW_LOCAL_BASE_URL: "http://127.0.0.1:3101", PORT: "3101",
};
const path = "/.well-known/workflow/v1/flow";
function request(url = `${variables.WORKFLOW_LOCAL_BASE_URL}${path}`, method = "POST", headers: Record<string, string> = {}) {
  return { url, method, headers: new Headers({ host: "127.0.0.1:3101", ...headers }) };
}

test("native queue accepts only exact configured loopback flow/step, with valid full Admin lane", () => {
  for (const receiver of ["flow", "step"]) {
    const input = request(`http://127.0.0.1:3101/.well-known/workflow/v1/${receiver}`);
    assert.equal(nativeWorkflowTransportDisposition(input, variables, "full"), "allow");
    assert.equal(nativeWorkflowTransportDisposition(request(`http://localhost:3101/.well-known/workflow/v1/${receiver}`), variables, "full"), "allow");
    assert.equal(nativeWorkflowTransportDisposition(input, { ...variables, CCPUN_APP_ENV: "production-admin", CCPUN_GIT_REF: "v4-production" }, "full"), "allow");
    for (const profile of ["editorial", "disabled"] as const) assert.equal(nativeWorkflowTransportDisposition(input, variables, profile), "deny");
  }
  for (const patch of [
    { CCPUN_DEPLOYMENT_ROLE: "web" }, { CCPUN_APP_ENV: "development" },
    { CCPUN_APP_ENV: "production-admin" }, { VERCEL_PROJECT_ID: "conflicting-project" },
    { WORKFLOW_TARGET_WORLD: undefined }, { WORKFLOW_TARGET_WORLD: "local" },
    { WORKFLOW_TARGET_WORLD: "postgres" }, { WORKFLOW_LOCAL_BASE_URL: undefined },
    { WORKFLOW_LOCAL_BASE_URL: "http://localhost:3101" }, { WORKFLOW_LOCAL_BASE_URL: "http://127.0.0.1:3101/" },
    { WORKFLOW_LOCAL_BASE_URL: "http://user:fixture@127.0.0.1:3101" },
    { WORKFLOW_LOCAL_BASE_URL: "http://127.0.0.1:3101?fixture=1" },
    { WORKFLOW_LOCAL_BASE_URL: "http://127.0.0.1:3102" }, { WORKFLOW_LOCAL_BASE_URL: "http://[::1]:3101" },
    { PORT: undefined }, { PORT: "0" }, { PORT: "03101" }, { PORT: "65536" }, { PORT: "3101 " },
  ]) assert.equal(nativeWorkflowTransportDisposition(request(), { ...variables, ...patch }, "full"), "deny", JSON.stringify(patch));
});

test("host/metadata cannot grant public Workflow ingress; forwarded and browser requests are denied", () => {
  const headerFixtures: Record<string, string>[] = [
    { host: "admin.ccpun.com" }, { host: "localhost:3101" }, { host: "127.0.0.1:3102" },
    { origin: "http://127.0.0.1:3101" }, { origin: "null" }, { forwarded: "for=127.0.0.1" },
    { "x-forwarded-host": "127.0.0.1:3101" }, { "x-forwarded-for": "127.0.0.1" },
    { "x-forwarded-proto": "http" }, { "x-forwarded-port": "3101" },
  ];
  for (const headers of headerFixtures) assert.equal(nativeWorkflowTransportDisposition(request(undefined, undefined, headers), variables, "full"), "deny");
  const forged = request(`https://admin.ccpun.com${path}`, "POST", { "x-vqs-queue-name": "workflow", "x-vqs-queue-id": "fixture", "x-vqs-queue-attempt": "1" });
  assert.equal(nativeWorkflowTransportDisposition(forged, variables, "full"), "deny");
  assert.equal(nativeWorkflowTransportDisposition({ ...request(), headers: new Headers() }, variables, "full"), "deny");
  for (const method of ["GET", "HEAD", "OPTIONS", "PUT", "DELETE"]) assert.equal(nativeWorkflowTransportDisposition(request(undefined, method), variables, "full"), "deny");
});

test("encoded, normalized, malformed and noncanonical namespace variants never receive loopback permission", () => {
  for (const variant of [
    "/.well-known/workflow", "/.well-known/workflow/", `${path}/`, `${path}?fixture=1`, `${path}#fixture`,
    "/.well-known/workflow/v1/unknown", "/.well-known/workflow/v2/flow", "/.well-known/workflow/v1/health",
    "/.well-known/%77orkflow/v1/flow", "/%2ewell-known/workflow/v1/flow", "/%252ewell-known/workflow/v1/flow",
    "/.well-known/workflow%2fv1/flow", "/.well-known/workflow%5cv1/flow", "/.well-known/workflow/v1/%66low",
    "/.well-known//workflow/v1/flow", "//.well-known/workflow/v1/flow", "/x/../.well-known/workflow/v1/flow",
    "/.well-known/workflow/v1/../v1/flow", "/.well-known/workflow/%zz", "/.well-known/workflow\\v1\\flow",
    "/.well-known/%77orkflow/%zz", "/.well-known/%77orkflow/%FF",
  ]) assert.equal(nativeWorkflowTransportDisposition(request(`http://127.0.0.1:3101${variant}`), variables, "full"), "deny", variant);
  for (const unrelated of ["/content/articles/", "/api/auth/session", "/.well-known/other"]) {
    assert.equal(nativeWorkflowTransportDisposition(request(`https://admin.ccpun.com${unrelated}`), variables, "full"), "unrelated");
  }
  // Preserve the existing non-Hostinger transport behavior.
  assert.equal(nativeWorkflowTransportDisposition(request(), { ...variables, CCPUN_DEPLOYMENT_PROVIDER: "vercel" }, "full"), "unrelated");
});

test("outer proxy fences before Auth.js URL rewrite and leaves Workflow body unread", () => {
  const script = `
    const Module=require('node:module');const load=Module._load;let authCalls=0,bodyReads=0;
    Module._load=function(name,...args){if(name==='@/auth')return{auth(){return()=>{authCalls++;return new Response('auth-wrapper',{status:218})}}};return load.call(this,name,...args)};
    const {NextRequest}=require('next/server');const {default:proxy}=require('./apps/admin/proxy.ts');
    const cases=[
      ['http://127.0.0.1:3101/.well-known/workflow/v1/flow','127.0.0.1:3101'],
      ['https://admin.ccpun.com/.well-known/workflow/v1/flow','127.0.0.1:3101'],
      ['http://127.0.0.1:3101/.well-known/workflow/v1/step','127.0.0.1:3101','https://admin.ccpun.com'],
      ['https://admin.ccpun.com/content/articles/','admin.ccpun.com'],
    ];const observations=cases.map(([url,host,origin])=>{const req=new NextRequest(url,{method:'POST',headers:{host,...(origin?{origin}:{})},body:'FAKE_ONLY_BODY'});req.text=()=>{bodyReads++;throw Error('body must remain unread')};const res=proxy(req,{});return{status:res.status,bodyUsed:req.bodyUsed,robots:res.headers.get('x-robots-tag'),cache:res.headers.get('cache-control')};});
    console.log(JSON.stringify({observations,authCalls,bodyReads}));
  `;
  function run(profile: string, provider = "hostinger") {
    const result = spawnSync(process.execPath, ["--import", "tsx", "-e", script], {
      encoding: "utf8", timeout: 15000,
      env: { PATH: process.env.PATH, NODE_ENV: "production", ...variables, AUTH_URL: "https://admin.ccpun.com", CCPUN_ADMIN_CAPABILITY_PROFILE: profile, CCPUN_DEPLOYMENT_PROVIDER: provider },
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return JSON.parse(result.stdout);
  }
  const full = run("full");
  assert.deepEqual(full.observations.map((item: { status: number }) => item.status), [200, 404, 404, 218]);
  assert.equal(full.authCalls, 1);
  assert.equal(full.bodyReads, 0);
  assert.ok(full.observations.every((item: { bodyUsed: boolean }) => !item.bodyUsed));
  for (const denied of full.observations.slice(1, 3)) { assert.match(denied.robots, /noindex/); assert.match(denied.cache, /no-store/); }
  const editorial = run("editorial");
  assert.deepEqual(editorial.observations.map((item: { status: number }) => item.status), [404, 404, 404, 218]);
  assert.equal(editorial.authCalls, 1);
  const vercel = run("full", "vercel");
  assert.deepEqual(vercel.observations.map((item: { status: number }) => item.status), [218, 218, 218, 218]);
  assert.equal(vercel.authCalls, 4);
});
