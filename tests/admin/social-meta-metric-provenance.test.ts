import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const version = "20260902_social_marketing_mart_p2_metric_provenance";
const checksum = "sha256:5b421a7bb67798d6b45911c1b05e3f54bc9f50c0482b48857f6780e7379ef866";

test("Meta metric provenance migration is checksum-locked and additive", () => {
  const migration = read("db/migrations/20260902_social_marketing_mart_p2_metric_provenance.sql");
  const source = migration.split("-- checksum-source-begin\n")[1]?.split("-- checksum-source-end")[0];
  assert.ok(source);
  assert.equal(`sha256:${createHash("sha256").update(source).digest("hex")}`, checksum);
  assert.match(migration, new RegExp(version));
  assert.match(migration, /20260902_social_marketing_mart_p2_full_backfill_clean/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS collection_profile/);
  assert.match(migration, /CREATE OR REPLACE VIEW ccpun_social\.post_metric_status_latest/);
  for (const destructive of [
    /DROP TABLE/i,
    /TRUNCATE/i,
    /DELETE FROM ccpun_social\.social_provider_/i,
    /UPDATE ccpun_social\.social_provider_metric_snapshot/i,
    /ALTER TABLE ccpun_social\.social_provider_content/i,
    /ALTER TABLE ccpun_social\.social_provider_metric_snapshot/i,
  ]) assert.doesNotMatch(migration, destructive);
  assert.doesNotMatch(source, /access.?token|refresh.?token|client.?secret/i);
});

test("Base collector and Insights collector capabilities have distinct provenance profiles", () => {
  const migration = read("db/migrations/20260902_social_marketing_mart_p2_metric_provenance.sql");
  assert.match(migration, /metric_key IN \('reactions_total','comments_total','shares'\)[\s\S]*'meta-base-content-v1'/);
  assert.match(migration, /metric_key IN \('likes','comments_total'\)[\s\S]*'meta-base-content-v1'/);
  assert.match(migration, /'views','clicks','reaction_like','reaction_love','reaction_care'/);
  assert.match(migration, /'views','reach','saves','shares','total_interactions'/);
  assert.match(migration, /THEN 'meta-p1-insights-v1'/);
});

test("Latest metric status maps base omissions to not-returned and reserves not-fetched for unattempted Insights", () => {
  const migration = read("db/migrations/20260902_social_marketing_mart_p2_metric_provenance.sql");
  assert.match(migration, /capability\.collection_profile = 'meta-base-content-v1'[\s\S]*observation\.native_metric_key IS NOT NULL THEN 'available'/);
  assert.match(migration, /capability\.collection_profile = 'meta-base-content-v1'[\s\S]*snapshot\.snapshot_id IS NOT NULL THEN 'not_returned'/);
  assert.match(migration, /capability\.collection_profile = 'meta-p1-insights-v1' THEN 'not_fetched'/);
  assert.match(migration, /attempted\.metric_status = 'available'[\s\S]*observation\.native_metric_key IS NOT NULL THEN 'available'/);
  assert.match(migration, /attempted\.metric_status = 'available' THEN 'fetch_error'/);
  assert.match(migration, /metric_value_stale/);
  assert.doesNotMatch(migration, /COALESCE\(observation\.metric_value,\s*0\)/i);
});

test("Provenance readback verifies Facebook Share semantics and clean-mart safety", () => {
  const readback = read("db/migrations/20260902_social_marketing_mart_p2_metric_provenance_readback.sql");
  assert.match(readback, new RegExp(version));
  assert.match(readback, new RegExp(checksum.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(readback, /facebook_share_not_fetched_eliminated/);
  assert.match(readback, /facebook_share_not_returned_present/);
  assert.match(readback, /no_stale_meta_values/);
  assert.match(readback, /post_performance_clean[\s\S]*marketing_content_current/);
  assert.match(readback, /count\(DISTINCT content_id\)/);
  assert.doesNotMatch(readback, /count\(\*\) = 380/);
  assert.match(readback, /runtime_status_read_ok/);
  assert.match(readback, /runtime_coverage_read_ok/);
  assert.match(readback, /runtime_clean_read_ok/);
});

test("Production bootstrap includes provenance migration and requires eleven Social migrations", () => {
  const cwd = new URL("../..", import.meta.url);
  const bootstrap = execFileSync(process.execPath, ["scripts/build-social-production-bootstrap.mjs"], { cwd, encoding: "utf8" });
  const readback = execFileSync(process.execPath, ["scripts/build-social-production-bootstrap.mjs", "--readback"], { cwd, encoding: "utf8" });
  assert.match(bootstrap, new RegExp(version));
  assert.match(bootstrap, new RegExp(checksum.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(readback, /count\(\*\) = 11/);
  assert.match(readback, new RegExp(version));
});

test("Backfill and Sheets fail closed until provenance migration is current", () => {
  const backfill = read("lib/admin/social/providers/meta/full-backfill.ts");
  const sheets = read("lib/admin/social/sheets-export.ts");
  for (const source of [backfill, sheets]) {
    assert.match(source, new RegExp(version));
    assert.match(source, new RegExp(checksum.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(source, /provenance_current/);
  }
  assert.match(backfill, /!row\.provenance_current/);
  assert.match(sheets, /!row\.provenance_current/);
});

test("Sheets presentation states that raw tabs remain and clean marketing tabs are added", () => {
  const component = read("features/admin/social/SocialSheetsExport.tsx");
  assert.match(component, /ชีตสรุปโพสต์ ความครอบคลุม และข้อมูลสำหรับตรวจคุณภาพ/);
  assert.match(component, /สร้าง Google Sheets/);
});
