// =============================================
// CI Planning — Constants & Defaults
// =============================================

import type { CIEstimationMethod, CIFormData } from './types';
import { EMPTY_CI_RECOVERY } from '@/features/ci-planning/recovery-evidence';

// ── Step Labels ────────────────────────────────────────────────────────────

export const CI_STEP_LABELS = [
  'กรอกรายได้ และค่าใช้จ่าย',
  'เงินก้อนที่มีอยู่',
] as const;

// ── Initial Form Data ─────────────────────────────────────────────────────

export const INITIAL_CI_FORM_DATA: CIFormData = {
  expenses: {
    monthlyIncome: 0,
    household: 0,
    educationPlans: [],
    mortgagePayment: 0,
    mortgageInstallmentsRemaining: 0,
    carPayment: 0,
    carInstallmentsRemaining: 0,
    otherDebtBalance: 0,
    reserveYears: 5,
    recovery: { ...EMPTY_CI_RECOVERY },
  },
  existingCI: {
    lumpSum: 0,
    liquidAssets: 0,
    protectLiquidAssets: false,
  },
};

// ── LINE OA CTA ───────────────────────────────────────────────────────────

export const CI_LINE_OA_URL = 'https://lin.ee/tqLCs4f';
export const CI_LINE_OA_DESTINATION = 'line_oa' as const;

export const CI_ESTIMATION_METHOD_LABELS: Record<CIEstimationMethod, string> = {
  expense: 'ทุนตามรายจ่าย',
  income: 'ทุนตามรายได้',
};

export const CI_ASSESSMENT_VERSION = 'ci_planning_v11_asset_protection_2026';
