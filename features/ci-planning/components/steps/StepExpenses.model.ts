import {
  calcDebtNeed,
  calcHouseholdNeed,
  calcIncomeBasedNeed,
  calcOtherDebtNeed,
  calcRecoveryReserveNeed,
} from '@/features/ci-planning/calculator/calculator';
import type { CIEducationPlan, CIFormData, CIRecoveryCosts } from '@/features/ci-planning/calculator/types';
import { EMPTY_CI_RECOVERY } from '@/features/ci-planning/recovery-evidence';

export type ExpenseField =
  | 'monthlyIncome'
  | 'household'
  | 'mortgagePayment'
  | 'mortgageInstallmentsRemaining'
  | 'carPayment'
  | 'carInstallmentsRemaining'
  | 'otherDebtBalance';

export function baht(value: number) {
  return `${Math.round(value).toLocaleString('th-TH')} บาท`;
}

export function previewBaht(value: number | null) {
  return value === null ? '—' : baht(value);
}

export function describedBy(...ids: Array<string | false | undefined>) {
  return ids.filter(Boolean).join(' ') || undefined;
}

export function previewInstallments(value: number) {
  return Number.isInteger(value) && value >= 0 && value <= 600 ? value : 0;
}

export function previewEducationSubtotal(plan: CIEducationPlan): number | null {
  const annualCost = Number.isSafeInteger(plan.annualCost) && plan.annualCost > 0 ? plan.annualCost : 0;
  const years = Number.isInteger(plan.yearsRemaining) && plan.yearsRemaining > 0 ? plan.yearsRemaining : 0;
  const subtotal = annualCost * years;
  return Number.isSafeInteger(subtotal) ? subtotal : null;
}

export function safeRecoveryPreview(recovery: CIRecoveryCosts) {
  try {
    return calcRecoveryReserveNeed(recovery);
  } catch {
    return calcRecoveryReserveNeed({ ...EMPTY_CI_RECOVERY });
  }
}

export function safeAddPreview(...values: number[]) {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!Number.isSafeInteger(total) || total < 0) throw new RangeError('preview total exceeds the safe integer range');
  return total;
}

export function safePlanPreview(expenses: CIFormData['expenses'], recoveryReserveNeed: number) {
  try {
    const { educationPlans, reserveYears } = expenses;
    const householdNeed = calcHouseholdNeed(expenses.household, reserveYears);
    let educationNeed = 0;
    for (const plan of educationPlans) {
      const subtotal = previewEducationSubtotal(plan);
      if (subtotal === null) throw new RangeError('education preview exceeds the safe integer range');
      educationNeed = safeAddPreview(educationNeed, subtotal);
    }
    const mortgageDebtNeed = calcDebtNeed(
      expenses.mortgagePayment,
      previewInstallments(expenses.mortgageInstallmentsRemaining),
      reserveYears,
    );
    const carDebtNeed = calcDebtNeed(
      expenses.carPayment,
      previewInstallments(expenses.carInstallmentsRemaining),
      reserveYears,
    );
    const otherDebtBalance = calcOtherDebtNeed(expenses.otherDebtBalance);
    const debtNeed = safeAddPreview(mortgageDebtNeed, carDebtNeed, otherDebtBalance);
    const expenseBaseNeed = safeAddPreview(householdNeed, educationNeed, debtNeed);
    const incomeBaseNeed = calcIncomeBasedNeed(expenses.monthlyIncome, reserveYears);
    const expenseTotalNeed = expenseBaseNeed > 0 ? safeAddPreview(expenseBaseNeed, recoveryReserveNeed) : 0;
    const incomeTotalNeed = incomeBaseNeed > 0 ? safeAddPreview(incomeBaseNeed, recoveryReserveNeed) : 0;
    return {
      householdNeed,
      educationNeed,
      debtNeed,
      expenseBaseNeed,
      incomeBaseNeed,
      expenseTotalNeed,
      incomeTotalNeed,
    };
  } catch {
    return null;
  }
}
