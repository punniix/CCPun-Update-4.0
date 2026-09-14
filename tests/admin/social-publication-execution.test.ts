import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  SOCIAL_COMMENT_EXECUTION_MIGRATION_CHECKSUM,
  SOCIAL_COMMENT_EXECUTION_MIGRATION_VERSION,
  SOCIAL_PUBLICATION_EXECUTION_MIGRATION_CHECKSUM,
  SOCIAL_PUBLICATION_EXECUTION_MIGRATION_VERSION,
  canAdvanceSocialVariantProjection,
  isSocialPublicationApprovalEnabled,
  isSocialProviderExecutionGateEnabled,
  socialExecutionIdempotencyKey,
} from "../../lib/admin/social/publishing";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const migration = read("db/migrations/20260901_website_42_social_publication_execution_v1.sql");
const readback = read("db/migrations/20260901_website_42_social_publication_execution_v1_readback.sql");
const commentMigration = read("db/migrations/20260901_website_42_social_comment_execution_v1.sql");
const commentReadback = read("db/migrations/20260901_website_42_social_comment_execution_v1_readback.sql");

test("Social publication execution migration is identity-pinned and checksum locked", () => {
  const source = migration.split("-- checksum-source-begin\n")[1]?.split("-- checksum-source-end")[0];
  assert.ok(source);
  assert.equal(`sha256:${createHash("sha256").update(source).digest("hex")}`, SOCIAL_PUBLICATION_EXECUTION_MIGRATION_CHECKSUM);
  assert.match(migration, new RegExp(SOCIAL_PUBLICATION_EXECUTION_MIGRATION_VERSION));
  assert.equal((migration.match(new RegExp(SOCIAL_PUBLICATION_EXECUTION_MIGRATION_CHECKSUM, "g")) ?? []).length, 2);
  for (const identity of ["young-term-47483330", "br-crimson-mouse-az7ajkv8", "ep-mute-frost-aztvz394", "neondb"]) {
    assert.match(migration, new RegExp(identity));
  }
  assert.match(migration, /social_mobile_handoff/);
  assert.match(migration, /instagram-mobile-handoff/);
  assert.match(migration, /approved_revision/);
  assert.match(migration, /approval_request_ref/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1/);
  assert.match(migration, /DROP CONSTRAINT IF EXISTS social_publication_execution_target_check/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS social_publication_approved_snapshot_unique/);
  assert.match(migration, /'link-post'/);
  assert.match(readback, /BEGIN READ ONLY/);
  assert.match(readback, /audit_select_denied/);
  for (const denial of ["delete_denied", "truncate_denied", "references_denied", "trigger_denied", "table_wide_update_denied", "sequences_denied", "schema_create_denied", "database_create_denied"]) {
    assert.match(readback, new RegExp(denial));
  }
  assert.match(readback, new RegExp(SOCIAL_PUBLICATION_EXECUTION_MIGRATION_CHECKSUM));
});

test("Comment execution privileges ship as an additive checksum-locked migration", () => {
  const source = commentMigration.split("-- checksum-source-begin\n")[1]?.split("-- checksum-source-end")[0];
  assert.ok(source);
  assert.equal(`sha256:${createHash("sha256").update(source).digest("hex")}`, SOCIAL_COMMENT_EXECUTION_MIGRATION_CHECKSUM);
  assert.equal((commentMigration.match(new RegExp(SOCIAL_COMMENT_EXECUTION_MIGRATION_CHECKSUM, "g")) ?? []).length, 2);
  assert.match(commentMigration, new RegExp(SOCIAL_COMMENT_EXECUTION_MIGRATION_VERSION));
  assert.match(commentMigration, new RegExp(SOCIAL_PUBLICATION_EXECUTION_MIGRATION_CHECKSUM));
  assert.match(commentMigration, /GRANT UPDATE \(status, platform_comment_id, updated_at\)/);
  assert.match(commentReadback, /BEGIN READ ONLY/);
  for (const result of ["comment_select", "comment_insert", "comment_status_update", "comment_platform_id_update",
    "comment_delete_denied", "comment_truncate_denied", "comment_references_denied", "comment_trigger_denied",
    "comment_table_wide_update_denied"]) assert.match(commentReadback, new RegExp(result));
  assert.match(commentReadback, new RegExp(SOCIAL_COMMENT_EXECUTION_MIGRATION_CHECKSUM));
});

test("One approved snapshot retains one execution identity when only its schedule changes", () => {
  const base = {
    variantId: "socialVariant-001",
    approvedRevision: "rev-1",
    approvedVersion: 1,
    executionTarget: "facebook-native-scheduled" as const,
  };
  assert.equal(
    socialExecutionIdempotencyKey({ ...base, scheduledAt: "2026-09-02T00:00:00.000Z" }),
    socialExecutionIdempotencyKey({ ...base, scheduledAt: "2026-09-03T00:00:00.000Z" }),
  );
  const store = read("lib/admin/social/publishing-store.ts");
  assert.match(store, /publication\.variant_id=\$1 AND publication\.approved_revision=\$2 AND publication\.approved_version=\$3/);
  assert.match(store, /FOR UPDATE OF publication,job/);
  assert.match(store, /job\.version=\$3/);
  assert.match(store, /job\.attempt_count=0/);
  assert.match(store, /existing\.attempt_count === 0/);
  assert.match(store, /publication:amend/);
  assert.match(store, /scheduled_at=\$5::timestamptz/);
});

test("Operational database stores references and handoff metadata, never editorial bodies or credentials", () => {
  const store = read("lib/admin/social/publishing-store.ts");
  assert.match(store, /reviewStatus: z\.literal\("approved"\)/);
  assert.match(store, /editorial_revision=\$7 AND editorial_version=\$8/);
  assert.match(store, /EXCLUDED\.editorial_version > ccpun_social\.social_variant_link\.editorial_version/);
  assert.match(store, /editorial_version=EXCLUDED\.editorial_version,format=EXCLUDED\.format/);
  assert.match(store, /social_variant_media/);
  assert.doesNotMatch(migration, /caption|script|access_token|refresh_token|media_bytes/i);
  assert.doesNotMatch(store, /INSERT[\s\S]*caption|INSERT[\s\S]*script|accessToken|refreshToken/);
});

test("Approved variant projection advances to a newer version and rejects stale or cross-content overwrites", () => {
  const existing = { masterContentId: "master-001", platform: "facebook", revision: "rev-1", version: 1 };
  assert.equal(canAdvanceSocialVariantProjection({ existing, approved: { ...existing, revision: "rev-2", version: 2 } }), true);
  assert.equal(canAdvanceSocialVariantProjection({ existing: { ...existing, revision: "rev-2", version: 2 }, approved: existing }), false);
  assert.equal(canAdvanceSocialVariantProjection({ existing, approved: { ...existing, revision: "rev-other" } }), false);
  assert.equal(canAdvanceSocialVariantProjection({ existing, approved: { ...existing, masterContentId: "master-other", version: 2 } }), false);
});

test("Approval runtime is exact UAT, branch and runtime-role gated", () => {
  const env = {
    CCPUN_SOCIAL_OPERATIONS_ENABLED: "1",
    CCPUN_APP_ENV: "admin-uat",
    VERCEL_PROJECT_ID: "prj_6tuUxJxYbQ4mpF7sMgNWx2p2jowN",
    VERCEL_GIT_COMMIT_REF: "codex/website-42-social-analytics-ingestion-20260831",
    NEXT_PUBLIC_SANITY_PROJECT_ID: "ccb9lnw5",
    NEXT_PUBLIC_SANITY_DATASET: "uat",
    CCPUN_SOCIAL_DATABASE_URL: "postgresql://ccpun_social_runtime:secret@ep-mute-frost-aztvz394-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb",
  };
  assert.equal(isSocialPublicationApprovalEnabled(env), true);
  assert.equal(isSocialProviderExecutionGateEnabled(env), false);
  assert.equal(isSocialProviderExecutionGateEnabled({ ...env, CCPUN_SOCIAL_PROVIDER_WRITES_ENABLED: "1" }), true);
  assert.equal(isSocialPublicationApprovalEnabled({ ...env, CCPUN_APP_ENV: "local-production" }), false);
  assert.equal(isSocialPublicationApprovalEnabled({ ...env, VERCEL_GIT_COMMIT_REF: "main" }), false);
  assert.equal(isSocialPublicationApprovalEnabled({ ...env, CCPUN_SOCIAL_DATABASE_URL: env.CCPUN_SOCIAL_DATABASE_URL.replace("ccpun_social_runtime", "neondb_owner") }), false);
  const source = read("lib/admin/social/publishing.ts");
  for (const duplicate of ["CCPUN_NEON_PROJECT_ID", "CCPUN_NEON_BRANCH_ID", "CCPUN_NEON_ENDPOINT_ID", "CCPUN_NEON_DATABASE", "CCPUN_SOCIAL_PUBLICATION_APPROVAL_ENABLED"]) {
    assert.doesNotMatch(source, new RegExp(duplicate));
  }
});

test("Approval API is owner-only, same-origin, validated and never calls a provider", () => {
  const route = read("app/api/admin/social/publications/route.ts");
  assert.match(route, /export async function GET/);
  assert.match(route, /listApprovedSocialVariants/);
  assert.match(route, /hasAdminPermission\(identity\.role, "social:read"\)/);
  assert.match(route, /identity\.actorType !== "human" \|\| identity\.role !== "owner"/);
  assert.match(route, /isSameOriginAdminMutation/);
  assert.match(route, /socialPublicationApprovalRequestSchema\.safeParse/);
  assert.doesNotMatch(route, /graph\.facebook|facebook\.com|instagram\.com|setInterval|cron|n8n/i);
});

test("Approved-variant loader keeps editorial fields in Sanity and joins only operational publication state", () => {
  const store = read("lib/admin/social/publishing-store.ts");
  assert.match(store, /review\.status == "approved"/);
  assert.match(store, /"revision": _rev/);
  assert.match(store, /title,[\s\S]*"caption": coalesce\(caption, null\)/);
  assert.match(store, /"mediaMetadata": coalesce\(mediaReferences/);
  assert.match(store, /"commentSeries": coalesce\(commentSeries\[\] \| order\(position asc\)/);
  assert.match(store, /INSERT INTO ccpun_social\.social_comment_item/);
  assert.match(store, /approved_revision=\$6 AND approved_version=\$7/);
  assert.match(store, /assertApprovedCommentBinding/);
  assert.match(store, /SELECT DISTINCT ON \(publication\.variant_id\)[\s\S]*FROM ccpun_social\.social_publication/);
  assert.match(store, /LEFT JOIN LATERAL[\s\S]*social_publication_job/);
  assert.match(store, /jobVersion: publication\.job_version/);
  assert.doesNotMatch(store, /INSERT INTO ccpun_social\.[^(]+\([^)]*(caption|title|script)/i);
});
