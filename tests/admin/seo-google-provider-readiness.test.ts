import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { getGoogleDataAccessToken } from "../../lib/admin/seo-intelligence/google-data-auth";
import { getSeoGoogleProviderReadiness } from "../../lib/admin/seo-intelligence/provider-readiness";

test("SEO Google provider readiness validates resource identifiers and never exposes values", () => {
  const missing = getSeoGoogleProviderReadiness("gsc", {});
  assert.equal(missing.status, "configuration-required");
  assert.equal(missing.refreshableConnectionReady, false);

  const gsc = getSeoGoogleProviderReadiness("gsc", {
    CCPUN_GOOGLE_DATA_CLIENT_ID: "redacted-client",
    CCPUN_GOOGLE_DATA_CLIENT_SECRET: "redacted-secret",
    CCPUN_GOOGLE_DATA_REFRESH_TOKEN: "redacted-refresh",
    CCPUN_GSC_SITE_URL: "sc-domain:ccpun.com",
  });
  assert.equal(gsc.status, "manual-sync-ready");
  assert.equal(gsc.refreshableConnectionReady, true);
  assert.equal(JSON.stringify(gsc).includes("redacted"), false);
  assert.equal(gsc.scope, "https://www.googleapis.com/auth/webmasters.readonly");
  assert.match(gsc.limitation, /independent owner-authorized write credential/);

  const ga4 = getSeoGoogleProviderReadiness("ga4", {
    CCPUN_GOOGLE_DATA_CLIENT_ID: "redacted-client",
    CCPUN_GOOGLE_DATA_CLIENT_SECRET: "redacted-secret",
    CCPUN_GOOGLE_DATA_REFRESH_TOKEN: "redacted-refresh",
    CCPUN_GA4_PROPERTY_ID: "G-BAD-ID",
  });
  assert.equal(ga4.status, "configuration-required");
  assert.equal(ga4.required.find((item) => item.name === "CCPUN_GA4_PROPERTY_ID")?.valid, false);
});

test("Google data OAuth exchanges a refresh token without exposing credentials", async () => {
  let requestBody = "";
  const token = await getGoogleDataAccessToken({
    CCPUN_GOOGLE_DATA_CLIENT_ID: "client-id",
    CCPUN_GOOGLE_DATA_CLIENT_SECRET: "client-secret",
    CCPUN_GOOGLE_DATA_REFRESH_TOKEN: "refresh-token",
  }, async (_input, init) => {
    requestBody = String(init?.body);
    return new Response(JSON.stringify({ access_token: "short-lived-access", expires_in: 3600 }), { status: 200 });
  });

  assert.equal(token, "short-lived-access");
  assert.match(requestBody, /grant_type=refresh_token/);
  assert.match(requestBody, /refresh_token=refresh-token/);
  await assert.rejects(() => getGoogleDataAccessToken({}, async () => new Response()), /GOOGLE_DATA_NOT_CONFIGURED/);
});


test("SEO Google routes retain identity and exact ingress checks before any provider access", () => {
  const script = `
    const assert = require('node:assert/strict');
    const Module = require('node:module'), load = Module._load;
    let identity = {actorType:'human',role:'owner'}, providerCalls = 0, readinessCalls = 0;
    Module._load = function(name, ...args) {
      if (name === 'server-only') return {};
      if (name === 'next/server') return {NextResponse:{json:(body,init)=>Response.json(body,init)}};
      if (name === '@/lib/admin/identity') return {getAdminIdentity:async()=>identity};
      if (name === '@/lib/admin/seo-intelligence/google-data-auth') return {getGoogleDataAccessToken(){providerCalls++;throw Error('unexpected provider access')}};
      if (name === '@/lib/admin/seo-intelligence/provider-readiness') {
        const actual = load.call(this,name,...args);
        return {...actual,getSeoGoogleProviderReadiness(...args){readinessCalls++;return actual.getSeoGoogleProviderReadiness(...args)}};
      }
      return load.call(this,name,...args);
    };
    const sha = 'c64540ec7bd31c9380880173a03d996902b23b64';
    const base = {AUTH_URL:'https://admin-test.ccpun.com',CCPUN_DEPLOYMENT_PROVIDER:'hostinger',CCPUN_DEPLOYMENT_ROLE:'admin',CCPUN_APP_ENV:'admin-uat',NEXT_PUBLIC_CCPUN_APP_ENV:'admin-uat',NEXT_PUBLIC_SANITY_PROJECT_ID:'ccb9lnw5',NEXT_PUBLIC_SANITY_DATASET:'uat',CCPUN_SEO_INTELLIGENCE_ENABLED:'1',CCPUN_GIT_SHA:sha,CCPUN_GIT_REF:'codex/hostinger-release-uat-'+sha};
    process.env = {...base};
    global.fetch = async()=>{providerCalls++;throw Error('unexpected network')};
    const readiness = require('./apps/admin/app/api/admin/seo/providers/readiness/route.ts').GET;
    const syncs = ['gsc','ga4'].map(p=>require('./apps/admin/app/api/admin/seo/opportunities/sync/'+p+'/route.ts').POST);
    const headers = {host:'admin-test.ccpun.com','x-forwarded-host':'admin-test.ccpun.com','x-forwarded-proto':'https'};
    const req = (method,patch={})=>new Request('http://127.0.0.1:3000/api/admin/seo/providers/readiness/?provider=gsc',{method,headers:{...headers,...(method==='POST'?{origin:base.AUTH_URL}:{}),...patch},...(method==='POST'?{body:'{}'}:{})});
    (async()=>{
      assert.equal((await readiness(req('GET'))).status,200);
      for(const post of syncs) assert.equal((await post(req('POST'))).status,400); // Invalid input proves admission; no token call.
      for(const bad of [{host:'evil.example'},{'x-forwarded-host':'evil.example'},{'x-forwarded-host':'admin-test.ccpun.com, evil.example'},{'x-forwarded-proto':'http'}]) {
        for(const [handler,method] of [[readiness,'GET'],...syncs.map(p=>[p,'POST'])]) assert.equal((await handler(req(method,bad))).status,403);
      }
      process.env.AUTH_URL = 'https://admin.ccpun.com';
      assert.equal((await readiness(req('GET'))).status,403);
      for(const post of syncs) assert.equal((await post(req('POST'))).status,403);
      process.env = {...base};
      for(const post of syncs) {
        assert.equal((await post(req('POST',{origin:''}))).status,403);
        assert.equal((await post(req('POST',{origin:'https://evil.example'}))).status,403);
        process.env.CCPUN_SEO_INTELLIGENCE_ENABLED = '0';
        assert.equal((await post(req('POST'))).status,404);
        process.env.CCPUN_SEO_INTELLIGENCE_ENABLED = '1';
      }
      identity = {actorType:'human',role:'viewer'};
      assert.equal((await readiness(req('GET'))).status,200); // Existing viewer read permission stays intact.
      for(const post of syncs) assert.equal((await post(req('POST'))).status,403);
      for(const [value,status] of [[null,401],[{actorType:'service',role:'owner'},403]]) {
        identity = value;
        for(const [handler,method] of [[readiness,'GET'],...syncs.map(p=>[p,'POST'])]) assert.equal((await handler(req(method))).status,status);
      }
      assert.equal(readinessCalls,2);
      assert.equal(providerCalls,0);
      console.log(JSON.stringify({providerCalls,readinessCalls,status:'pass'}));
    })().catch(error=>{console.error(error);process.exitCode=1});
  `;
  const result = spawnSync(process.execPath, [...process.execArgv, "-e", script], {
    cwd: new URL("../../", import.meta.url),
    env: { NODE_ENV: "test", PATH: process.env.PATH, NODE_PATH: process.env.NODE_PATH },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(JSON.parse(result.stdout), { providerCalls: 0, readinessCalls: 2, status: "pass" });
});
