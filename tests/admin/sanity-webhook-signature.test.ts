import assert from "node:assert/strict";
import test from "node:test";
import { encodeSignatureHeader } from "@sanity/webhook";
import { loadFixtureModule } from "../../qa/phase1-fixture-loader.mjs";
const {handleSanityArticlePublished:handle}=loadFixtureModule("lib/admin/seo-intelligence/post-publish-webhook.ts");
const secret="OBVIOUS-TEST-FIXTURE-NOT-A-REAL-SECRET";
const now=1793000000000;
const article={id:"fixture-article",rev:"fixture-revision",slug:"example",category:"Personal Finance",categorySlug:"personal-finance",updatedAt:"2026-10-26T00:00:00.000Z",reviewStatus:"approved",noindex:false};
const payload={articleId:article.id,rev:article.rev,contentUpdatedAt:article.updatedAt,op:"update"};
let sequence=0;
async function run(opts:{body?:unknown;raw?:string;headers?:Record<string,string>;timestamp?:number;signSecret?:string;environment?:string;doc?:unknown;error?:string;url?:string;runtimeEnv?:object;missingSecret?:boolean}={}){
 const raw=opts.raw??JSON.stringify(opts.body??payload);const signature=await encodeSignatureHeader(raw,opts.timestamp??now,opts.signSecret??secret);let reads=0,writes=0;
 const request=new Request(opts.url??"https://admin.ccpun.com/api/integrations/sanity/article-published/",{method:"POST",headers:{host:"admin.ccpun.com","sanity-project-id":"kyfxgjnq","sanity-dataset":"production","sanity-webhook-signature":signature,"idempotency-key":"TEST-DELIVERY","x-real-ip":`fixture-${sequence++}`,...opts.headers},body:raw});
 const response=await handle(request,{environment:opts.environment??"production-admin",secret:opts.missingSecret?undefined:secret,now:()=>now,runtimeEnv:opts.runtimeEnv??{CCPUN_APP_ENV:"production-admin",CCPUN_DEPLOYMENT_PROVIDER:"hostinger",CCPUN_DEPLOYMENT_ROLE:"admin",AUTH_URL:"https://admin.ccpun.com"},readArticle:async()=>{reads++;return opts.doc===undefined?article:opts.doc;},enqueue:async()=>{writes++;if(opts.error)throw new Error(opts.error);return {job_id:"fixture-job"};}});
 return {response,reads,writes,json:await response.json()};
}
test("real Sanity toolkit signature authenticates exact raw body before durable commit",async()=>{const r=await run();assert.equal(r.response.status,202);assert.equal(r.writes,1);assert.equal(r.json.jobId,"fixture-job");assert.equal(r.response.headers.get("cache-control"),"private, no-store");});
test("tamper, wrong secret, missing signature, stale/future, draft/version/strict shape cannot write",async()=>{
 for(const opts of [{signSecret:"WRONG-TEST-FIXTURE"},{headers:{"sanity-webhook-signature":""}},{timestamp:now-300001},{timestamp:now+300001},{body:{...payload,articleId:"drafts.a"}},{body:{...payload,articleId:"versions.a"}},{body:{...payload,approval:true}}]){const r=await run(opts);assert.ok([400,401].includes(r.response.status));assert.equal(r.writes,0);assert.equal(r.reads,0);}
 const raw=JSON.stringify(payload);const signature=await encodeSignatureHeader(raw,now,secret);const r=await run({raw:raw+" ",headers:{"sanity-webhook-signature":signature}});assert.equal(r.response.status,401);assert.equal(r.writes,0);
});
test("project, dataset, exact ingress host/proto and deployment lane are enforced",async()=>{
 for(const headers of [{"sanity-project-id":"ccb9lnw5"},{"sanity-dataset":"uat"},{host:"admin-test.ccpun.com"},{"x-forwarded-host":"evil.test"},{"x-forwarded-proto":"http"}]){const r=await run({headers: headers as unknown as Record<string,string>});assert.equal(r.response.status,403);assert.equal(r.writes,0);}
 const uat=await run({environment:"admin-uat"});assert.equal(uat.response.status,202);assert.equal(uat.writes,0);assert.equal(uat.reads,0);
 const url="http://127.0.0.1:3000/api/integrations/sanity/article-published/";assert.equal((await run({url,runtimeEnv:{}})).response.status,403);
 assert.equal((await run({url,headers:{"x-forwarded-proto":"https"},runtimeEnv:{CCPUN_APP_ENV:"production-admin",CCPUN_DEPLOYMENT_PROVIDER:"hostinger",CCPUN_DEPLOYMENT_ROLE:"admin",AUTH_URL:"https://admin.ccpun.com"}})).response.status,202);
});
test("body limit includes streaming/chunked bodies and bounded rate rejects before database",async()=>{
 const oversized=await run({raw:"x".repeat(4097)});assert.equal(oversized.response.status,413);assert.equal(oversized.writes,0);
 const signature=await encodeSignatureHeader("x".repeat(5000),now,secret);let writes=0;
 const request=new Request("https://admin.ccpun.com/api/integrations/sanity/article-published/",{method:"POST",headers:{host:"admin.ccpun.com","sanity-project-id":"kyfxgjnq","sanity-dataset":"production","sanity-webhook-signature":signature},body:new ReadableStream({start(c){c.enqueue(new Uint8Array(2500));c.enqueue(new Uint8Array(2500));c.close();}}),duplex:"half"} as RequestInit);
 assert.equal((await handle(request,{environment:"production-admin",secret,now:()=>now,runtimeEnv:{CCPUN_APP_ENV:"production-admin",CCPUN_DEPLOYMENT_PROVIDER:"hostinger",CCPUN_DEPLOYMENT_ROLE:"admin",AUTH_URL:"https://admin.ccpun.com"},readArticle:async()=>article,enqueue:async()=>{writes++;return null;}})).status,413);assert.equal(writes,0);
 let last;for(let i=0;i<61;i++)last=await run({headers:{"x-real-ip":"TEST-RATE-FIXTURE"}});assert.equal(last!.response.status,429);assert.equal(last!.writes,0);
});
test("authoritative noindex/canonical/review wins over payload and errors are retryable",async()=>{
 for(const doc of [{...article,noindex:true},{...article,canonical:"https://evil.test/"},{...article,reviewStatus:"draft"},null]){const r=await run({doc});assert.equal(r.response.status,202);assert.equal(r.writes,0);}
 assert.equal((await run({error:"DB-TEST-FAILURE"})).response.status,503);assert.equal((await run({error:"SEO_DELIVERY_COLLISION"})).response.status,409);
 const missing=await run({headers:{"idempotency-key":"","sanity-webhook-id":"CONFIGURED-HOOK-NOT-DELIVERY"}});assert.equal(missing.response.status,400);assert.equal(missing.writes,0);
});

test("unconfigured secret fails closed and CMS payload fields cannot replace authoritative URL decisions",async()=>{
 const missing=await run({missingSecret:true});assert.equal(missing.response.status,503);assert.equal(missing.reads,0);assert.equal(missing.writes,0);
 const safe=await run({body:{...payload,noindex:true,canonical:'https://evil.test/',slug:'attacker-controlled'}});assert.equal(safe.response.status,202);assert.equal(safe.writes,1);
});

test("signature comparison is constant-time over the recomputed header, never a plain string compare",async()=>{
 const {readFileSync}=await import("node:fs");const source=readFileSync("lib/admin/seo-intelligence/post-publish-webhook.ts","utf8");
 assert.match(source,/timingSafeEqual\(a, b\)/);assert.doesNotMatch(source,/isValidSignature\(/);
 const raw=JSON.stringify(payload);const valid=await encodeSignatureHeader(raw,now,secret);
 const flipped=valid.slice(0,-1)+(valid.endsWith("A")?"B":"A");
 for(const signature of [flipped,valid+"A",valid.replace(",v1=",", v1=")]){const r=await run({raw,headers:{"sanity-webhook-signature":signature}});assert.equal(r.response.status,401);assert.equal(r.writes,0);}
});
