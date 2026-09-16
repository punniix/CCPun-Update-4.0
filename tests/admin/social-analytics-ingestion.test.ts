import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const migrationVersion = "20260831_website_42_social_analytics_ingestion";
const migrationChecksum = "sha256:ea2ba4d0a028569cbc53cc2fe7cdcdb0ecfa1df3ae777ef7baadf9aa08b9950c";
const historyMigrationVersion = "20260901_website_42_social_provider_native_history";
const historyMigrationChecksum = "sha256:cc4c2516ad261983d3d3997796711fb9b0290afe8625ab82fc002f4536bc549c";

test("analytics ingestion delegates exact UAT and Production identity to the centralized runtime", () => {
  const service = read("lib/admin/social/analytics-ingestion.ts");
  for (const required of [
    /CCPUN_SOCIAL_ANALYTICS_INGESTION_ENABLED === "1"/,
    /WEBSITE_42_SOCIAL_ANALYTICS_BRANCH/,
    /resolveSocialRuntime/,
    /requireUatNeon: true/,
    /runtime\.neonIdentity/,
  ]) assert.match(service, required);
  for (const duplicate of ["CCPUN_NEON_PROJECT_ID", "CCPUN_NEON_BRANCH_ID", "CCPUN_NEON_ENDPOINT_ID", "CCPUN_NEON_DATABASE"]) {
    assert.doesNotMatch(service, new RegExp(duplicate));
  }
  assert.match(service, /identity_current/);
  assert.match(service, /SOCIAL_ANALYTICS_MIGRATION_CHECKSUM/);
  assert.match(service, /SOCIAL_PROVIDER_HISTORY_MIGRATION_CHECKSUM/);
  assert.match(service, /import "server-only"/);
});

test("analytics migration is checksum-locked, UAT-identified and least privilege", () => {
  const migration = read("db/migrations/20260831_website_42_social_analytics_ingestion.sql");
  const source = migration.split("-- checksum-source-begin\n")[1]?.split("-- checksum-source-end")[0];
  assert.ok(source);
  assert.equal(`sha256:${createHash("sha256").update(source).digest("hex")}`, migrationChecksum);
  assert.match(migration, new RegExp(migrationVersion));
  for (const identity of ["young-term-47483330", "br-crimson-mouse-az7ajkv8", "ep-mute-frost-aztvz394", "neondb"]) assert.match(migration, new RegExp(identity));
  for (const table of ["system_identity", "social_metric_snapshot", "social_provider_sync_state"]) assert.match(migration, new RegExp(`ccpun_social\\.${table}`));
  assert.match(migration, /GRANT UPDATE \(cursor, status, last_attempt_at, last_success_at, last_error_category, updated_at\)/);
  assert.match(migration, /IF NOT EXISTS \(SELECT 1 FROM pg_roles WHERE rolname = 'ccpun_social_runtime'\)/);
  assert.doesNotMatch(migration, /CREATE ROLE|DROP TABLE|DELETE FROM|TRUNCATE/i);
  assert.doesNotMatch(source, /access.?token|refresh.?token|client.?secret/i);
});

test("Production bootstrap is atomic, Production-identified and keeps frozen UAT migrations untouched", () => {
  const cwd = new URL("../..", import.meta.url);
  const bootstrap = execFileSync(process.execPath, ["scripts/build-social-production-bootstrap.mjs"], { cwd, encoding: "utf8" });
  const readback = execFileSync(process.execPath, ["scripts/build-social-production-bootstrap.mjs", "--readback"], { cwd, encoding: "utf8" });
  for (const identity of ["lively-bar-43618798", "br-long-resonance-b3ys5xrv", "ep-broad-butterfly-b3ro7u8w", "neondb"]) {
    assert.match(bootstrap, new RegExp(identity));
    assert.match(readback, new RegExp(identity));
  }
  for (const uatIdentity of ["young-term-47483330", "br-crimson-mouse-az7ajkv8", "ep-mute-frost-aztvz394"]) {
    assert.doesNotMatch(bootstrap, new RegExp(uatIdentity));
  }
  assert.equal((bootstrap.match(/^BEGIN;$/gm) ?? []).length, 1);
  assert.equal((bootstrap.match(/^COMMIT;$/gm) ?? []).length, 1);
  assert.match(bootstrap, /20260901_website_42_social_analytics_ingestion_production/);
  assert.match(bootstrap, /sha256:ef14d2a6c6c86ce16610fb63d73e46e647fc60f3233e1c20b0489b422899e76e/);
  assert.match(readback, /runtime_role_restricted/);
  assert.match(readback, /NOT role\.rolinherit/);
  assert.match(readback, /pg_auth_members/);
  assert.match(readback, /unsafe_publication_grants_denied/);
  for (const privilege of ["DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"]) {
    assert.match(readback, new RegExp(`has_table_privilege\\('ccpun_social_runtime',[\\s\\S]*'${privilege}'\\)`));
  }
});

test("readback avoids broad catalog checks and verifies every write boundary", () => {
  const readback = read("db/migrations/20260831_website_42_social_analytics_ingestion_readback.sql");
  for (const field of ["database_ok", "checksum_ok", "identity_ok", "runtime_role_restricted", "required_grants_ok", "sync_update_columns_ok", "unrelated_tables_denied", "sequences_denied", "unsafe_grants_denied"]) {
    assert.match(readback, new RegExp(field));
  }
  assert.match(readback, /column_name::text/);
  assert.match(readback, /namespace\.nspname = 'ccpun_social'[\s\S]*relation\.relkind = 'S'/);
  assert.doesNotMatch(readback, /pg_toast/);
});

test("provider-native history is additive, checksum-locked and change-only", () => {
  const migration = read("db/migrations/20260901_website_42_social_provider_native_history.sql");
  const source = migration.split("-- checksum-source-begin\n")[1]?.split("-- checksum-source-end")[0];
  assert.ok(source);
  assert.equal(`sha256:${createHash("sha256").update(source).digest("hex")}`, historyMigrationChecksum);
  assert.match(migration, new RegExp(historyMigrationVersion));
  for (const table of ["social_provider_content", "social_provider_content_revision", "social_provider_metric_snapshot"]) {
    assert.match(migration, new RegExp(`ccpun_social\\.${table}`));
  }
  assert.match(migration, /UNIQUE \(content_id, content_hash\)/);
  assert.match(migration, /UNIQUE \(content_id, metrics_hash\)/);
  assert.match(migration, /backfill_completed_at/);
  assert.match(migration, /last_window_start_at/);
  assert.doesNotMatch(source, /access.?token|refresh.?token|client.?secret/i);
  assert.doesNotMatch(migration, /DROP TABLE|DELETE FROM|TRUNCATE/i);

  const service = read("lib/admin/social/analytics-ingestion.ts");
  assert.match(read("lib/admin/social/runtime.ts"), new RegExp(historyMigrationVersion));
  assert.match(service, /META_METRICS_OVERLAP_DEFAULT_DAYS = 30/);
  assert.match(service, /META_METRICS_OVERLAP_MAX_DAYS = 180/);
  assert.match(service, /META_METADATA_REFRESH_DEFAULT_DAYS = 2/);
  assert.match(service, /META_METADATA_REFRESH_BATCH_DEFAULT = 100/);
  assert.match(service, /CCPUN_META_METRICS_OVERLAP_DAYS/);
  assert.doesNotMatch(service, /14 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(service, /ON CONFLICT \(content_id,content_hash\) DO NOTHING/);
  assert.match(service, /ON CONFLICT \(content_id,metrics_hash\) DO NOTHING/);
  assert.match(service, /latestMetricHash[\s\S]*metricsHash/);
  assert.match(service, /providerContentsSeen/);
});

test("manual provider persistence stays human-only, same-origin and provider-write free", () => {
  const route = read("app/api/admin/social/analytics/sync/[provider]/route.ts");
  const service = read("lib/admin/social/analytics-ingestion.ts");
  const panel = read("features/admin/social/provider-readonly-panels.tsx");
  const dashboard = read("features/admin/social/analytics-page.tsx");
  assert.match(route, /getAdminIdentity\(\)/);
  assert.match(route, /identity\.actorType !== "human"/);
  assert.match(route, /hasAdminPermission\(identity\.role, "social:read"\)/);
  assert.match(route, /isSameOriginAdminMutation\(request\.url, request\.headers\.get\("origin"\)\)/);
  assert.match(route, /socialAnalyticsProviderSchema\.safeParse/);
  assert.match(route, /export async function POST\(request: Request/);
  assert.match(route, /code === "28P01"[\s\S]*database-auth-required/);
  assert.match(route, /code === "42501"[\s\S]*database-forbidden/);
  assert.match(route, /\["3D000", "3F000", "42P01"\][\s\S]*database-not-ready/);
  assert.match(route, /"sourceError" in error[\s\S]*\[social-analytics-db\]/);
  assert.doesNotMatch(route, /console\.error\([^\n]*error\.message/);
  assert.doesNotMatch(route, /export async function (?:GET|PUT|PATCH|DELETE)/);
  assert.match(service, /variant\.channel IN \('facebook','instagram','youtube','tiktok'\)/);
  assert.match(service, /fetchMetaReadOnlyDiscovery/);
  assert.match(service, /fetchYouTubeReadOnlyDiscovery/);
  assert.match(service, /fetchTikTokReadOnlyDiscovery/);
  assert.match(service, /ON CONFLICT \(id\) DO NOTHING/);
  assert.match(service, /collection_mode/);
  assert.doesNotMatch(service, /video\.upload|video\.publish|setInterval|cron/);
  assert.match(panel, /Sync และบันทึกสถิติย้อนหลัง/);
  assert.match(panel, /Metrics overlap/);
  assert.match(panel, /Refresh metadata/);
  assert.match(dashboard, /ไม่รวม Views\/Reach ข้ามแพลตฟอร์ม/);
  assert.match(dashboard, /metric\.delta/);
});

test("Unified dashboard includes every current provider-content row and exact-dedupes linked snapshots", () => {
  const service = read("lib/admin/social/analytics-ingestion.ts");
  const dashboard = read("features/admin/social/analytics-page.tsx");
  assert.match(service, /FROM ccpun_social\.social_provider_content AS content/);
  assert.match(service, /SOCIAL_ANALYTICS_DASHBOARD_CONTENT_LIMIT = 10_000/);
  assert.match(service, /ORDER BY content\.published_at DESC LIMIT \$1[\s\S]*SOCIAL_ANALYTICS_DASHBOARD_CONTENT_LIMIT/);
  assert.match(service, /LEFT JOIN LATERAL[\s\S]*ORDER BY snapshot\.fetched_at DESC LIMIT 1/);
  assert.match(service, /OFFSET 1 LIMIT 1/);
  assert.match(service, /content\.linked_publication_id/);
  assert.match(service, /format: content\.media_type/);
  assert.match(service, /mediaType: content\.media_type/);
  assert.match(service, /text: content\.text_content\.trim\(\) \|\| null/);
  assert.match(service, /permalink: safeProviderUrl\(content\.permalink_url/);
  assert.match(service, /thumbnail: safeProviderUrl\(content\.thumbnail_url/);
  assert.match(service, /publishedAt: content\.published_at\.toISOString\(\)/);
  assert.match(service, /providerObjects[\s\S]*provider[\s\S]*platform[\s\S]*platformObjectId/);
  assert.match(service, /publicationItems\.filter/);
  assert.doesNotMatch(service, /social_provider_content[\s\S]{0,500}LIMIT (?:379|400)\b/);
  assert.doesNotMatch(dashboard, /SYNTHETIC_SOCIAL_OPERATIONS|formatByPublication/);
});

test("dashboard suppresses stored non-HTTPS and non-provider URLs before rendering", () => {
  const service = read("lib/admin/social/analytics-ingestion.ts");
  assert.match(service, /function safeProviderUrl/);
  assert.match(service, /url\.protocol === "https:"/);
  assert.match(service, /host\.endsWith\(`\.\$\{domain\}`\)/);
  assert.match(service, /permalink: safeProviderUrl\(content\.permalink_url, content\.platform, "permalink"\)/);
  assert.match(service, /thumbnail: safeProviderUrl\(content\.thumbnail_url, content\.platform, "thumbnail"\)/);
});

test("Every manual Meta sync upserts newly discovered unlinked content without a fixed baseline count", () => {
  const service = read("lib/admin/social/analytics-ingestion.ts");
  assert.match(service, /providerContents\.flatMap/);
  assert.match(service, /linkedPublicationId: linked\.get\([\s\S]*\) \?\? null/);
  assert.match(service, /ON CONFLICT \(provider,platform,provider_object_id\) DO UPDATE SET/);
  assert.match(service, /fetchMetaContentMetadataByIds/);
  assert.match(service, /metadataRefreshBatchSize/);
  assert.match(service, /ORDER BY \(thumbnail_url IS NULL\) ASC,GREATEST\(last_seen_at,updated_at\) ASC,published_at DESC/);
  assert.match(service, /metadataRefreshUnavailableTargets\.map[\s\S]*SET updated_at=now\(\)/);
  assert.doesNotMatch(service, /fetchMetaReadOnlyDiscovery\(env, fetcher, \{ since: null, includeInsights: false \}\)/);
  assert.doesNotMatch(service, /\b379\b/);
});
