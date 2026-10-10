import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
const read=(name:string)=>readFileSync(new URL("../../"+name,import.meta.url),"utf8");

test("Owner Export P1 UAT uses owner gate, synthetic-only payload, verified receipt and idempotency",()=>{
 const r=read("apps/admin/app/api/admin/n8n/p1/export/route.ts");
 const ui=read("features/admin/components/UatOwnerExportCanary.tsx");
 const page=read("apps/admin/app/(control-plane)/analytics/exports/page.tsx");
 assert.match(r,/identity\.role!=="owner"/);
 assert.match(r,/isPostPublishAdminOriginAllowed/);
 assert.match(r,/resolveUatFabricConfig/);
 assert.match(r,/uat-synthetic-export/);
 assert.match(r,/idempotency-key-required/);
 assert.match(r,/idempotency_conflict/);
 assert.match(r,/job\.outcome==="duplicate"/);
 assert.match(r,/status:"reconciliation_required"/);
 assert.match(r,/receipt\.safeParse/);
 assert.match(r,/status:"completed",stage:"uat-synthetic-sheet-written"/);
 assert.match(r,/spreadsheetId:z\.literal\(UAT_SHEET_ID\)/);
 assert.match(r,/providerWrites:z\.literal\(1\)/);
 assert.match(page,/getAdminEnvironment\(\) === "admin-uat" && identity\?\.role === "owner"/);
 assert.match(page,/enabled=\{resolveUatFabricConfig\(process\.env\)\.ready\}/);
 assert.match(ui,/crypto\.randomUUID/);
 assert.match(ui,/idempotency-key/);
 assert.doesNotMatch(r,/customerId|customerName|contactEmail|rawBody|publishArticle|production-admin"\)/);
});

test("Owner Export UAT input and contract stay strictly synthetic",()=>{
 const body={action:"uat-synthetic-export"};
 assert.deepEqual(Object.keys(body),["action"]);
 const source=read("apps/admin/app/api/admin/n8n/p1/export/route.ts");
 assert.match(source,/z\.object\(\{action:z\.literal\("uat-synthetic-export"\)\}\)\.strict\(\)/);
 assert.match(source,/const webhook=new URL\(config\.endpoint\)/);
});
