import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  resolveSocialMarketingCapabilityMode,
  SOCIAL_MARKETING_MART_P2,
  SOCIAL_MARKETING_MART_PROVENANCE,
  SOCIAL_MARKETING_REQUIRED_RELATIONS,
} from "../../lib/admin/social/schema-capabilities";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("Marketing capability contract permits explicit UAT raw fallback but fails Production closed", () => {
  assert.equal(resolveSocialMarketingCapabilityMode({
    lane: "uat",
    martCurrent: false,
    provenanceCurrent: false,
    relationsCurrent: false,
  }), "raw-preview-fallback");
  assert.equal(resolveSocialMarketingCapabilityMode({
    lane: "production",
    martCurrent: false,
    provenanceCurrent: false,
    relationsCurrent: false,
  }), "blocked");
  assert.equal(resolveSocialMarketingCapabilityMode({
    lane: "uat",
    martCurrent: true,
    provenanceCurrent: true,
    relationsCurrent: true,
  }), "clean-mart");
  assert.equal(resolveSocialMarketingCapabilityMode({
    lane: "production",
    martCurrent: true,
    provenanceCurrent: true,
    relationsCurrent: true,
  }), "clean-mart");
});

test("Capability versions match the reviewed repository migrations", () => {
  assert.equal(SOCIAL_MARKETING_MART_P2.version, "20260902_social_marketing_mart_p2_full_backfill_clean");
  assert.equal(SOCIAL_MARKETING_MART_PROVENANCE.version, "20260902_social_marketing_mart_p2_metric_provenance");
  assert.equal(SOCIAL_MARKETING_MART_P2.checksum.startsWith("sha256:"), true);
  assert.equal(SOCIAL_MARKETING_MART_PROVENANCE.checksum.startsWith("sha256:"), true);
  assert.deepEqual([...SOCIAL_MARKETING_REQUIRED_RELATIONS], [
    "marketing_content_current",
    "post_metric_status_latest",
    "post_metric_coverage_summary",
    "post_performance_clean",
  ]);
});

test("System Health reads schema capability status without exposing credentials or mutating the database", () => {
  const database = read("lib/admin/social/database.ts");
  const health = read("app/(control-plane)/operations/health/page.tsx");
  assert.match(database, /getSocialDatabaseCapabilityStatus/);
  for (const relation of SOCIAL_MARKETING_REQUIRED_RELATIONS) assert.match(database, new RegExp(relation));
  assert.doesNotMatch(database, /console\./);
  assert.doesNotMatch(database, /\b(?:INSERT|UPDATE|DELETE|ALTER|DROP)\b/i);
  assert.match(health, /Social Schema Capabilities/);
  assert.match(health, /raw-preview-fallback/);
  assert.doesNotMatch(health, /CCPUN_SOCIAL_DATABASE_URL/);
});
