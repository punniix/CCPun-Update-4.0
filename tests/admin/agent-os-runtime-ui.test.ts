import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");

test("Agent OS runtime detail API stays owner-safe and metadata-only", () => {
  const route = read("apps/admin/app/api/admin/operations/jobs/[jobId]/route.ts");
  assert.match(route, /settings:read/);
  assert.match(route, /readAgentRuntimeJobDetail/);
  assert.doesNotMatch(route, /transcript|raw_message|rawMessage|customerText|ciphertext|prompt/);
});

test("Agent OS runtime UI uses real stage history instead of fake percentage progress", () => {
  const component = read("features/admin/operations/AgentRuntimeJobStatus.tsx");
  assert.match(component, /Runtime timeline/);
  assert.match(component, /baseline\.p50Ms/);
  assert.match(component, /baseline\.p90Ms/);
  assert.match(component, /heartbeat_stale/);
  assert.match(component, /n8nExecutionId/);
  assert.doesNotMatch(component, /progress.*%|Math\.min\(100|setProgress/i);
});
