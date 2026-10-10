import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const read=(file:string)=>readFileSync(new URL("../../"+file,import.meta.url),"utf8");
const dispatch=read("apps/admin/app/api/admin/n8n/p1/seo/route.ts");
const callback=read("apps/admin/app/api/internal/n8n/p1/seo/callback/route.ts");
const moduleFile=read("lib/admin/n8n/uat-callback-capability.ts");

test("scoped bearer is minted only on durable job and never returned in UI receipt",()=>{
 assert.match(dispatch,/createAgentRuntimeJob/);
 assert.match(dispatch,/issueScopedUatCapability/);
 assert.match(dispatch,/secret:config\.token/);
 assert.match(dispatch,/body:JSON\.stringify\(\{jobId:job\.jobId,correlationId,environment:"admin-uat",keywords:parsed\.data\.keywords,callbackCapability\}\)/);
 assert.doesNotMatch(dispatch,/return NextResponse\.json\(\{[^\n]*callbackCapability/);
 assert.match(dispatch,/status:"waiting_external",stage:"n8n-dispatching"/);
});

test("callback must authenticate against limited HMAC capability and exact persisted job identity",()=>{
 assert.match(callback,/getAdminEnvironment\(\) !== "admin-uat"/);
 assert.match(callback,/CCPUN_N8N_P1_UAT_ENABLED !== "true"/);
 assert.match(callback,/verifyScopedUatCapability/);
 assert.match(callback,/CCPUN_N8N_P1_UAT_TOKEN/);
 assert.doesNotMatch(callback,/CCPUN_AGENT_OS_N8N_ENABLED|isN8nAgentOsRequestAuthorized/);
 assert.match(callback,/job\.correlationId !== parsed\.data\.correlationId/);
 assert.match(callback,/job\.n8nExecutionId && job\.n8nExecutionId !== parsed\.data\.n8nExecutionId/);
 assert.match(callback,/job\.status !== "waiting_external" \|\| \(job\.stage !== "n8n-dispatching" && job\.stage !== "n8n-received"\)/);
 assert.match(callback,/expectedVersion:job\.rowVersion/);
 assert.match(callback,/clusterCount: z\.number\(\)\.int\(\)\.min\(1\)\.max\(8\)/);
 assert.match(callback,/providerWrites: z\.literal\(false\)/);
 assert.match(callback,/status:"completed",stage:"seo.uat.synthetic-verified"/);
 assert.doesNotMatch(callback,/publishArticle|SANITY_API_WRITE_TOKEN|customerName|customerEmail/);
 assert.match(moduleFile,/createHmac\("sha256"/);
 assert.match(moduleFile,/timingSafeEqual/);
 assert.match(moduleFile,/CALLBACK_TTL_SECONDS = 600/);
});
