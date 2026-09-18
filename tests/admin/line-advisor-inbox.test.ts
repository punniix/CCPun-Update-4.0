import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { ADMIN_ROLES, hasAdminPermission } from "../../lib/admin/rbac";
import { ADMIN_OPERATIONS_LANES, resolveAdminOperationsRuntimeIdentity } from "../../lib/admin/operations/foundation";

const root = path.resolve(import.meta.dirname, "../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const checksum = "99519369562761cfb4cb95fe7d6e14f5d0a158ba31b116200d729eb865a451e0";

function checksumSource(sql: string) {
  return sql.split("-- checksum-source-begin\n", 2)[1]?.split("-- checksum-source-end", 1)[0] ?? "";
}

function normalizedMigration(sql: string) {
  return sql
    .replaceAll("20260917_private_line_runtime_v1_uat", "20260917_private_line_runtime_v1_BASE")
    .replaceAll("20260917_private_line_runtime_v1_production", "20260917_private_line_runtime_v1_BASE")
    .replaceAll("20260918_line_advisor_inbox_v1_uat", "20260918_line_advisor_inbox_v1_LANE")
    .replaceAll("20260918_line_advisor_inbox_v1_production", "20260918_line_advisor_inbox_v1_LANE")
    .replaceAll("young-term-47483330", "PROJECT_ID")
    .replaceAll("lively-bar-43618798", "PROJECT_ID")
    .replaceAll("br-crimson-mouse-az7ajkv8", "BRANCH_ID")
    .replaceAll("br-long-resonance-b3ys5xrv", "BRANCH_ID")
    .replaceAll("ep-mute-frost-aztvz394", "ENDPOINT_ID")
    .replaceAll("ep-broad-butterfly-b3ro7u8w", "ENDPOINT_ID")
    .replaceAll("sha256:19a7dfaf26d2cc4f6cbf01d7ff2380056383f8e87dd079a6e141e73b878985d3", "sha256:BASE_CHECKSUM")
    .replaceAll("sha256:f562ba174f50cf617d0e12ffd13c46e5815b069dc823ecb7c8522d7b05d6c57b", "sha256:BASE_CHECKSUM")
    .replaceAll("Base private_line UAT", "Base private_line LANE")
    .replaceAll("Base private_line Production", "Base private_line LANE");
}

test("Advisor Inbox migrations keep UAT and Production behavior in parity", () => {
  const uat = read("db/migrations/20260918_line_advisor_inbox_v1_uat.sql");
  const production = read("db/migrations/20260918_line_advisor_inbox_v1_production.sql");
  assert.equal(normalizedMigration(uat), normalizedMigration(production));
  assert.equal(checksumSource(uat), checksumSource(production));
  assert.equal(createHash("sha256").update(checksumSource(uat)).digest("hex"), checksum);
  assert.match(uat, new RegExp(`sha256:${checksum}`));
  assert.match(production, new RegExp(`sha256:${checksum}`));
});

test("safe view exposes operational context only and preserves least privilege", () => {
  const migration = read("db/migrations/20260918_line_advisor_inbox_v1_production.sql");
  const source = checksumSource(migration);
  for (const column of [
    "lead_id", "advisor_case_id", "customer_code", "stage", "journey", "material_received",
    "conversation_status", "unread_count", "last_activity_at", "priority", "assigned_advisor",
    "latest_message_type", "latest_message_status", "latest_message_needs_human", "updated_at",
  ]) assert.match(source, new RegExp(`\\b${column}\\b`), column);

  for (const forbidden of [
    "external_ref_digest", "external_ref_ciphertext_b64", "provider_message_digest",
    "provider_message_ciphertext_b64", "content_ciphertext_b64", "content_nonce_b64",
    "content_auth_tag_b64", "external_file_id", "external_folder_id",
  ]) assert.doesNotMatch(source, new RegExp(`\\b${forbidden}\\b`), forbidden);

  assert.match(source, /REVOKE ALL ON TABLE private_line\.advisor_inbox_safe FROM ccpun_line_ingress/);
  assert.match(source, /GRANT SELECT ON TABLE private_line\.advisor_inbox_safe TO ccpun_admin_runtime/);
  assert.match(source, /REVOKE ALL PRIVILEGES ON TABLE[\s\S]*private_line\.message_tombstone[\s\S]*FROM ccpun_admin_runtime/);
  assert.doesNotMatch(source, /GRANT SELECT ON TABLE\s+private_line\.(?:customer|provider_identity|conversation|message|document|lead|advisor_case)/);
});

test("readbacks prove safe-view access without changing the ingress boundary", () => {
  for (const file of [
    "db/migrations/20260918_line_advisor_inbox_v1_uat_readback.sql",
    "db/migrations/20260918_line_advisor_inbox_v1_production_readback.sql",
  ]) {
    const sql = read(file);
    assert.match(sql, /base_identity_unchanged/);
    assert.match(sql, /admin_base_tables_direct_denied/);
    assert.match(sql, /admin_safe_view_select_ok/);
    assert.match(sql, /ingress_safe_view_select_denied/);
    assert.match(sql, /ingress_execute_unchanged/);
    assert.match(sql, /ingress_base_tables_direct_denied/);
  }
});

test("Advisor Inbox runtime reuses the exact Admin Neon lane guard", () => {
  const controlPlane = read("lib/admin/line/control-plane.ts");
  assert.match(controlPlane, /adminOperationsRuntimeInputFromEnvironment/);
  assert.match(controlPlane, /resolveAdminOperationsRuntimeIdentity/);
  assert.match(controlPlane, /FROM private_line\.admin_read_advisor_inbox/);
  assert.doesNotMatch(controlPlane, /FROM private_line\.(?:customer|provider_identity|conversation|message|document|lead|advisor_case|lead_context)\b/);
  assert.doesNotMatch(controlPlane, /createLinePrivateCrypto|CCPUN_LINE_IDENTITY_HMAC_KEY/);
  assert.match(controlPlane, /createLineContentCrypto/);
  assert.match(controlPlane, /CCPUN_LINE_TRANSCRIPT_ENABLED/);
  assert.match(controlPlane, /outboundEnabled:\s*false/);

  for (const [lane, environment, vercelEnvironment] of [
    ["uat", "admin-uat", "preview"],
    ["production", "production-admin", "production"],
  ] as const) {
    const identity = ADMIN_OPERATIONS_LANES[lane];
    const input = {
      environment,
      projectId: identity.projectId,
      branchId: identity.branchId,
      database: identity.database,
      connectionString: `postgresql://${identity.runtimeRole}:test-only@${identity.endpointId}.${identity.hostSuffix}/${identity.database}?sslmode=require`,
      vercelEnvironment,
      gitBranch: lane === "production" ? "v4-production" : "admin/line-advisor-inbox-20260918",
      vercelProjectId: "prj_6tuUxJxYbQ4mpF7sMgNWx2p2jowN",
      productionAdminProjectId: "prj_6tuUxJxYbQ4mpF7sMgNWx2p2jowN",
    };
    assert.equal(resolveAdminOperationsRuntimeIdentity(input)?.lane, lane);
    assert.equal(resolveAdminOperationsRuntimeIdentity({ ...input, branchId: "wrong-branch" }), null);
    assert.equal(resolveAdminOperationsRuntimeIdentity({ ...input, database: "wrong-db" }), null);
    assert.equal(resolveAdminOperationsRuntimeIdentity({ ...input, connectionString: input.connectionString.replace(identity.runtimeRole, "neondb_owner") }), null);
  }
});

test("advisor:read is owner-only in Phase 3A", () => {
  assert.equal(hasAdminPermission("owner", "advisor:read"), true);
  for (const role of ADMIN_ROLES.filter((role) => role !== "owner")) {
    assert.equal(hasAdminPermission(role, "advisor:read"), false, role);
  }
});

test("deployed Admin separates Advisor Inbox from SEO Reviews", () => {
  const inbox = read("apps/admin/app/(control-plane)/dashboard/inbox/page.tsx");
  const reviews = read("apps/admin/app/(control-plane)/dashboard/reviews/page.tsx");
  const layout = read("apps/admin/app/(control-plane)/layout.tsx");
  const routes = read("lib/admin/routes.ts");
  const dashboard = read("apps/admin/app/(control-plane)/dashboard/page.tsx");
  const articles = read("apps/admin/app/(control-plane)/content/articles/page.tsx");
  const seo = read("apps/admin/app/(control-plane)/seo/page.tsx");

  assert.match(inbox, /requireAdminPermission\("advisor:read"\)/);
  assert.match(inbox, /Private-by-default/);
  assert.match(inbox, /conversation archive owner-only · Admin outbound disabled/);
  assert.match(inbox, /\/dashboard\/inbox\/\$\{item\.leadId\}\//);
  assert.doesNotMatch(inbox, /ApproveSuggestionButton|ApplySuggestionButton|ReviewDecisionControls/);
  assert.match(reviews, /requireAdminPermission\("reviews:read"\)/);
  assert.match(reviews, /ReviewDecisionControls/);
  assert.match(layout, /\/dashboard\/inbox\/[\s\S]*Advisor Inbox[\s\S]*advisor:read/);
  assert.match(layout, /\/dashboard\/reviews\/[\s\S]*Reviews[\s\S]*reviews:read/);
  assert.match(routes, /\["\/snt-admin\/reviews", "\/dashboard\/reviews\/"\]/);
  for (const source of [dashboard, articles, seo]) {
    assert.doesNotMatch(source, /href="\/dashboard\/inbox\/"[\s\S]{0,120}(?:ข้อเสนอ|Review inbox)/);
  }
});

test("Advisor Inbox API is authenticated, owner-gated, no-store, and safe-only", () => {
  const route = read("apps/admin/app/api/admin/line/inbox/route.ts");
  assert.match(route, /getAdminIdentity\(\)/);
  assert.match(route, /status: 401/);
  assert.match(route, /"advisor:read"/);
  assert.match(route, /status: 403/);
  assert.match(route, /Cache-Control/);
  assert.match(route, /no-store/);
  assert.match(route, /listAdvisorInboxSafe\(\)/);
  assert.doesNotMatch(route, /request\.json|request\.text|LINE_CHANNEL|ciphertext|external_ref|provider_message/);
});
