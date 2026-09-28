import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("source timing is checksum-locked, bounded to the last finished attempt, and hidden while running", () => {
  const migration = read("db/migrations/20260928_analytics_source_timing_v1.sql");
  const body = migration.split("-- checksum-source-begin\n")[1]?.split("-- checksum-source-end")[0];
  assert.ok(body);
  const checksum = createHash("sha256").update(body).digest("hex");
  assert.equal(migration.split(`sha256:${checksum}`).length - 1, 2);
  assert.ok(migration.includes(`checksum<>'sha256:${checksum}'`));
  assert.ok(migration.includes(`'sha256:${checksum}') ON CONFLICT`));
  assert.match(body, /status IN\('completed','failed'\) AND completed_at<=p_cutoff/);
  assert.match(body, /greatest\(0,round\(extract\(epoch FROM completed_at-attempted_at\)\*1000\)\)::bigint/);
  assert.match(body, /'lastAttemptDurationMs',a\.duration_ms/);
  assert.doesNotMatch(migration, /GRANT\s+(?:SELECT|INSERT|UPDATE|DELETE)\s+ON/i);
  const page = read("features/admin/analytics/StoredAnalyticsDashboard.tsx");
  assert.match(page, /lastAttemptDurationMs != null && item\.lastAttemptStatus !== "running"/);
  assert.match(page, /รอบล่าสุดใช้เวลา/);
});
