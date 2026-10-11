import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {classifyProductionAdminPath,isInternalServiceApiPath} from "../../lib/admin/host-routing";
import {readFileSync} from "node:fs";
import test from "node:test";
const route=readFileSync(new URL("../../apps/admin/app/api/internal/n8n/p1/seo/callback/route.ts",import.meta.url),"utf8");
test("P1 SEO callback is UAT-only, credentialed, metadata-only and revision-bound",()=>{
 assert.match(route,/getAdminEnvironment\(\) !== "admin-uat"/);
 assert.match(route,/CCPUN_N8N_P1_UAT_ENABLED !== "true"/);
 assert.match(route,/verifyScopedUatCapability/);
 assert.match(route,/CCPUN_N8N_P1_UAT_TOKEN/);
 assert.doesNotMatch(route,/isN8nAgentOsRequestAuthorized/);
 assert.match(route,/workflowKey: z\.literal\("seo\.cluster\.uat"\)/);
 assert.match(route,/providerWrites: z\.literal\(false\)/);
 assert.match(route,/job\.workflowKey !== parsed\.data\.workflowKey/);
 assert.match(route,/job\.correlationId !== parsed\.data\.correlationId/);
 assert.match(route,/job\.n8nExecutionId && job\.n8nExecutionId !== parsed\.data\.n8nExecutionId/);
 assert.match(route,/expectedVersion:job\.rowVersion/);
 assert.match(route,/job\.status !== "waiting_external"/);
 assert.match(route,/stale-callback/);
 assert.doesNotMatch(route,/SANITY_API_WRITE_TOKEN|publishArticle|customerName|rawMessage|transcript|CRM_MUTATE|approveSuggestion/);
});


test("P1 ingress admits only the exact callback, with existing trailing slash normalization",()=>{
 const path="/api/internal/n8n/p1/seo/callback";
 for(const allowed of [path,path+"/",path+"//"]){
  assert.equal(isInternalServiceApiPath(allowed),true,allowed);
  assert.equal(classifyProductionAdminPath(allowed),"allow",allowed);
 }
 for(const denied of ["/api/internal/n8n","/api/internal/n8n/p1/seo",path+"-extra",path+"/child",path.replace("seo","export"),path.replace("callback","Callback"),path+"%2fchild"]){
  assert.equal(isInternalServiceApiPath(denied),false,denied);
  assert.equal(classifyProductionAdminPath(denied),"reject",denied);
 }
});

test("actual Admin proxy admits scoped callback while host, profile and handler auth stay enforced",()=>{
 // Isolated process: actual proxy and callback handler, synthetic env, no network or inherited credentials.
 const result=spawnSync(process.execPath,["--import","tsx","-e",`
  const Module=require('node:module');const load=Module._load;let dbCalls=0;
  Module._load=function(name,...args){
   if(name==='server-only')return{};
   if(name==='@/auth')return{auth(fn){return fn}};
   if(name==='@/lib/admin/operations/agent-os-runtime')return{
    async readAgentRuntimeJobById(){dbCalls++;throw Error('DB forbidden in auth test')},
    async updateAgentRuntimeJob(){dbCalls++;throw Error('DB forbidden in auth test')}
   };
   return load.call(this,name,...args);
  };
  global.fetch=()=>{throw Error('network forbidden in fixture')};
  const {NextRequest}=require('next/server');
  const {adminProxy}=require('./apps/admin/proxy.ts');
  const route=require('./apps/admin/app/api/internal/n8n/p1/seo/callback/route.ts');
  const path='/api/internal/n8n/p1/seo/callback';
  function proxy(pathname=path,host='admin-test.ccpun.com',forwarded=host){
   const req=new NextRequest('https://admin-test.ccpun.com'+pathname,{method:'POST',headers:{host,'x-forwarded-host':forwarded}});req.auth=null;
   const res=adminProxy(req);return{status:res.status,next:res.headers.get('x-middleware-next'),robots:res.headers.get('x-robots-tag')};
  }
  const request=authorization=>new Request('https://admin-test.ccpun.com'+path,{method:'POST',headers:{'content-type':'application/json',...(authorization?{authorization}:{})},body:JSON.stringify({
   environment:'admin-uat',workflowKey:'seo.cluster.uat',jobId:'d2f46082-7149-401a-a8a7-f20ee8180e25',correlationId:'bb0d3235-4949-43b8-8b24-0829b7fbeeed',
   n8nExecutionId:'123',result:'synthetic-public-safe-validated',keywordCount:1,clusterCount:1,providerWrites:false
  })});
  (async()=>{
   const allowed=[proxy(),proxy(path+'/')];const denied=[proxy(path+'-extra'),proxy(path+'/child'),proxy(path,'evil.example'),proxy(path,'admin-test.ccpun.com','evil.example')];
   const missing=await route.POST(request());const invalid=await route.POST(request('Bearer invalid'));
   process.env.CCPUN_N8N_P1_UAT_ENABLED='false';const disabled=await route.POST(request());
   process.env.CCPUN_N8N_P1_UAT_ENABLED='true';process.env.CCPUN_APP_ENV='production-admin';process.env.NEXT_PUBLIC_CCPUN_APP_ENV='production-admin';const production=await route.POST(request());
   process.env.CCPUN_APP_ENV='admin-uat';process.env.NEXT_PUBLIC_CCPUN_APP_ENV='admin-uat';
   process.env.CCPUN_ADMIN_CAPABILITY_PROFILE='editorial';process.env.NEXT_PUBLIC_CCPUN_ADMIN_CAPABILITY_PROFILE='editorial';const editorial=proxy();
   console.log(JSON.stringify({allowed,denied,missing:missing.status,invalid:invalid.status,disabled:disabled.status,production:production.status,editorial,dbCalls}));
  })().catch(()=>process.exit(1));
 `],{cwd:new URL("../../",import.meta.url),encoding:"utf8",timeout:15000,env:{
  PATH:"/usr/local/bin:/usr/bin:/bin",NODE_ENV:"production",AUTH_URL:"https://admin-test.ccpun.com",
  CCPUN_DEPLOYMENT_PROVIDER:"hostinger",CCPUN_DEPLOYMENT_ROLE:"admin",CCPUN_APP_ENV:"admin-uat",NEXT_PUBLIC_CCPUN_APP_ENV:"admin-uat",
  NEXT_PUBLIC_SANITY_PROJECT_ID:"ccb9lnw5",NEXT_PUBLIC_SANITY_DATASET:"uat",CCPUN_ADMIN_CAPABILITY_PROFILE:"full",NEXT_PUBLIC_CCPUN_ADMIN_CAPABILITY_PROFILE:"full",
  CCPUN_GIT_SHA:"a".repeat(40),CCPUN_GIT_REF:"feat/p1-fixture",CCPUN_RELEASE_ID:"p1-fixture",CCPUN_N8N_P1_UAT_ENABLED:"true",CCPUN_N8N_P1_UAT_TOKEN:"fixture-only-".repeat(8),
 }});
 assert.equal(result.status,0,"isolated P1 proxy fixture failed");
 const values=JSON.parse(result.stdout);
 for(const allowed of values.allowed){assert.equal(allowed.status,200);assert.equal(allowed.next,"1")}
 for(const denied of [...values.denied,values.editorial]){assert.equal(denied.status,404);assert.match(denied.robots,/noindex/)}
 assert.equal(values.missing,401);assert.equal(values.invalid,401);assert.equal(values.disabled,404);assert.equal(values.production,404);
 assert.equal(values.dbCalls,0,"authentication failures reached the database");
});
