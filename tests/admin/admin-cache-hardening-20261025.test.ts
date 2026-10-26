import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { adminCacheHardeningSources, adminOps20261025PredecessorDigest } from "../../qa/admin-ops-20261025-proof.mjs";

// Admin cache hardening (2026-10-25): no Admin page, redirect, auth or API
// response may be stored by a browser, shared proxy or CDN; content-hashed
// public assets stay cacheable. Isolated fixtures only: auth is mocked, no
// network, database, browser session or inherited credentials.
const ROOT = new URL("../../", import.meta.url);
const PRIVATE = "private, no-cache, no-store, max-age=0, must-revalidate";
const BASE_ENV: NodeJS.ProcessEnv = {
  PATH: "/usr/local/bin:/usr/bin:/bin", NODE_ENV: "production", AUTH_URL: "https://candidate.example",
  CCPUN_DEPLOYMENT_PROVIDER: "hostinger", CCPUN_DEPLOYMENT_ROLE: "admin", CCPUN_APP_ENV: "admin-uat",
  NEXT_PUBLIC_CCPUN_APP_ENV: "admin-uat", NEXT_PUBLIC_SANITY_PROJECT_ID: "ccb9lnw5", NEXT_PUBLIC_SANITY_DATASET: "uat",
  CCPUN_ADMIN_CAPABILITY_PROFILE: "full", NEXT_PUBLIC_CCPUN_ADMIN_CAPABILITY_PROFILE: "full",
  CCPUN_GIT_SHA: "a".repeat(40), CCPUN_GIT_REF: "codex/cache-fixture", CCPUN_RELEASE_ID: "cache-fixture",
};

type Observed = { status: number; location: string | null; next: string | null; cache: string | null; cdn: string | null; cloudflare: string | null };

function runProxyFixture(): Record<string, Observed> {
  const result = spawnSync(process.execPath, ["--import", "tsx", "-e", `
    const Module=require('node:module');const load=Module._load;
    Module._load=function(name,...args){
      if(name==='server-only')return{};
      if(name==='@/auth')return{auth(fn){return fn}};
      return load.call(this,name,...args);
    };
    const {NextRequest}=require('next/server');
    const proxyModule=require('./apps/admin/proxy.ts');
    const observe=res=>({status:res.status,location:res.headers.get('location'),next:res.headers.get('x-middleware-next'),
      cache:res.headers.get('cache-control'),cdn:res.headers.get('cdn-cache-control'),cloudflare:res.headers.get('cloudflare-cdn-cache-control')});
    function request(path,{role=null,host='candidate.example',method='GET'}={}){
      const req=new NextRequest('https://candidate.example'+path,{method,headers:{host}});
      req.auth=role?{user:{role}}:null;return req;
    }
    const viaDefault=async(path,options)=>observe(await proxyModule.default(request(path,options),{}));
    // Equivalence: the outer proxy returns exactly the adminProxy decision plus
    // the cache policy headers; status, Location, body and every other header are unchanged.
    let equivalence=0;const mismatches=[];
    const CACHE_KEYS=new Set(['cache-control','cdn-cache-control','cloudflare-cdn-cache-control']);
    const strip=headers=>Object.fromEntries([...headers].filter(([key])=>!CACHE_KEYS.has(key)));
    async function compare(){
      for(const path of ['/','/login/','/dashboard/','/content/articles/','/api/admin/session/','/api/auth/session','/api/auth/callback/google','/api/internal/line/ingest/','/studio/','/blog/example/','/definitely-missing/','/admin-not-found/','/snt-admin/','/_next/static/chunks/app.js','/favicon.ico','/robots.txt'])
        for(const role of [null,'owner','viewer'])for(const host of ['candidate.example','evil.example'])for(const method of ['GET','POST']){
          const decision=proxyModule.adminProxy(request(path,{role,host,method}));
          const outer=await proxyModule.default(request(path,{role,host,method}),{});
          const same=decision.status===outer.status&&JSON.stringify(strip(decision.headers))===JSON.stringify(strip(outer.headers))&&(await decision.text())===(await outer.text());
          if(!same)mismatches.push([path,role,host,method]);
          equivalence++;
        }
    }
    (async()=>{
      await compare();
      console.log(JSON.stringify({equivalence,mismatches,
        entryAnonymous:await viaDefault('/'),
        entryOwner:await viaDefault('/',{role:'owner'}),
        loginAnonymous:await viaDefault('/login/'),
        loginOwner:await viaDefault('/login/',{role:'owner'}),
        dashboardAnonymous:await viaDefault('/dashboard/'),
        dashboardOwner:await viaDefault('/dashboard/',{role:'owner'}),
        apiAnonymous:await viaDefault('/api/admin/session/'),
        apiOwner:await viaDefault('/api/admin/session/',{role:'owner'}),
        authApi:await viaDefault('/api/auth/session'),
        authCallback:await viaDefault('/api/auth/callback/google'),
        staticChunk:await viaDefault('/_next/static/chunks/app.js'),
        staticMedia:await viaDefault('/_next/static/media/font.woff2'),
        defaultLoginAnonymous:await viaDefault('/login/'),
        defaultDashboardAnonymous:await viaDefault('/dashboard/'),
        defaultHostDenied:await viaDefault('/login/',{host:'evil.example'}),
        defaultStaticChunk:await viaDefault('/_next/static/chunks/app.js'),
        publicAssetPaths:['/_next/static/chunks/app.js','/_next/image','/assets/logo.png','/favicon.ico','/favicon.png'].map(proxyModule.isAdminPublicStaticAssetPath),
        privatePaths:['/','/login/','/dashboard/','/api/auth/session','/_next/data/x.json','/_next/staticx/a.js','/assets','/favicon.svg','/studio/'].map(proxyModule.isAdminPublicStaticAssetPath),
      }));
    })().catch(error=>{console.error(error);process.exit(1)});
  `], { cwd: ROOT, encoding: "utf8", timeout: 20000, env: BASE_ENV });
  assert.equal(result.status, 0, "isolated Admin proxy cache fixture failed: " + result.stderr);
  return JSON.parse(result.stdout.trim().split("\n").at(-1)!);
}

function assertPrivateNoStore(name: string, observed: Observed, { exact = true } = {}) {
  if (exact) assert.equal(observed.cache, PRIVATE, name + ": Cache-Control");
  // Pre-existing fence 404s keep their equivalent `private, no-store` value.
  else assert.match(observed.cache ?? "", /^private, (?:no-cache, )?no-store\b/, name + ": Cache-Control");
  assert.equal(observed.cdn, "no-store", name + ": CDN-Cache-Control");
  assert.equal(observed.cloudflare, "no-store", name + ": Cloudflare-CDN-Cache-Control");
}

test("every Admin proxy page, redirect, auth and API response is private no-store", () => {
  const values = runProxyFixture();
  // Redirects: entry -> login/landing, login -> landing, protected page -> login.
  assert.equal(values.entryAnonymous.status, 307);
  assert.equal(new URL(values.entryAnonymous.location!).pathname, "/login/");
  assert.equal(values.entryOwner.status, 307);
  assert.equal(values.loginOwner.status, 307);
  assert.equal(values.dashboardAnonymous.status, 307);
  assert.equal(new URL(values.dashboardAnonymous.location!).pathname, "/login/");
  for (const name of ["entryAnonymous", "entryOwner", "loginOwner", "dashboardAnonymous", "defaultDashboardAnonymous"]) {
    assertPrivateNoStore(name, values[name]);
  }
  // HTML pages continue to the renderer carrying the private policy.
  for (const name of ["loginAnonymous", "dashboardOwner", "defaultLoginAnonymous"]) {
    assert.equal(values[name].status, 200, name);
    assert.equal(values[name].next, "1", name);
    assertPrivateNoStore(name, values[name]);
  }
  // API and Auth.js responses.
  assert.equal(values.apiAnonymous.status, 401);
  assertPrivateNoStore("apiAnonymous", values.apiAnonymous);
  assert.equal(values.apiOwner.next, "1");
  assertPrivateNoStore("apiOwner", values.apiOwner);
  for (const name of ["authApi", "authCallback"]) {
    assert.equal(values[name].next, "1", name);
    assertPrivateNoStore(name, values[name]);
  }
  // Host-fence denials are private too.
  assert.equal(values.defaultHostDenied.status, 404);
  assertPrivateNoStore("defaultHostDenied", values.defaultHostDenied, { exact: false });
});

test("the outer proxy changes only cache headers: every adminProxy routing/auth decision is preserved", () => {
  const values = runProxyFixture() as unknown as { equivalence: number; mismatches: unknown[] };
  assert.equal(values.equivalence, 16 * 3 * 2 * 2);
  assert.deepEqual(values.mismatches, []);
});

test("/_next/static stays cacheable: the proxy adds no private or CDN header", () => {
  const values = runProxyFixture();
  for (const name of ["staticChunk", "staticMedia", "defaultStaticChunk"]) {
    assert.equal(values[name].next, "1", name);
    assert.equal(values[name].cache, null, name);
    assert.equal(values[name].cdn, null, name);
    assert.equal(values[name].cloudflare, null, name);
  }
  assert.deepEqual(values.publicAssetPaths, [true, true, true, true, true]);
  assert.deepEqual(values.privatePaths, [false, false, false, false, false, false, false, false, false]);
});

test("next.config header rules make pages, login, auth and APIs private no-store and leave static assets cacheable", () => {
  const result = spawnSync(process.execPath, ["--import", "tsx", "-e", `
    (async()=>{
      let config=(await import('./apps/admin/next.config.ts')).default;if(config.default)config=config.default;
      const {buildCustomRoute}=require('next/dist/lib/build-custom-route.js');
      const rules=(await config.headers()).map(rule=>buildCustomRoute('header',rule));
      const headersFor=path=>{const out={};for(const rule of rules)if(new RegExp(rule.regex).test(path))for(const {key,value} of rule.headers)out[key.toLowerCase()]=value;return out;};
      const paths=['/','/login/','/dashboard/','/dashboard/inbox/','/content/articles/','/admin-not-found/','/api/auth/session','/api/auth/callback/google','/api/admin/session/','/api/internal/agent-os/jobs/','/studio/','/blog/','/robots.txt',
        '/_next/static/chunks/app.js','/_next/static/media/font.woff2','/_next/image','/assets/logo.png','/favicon.ico','/favicon.png'];
      console.log(JSON.stringify(Object.fromEntries(paths.map(path=>[path,headersFor(path)]))));
    })().catch(error=>{console.error(error);process.exit(1)});
  `], {
    cwd: ROOT, encoding: "utf8", timeout: 20000,
    env: { PATH: BASE_ENV.PATH, NODE_ENV: "production", CCPUN_ADMIN_CAPABILITY_PROFILE: "editorial", NEXT_PUBLIC_CCPUN_ADMIN_CAPABILITY_PROFILE: "editorial" },
  });
  assert.equal(result.status, 0, "isolated Admin next.config fixture failed: " + result.stderr);
  const values: Record<string, Record<string, string>> = JSON.parse(result.stdout.trim().split("\n").at(-1)!);
  for (const path of ["/", "/login/", "/dashboard/", "/dashboard/inbox/", "/content/articles/", "/admin-not-found/", "/api/auth/session",
    "/api/auth/callback/google", "/api/admin/session/", "/api/internal/agent-os/jobs/", "/studio/", "/blog/", "/robots.txt"]) {
    assert.equal(values[path]["cache-control"], PRIVATE, path + ": Cache-Control");
    assert.equal(values[path]["cdn-cache-control"], "no-store", path + ": CDN-Cache-Control");
    assert.equal(values[path]["cloudflare-cdn-cache-control"], "no-store", path + ": Cloudflare-CDN-Cache-Control");
    assert.match(values[path]["x-robots-tag"], /noindex/, path + ": noindex retained");
  }
  for (const path of ["/_next/static/chunks/app.js", "/_next/static/media/font.woff2", "/_next/image", "/assets/logo.png", "/favicon.ico", "/favicon.png"]) {
    assert.equal(values[path]["cache-control"], undefined, path + ": no private Cache-Control");
    assert.equal(values[path]["cdn-cache-control"], undefined, path + ": no CDN no-store");
    assert.equal(values[path]["cloudflare-cdn-cache-control"], undefined, path + ": no Cloudflare no-store");
  }
});

test("/login/ renders per request so its server-action ID matches the running build", () => {
  const source = readFileSync(new URL("apps/admin/app/(control-plane-auth)/login/page.tsx", ROOT), "utf8");
  assert.match(source, /^export const dynamic = "force-dynamic";$/m);
  assert.match(source, /"use server";\s*\n\s*await signIn\("google"/, "Google sign-in remains a server action");
  const config = readFileSync(new URL("apps/admin/next.config.ts", ROOT), "utf8");
  assert.doesNotMatch(config, /cacheComponents/, "route segment `dynamic` is honoured only without Cache Components");
});

test("cache-hardening sources are admitted exactly and any other byte still fails", () => {
  const sha = (value: string) => createHash("sha256").update(value).digest("hex");
  const entries = Object.entries(adminCacheHardeningSources as Record<string, { before: string; after: string }>);
  assert.deepEqual(entries.map(([file]) => file), [
    "apps/admin/app/(control-plane-auth)/login/page.tsx", "apps/admin/next.config.ts", "apps/admin/proxy.ts",
  ]);
  for (const [file, { before, after }] of entries) {
    const source = readFileSync(new URL(file, ROOT), "utf8");
    assert.equal(sha(source), after, file + ": byte-identical to the reviewed successor");
    assert.equal(adminOps20261025PredecessorDigest(file, after), before, file + ": chains to its frozen predecessor");
    const tampered = sha(source + "\n// tamper");
    assert.equal(adminOps20261025PredecessorDigest(file, tampered), tampered, file + ": unreviewed bytes are not admitted");
  }
});
