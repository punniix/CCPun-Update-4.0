import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"../..");
const read=(file:string)=>readFileSync(path.join(root,file),"utf8");
const checksum="ce3a55a27969b4effecb70af0bc8f5e4de4f9dc023fbd32fc91ded69a08005f8";

function body(sql:string){return sql.split("-- checksum-source-begin\n",2)[1]?.split("-- checksum-source-end",1)[0]??"";}
function normalized(sql:string){return sql
  .replaceAll("20260918_line_content_intelligence_v2_uat","PREVIOUS")
  .replaceAll("20260918_line_content_intelligence_v2_production","PREVIOUS")
  .replaceAll("20260918_line_privacy_retention_v2_uat","THIS")
  .replaceAll("20260918_line_privacy_retention_v2_production","THIS")
  .replaceAll("young-term-47483330","PROJECT").replaceAll("lively-bar-43618798","PROJECT")
  .replaceAll("br-crimson-mouse-az7ajkv8","BRANCH").replaceAll("br-long-resonance-b3ys5xrv","BRANCH")
  .replaceAll("ep-mute-frost-aztvz394","ENDPOINT").replaceAll("ep-broad-butterfly-b3ro7u8w","ENDPOINT")
  .replaceAll("20260917_private_line_runtime_v1_uat","BASE").replaceAll("20260917_private_line_runtime_v1_production","BASE");
}

test("Privacy/Retention v2 migrations are checksum parity locked",()=>{
  const u=read("db/migrations/20260918_line_privacy_retention_v2_uat.sql");
  const p=read("db/migrations/20260918_line_privacy_retention_v2_production.sql");
  assert.equal(normalized(u),normalized(p));
  assert.equal(body(u),body(p));
  assert.equal(createHash("sha256").update(body(u)).digest("hex"),checksum);
  assert.match(u,new RegExp(`sha256:${checksum}`));
  assert.match(p,new RegExp(`sha256:${checksum}`));
});

test("retention remains manual-review only with nullable review thresholds and no invented legal period",()=>{
  const sql=read("db/migrations/20260918_line_privacy_retention_v2_production.sql");
  assert.match(sql,/policy_mode='manual_review'/);
  assert.match(sql,/automatic_delete_enabled=false/);
  assert.match(sql,/conversation_review_after_days integer/);
  assert.match(sql,/document_review_after_days integer/);
  assert.match(sql,/audit_review_after_days integer/);
  assert.match(sql,/attachment_unsend_action='revoke_then_delete'/);
  assert.doesNotMatch(sql,/automatic_delete_enabled=true|pg_cron|cron\.schedule|DELETE FROM private_line\.(?:customer|lead|message|document)/i);
  assert.doesNotMatch(sql,/DEFAULT\s+(?:30|60|90|180|365)\b.*review_after_days/i);
});

test("retention mutation requires actor digest and cannot enable automatic delete",()=>{
  const sql=read("db/migrations/20260918_line_privacy_retention_v2_production.sql");
  const fn=sql.match(/CREATE OR REPLACE FUNCTION private_line\.admin_update_retention_policy[\s\S]*?\$admin_update_retention_policy\$;/);
  assert.ok(fn);
  assert.match(fn[0],/actor_digest/);
  assert.match(fn[0],/safe_hex_digest\(v_actor\)/);
  assert.match(fn[0],/v_auto<>false/);
  assert.match(fn[0],/v_mode<>'manual_review'/);
  assert.match(fn[0],/v_attachment_action<>'revoke_then_delete'/);
});

test("export preparation creates counts-only manifest and never materializes raw payload",()=>{
  const sql=read("db/migrations/20260918_line_privacy_retention_v2_production.sql");
  const table=sql.match(/CREATE TABLE IF NOT EXISTS private_line\.privacy_export_manifest[\s\S]*?\n\);/);
  const fn=sql.match(/CREATE OR REPLACE FUNCTION private_line\.admin_prepare_privacy_export[\s\S]*?\$admin_prepare_privacy_export\$;/);
  assert.ok(table&&fn);
  assert.match(table[0],/raw_payload_materialized boolean NOT NULL DEFAULT false CHECK \(raw_payload_materialized=false\)/);
  assert.doesNotMatch(table[0],/cipher|nonce|auth_tag|message_text|document_body|external_file|external_folder|line_user|phone|email|name/i);
  assert.match(fn[0],/raw_payload_materialized=false/);
  assert.doesNotMatch(fn[0],/content_ciphertext|external_ref_ciphertext|provider_message_ciphertext|SELECT \* FROM private_line\.message/i);
});

test("delete preparation writes content-free tombstone and attachment cleanup count but never executes delete",()=>{
  const sql=read("db/migrations/20260918_line_privacy_retention_v2_production.sql");
  const table=sql.match(/CREATE TABLE IF NOT EXISTS private_line\.privacy_delete_audit_tombstone[\s\S]*?\n\);/);
  const fn=sql.match(/CREATE OR REPLACE FUNCTION private_line\.admin_prepare_privacy_delete[\s\S]*?\$admin_prepare_privacy_delete\$;/);
  assert.ok(table&&fn);
  assert.match(table[0],/content_included boolean NOT NULL DEFAULT false CHECK \(content_included=false\)/);
  assert.match(table[0],/attachment_cleanup_required_count bigint/);
  assert.match(fn[0],/document_storage_object/);
  assert.match(fn[0],/status NOT IN \('revoked','deleted'\)/);
  assert.match(fn[0],/content_included=false/);
  assert.match(fn[0],/false;/);
  assert.doesNotMatch(fn[0],/DELETE\s+FROM|TRUNCATE|DROP\s+TABLE/i);
});

test("privacy safety health exposes meta/aggregate evidence only",()=>{
  const sql=read("db/migrations/20260918_line_privacy_retention_v2_production.sql");
  const fn=sql.match(/CREATE OR REPLACE FUNCTION private_line\.admin_read_privacy_safety_health[\s\S]*?\$admin_read_privacy_safety_health\$;/);
  assert.ok(fn);
  assert.match(fn[0],/external_verification_required/);
  assert.match(fn[0],/aggregate_status_available/);
  assert.match(fn[0],/destructive_execution_available boolean/);
  assert.doesNotMatch(fn[0],/customer_id|lead_id|message_id|document_id|cipher|nonce|auth_tag|external_ref|phone|email|name/i);
});

test("privacy v2 tables remain function-only and hidden from ingress/PUBLIC",()=>{
  const sql=read("db/migrations/20260918_line_privacy_retention_v2_production.sql");
  for(const table of ["privacy_export_manifest","privacy_delete_audit_tombstone"]){
    assert.match(sql,new RegExp(`REVOKE ALL PRIVILEGES ON TABLE private_line\\.${table} FROM ccpun_admin_runtime`));
    assert.match(sql,new RegExp(`REVOKE ALL PRIVILEGES ON TABLE private_line\\.${table} FROM ccpun_line_ingress`));
  }
  for(const fn of ["admin_update_retention_policy","admin_prepare_privacy_export","admin_prepare_privacy_delete","admin_read_privacy_safety_health"]){
    assert.match(sql,new RegExp(`REVOKE ALL ON FUNCTION private_line\\.${fn}`));
    assert.match(sql,new RegExp(`FROM ccpun_line_ingress`));
  }
});

test("privacy UI exposes preparation and review policy but no irreversible execute control",()=>{
  const page=read("apps/admin/app/(control-plane)/operations/privacy/page.tsx");
  const ui=read("features/admin/line/PrivacyRequestManager.tsx");
  const retentionRoute=read("apps/admin/app/api/admin/line/privacy/retention/route.ts");
  const prepareRoute=read("apps/admin/app/api/admin/line/privacy/[requestId]/prepare/route.ts");
  assert.match(page,/RetentionPolicyEditor/);
  assert.match(page,/ยังไม่มีข้อมูลดิบถูกส่งออกจากหน้านี้/);
  assert.match(page,/การลบข้อมูลจริงต้องยืนยันแยกต่างหาก/);
  assert.match(ui,/เตรียมรายการสำหรับสำเนาข้อมูลแล้ว/);
  assert.match(ui,/เตรียมรายการที่จะต้องจัดการแล้ว · ยังไม่มีข้อมูลถูกลบ/);
  assert.match(ui,/การลบจริงต้องยืนยันแยกอีกครั้ง/);
  assert.doesNotMatch(page+ui,/raw payload materialization: blocked|Delete execution ไม่ได้เปิดจาก UI นี้|export manifest prepared|delete tombstone prepared|destructive execution: blocked/);
  assert.match(retentionRoute,/identity\.role !== "owner"/);
  assert.match(retentionRoute,/isSameOriginAdminMutation/);
  assert.match(prepareRoute,/isSameOriginAdminMutation/);
  assert.doesNotMatch(page+ui+retentionRoute,/executeDelete|deleteCustomer|purgeCustomer|transition\("executed"\)/);
});

test("privacy service routes prepare through type-specific manifest/tombstone functions",()=>{
  const service=read("lib/admin/line/business-intelligence.ts");
  assert.match(service,/admin_prepare_privacy_export/);
  assert.match(service,/admin_prepare_privacy_delete/);
  assert.match(service,/rawPayloadMaterialized/);
  assert.match(service,/attachmentCleanupRequired/);
  assert.match(service,/admin_read_privacy_safety_health/);
  assert.match(service,/admin_update_retention_policy/);
});

test("synthetic UAT journey E2E is rollback-only and proves the full business path",()=>{
  const sql=read("db/migrations/20260918_line_journey_e2e_uat_readback.sql");
  assert.match(sql,/^BEGIN;/);
  assert.match(sql,/ROLLBACK;\s*$/);
  assert.match(sql,/record_safe_web_journey_event/);
  assert.match(sql,/ingest_line_event/);
  assert.match(sql,/admin_bind_lead_attribution/);
  assert.match(sql,/admin_update_lead_stage/);
  assert.match(sql,/admin_record_implementation/);
  assert.match(sql,/admin_attribute_revenue/);
  assert.match(sql,/admin_read_content_intelligence_v2/);
  assert.match(sql,/small_group_revenue_suppressed_ok/);
  assert.match(sql,/attachment_lifecycle_created_ok/);
  assert.doesNotMatch(sql,/lively-bar-43618798|br-long-resonance|_production|COMMIT;/);
});
