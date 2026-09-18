import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const sourceBody = (sql: string) => sql.split("-- checksum-source-begin\n", 2)[1]?.split("\n-- checksum-source-end", 1)[0] ?? "";

const CHECKSUM = "15d047b231bd18214f5e47ce4382033e5cd7786811006e3dfa217d0db32f8fef";

test("Conversation Archive migration is UAT/Production parity and checksum locked", () => {
  const uat = read("db/migrations/20260918_line_conversation_archive_v1_uat.sql");
  const production = read("db/migrations/20260918_line_conversation_archive_v1_production.sql");
  const uatBody = sourceBody(uat);
  const productionBody = sourceBody(production);
  assert.equal(uatBody, productionBody);
  assert.equal(createHash("sha256").update(uatBody).digest("hex"), CHECKSUM);
  assert.match(uat, new RegExp(`sha256:${CHECKSUM}`));
  assert.match(production, new RegExp(`sha256:${CHECKSUM}`));
});

test("inbound archive snapshots encrypted content before operational Unsend purge", () => {
  const sql = sourceBody(read("db/migrations/20260918_line_conversation_archive_v1_production.sql"));
  assert.match(sql, /CREATE TABLE IF NOT EXISTS private_line\.line_conversation_archive/);
  assert.match(sql, /AFTER INSERT OR UPDATE OF status,unsent_at ON private_line\.message/);
  assert.match(sql, /NEW\.content_ciphertext_b64/);
  assert.match(sql, /IF TG_OP='UPDATE' AND NEW\.status='unsent'/);
  const unsendBranch = sql.split("IF TG_OP='UPDATE' AND NEW.status='unsent' THEN", 2)[1]?.split("END IF;", 1)[0] ?? "";
  assert.match(unsendBranch, /SET status='unsent'/);
  assert.doesNotMatch(unsendBranch, /content_ciphertext_b64\s*=\s*NULL|content_nonce_b64\s*=\s*NULL|content_auth_tag_b64\s*=\s*NULL/);
  assert.match(sql, /admin_read_line_transcript/);
  assert.match(sql, /FROM private_line\.line_conversation_archive a/);
});

test("archive stays private and direct Admin reply capability is revoked in DB", () => {
  const sql = sourceBody(read("db/migrations/20260918_line_conversation_archive_v1_production.sql"));
  for (const table of ["line_conversation_archive", "line_profile_private", "line_evidence_access_log"]) {
    assert.match(sql, new RegExp(`REVOKE ALL ON TABLE private_line\\.${table} FROM PUBLIC,ccpun_line_ingress,ccpun_admin_runtime`));
  }
  assert.match(sql, /REVOKE ALL ON FUNCTION private_line\.admin_enqueue_line_reply\(jsonb\) FROM ccpun_admin_runtime/);
  assert.match(sql, /REVOKE ALL ON FUNCTION private_line\.admin_claim_line_outbound\(jsonb\) FROM ccpun_admin_runtime/);
  assert.match(sql, /direct_admin_reply_enabled boolean/);
  assert.match(sql, /SELECT[\s\S]*false\n\$admin_read_line_archive_health\$/);
  assert.doesNotMatch(sql, /GRANT (?:SELECT|INSERT|UPDATE|DELETE) ON (?:TABLE )?private_line\.line_conversation_archive TO ccpun_admin_runtime/i);
});

test("Admin reply UI and endpoint are retired in favor of LINE OA Manager", () => {
  const actions = read("features/admin/line/LineCaseActions.tsx");
  const route = read("apps/admin/app/api/admin/line/inbox/[leadId]/reply/route.ts");
  const control = read("lib/admin/line/control-plane.ts");
  assert.match(actions, /ตอบลูกค้าผ่าน LINE OA Manager/);
  assert.doesNotMatch(actions, /textarea|ส่งผ่าน LINE|sendReply|\/reply\//);
  assert.match(route, /admin-reply-retired-use-line-oa-manager/);
  assert.match(route, /status:\s*410/);
  assert.doesNotMatch(route, /enqueueLineAdminReply|sendLineOutboundById/);
  assert.match(control, /outboundEnabled:\s*false/);
  assert.match(control, /replyEnabled:\s*false/);
});

test("LINE private profile uses server-only profile API and encrypted cache", () => {
  const service = read("lib/admin/line/conversation-archive.ts");
  const migration = sourceBody(read("db/migrations/20260918_line_conversation_archive_v1_production.sql"));
  assert.match(service, /https:\/\/api\.line\.me\/v2\/bot\/profile/);
  assert.match(service, /Authorization:\s*`Bearer \$\{token\}`/);
  assert.match(service, /crypto\.decrypt\(idEncrypted, "line-user-id"\)/);
  assert.match(service, /line-profile-display-name/);
  assert.match(service, /line-profile-picture-url/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS private_line\.line_profile_private/);
  assert.match(migration, /display_name_ciphertext_b64/);
  assert.doesNotMatch(service, /console\.(?:log|info|warn|error|debug)/);
});

test("Inbox renders LINE display name owner-side with internal reference fallback", () => {
  const list = read("apps/admin/app/(control-plane)/dashboard/inbox/page.tsx");
  const detail = read("apps/admin/app/(control-plane)/dashboard/inbox/[leadId]/page.tsx");
  assert.match(list, /getLinePrivateProfiles/);
  assert.match(list, /privateProfiles\.get\(item\.leadId\)\?\.displayName/);
  assert.match(detail, /getLinePrivateProfile/);
  assert.match(detail, /customerName/);
  assert.match(detail, /Internal ref/);
  for (const forbidden of ["external_ref_ciphertext", "lineUserId", "providerMessageId"]) {
    assert.doesNotMatch(list + detail, new RegExp(forbidden, "i"));
  }
});

test("LINE OA CSV import is owner-only, bounded, encrypted and outbound-only", () => {
  const route = read("apps/admin/app/api/admin/line/inbox/[leadId]/history-import/route.ts");
  const service = read("lib/admin/line/conversation-archive.ts");
  const migration = sourceBody(read("db/migrations/20260918_line_conversation_archive_v1_production.sql"));
  assert.match(route, /isSameOriginAdminMutation/);
  assert.match(route, /identity\.role !== "owner"/);
  assert.match(route, /MAX_CSV_BYTES = 5 \* 1024 \* 1024/);
  assert.match(route, /advisor:case:update/);
  assert.match(service, /rows\.slice\(1, 5001\)/);
  assert.match(service, /if \(\(row\[senderIndex\] \?\? ""\)\.trim\(\)\.toLowerCase\(\) !== label\)/);
  assert.match(service, /crypto\.encrypt\(text, "line-oa-import-content"\)/);
  assert.match(migration, /'line_oa_csv',v_digest,'outbound','text','imported'/);
  assert.doesNotMatch(route + service, /console\.(?:log|info|warn|error|debug)/);
});

test("Evidence view marks Unsend, fingerprints records, supports print and audits access", () => {
  const page = read("apps/admin/app/(control-plane)/dashboard/inbox/[leadId]/evidence/page.tsx");
  const button = read("features/admin/line/EvidencePrintButton.tsx");
  const auditRoute = read("apps/admin/app/api/admin/line/inbox/[leadId]/evidence/audit/route.ts");
  const service = read("lib/admin/line/conversation-archive.ts");
  assert.match(page, /OWNER-ONLY EVIDENCE VIEW/);
  assert.match(page, /ลูกค้า Unsend/);
  assert.match(page, /SHA-256/);
  assert.match(page, /ไม่ใช่การรับรองทางกฎหมายจากบุคคลภายนอก/);
  assert.match(button, /window\.print\(\)/);
  assert.match(auditRoute, /advisor:read/);
  assert.match(auditRoute, /isSameOriginAdminMutation/);
  assert.match(service, /ccpun-line-evidence-v1/);
  assert.match(service, /admin_record_line_evidence_access/);
});

test("Conversation Archive readbacks require read-only mode and least privilege", () => {
  for (const lane of ["uat", "production"]) {
    const rb = read(`db/migrations/20260918_line_conversation_archive_v1_${lane}_readback.sql`);
    assert.match(rb, /direct_reply_revoked/);
    assert.match(rb, /direct_outbound_claim_revoked/);
    assert.match(rb, /admin_archive_table_direct_denied/);
    assert.match(rb, /evidence_trigger_never_purges_archive_content/);
    assert.match(rb, /archive_read_only_mode/);
    assert.match(rb, new RegExp(`sha256:${CHECKSUM}`));
  }
});
