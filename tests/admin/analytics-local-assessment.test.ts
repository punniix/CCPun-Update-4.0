import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { analyticsReviewInputSchema, parseLocalAiTaskResult, parseLocalAiTaskOutput, expectedDataClass } from "../../lib/local-ai/contracts";
import { inferAndValidate, resolveLocalAiInferenceContract, readLocalAiWorkerMetrics } from "../../workers/local-ai/src/index";
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const base = { locale: "th-TH" as const, assessmentDate: "2026-09-27", promptVersion: "analytics-review-v1" as const,
 evidence: [{ id: "e1", report: "ubersuggest-web-keywords" as const, batchId: "640770ab-ef1e-4b81-ac33-6055c46d2b91", rawHash: "a".repeat(64), windowStart: "2026-08-28", windowEnd: "2026-09-27", sourceAsOf: "2026-09-23", nativeTimeZone: null, truncated: false }],
 limitations: ["ไม่มีค่าใช้จ่ายและรายได้จริง"], candidates: [{ id: "c1", action: "keyword-planning" as const, label: "ตรวจหัวข้อ", why: "Volume เป็นบริบท ไม่ใช่ยอดเข้าชม", evidenceIds: ["e1"], metrics: [{ name: "Volume", value: 165000 }, { name: "อันดับ", value: null }] }] };
const input = { ...base, snapshotHash: digest(base) };
test("analytics input/result requires unique known references, public-safe only, immutable supplied facts and human review", () => {
 assert.equal(expectedDataClass("analytics-review"), "public-safe"); assert.equal(analyticsReviewInputSchema.safeParse(input).success, true);
 const result = parseLocalAiTaskResult("analytics-review", input, { rankedFindingIds: ["c1"], reviewRequired: true }); assert.equal(result.success, true);
 if (result.success && "findings" in result.data) { assert.deepEqual(result.data.findings[0], base.candidates[0]); assert.equal(result.data.snapshotHash, input.snapshotHash); assert.equal(parseLocalAiTaskOutput("analytics-review", result.data).success, true); }
 for (const rankedFindingIds of [["c2"], ["c1", "c1"], []]) assert.equal(parseLocalAiTaskResult("analytics-review", input, { rankedFindingIds, reviewRequired: true }).success, false);
 assert.equal(parseLocalAiTaskResult("analytics-review", input, { rankedFindingIds: ["c1"], reviewRequired: false }).success, false);
 assert.equal(parseLocalAiTaskResult("analytics-review", input, { rankedFindingIds: ["c1"], reviewRequired: true, ROAS: 10 }).success, false);
 assert.equal(analyticsReviewInputSchema.safeParse({ ...input, candidates: [{ ...base.candidates[0], evidenceIds: ["e2"] }] }).success, false);
 for (const label of ["test@example.com", "0812345678", "1234567890123", "https://site.test/?email=x", "Bearer secret"]) assert.equal(analyticsReviewInputSchema.safeParse({ ...input, candidates: [{ ...base.candidates[0], label }] }).success, false);
 assert.equal(analyticsReviewInputSchema.safeParse({ ...input, candidates: Array.from({length:17}, (_,i)=>({...base.candidates[0],id:`c${i+1}`})) }).success,false);
 assert.equal(analyticsReviewInputSchema.safeParse({ ...input, candidates: Array.from({length:16}, (_,i)=>({...base.candidates[0],id:`c${i+1}`,label:"ก".repeat(240),why:"ข".repeat(240)})) }).success,false);
});
test("worker uses selection-only schema; tampered snapshot never reaches inference", async () => {
 assert.ok(readLocalAiWorkerMetrics().processRssBytes > 0);
 assert.match(readFileSync(new URL("../../workers/local-ai/src/index.ts",import.meta.url),"utf8"), /analyticsReviewVersion: ANALYTICS_REVIEW_VERSION/);
 const contract = resolveLocalAiInferenceContract("analytics-review", input);
 assert.equal(contract.outputSchema.safeParse({ rankedFindingIds:["c1"],reviewRequired:true }).success,true);
 assert.equal(contract.outputSchema.safeParse({ findings:base.candidates,reviewRequired:true }).success,false);
 await assert.rejects(inferAndValidate("http://invalid.invalid/", "qwen3:1.7b", "analytics-review", { ...input, snapshotHash:"b".repeat(64) }), /ANALYTICS_SNAPSHOT_INVALID/);
});
test("server snapshot strips every untrusted dimension and original numeric values/unknowns survive", () => {
 const directory=mkdtempSync(join(tmpdir(),"ccpun-assessment-check-")); const stub=join(directory,"empty.cjs"); writeFileSync(stub,"module.exports={};");
 const script = `import assert from 'node:assert/strict';import {registerHooks} from 'node:module';import {createHash} from 'node:crypto';registerHooks({resolve(s,c,next){if(s==='server-only')return {url:${JSON.stringify(pathToFileURL(stub).href)},shortCircuit:true};return next(s,c)}});const {buildDailyAssessmentInput}=await import('./lib/admin/analytics/assessment.ts');const d={report:'ubersuggest-web-keywords',source:'ubersuggest',title:'test',batchId:'640770ab-ef1e-4b81-ac33-6055c46d2b91',collectedAt:'2026-09-27T07:14:00.000Z',sourceAsOf:'2026-09-23',windowStart:'2026-08-28',windowEnd:'2026-09-27',nativeTimeZone:null,columns:[],rows:[{'คำค้น':'private@example.com','หน้าเว็บ':'https://x.test/?token=do-not-copy','Volume':165000,'Difficulty (0–100)':52,'อันดับ':null,'Intent':'commercial'}],overview:[],limitations:[],truncated:false,rawHash:'a'.repeat(64),lastAttemptAt:null,lastAttemptStatus:null};const v=buildDailyAssessmentInput([d],'2026-09-27');assert.ok(v);assert.ok(!JSON.stringify(v).includes('private@example.com'));assert.ok(!JSON.stringify(v).includes('do-not-copy'));assert.ok(v.candidates.some(c=>c.metrics.some(m=>m.name==='Volume Ubersuggest'&&m.value===165000)));assert.ok(v.candidates.some(c=>c.metrics.some(m=>m.name==='Difficulty Ubersuggest (0–100)'&&m.value===52)));assert.ok(v.candidates.some(c=>c.metrics.some(m=>m.name==='อันดับ Ubersuggest'&&m.value===null)));assert.ok(v.candidates.some(c=>c.metrics.some(m=>m.value===null)));const {snapshotHash,...snapshot}=v;assert.equal(snapshotHash,createHash('sha256').update(JSON.stringify(snapshot)).digest('hex'));assert.equal(buildDailyAssessmentInput([]),null);assert.ok(Buffer.byteLength(JSON.stringify(v))<=20000);`;
 try { execFileSync(process.execPath,["--import","tsx","--input-type=module","-e",script],{cwd:process.cwd(),stdio:"pipe"}); } finally { rmSync(directory,{recursive:true,force:true}); }
});
test("assessment read model accepts PostgreSQL timestamp offsets and still rejects invalid timestamps", () => {
 const directory=mkdtempSync(join(tmpdir(),"ccpun-assessment-timestamps-")); const stub=join(directory,"empty.cjs"); writeFileSync(stub,"module.exports={};");
 const output=parseLocalAiTaskResult("analytics-review",input,{rankedFindingIds:["c1"],reviewRequired:true}); assert.equal(output.success,true); if (!output.success) return;
 const script = `import assert from 'node:assert/strict';import {registerHooks} from 'node:module';registerHooks({resolve(s,c,next){if(s==='server-only')return {url:${JSON.stringify(pathToFileURL(stub).href)},shortCircuit:true};return next(s,c)}});const {analyticsAssessmentReadSchema:schema}=await import('./lib/admin/analytics/assessment.ts');const job={jobId:'ba133ba4-fa40-4442-8a5a-99d356e14a71',status:'succeeded',reviewStatus:'pending',modelName:'qwen3:1.7b',createdAt:'2026-09-27T10:27:21.179952+00:00',completedAt:'2026-09-27T10:29:16.896554+00:00',output:${JSON.stringify(output.data)}};const value={latest:job,lastGood:job,dayJob:job,workerReady:true};assert.deepEqual(schema.parse(value),value);for(const field of ['createdAt','completedAt'])assert.equal(schema.safeParse({...value,latest:{...job,[field]:'not-a-date'}}).success,false);assert.equal(schema.safeParse({...value,latest:{...job,createdAt:'2026-09-27T10:27:21.179952Z',completedAt:null}}).success,true);assert.equal(schema.safeParse({...value,raw:'unexpected'}).success,false);`;
 try { execFileSync(process.execPath,["--import","tsx","--input-type=module","-e",script],{cwd:process.cwd(),stdio:"pipe"}); } finally { rmSync(directory,{recursive:true,force:true}); }
});
test("atomic narrow SQL preserves old task/review gates and scopes latest/last-good without ciphertext leaks", () => {
 const sql = readFileSync(new URL("../../db/migrations/20260927_analytics_local_review_v3.sql",import.meta.url),"utf8");
 const body=sql.split("-- checksum-source-begin\n")[1]!.split("-- checksum-source-end")[0]!; assert.ok(sql.includes(`sha256:${createHash('sha256').update(body).digest('hex')}`));
 assert.match(sql,/pg_advisory_xact_lock\(hashtext\('ccpun-local-ai-enqueue-v2'\)\)/);
 assert.match(sql,/IF FOUND THEN[\s\S]*?true,'reused'/); assert.match(sql,/local_ai_job_v2\(p_job_id,'analytics-review','public-safe'/);
 assert.match(sql,/WHERE j.task_type='analytics-review' AND j.data_class='public-safe'/); assert.match(sql,/review_status IN \('pending','approved'\)/);
 const readFunction=sql.split('CREATE OR REPLACE FUNCTION ccpun_admin.admin_read_analytics_review_v3()')[1]!.split('$read$;')[0]!;
 assert.doesNotMatch(readFunction,/ciphertext_b64|nonce_b64|auth_tag_b64|request_fingerprint|actor_digest/);
 assert.match(sql,/analyticsReviewVersion/);assert.match(sql,/interval '90 seconds'/);assert.match(sql,/IS DISTINCT FROM 'analytics-review-v1'/);
 assert.match(sql,/REVOKE ALL ON FUNCTION[\s\S]*FROM PUBLIC/);assert.match(sql,/TO ccpun_admin_runtime/);assert.doesNotMatch(sql,/GRANT (?:SELECT|INSERT|UPDATE|DELETE)/);
});
test("existing Daily workflow enqueues an opaque VPS assessment before source failure checking without losing either error", () => {
 const w=JSON.parse(readFileSync(new URL("../../workers/local-ai/n8n/marketing-daily-ai.direct.json",import.meta.url),"utf8"));
 const name="Daily · ประเมินด้วย VPS AI", checker="Daily · ตรวจผลครบทุกต้นทาง";
 assert.equal(w.connections["Daily · UBERSUGGEST"].main[0][0].node,name);
 assert.equal(w.connections[name].main[0][0].node,checker);
 const request=w.nodes.find((n: {name:string})=>n.name===name);
 assert.equal(request.parameters.jsonBody,"{}"); assert.match(request.parameters.url,/\/api\/internal\/analytics\/assessment\//);
 assert.equal(request.onError,"continueRegularOutput");
 const validate=new Function("$",w.nodes.find((n: {name:string})=>n.name===checker).parameters.jsCode);
 const run=(sourceStatus:string,assessment:Record<string,unknown>)=>validate((node:string)=>({first:()=>({json:node===name?assessment:{results:[{source:node.split(" · ")[1]!.toLowerCase(),status:sourceStatus}]}})}));
 assert.equal(run("completed",{state:"queued",jobId:input.evidence[0]!.batchId})[0].json.assessment.state,"queued");
 assert.throws(()=>run("failed",{state:"queued"}),/ANALYTICS_DAILY_INCOMPLETE/);
 assert.throws(()=>run("completed",{error:"unauthorized"}),/ANALYTICS_ASSESSMENT_INCOMPLETE/);
 assert.throws(()=>run("duplicate",{state:"failed",reused:true}),/ANALYTICS_ASSESSMENT_INCOMPLETE/);
});
