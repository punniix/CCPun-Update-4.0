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

function calendarFixture() {
  const taskId = randomUUID();
  const leadId = randomUUID();
  return {
    taskId,
    leadId,
    customerCode: "C" + "A".repeat(32),
    kind: "follow_up" as const,
    startsAt: "2026-09-25T07:00:00.000Z",
    endsAt: "2026-09-25T07:30:00.000Z",
    titleRef: `TASK-${taskId}`,
    adminPath: `/dashboard/inbox/${leadId}/`,
    googleEventId: null,
    rowVersion: 3,
  };
}

test("Calendar projection derives distinct task and case references without private detail", () => {
  const projection = calendarProjectionSchema.parse(calendarFixture());
  assert.notEqual(projection.taskId, projection.leadId);
  assert.equal(calendarEventTitle(projection), `CCPun Task · TASK-${projection.taskId}`);
  assert.equal(calendarDescription(projection), `รายละเอียดอยู่ใน CCPun Admin: /dashboard/inbox/${projection.leadId}/`);
  assert.equal(JSON.stringify(projection).includes("health"), false);
  const updated = calendarProjectionSchema.parse({ ...projection, rowVersion: 4 });
  assert.equal(calendarEventTitle(updated), calendarEventTitle(projection));
  assert.equal(calendarDescription(updated), calendarDescription(projection));
});

test("Calendar external titles remain neutral for every internal CRM task kind", () => {
  const fixture = calendarFixture();
  for (const kind of ["follow_up", "policy_review", "quote_review", "investment_review", "annual_review", "other"] as const) {
    const projection = calendarProjectionSchema.parse({ ...fixture, kind });
    assert.equal(projection.kind, kind);
    assert.equal(calendarEventTitle(projection), `CCPun Task · TASK-${fixture.taskId}`);
  }
});

test("Calendar rejects caller text and mismatched task references even before rendering", () => {
  const fixture = calendarFixture();
  for (const titleRef of ["PRIVATE_CANARY", "Synthetic.Customer", `TASK-${randomUUID()}`, "constructor", "__proto__"]) {
    assert.equal(calendarProjectionSchema.safeParse({ ...fixture, titleRef }).success, false);
    assert.throws(() => calendarEventTitle({ ...fixture, titleRef }), /CALENDAR_TASK_REF_INVALID/);
  }
  assert.equal(calendarProjectionSchema.safeParse({ ...fixture, taskId: "PRIVATE_CANARY" }).success, false);
  assert.throws(() => calendarEventTitle({ ...fixture, taskId: "PRIVATE_CANARY" }));
  assert.throws(() => calendarEventTitle({ ...fixture, kind: "constructor" as typeof fixture.kind }));
});

test("Calendar accepts only the exact canonical path for its CRM lead", () => {
  const fixture = calendarFixture();
  for (const adminPath of [
    `/dashboard/inbox/${fixture.taskId}/`,
    `/dashboard/inbox/${randomUUID()}/`,
    "/../synthetic/",
    `/dashboard/inbox/../${fixture.leadId}/`,
    `/dashboard/inbox/%2e%2e/${fixture.leadId}/`,
    `/dashboard/inbox%2f${fixture.leadId}/`,
    `/dashboard/inbox/${fixture.leadId}\\`,
    `${fixture.adminPath}?notes=PRIVATE_CANARY`,
    `${fixture.adminPath}#PRIVATE_CANARY`,
    fixture.adminPath.slice(0, -1),
    `/social/accounts/${fixture.leadId}/`,
    `https://example.invalid${fixture.adminPath}`,
  ]) {
    assert.equal(calendarProjectionSchema.safeParse({ ...fixture, adminPath }).success, false);
    assert.throws(() => calendarDescription({ ...fixture, adminPath }), /CALENDAR_ADMIN_PATH_INVALID/);
  }
  const { leadId: _leadId, ...missingLead } = fixture;
  void _leadId;
  assert.equal(calendarProjectionSchema.safeParse(missingLead).success, false);
  assert.equal(calendarProjectionSchema.safeParse({ ...fixture, leadId: "PRIVATE_CANARY" }).success, false);
  assert.throws(() => calendarDescription({ ...fixture, leadId: "PRIVATE_CANARY" }));
});

test("Calendar retains strict fields, valid time ranges and canonical UUID normalization", () => {
  const fixture = calendarFixture();
  for (const field of ["notes", "name", "transcript", "healthDetails", "financialDetails"]) {
    assert.equal(calendarProjectionSchema.safeParse({ ...fixture, [field]: "PRIVATE_CANARY" }).success, false);
  }
  assert.equal(calendarProjectionSchema.safeParse({ ...fixture, endsAt: fixture.startsAt }).success, false);
  assert.equal(calendarProjectionSchema.safeParse({ ...fixture, rowVersion: 0 }).success, false);
  assert.equal(calendarProjectionSchema.safeParse({ ...fixture, rowVersion: Number.MAX_SAFE_INTEGER + 1 }).success, false);
  const normalized = calendarProjectionSchema.parse({ ...fixture, taskId: fixture.taskId.toUpperCase(), leadId: fixture.leadId.toUpperCase() });
  assert.equal(normalized.taskId, fixture.taskId);
  assert.equal(normalized.leadId, fixture.leadId);
  assert.equal(calendarEventTitle(normalized), calendarEventTitle(fixture));
  assert.equal(calendarDescription(normalized), calendarDescription(fixture));
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
  assert.deepEqual(decideCalendarSync({ googleEventId: "event-1", crmRowVersion: 4, projectedRowVersion: 3, externalCalendarChangeDetected: false }), { action: "update", reason: "crm_task_changed" });
  assert.deepEqual(decideCalendarSync({ googleEventId: "event-1", crmRowVersion: 4, projectedRowVersion: 4, externalCalendarChangeDetected: false }), { action: "noop", reason: "projection_current" });
});

test("Calendar reconciles an ahead projection instead of overwriting it", () => {
  assert.deepEqual(
    decideCalendarSync({ googleEventId: "event-1", crmRowVersion: 4, projectedRowVersion: 5, externalCalendarChangeDetected: false }),
    { action: "reconcile", reason: "projection_ahead_of_crm" },
  );
  assert.deepEqual(
    decideCalendarSync({ googleEventId: "event-1", crmRowVersion: 4, projectedRowVersion: 5, externalCalendarChangeDetected: true }),
    { action: "reconcile", reason: "calendar_changed_outside_crm" },
  );
});

test("Calendar requires a positive safe CRM version before creating or updating", () => {
  for (const crmRowVersion of [NaN, 0, -1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    for (const googleEventId of [null, "event-1"]) {
      assert.deepEqual(
        decideCalendarSync({ googleEventId, crmRowVersion, projectedRowVersion: null, externalCalendarChangeDetected: false }),
        { action: "reconcile", reason: "crm_version_invalid" },
      );
    }
  }
  assert.deepEqual(
    decideCalendarSync({ googleEventId: "event-1", crmRowVersion: Number.MAX_SAFE_INTEGER, projectedRowVersion: Number.MAX_SAFE_INTEGER, externalCalendarChangeDetected: false }),
    { action: "noop", reason: "projection_current" },
  );
});

test("Calendar reconciles unknown or inconsistent projection state", () => {
  for (const projectedRowVersion of [null, NaN, 0, -1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.deepEqual(
      decideCalendarSync({ googleEventId: "event-1", crmRowVersion: 4, projectedRowVersion, externalCalendarChangeDetected: false }),
      { action: "reconcile", reason: "projection_state_unknown" },
    );
  }
  for (const projectedRowVersion of [1, 4, 5, NaN, 0, -1, Number.MAX_SAFE_INTEGER + 1]) {
    assert.deepEqual(
      decideCalendarSync({ googleEventId: null, crmRowVersion: 4, projectedRowVersion, externalCalendarChangeDetected: false }),
      { action: "reconcile", reason: "projection_state_unknown" },
    );
  }
  assert.deepEqual(
    decideCalendarSync({ googleEventId: null, crmRowVersion: 4, projectedRowVersion: null, externalCalendarChangeDetected: true }),
    { action: "reconcile", reason: "calendar_changed_outside_crm" },
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
