import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read=(path:string)=>readFileSync(new URL("../../"+path,import.meta.url),"utf8");
test("P1 SEO pilot UI is UAT-only, owner-only and fail-closed",()=>{
 const page=read("apps/admin/app/(control-plane)/seo/page.tsx");
 const client=read("features/admin/components/UatSeoN8nCanary.tsx");
 assert.match(page,/getAdminEnvironment\(\) === "admin-uat" && identity\?\.role === "owner"/);
 assert.match(page,/enabled=\{resolveUatFabricConfig\(process\.env\)\.ready\}/);
 assert.match(client,/disabled=\{!enabled \|\| busy\}/);
 assert.match(client,/"idempotency-key": idempotencyKey\.current/);
 assert.match(client,/crypto\.randomUUID\(\)/);
 assert.match(client,/receipt\.status === "duplicate"/);
 assert.match(client,/ยังไม่ใช่งานเสร็จ/);
 assert.doesNotMatch(client,/\/api\/admin\/seo\/suggestions\/|publishArticle|customerId|rawTranscript/);
});
