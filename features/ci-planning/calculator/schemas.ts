// =============================================
// CI Planning — Zod Validation Schemas
// Zod v4 compatible
// =============================================

import { z } from 'zod';
import { EMPTY_CI_RECOVERY } from '@/features/ci-planning/recovery-evidence';

// ── Step 0: Expenses ──────────────────────────────────────────────────────

const nonNegativeAmount = z.number()
  .finite('กรุณากรอกตัวเลขที่ถูกต้อง')
  .min(0, 'จำนวนเงินต้องไม่ติดลบ');

const remainingInstallments = z.number()
  .finite('กรุณากรอกจำนวนงวดที่ถูกต้อง')
  .int('จำนวนงวดต้องเป็นจำนวนเต็ม')
  .min(0, 'จำนวนงวดต้องไม่ติดลบ')
  .max(600, 'จำนวนงวดต้องไม่เกิน 600 งวด');

const educationPlanSchema = z.object({
  annualCost: z.number()
    .finite('กรุณากรอกค่าใช้จ่ายต่อปีให้ถูกต้อง')
    .gt(0, 'กรุณากรอกค่าใช้จ่ายต่อปีมากกว่า 0 บาท'),
  yearsRemaining: z.number()
    .finite('กรุณากรอกจำนวนปีให้ถูกต้อง')
    .int('จำนวนปีต้องเป็นจำนวนเต็ม')
    .min(1, 'จำนวนปีต้องอย่างน้อย 1 ปี')
    .max(30, 'จำนวนปีต้องไม่เกิน 30 ปี'),
});

const recoveryCount = z.number()
  .finite('กรุณากรอกจำนวนให้ถูกต้อง')
  .int('กรุณากรอกเป็นจำนวนเต็ม')
  .min(0, 'จำนวนต้องไม่ติดลบ');

const recoveryMode = z.enum(['none', 'basic', 'continued', 'longTerm', 'custom']);

const recoverySchema = z.object({
  mode: recoveryMode,
  targetReserve: nonNegativeAmount,

  treatmentVisits: recoveryCount.max(100, 'จำนวนครั้งรักษา/ติดตามต้องไม่เกิน 100 ครั้ง'),
  treatmentVisitUnitCost: nonNegativeAmount,

  caregiverHomeDays: recoveryCount.max(730, 'จำนวนวันผู้ดูแลต้องไม่เกิน 730 วัน'),
  caregiverDailyCost: nonNegativeAmount,

  rehabSessions: recoveryCount.max(200, 'จำนวนครั้งกายภาพต้องไม่เกิน 200 ครั้ง'),
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
      message: 'กรุณาเลือกเงินสำรองหรือกรอกจำนวนเงินที่ต้องการเผื่อ',
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
      message: 'จำนวนครั้งกายภาพที่บ้านต้องไม่มากกว่าจำนวนครั้งกายภาพทั้งหมด',
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
    .finite('กรุณากรอกจำนวนปีที่ถูกต้อง')
    .int('จำนวนปีต้องเป็นจำนวนเต็ม')
    .min(1, 'ระยะสำรองต้องอย่างน้อย 1 ปี')
    .max(10, 'ระยะสำรองต้องไม่เกิน 10 ปี'),
  recovery: z.union([recoverySchema, legacyRecoverySchema]).default({ ...EMPTY_CI_RECOVERY }),
}).superRefine((data, context) => {
  if (data.mortgagePayment > 0 && data.mortgageInstallmentsRemaining === 0) {
    context.addIssue({
      code: 'custom',
      path: ['mortgageInstallmentsRemaining'],
      message: 'กรุณากรอกจำนวนงวดบ้านที่เหลือ',
    });
  }
  if (data.mortgagePayment === 0 && data.mortgageInstallmentsRemaining > 0) {
    context.addIssue({
      code: 'custom',
      path: ['mortgagePayment'],
      message: 'กรุณากรอกค่างวดบ้านต่อเดือน',
    });
  }
  if (data.carPayment > 0 && data.carInstallmentsRemaining === 0) {
    context.addIssue({
      code: 'custom',
      path: ['carInstallmentsRemaining'],
      message: 'กรุณากรอกจำนวนงวดรถที่เหลือ',
    });
  }
  if (data.carPayment === 0 && data.carInstallmentsRemaining > 0) {
    context.addIssue({
      code: 'custom',
      path: ['carPayment'],
      message: 'กรุณากรอกค่างวดรถต่อเดือน',
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
      message: 'กรุณากรอกรายได้ ค่าใช้จ่าย หรือภาระอย่างน้อย 1 รายการก่อนคำนวณเงินก้อน',
    });
  }
});

// ── Step 1: Existing CI ───────────────────────────────────────────────────

const stepExistingCISchema = z.object({
  lumpSum: nonNegativeAmount,
  liquidAssets: nonNegativeAmount,
});

// ── Step Validators (0-indexed) ───────────────────────────────────────────

const STEP_SCHEMAS = [
  stepExpensesSchema,
  stepExistingCISchema,
];

/** Validate ข้อมูลตาม step ปัจจุบัน (0-indexed) */
export function validateCIStep(
  step: number,
  data: Record<string, unknown>
): Record<string, string> {
  const schema = STEP_SCHEMAS[step];
  if (!schema) return {};

  const result = schema.safeParse(data);
  if (result.success) return {};

  const errors: Record<string, string> = {};
  result.error.issues.forEach((issue) => {
    const path = issue.path.join('.');
    if (!errors[path]) {
      errors[path] = issue.message;
    }
  });

  return errors;
}
