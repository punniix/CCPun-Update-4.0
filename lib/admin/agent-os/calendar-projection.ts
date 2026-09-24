import { z } from "zod";

export const calendarProjectionSchema = z.object({
  taskId: z.string().uuid(),
  customerCode: z.string().regex(/^C[0-9A-F]{32}$/).optional(),
  kind: z.enum(["follow_up", "policy_review", "quote_review", "investment_review", "annual_review", "other"]),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  titleRef: z.string().regex(/^[A-Za-z0-9._:-]{4,120}$/),
  adminPath: z.string().regex(/^/[A-Za-z0-9_./-]{1,300}$/),
  googleEventId: z.string().max(300).nullable(),
  rowVersion: z.number().int().positive(),
}).strict().superRefine((value, context) => {
  if (Date.parse(value.startsAt) >= Date.parse(value.endsAt)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["endsAt"], message: "end must be after start" });
  }
});

export type CalendarProjection = z.infer<typeof calendarProjectionSchema>;

export function calendarEventTitle(input: Pick<CalendarProjection, "kind" | "titleRef">) {
  const label: Record<CalendarProjection["kind"], string> = {
    follow_up: "Follow-up",
    policy_review: "Policy Review",
    quote_review: "Quote Review",
    investment_review: "Investment Review",
    annual_review: "Annual Review",
    other: "CCPun Task",
  };
  return `${label[input.kind]} · ${input.titleRef}`;
}

export function calendarDescription(adminPath: string) {
  if (!/^/[A-Za-z0-9_./-]{1,300}$/.test(adminPath)) throw new Error("CALENDAR_ADMIN_PATH_INVALID");
  return `รายละเอียดอยู่ใน CCPun Admin: ${adminPath}`;
}

export type CalendarSyncDecision =
  | { action: "create"; reason: "crm_task_has_no_projection" }
  | { action: "update"; reason: "crm_task_changed" }
  | { action: "reconcile"; reason: "calendar_changed_outside_crm" }
  | { action: "noop"; reason: "projection_current" };

export function decideCalendarSync(input: {
  googleEventId: string | null;
  crmRowVersion: number;
  projectedRowVersion: number | null;
  externalCalendarChangeDetected: boolean;
}): CalendarSyncDecision {
  if (!input.googleEventId) return { action: "create", reason: "crm_task_has_no_projection" };
  if (input.externalCalendarChangeDetected) return { action: "reconcile", reason: "calendar_changed_outside_crm" };
  if (input.projectedRowVersion !== input.crmRowVersion) return { action: "update", reason: "crm_task_changed" };
  return { action: "noop", reason: "projection_current" };
}
