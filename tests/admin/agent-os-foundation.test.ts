import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";

import {
  AGENT_OS_JOB_STATUSES,
  agentOsJobSchema,
  classifyRuntimePace,
  jobIsTerminal,
  runtimeDurationBaseline,
} from "../../lib/admin/operations/agent-os-job-contract";
import {
  evaluateAgentOsCommandPolicy,
  SHORTCUT_ALLOWED_ACTIONS,
} from "../../lib/admin/control-plane/agent-os-command-contract";

test("Agent OS job contract keeps one explicit cross-system state vocabulary", () => {
  for (const status of [
    "queued",
    "running",
    "waiting_external",
    "waiting_ai",
    "validating",
    "awaiting_review",
    "retrying",
    "completed",
    "failed",
    "reconciliation_required",
    "cancelled",
  ]) assert.ok(AGENT_OS_JOB_STATUSES.includes(status as never));
  assert.equal(jobIsTerminal("completed"), true);
  assert.equal(jobIsTerminal("reconciliation_required"), true);
  assert.equal(jobIsTerminal("running"), false);
});

test("Agent OS generic job record contains metadata only and rejects unknown fields", () => {
  const now = new Date().toISOString();
  const parsed = agentOsJobSchema.safeParse({
    jobId: randomUUID(),
    correlationId: randomUUID(),
    requestId: randomUUID(),
    payloadDigestSha256: "a".repeat(64),
    source: "n8n",
    action: "crm.followup.create",
    workflowKey: "crm.followup.daily",
    status: "running",
    stage: "scan_due_tasks",
    queueClass: "normal",
    attempt: 1,
    maxAttempts: 3,
    createdAt: now,
    queuedAt: now,
    startedAt: now,
    updatedAt: now,
    completedAt: null,
    heartbeatAt: now,
    n8nExecutionId: "72891",
    providerReference: null,
    errorCategory: null,
    durationMs: null,
    queueWaitMs: 120,
  });
  assert.equal(parsed.success, true);

  const withRawPayload = {
    ...(parsed.success ? parsed.data : {}),
    rawCustomerMessage: "must-not-enter-generic-job-log",
  };
  assert.equal(agentOsJobSchema.safeParse(withRawPayload).success, false);
});

test("Runtime duration baseline is deterministic and slow warnings require enough evidence", () => {
  const baseline = runtimeDurationBaseline([1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000]);
  assert.equal(baseline.sampleSize, 10);
  assert.equal(baseline.p50Ms, 5500);
  assert.equal(baseline.p90Ms, 9100);
  assert.equal(classifyRuntimePace({ elapsedMs: 8000, heartbeatAgeMs: 1000, baseline }), "normal");
  assert.equal(classifyRuntimePace({ elapsedMs: 12000, heartbeatAgeMs: 1000, baseline }), "slower_than_usual");
  assert.equal(classifyRuntimePace({ elapsedMs: 12000, heartbeatAgeMs: 61000, baseline }), "heartbeat_stale");
  assert.equal(
    classifyRuntimePace({
      elapsedMs: 999999,
      heartbeatAgeMs: 1000,
      baseline: runtimeDurationBaseline([1, 2, 3, 4]),
    }),
    "unknown",
  );
});

test("Apple Shortcut is intentionally scoped to low-consequence Agent OS actions", () => {
  assert.equal(SHORTCUT_ALLOWED_ACTIONS.has("crm.capture"), true);
  assert.equal(SHORTCUT_ALLOWED_ACTIONS.has("system.health"), true);
  assert.equal(SHORTCUT_ALLOWED_ACTIONS.has("production.deploy"), false);
  assert.equal(SHORTCUT_ALLOWED_ACTIONS.has("privacy.delete.execute"), false);

  assert.deepEqual(
    evaluateAgentOsCommandPolicy({ source: "shortcut", action: "production.deploy", actorType: "human" }),
    { allowed: false, requiresHumanApproval: false, reason: "shortcut_action_not_allowed" },
  );
});

test("Consequential actions cannot be issued by n8n, system or AI actors", () => {
  assert.deepEqual(
    evaluateAgentOsCommandPolicy({ source: "n8n", action: "line.campaign.send", actorType: "system" }),
    {
      allowed: false,
      requiresHumanApproval: true,
      reason: "automation_cannot_issue_consequential_action",
    },
  );
  assert.deepEqual(
    evaluateAgentOsCommandPolicy({ source: "admin", action: "database.migrate", actorType: "ai" }),
    {
      allowed: false,
      requiresHumanApproval: true,
      reason: "automation_cannot_issue_consequential_action",
    },
  );
  assert.deepEqual(
    evaluateAgentOsCommandPolicy({ source: "admin", action: "database.migrate", actorType: "human" }),
    {
      allowed: true,
      requiresHumanApproval: true,
      reason: "consequential_action_requires_human",
    },
  );
});

test("Routine actions remain automation-friendly", () => {
  assert.deepEqual(
    evaluateAgentOsCommandPolicy({ source: "n8n", action: "calendar.sync", actorType: "system" }),
    { allowed: true, requiresHumanApproval: false, reason: "allowed" },
  );
  assert.deepEqual(
    evaluateAgentOsCommandPolicy({ source: "admin", action: "crm.capture", actorType: "human" }),
    { allowed: true, requiresHumanApproval: false, reason: "allowed" },
  );
});
