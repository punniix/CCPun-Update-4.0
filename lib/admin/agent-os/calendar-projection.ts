import { z } from "zod";

const uuidSchema = z.string().uuid().transform((value) => value.toLowerCase());
const kindSchema = z.enum(["follow_up", "policy_review", "quote_review", "investment_review", "annual_review", "other"]);

function taskReference(taskId: string) {
  return `TASK-${uuidSchema.parse(taskId)}`;
}

function casePath(leadId: string) {
  return `/dashboard/inbox/${uuidSchema.parse(leadId)}/`;
}

// The server adapter must obtain these IDs from an authorized CRM task/lead pair.
// This contract constrains projection content; it does not grant access to a case.
export const calendarProjectionSchema = z.object({
  taskId: uuidSchema,
  leadId: uuidSchema,
  customerCode: z.string().regex(/^C[0-9A-F]{32}$/).optional(),
  kind: kindSchema,
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  titleRef: z.string().length(41),
  adminPath: z.string().max(54),
  googleEventId: z.string().max(300).nullable(),
  rowVersion: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
}).strict().superRefine((value, context) => {
  if (uuidSchema.safeParse(value.taskId).success && value.titleRef !== taskReference(value.taskId)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["titleRef"], message: "reference must match task ID" });
  }
  if (uuidSchema.safeParse(value.leadId).success && value.adminPath !== casePath(value.leadId)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["adminPath"], message: "path must match lead ID" });
  }
  if (Date.parse(value.startsAt) >= Date.parse(value.endsAt)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["endsAt"], message: "end must be after start" });
  }
});

export type CalendarProjection = z.infer<typeof calendarProjectionSchema>;

export function calendarEventTitle(input: Pick<CalendarProjection, "kind" | "taskId" | "titleRef">) {
  kindSchema.parse(input.kind);
  const reference = taskReference(input.taskId);
  if (input.titleRef !== reference) throw new Error("CALENDAR_TASK_REF_INVALID");
  return `CCPun Task · ${reference}`;
}

export function calendarDescription(input: Pick<CalendarProjection, "leadId" | "adminPath">) {
  const adminPath = casePath(input.leadId);
  if (input.adminPath !== adminPath) throw new Error("CALENDAR_ADMIN_PATH_INVALID");
  return `รายละเอียดอยู่ใน CCPun Admin: ${adminPath}`;
}

export type CalendarSyncDecision =
  | { action: "create"; reason: "crm_task_has_no_projection" }
  | { action: "update"; reason: "crm_task_changed" }
  | { action: "reconcile"; reason: "calendar_changed_outside_crm" | "crm_version_invalid" | "projection_state_unknown" | "projection_ahead_of_crm" }
  | { action: "noop"; reason: "projection_current" };

export function decideCalendarSync(input: {
  googleEventId: string | null;
  crmRowVersion: number;
  projectedRowVersion: number | null;
  externalCalendarChangeDetected: boolean;
}): CalendarSyncDecision {
  if (!Number.isSafeInteger(input.crmRowVersion) || input.crmRowVersion <= 0) {
    return { action: "reconcile", reason: "crm_version_invalid" };
  }
  if (input.externalCalendarChangeDetected) return { action: "reconcile", reason: "calendar_changed_outside_crm" };
  if (!input.googleEventId) {
    return input.projectedRowVersion === null
      ? { action: "create", reason: "crm_task_has_no_projection" }
      : { action: "reconcile", reason: "projection_state_unknown" };
  }
  if (input.projectedRowVersion === null || !Number.isSafeInteger(input.projectedRowVersion) || input.projectedRowVersion <= 0) {
    return { action: "reconcile", reason: "projection_state_unknown" };
  }
  if (input.projectedRowVersion > input.crmRowVersion) return { action: "reconcile", reason: "projection_ahead_of_crm" };
  if (input.projectedRowVersion < input.crmRowVersion) return { action: "update", reason: "crm_task_changed" };
  return { action: "noop", reason: "projection_current" };
}
