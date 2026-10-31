import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {loadFixtureModule} from "../../qa/phase1-fixture-loader.mjs";
const env={CCPUN_APP_ENV:"production-admin",CCPUN_SEO_POST_PUBLISH_QUEUE_ENABLED:"1"};
const article={id:"TEST-ARTICLE",updatedAt:"2026-10-26T00:00:00.000Z",reviewStatus:"approved"};
function queueFixture(){const jobs=new Map<string,string>(),receipts=new Map<string,{version:string;article:string;job_id:string}>();let sequence=0;
 const query=async(sql:string,values:unknown[]=[])=>{assert.match(sql,/WITH existing_delivery/);assert.doesNotMatch(sql,/UPDATE SET/);const [id,version,,rev,delivery]=values as string[];assert.equal(rev,"TEST-REV");const receipt=receipts.get(delivery);if(receipt)return receipt.article===id&&receipt.version===version?[receipt]:[{collision:true}];const key=`${id}:${version}`;const job_id=jobs.get(key)??`TEST-JOB-${sequence++}`;jobs.set(key,job_id);const value={job_id,article:id,version};receipts.set(delivery,value);return [value];};
 const mod=loadFixtureModule("lib/admin/seo-intelligence/post-publish-queue.ts",{mocks:new Map([["@neondatabase/serverless",{neon:()=>({query})}],["@/lib/admin/operations/foundation",{adminOperationsRuntimeInputFromEnvironment:()=>({}),resolveAdminOperationsRuntimeIdentity:()=>true}]])});
 return {...mod,jobs,receipts};}
test("producer consumes durable DB receipts: duplicate deliveries/content version and concurrent mock requests produce one job",async()=>{const q=queueFixture();const enqueue=(deliveryId:string,doc=article)=>q.enqueuePublishedSeoWebhook({article:doc,deliveryId,sanityRev:"TEST-REV"},env);const results=await Promise.all(Array.from({length:5},(_,i)=>enqueue(`TEST-DELIVERY-${i%2}`)));assert.equal(new Set(results.map(x=>x.job_id)).size,1);assert.equal(q.jobs.size,1);assert.equal(q.receipts.size,2);await enqueue("TEST-DELIVERY-NEW",{...article,updatedAt:"2026-10-26T01:00:00.000Z"});assert.equal(q.jobs.size,2);await assert.rejects(()=>enqueue("TEST-DELIVERY-0",{...article,id:"TEST-OTHER"}),/SEO_DELIVERY_COLLISION/);});
test("completed reconciler row keeps provenance while late signed receipt grants a separate notification intent",async()=>{const q=queueFixture();q.jobs.set(`${article.id}:${article.updatedAt}`,"TEST-EXISTING-COMPLETED-RECONCILER");const result=await q.enqueuePublishedSeoWebhook({article,deliveryId:"TEST-LATE",sanityRev:"TEST-REV"},env);assert.equal(result.job_id,"TEST-EXISTING-COMPLETED-RECONCILER");assert.equal(q.jobs.size,1);assert.equal(q.receipts.size,1);const source=readFileSync("lib/admin/seo-intelligence/post-publish-queue.ts","utf8");assert.match(source,/WHERE j.state='completed'/);assert.match(source,/seo_post_publish_intent i WHERE i.job_id=j.job_id/);assert.match(source,/AS notification_approved/);assert.doesNotMatch(source,/SET source='webhook'/);});
test("collision/invisible concurrent winner cannot acknowledge a missing receipt; schema FKs bind receipt to committed job",async()=>{const mod=loadFixtureModule("lib/admin/seo-intelligence/post-publish-queue.ts",{mocks:new Map([["@neondatabase/serverless",{neon:()=>({query:async()=>[]})}],["@/lib/admin/operations/foundation",{adminOperationsRuntimeInputFromEnvironment:()=>({}),resolveAdminOperationsRuntimeIdentity:()=>true}]])});assert.equal(await mod.enqueuePublishedSeoWebhook({article,deliveryId:"TEST-INVISIBLE",sanityRev:"TEST-REV"},env),null);const sql=readFileSync("db/migrations/20261026_seo_post_publish_webhook_v2.sql","utf8");assert.match(sql,/REFERENCES ccpun_admin.seo_post_publish_job\(job_id\) DEFERRABLE INITIALLY DEFERRED/);assert.match(sql,/GRANT SELECT,INSERT ON ccpun_admin.seo_post_publish_intent TO ccpun_admin_runtime/);assert.doesNotMatch(sql,/GRANT[^;]*UPDATE[^;]*intent[^;]*ccpun_admin_runtime/);});
test("telemetry only sends allowlisted detail, uses actual table columns, nonblocking failures and no PII",async()=>{
 const {writeSeoTelemetry}=loadFixtureModule("lib/admin/seo-intelligence/post-publish-telemetry.ts",{mocks:new Map([["@/lib/admin/ops-telemetry/store",{readSupabaseConfig:()=>({url:"https://TEST-ONLY.supabase.co",key:"OBVIOUS-TEST-FIXTURE"})}],["@/lib/admin/seo-intelligence/post-publish-worker-policy",{workerDatabaseIdentity:()=>true}]])});let calls=0;const input={jobId:"TEST-JOB",step:"live-gate",status:"succeeded",detail:{articleId:"TEST-ARTICLE",path:"/blog/personal-finance/test/",httpStatus:200}};
 const fetcher=async(url:string,init:RequestInit)=>{calls++;assert.equal(init.redirect,"error");if(url.includes("ops_lane_identity"))return Response.json([{lane:"production-admin"}]);assert.ok(url.endsWith("/ops_workflow_runs"));const row=JSON.parse(String(init.body));assert.deepEqual(Object.keys(row.detail),["articleId","path","httpStatus"]);assert.equal(row.workflow_id,"seoPostPublish01");assert.equal(row.execution_id,"TEST-JOB");assert.ok(!("run_id" in row));assert.ok(!("run_date" in row));return new Response(null,{status:201});};
 await writeSeoTelemetry(input,{},fetcher);assert.equal(calls,2);for(const detail of [{...input.detail,title:"private"},{...input.detail,path:"/private@example.test"},{...input.detail,articleId:"0812345678"}]){await writeSeoTelemetry({...input,detail},{},fetcher);assert.equal(calls,2);}await assert.doesNotReject(()=>writeSeoTelemetry(input,{},async()=>{throw new Error("TEST-DOWN");}));
});

test("stale completed jobs and exhausted attempts cannot reopen indefinitely; shared uncertain PUT fences future jobs",()=>{
 const queue=readFileSync("lib/admin/seo-intelligence/post-publish-queue.ts","utf8");
 assert.match(queue,/j.attempts<8 AND coalesce\(j.result_json->>'skipped',''\)<>'stale-or-ineligible'/);
 assert.match(queue,/WHERE state='queued' AND attempts>=8/);
 assert.match(queue,/SEO_VERIFICATION_INCOMPLETE/);assert.match(queue,/interval '45 minutes'/);
 const migration=readFileSync("db/migrations/20261026_seo_post_publish_webhook_v2.sql","utf8");
 assert.match(migration,/state IN \('processing','validating','uncertain','reconciling'\)/);
 assert.match(migration,/last_error_code='gsc-uncertain-exhausted'/);
 assert.match(migration,/seo_claim_gsc_window/);
 const store=readFileSync("lib/admin/seo-intelligence/post-publish-notification-store.ts","utf8");
 assert.match(store,/attempts>=3 THEN 'blocked'/);assert.match(store,/final_index_state='unknown'/);
});

test("both inspection reservations carry active minute counters across UTC daily rollover",()=>{
 const sql=readFileSync('db/migrations/20261026_seo_post_publish_webhook_v2.sql','utf8');
 assert.equal((sql.match(/ORDER BY minute_start DESC NULLS LAST, day DESC LIMIT 1/g)??[]).length,2);
 assert.equal((sql.match(/v_minute_count>=480/g)??[]).length,2);
 assert.equal((sql.match(/THEN v_minute_count\+1 ELSE 1 END/g)??[]).length,2);
 // Model the query's NULLS LAST selection: the new daily row cannot erase a live prior minute.
 const rows=[{day:'2026-10-27',minute_start:null,minute_count:0},{day:'2026-10-26',minute_start:Date.parse('2026-10-26T23:59:40Z'),minute_count:480}];
 const latest=rows.filter(r=>r.minute_start!==null).sort((a,b)=>b.minute_start!-a.minute_start!)[0];
 assert.ok(latest.minute_start!>Date.parse('2026-10-27T00:00:10Z')-60000);assert.ok(latest.minute_count>=480);
 const tied=[{day:'2026-10-26',minute_start:latest.minute_start,minute_count:479},{day:'2026-10-27',minute_start:latest.minute_start,minute_count:480}].sort((a,b)=>b.minute_start!-a.minute_start!||b.day.localeCompare(a.day));assert.equal(tied[0].minute_count,480);
});


test("real producer binds raw quoted delivery keys without a second token validator or identity normalization",async()=>{
 const q=queueFixture(),delivery='"00000000-0000-4000-8000-000000000001"';
 const enqueue=(key:string,doc=article)=>q.enqueuePublishedSeoWebhook({article:doc,deliveryId:key,sanityRev:"TEST-REV"},env);
 const rows=await Promise.all(Array.from({length:4},()=>enqueue(delivery)));
 assert.equal(new Set(rows.map(x=>x.job_id)).size,1);assert.equal(q.jobs.size,1);assert.equal(q.receipts.size,1);
 assert.equal(q.receipts.has(delivery),true);assert.equal(q.receipts.has(delivery.slice(1,-1)),false);
 await enqueue("LEGACY-BARE-KEY");assert.equal(q.jobs.size,1);assert.equal(q.receipts.size,2);
 await assert.rejects(()=>enqueue(delivery,{...article,id:"TEST-OTHER"}),/SEO_DELIVERY_COLLISION/);
});


test("signed publish traverses real receiver, producer and notification pipeline with transports default OFF",async()=>{
 const {encodeSignatureHeader}=await import("@sanity/webhook");
 const {handleSanityArticlePublished}=loadFixtureModule("lib/admin/seo-intelligence/post-publish-webhook.ts");
 const {runDurablePostPublishNotifications}=loadFixtureModule("lib/admin/seo-intelligence/post-publish-notifications.ts");
 const q=queueFixture(),now=1793000000000,delivery='"fixture-delivery"';
 const doc={...article,rev:"TEST-REV",slug:"example",category:"Personal Finance",categorySlug:"personal-finance",noindex:false};
 const body=JSON.stringify({articleId:doc.id,rev:doc.rev,contentUpdatedAt:doc.updatedAt,op:"create"});
 const signature=await encodeSignatureHeader(body,now,"OBVIOUS-TEST-FIXTURE-NOT-A-REAL-SECRET");
 const ingress={CCPUN_APP_ENV:"production-admin",CCPUN_DEPLOYMENT_PROVIDER:"hostinger",CCPUN_DEPLOYMENT_ROLE:"admin",AUTH_URL:"https://admin.ccpun.com"};
 const send=()=>handleSanityArticlePublished(new Request("https://admin.ccpun.com/api/integrations/sanity/article-published/",{method:"POST",headers:{host:"admin.ccpun.com","sanity-project-id":"kyfxgjnq","sanity-dataset":"production","sanity-webhook-signature":signature,"idempotency-key":delivery},body}),{environment:"production-admin",secret:"OBVIOUS-TEST-FIXTURE-NOT-A-REAL-SECRET",now:()=>now,runtimeEnv:ingress,readArticle:async()=>doc,enqueue:(input:unknown)=>q.enqueuePublishedSeoWebhook(input,env)});
 const first=await send(),duplicate=await send();assert.equal(first.status,202);assert.equal(duplicate.status,202);
 assert.deepEqual(await first.json(),await duplicate.json());assert.equal(q.jobs.size,1);assert.equal(q.receipts.size,1);assert.ok(q.receipts.has(delivery));
 const job={job_id:q.receipts.get(delivery)!.job_id,article_id:doc.id,content_version:doc.updatedAt,state:"processing",source:"webhook",actor:"sanity-webhook",owner_approved:true,notification_approved:true,attempts:1,sitemap_attempted:false,lease_id:"00000000-0000-4000-8000-000000000002"};
 const workerEnv={...ingress,CCPUN_BACKGROUND_EXECUTION_PLANE:"vps",CCPUN_SEO_POST_PUBLISH_WORKER_ENABLED:"1",CCPUN_NEON_PROJECT_ID:"lively-bar-43618798",CCPUN_NEON_BRANCH_ID:"br-long-resonance-b3ys5xrv",CCPUN_NEON_DATABASE:"neondb",CCPUN_SEO_POST_PUBLISH_DATABASE_URL:"postgresql://ccpun_seo_post_publish_worker:OBVIOUS-TEST-FIXTURE@ep-broad-butterfly-b3ro7u8w.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"};
 const calls:string[]=[];
 const forbidden=async()=>{calls.push("forbidden-transport");throw new Error("unexpected external transport");};
 const verify={articleId:doc.id,url:"https://ccpun.com/blog/personal-finance/example/",checkedAt:doc.updatedAt,live:{state:"pass",httpStatus:200},canonical:{state:"pass"},indexability:{state:"pass"},sitemap:{state:"pass"},discovery:{state:"sitemap-visible"}};
 const deps={readArticle:async()=>doc,verify:async()=>verify,initialBudget:forbidden,reserve:forbidden,finish:forbidden,schedule:async()=>{calls.push("schedule-read-only-inspections");},readToken:forbidden,writeToken:forbidden,inspect:forbidden,submitSitemap:forbidden,indexNow:forbidden,telemetry:async(input:{step:string})=>{calls.push(input.step);}};
 const {runPostPublishSeoPipeline}=loadFixtureModule("lib/admin/seo-intelligence/post-publish-runner.ts",{mocks:new Map([["@/lib/admin/seo-intelligence/post-publish-notifications",{runDurablePostPublishNotifications:(claimed:unknown)=>runDurablePostPublishNotifications(claimed,workerEnv,deps)}]])});
 const result=await runPostPublishSeoPipeline({articleId:doc.id,actor:job.actor,requestId:job.job_id,revision:doc.updatedAt,ownerApproved:true,job,beforeExternalWrite:forbidden});
 assert.equal(result.notificationOutcome,"completed");assert.equal(result.sitemapSubmission.state,"skipped");assert.equal(result.google.state,"unavailable");
 assert.deepEqual(calls,["webhook-received","live-gate","schedule-read-only-inspections"]);
 // The actual runner delegates durable jobs directly to this same pipeline; no legacy owner-write branch.
 const runner=readFileSync("lib/admin/seo-intelligence/post-publish-runner.ts","utf8");assert.match(runner,/if \(input\.job\) return runDurablePostPublishNotifications\(input\.job\)/);
 assert.equal(typeof runPostPublishSeoPipeline,"function");
});
