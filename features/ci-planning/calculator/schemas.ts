import { CI_COPY_DEFAULTS } from '@/lib/content/tool-copy-defaults';
// =============================================
// CI Planning — Zod Validation Schemas
// Zod v4 compatible
// =============================================

import { z } from 'zod';
import { EMPTY_CI_RECOVERY } from '@/features/ci-planning/recovery-evidence';

// ── Step 0: Expenses ──────────────────────────────────────────────────────

const nonNegativeAmount = z.number()
  .finite(CI_COPY_DEFAULTS["ci.validation.nonNegativeAmount.finite"])
  .min(0, CI_COPY_DEFAULTS["ci.validation.nonNegativeAmount.min"]);

const remainingInstallments = z.number()
  .finite(CI_COPY_DEFAULTS["ci.validation.remainingInstallments.finite"])
  .int(CI_COPY_DEFAULTS["ci.validation.remainingInstallments.int"])
  .min(0, CI_COPY_DEFAULTS["ci.validation.remainingInstallments.min"])
  .max(600, CI_COPY_DEFAULTS["ci.validation.remainingInstallments.max"]);

const educationPlanSchema = z.object({
  annualCost: z.number()
    .finite(CI_COPY_DEFAULTS["ci.validation.educationPlanSchema.finite"])
    .gt(0, CI_COPY_DEFAULTS["ci.validation.educationPlanSchema.gt"]),
  yearsRemaining: z.number()
    .finite(CI_COPY_DEFAULTS["ci.validation.educationPlanSchema.finite2"])
    .int(CI_COPY_DEFAULTS["ci.validation.educationPlanSchema.int"])
    .min(1, CI_COPY_DEFAULTS["ci.validation.educationPlanSchema.min"])
    .max(30, CI_COPY_DEFAULTS["ci.validation.educationPlanSchema.max"]),
});

const recoveryCount = z.number()
  .finite(CI_COPY_DEFAULTS["ci.validation.recoveryCount.finite"])
  .int(CI_COPY_DEFAULTS["ci.validation.recoveryCount.int"])
  .min(0, CI_COPY_DEFAULTS["ci.validation.recoveryCount.min"]);

const recoveryMode = z.enum(['none', 'basic', 'continued', 'longTerm', 'custom']);

const recoverySchema = z.object({
  mode: recoveryMode,
  targetReserve: nonNegativeAmount,

  treatmentVisits: recoveryCount.max(100, CI_COPY_DEFAULTS["ci.validation.recoverySchema.max"]),
  treatmentVisitUnitCost: nonNegativeAmount,

  caregiverHomeDays: recoveryCount.max(730, CI_COPY_DEFAULTS["ci.validation.recoverySchema.max2"]),
  caregiverDailyCost: nonNegativeAmount,

  rehabSessions: recoveryCount.max(200, CI_COPY_DEFAULTS["ci.validation.recoverySchema.max3"]),
  rehabUnitCost: nonNegativeAmount,

  pulseOximeter: nonNegativeAmount,
  bloodPressureMonitor: nonNegativeAmount,
  thermometer: nonNegativeAmount,
  walker: nonNegativeAmount,
  wheelchair: nonNegativeAmount,
  showerChair: nonNegativeAmount,
  grabRailAndSafety: nonNegativeAmount,
  hospitalBed: nonNegativeAmount,
  consumables: nonNegativeAmount,

  homeAdaptation: nonNegativeAmount,
  majorHousing: nonNegativeAmount,
  contingency: nonNegativeAmount,
  otherRecoveryCosts: nonNegativeAmount,
}).superRefine((data, context) => {
  if (data.mode !== 'none' && data.targetReserve <= 0) {
    context.addIssue({
      code: 'custom',
      path: ['targetReserve'],
      message: CI_COPY_DEFAULTS["ci.validation.recoverySchema.message"],
    });
  }
});

// Legacy input remains accepted so old state/fixtures fail safe during the v10 cutover.
const legacyRecoverySchema = z.object({
  treatmentVisits: recoveryCount.max(100),
  caregiverHomeDays: recoveryCount.max(730),
  rehabSessions: recoveryCount.max(20),
  homeRehabSessions: recoveryCount.max(20),
  equipmentAndHomeModification: nonNegativeAmount,
  otherRecoveryCosts: nonNegativeAmount,
}).superRefine((data, context) => {
  if (data.homeRehabSessions > data.rehabSessions) {
    context.addIssue({
      code: 'custom',
      path: ['homeRehabSessions'],
      message: CI_COPY_DEFAULTS["ci.validation.legacyRecoverySchema.message"],
    });
  }
});

const stepExpensesSchema = z.object({
  monthlyIncome: nonNegativeAmount,
  household: nonNegativeAmount,
  educationPlans: z.array(educationPlanSchema),
  mortgagePayment: nonNegativeAmount,
  mortgageInstallmentsRemaining: remainingInstallments,
  carPayment: nonNegativeAmount,
  carInstallmentsRemaining: remainingInstallments,
  otherDebtBalance: nonNegativeAmount,
  reserveYears: z.number()
    .finite(CI_COPY_DEFAULTS["ci.validation.stepExpensesSchema.finite"])
    .int(CI_COPY_DEFAULTS["ci.validation.educationPlanSchema.int"])
    .min(1, CI_COPY_DEFAULTS["ci.validation.stepExpensesSchema.min"])
    .max(10, CI_COPY_DEFAULTS["ci.validation.stepExpensesSchema.max"]),
  recovery: z.union([recoverySchema, legacyRecoverySchema]).default({ ...EMPTY_CI_RECOVERY }),
}).superRefine((data, context) => {
  if (data.mortgagePayment > 0 && data.mortgageInstallmentsRemaining === 0) {
    context.addIssue({
      code: 'custom',
      path: ['mortgageInstallmentsRemaining'],
      message: CI_COPY_DEFAULTS["ci.validation.stepExpensesSchema.message"],
    });
  }
  if (data.mortgagePayment === 0 && data.mortgageInstallmentsRemaining > 0) {
    context.addIssue({
      code: 'custom',
      path: ['mortgagePayment'],
      message: CI_COPY_DEFAULTS["ci.validation.stepExpensesSchema.message2"],
    });
  }
  if (data.carPayment > 0 && data.carInstallmentsRemaining === 0) {
    context.addIssue({
      code: 'custom',
      path: ['carInstallmentsRemaining'],
      message: CI_COPY_DEFAULTS["ci.validation.stepExpensesSchema.message3"],
    });
  }
  if (data.carPayment === 0 && data.carInstallmentsRemaining > 0) {
    context.addIssue({
      code: 'custom',
      path: ['carPayment'],
      message: CI_COPY_DEFAULTS["ci.validation.stepExpensesSchema.message4"],
    });
  }

  const expenseSideBurden = [
    data.household,
    data.mortgagePayment,
    data.carPayment,
    data.otherDebtBalance,
  ].some((amount) => amount > 0);
  const hasEducationInput = data.educationPlans.length > 0;

  if (data.monthlyIncome === 0 && !expenseSideBurden && !hasEducationInput) {
    context.addIssue({
      code: 'custom',
      path: ['expenses'],
      message: CI_COPY_DEFAULTS["ci.validation.stepExpensesSchema.message5"],
    });
  }
});

// ── Step 1: Existing CI ───────────────────────────────────────────────────

const stepExistingCISchema = z.object({
  lumpSum: nonNegativeAmount,
  liquidAssets: nonNegativeAmount,
  protectLiquidAssets: z.boolean().optional(),
});

// ── Step Validators (0-indexed) ───────────────────────────────────────────

const STEP_SCHEMAS = [
  stepExpensesSchema,
  stepExistingCISchema,
];

const VALIDATION_COPY_KEYS = Object.fromEntries(
  Object.entries(CI_COPY_DEFAULTS).filter(([key]) => key.startsWith('ci.validation.')).map(([key, message]) => [message, key]),
) as Record<string, keyof typeof CI_COPY_DEFAULTS>;

/** Validation mechanics stay code-owned; only known messages use the caller's scoped copy. */
export function validateCIStep(
  step: number,
  data: Record<string, unknown>,
  text?: (key: keyof typeof CI_COPY_DEFAULTS) => string,
): Record<string, string> {
  const schema = STEP_SCHEMAS[step];
  if (!schema) return {};

  const result = schema.safeParse(data);
  if (result.success) return {};

  const errors: Record<string, string> = {};
  result.error.issues.forEach((issue) => {
    const path = issue.path.join('.');
    if (!errors[path]) {
      const copyKey = VALIDATION_COPY_KEYS[issue.message];
      errors[path] = copyKey && text ? text(copyKey) : issue.message;
    }
  });

  return errors;
}
