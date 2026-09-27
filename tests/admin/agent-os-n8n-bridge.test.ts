import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { isN8nAgentOsRequestAuthorized } from "../../lib/admin/agent-os/service-auth";

const read = (path: string) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");

test("Agent OS n8n bridge is fail-closed and requires a dedicated high-entropy token", () => {
  const token = "x".repeat(64);
  const request = new Request("https://admin.ccpun.com/api/internal/agent-os/jobs/", {
    headers: { Authorization: "Bearer " + token },
  });
  assert.equal(isN8nAgentOsRequestAuthorized(request, {}), false);
  assert.equal(isN8nAgentOsRequestAuthorized(request, {
    CCPUN_AGENT_OS_N8N_ENABLED: "true",
    CCPUN_AGENT_OS_N8N_TOKEN: token,
  }), true);
  assert.equal(isN8nAgentOsRequestAuthorized(request, {
    CCPUN_AGENT_OS_N8N_ENABLED: "true",
    CCPUN_AGENT_OS_N8N_TOKEN: "short",
  }), false);
});

test("Agent OS internal routes accept metadata only and never a raw payload field", () => {
  const create = read("apps/admin/app/api/internal/agent-os/jobs/route.ts");
  const update = read("apps/admin/app/api/internal/agent-os/jobs/[jobId]/route.ts");
  assert.match(create, /payloadDigestSha256/);
  assert.match(create, /invalid-job-metadata/);
  assert.doesNotMatch(create, /payload:\s*z\.|rawMessage|transcript|customerText/);
  assert.doesNotMatch(update, /payload:\s*z\.|rawMessage|transcript|customerText/);
  assert.match(update, /expectedVersion/);
  assert.match(update, /stale-version/);
});
