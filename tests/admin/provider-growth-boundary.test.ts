import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const ubersuggest = readFileSync(new URL("../../lib/admin/ubersuggest.ts", import.meta.url), "utf8");
const ubersuggestContracts = readFileSync(new URL("../../lib/admin/ubersuggest-contracts.ts", import.meta.url), "utf8");
const researchRoute = readFileSync(new URL("../../app/api/admin/research/ubersuggest/route.ts", import.meta.url), "utf8");
const growth = readFileSync(new URL("../../lib/admin/growth.ts", import.meta.url), "utf8");
const growthPage = readFileSync(new URL("../../app/(control-plane)/analytics/search/page.tsx", import.meta.url), "utf8");
const growthLoading = readFileSync(new URL("../../app/(control-plane)/analytics/search/loading.tsx", import.meta.url), "utf8");
const research = readFileSync(new URL("../../lib/admin/research.ts", import.meta.url), "utf8");
const geoPage = readFileSync(new URL("../../app/(control-plane)/seo/audits/[id]/page.tsx", import.meta.url), "utf8");
const researchPage = readFileSync(new URL("../../features/admin/research/page.tsx", import.meta.url), "utf8");
const researchForm = readFileSync(new URL("../../features/admin/components/UbersuggestResearchForm.tsx", import.meta.url), "utf8");

test("Ubersuggest credentials stay local and OAuth uses state plus PKCE", () => {
  assert.match(ubersuggest, /\.ccpun-local/);
  assert.match(ubersuggest, /mode: 0o600/);
  assert.match(ubersuggest, /isUbersuggestAuthorizationStateValid\(pending, params\.get\("state"\)\)/);
  assert.match(ubersuggestContracts, /receivedState !== pending\.state/);
  assert.match(ubersuggestContracts, /age >= 0 && age <= UBERSUGGEST_AUTH_MAX_AGE_MS/);
  assert.match(ubersuggest, /saveCodeVerifier/);
  assert.match(ubersuggest, /isSafeExternalAuthorizationUrl/);
  assert.match(ubersuggest, /fetch: providerFetch/);
  assert.match(ubersuggest, /redirect: "manual"/);
  assert.match(ubersuggest, /isPublicInternetAddress/);
  assert.match(ubersuggest, /getLocalAdminOrigin\(environment\)/);
  assert.match(ubersuggest, /process\.env\.AUTH_URL\?\.trim\(\) !== origin/);
  assert.doesNotMatch(ubersuggest, /const CALLBACK_URL = "http:\/\/localhost:3000/);
  assert.doesNotMatch(ubersuggest, /console\.(?:log|error)|SANITY.*TOKEN/);
});

test("provider calls stay bounded and expose only stable friendly errors", () => {
  assert.match(ubersuggest, /const PROVIDER_TOOL_TIMEOUT_MS = 45_000/);
  assert.match(ubersuggest, /const PROVIDER_BATCH_MAX = 8/);
  assert.match(ubersuggest, /calls\.length > PROVIDER_BATCH_MAX/);
  assert.match(ubersuggest, /Math\.min\(call\.timeoutMs \?\? PROVIDER_TOOL_TIMEOUT_MS, PROVIDER_TOOL_TIMEOUT_MS\)/);
  assert.match(ubersuggest, /maxTotalTimeout: timeout/);
  assert.equal((ubersuggest.match(/name: "keyword_overview"/g) ?? []).length, 1);
  assert.equal((ubersuggest.match(/name: "serp_analysis"/g) ?? []).length, 1);
  for (const internalCode of ["UBERSUGGEST_AUTH_REQUIRED", "UBERSUGGEST_TIMEOUT", "UBERSUGGEST_INVALID_RESPONSE", "UBERSUGGEST_TOOL_FAILED"]) {
    assert.match(ubersuggest, new RegExp(internalCode));
  }
  for (const publicCode of ["provider-auth-required", "provider-timeout", "provider-invalid-response", "provider-tool-failed"]) {
    assert.match(researchRoute, new RegExp(publicCode));
    assert.match(researchForm, new RegExp(publicCode));
  }
  assert.doesNotMatch(researchRoute, /error:\s*code/);
  assert.match(researchPage, /ดึงข้อมูลเมื่อ/);
  assert.doesNotMatch(researchPage, />ตรวจเมื่อ</);
});

test("provider retries reuse fresh Neon snapshots without credential fallback", () => {
  assert.match(researchRoute, /findFreshResearchSnapshot\("ubersuggest"/);
  assert.match(researchRoute, /const inFlight = new Map/);
  assert.match(researchRoute, /research:provider-query/);
  assert.match(researchRoute, /PROVIDER_RATE_LIMIT/);
  assert.match(researchRoute, /Retry-After/);
  assert.match(research, /findAdminResearchSnapshot/);
  assert.match(research, /update\(`\$\{parsed\.provider\}\|\$\{keywordKey\}\|\$\{checkedAt\.slice\(0, 10\)\}`\)/);
  const operations = readFileSync(new URL("../../lib/admin/operations/database.ts", import.meta.url), "utf8");
  assert.match(operations, /process\.env\.CCPUN_ADMIN_DATABASE_URL/);
  assert.doesNotMatch(operations, /SANITY_[A-Z0-9_]*TOKEN/);
});

test("growth sources fail independently and GEO is explicitly non-ranking", () => {
  assert.match(growth, /Promise\.all\(\[readGscSummary\(\), readGa4Summary\(\), readRuntimeHealth\(\)\]\)/);
  assert.match(growth, /getGoogleDataAccessToken/);
  assert.doesNotMatch(growth, /CCPUN_(?:GSC|GA4)_ACCESS_TOKEN/);
  assert.match(growth, /state: "not-connected"/);
  assert.match(growth, /state: "unavailable"/);
  assert.match(growth, /GA4_TOTALS_MISSING/);
  assert.match(geoPage, /ไม่ใช่คะแนนหรือการรับประกันว่า AI จะอ้างอิง/);
});

test("Admin growth removes Vercel monitoring in every lane and keeps native runtime metadata partial", () => {
  const result = spawnSync(process.execPath, ["--import", "tsx", "-e", `
    const Module=require('node:module');const load=Module._load;
    Module._load=function(name,...args){
      if(name==='server-only')return{};
      if(name.endsWith('/provider-readiness'))return{getSeoGoogleProviderReadiness:()=>({status:'not-configured'})};
      if(name.endsWith('/google-data-auth'))return{getGoogleDataAccessToken(){throw Error('unexpected Google fixture call')}};
      return load.call(this,name,...args);
    };
    const {readRuntimeHealth,readGrowthSources}=require('./lib/admin/growth.ts');
    const base={PATH:'/usr/local/bin:/usr/bin:/bin',NODE_ENV:'production',CCPUN_DEPLOYMENT_PROVIDER:'hostinger',CCPUN_DEPLOYMENT_ROLE:'admin',CCPUN_APP_ENV:'admin-uat',NEXT_PUBLIC_CCPUN_APP_ENV:'admin-uat',NEXT_PUBLIC_SANITY_PROJECT_ID:'ccb9lnw5',NEXT_PUBLIC_SANITY_DATASET:'uat',CCPUN_GIT_SHA:'a'.repeat(40),CCPUN_GIT_REF:'codex/native-health-fixture',CCPUN_RELEASE_ID:'health-fixture'};
    let legacyReads=0;const fetches=[];
    global.fetch=async(url)=>{fetches.push(String(url));throw Error('unexpected fixture fetch')};
    function environment(patch={}){
      process.env=new Proxy({...base,...patch},{get(target,key){
        if(key==='CCPUN_VERCEL_READ_TOKEN'){legacyReads++;return 'fixture-token-only'};
        if(key==='CCPUN_VERCEL_PUBLIC_PROJECT_ID'){legacyReads++;return 'fixture-project-only'};
        if(key==='CCPUN_VERCEL_TEAM_ID'){legacyReads++;return undefined};
        return Reflect.get(target,key);
      }});
    }
    (async()=>{
      environment();const sources=await readGrowthSources();
      const invalid=[];
      for(const patch of [
        {CCPUN_DEPLOYMENT_ROLE:'web'},
        {VERCEL_PROJECT_ID:'wrong-project'},
        {CCPUN_APP_ENV:'unknown',NEXT_PUBLIC_CCPUN_APP_ENV:'unknown'},
        {CCPUN_GIT_SHA:undefined},
        {CCPUN_GIT_SHA:'invalid'},
        {CCPUN_GIT_REF:undefined},
        {NEXT_PUBLIC_SANITY_DATASET:'production'},
        {CCPUN_APP_ENV:'production-admin',NEXT_PUBLIC_CCPUN_APP_ENV:'production-admin',NEXT_PUBLIC_SANITY_PROJECT_ID:'kyfxgjnq',NEXT_PUBLIC_SANITY_DATASET:'production',CCPUN_GIT_REF:'codex/wrong-production'},
      ]){environment(patch);invalid.push(await readRuntimeHealth())}
      environment({CCPUN_APP_ENV:'production-admin',NEXT_PUBLIC_CCPUN_APP_ENV:'production-admin',NEXT_PUBLIC_SANITY_PROJECT_ID:'kyfxgjnq',NEXT_PUBLIC_SANITY_DATASET:'production',CCPUN_GIT_REF:'v4-production'});
      const productionMetadata=await readRuntimeHealth();
      const otherLanes=[];
      for(const patch of [{CCPUN_DEPLOYMENT_PROVIDER:'vercel'},{CCPUN_DEPLOYMENT_PROVIDER:'local'},{CCPUN_DEPLOYMENT_PROVIDER:'unknown'},{CCPUN_DEPLOYMENT_PROVIDER:'vercel',VERCEL_PROJECT_ID:'prj_mssG74SlAZdCxnpSahJoJOxu7Avp'}]){environment(patch);otherLanes.push(await readRuntimeHealth())}
      console.log(JSON.stringify({sources,invalid,productionMetadata,otherLanes,legacyReads,fetchCount:fetches.length}));
    })().catch(()=>process.exit(1));
  `], {
    cwd: new URL("../../", import.meta.url), encoding: "utf8", timeout: 15000,
    env: { PATH: "/usr/local/bin:/usr/bin:/bin", NODE_ENV: "production" },
  });
  assert.equal(result.status, 0, "isolated native growth fixture failed");
  const values = JSON.parse(result.stdout);
  assert.deepEqual(values.sources.map((item: { source: string }) => item.source), ["gsc", "ga4", "runtime"]);
  for (const metadata of [values.sources[2], values.productionMetadata]) {
    assert.equal(metadata.state, "partial");
    assert.equal(metadata.source, "runtime");
    assert.equal(metadata.metrics.length, 4);
    assert.equal(metadata.metrics[0].value, "hostinger");
    assert.match(metadata.limitation, /เว็บสาธารณะ HTTPS หรือ Core Web Vitals/);
    assert.doesNotMatch(JSON.stringify(metadata.metrics), /READY|deployments/);
  }
  for (const invalid of [...values.invalid, ...values.otherLanes]) {
    assert.equal(invalid.source, "runtime");
    assert.equal(invalid.state, "unavailable");
    assert.deepEqual(invalid.metrics, []);
  }
  assert.equal(values.legacyReads, 0);
  assert.equal(values.fetchCount, 0);
  assert.doesNotMatch(growth, /readVercelHealth|CCPUN_VERCEL_READ_TOKEN|CCPUN_VERCEL_PUBLIC_PROJECT_ID|CCPUN_VERCEL_TEAM_ID|api\.vercel\.com/);
  assert.doesNotMatch(growthPage, /Vercel Health/);
  const health = readFileSync(new URL("../../apps/admin/app/(control-plane)/operations/health/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(health, /probeLineBridgeFromAdmin|line-bridge-probe|Vercel Health|process\.env\.VERCEL_/);
  assert.match(health, /readLineSystemDeliveryDatabaseReadiness/);
  assert.match(health, /readLineDeliveryHealth/);
});

test("SEO detail tolerates an unavailable proposal database and opens the exact Studio document", () => {
  const operations = readFileSync(new URL("../../lib/admin/operations/database.ts", import.meta.url), "utf8");
  const proposalRead = operations.slice(
    operations.indexOf("export async function findAdminProposalResearch"),
    operations.indexOf("export async function createAdminResearchSnapshot"),
  );
  assert.match(proposalRead, /if \(!sql\) return null/);
  assert.doesNotMatch(proposalRead, /ADMIN_DATABASE_NOT_CONFIGURED/);
  assert.match(geoPage, /getStudioArticleEditHref\(id\)/);
  assert.doesNotMatch(geoPage, /\/studio\/structure\/article;/);
});

test("growth UI exposes freshness, comparison, loading, empty, and error states without fake metrics", () => {
  assert.match(growthPage, /ช่วงข้อมูล:/);
  assert.match(growthPage, /อัปเดตล่าสุด:/);
  assert.match(growthPage, /เปรียบเทียบ: \{source\.comparison/);
  assert.match(growth, /query\(previousStartDate, previousEndDate\)\.catch/);
  assert.match(growth, /report\(previousStartDate, previousEndDate\)\.catch/);
  assert.match(growth, /ดึงช่วงก่อนหน้าไม่สำเร็จ/);
  assert.match(growth, /source: "runtime", state: "partial"/);
  assert.match(growth, /อ่านเวอร์ชันของศูนย์จัดการที่กำลังรัน ยังไม่ใช่ผลตรวจ deployment ของเว็บสาธารณะ HTTPS หรือ Core Web Vitals/);
  assert.match(growthPage, /ข้อมูลบางส่วน/);
  assert.match(growthPage, /ยังไม่เชื่อมต่อ/);
  assert.match(growthPage, /ดึงข้อมูลไม่สำเร็จ/);
  assert.match(growthLoading, /role="status"/);
  assert.match(growthLoading, /aria-live="polite"/);
  assert.doesNotMatch(growthPage, /mock|fake/i);
});
