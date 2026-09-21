import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  buildSafeKnowledgeEventPayload,
  parseSafeKnowledgeRequest,
} from "../../lib/line/safe-knowledge";

const root = path.resolve(import.meta.dirname, "../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const checksum = "084d1063b0d0fbc1c48762ea8de88994210f7d063f244874c2b17c5ff55147af";

function checksumBody(sql: string) {
  return sql.split("-- checksum-source-begin\n", 2)[1]?.split("-- checksum-source-end", 1)[0] ?? "";
}

function normalize(sql: string) {
  return sql
    .replaceAll("20260918_line_delivery_activation_v1_uat", "PREVIOUS")
    .replaceAll("20260918_line_delivery_activation_v1_production", "PREVIOUS")
    .replaceAll("20260918_line_content_intelligence_v2_uat", "THIS")
    .replaceAll("20260918_line_content_intelligence_v2_production", "THIS")
    .replaceAll("young-term-47483330", "PROJECT")
    .replaceAll("lively-bar-43618798", "PROJECT")
    .replaceAll("br-crimson-mouse-az7ajkv8", "BRANCH")
    .replaceAll("br-long-resonance-b3ys5xrv", "BRANCH")
    .replaceAll("ep-mute-frost-aztvz394", "ENDPOINT")
    .replaceAll("ep-broad-butterfly-b3ro7u8w", "ENDPOINT")
    .replaceAll("20260917_private_line_runtime_v1_uat", "BASE")
    .replaceAll("20260917_private_line_runtime_v1_production", "BASE");
}

test("Content Intelligence v2 migrations are parity locked", () => {
  const uat = read("db/migrations/20260918_line_content_intelligence_v2_uat.sql");
  const production = read("db/migrations/20260918_line_content_intelligence_v2_production.sql");
  assert.equal(normalize(uat), normalize(production));
  assert.equal(checksumBody(uat), checksumBody(production));
  assert.equal(createHash("sha256").update(checksumBody(uat)).digest("hex"), checksum);
  assert.match(uat, new RegExp(`sha256:${checksum}`));
  assert.match(production, new RegExp(`sha256:${checksum}`));
});

test("Safe Knowledge metric table contains no customer or conversation join keys", () => {
  const sql = read("db/migrations/20260918_line_content_intelligence_v2_production.sql");
  const table = sql.match(/CREATE TABLE IF NOT EXISTS private_line\.safe_knowledge_event[\s\S]*?\n\);/);
  assert.ok(table);
  assert.match(table[0], /question_id text NOT NULL/);
  assert.match(table[0], /journey text NOT NULL/);
  assert.match(table[0], /outcome text NOT NULL/);
  assert.doesNotMatch(
    table[0],
    /customer|lead_id|conversation|identity|message|cipher|contact|phone|email|health|policy|income|asset|debt|drive|file/i,
  );
  assert.match(sql, /REVOKE ALL PRIVILEGES ON TABLE private_line\.safe_knowledge_event FROM ccpun_admin_runtime/);
  assert.match(sql, /REVOKE ALL PRIVILEGES ON TABLE private_line\.safe_knowledge_event FROM ccpun_line_ingress/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION private_line\.ingress_record_safe_knowledge_event\(jsonb\) TO ccpun_line_ingress/);
  assert.match(sql, /REVOKE ALL ON FUNCTION private_line\.ingress_record_safe_knowledge_event\(jsonb\) FROM ccpun_admin_runtime/);
});

test("Safe Knowledge event payload is predefined-safe and strips free text", () => {
  const request = {
    question_id: "motor_2plus_vs_3plus",
    journey: "motor_quote_review",
    stage: "quote_available",
    content_id: "motor_renewal_5_10y",
    explicit_human_request: false,
    personalized: false,
    quote_required: false,
    recommendation_required: false,
    suitability_required: false,
    health_conclusion_required: false,
    material_received: false,
    needs_human: false,
  };
  assert.ok(parseSafeKnowledgeRequest(request));
  const payload = buildSafeKnowledgeEventPayload(request, {
    kind: "human_handoff",
    questionId: "motor_2plus_vs_3plus",
    reason: "no_approved_answer",
  });
  assert.deepEqual(payload, {
    question_id: "motor_2plus_vs_3plus",
    journey: "motor_quote_review",
    stage: "quote_available",
    outcome: "human_handoff",
    reason: "no_approved_answer",
    request_content_id: "motor_renewal_5_10y",
    source_slug: null,
  });
  assert.doesNotMatch(JSON.stringify(payload), /message|text|name|phone|email|policy|quote_amount|income|asset|debt/i);
});

test("approved answer metrics expose source slug but never answer text", () => {
  const request = {
    question_id: "critical_illness_basics",
    journey: "life_health_policy_review",
    stage: "ci_planning_context",
    explicit_human_request: false,
    personalized: false,
    quote_required: false,
    recommendation_required: false,
    suitability_required: false,
    health_conclusion_required: false,
    material_received: false,
    needs_human: false,
  };
  const payload = buildSafeKnowledgeEventPayload(request, {
    kind: "approved_answer",
    questionId: "critical_illness_basics",
    sourceSlug: "what-is-critical-illness-insurance",
    sourcePath: "/blog/critical-illness-insurance/what-is-critical-illness-insurance/",
    answer: "THIS MUST NEVER ENTER THE METRIC",
  });
  assert.ok(payload);
  assert.equal(payload?.source_slug, "what-is-critical-illness-insurance");
  assert.doesNotMatch(JSON.stringify(payload), /THIS MUST NEVER ENTER THE METRIC/);
  assert.doesNotMatch(JSON.stringify(payload), /"sourcePath"\s*:|"answer"\s*:/);
});

test("journey starts, qualification, drop-off and revenue counts are aggregate-only", () => {
  const sql = read("db/migrations/20260918_line_content_intelligence_v2_production.sql");
  const fn = sql.match(/CREATE OR REPLACE FUNCTION private_line\.admin_read_content_intelligence_v2[\s\S]*?\$admin_read_content_intelligence_v2\$;/);
  assert.ok(fn);
  assert.match(fn[0], /WHERE e\.event_type='line_continue'/);
  assert.match(fn[0], /journey_start_count/);
  assert.match(fn[0], /qualification_rate/);
  assert.match(fn[0], /drop_off_count/);
  assert.match(fn[0], /revenue_record_count/);
  assert.doesNotMatch(fn[0], /message_text|cipher|nonce|auth_tag|provider_identity|customer_code|display_name|phone|email/i);
});

test("content-level revenue is currency separated and k=3 suppressed", () => {
  const sql = read("db/migrations/20260918_line_content_intelligence_v2_production.sql");
  const fn = sql.match(/CREATE OR REPLACE FUNCTION private_line\.admin_read_content_revenue_by_currency[\s\S]*?\$admin_read_content_revenue_by_currency\$;/);
  assert.ok(fn);
  assert.match(fn[0], /r\.currency/);
  assert.match(fn[0], /count\(DISTINCT r\.revenue_id\)>=3/);
  assert.match(fn[0], /ELSE NULL::numeric/);
  assert.match(fn[0], /revenue_suppressed/);
});

test("content-gap input is deterministic from safe no-answer/source-unavailable signals", () => {
  const sql = read("db/migrations/20260918_line_content_intelligence_v2_production.sql");
  const fn = sql.match(/CREATE OR REPLACE FUNCTION private_line\.admin_read_content_gap_inputs[\s\S]*?\$admin_read_content_gap_inputs\$;/);
  assert.ok(fn);
  assert.match(fn[0], /no_approved_answer/);
  assert.match(fn[0], /source_unavailable/);
  assert.doesNotMatch(fn[0], /message|transcript|customer|lead_id|conversation|cipher|document/i);
});

test("Safe Knowledge API records metrics best-effort through the OIDC Admin bridge", () => {
  const route = read("apps/web/app/api/line/knowledge/route.ts");
  const metric = read("apps/web/lib/line/safe-knowledge-metrics.ts");
  const bridge = read("apps/web/lib/line/public-event-bridge.ts");
  const adminRoute = read("apps/admin/app/api/internal/line/public-event/route.ts");
  const adminStore = read("lib/admin/line/public-event-ingestion.ts");
  assert.match(route, /recordSafeKnowledgeDecisionBestEffort\(body, decision\)/);
  assert.match(metric, /recordLinePublicEventBestEffort/);
  assert.match(bridge, /VERCEL_OIDC_TOKEN/);
  assert.match(bridge, /\/api\/internal\/line\/public-event\//);
  assert.match(adminRoute, /isProductionWebServiceRequestAuthorized/);
  assert.match(adminStore, /ingress_record_safe_knowledge_event/);
  assert.doesNotMatch([metric, bridge].join("\n"), /@neondatabase\/serverless|private_line\./);
  assert.doesNotMatch([metric, bridge].join("\n"), /console\.|gtag|fbq|dataLayer|analytics/i);
});

test("Admin conversion surface consumes aggregate v2 and does not expose Safe Knowledge raw records", () => {
  const service = read("lib/admin/line/business-intelligence.ts");
  const page = read("apps/admin/app/(control-plane)/analytics/conversions/page.tsx");
  assert.match(service, /admin_read_content_intelligence_v2/);
  assert.match(service, /admin_read_content_revenue_by_currency/);
  assert.match(service, /admin_read_safe_question_frequency/);
  assert.match(service, /admin_read_content_gap_inputs/);
  assert.match(page, /หัวข้อเนื้อหาที่ยังขาด/);
  assert.match(page, /คำถามที่ลูกค้าถามบ่อย/);
  assert.match(page, /ซ่อนยอดเพราะมีข้อมูลน้อยกว่า 3 รายการ/);
  assert.doesNotMatch(page, /providerMessageId|externalFileId|externalFolderId|customerCode|messageText|ciphertext|lineUserId/);
});
