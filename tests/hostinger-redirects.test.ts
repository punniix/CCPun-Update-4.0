import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

function inspect(provider: "hostinger" | "vercel", review: boolean) {
  const script = `
    const {default:proxy, hostingerRedirectUrl, config:proxyConfig}=require('./apps/web/proxy.ts');
    const {default:config}=require('./apps/web/next.config.ts');
    (async()=>{
      const paths=['/ci-planning?from=a%26b','/living-benefits/old/?q=x%2Fy','/tools/fhc/','/financial-advisor/','/financial-advisor-extra/','/unknown-route','/unknown-route/','/api/line/webhook','/api/line/webhook/','/login/','/dashboard/','/robots.txt','/sitemap.xml','/llms.txt','/.well-known/security.txt','/.well-known/extensionless','/_next/image/?url=%2Ffavicon.png&w=32&q=75','/_next/static/font.woff2','/favicon.png/?q=1'];
      const observations=paths.map(path=>{
        const req=new Request('https://candidate.example'+path);
        const response=proxy(req);
        return {path,status:response.status,location:response.headers.get('location'),headers:Object.fromEntries(response.headers)};
      });
      const dataRequest=new Request('https://candidate.example/file.json/',{headers:{'x-nextjs-data':'1'}});
      const post=proxy(new Request('https://candidate.example/tools/fhc/?q=1',{method:'POST'}));
      console.log(JSON.stringify({observations,post:{status:post.status,location:post.headers.get('location')},dataRedirect:hostingerRedirectUrl(dataRequest),matcher:proxyConfig.matcher,skipTrailing:config.skipTrailingSlashRedirect,redirects:await config.redirects(),headers:await config.headers()}));
    })();
  `;
  const result = spawnSync(process.execPath, ["--import", "tsx", "-e", script], {
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      NODE_ENV: "production",
      CCPUN_DEPLOYMENT_PROVIDER: provider,
      CCPUN_DEPLOYMENT_ROLE: "web",
      CCPUN_APP_ENV: "production",
      NEXT_PUBLIC_SANITY_PROJECT_ID: "kyfxgjnq",
      NEXT_PUBLIC_SANITY_DATASET: "production",
      CCPUN_UAT_MODE: review ? "1" : "0",
      ...(provider === "vercel" ? { VERCEL_ENV: "production", VERCEL_PROJECT_ID: "prj_dxwjITkd0av5QiJQv2snUlIASUWu" } : {}),
    },
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test("Hostinger redirects preserve URL and query semantics with complete candidate headers", () => {
  const runtime = inspect("hostinger", true);
  assert.deepEqual(runtime.matcher, ["/:path*"]);
  assert.equal(runtime.skipTrailing, true);
  assert.deepEqual(runtime.redirects, []);
  const expected: Record<string, string> = {
    "/ci-planning?from=a%26b": "/ci-planning/?from=a%26b",
    "/living-benefits/old/?q=x%2Fy": "/ci-planning/?q=x%2Fy",
    "/tools/fhc/": "/tools/financial-health-check/",
    "/financial-advisor/": "/",
    "/unknown-route": "/unknown-route/",
    "/api/line/webhook": "/api/line/webhook/",
    "/favicon.png/?q=1": "/favicon.png?q=1",
  };
  const policy = runtime.headers.find((rule: { source: string }) => rule.source === "/:path*").headers;
  for (const observation of runtime.observations) {
    const destination = expected[observation.path];
    assert.equal(observation.status, destination ? 308 : 200, observation.path);
    assert.equal(observation.location, destination ? `https://candidate.example${destination}` : null, observation.path);
    if (destination) {
      for (const { key, value } of policy) assert.equal(observation.headers[key.toLowerCase()], value, `${observation.path}: ${key}`);
    }
  }
  assert.equal(runtime.dataRedirect, null);
  assert.deepEqual(runtime.post, { status: 308, location: "https://candidate.example/tools/financial-health-check/?q=1" });
});

test("Hostinger live redirects retain security without accidentally blocking indexing", () => {
  const runtime = inspect("hostinger", false);
  const redirect = runtime.observations.find((value: { path: string }) => value.path === "/tools/fhc/");
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers["x-robots-tag"], undefined);
  assert.match(redirect.headers["content-security-policy"], /default-src 'self'/);
});

test("Vercel proxy stays observational and its configured redirect contract is unchanged", () => {
  const runtime = inspect("vercel", false);
  assert.equal(runtime.skipTrailing, undefined);
  for (const observation of runtime.observations) {
    assert.equal(observation.status, 200);
    assert.equal(observation.location, null);
  }
  assert.deepEqual(runtime.redirects, [
    { source: "/living-benefits/:path*", destination: "/ci-planning/", permanent: true },
    { source: "/tools/fhc/:path*", destination: "/tools/financial-health-check/", permanent: true },
    { source: "/financial-advisor/:path*", destination: "/", permanent: true },
  ]);
});
