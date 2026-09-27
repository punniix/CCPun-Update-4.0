import assert from "node:assert/strict";
import test, { before, after } from "node:test";
import { registerHooks } from "node:module";
import { createHash } from "node:crypto";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { buildAnalyticsInferenceView, buildAnalyticsInferenceRequest, analyticsReviewInputSchema, parseLocalAiTaskResult, marketingSnapshotSchema, marketingAnalysisInputSchema } from "../../lib/local-ai/contracts";
import { inferAndValidate, readLocalAiInferenceMetrics } from "../../workers/local-ai/src/index";
import type { AnalyticsDataset } from "../../lib/admin/analytics/model";
const directory = mkdtempSync(join(tmpdir(), "ccpun-ai-full-loop-"));
const stub = join(directory, "empty.cjs"); writeFileSync(stub, "module.exports={};");
registerHooks({ resolve(specifier, context, next) { return specifier === "server-only" ? { url: pathToFileURL(stub).href, shortCircuit: true } : next(specifier, context); } });
after(() => rmSync(directory, { recursive: true, force: true }));
let buildDailyAssessmentInput: typeof import("../../lib/admin/analytics/assessment")["buildDailyAssessmentInput"];
let buildPerformanceTables: typeof import("../../lib/admin/analytics/performance")["buildPerformanceTables"];
before(async () => { ({ buildDailyAssessmentInput } = await import("../../lib/admin/analytics/assessment")); ({ buildPerformanceTables } = await import("../../lib/admin/analytics/performance")); });
function data(report: AnalyticsDataset["report"], rows: AnalyticsDataset["rows"], index: number): AnalyticsDataset {
 return { report, source: report.startsWith("ga4") ? "ga4" : report.startsWith("gsc") ? "gsc" : report === "social-performance" ? "meta" : "ubersuggest", title: report, batchId: `00000000-0000-4000-8000-${String(index).padStart(12,"0")}`, collectedAt:"2026-09-27T10:00:00.000Z", sourceAsOf:"2026-09-26", windowStart:"2026-08-31", windowEnd:"2026-09-26", nativeTimeZone:"Asia/Bangkok", columns: [], rows, overview: [], limitations: [], truncated:false, rawHash:"a".repeat(64), lastAttemptAt:null, lastAttemptStatus:null };
}
const fixture = [
 data("gsc-query-page", Array.from({length:40}, (_,i)=>({"คำค้น":`private${i}@example.com`,"หน้าเว็บ":"https://site.test/?token=private", "การแสดงผล":101+i,"คลิก":0,"อันดับเฉลี่ย":17.89})),1),
 data("ga4-session-performance",Array.from({length:20},(_,i)=>({"แคมเปญ":"Bearer private","หน้าเข้า":"https://site.test/?email=private", "เซสชัน":10+i,"Engaged sessions":8,"Key events":2,"Session key event rate (%)":12.5})),2),
 data("ga4-marketing-events",[{Event:"line_oa_click","จำนวน event":7},{Event:"fhc_complete","จำนวน event":3}],3),
 data("social-performance",Array.from({length:30},(_,i)=>({"เนื้อหา":"private@example.com","Provider Object ID":"1234567890123","ยอดดู":100+i,"Total interactions":i,"คลิก":0})),4),
 data("ga4-summary",[{"ผู้ใช้งาน":100,"เซสชัน":120}],5),
];
const input = () => buildDailyAssessmentInput(fixture,"2026-09-27")!;
test("large SEO pool cannot displace represented campaign/activity/social families; reversed report order is deterministic",()=>{
 const value=input(); assert.equal(value.promptVersion,"analytics-review-v2");
 assert.deepEqual(buildDailyAssessmentInput([...fixture].reverse(),"2026-09-27"),value);
 for (const action of ["measurement-gap","seo-review","campaign-review","activity-review","social-review"]) assert.ok(value.candidates.some(c=>c.action===action),action);
 assert.ok(value.candidates.length>5); assert.ok(value.candidates.length<=16);
 assert.equal(value.coverage!.reduce((sum,row)=>sum+row.sent,0),value.candidates.length);
 for(const row of value.coverage!) assert.equal(row.prepared,row.sent+row.dropped);
 assert.equal(value.coverage!.find(row=>row.action==="seo-review")!.prepared,40);
 const model=JSON.stringify(buildAnalyticsInferenceView(value)); assert.ok(buildAnalyticsInferenceRequest(value).promptBytes<=6000);
 for(const forbidden of ["private@example.com","Bearer private","https://","rawHash","batchId"]) assert.ok(!model.includes(forbidden),forbidden);
 assert.ok(!JSON.stringify(value).includes("private@example.com"));
 const {snapshotHash,...snapshot}=value;assert.equal(snapshotHash,createHash("sha256").update(JSON.stringify(snapshot)).digest("hex"));
 assert.equal(analyticsReviewInputSchema.safeParse({...value,coverage:value.coverage!.map(row=>({...row,sent:row.sent+1}))}).success,false);
});
test("no source rows means no invented campaign/social performance and no fake prior-period data",()=>{
 const value=buildDailyAssessmentInput([data("ga4-summary",[],1)],"2026-09-27")!;
 assert.ok(value.candidates.every(row=>row.action==="measurement-gap"));
 assert.ok(value.candidates.every(row=>row.metrics.length===0));
 assert.equal(value.coverage!.find(row=>row.action==="social-review")!.prepared,0);
 const seo=buildPerformanceTables(fixture).find(table=>table.view==="seo-review")!.rows[0]!;
 assert.match(String(seo["งานที่ควรตรวจ"]),/ตรวจอันดับ/);assert.doesNotMatch(String(seo["งานที่ควรตรวจ"]),/ตรวจชื่อ/);
});
test("partial and old native reports keep flags/age in evidence without treating a Daily success as fresh upstream",()=>{
 const old={...fixture[0]!,sourceAsOf:"2026-09-01",truncated:true};
 const value=buildDailyAssessmentInput([old],"2026-09-27")!;
 assert.equal(value.evidence[0]!.sourceAsOf,"2026-09-01");assert.equal(value.evidence[0]!.truncated,true);
 assert.ok(value.candidates.some(row=>row.reasonCode==="source-age"&&row.metrics[0]!.value===26));
 assert.ok(buildAnalyticsInferenceView(value).sources.some(row=>row.partial&&row.asOf==="2026-09-01"));
});
test("worker sends compact facts, keeps full immutable output, records only bounded numeric telemetry and rejects invented IDs",async()=>{
 const original=globalThis.fetch;let calls=0;let selection:string[]=[];let invalidTelemetry=false;
 globalThis.fetch=async(_url,options)=>{calls++;const request=JSON.parse(String(options!.body));const view=JSON.parse(request.messages[1].content);selection=view.candidates.slice(0,5).map((row:{id:string})=>row.id);assert.equal(request.options.num_ctx,4096);assert.equal(request.think,false);assert.ok(!request.messages[1].content.includes("batchId"));return new Response(JSON.stringify({message:{content:JSON.stringify({rankedFindingIds:selection,reviewRequired:true})},prompt_eval_count:invalidTelemetry?"private@example.com":1100,eval_count:40,load_duration:1000000,eval_duration:2000000,total_duration:3000000}),{status:200});};
 try { const value=input();const result=await inferAndValidate("http://ollama:11434/","qwen3:1.7b","analytics-review",value);assert.equal(result.success,true);if(result.success&&"findings"in result.data){assert.deepEqual(result.data.findings,selection.map(id=>value.candidates.find(row=>row.id===id)));assert.equal(result.data.snapshotHash,value.snapshotHash);assert.deepEqual(result.data.coverage,value.coverage);}
 const metrics=readLocalAiInferenceMetrics();assert.equal(metrics.last!.promptTokens,1100);assert.equal(metrics.last!.loadDurationMs,1);assert.equal(metrics.last!.generationDurationMs,2);assert.ok(!JSON.stringify(metrics).includes("rankedFindingIds"));
 assert.equal(parseLocalAiTaskResult("analytics-review",value,{rankedFindingIds:["c99"],reviewRequired:true}).success,false);
 invalidTelemetry=true;await inferAndValidate("http://ollama:11434/","qwen3:1.7b","analytics-review",value);assert.equal(readLocalAiInferenceMetrics().last!.promptTokens,null);assert.ok(!JSON.stringify(readLocalAiInferenceMetrics()).includes("private@example.com"));
 const before=calls;await assert.rejects(inferAndValidate("http://ollama:11434/","qwen3:1.7b","analytics-review",{...value,snapshotHash:"b".repeat(64)}),/ANALYTICS_SNAPSHOT_INVALID/);assert.equal(calls,before);
 }finally{globalThis.fetch=original;}
});
test("v4 is additive, day identity differs from v1, checked checksum and no direct table grants",()=>{
 const sql=readFileSync(new URL("../../db/migrations/20260927_analytics_local_review_v4.sql",import.meta.url),"utf8");
 const body=sql.split("-- checksum-source-begin\n")[1]!.split("-- checksum-source-end")[0]!;
 assert.ok(sql.includes(`sha256:${createHash("sha256").update(body).digest("hex")}`));
 assert.match(sql,/':v2'/);assert.match(sql,/analytics-review-v2/);assert.match(sql,/admin_enqueue_analytics_review_v4/);
 assert.doesNotMatch(sql,/CREATE OR REPLACE FUNCTION ccpun_admin.admin_.*_v3/);assert.doesNotMatch(sql,/DROP|DELETE|TRUNCATE|ALTER TABLE|GRANT (?:SELECT|INSERT|UPDATE|DELETE)/);
 assert.match(sql,/v3_guard/);assert.match(sql,/REVOKE ALL ON FUNCTION[\s\S]*FROM PUBLIC/);
});

test("marketing inference has room for complete JSON within the existing context and timeout; analytics request stays unchanged", async () => {
 const originalFetch=globalThis.fetch, originalTimeout=AbortSignal.timeout;
 const timeouts:number[]=[], requests:Array<{options:{num_ctx:number;num_predict?:number};think:boolean;stream:boolean}>=[];
 const snapshot=marketingSnapshotSchema.parse({promptVersion:"marketing-performance-v1",analysisType:"weekly_performance",definitionVersions:{analytics:"marketing-v2",rules:"marketing-rules-v1",identity:"marketing-identity-v1",freshness:"marketing-calendar-v2"},period:{key:"this_week",currentStart:"2026-09-21",currentEnd:"2026-09-24",previousStart:"2026-09-14",previousEnd:"2026-09-17",calendarPolicy:"Common mature date"},sourceManifest:[],sourceManifestHash:"a".repeat(64),evidence:[{id:"e1",kind:"kpi",assetId:null,label:"organic sessions",metric:"organic_sessions",current:180,previous:100,absoluteChange:80,percentageChange:80,sampleStatus:"sufficient",coverageStatus:"complete",freshnessStatus:"expected_lag",evidenceRef:"sql:organic_sessions",measurementStatus:null}],coverage:{prepared:1,sent:1,dropped:0},limitations:["No measured qualified conversations"]});
 const marketingInput=marketingAnalysisInputSchema.parse({...snapshot,snapshotHash:createHash("sha256").update(JSON.stringify(snapshot)).digest("hex")});
 AbortSignal.timeout=(duration:number)=>{timeouts.push(duration);return originalTimeout(duration);};
 globalThis.fetch=async(_url,options)=>{
  assert.ok(options?.signal instanceof AbortSignal);
  const request=JSON.parse(String(options?.body));requests.push(request);
  const output=requests.length===1?{summary:"การเข้าชมเพิ่มขึ้น ควรติดตามสัญญาณความตั้งใจ",insights:[{type:"win",evidenceIds:["e1"],explanation:"การเข้าชมเพิ่มขึ้น ควรตรวจเนื้อหาที่เกี่ยวข้อง",action:"monitor",priority:"medium",confidence:"medium"}],dataQualityNotes:["กิจกรรมยังไม่ใช่ลูกค้าที่ผ่านการคัดกรอง"],reviewRequired:true}:{rankedFindingIds:[input().candidates[0]!.id],reviewRequired:true};
  return Response.json({message:{content:JSON.stringify(output)}});
 };
 try {
  const marketing=await inferAndValidate("http://ollama:11434/","qwen3:1.7b","marketing-analysis",marketingInput);
  assert.equal(marketing.success,true);
  const analytics=await inferAndValidate("http://ollama:11434/","qwen3:1.7b","analytics-review",input());
  assert.equal(analytics.success,true);
  assert.deepEqual(requests.map(request=>request.options),[{temperature:0,num_ctx:4096,num_predict:768},{temperature:0,num_ctx:4096}]);
  assert.deepEqual(timeouts,[90_000,90_000]);
  assert.ok(requests.every(request=>request.think===false&&request.stream===false));
 }finally{globalThis.fetch=originalFetch;AbortSignal.timeout=originalTimeout;}
});
