import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";

for (const lane of ["admin-uat", "production-admin"] as const) test(`${lane}: actual Production Connect or unchanged native-UAT denial retains Owner privacy and independent gates`, () => {
  const script = String.raw`
    const assert = require('node:assert/strict');
    const production = ${JSON.stringify(lane === 'production-admin')};
    const ownProperty=production?'219719845':'551040812', otherProperty=production?'551040812':'219719845';
    const host=production?'admin.ccpun.com':'admin-test.ccpun.com', origin='https://'+host, appEnv=production?'production-admin':'admin-uat';
    const Module = require('node:module'), original = Module._load;
    const {encode,getToken} = require('next-auth/jwt');
    let config, identity={actorType:'human',actor:'owner@example.test',role:'owner',authSource:'authjs'};
    let cookieWrites=[], cookieValues=new Map(), currentHeaders=new Headers(), signIns=[], tokenCalls=0, reportCalls=0, envReaderCalls=0;
    const jar={get:name=>cookieValues.has(name)?{value:cookieValues.get(name)}:undefined,
      set(name,value,options){cookieWrites.push({name,value,options}); if(options.maxAge===0)cookieValues.delete(name);else cookieValues.set(name,value)}};
    Module._load=function(name,...args){
      if(name==='server-only')return {};
      if(name==='next-auth')return {__esModule:true,default:c=>{config=c;return {handlers:{},auth:async()=>identity?{user:{email:identity.actor,role:identity.role}}:null,signOut:async()=>{},signIn:async(...a)=>{signIns.push(a);return Response.redirect('https://accounts.example.test/authorize')}}}};
      if(name==='next/headers')return {cookies:async()=>jar,headers:async()=>currentHeaders};
      if(name==='@/lib/admin/identity')return {getAdminIdentity:async()=>identity};
      if(name==='@/lib/admin/seo-intelligence/providers/ga4')return {
        fetchGa4LandingPages:async input=>{reportCalls++;assert.equal(input.propertyId,ownProperty);assert.equal(input.token,'synthetic-access');return {fetchedAt:'2026-10-17T00:00:00Z',rows:[],truncated:false,timeZone:'Asia/Bangkok',limitations:[]}},
        fetchGa4OrganicTotals:async input=>{reportCalls++;assert.equal(input.propertyId,ownProperty);return {fetchedAt:'2026-10-17T00:00:00Z',totals:{sessions:0,engagedSessions:0,engagementRate:0},timeZone:'Asia/Bangkok',limitations:[]}}};
      return original.call(this,name,...args);
    };
    const sha='6bfe13a538ee0daeaa3b5c9edaadb3d08fe70327';
    process.env={NODE_ENV:'test',AUTH_SECRET:'synthetic-auth-secret-at-least-thirty-two-characters',AUTH_GOOGLE_ID:'synthetic-client',AUTH_GOOGLE_SECRET:'synthetic-client-secret',AUTH_URL:origin,CCPUN_ADMIN_OWNER_EMAILS:identity.actor,CCPUN_DEPLOYMENT_PROVIDER:'hostinger',CCPUN_DEPLOYMENT_ROLE:'admin',CCPUN_APP_ENV:appEnv,NEXT_PUBLIC_CCPUN_APP_ENV:appEnv,NEXT_PUBLIC_SANITY_PROJECT_ID:production?'kyfxgjnq':'ccb9lnw5',NEXT_PUBLIC_SANITY_DATASET:production?'production':'uat',CCPUN_SEO_INTELLIGENCE_ENABLED:'1',CCPUN_GA4_PROPERTY_ID:ownProperty,CCPUN_GIT_SHA:sha,CCPUN_GIT_REF:'codex/hostinger-release-'+(production?'production':'uat')+'-'+sha,
      CCPUN_ADMIN_CAPABILITY_PROFILE:'full',CCPUN_NEON_PROJECT_ID:production?'lively-bar-43618798':'young-term-47483330',CCPUN_NEON_BRANCH_ID:production?'br-long-resonance-b3ys5xrv':'br-crimson-mouse-az7ajkv8',CCPUN_NEON_DATABASE:'neondb',CCPUN_RELEASE_ID:'synthetic-connect-lanes',CCPUN_ARTICLE_SCHEDULER_BACKEND:'disabled',NEXT_PUBLIC_CCPUN_ARTICLE_SCHEDULER_BACKEND:'disabled',CCPUN_ARTICLE_SCHEDULING_ENABLED:'0',CCPUN_ARTICLE_SCHEDULE_EXECUTOR_ENABLED:'0',CCPUN_NATIVE_WORKFLOW_ENABLED:'0',
      NEXT_PUBLIC_CCPUN_DEPLOYMENT_PROVIDER:'hostinger',NEXT_PUBLIC_CCPUN_DEPLOYMENT_ROLE:'admin',NEXT_PUBLIC_CCPUN_ADMIN_CAPABILITY_PROFILE:'full',NEXT_PUBLIC_CCPUN_GIT_SHA:sha,NEXT_PUBLIC_CCPUN_GIT_REF:'codex/hostinger-release-'+(production?'production':'uat')+'-'+sha,NEXT_PUBLIC_CCPUN_RELEASE_ID:'synthetic-connect-lanes'};
    global.fetch=async(url,init)=>{tokenCalls++;assert.equal(String(url),'https://oauth2.googleapis.com/token');assert.match(String(init.body),/grant_type=refresh_token/);if(new URLSearchParams(init.body).get('client_id')==='synthetic-env-client')envReaderCalls++;return Response.json({access_token:'synthetic-access',refresh_token:'synthetic-rotated'})};
    const auth=require('./auth.ts');
    const helper=require('./lib/admin/seo-intelligence/google-session-connection.ts');
    const connect=require('./apps/admin/app/api/admin/seo/providers/connect/route.ts').POST;
    const readiness=require('./apps/admin/app/api/admin/seo/providers/readiness/route.ts').GET;
    const manual=require('./apps/admin/app/api/admin/seo/opportunities/sync/ga4/route.ts').POST;
    const gsc=require('./apps/admin/app/api/admin/seo/opportunities/sync/gsc/route.ts').POST;
    const profile={sub:'google-stable-provider-id',email:identity.actor,email_verified:true,aud:process.env.AUTH_GOOGLE_ID};
    const account={provider:'google',providerAccountId:profile.sub,scope:'openid email profile',refresh_token:'must-not-capture-normal-login'};
    const currentLane=helper.getGoogleSessionLane(process.env);assert.ok(currentLane);
    const authName=currentLane.authCookie;
    async function storeAuth(token){cookieValues.set(authName,await encode({token,secret:process.env.AUTH_SECRET,salt:authName,maxAge:28800}))}
    function request(method,path,patch={}){
      const headers={host,'x-forwarded-host':host,'x-forwarded-proto':'https',origin,cookie:[...cookieValues].map(([k,v])=>k+'='+v).join('; '),...patch};
      const req=new Request('http://127.0.0.1:3000'+path,{method,headers,...(method==='POST'?{body:JSON.stringify({startDate:'2026-10-01',endDate:'2026-10-07'})}:{})});currentHeaders=req.headers;return req;
    }
    (async()=>{
      if(!production){
        assert.equal(helper.getGoogleSessionContext(process.env,identity),null);
        const ordinary=await config.callbacks.jwt({token:{sub:'ordinary-uat-auth-uuid',email:identity.actor},user:{email:identity.actor},account,profile});
        assert.equal(ordinary.googleConnectionAccount,undefined);assert.equal(ordinary.googleConnectionBinding,undefined);await storeAuth(ordinary);
        const denied=await connect(request('POST','/api/admin/seo/providers/connect/'));assert.equal(denied.status,303);assert.ok(denied.headers.get('location').endsWith('googleConnect=configuration-required'));
        assert.equal((await manual(request('POST','/api/admin/seo/opportunities/sync/ga4/'))).status,404);
        assert.equal(tokenCalls,0);assert.equal(reportCalls,0);
        console.log(JSON.stringify({status:'pass',sourceProfile:'immutable-Production-policy',nativeUatExplicitlyDenied:true,googleNetworkCalls:0}));return;
      }
      assert.equal(config.providers.length,1);assert.equal(config.providers[0].options?.authorization,undefined);
      assert.equal(config.session.strategy,'jwt');assert.equal(config.session.maxAge,28800);
      assert.equal(await config.callbacks.signIn({user:{email:identity.actor},account,profile}),true);
      const normal=await config.callbacks.jwt({token:{sub:'old-auth-random-uuid',email:identity.actor},user:{email:identity.actor},account,profile});
      assert.equal(normal.googleConnectionAccount,profile.sub);assert.equal(normal.googleConnectionBinding,undefined);
      assert.equal(cookieWrites.length,0);await storeAuth(normal);
      const forged=await config.callbacks.jwt({token:{...normal},trigger:'update',session:{googleConnectionBinding:'forged',refresh_token:'forged',googleConnectionAccount:'forged'}});
      assert.equal(forged.googleConnectionBinding,undefined);assert.equal(forged.googleConnectionAccount,profile.sub);
      for(const [patch,change] of [[{origin:'https://other.example.test'},null],[{},'viewer']]){
        identity.role=change||'owner';const denied=await connect(request('POST','/api/admin/seo/providers/connect/',patch));assert.equal(denied.status,303);assert.ok(denied.headers.get('location').startsWith(origin+'/seo/opportunities/?googleConnect='));assert.equal(signIns.length,0)
      }
      identity.role='owner';
      const started=await connect(request('POST','/api/admin/seo/providers/connect/'));
      assert.equal(started.status,302);assert.equal(signIns.length,1);assert.deepEqual(signIns[0][2],helper.GOOGLE_CONNECT_AUTHORIZATION);
      const intent=cookieValues.get(currentLane.intentCookie);assert.ok(intent);
      const requestBeforeCallback=request('GET','/api/auth/callback/google');
      assert.equal(currentHeaders,requestBeforeCallback.headers);
      const withGrant=await config.callbacks.jwt({token:{sub:'new-auth-random-uuid',email:identity.actor},user:{email:identity.actor},account:{...account,scope:helper.GOOGLE_CONNECT_AUTHORIZATION.scope,refresh_token:'synthetic-refresh'},profile});
      assert.ok(withGrant.googleConnectionBinding);assert.equal(withGrant.sub,'new-auth-random-uuid');assert.notEqual(withGrant.sub,profile.sub);
      assert.equal(cookieValues.has(currentLane.intentCookie),false);assert.ok(cookieValues.get(currentLane.grantCookie));
      await storeAuth(withGrant);
      const publicSession=await config.callbacks.session({session:{user:{email:identity.actor}},token:withGrant});
      assert.equal(publicSession.user.role,'owner');
      for(const secret of ['synthetic-refresh','synthetic-client-secret',withGrant.googleConnectionBinding,profile.sub])assert.equal(JSON.stringify(publicSession).includes(secret),false);
      const ready=await readiness(request('GET','/api/admin/seo/providers/readiness/?provider=ga4'));
      assert.equal(ready.status,200);const readyBody=await ready.json();assert.equal(readyBody.mode,'owner-session-oauth');assert.equal(readyBody.status,'manual-sync-ready');
      const gscReady=await readiness(request('GET','/api/admin/seo/providers/readiness/?provider=gsc'));assert.equal((await gscReady.json()).status,'configuration-required');
      const page=require('./features/admin/seo/opportunities/page.tsx').default;
      const React=require('react'), {renderToStaticMarkup}=require('react-dom/server');
      const html=renderToStaticMarkup(await page());assert.ok(html.includes('เชื่อมต่อ GA4 ของ'+(production?'ระบบจริง':'พื้นที่ทดสอบ')+'แล้ว'));assert.ok(html.includes('เชื่อม Google Analytics สำหรับ '+(production?'ระบบจริง':'พื้นที่ทดสอบ')));assert.match(html,/8 ชั่วโมง/);
      const legacyHtml=renderToStaticMarkup(React.createElement(require('./features/admin/seo/opportunities/Ga4ManualSync.tsx').default,{defaultStartDate:'2026-10-01',defaultEndDate:'2026-10-07',laneLabel:'ระบบจริง'}));assert.equal(legacyHtml.includes('providers/connect'),false);
      assert.equal(tokenCalls,0);assert.equal(reportCalls,0);
      assert.equal((await manual(request('POST','/api/admin/seo/opportunities/sync/ga4/',{origin:'https://other.example.test'}))).status,403);
      process.env.CCPUN_GA4_PROPERTY_ID=otherProperty;assert.equal((await manual(request('POST','/api/admin/seo/opportunities/sync/ga4/'))).status,409);
      process.env.CCPUN_GA4_PROPERTY_ID=ownProperty;process.env.CCPUN_SEO_INTELLIGENCE_ENABLED='0';assert.equal((await manual(request('POST','/api/admin/seo/opportunities/sync/ga4/'))).status,404);
      process.env.CCPUN_SEO_INTELLIGENCE_ENABLED='1';assert.equal((await gsc(request('POST','/api/admin/seo/opportunities/sync/gsc/'))).status,403);
      assert.equal(tokenCalls,0);assert.equal(reportCalls,0);
      const result=await manual(request('POST','/api/admin/seo/opportunities/sync/ga4/'));assert.equal(result.status,200);assert.equal((await result.json()).state,'ready');assert.equal(tokenCalls,1);assert.equal(reportCalls,4);
      const privateGrant=await getToken({req:{headers:{cookie:currentLane.grantCookie+'='+cookieValues.get(currentLane.grantCookie)}},secret:process.env.AUTH_SECRET,cookieName:currentLane.grantCookie,salt:currentLane.grantCookie});assert.equal(privateGrant.refreshToken,'synthetic-rotated');
      assert.ok(privateGrant.absoluteExpiresAt-privateGrant.issuedAt===28800000);
      const writesBefore=cookieWrites.length;
      await config.callbacks.jwt({token:{...withGrant},trigger:'update',session:{googleConnectionBinding:'forged',refresh_token:'forged'}});assert.equal(cookieWrites.length,writesBefore);
      const newNormal=await config.callbacks.jwt({token:{sub:'ordinary-relogin-third-uuid',email:identity.actor},user:{email:identity.actor},account,profile});await storeAuth(newNormal);
      assert.equal((await (await readiness(request('GET','/api/admin/seo/providers/readiness/?provider=ga4'))).json()).refreshableConnectionReady,false);
      if(production){
        process.env.CCPUN_GOOGLE_DATA_CLIENT_ID='synthetic-env-client';process.env.CCPUN_GOOGLE_DATA_CLIENT_SECRET='synthetic-env-secret';process.env.CCPUN_GOOGLE_DATA_REFRESH_TOKEN='synthetic-env-refresh';
        const before=tokenCalls;
        // Present invalid grants never fall through to the configured legacy reader.
        for(const suffix of ['=','=invalid','.0=chunk','=one; '+currentLane.grantCookie+'=two']){
          cookieValues.delete(currentLane.grantCookie);
          assert.equal((await manual(request('POST','/api/admin/seo/opportunities/sync/ga4/',{cookie:authName+'='+cookieValues.get(authName)+'; '+currentLane.grantCookie+suffix}))).status,409);
          assert.equal(tokenCalls,before);
        }
        cookieValues.delete(currentLane.grantCookie);
        await storeAuth({sub:'legacy-ordinary-auth-uuid',email:identity.actor,adminRole:'owner'});
        process.env.CCPUN_GA4_PROPERTY_ID=otherProperty;
        assert.equal((await manual(request('POST','/api/admin/seo/opportunities/sync/ga4/'))).status,409);assert.equal(tokenCalls,before);
        process.env.CCPUN_GA4_PROPERTY_ID=ownProperty;
        const ref=process.env.CCPUN_GIT_REF;process.env.CCPUN_GIT_REF='codex/wrong-source';
        assert.equal((await manual(request('POST','/api/admin/seo/opportunities/sync/ga4/'))).status,404);assert.equal(tokenCalls,before);process.env.CCPUN_GIT_REF=ref;
        assert.equal((await manual(request('POST','/api/admin/seo/opportunities/sync/ga4/'))).status,200);assert.equal(envReaderCalls,1);assert.equal(tokenCalls,before+1);
      }
      process.env.CCPUN_APP_ENV='production-admin';process.env.CCPUN_SEO_INTELLIGENCE_ENABLED='0';
      const ordinaryProduction=await config.callbacks.jwt({token:{sub:'production-sub',email:identity.actor},user:{email:identity.actor},account,profile});assert.deepEqual(ordinaryProduction,{sub:'production-sub',email:identity.actor,adminRole:'owner'});
      assert.equal(tokenCalls,production?2:1);assert.equal(reportCalls,production?8:4);
      console.log(JSON.stringify({status:'pass',actualSourcePaths:true,tokenRefreshCalls:tokenCalls,mockedReportCalls:reportCalls,googleNetworkCalls:0,sourceSubModel:'old-authUUID/new-authUUID/providerSub distinct',normalSessionSecrets:false}));
    })().catch(error=>{console.error(error);process.exitCode=1});
  `;
  const result = spawnSync(process.execPath, [...process.execArgv, "-e", script], {
    cwd: new URL("../../", import.meta.url), env: { NODE_ENV: "test", PATH: process.env.PATH }, encoding: "utf8", timeout: 20_000,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(JSON.parse(result.stdout).status, "pass");
});
