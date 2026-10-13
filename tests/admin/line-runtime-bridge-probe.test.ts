import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createLocalJWKSet, exportJWK, generateKeyPair, jwtVerify, SignJWT } from "jose";
import { probeLineBridgeFromAdmin, probeLineBridgeFromWeb } from "../../lib/runtime/line-bridge-probe";
type RetiredRole = "admin" | "web";
const sha = "a".repeat(40);
const variables = (role: RetiredRole) => ({ VERCEL_PROJECT_ID: role === "admin" ? "prj_6tuUxJxYbQ4mpF7sMgNWx2p2jowN" : "prj_dxwjITkd0av5QiJQv2snUlIASUWu",
  VERCEL_ENV: "production", CCPUN_APP_ENV: role === "web" ? "production" : "production-admin",
  VERCEL_GIT_COMMIT_REF: "v4-production", VERCEL_GIT_COMMIT_SHA: sha });
const claims = (role: RetiredRole) => ({ aud: "https://vercel.com/retired-team", sub: "retired-" + role,
  owner: "retired-team", owner_id: "team_retired", project: "ccpun-" + role,
  project_id: variables(role).VERCEL_PROJECT_ID, environment: "production" });
const request = (authorization = "Bearer admin-token", ownToken = "web-token") => new Request("https://ccpun.com/api/internal/line/bridge-probe/", {
  headers: { authorization, "x-vercel-oidc-token": ownToken } });
const adminHeaders = new Headers({ "x-vercel-oidc-token": "admin-token" });
const unsupported = (role: RetiredRole) => ({ status: role === "admin" ? "runtime-unavailable" : "unauthorized", webSha: null });

test("retired Admin/Web claims, including every mismatched field, cannot initiate transport", async () => {
  for (const role of ["web", "admin"] as const) {
    const valid = claims(role);
    for (const value of [valid, claims(role === "web" ? "admin" : "web"), ...["aud", "sub", "owner", "owner_id", "project", "project_id", "environment"].map(key => ({ ...valid, [key]: "wrong" })), { ...valid, aud: [valid.aud] }]) {
      assert.deepEqual(await probeLineBridgeFromWeb(request("Bearer " + JSON.stringify(value)), variables(role)), unsupported("web"));
      assert.deepEqual(await probeLineBridgeFromAdmin(adminHeaders, variables(role)), unsupported("admin"));
    }
  }
});

test("signed, expired, wrong-issuer, caller-swapped and tampered tokens remain unsupported without verification", async () => {
  const pair = await generateKeyPair("RS256");
  const local = createLocalJWKSet({ keys: [{ ...await exportJWK(pair.publicKey), kid: "synthetic-test" }] });
  let verificationCalls = 0;
  const verify = async (value: string) => { verificationCalls++; return jwtVerify(value, local); };
  async function token(role: RetiredRole, issuer = "https://oidc.vercel.com/retired-team", expiration = "5m") {
    return new SignJWT(claims(role)).setProtectedHeader({ alg: "RS256", kid: "synthetic-test" }).setIssuer(issuer).setIssuedAt().setExpirationTime(expiration).sign(pair.privateKey);
  }
  const valid = await token("web"); const parts = valid.split(".");
  parts[2] = `${parts[2]![0] === "A" ? "B" : "A"}${parts[2]!.slice(1)}`;
  for (const value of [valid, await token("admin"), await token("web", "https://oidc.vercel.com"), await token("web", "https://attacker.invalid"), await token("web", undefined, "-1h"), parts.join("."), null, "x".repeat(16_385)]) {
    assert.deepEqual(await probeLineBridgeFromWeb(request("Bearer " + value), variables("web"), { verifyToken: verify }), unsupported("web"));
    assert.deepEqual(await probeLineBridgeFromAdmin(new Headers({ "x-vercel-oidc-token": String(value) }), variables("admin"), { verifyToken: verify }), unsupported("admin"));
  }
  assert.equal(verificationCalls, 0);
});

test("retired probe reads neither request nor env nor dependencies and creates no timeout", async (context) => {
  const events: string[] = []; const delays: number[] = [];
  context.mock.method(AbortSignal, "timeout", (delay: number) => { delays.push(delay); return new AbortController().signal; });
  const opaque = new Proxy({}, { get() { events.push("read"); throw new Error("private must not be read"); } });
  assert.deepEqual(await probeLineBridgeFromWeb(opaque, opaque, opaque), unsupported("web"));
  assert.deepEqual(await probeLineBridgeFromAdmin(opaque, opaque, opaque), unsupported("admin"));
  assert.deepEqual(events, []); assert.deepEqual(delays, []);
});

test("Preview/local/Hostinger/wrong project/ref and former Production identities never fetch", async () => {
  let fetches = 0; const dependencies = { fetch: async () => { fetches++; throw new Error("no network"); } };
  for (const role of ["admin", "web"] as const) for (const patch of [{}, { VERCEL_ENV: "preview" }, { VERCEL_PROJECT_ID: "prj_wrong" }, { VERCEL_GIT_COMMIT_REF: "feature/preview" },
    { VERCEL_PROJECT_ID: undefined, CCPUN_DEPLOYMENT_PROVIDER: "hostinger", CCPUN_DEPLOYMENT_ROLE: role },
    { VERCEL_PROJECT_ID: undefined, CCPUN_DEPLOYMENT_PROVIDER: "local", CCPUN_DEPLOYMENT_ROLE: role }]) {
    const env = { ...variables(role), ...patch };
    assert.deepEqual(role === "web" ? await probeLineBridgeFromWeb(request(), env, dependencies) : await probeLineBridgeFromAdmin(adminHeaders, env, dependencies), unsupported(role));
  }
  assert.equal(fetches, 0);
});

test("missing or caller-reused tokens remain unsupported without fetching", async () => {
  let fetches = 0; const dependencies = { fetch: async () => { fetches++; return new Response(null, { status: 204 }); } };
  assert.deepEqual(await probeLineBridgeFromAdmin(new Headers(), variables("admin"), dependencies), unsupported("admin"));
  assert.deepEqual(await probeLineBridgeFromWeb(request("Bearer admin-token", ""), variables("web"), dependencies), unsupported("web"));
  assert.deepEqual(await probeLineBridgeFromWeb(request("Bearer admin-token", "admin-token"), variables("web"), dependencies), unsupported("web"));
  assert.equal(fetches, 0);
});

test("former durable HTTP outcomes and private errors cannot trigger a probe or leak a payload", async () => {
  for (const status of [204, 503, 401, 302, 500]) {
    let fetches = 0;
    const value = await probeLineBridgeFromWeb(request(), variables("web"), { fetch: async () => { fetches++; return new Response(null, { status }); } });
    assert.deepEqual(value, unsupported("web")); assert.equal(fetches, 0);
  }
  for (const error of [new DOMException("private token detail", "TimeoutError"), new Error("private error detail")]) {
    let fetches = 0;
    const value = await probeLineBridgeFromWeb(request(), variables("web"), { fetch: async () => { fetches++; throw error; } });
    assert.deepEqual(value, unsupported("web")); assert.equal(fetches, 0); assert.doesNotMatch(JSON.stringify(value), /private|token/);
  }
});

test("Admin fixed-target transport and all former provider payloads are retired without timeout or fetch", async () => {
  for (const payload of [{ status: "ready", webSha: sha, token: "MUST_NOT_LEAK" }, { status: "invented" }, { status: "ready", webSha: "MUST_NOT_LEAK" }, { status: "ready" }]) {
    let fetches = 0;
    const value = await probeLineBridgeFromAdmin(adminHeaders, variables("admin"), { fetch: async () => { fetches++; return Response.json(payload, { status: 503 }); } });
    assert.deepEqual(value, unsupported("admin")); assert.equal(fetches, 0); assert.doesNotMatch(JSON.stringify(value), /MUST_NOT_LEAK|invented/);
  }
});

test("owner-only queue health removes SSR Vercel probe while private Node endpoint remains isolated", () => {
  const page = readFileSync("apps/admin/app/(control-plane)/operations/health/page.tsx", "utf8");
  assert.doesNotMatch(page, /probeLineBridgeFromAdmin|line-bridge-probe/);
  const queueRead = page.indexOf("readLineDeliveryHealth(),");
  assert.ok(queueRead > page.indexOf('requireAdminPermission("settings:read")'));
  assert.match(page, /readLineSystemDeliveryDatabaseReadiness/);
  assert.match(page, /ข้อมูลและคิว LINE/);
  const route = readFileSync("apps/web/app/api/internal/line/bridge-probe/route.ts", "utf8");
  assert.match(route, /runtime = "nodejs"/);
  assert.match(route, /private, no-cache, no-store/);
  assert.match(route, /noindex, nofollow, noarchive/);
  for (const path of ["lib/runtime/line-bridge-probe.ts"]) {
    const source = readFileSync(path, "utf8");
    assert.doesNotMatch(source, /VERCEL_OIDC_TOKEN|console\.|private-ingestion|neon|sanity|process\.env\.[A-Z_]*TOKEN/);
  }
});

test("native endpoints return private404 and retired nonnative Web returns unauthorized without verifier, fetch or data access", () => {
  const script = `
    const Module=require('node:module'),load=Module._load;
    const counts={verify:0,fetch:0,data:0,body:0};
    global.fetch=async()=>{counts.fetch++;return Response.json({fixture:true});};
    async function authorized(req){
      counts.verify++;
      if(!req.headers.get('authorization'))return false;
      await fetch('https://oidc.vercel.com/synthetic-fixture');return true;
    }
    Module._load=function(name,...args){
      if(name==='@/lib/runtime/line-bridge-probe')return{probeLineBridgeFromWeb:async()=>({status:'unauthorized',webSha:null})};
      if(name==='@/lib/admin/line/web-service-auth')return{isProductionWebServiceRequestAuthorized:authorized};
      if(name==='@/lib/admin/line/private-ingestion')return{
        probeLinePrivateIngestRuntime:async()=>{counts.data++;return true;},
        resolveLineIngestRuntime:()=>{counts.data++;return{lane:'production'};},
        createLinePrivateIngestor:()=>{counts.data++;return async()=>{counts.data++;return'inserted';};}
      };
      if(name==='@/lib/admin/line/encrypted-ingest')return{
        encryptedLineEventSchema:{safeParse:()=>({success:true,data:{}})},
        readEncryptedLineEventBody:async()=>{counts.body++;return'{}';}
      };
      return load.call(this,name,...args);
    };
    const web=require('./apps/web/app/api/internal/line/bridge-probe/route.ts');
    const health=require('./apps/admin/app/api/internal/line/bridge-health/route.ts');
    const ingest=require('./apps/admin/app/api/internal/line/ingest-event/route.ts');
    const cases=[[web.GET,'GET'],[health.GET,'GET'],[health.HEAD,'HEAD'],[ingest.POST,'POST']];
    async function run(provider,bearer){
      if(provider===null)delete process.env.CCPUN_DEPLOYMENT_PROVIDER;
      else process.env.CCPUN_DEPLOYMENT_PROVIDER=provider;
      const rows=[];
      for(const[handler,method]of cases){
        for(const key of Object.keys(counts))counts[key]=0;
        const req=new Request('https://fixture.invalid/api/internal/line/fixture/',{
          method,headers:{...(bearer?{authorization:'Bearer '+ 'x'.repeat(160)}:{}),'content-type':'application/json'},
          ...(method==='POST'?{body:'{}'}:{})
        });
        const res=await handler(req);
        rows.push({status:res.status,cache:res.headers.get('cache-control'),robots:res.headers.get('x-robots-tag'),empty:(await res.text())==='',counts:{...counts}});
      }
      return rows;
    }
    (async()=>console.log(JSON.stringify({native:await run('hostinger',true),normalized:await run(' HOSTINGER ',true),vercelDenied:await run('vercel',false),inferredDenied:await run(null,false),vercelAllowed:await run('vercel',true)})))().catch(()=>process.exit(1));
  `;
  const child = spawnSync(process.execPath, ["--import", "tsx", "-e", script], {
    encoding: "utf8", timeout: 15000,
    env: { PATH: process.env.PATH, NODE_ENV: "test", NEXT_TELEMETRY_DISABLED: "1" },
  });
  assert.equal(child.status, 0, "isolated public route fixture must complete");
  const rows = JSON.parse(child.stdout) as Record<string, Array<{
    status: number; cache: string; robots: string; empty: boolean;
    counts: { verify: number; fetch: number; data: number; body: number };
  }>>;
  for (const lane of ["native", "normalized"]) for (const row of rows[lane]!) {
    assert.equal(row.status, 404); assert.equal(row.empty, true);
    assert.match(row.cache, /private.*no-store/); assert.match(row.robots, /noindex, nofollow, noarchive/);
    assert.deepEqual(row.counts, { verify: 0, fetch: 0, data: 0, body: 0 });
  }
  for (const lane of ["vercelDenied", "inferredDenied"]) {
    assert.deepEqual(rows[lane]!.map((row) => row.status), [401, 404, 404, 404]);
    for (const row of rows[lane]!) {
      assert.match(row.cache, /private.*no-store/); assert.match(row.robots, /noindex, nofollow, noarchive/);
      assert.deepEqual(row.counts, { verify: 0, fetch: 0, data: 0, body: 0 });
    }
  }
  assert.deepEqual(rows.vercelAllowed!.map((row) => row.status), [401, 404, 404, 404]);
  assert.ok(rows.vercelAllowed!.every((row) => row.counts.verify === 0 && row.counts.fetch === 0 && row.counts.data === 0 && row.counts.body === 0));
});
