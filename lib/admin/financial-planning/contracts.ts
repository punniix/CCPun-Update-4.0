import { z } from "zod";

/**
 * Data contracts for the financial planning room (ห้องวางแผนการเงิน).
 *
 * Every value described here is client financial data. It is encrypted at the
 * application layer before it reaches Postgres, is visible to the owner only,
 * and must never be sent to analytics, logs or a cloud LLM.
 *
 * Numbers only (decision F5): no document uploads, no national ID, no bank
 * account numbers.
 */

export const FA_MAX_ITEMS_PER_SECTION = 60;
export const FA_MAX_AMOUNT = 1_000_000_000_000; // 1 ล้านล้านบาท: guards typos, not a business rule

const label = z.string().trim().max(120);
const amount = z.number().finite().min(0).max(FA_MAX_AMOUNT).nullable();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "invalid-date");

export const FA_EMPLOYMENT_TYPES = ["salaried", "self_employed"] as const;
export type FaEmploymentType = (typeof FA_EMPLOYMENT_TYPES)[number];

/** Revenue Department income categories (ม.40(1)–40(8)). */
export const FA_INCOME_TYPES = ["40(1)", "40(2)", "40(3)", "40(4)", "40(5)", "40(6)", "40(7)", "40(8)"] as const;
export const FA_EXPENSE_KINDS = ["living", "insurance", "saving", "education", "other"] as const;
export const FA_ASSET_LIQUIDITY = ["liquid", "invest", "personal"] as const;
export const FA_LIABILITY_KINDS = ["mortgage", "vehicle", "credit_card", "personal", "other"] as const;
export const FA_FREQUENCIES = ["monthly", "yearly"] as const;
export const FA_NOTE_TAGS = ["goal", "worry", "family", "follow_up", "product_interest"] as const;
export const FA_CLIENT_STATUSES = ["active", "former"] as const;

export type FaClientStatus = (typeof FA_CLIENT_STATUSES)[number];

export const householdProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  employment: z.enum(FA_EMPLOYMENT_TYPES),
  dependentsCount: z.number().int().min(0).max(30).nullable(),
}).strict();
export type HouseholdProfile = z.infer<typeof householdProfileSchema>;

export const cashflowItemSchema = z.object({
  direction: z.enum(["income", "expense"]),
  label,
  amount,
  frequency: z.enum(FA_FREQUENCIES),
  incomeType: z.enum(FA_INCOME_TYPES).nullable(),
  expenseKind: z.enum(FA_EXPENSE_KINDS).nullable(),
}).strict().superRefine((item, context) => {
  if (item.direction === "income" && item.expenseKind !== null) context.addIssue({ code: "custom", message: "income-has-expense-kind" });
  if (item.direction === "expense" && item.incomeType !== null) context.addIssue({ code: "custom", message: "expense-has-income-type" });
});
export type CashflowItem = z.infer<typeof cashflowItemSchema>;

export const assetItemSchema = z.object({
  label,
  value: amount,
  liquidity: z.enum(FA_ASSET_LIQUIDITY),
  valuedOn: isoDate.nullable(),
}).strict();
export type AssetItem = z.infer<typeof assetItemSchema>;

export const liabilityItemSchema = z.object({
  label,
  balance: amount,
  monthlyPayment: amount,
  annualInterestRatePct: z.number().finite().min(0).max(100).nullable(),
  kind: z.enum(FA_LIABILITY_KINDS),
}).strict();
export type LiabilityItem = z.infer<typeof liabilityItemSchema>;

export const financialPositionSchema = z.object({
  cashflow: z.array(cashflowItemSchema).max(FA_MAX_ITEMS_PER_SECTION * 2),
  assets: z.array(assetItemSchema).max(FA_MAX_ITEMS_PER_SECTION),
  liabilities: z.array(liabilityItemSchema).max(FA_MAX_ITEMS_PER_SECTION),
}).strict();
export type FinancialPosition = z.infer<typeof financialPositionSchema>;

export const savePlanRequestSchema = z.object({
  expectedRevision: z.number().int().min(1),
  profile: householdProfileSchema,
  position: financialPositionSchema,
}).strict();

export const crmNoteSchema = z.object({
  text: z.string().trim().min(1).max(4000),
  tags: z.array(z.enum(FA_NOTE_TAGS)).max(FA_NOTE_TAGS.length).transform((tags) => [...new Set(tags)]),
  nextMeetingOn: isoDate.nullable(),
  followUp: z.string().trim().max(300).nullable(),
}).strict();
export type CrmNote = z.infer<typeof crmNoteSchema>;

export const clientStatusRequestSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("active") }).strict(),
  z.object({ status: z.literal("former"), relationshipEndedOn: isoDate }).strict(),
]);
export type ClientStatusRequest = z.infer<typeof clientStatusRequestSchema>;

export const householdIdSchema = z.string().uuid();

export function emptyFinancialPosition(): FinancialPosition {
  return { cashflow: [], assets: [], liabilities: [] };
}
