import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
const route=readFileSync(new URL("../../apps/admin/app/api/internal/n8n/p1/seo/callback/route.ts",import.meta.url),"utf8");
test("P1 SEO callback is UAT-only, credentialed, metadata-only and revision-bound",()=>{
 assert.match(route,/getAdminEnvironment\(\) !== "admin-uat"/);
 assert.match(route,/CCPUN_N8N_P1_UAT_ENABLED !== "true"/);
 assert.match(route,/isN8nAgentOsRequestAuthorized/);
 assert.match(route,/workflowKey: z\.literal\("seo\.cluster\.uat"\)/);
 assert.match(route,/providerWrites: z\.literal\(false\)/);
 assert.match(route,/job\.workflowKey !== parsed\.data\.workflowKey/);
 assert.match(route,/job\.correlationId !== parsed\.data\.correlationId/);
 assert.match(route,/job\.n8nExecutionId !== parsed\.data\.n8nExecutionId/);
 assert.match(route,/expectedVersion:job\.rowVersion/);
 assert.match(route,/job\.status !== "waiting_external"/);
 assert.match(route,/stale-callback/);
 assert.doesNotMatch(route,/SANITY_API_WRITE_TOKEN|publishArticle|customerName|rawMessage|transcript|CRM_MUTATE|approveSuggestion/);
});
