import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ownerAgentJobKindLabel } from "../../features/admin/operations/job-copy";

test("operations job list explains the live Google Sheet action and retains its raw code in audit detail", () => {
  assert.equal(ownerAgentJobKindLabel("exports.google_sheet · export.google_sheet"), "Google Sheet Export");
  assert.equal(ownerAgentJobKindLabel("unknown.workflow · unknown.action"), "Agent OS Workflow");
  const page = readFileSync(new URL("../../features/admin/operations/JobsPage.tsx", import.meta.url), "utf8");
  assert.match(page, /ownerAgentJobKindLabel\(job\.kind\)/);
  assert.match(page, /\{job\.kind\} · \{job\.detail\}/);
  assert.doesNotMatch(page, /"งานอัตโนมัติ · " \+ job\.kind/);
});
