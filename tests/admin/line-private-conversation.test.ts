import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  LINE_CASE_STAGES,
  LINE_QUICK_REPLIES,
  LINE_RICH_MENU_ITEMS,
  canTransitionLineCaseStage,
  parseLineJourneyIntent,
  routeLineBot,
} from "../../lib/line/ecosystem";
import { createLineContentCrypto } from "../../lib/line/private-crypto";
import { hasAdminPermission } from "../../lib/admin/rbac";

const root = path.resolve(import.meta.dirname, "../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const expectedChecksum = "d208639906275865acb686cb0d0039e14a9feb3dcd7a2156702f45b061c34344";

function sourceBody(sql: string) {
  return sql.split("-- checksum-source-begin\n", 2)[1]?.split("-- checksum-source-end", 1)[0] ?? "";
}

function normalized(sql: string) {
  return sql
    .replaceAll("20260917_private_line_runtime_v1_uat", "BASE_RUNTIME")
    .replaceAll("20260917_private_line_runtime_v1_production", "BASE_RUNTIME")
    .replaceAll("sha256:19a7dfaf26d2cc4f6cbf01d7ff2380056383f8e87dd079a6e141e73b878985d3", "sha256:BASE")
    .replaceAll("sha256:f562ba174f50cf617d0e12ffd13c46e5815b069dc823ecb7c8522d7b05d6c57b", "sha256:BASE")
    .replaceAll("20260918_line_advisor_inbox_v1_uat", "ADVISOR_BASE")
    .replaceAll("20260918_line_advisor_inbox_v1_production", "ADVISOR_BASE")
    .replaceAll("20260918_line_private_conversation_v1_uat", "THIS_MIGRATION")
    .replaceAll("20260918_line_private_conversation_v1_production", "THIS_MIGRATION")
    .replaceAll("young-term-47483330", "PROJECT")
    .replaceAll("lively-bar-43618798", "PROJECT")
    .replaceAll("br-crimson-mouse-az7ajkv8", "BRANCH")
    .replaceAll("br-long-resonance-b3ys5xrv", "BRANCH")
    .replaceAll("ep-mute-frost-aztvz394", "ENDPOINT")
    .replaceAll("ep-broad-butterfly-b3ro7u8w", "ENDPOINT");
}

test("UAT and Production private conversation migrations are parity-locked", () => {
  const uat = read("db/migrations/20260918_line_private_conversation_v1_uat.sql");
  const prod = read("db/migrations/20260918_line_private_conversation_v1_production.sql");
  assert.equal(normalized(uat), normalized(prod));
  assert.equal(sourceBody(uat), sourceBody(prod));
  assert.equal(createHash("sha256").update(sourceBody(uat)).digest("hex"), expectedChecksum);
  assert.match(uat, new RegExp(`sha256:${expectedChecksum}`));
  assert.match(prod, new RegExp(`sha256:${expectedChecksum}`));
});

test("migration preserves ingestion system identity and least privilege", () => {
  const sql = read("db/migrations/20260918_line_private_conversation_v1_production.sql");
  assert.doesNotMatch(sourceBody(sql), /INSERT INTO private_line\.system_identity|UPDATE private_line\.system_identity|DELETE FROM private_line\.system_identity/);
  assert.match(sql, /base system identity changed/);
  assert.match(sql, /REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA private_line FROM ccpun_admin_runtime/);
  assert.match(sql, /GRANT SELECT ON TABLE private_line\.advisor_inbox_safe TO ccpun_admin_runtime/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION private_line\.admin_read_line_transcript\(uuid, integer\) TO ccpun_admin_runtime/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION private_line\.ingest_line_event\(jsonb\) TO ccpun_line_ingress/);
  assert.doesNotMatch(sql, /GRANT (?:SELECT|INSERT|UPDATE|DELETE) ON (?:TABLE )?private_line\.(?:customer|provider_identity|conversation|message|document|lead|advisor_case|outbound_message)(?:\s|;|,)/);
});

test("transcript function purges unsent content and hides provider identity", () => {
  const sql = read("db/migrations/20260918_line_private_conversation_v1_production.sql");
  const match = sql.match(/CREATE OR REPLACE FUNCTION private_line\.admin_read_line_transcript[\s\S]*?\$admin_read_line_transcript\$;/);
  assert.ok(match);
  assert.match(match[0], /CASE WHEN m\.status = 'unsent' THEN NULL ELSE m\.content_ciphertext_b64 END/);
  assert.doesNotMatch(match[0], /external_ref_|provider_message_ciphertext|provider_message_digest/);
  assert.match(match[0], /admin-outbound-message-content/);
});

test("outbound queue uses durable lease, checkpoint and idempotency controls", () => {
  const sql = read("db/migrations/20260918_line_private_conversation_v1_production.sql");
  assert.match(sql, /idempotency_digest text NOT NULL UNIQUE/);
  assert.match(sql, /lease_owner_digest/);
  assert.match(sql, /lease_expires_at/);
  assert.match(sql, /attempt_count integer NOT NULL DEFAULT 0/);
  assert.match(sql, /reconciliation_required/);
  assert.match(sql, /FOR UPDATE SKIP LOCKED/);
  assert.match(sql, /ON CONFLICT \(idempotency_digest\) DO NOTHING/);
});

test("lead stage graph is deterministic and terminal stages stay terminal", () => {
  assert.deepEqual(LINE_CASE_STAGES, ["New", "Qualified", "Expert Review", "Solution", "Quote", "Implementation", "Won", "Lost"]);
  assert.equal(canTransitionLineCaseStage("New", "Qualified"), true);
  assert.equal(canTransitionLineCaseStage("New", "Quote"), false);
  assert.equal(canTransitionLineCaseStage("Expert Review", "Solution"), true);
  assert.equal(canTransitionLineCaseStage("Expert Review", "Quote"), true);
  assert.equal(canTransitionLineCaseStage("Implementation", "Won"), true);
  assert.equal(canTransitionLineCaseStage("Won", "New"), false);
  assert.equal(canTransitionLineCaseStage("Lost", "Qualified"), false);
});

test("bot always hands off personalized, suitability, recommendation, quote and unknown knowledge", () => {
  const base = {
    approvedAnswerAvailable: true,
    approvedContentAvailable: true,
    approvedToolAvailable: true,
    qualificationNeeded: false,
    personalized: false,
    suitabilityRequired: false,
    recommendationRequired: false,
    quoteRequired: false,
    explicitHumanRequest: false,
  };
  assert.equal(routeLineBot({ ...base, personalized: true }), "human_handoff");
  assert.equal(routeLineBot({ ...base, suitabilityRequired: true }), "human_handoff");
  assert.equal(routeLineBot({ ...base, recommendationRequired: true }), "human_handoff");
  assert.equal(routeLineBot({ ...base, quoteRequired: true }), "human_handoff");
  assert.equal(routeLineBot({ ...base, explicitHumanRequest: true }), "human_handoff");
  assert.equal(routeLineBot({ ...base, approvedAnswerAvailable: false, approvedContentAvailable: false, approvedToolAvailable: false }), "human_handoff");
  assert.equal(routeLineBot({ ...base, qualificationNeeded: true }), "qualify");
  assert.equal(routeLineBot(base), "approved_answer");
});

test("Rich Menu and Quick Reply contracts contain only the locked discovery journeys", () => {
  assert.deepEqual(LINE_RICH_MENU_ITEMS.map((item) => item.label), ["หาเรื่องอ่าน", "เครื่องมือ", "ประกัน", "ลงทุน", "รถ", "คุยกับปัน"]);
  assert.ok(LINE_QUICK_REPLIES.some((item) => item.journey === "motor_quote_review"));
  assert.ok(LINE_QUICK_REPLIES.some((item) => item.journey === "life_health_policy_review"));
  assert.ok(LINE_QUICK_REPLIES.some((item) => item.journey === "investment_before_you_act"));
  assert.doesNotMatch(JSON.stringify({ LINE_RICH_MENU_ITEMS, LINE_QUICK_REPLIES }), /access_token|channel_secret|line_user_id/i);
});

test("website journey intent rejects customer-confidential keys", () => {
  assert.ok(parseLineJourneyIntent({ journey: "motor_quote_review", entrypoint: "blog_cta", content_id: "motor_5_10y", attribution: { utm_source: "google" } }));
  assert.equal(parseLineJourneyIntent({ journey: "motor_quote_review", entrypoint: "blog_cta", phone: "0812345678" }), null);
  assert.equal(parseLineJourneyIntent({ journey: "investment_before_you_act", entrypoint: "tool", income: "90000" }), null);
});

test("content crypto can be provisioned without the identity HMAC key", () => {
  const key = Buffer.alloc(32, 7).toString("base64");
  const crypto = createLineContentCrypto({ CCPUN_LINE_ENCRYPTION_KEY_V1: key });
  const encrypted = crypto.encrypt("synthetic-private-text", "message-content");
  assert.equal(crypto.decrypt(encrypted, "message-content"), "synthetic-private-text");
  assert.throws(() => createLineContentCrypto({ CCPUN_LINE_ENCRYPTION_KEY_V1: "invalid" }), /LINE_PRIVATE_CRYPTO_UNAVAILABLE/);
});

test("Advisor permissions remain owner-only", () => {
  for (const permission of ["advisor:read", "advisor:reply", "advisor:case:update"] as const) {
    assert.equal(hasAdminPermission("owner", permission), true);
    assert.equal(hasAdminPermission("editor", permission), false);
    assert.equal(hasAdminPermission("viewer", permission), false);
  }
});

test("Admin reply API is retired while stage mutation remains owner-only", () => {
  const reply = read("apps/admin/app/api/admin/line/inbox/[leadId]/reply/route.ts");
  const stage = read("apps/admin/app/api/admin/line/inbox/[leadId]/stage/route.ts");
  assert.match(reply, /isSameOriginAdminMutation/);
  assert.match(reply, /advisor:reply/);
  assert.match(reply, /admin-reply-retired-use-line-oa-manager/);
  assert.match(reply, /status:\s*410/);
  assert.doesNotMatch(reply, /enqueueLineAdminReply|sendLineOutboundById|LINE_CHANNEL_ACCESS_TOKEN/);
  assert.match(stage, /isSameOriginAdminMutation/);
  assert.match(stage, /advisor:case:update/);
  assert.match(stage, /invalid-stage-transition/);
});

test("provider adapter is hard-gated and never places token in URL or logs", () => {
  const source = read("lib/admin/line/provider.ts");
  assert.match(source, /https:\/\/api\.line\.me\/v2\/bot\/message\/push/);
  assert.match(source, /Authorization.*Bearer/);
  assert.match(source, /X-Line-Retry-Key/);
  assert.match(source, /reconciliation_required/);
  assert.match(source, /AbortSignal\.timeout\(7_000\)/);
  assert.doesNotMatch(source, /console\.|\?access_token|token=/);
});

test("detail UI never renders provider IDs, ciphertext or document bytes", () => {
  const page = read("apps/admin/app/(control-plane)/dashboard/inbox/[leadId]/page.tsx");
  for (const forbidden of ["lineUserId", "providerMessage", "ciphertextB64", "nonceB64", "authTagB64", "externalFileId", "documentBytes"]) {
    assert.doesNotMatch(page, new RegExp(forbidden, "i"));
  }
  assert.match(page, /ลูกค้ายกเลิกข้อความนี้/);
  assert.match(page, /รายละเอียดระบบ/);
  assert.doesNotMatch(page, /OWNER-ONLY|Evidence archive|ส่งผ่าน LINE|พิมพ์ข้อความถึงลูกค้า/);
});


test("security patch revokes PUBLIC function execution and keeps lane parity", () => {
  const uat = read("db/migrations/20260918_line_private_conversation_security_v1_uat.sql");
  const production = read("db/migrations/20260918_line_private_conversation_security_v1_production.sql");
  const bodyUat = sourceBody(uat);
  const bodyProduction = sourceBody(production);
  assert.equal(bodyUat, bodyProduction);
  assert.equal(createHash("sha256").update(bodyUat).digest("hex"), "be2942e075f2beaca66619c72e2b28684c82ce1c950fa7bd9ba5bcda8049c534");
  for (const fn of [
    "admin_read_line_transcript(uuid,integer)",
    "admin_enqueue_line_reply(jsonb)",
    "admin_claim_line_outbound(jsonb)",
    "admin_checkpoint_line_outbound(jsonb)",
    "admin_update_lead_stage(jsonb)",
  ]) {
    assert.match(bodyUat, new RegExp(`REVOKE ALL ON FUNCTION private_line\\.${fn.replace(/[()[\]]/g, "\\$&")} FROM PUBLIC`));
  }
  assert.match(bodyUat, /REVOKE ALL ON FUNCTION private_line\.record_safe_web_journey_event\(jsonb\) FROM ccpun_admin_runtime/);
});

test("context compatibility migration restores the Phase 3A view and isolates safe lead context", () => {
  const uat = read("db/migrations/20260918_line_private_context_compat_v1_uat.sql");
  const production = read("db/migrations/20260918_line_private_context_compat_v1_production.sql");
  const bodyUat = sourceBody(uat);
  const bodyProduction = sourceBody(production);
  assert.equal(bodyUat, bodyProduction);
  assert.equal(createHash("sha256").update(bodyUat).digest("hex"), "83c0b6c89014bd11cf3e1aa51d4b7ce0233bfce62b33d594a397514c02e832a0");
  assert.match(bodyUat, /DROP VIEW private_line\.advisor_inbox_safe/);
  assert.match(bodyUat, /CREATE VIEW private_line\.advisor_inbox_safe AS/);
  assert.match(bodyUat, /CREATE OR REPLACE VIEW private_line\.lead_context_safe AS/);
  assert.match(bodyUat, /REVOKE ALL ON TABLE private_line\.lead_context_safe FROM ccpun_line_ingress/);
  assert.match(bodyUat, /GRANT SELECT ON TABLE private_line\.lead_context_safe TO ccpun_admin_runtime/);
  assert.doesNotMatch(bodyUat, /external_ref|ciphertext|nonce|auth_tag|phone|email|health|medical|income|debt/);
});

test("inbox reader migration keeps UAT/Production parity and hides base-table access behind one safe function", () => {
  const uat = read("db/migrations/20260918_line_private_inbox_reader_v1_uat.sql");
  const production = read("db/migrations/20260918_line_private_inbox_reader_v1_production.sql");
  const bodyUat = sourceBody(uat);
  const bodyProduction = sourceBody(production);
  assert.equal(bodyUat, bodyProduction);
  assert.equal(createHash("sha256").update(bodyUat).digest("hex"), "48d5ebc7084f38f6a4e9bdb5ff4f72b1a7ba9bfc42f8356f6fbfd59ee0607c1c");
  assert.match(bodyUat, /SECURITY DEFINER/);
  assert.match(bodyUat, /SET search_path = pg_catalog, private_line/);
  assert.match(bodyUat, /REVOKE ALL ON FUNCTION private_line\.admin_read_advisor_inbox\(uuid,integer\) FROM PUBLIC/);
  assert.match(bodyUat, /REVOKE ALL ON FUNCTION private_line\.admin_read_advisor_inbox\(uuid,integer\) FROM ccpun_line_ingress/);
  assert.match(bodyUat, /GRANT EXECUTE ON FUNCTION private_line\.admin_read_advisor_inbox\(uuid,integer\) TO ccpun_admin_runtime/);
});

test("Admin runtime readiness is capability-based and never reads migration/base tables directly", () => {
  const source = read("lib/admin/line/control-plane.ts");
  assert.match(source, /has_function_privilege\(current_user, 'private_line\.admin_read_advisor_inbox\(uuid,integer\)', 'EXECUTE'\)/);
  assert.match(source, /private_line\.admin_read_advisor_inbox/);
  assert.doesNotMatch(source, /FROM private_line\.schema_migration\b/);
  assert.doesNotMatch(source, /FROM private_line\.(?:lead|customer|conversation|message|advisor_case|lead_context)\b/);
});
