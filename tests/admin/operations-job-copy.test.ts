import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ownerAgentJobKindLabel, ownerJobStatusLabel, safeJobErrorCode, safeN8nExecutionId } from "../../features/admin/operations/job-copy";

test("operations job list explains the live Google Sheet action and retains its raw code in audit detail", () => {
  assert.equal(ownerAgentJobKindLabel("exports.google_sheet · export.google_sheet"), "Google Sheet Export");
  assert.equal(ownerAgentJobKindLabel("unknown.workflow · unknown.action"), "Agent OS Workflow");
  const page = readFileSync(new URL("../../features/admin/operations/JobsPage.tsx", import.meta.url), "utf8");
  assert.match(page, /ownerAgentJobKindLabel\(job\.kind\)/);
  assert.match(page, /\{job\.kind\} · \{job\.detail\}/);
  assert.doesNotMatch(page, /"งานอัตโนมัติ · " \+ job\.kind/);
});

test("owner job labels distinguish completed, cancelled, pending and uncertain outcomes", () => {
  assert.equal(ownerJobStatusLabel("completed"), "เสร็จแล้ว");
  assert.equal(ownerJobStatusLabel("cancelled"), "ยกเลิกแล้ว");
  assert.equal(ownerJobStatusLabel("validated"), "ตรวจผ่านแล้ว");
  assert.equal(ownerJobStatusLabel("queued"), "รอคิว");
  assert.equal(ownerJobStatusLabel("reconciliation_required"), "ต้องตรวจผลกับระบบภายนอก");
  assert.equal(ownerJobStatusLabel("reconciliation-required"), "ต้องตรวจผลกับระบบภายนอก");
  assert.equal(ownerJobStatusLabel("unrecognized"), "ยังไม่รู้สถานะ ต้องตรวจ");
  assert.equal(ownerJobStatusLabel("__proto__"), "ยังไม่รู้สถานะ ต้องตรวจ");
  assert.equal(ownerAgentJobKindLabel("seo.cluster.uat · seo.cluster.uat"), "จัดกลุ่มคำค้น SEO · UAT");
});

test("execution references and error details remain bounded metadata instead of arbitrary text", () => {
  assert.equal(safeN8nExecutionId("12345"), "12345");
  for (const id of [null, "", "https://example.test/12345", "12345?query=private", "-1", "0123", "1".repeat(21), "SYNTHETIC_PRIVATE_CANARY"]) {
    assert.equal(safeN8nExecutionId(id), null);
  }
  assert.equal(safeJobErrorCode("EXECUTION_OUTCOME_UNKNOWN"), "EXECUTION_OUTCOME_UNKNOWN");
  assert.equal(safeJobErrorCode("n8n-callback-timeout"), "n8n-callback-timeout");
  assert.equal(safeJobErrorCode("SYNTHETIC_PRIVATE_CANARY"), null);
  assert.equal(safeJobErrorCode("database error with arbitrary text"), null);
});
