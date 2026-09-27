import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import test from "node:test";
import {
  ADMIN_OPERATIONS_MIGRATION_CHECKSUM,
  isAdminOperationsRuntimeIdentityValid,
} from "../../lib/admin/operations/foundation";
import { sanitizeLegacyAuditPayload } from "../../lib/admin/operations/backfill";
import { prepareBackfillInsert } from "../../scripts/backfill-sanity-admin-operations";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("Admin operations migration is additive, checksum-locked, and isolated from social", () => {
  const migration = read("db/migrations/20260830_website_42_admin_operations_v1.sql");
  const source = migration.split("-- checksum-source-begin\n")[1]?.split("-- checksum-source-end")[0];
  assert.ok(source);
  assert.equal(`sha256:${createHash("sha256").update(source).digest("hex")}`, ADMIN_OPERATIONS_MIGRATION_CHECKSUM);
  for (const table of ["audit_log", "research_snapshot", "seo_suggestion"]) assert.match(migration, new RegExp(`ccpun_admin\\.${table}`));
  assert.match(migration, /REVOKE ALL ON SCHEMA ccpun_admin FROM PUBLIC/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS ccpun_admin\.system_identity/);
  assert.match(migration, /project_id text NOT NULL CHECK \(project_id = 'young-term-47483330'\)/);
  assert.match(migration, /branch_id text NOT NULL CHECK \(branch_id = 'br-crimson-mouse-az7ajkv8'\)/);
  assert.match(migration, /endpoint_id text NOT NULL CHECK \(endpoint_id = 'ep-mute-frost-aztvz394'\)/);
  assert.match(migration, /database_name text NOT NULL CHECK \(database_name = 'neondb'\)/);
  assert.match(migration, /CREATE ROLE ccpun_admin_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS/);
  assert.match(migration, /ELSE\s+ALTER ROLE ccpun_admin_runtime WITH NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS/);
  assert.doesNotMatch(migration, /ELSE\s+ALTER ROLE ccpun_admin_runtime WITH NOLOGIN/);
  assert.match(migration, /GRANT CONNECT ON DATABASE neondb TO ccpun_admin_runtime/);
  assert.match(migration, /GRANT SELECT, INSERT ON ccpun_admin\.audit_log, ccpun_admin\.research_snapshot TO ccpun_admin_runtime/);
  assert.match(migration, /GRANT UPDATE \([\s\S]*\) ON ccpun_admin\.seo_suggestion TO ccpun_admin_runtime/);
  assert.match(migration, /REVOKE ALL PRIVILEGES ON SCHEMA ccpun_social FROM ccpun_admin_runtime/);
  assert.doesNotMatch(migration, /GRANT [^;]*ccpun_social[^;]*ccpun_admin_runtime/);
});

test("Admin operations readback stays locked to the migration identity, checksum, and least privileges", () => {
  const readback = read("db/migrations/20260830_website_42_admin_operations_v1_readback.sql");
  assert.match(readback, new RegExp(ADMIN_OPERATIONS_MIGRATION_CHECKSUM.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  for (const identity of ["young-term-47483330", "br-crimson-mouse-az7ajkv8", "ep-mute-frost-aztvz394", "neondb"]) {
    assert.match(readback, new RegExp(identity));
  }
  for (const result of [
    "database_ok", "checksum_ok", "identity_ok", "runtime_role_exists", "runtime_role_restricted",
    "database_connect_ok", "admin_schema_usage_ok", "social_schema_denied", "admin_table_grants_ok",
    "seo_update_columns_ok", "social_objects_denied",
  ]) assert.match(readback, new RegExp(`AS ${result}`));
  assert.match(readback, /NOT rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole/);
  assert.match(readback, /NOT rolinherit AND NOT rolreplication AND NOT rolbypassrls/);
  assert.match(readback, /information_schema\.role_column_grants/);
  assert.match(readback, /information_schema\.role_table_grants/);
  assert.match(readback, /information_schema\.role_usage_grants/);
  assert.match(readback, /table_schema = 'ccpun_social'/);
  assert.match(readback, /object_schema = 'ccpun_social'/);
});

test("runtime operational records use only CCPUN_ADMIN_DATABASE_URL", () => {
  const database = read("lib/admin/operations/database.ts");
  const runtime = [read("lib/admin/research.ts"), read("lib/admin/sanity-audit.ts"), read("lib/admin/sanity-control.ts")].join("\n");
  assert.match(database, /process\.env\.CCPUN_ADMIN_DATABASE_URL/);
  assert.doesNotMatch(database, /CCPUN_SOCIAL_DATABASE_URL|SANITY_[A-Z0-9_]*TOKEN/);
  assert.doesNotMatch(runtime, /_type:\s*"(?:auditLog|researchSnapshot|seoSuggestion)"/);
});

test("runtime identity validation accepts only the exact UAT lane, resource, role and database", () => {
  const valid = {
    environment: "admin-uat", projectId: "young-term-47483330", branchId: "br-crimson-mouse-az7ajkv8", database: "neondb",
    connectionString: "postgresql://ccpun_admin_runtime:secret@ep-mute-frost-aztvz394-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
    vercelEnvironment: "preview", vercelProjectId: "prj_6tuUxJxYbQ4mpF7sMgNWx2p2jowN",
  };
  assert.equal(isAdminOperationsRuntimeIdentityValid(valid), true);
  for (const changed of [
    { environment: "production-admin" }, { projectId: "other" }, { branchId: "other" }, { database: "production" },
    { vercelEnvironment: "production" }, { vercelProjectId: "prj_other" },
    { connectionString: "postgresql://neondb_owner:secret@example.neon.tech/neondb" },
    { connectionString: "postgresql://ccpun_admin_runtime:secret@example.neon.tech/other" },
    { connectionString: "postgresql://ccpun_admin_runtime:secret@evil.example/neondb" },
    { connectionString: "postgresql://ccpun_admin_runtime:secret@ep-mute-frost-aztvz394-pooler.ap-southeast-1.aws.neon.tech/neondb" },
    { connectionString: "postgresql://ccpun_admin_runtime:secret@ep-cloned-branch-123456.ap-southeast-1.aws.neon.tech/neondb" },
  ]) assert.equal(isAdminOperationsRuntimeIdentityValid({ ...valid, ...changed }), false);
});

test("legacy audit backfill sanitizer removes nested and credential-shaped payloads", () => {
  assert.deepEqual(sanitizeLegacyAuditPayload({ status: "approved", token: "secret", rawProviderResponse: { password: "nested" } }), { status: "approved" });
  assert.equal(sanitizeLegacyAuditPayload({ nested: { authorization: "Bearer secret" } }), null);
});

test("backfill pre-validates every mapped row before building transaction queries", () => {
  const prepared = prepareBackfillInsert({
    _id: "auditLog.fixture", _rev: "fixture-revision", _type: "auditLog",
    actor: "owner@example.com", actorType: "human", action: "seo-audit:run",
    objectType: "article", objectId: "drafts.article.fixture", environment: "admin-uat",
    requestId: "11111111-1111-4111-8111-111111111111", timestamp: "2026-08-30T00:00:00.000Z",
    before: { status: "approved", token: "must-not-cross" },
  });
  assert.equal(prepared.type, "auditLog");
  assert.equal(prepared.params[6], JSON.stringify({ status: "approved" }));
  assert.throws(() => prepareBackfillInsert({
    _id: "auditLog.invalid", _rev: "fixture-revision", _type: "auditLog", actor: "", actorType: "human",
  }), /Invalid audit actor/);
  assert.throws(() => prepareBackfillInsert({
    _id: "researchSnapshot.invalid", _rev: "fixture-revision", _type: "researchSnapshot", keyword: "", provider: "manual",
  }), /Invalid research keyword/);
  assert.throws(() => prepareBackfillInsert({
    _id: "seoSuggestion.invalid", _rev: "fixture-revision", _type: "seoSuggestion",
    targetDocument: { _ref: "drafts.article.fixture" }, confidence: 2,
  }), /Invalid suggestion confidence/);
});

test("cross-store SEO apply claims Neon, patches one exact Draft revision, and fails closed to reconciliation", () => {
  const control = read("lib/admin/sanity-control.ts");
  const operations = read("lib/admin/operations/database.ts");
  assert.match(control, /claimAdminSuggestionApply[\s\S]*patchArticleSeoField[\s\S]*finalizeAdminSuggestionApply/);
  assert.match(control, /requireApplyReconciliation[\s\S]*sanity-result-ambiguous/);
  assert.match(control, /neon-finalize-ambiguous[\s\S]*APPLY_RECONCILIATION_REQUIRED/);
  assert.match(operations, /status='reconciliation-required',apply_state='reconciliation-required'/);
  assert.doesNotMatch(control, /\.publish\(/);
});

test("backfill defaults to dry-run and hard-pins the verified UAT identities and counts", () => {
  const script = read("scripts/backfill-sanity-admin-operations.ts");
  assert.match(script, /projectId: "ccb9lnw5", dataset: "uat"/);
  assert.match(script, /projectId: "young-term-47483330", branchId: "br-crimson-mouse-az7ajkv8", endpointId: "ep-mute-frost-aztvz394", database: "neondb"/);
  assert.match(script, /CURRENT_INVENTORY_BASELINE = \{ auditLog: 43, researchSnapshot: 2, seoSuggestion: 19 \}/);
  assert.match(script, /\(apply \|\| enforceCurrentInventory\) && !baselineMatches/);
  assert.match(script, /targetCounts\[type\] !== sourceCount/);
  assert.match(script, /targetDigest !== sourceDigest/);
  assert.match(script, /process\.env\.CCPUN_ADMIN_BACKFILL_DATABASE_URL/);
  assert.doesNotMatch(script, /process\.env\.CCPUN_ADMIN_DATABASE_URL/);
  assert.match(script, /\["neondb_owner", "cloud_admin"\]/);
  assert.match(script, /refuses ccpun_admin_runtime/);
  assert.match(script, /TARGET\.endpointId/);
  assert.match(script, /endpointHosts\.has\(connectionUrl\.hostname\)/);
  assert.match(script, /const apply = process\.argv\.includes\("--apply"\)/);
  assert.match(script, /--apply requires CCPUN_APP_ENV=local-uat/);
  assert.match(script, /source_hash_sha256=EXCLUDED\.source_hash_sha256/);
  assert.ok(script.indexOf("const prepared = documents.map(prepareBackfillInsert)") < script.indexOf("if (!apply) return"));
  assert.match(script, /prevalidatedRows: prepared\.length/);
  assert.match(script, /sql\.transaction\(\(transaction\) => \[/);
  assert.match(script, /isolationLevel: "Serializable"/);
  assert.match(script, /jsonb_to_recordset\(\$1::jsonb\)/);
  assert.match(script, /atomic_lineage_ok/);
  assert.match(script, /source_revision=EXCLUDED\.source_revision/);
  assert.doesNotMatch(script, /SANITY_API_READ_TOKEN\s*\|\|\s*SANITY_API_WRITE_TOKEN/);
});

test("runtime and executable scripts never create Sanity operational document types", () => {
  const root = new URL("../../", import.meta.url);
  const files: string[] = [];
  const walk = (relative: string) => {
    for (const name of readdirSync(new URL(relative, root))) {
      const child = `${relative}${name}`;
      if (statSync(new URL(child, root)).isDirectory()) walk(`${child}/`);
      else if (/\.(?:ts|tsx|mjs|js)$/.test(name)) files.push(child);
    }
  };
  for (const directory of ["lib/", "app/", "scripts/"]) walk(directory);
  const forbidden = /_type\s*:\s*["'](?:auditLog|researchSnapshot|seoSuggestion)["']/;
  for (const file of files) assert.doesNotMatch(read(file), forbidden, file);
});
