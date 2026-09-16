// =============================================
// CI Planning — Calculator
// =============================================

import { CI_RECOVERY_REFERENCE } from '@/features/ci-planning/recovery-evidence';
import type {
  CIEducationPlan,
  CIFormData,
  CIRecoveryCosts,
  CIResult,
} from './types';

function safeMoneyResult(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} exceeds the safe integer range`);
  }
  return value;
}

function safeMoneyInput(value: number, name: string, allowZero = true): number {
  if (!Number.isSafeInteger(value) || value < 0 || (!allowZero && value === 0)) {
    throw new RangeError(`${name} must be a safe non-negative integer${allowZero ? '' : ' greater than 0'}`);
  }
  return value;
}

/** ค่าใช้จ่ายครัวเรือน × 12 × ปีสำรอง โดยไม่รวมการศึกษา ค่างวด และยอดหนี้อื่น */
export function calcHouseholdNeed(household: number, reserveYears: number): number {
  safeMoneyInput(household, 'household');
  if (!Number.isInteger(reserveYears) || reserveYears < 0) {
    throw new RangeError('reserveYears must be an integer greater than or equal to 0');
  }

  return safeMoneyResult(household * 12 * reserveYears, 'householdNeed');
}

/** รายได้ต่อเดือน × 12 × ปีสำรอง แสดงเป็นอีกวิธีหนึ่งโดยไม่รวมกับทุนตามรายจ่าย */
export function calcIncomeBasedNeed(monthlyIncome: number, reserveYears: number): number {
  safeMoneyInput(monthlyIncome, 'monthlyIncome');
  if (!Number.isInteger(reserveYears) || reserveYears < 0) {
    throw new RangeError('reserveYears must be an integer greater than or equal to 0');
  }

  return safeMoneyResult(monthlyIncome * 12 * reserveYears, 'incomeBaseNeed');
}

/** รวมทุนการศึกษารายคนตามค่าใช้จ่ายต่อปี × ปีที่เหลือ */
export function calcEducationNeed(educationPlans: CIEducationPlan[]): number {
  return educationPlans.reduce((total, plan) => {
    safeMoneyInput(plan.annualCost, 'annualCost', false);
    if (!Number.isInteger(plan.yearsRemaining) || plan.yearsRemaining < 1 || plan.yearsRemaining > 30) {
      throw new RangeError('yearsRemaining must be an integer between 1 and 30');
    }

    const planNeed = safeMoneyResult(plan.annualCost * plan.yearsRemaining, 'educationPlanNeed');
    return safeMoneyResult(total + planNeed, 'educationNeed');
  }, 0);
}

/** สำรองค่างวดเฉพาะช่วงที่สั้นกว่าระหว่างงวดคงเหลือกับช่วงปีสำรอง */
export function calcDebtNeed(
  monthlyPayment: number,
  remainingInstallments: number,
  reserveYears: number,
): number {
  safeMoneyInput(monthlyPayment, 'monthlyPayment');
  if (!Number.isInteger(remainingInstallments) || remainingInstallments < 0 || remainingInstallments > 600) {
    throw new RangeError('remainingInstallments must be an integer between 0 and 600');
  }
  if (!Number.isInteger(reserveYears) || reserveYears < 0) {
    throw new RangeError('reserveYears must be an integer greater than or equal to 0');
  }

  return safeMoneyResult(
    monthlyPayment * Math.min(remainingInstallments, reserveYears * 12),
    'debtNeed',
  );
}

/** ยอดหนี้อื่นคงเหลือเป็นยอดรวมครั้งเดียว จึงไม่คูณช่วงเวลา */
export function calcOtherDebtNeed(otherDebtBalance: number): number {
  return safeMoneyInput(otherDebtBalance, 'otherDebtBalance');
}

function requireRecoveryCount(value: number, name: string, max: number): number {
  if (!Number.isInteger(value) || value < 0 || value > max) {
    throw new RangeError(name + ' must be an integer between 0 and ' + max);
  }
  return value;
}

function requireRecoveryAmount(value: number, name: string): number {
  return safeMoneyInput(value, name);
}

/**
 * Research-backed Recovery Reserve.
 * It is calculated as a clearly separated component, then added once to each
 * available estimation method independently. The UI can therefore show the
 * research-backed amount explicitly without hiding it inside either base formula.
 */
export function calcRecoveryReserveNeed(recovery: CIRecoveryCosts) {
  const treatmentVisits = requireRecoveryCount(recovery.treatmentVisits, 'treatmentVisits', 100);
  const caregiverHomeDays = requireRecoveryCount(recovery.caregiverHomeDays, 'caregiverHomeDays', 730);
  const rehabSessions = requireRecoveryCount(recovery.rehabSessions, 'rehabSessions', CI_RECOVERY_REFERENCE.rehabilitation.benchmarkSessionLimit);
  const homeRehabSessions = requireRecoveryCount(recovery.homeRehabSessions, 'homeRehabSessions', CI_RECOVERY_REFERENCE.rehabilitation.benchmarkSessionLimit);
  if (homeRehabSessions > rehabSessions) throw new RangeError('homeRehabSessions must not exceed rehabSessions');
  const equipmentAndHomeModification = requireRecoveryAmount(recovery.equipmentAndHomeModification, 'equipmentAndHomeModification');
  const otherRecoveryCosts = requireRecoveryAmount(recovery.otherRecoveryCosts, 'otherRecoveryCosts');
  const visitNeed = safeMoneyResult(treatmentVisits * CI_RECOVERY_REFERENCE.treatmentVisit.total, 'recoveryVisitNeed');
  const caregiverHomeNeed = safeMoneyResult(caregiverHomeDays * CI_RECOVERY_REFERENCE.caregiverHomePerDay, 'recoveryCaregiverHomeNeed');
  const rehabNeed = safeMoneyResult(
    rehabSessions * CI_RECOVERY_REFERENCE.rehabilitation.perSession
      + homeRehabSessions * CI_RECOVERY_REFERENCE.rehabilitation.homeServiceAddOnPerSession,
    'recoveryRehabNeed',
  );
  const total = safeMoneyResult(
    safeMoneyResult(visitNeed + caregiverHomeNeed, 'recoverySubtotal')
      + safeMoneyResult(rehabNeed + equipmentAndHomeModification, 'recoverySubtotal')
      + otherRecoveryCosts,
    'recoveryReserveNeed',
  );
  return {
    treatmentVisits, caregiverHomeDays, rehabSessions, homeRehabSessions,
    visitNeed, caregiverHomeNeed, rehabNeed, equipmentAndHomeModification, otherRecoveryCosts,
    total,
  };
}

/** Main calculator */
export function calculateCI(formData: CIFormData): CIResult {
  const { expenses, existingCI } = formData;

  // Expense base:
  // ค่าใช้จ่ายครัวเรือน × 12 × ปีสำรอง
  // + Σ(ค่าใช้จ่ายการศึกษาต่อปี × ปีที่เหลือรายคน)
  // + ค่างวด × min(งวดคงเหลือ, ปีสำรอง × 12)
  // + ยอดหนี้อื่นคงเหลือรวม (ครั้งเดียว)
  //
  // Income base:
  // รายได้ต่อเดือน × 12 × ปีสำรอง
  //
  // Recovery Reserve is calculated separately, then added ONCE to each method
  // that actually has a primary base. A missing method stays unavailable at 0.
  const effectiveReserveYears = expenses.reserveYears;
  const householdMonthly = expenses.household;
  const householdNeed = calcHouseholdNeed(householdMonthly, effectiveReserveYears);
  const educationPlans = expenses.educationPlans.map((plan) => ({ ...plan }));
  const educationNeed = calcEducationNeed(educationPlans);
  const mortgageDebtNeed = calcDebtNeed(
    expenses.mortgagePayment ?? 0,
    expenses.mortgageInstallmentsRemaining ?? 0,
    effectiveReserveYears,
  );
  const carDebtNeed = calcDebtNeed(
    expenses.carPayment ?? 0,
    expenses.carInstallmentsRemaining ?? 0,
    effectiveReserveYears,
  );
  const otherDebtBalance = calcOtherDebtNeed(expenses.otherDebtBalance ?? 0);
  const debtNeed = safeMoneyResult(
    safeMoneyResult(mortgageDebtNeed + carDebtNeed, 'debtNeed') + otherDebtBalance,
    'debtNeed',
  );
  const recovery = calcRecoveryReserveNeed(expenses.recovery ?? {
    treatmentVisits: 0, caregiverHomeDays: 0, rehabSessions: 0, homeRehabSessions: 0,
    equipmentAndHomeModification: 0, otherRecoveryCosts: 0,
  });
  const recoveryReserveNeed = recovery.total;
  const expenseBaseNeed = safeMoneyResult(
    safeMoneyResult(householdNeed + educationNeed, 'expenseBaseNeed') + debtNeed,
    'expenseBaseNeed',
  );
  const incomeBaseNeed = calcIncomeBasedNeed(
    expenses.monthlyIncome ?? 0,
    effectiveReserveYears,
  );
  const calculatedNeed = expenseBaseNeed > 0
    ? safeMoneyResult(expenseBaseNeed + recoveryReserveNeed, 'calculatedNeed')
    : 0;
  const incomeBasedNeed = incomeBaseNeed > 0
    ? safeMoneyResult(incomeBaseNeed + recoveryReserveNeed, 'incomeBasedNeed')
    : 0;

  const existingCoverage = safeMoneyInput(existingCI.lumpSum ?? 0, 'existingCoverage');
  const liquidAssets = safeMoneyInput(existingCI.liquidAssets ?? 0, 'liquidAssets');
  const availableResources = safeMoneyResult(existingCoverage + liquidAssets, 'availableResources');

  const signedGap = calculatedNeed - availableResources;
  const shortfall = Math.max(signedGap, 0);
  const surplus = Math.max(-signedGap, 0);
  const incomeSignedGap = incomeBasedNeed - availableResources;
  const incomeShortfall = Math.max(incomeSignedGap, 0);
  const incomeSurplus = Math.max(-incomeSignedGap, 0);

  return {
    householdMonthly,
    householdNeed,
    educationPlans,
    educationNeed,
    mortgageDebtNeed,
    carDebtNeed,
    otherDebtBalance,
    debtNeed,
    recoveryTreatmentVisits: recovery.treatmentVisits,
    recoveryCaregiverHomeDays: recovery.caregiverHomeDays,
    recoveryRehabSessions: recovery.rehabSessions,
    recoveryHomeRehabSessions: recovery.homeRehabSessions,
    recoveryVisitNeed: recovery.visitNeed,
    recoveryCaregiverHomeNeed: recovery.caregiverHomeNeed,
    recoveryRehabNeed: recovery.rehabNeed,
    recoveryEquipmentAndHomeModification: recovery.equipmentAndHomeModification,
    recoveryOtherCosts: recovery.otherRecoveryCosts,
    recoveryReserveNeed,
    expenseBaseNeed,
    incomeBaseNeed,
    calculatedNeed,
    existingCoverage,
    liquidAssets,
    availableResources,
    signedGap,
    gap: shortfall,
    shortfall,
    surplus,
    incomeBasedNeed,
    incomeSignedGap,
    incomeShortfall,
    incomeSurplus,
    effectiveReserveYears,
  };
}
