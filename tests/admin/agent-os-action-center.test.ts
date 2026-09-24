import assert from "node:assert/strict";
import test from "node:test";

import {
  buildActionCenterSignals,
  summarizeActionCenter,
} from "../../lib/admin/agent-os/action-center";

test("Action Center derives explainable CRM work without AI", () => {
  const signals = buildActionCenterSignals([
    {
      leadId: "lead-a",
      stage: "New",
      materialReceived: false,
      unreadCount: 2,
      followUpAt: null,
      lastActivityAt: "2026-09-24T01:00:00.000Z",
      latestMessageNeedsHuman: true,
      caseState: "active",
    },
    {
      leadId: "lead-b",
      stage: "Quote",
      materialReceived: true,
      unreadCount: 0,
      followUpAt: null,
      lastActivityAt: "2026-09-20T01:00:00.000Z",
      latestMessageNeedsHuman: false,
      caseState: "waiting",
    },
    {
      leadId: "lead-c",
      stage: "Qualified",
      materialReceived: true,
      unreadCount: 0,
      followUpAt: "2026-09-23T02:00:00.000Z",
      lastActivityAt: "2026-09-22T01:00:00.000Z",
      latestMessageNeedsHuman: false,
      caseState: "active",
    },
  ], "2026-09-24T04:00:00.000Z");

  assert.deepEqual(signals.map((signal) => signal.kind), [
    "follow_up_overdue",
    "human_handoff",
    "document_ready",
    "new_lead_unread",
    "quote_waiting",
  ]);
  assert.deepEqual(summarizeActionCenter(signals), { total: 5, urgent: 2, high: 2, normal: 1 });
});

test("Action Center ignores completed cases", () => {
  const signals = buildActionCenterSignals([{
    leadId: "lead-done",
    stage: "Won",
    materialReceived: true,
    unreadCount: 4,
    followUpAt: "2026-09-20T00:00:00.000Z",
    lastActivityAt: "2026-09-20T00:00:00.000Z",
    latestMessageNeedsHuman: true,
    caseState: "completed",
  }], "2026-09-24T04:00:00.000Z");
  assert.deepEqual(signals, []);
});
