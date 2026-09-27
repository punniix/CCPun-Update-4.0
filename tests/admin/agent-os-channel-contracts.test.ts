import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import {
  calendarDescription,
  calendarEventTitle,
  calendarProjectionSchema,
  decideCalendarSync,
} from "../../lib/admin/agent-os/calendar-projection";
import { evaluateLineMcpPolicy } from "../../lib/admin/agent-os/line-mcp-policy";
import {
  evaluateShortcutAction,
  isShortcutGatewayAuthorized,
} from "../../lib/admin/agent-os/shortcut-gateway";

test("Calendar projection exposes references, not customer-sensitive detail", () => {
  const projection = calendarProjectionSchema.parse({
    taskId: randomUUID(),
    customerCode: "C" + "A".repeat(32),
    kind: "follow_up",
    startsAt: "2026-09-25T07:00:00.000Z",
    endsAt: "2026-09-25T07:30:00.000Z",
    titleRef: "CASE-7A21",
    adminPath: "/dashboard/inbox/7a21/",
    googleEventId: null,
    rowVersion: 3,
  });
  assert.equal(calendarEventTitle(projection), "Follow-up · CASE-7A21");
  assert.equal(calendarDescription(projection.adminPath), "รายละเอียดอยู่ใน CCPun Admin: /dashboard/inbox/7a21/");
  assert.equal(JSON.stringify(projection).includes("health"), false);
});

test("Calendar external edits reconcile instead of silently overwriting CRM", () => {
  assert.deepEqual(
    decideCalendarSync({
      googleEventId: "event-1",
      crmRowVersion: 4,
      projectedRowVersion: 4,
      externalCalendarChangeDetected: true,
    }),
    { action: "reconcile", reason: "calendar_changed_outside_crm" },
  );
  assert.deepEqual(
    decideCalendarSync({
      googleEventId: null,
      crmRowVersion: 1,
      projectedRowVersion: null,
      externalCalendarChangeDetected: false,
    }),
    { action: "create", reason: "crm_task_has_no_projection" },
  );
});

test("LINE MCP reads are operator-friendly but writes stay behind human Control Plane", () => {
  assert.deepEqual(evaluateLineMcpPolicy("insights.read"), {
    allowed: true,
    requiresHumanApproval: false,
    requiresControlPlaneJob: false,
    reason: "read_only",
  });
  assert.deepEqual(evaluateLineMcpPolicy("broadcast.send"), {
    allowed: false,
    requiresHumanApproval: true,
    requiresControlPlaneJob: true,
    reason: "write_requires_human_control_plane",
  });
});

test("Shortcut Gateway is fail-closed and cannot elevate to consequential actions", () => {
  const token = "s".repeat(64);
  const request = new Request("https://admin.ccpun.com/api/automation/", {
    headers: { Authorization: "Bearer " + token },
  });
  assert.equal(isShortcutGatewayAuthorized(request, {}), false);
  assert.equal(isShortcutGatewayAuthorized(request, {
    CCPUN_SHORTCUT_GATEWAY_ENABLED: "true",
    CCPUN_SHORTCUT_GATEWAY_TOKEN: token,
  }), true);
  assert.equal(evaluateShortcutAction("crm.capture").allowed, true);
  assert.equal(evaluateShortcutAction("production.deploy").allowed, false);
  assert.equal(evaluateShortcutAction("privacy.delete.execute").allowed, false);
});
