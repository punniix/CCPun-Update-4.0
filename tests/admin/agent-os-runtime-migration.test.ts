import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");
const expectedChecksum = "sha256:09fe7ab43995ebba81aa914e47fd3b686c989ef1934e414443251d7b8c79cd47";

test("Agent OS runtime migration is checksum locked and metadata-only", () => {
  const migration = read("db/migrations/20260924_agent_os_runtime_foundation_v1.sql");
  const source = migration.split("-- checksum-source-begin\n")[1]?.split("-- checksum-source-end")[0];
  assert.ok(source);
  assert.equal("sha256:" + createHash("sha256").update(source).digest("hex"), expectedChecksum);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS ccpun_admin\.agent_runtime_job/);
  assert.match(migration, /correlation_id uuid NOT NULL/);
  assert.match(migration, /payload_digest_sha256 text NOT NULL/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS ccpun_admin\.agent_runtime_job_event/);
  assert.match(migration, /n8n_execution_id text/);
  assert.match(migration, /reconciliation_required/);
  assert.match(migration, /ON CONFLICT\(idempotency_key\) DO NOTHING/);
  assert.match(migration, /agent_runtime_job_event/);
  assert.doesNotMatch(migration, /message_text|health_value|financial_value|ciphertext|token_value/i);
});

test("Agent OS runtime role gets function access but no direct job table access", () => {
  const migration = read("db/migrations/20260924_agent_os_runtime_foundation_v1.sql");
  assert.match(migration, /REVOKE ALL PRIVILEGES ON\s+ccpun_admin\.agent_runtime_job,\s*ccpun_admin\.agent_runtime_job_event\s+FROM PUBLIC,ccpun_admin_runtime/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION/);
  assert.match(migration, /admin_create_agent_runtime_job/);
  assert.match(migration, /admin_update_agent_runtime_job/);
  assert.match(migration, /admin_read_agent_runtime_jobs/);
  assert.match(migration, /admin_read_agent_runtime_job_events/);
  assert.match(migration, /admin_read_agent_runtime_duration_samples/);
  assert.doesNotMatch(migration, /GRANT (SELECT|INSERT|UPDATE|DELETE)[^;]*agent_runtime_job TO ccpun_admin_runtime/);
});

test("Agent OS runtime readback proves migration identity and least privilege", () => {
  const readback = read("db/migrations/20260924_agent_os_runtime_foundation_v1_readback.sql");
  assert.ok(readback.includes(expectedChecksum));
  assert.match(readback, /migration_current/);
  assert.match(readback, /direct_table_denied/);
  assert.match(readback, /runtime_functions_allowed/);
});
