import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const checksum = "4d8552c0f3a44407733a7a396a36909e4cc87c657e8d0c39a8d5e818e7f5875b";

function body(sql: string) {
  return sql.split("-- checksum-source-begin\n", 2)[1]?.split("-- checksum-source-end", 1)[0] ?? "";
}

function normalized(sql: string) {
  return sql
    .replaceAll("20260918_line_key_rotation_v2_uat", "PREVIOUS")
    .replaceAll("20260918_line_key_rotation_v2_production", "PREVIOUS")
    .replaceAll("20260918_line_attribution_privacy_ops_v1_uat", "THIS")
    .replaceAll("20260918_line_attribution_privacy_ops_v1_production", "THIS")
    .replaceAll("young-term-47483330", "PROJECT")
    .replaceAll("lively-bar-43618798", "PROJECT")
    .replaceAll("br-crimson-mouse-az7ajkv8", "BRANCH")
    .replaceAll("br-long-resonance-b3ys5xrv", "BRANCH")
    .replaceAll("ep-mute-frost-aztvz394", "ENDPOINT")
    .replaceAll("ep-broad-butterfly-b3ro7u8w", "ENDPOINT")
    .replaceAll("20260917_private_line_runtime_v1_uat", "BASE")
    .replaceAll("20260917_private_line_runtime_v1_production", "BASE");
}

test("UAT and Production attribution/privacy migrations are checksum-parity locked", () => {
  const uat = read("db/migrations/20260918_line_attribution_privacy_ops_v1_uat.sql");
  const production = read("db/migrations/20260918_line_attribution_privacy_ops_v1_production.sql");
  assert.equal(normalized(uat), normalized(production));
  assert.equal(body(uat), body(production));
  assert.equal(createHash("sha256").update(body(uat)).digest("hex"), checksum);
  assert.match(uat, new RegExp(`sha256:${checksum}`));
  assert.match(production, new RegExp(`sha256:${checksum}`));
  assert.doesNotMatch(body(uat), /(?:INSERT|UPDATE|DELETE)\s+(?:INTO\s+|FROM\s+)?private_line\.system_identity/i);
});

test("business event store is allowlisted, idempotent, and excludes confidential payload columns", () => {
  const sql = read("db/migrations/20260918_line_attribution_privacy_ops_v1_production.sql");
  const table = sql.match(/CREATE TABLE IF NOT EXISTS private_line\.business_event[\s\S]*?\n\);/);
  assert.ok(table);
  for (const event of ["view","cta","line_continue","material_received","lead_qualified","advisor_review","solution_or_quote","implementation_started","implementation_complete","won","lost","revenue_attributed"]) {
    assert.match(table[0], new RegExp(`'${event}'`));
  }
  assert.match(table[0], /source_event_key text NOT NULL UNIQUE/);
  assert.doesNotMatch(table[0], /line_user|external_ref|customer_code|display_name|phone|email|message_text|raw_message|document_(?:url|id)|cipher|nonce|auth_tag|income|asset|debt|health|medical/i);
});

test("stage transitions emit safe funnel events without changing the authoritative graph", () => {
  const sql = read("db/migrations/20260918_line_attribution_privacy_ops_v1_production.sql");
  const fn = sql.match(/CREATE OR REPLACE FUNCTION private_line\.admin_update_lead_stage[\s\S]*?\$admin_update_lead_stage\$;/);
  assert.ok(fn);
  assert.match(fn[0], /WHEN v_to='Qualified' THEN 'lead_qualified'/);
  assert.match(fn[0], /WHEN v_to='Expert Review' THEN 'advisor_review'/);
  assert.match(fn[0], /WHEN v_to IN \('Solution','Quote'\) THEN 'solution_or_quote'/);
  assert.match(fn[0], /WHEN v_to='Won' THEN 'won'/);
  assert.match(fn[0], /WHEN v_to='Lost' THEN 'lost'/);
  assert.match(fn[0], /WHEN 'Implementation' THEN v_to IN \('Won','Lost'\)/);
});

test("explicit journey attribution never fingerprints or infers identity", () => {
  const sql = read("db/migrations/20260918_line_attribution_privacy_ops_v1_production.sql");
  const fn = sql.match(/CREATE OR REPLACE FUNCTION private_line\.admin_bind_lead_attribution[\s\S]*?\$admin_bind_lead_attribution\$;/);
  assert.ok(fn);
  assert.match(fn[0], /journey_event_id/);
  assert.match(fn[0], /lead_attribution_link/);
  assert.match(fn[0], /content_cta.*cta/);
  assert.match(fn[0], /line_continue/);
  assert.doesNotMatch(fn[0], /ip_address|user_agent|fingerprint|email|phone|name|external_ref|provider_identity/i);
  assert.match(fn[0], /material_received/);
});

test("implementation and revenue are private/idempotent and never silently mutate lead stage", () => {
  const sql = read("db/migrations/20260918_line_attribution_privacy_ops_v1_production.sql");
  const impl = sql.match(/CREATE OR REPLACE FUNCTION private_line\.admin_record_implementation[\s\S]*?\$admin_record_implementation\$;/);
  const revenue = sql.match(/CREATE OR REPLACE FUNCTION private_line\.admin_attribute_revenue[\s\S]*?\$admin_attribute_revenue\$;/);
  assert.ok(impl && revenue);
  assert.match(revenue[0], /ON CONFLICT\(idempotency_digest\) DO NOTHING/);
  assert.match(revenue[0], /revenue_attributed/);
  assert.match(impl[0], /implementation_started/);
  assert.match(impl[0], /implementation_complete/);
  assert.doesNotMatch(impl[0], /UPDATE private_line\.lead SET stage/i);
  assert.doesNotMatch(revenue[0], /UPDATE private_line\.lead SET stage/i);
});

test("content intelligence and conversion projections stay aggregate-only", () => {
  const sql = read("db/migrations/20260918_line_attribution_privacy_ops_v1_production.sql");
  const content = sql.match(/CREATE OR REPLACE FUNCTION private_line\.admin_read_content_intelligence[\s\S]*?\$admin_read_content_intelligence\$;/);
  const conversions = sql.match(/CREATE OR REPLACE FUNCTION private_line\.admin_read_conversion_summary[\s\S]*?\$admin_read_conversion_summary\$;/);
  assert.ok(content && conversions);
  const contentReturns = content[0].split("LANGUAGE sql", 1)[0];
  assert.match(contentReturns, /origin text/);
  assert.match(contentReturns, /journey text/);
  assert.match(contentReturns, /qualified_count bigint/);
  assert.doesNotMatch(contentReturns, /lead_id|customer|message|document|cipher|nonce|auth_tag|amount_minor|revenue_minor/i);
  assert.doesNotMatch(conversions[0].split("LANGUAGE sql", 1)[0], /customer|message|document|cipher|lead_id/i);
});

test("revenue stays private and is never sent through generic analytics code", () => {
  const service = read("lib/admin/line/business-intelligence.ts");
  const ui = read("features/admin/line/LeadOutcomeActions.tsx");
  const route = read("apps/admin/app/api/admin/line/inbox/[leadId]/revenue/route.ts");
  for (const source of [service, ui, route]) {
    assert.doesNotMatch(source, /\bgtag\b|\bfbq\b|trackEvent\(|dataLayer|google-analytics|meta pixel/i);
  }
  assert.match(service, /admin_attribute_revenue/);
  assert.doesNotMatch(read("lib/analytics.ts"), /revenue_attributed|amount_minor|lead_revenue/);
});

test("privacy workflow defaults to manual retention and has no destructive delete execution path", () => {
  const sql = read("db/migrations/20260918_line_attribution_privacy_ops_v1_production.sql");
  assert.match(sql, /policy_mode text NOT NULL DEFAULT 'manual_review'/);
  assert.match(sql, /automatic_delete_enabled boolean NOT NULL DEFAULT false CHECK \(automatic_delete_enabled=false\)/);
  assert.match(sql, /delete execution requires separate irreversible human gate/);
  assert.doesNotMatch(sql, /CREATE (?:OR REPLACE )?FUNCTION private_line\.[^(]*(?:delete_customer|execute_delete|purge_customer)/i);
  assert.doesNotMatch(sql, /pg_cron|cron\.schedule|automatic_delete_enabled=true/);
  const privacyUi = read("features/admin/line/PrivacyRequestManager.tsx");
  const transitionApi = read("apps/admin/app/api/admin/line/privacy/[requestId]/transition/route.ts");
  assert.doesNotMatch(privacyUi, /transition\("executed"\)/);
  assert.doesNotMatch(transitionApi, /"executed"/);
});

test("privacy prepare exposes a deterministic count manifest only and advances verified to prepared", () => {
  const sql = read("db/migrations/20260918_line_attribution_privacy_ops_v1_production.sql");
  const fn = sql.match(/CREATE OR REPLACE FUNCTION private_line\.admin_prepare_privacy_request[\s\S]*?\$admin_prepare_privacy_request\$;/);
  assert.ok(fn);
  const returns = fn[0].split("LANGUAGE plpgsql", 1)[0];
  for (const field of ["conversation_count","message_count","document_count","lead_count","advisor_case_count","business_event_count","implementation_count","revenue_record_count","destructive_execution_available"]) {
    assert.match(returns, new RegExp(field));
  }
  assert.doesNotMatch(returns, /content_ciphertext|message_text|external_ref|document_url|phone|email|name/i);
  assert.match(fn[0], /SET status='prepared'/);
  assert.match(fn[0], /false;/);
});

test("new Admin mutations are owner-only, same-origin, no-store and noindex", () => {
  for (const file of [
    "apps/admin/app/api/admin/line/inbox/[leadId]/implementation/route.ts",
    "apps/admin/app/api/admin/line/inbox/[leadId]/revenue/route.ts",
    "apps/admin/app/api/admin/line/inbox/[leadId]/attribution/route.ts",
    "apps/admin/app/api/admin/line/privacy/route.ts",
    "apps/admin/app/api/admin/line/privacy/[requestId]/transition/route.ts",
    "apps/admin/app/api/admin/line/privacy/[requestId]/prepare/route.ts",
  ]) {
    const source = read(file);
    assert.match(source, /identity\.role\s*!==\s*"owner"/);
    if (source.includes("export async function POST")) assert.match(source, /isSameOriginAdminMutation/);
    assert.match(source, /no-store/);
    assert.match(source, /noindex/);
    assert.doesNotMatch(source, /console\./);
  }
});

test("least privilege keeps PUBLIC and ingress away from revenue/privacy and base tables", () => {
  const sql = read("db/migrations/20260918_line_attribution_privacy_ops_v1_production.sql");
  for (const fn of ["admin_attribute_revenue","admin_create_privacy_request","admin_transition_privacy_request","admin_prepare_privacy_request","admin_read_conversion_summary","admin_read_content_intelligence"]) {
    assert.match(sql, new RegExp(`REVOKE ALL ON FUNCTION private_line\\.${fn}`));
    assert.match(sql, new RegExp(`FROM ccpun_line_ingress`));
  }
  assert.match(sql, /REVOKE ALL PRIVILEGES ON TABLE[\s\S]*private_line\.lead_revenue[\s\S]*FROM ccpun_admin_runtime/);
  assert.doesNotMatch(sql, /GRANT (?:SELECT|INSERT|UPDATE|DELETE) ON (?:TABLE )?private_line\.(?:business_event|lead_revenue|privacy_request|lead_implementation|lead_attribution_link)(?:\s|;|,)/);
});

test("operations health exposes counts/status only", () => {
  const sql = read("db/migrations/20260918_line_attribution_privacy_ops_v1_production.sql");
  const fn = sql.match(/CREATE OR REPLACE FUNCTION private_line\.admin_read_line_ops_health[\s\S]*?\$admin_read_line_ops_health\$;/);
  assert.ok(fn);
  const returns = fn[0].split("LANGUAGE sql", 1)[0];
  assert.match(returns, /outbound_queued bigint/);
  assert.match(returns, /privacy_pending bigint/);
  assert.match(returns, /business_event_count bigint/);
  assert.doesNotMatch(returns, /lead_id|customer|message|request_body|cipher|nonce|auth_tag|error_text|external_ref/i);
});

test("Admin UI adds real conversions and privacy surfaces without creating another CRM", () => {
  const layout = read("apps/admin/app/(control-plane)/layout.tsx");
  const conversion = read("apps/admin/app/(control-plane)/analytics/conversions/page.tsx");
  const privacy = read("apps/admin/app/(control-plane)/operations/privacy/page.tsx");
  assert.match(layout, /\/analytics\/conversions\//);
  assert.match(layout, /\/operations\/privacy\//);
  assert.match(conversion, /การคุยที่พร้อมให้คำแนะนำ/);
  assert.match(conversion, /แสดงเฉพาะยอดรวมและรหัสที่ปลอดภัย/);
  assert.match(privacy, /การลบข้อมูลจริงต้องยืนยันแยกต่างหาก/);
  assert.doesNotMatch(privacy, /Delete execution ไม่ได้เปิดจาก UI นี้/);
  assert.doesNotMatch(conversion + privacy, /LINE user ID|provider ID|ciphertext|message text/i);
});


test("privacy prepare fix is checksum-parity locked and qualifies PL/pgSQL output-column names", () => {
  const uat = read("db/migrations/20260918_line_attribution_privacy_ops_fix_v1_uat.sql");
  const production = read("db/migrations/20260918_line_attribution_privacy_ops_fix_v1_production.sql");
  const uatBody = body(uat);
  const productionBody = body(production);
  assert.equal(uatBody, productionBody);
  const fixChecksum = createHash("sha256").update(uatBody).digest("hex");
  assert.equal(fixChecksum, "966f039cbf412946528136a5c1b9ebf04ce98027d5f2a15ea1820a63d189a2b2");
  assert.match(uatBody, /pr\.request_type/);
  assert.match(uatBody, /pr\.status/);
  assert.match(uatBody, /pr\.privacy_request_id=p_request_id/);
  assert.match(uatBody, /REVOKE ALL ON FUNCTION private_line\.admin_prepare_privacy_request\(uuid\) FROM PUBLIC/);
  assert.match(uatBody, /FROM ccpun_line_ingress/);
  assert.match(uatBody, /TO ccpun_admin_runtime/);
});
