import assert from "node:assert/strict";
import test from "node:test";
import {resolveUatFabricConfig} from "../../lib/admin/n8n/uat-fabric-policy";
const base={CCPUN_APP_ENV:"admin-uat",CCPUN_N8N_P1_UAT_ENABLED:"true",CCPUN_N8N_P1_UAT_TOKEN:"a".repeat(64),CCPUN_N8N_P1_UAT_WEBHOOK_URL:"https://n8n.srv908107.hstgr.cloud/webhook/ccpun-p1-uat-seo-clustering"};
test("P1 fabric cannot cross UAT and Production boundaries",()=>{
 assert.equal(resolveUatFabricConfig(base).ready,true);
 assert.equal(resolveUatFabricConfig({...base,CCPUN_APP_ENV:"production-admin"}).ready,false);
 assert.equal(resolveUatFabricConfig({...base,CCPUN_N8N_P1_UAT_ENABLED:"false"}).ready,false);
 assert.equal(resolveUatFabricConfig({...base,CCPUN_N8N_P1_UAT_WEBHOOK_URL:"https://admin.ccpun.com/api/internal/local-ai/jobs/"}).ready,false);
 assert.equal(resolveUatFabricConfig({...base,CCPUN_N8N_P1_UAT_WEBHOOK_URL:"https://n8n.srv908107.hstgr.cloud/webhook/ccpun-p1-uat-seo-clustering?token=unsafe"}).ready,false);
 assert.equal(resolveUatFabricConfig({...base,CCPUN_N8N_P1_UAT_TOKEN:"short"}).ready,false);
});
