import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const body = (sql: string) => sql.split("-- checksum-source-begin\n")[1]?.split("-- checksum-source-end")[0] ?? "";
const checksum = (sql: string) => createHash("sha256").update(body(sql)).digest("hex");

test("provider Control Plane migration is checksum-locked and fail-closed", () => {
  const sql = read("db/migrations/20260919_provider_control_plane_v1.sql");
  const digest = "bfb668d37d859d3e01bdbee9ea433e5bdb835157f72ea983ce819c3c24160de1";
  assert.equal(checksum(sql), digest);
  assert.match(sql, new RegExp(`sha256:${digest}`));
  assert.match(sql, /'line\.rich_menu\.default'.*'hold'.*'hold'/s);
  assert.match(sql, /ON CONFLICT\(idempotency_key\) DO NOTHING/);
  assert.match(sql, /SECURITY DEFINER/g);
  assert.match(sql, /REVOKE ALL PRIVILEGES ON ccpun_admin\.control_resource/);
});

test("customer lifecycle foundation extends private_line without a second CRM", () => {
  const sql = read("db/migrations/20260919_customer_lifecycle_foundation_v1.sql");
  const digest = "cd12ea86c8705d4cdb1db3002cee9bb8616e208d007a39847edfa3bd37cbc693";
  assert.equal(checksum(sql), digest);
  assert.match(sql, new RegExp(`sha256:${digest}`));
  assert.match(sql, /CREATE TABLE IF NOT EXISTS private_line\.contact_permission_event/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS private_line\.customer_journey_instance/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS private_line\.conversation_task/);
  assert.match(sql, /customer\.customer_code/);
  assert.doesNotMatch(sql, /CREATE SCHEMA.*crm/is);
});

test("recovered UAT clean-mart source is checksum-locked and preserves provider truth", () => {
  const sql = read("db/migrations/20260919_social_p2_clean_recovered_uat.sql");
  const digest = "67af0f20447f5d6bcfc3d3c7078a2a0fb22a81475bbb40d5886e8a9b83906eb4";
  assert.equal(checksum(sql), digest);
  assert.match(sql, new RegExp(`sha256:${digest}`));
  assert.match(sql, /Recovered from Production pg_get_viewdef/);
  assert.match(sql, /metric_observation_latest_clean/);
  assert.match(sql, /platform_metric_benchmark_clean/);
});

test("channel-neutral lifecycle contract locks the four public journey IDs", () => {
  const contract = read("lib/customer-lifecycle/contracts.ts");
  for (const id of [
    "life_health_policy_review",
    "motor_quote_review",
    "investment_before_you_act",
    "human_handoff",
  ]) assert.match(contract, new RegExp(`"${id}"`));
  assert.match(contract, /CustomerChannel = "line" \| "email" \| "phone" \| "sms" \| "web_push"/);
});
