import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ADMIN_OPERATIONS_PRODUCTION_MIGRATION_CHECKSUM,
  ADMIN_OPERATIONS_PRODUCTION_MIGRATION_VERSION,
  isAdminOperationsRuntimeIdentityValid,
} from "../../lib/admin/operations/foundation";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("Production Admin operations migration is checksum locked and preserves scheduler grants", () => {
  const migration = read("db/migrations/20260913_admin_operations_production_v1.sql");
  const source = migration.split("-- checksum-source-begin\n")[1]?.split("-- checksum-source-end")[0];
  assert.ok(source);
  assert.equal(`sha256:${createHash("sha256").update(source).digest("hex")}`, ADMIN_OPERATIONS_PRODUCTION_MIGRATION_CHECKSUM);
  assert.match(migration, new RegExp(ADMIN_OPERATIONS_PRODUCTION_MIGRATION_VERSION));
  for (const identity of ["lively-bar-43618798", "br-long-resonance-b3ys5xrv", "ep-broad-butterfly-b3ro7u8w", "neondb"]) {
    assert.match(migration, new RegExp(identity));
  }
  for (const table of ["audit_log", "research_snapshot", "seo_suggestion", "system_identity", "schema_migration"]) {
    assert.match(migration, new RegExp(`ccpun_admin\\.${table}`));
  }
  assert.match(migration, /GRANT SELECT, INSERT ON ccpun_admin\.audit_log, ccpun_admin\.research_snapshot TO ccpun_admin_runtime/);
  assert.match(migration, /GRANT UPDATE \([\s\S]*\) ON ccpun_admin\.seo_suggestion TO ccpun_admin_runtime/);
  assert.doesNotMatch(migration, /REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA ccpun_admin FROM ccpun_admin_runtime/);
  assert.doesNotMatch(migration, /REVOKE[^;]*article_schedule[^;]*FROM ccpun_admin_runtime/);
});

test("Production Admin operations readback verifies scheduler coexistence", () => {
  const readback = read("db/migrations/20260913_admin_operations_production_v1_readback.sql");
  assert.match(readback, new RegExp(ADMIN_OPERATIONS_PRODUCTION_MIGRATION_CHECKSUM.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(readback, /AS scheduler_grants_preserved/);
  assert.match(readback, /table_name = 'article_schedule'/);
  assert.match(readback, /AS social_objects_denied/);
  assert.match(readback, /AS seo_update_columns_ok/);
});

test("runtime identity accepts only the exact Production Admin lane", () => {
  const valid = {
    environment: "production-admin",
    projectId: "lively-bar-43618798",
    branchId: "br-long-resonance-b3ys5xrv",
    database: "neondb",
    connectionString: "postgresql://ccpun_admin_runtime:secret@ep-broad-butterfly-b3ro7u8w.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
    vercelEnvironment: "production",
    gitBranch: "v4-production",
    vercelProjectId: "prj_admin",
    productionAdminProjectId: "prj_admin",
  };
  assert.equal(isAdminOperationsRuntimeIdentityValid(valid), true);
  for (const changed of [
    { environment: "admin-uat" },
    { projectId: "young-term-47483330" },
    { branchId: "br-crimson-mouse-az7ajkv8" },
    { vercelEnvironment: "preview" },
    { gitBranch: "feature/admin" },
    { vercelProjectId: "prj_other" },
    { connectionString: "postgresql://ccpun_admin_runtime:secret@ep-mute-frost-aztvz394.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require" },
    { connectionString: "postgresql://neondb_owner:secret@ep-broad-butterfly-b3ro7u8w.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require" },
  ]) assert.equal(isAdminOperationsRuntimeIdentityValid({ ...valid, ...changed }), false);
});

test("Production legacy backfill is dry-run by default and exact-source guarded", () => {
  const script = read("scripts/backfill-production-sanity-admin-operations.ts");
  assert.match(script, /projectId: "kyfxgjnq", dataset: "production"/);
  assert.match(script, /projectId: "lively-bar-43618798"/);
  assert.match(script, /branchId: "br-long-resonance-b3ys5xrv"/);
  assert.match(script, /endpointId: "ep-broad-butterfly-b3ro7u8w"/);
  assert.match(script, /const apply = process\.argv\.includes\("--apply"\)/);
  assert.match(script, /--expect-source-digest=/);
  assert.match(script, /CCPUN_APP_ENV !== "local-production"/);
  assert.match(script, /CCPUN_ADMIN_BACKFILL_DATABASE_URL/);
  assert.match(script, /\["neondb_owner", "cloud_admin"\]/);
  assert.match(script, /refuses ccpun_admin_runtime/);
  assert.match(script, /scheduler_grants_preserved/);
  assert.match(script, /prepareBackfillInsert/);
  assert.doesNotMatch(script, /SANITY_API_WRITE_TOKEN/);
});

test("owner-facing Admin surfaces health and explicit SEO re-audit", () => {
  const layout = read("app/(control-plane)/layout.tsx");
  const health = read("app/(control-plane)/operations/health/page.tsx");
  const audit = read("app/(control-plane)/operations/audit-log/page.tsx");
  const button = read("features/admin/components/RunSeoAuditButton.tsx");
  assert.match(layout, /\/operations\/health\//);
  assert.match(layout, /permission: "settings:read"/);
  assert.match(health, /Vercel Runtime/);
  assert.match(health, /Control Plane Operations/);
  assert.match(audit, /ฐานข้อมูล Control Plane/);
  assert.match(button, /ตรวจ SEO อีกครั้ง/);
});
