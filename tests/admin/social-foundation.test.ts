import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CCPUN_VERCEL_PROJECT_IDS } from "../../lib/admin/environment";
import {
  classifySocialDatabaseError,
  canTransitionPublicationStatus,
  isSocialDatabaseConnectionString,
  isSocialDatabaseSchemaCurrent,
  isSocialFoundationEnabled,
  SOCIAL_SCHEMA_MIGRATION_CHECKSUM,
  SOCIAL_SCHEMA_MIGRATION_VERSION,
  SOCIAL_FORMAT_MIGRATION_CHECKSUM,
  SOCIAL_FORMAT_MIGRATION_VERSION,
  SOCIAL_REQUIRED_OPERATIONAL_TABLES,
  SOCIAL_SELECTABLE_FORMATS,
  socialFormatSchema,
  socialMainPostFormatSchema,
  socialFoundationSnapshotSchema,
  SYNTHETIC_SOCIAL_FOUNDATION,
  WEBSITE_42_SANITY_DATASET,
  WEBSITE_42_SANITY_PROJECT_ID,
  WEBSITE_42_SOCIAL_BRANCH,
} from "../../lib/admin/social/foundation";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const enabledInput = {
  flag: "1",
  dataMode: "synthetic",
  environment: "admin-uat" as const,
  projectId: CCPUN_VERCEL_PROJECT_IDS.adminProduction,
  gitBranch: WEBSITE_42_SOCIAL_BRANCH,
  sanityProjectId: WEBSITE_42_SANITY_PROJECT_ID,
  sanityDataset: WEBSITE_42_SANITY_DATASET,
};

test("Social foundation requires the exact Admin UAT code and data plane", () => {
  assert.equal(isSocialFoundationEnabled(enabledInput), true);
  for (const change of [
    { flag: "true" },
    { dataMode: "live" },
    { environment: "production-admin" as const },
    { projectId: CCPUN_VERCEL_PROJECT_IDS.web },
    { gitBranch: "v4-production" },
    { gitBranch: "codex/website-42-social-foundation-v2-20260828" },
    { gitBranch: "codex/website-42-media-library-foundation-20260828" },
    { gitBranch: "codex/website-42-social-operations-core-20260828" },
    { gitBranch: "codex/unknown-preview" },
    { sanityProjectId: "kyfxgjnq" },
    { sanityDataset: "production" },
  ]) {
    assert.equal(isSocialFoundationEnabled({ ...enabledInput, ...change }), false, JSON.stringify(change));
  }
});

test("Synthetic fixtures validate media metadata without storage or provider state", () => {
  const result = socialFoundationSnapshotSchema.parse(SYNTHETIC_SOCIAL_FOUNDATION);
  assert.equal(result.mode, "synthetic-uat");
  assert.equal(result.variants.every((variant) => variant.masterContentId === result.masterContent.id), true);
  assert.equal(result.mediaAssets.length, 1);
  assert.equal(result.variants[0]?.mediaReferences[0]?.assetId, result.mediaAssets[0]?.id);
  assert.equal(result.variants[0]?.format, "image-post");
  assert.equal(result.variants[0]?.commentSeriesMode, "top-level");
  assert.equal(result.variants[0]?.commentSeries.length, 1);
  assert.equal(JSON.stringify(result).includes("accessToken"), false);
  assert.equal(JSON.stringify(result).includes("platformObjectId"), false);
  assert.equal(JSON.stringify(result).includes("storageUrl"), false);
});

test("Post format choices keep Comment Series as a Facebook child", () => {
  assert.equal(SOCIAL_SELECTABLE_FORMATS.includes("album"), true);
  assert.equal(SOCIAL_SELECTABLE_FORMATS.includes("live"), true);
  assert.equal((SOCIAL_SELECTABLE_FORMATS as readonly string[]).includes("comment-series"), false);
  assert.equal(socialMainPostFormatSchema.safeParse("comment-series").success, false);
  assert.equal(socialFormatSchema.parse("comment-series"), "comment-series");

  const schema = read("cms/sanity/schema/documents/social-variant.ts");
  assert.match(schema, /"image-post", "album", "carousel"/);
  assert.match(schema, /"photo-post", "live"/);
  assert.doesNotMatch(schema, /formatOptions[^\n]*comment-series/);
  assert.match(schema, /document\?\.channel !== "facebook"/);
  assert.match(schema, /name: "commentSeriesMode"/);
  assert.match(schema, /value: "threaded"/);
  assert.match(schema, /ลำดับ Comment ต้องไม่ซ้ำ/);

  const invalid = structuredClone(SYNTHETIC_SOCIAL_FOUNDATION);
  invalid.variants[1]!.commentSeries = invalid.variants[0]!.commentSeries;
  assert.equal(socialFoundationSnapshotSchema.safeParse(invalid).success, false);
});

test("Publication state transitions are explicit and terminal states stay terminal", () => {
  assert.equal(canTransitionPublicationStatus("draft", "approved"), true);
  assert.equal(canTransitionPublicationStatus("approved", "native-scheduled"), true);
  assert.equal(canTransitionPublicationStatus("failed", "queued"), true);
  assert.equal(canTransitionPublicationStatus("draft", "published"), false);
  assert.equal(canTransitionPublicationStatus("published", "draft"), false);
  assert.equal(canTransitionPublicationStatus("cancelled", "queued"), false);
});

test("Database readiness is read-only and returns sanitized categories", () => {
  assert.equal(isSocialDatabaseConnectionString("postgresql://user:pass@branch-pooler.neon.tech/db"), true);
  assert.equal(isSocialDatabaseConnectionString("postgresql://not-neon.example/db"), false);
  assert.equal(isSocialDatabaseConnectionString("not-a-url"), false);
  assert.equal(classifySocialDatabaseError({ code: "28P01", message: "credential detail" }).errorCategory, "authentication");
  assert.equal(classifySocialDatabaseError({ code: "42P01", message: "raw schema detail" }).errorCategory, "migration-missing");
  assert.equal(classifySocialDatabaseError({ name: "TimeoutError", message: "raw timeout" }).errorCategory, "timeout");

  const allTables = Object.fromEntries(SOCIAL_REQUIRED_OPERATIONAL_TABLES.map((table) => [table, true])) as Record<(typeof SOCIAL_REQUIRED_OPERATIONAL_TABLES)[number], boolean>;
  const currentInput = { ledgerCurrent: true, formatLedgerCurrent: true, mediaLedgerCurrent: true, tables: allTables };
  assert.equal(isSocialDatabaseSchemaCurrent(currentInput), true);
  assert.equal(isSocialDatabaseSchemaCurrent({ ...currentInput, ledgerCurrent: false }), false);
  assert.equal(isSocialDatabaseSchemaCurrent({ ...currentInput, formatLedgerCurrent: false }), false);
  assert.equal(isSocialDatabaseSchemaCurrent({ ...currentInput, mediaLedgerCurrent: false }), false);
  for (const table of SOCIAL_REQUIRED_OPERATIONAL_TABLES) {
    assert.equal(isSocialDatabaseSchemaCurrent({
      ...currentInput,
      tables: { ...allTables, [table]: false },
    }), false, table);
  }

  const source = read("lib/admin/social/database.ts");
  assert.match(source, /import "server-only"/);
  assert.match(source, /FROM ccpun_social\.schema_migration/);
  assert.match(source, /format_ledger_current/);
  assert.match(source, /media_ledger_current/);
  for (const table of SOCIAL_REQUIRED_OPERATIONAL_TABLES) assert.match(source, new RegExp(table));
  assert.doesNotMatch(source, /\b(?:INSERT|UPDATE|DELETE|ALTER|DROP)\b/i);
  assert.doesNotMatch(source, /console\./);
});

test("Post-format migration is additive and preserves legacy Comment Series rows", () => {
  const sql = read("db/migrations/20260829_website_42_social_post_formats.sql");
  const body = sql.split("-- checksum-source-begin\n")[1]?.split("-- checksum-source-end")[0];
  assert.ok(body);
  const checksum = `sha256:${createHash("sha256").update(body).digest("hex")}`;
  assert.equal(checksum, SOCIAL_FORMAT_MIGRATION_CHECKSUM);
  assert.match(sql, new RegExp(SOCIAL_FORMAT_MIGRATION_VERSION));
  assert.match(sql, new RegExp(SOCIAL_FORMAT_MIGRATION_CHECKSUM));
  assert.match(sql, /website_42_social_foundation_v2/);
  assert.match(sql, /DROP CONSTRAINT social_variant_link_format_check/);
  assert.match(sql, /'album'/);
  assert.match(sql, /'live'/);
  assert.match(sql, /'comment-series'/);
  assert.doesNotMatch(sql, /DROP TABLE|DELETE FROM|TRUNCATE/i);
});

test("Migration checksum covers the reviewed DDL and operational constraints", () => {
  const sql = read("db/migrations/20260828_website_42_social_foundation_v2.sql");
  const body = sql.split("-- checksum-source-begin\n")[1]?.split("-- checksum-source-end")[0];
  assert.ok(body);
  const checksum = `sha256:${createHash("sha256").update(body).digest("hex")}`;
  assert.equal(checksum, SOCIAL_SCHEMA_MIGRATION_CHECKSUM);
  assert.match(sql, new RegExp(SOCIAL_SCHEMA_MIGRATION_VERSION));
  assert.match(sql, new RegExp(SOCIAL_SCHEMA_MIGRATION_CHECKSUM));
  assert.match(sql, /schema_migration/);
  assert.match(sql, /social_variant_link/);
  assert.match(sql, /social_media_asset/);
  assert.match(sql, /UNIQUE \(checksum_sha256, byte_size\)/);
  assert.match(sql, /idempotency_key text NOT NULL UNIQUE/);
  assert.match(sql, /job_type text NOT NULL CHECK/);
  assert.match(sql, /lock_owner text/);
  assert.match(sql, /status = 'processing'[\s\S]*lock_expires_at > locked_at/);
  assert.match(sql, /status <> 'processing'[\s\S]*lock_owner IS NULL/);
  assert.match(sql, /FOREIGN KEY \(parent_item_id, publication_id\)/);
  assert.match(sql, /last_error_ref text CHECK/);
  assert.doesNotMatch(sql, /credential|refresh_token|access_token|encrypted_credentials/i);
});

test("Social API is authenticated, owner-scoped, exact-origin and read-only", () => {
  const route = read("app/api/admin/social/foundation/route.ts");
  const page = read("app/(control-plane)/social/page.tsx");
  assert.match(route, /getAdminIdentity\(\)/);
  assert.match(route, /hasAdminPermission\(identity\.role, "social:read"\)/);
  assert.match(route, /isConfiguredAdminOrigin\(request\.url, process\.env\.AUTH_URL\)/);
  assert.match(route, /export async function GET\(request: Request\)/);
  assert.doesNotMatch(route, /export async function (?:POST|PUT|PATCH|DELETE)/);
  assert.doesNotMatch(route, /publish|mutate|createClient/);
  assert.equal(page.trim(), 'export { metadata, default } from "@/features/admin/social/control-plane-page";');
});

test("Sanity keeps the canonical parent reference and excludes operational fields", () => {
  const master = read("cms/sanity/schema/documents/master-content.ts");
  const variant = read("cms/sanity/schema/documents/social-variant.ts");
  const comment = read("cms/sanity/schema/objects/social-comment-series-item.ts");
  assert.doesNotMatch(master, /name: "variants"/);
  assert.match(variant, /name: "masterContent"[\s\S]*?type: "reference"[\s\S]*?type: "masterContent"[\s\S]*?Rule\.required/);
  assert.match(variant, /type: "socialCommentSeriesItem"/);
  assert.match(comment, /name: "position"/);
  for (const source of [master, variant, comment]) {
    assert.doesNotMatch(source, /platformObjectId|idempotencyKey|publicationStatus|accessToken|refreshToken/);
  }
});
