// =============================================
// CI Planning — Calculator
// =============================================

import { CI_RECOVERY_REFERENCE } from '@/features/ci-planning/recovery-evidence';
import type {
  CIEducationPlan,
  CIFormData,
  CIRecoveryCosts,
  CIRecoveryMode,
  CIResult,
} from './types';

const EMPTY_RECOVERY: CIRecoveryCosts = {
  mode: 'none',
  targetReserve: 0,
  treatmentVisits: 0,
  treatmentVisitUnitCost: 3_000,
  caregiverHomeDays: 0,
  caregiverDailyCost: 2_000,
  rehabSessions: 0,
  rehabUnitCost: 2_000,
  pulseOximeter: 0,
  bloodPressureMonitor: 0,
  thermometer: 0,
  walker: 0,
  wheelchair: 0,
  showerChair: 0,
  grabRailAndSafety: 0,
  hospitalBed: 0,
  consumables: 0,
  homeAdaptation: 0,
  majorHousing: 0,
  contingency: 0,
  otherRecoveryCosts: 0,
};

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
    throw new RangeError(`${name} must be an integer between 0 and ${max}`);
  }
  return value;
}

function requireRecoveryAmount(value: number, name: string): number {
  return safeMoneyInput(value, name);
}

const RECOVERY_MODES = new Set<CIRecoveryMode>(['none', 'basic', 'continued', 'longTerm', 'custom']);

function normalizeRecoveryCosts(input?: CIRecoveryCosts): CIRecoveryCosts {
  if (!input) return { ...EMPTY_RECOVERY };

  const raw = input as CIRecoveryCosts & {
    homeRehabSessions?: number;
    equipmentAndHomeModification?: number;
  };

  if (!RECOVERY_MODES.has(raw.mode)) {
    // Backward-compatible read for legacy fixtures/state created before v10.
    const treatmentVisits = Number((raw as unknown as { treatmentVisits?: number }).treatmentVisits ?? 0);
    const caregiverHomeDays = Number((raw as unknown as { caregiverHomeDays?: number }).caregiverHomeDays ?? 0);
    const rehabSessions = Number((raw as unknown as { rehabSessions?: number }).rehabSessions ?? 0);
    const homeRehabSessions = Number((raw as unknown as { homeRehabSessions?: number }).homeRehabSessions ?? 0);
    const equipmentAndHomeModification = Number((raw as unknown as { equipmentAndHomeModification?: number }).equipmentAndHomeModification ?? 0);
    const otherRecoveryCosts = Number((raw as unknown as { otherRecoveryCosts?: number }).otherRecoveryCosts ?? 0);

    const legacyTotal =
      treatmentVisits * CI_RECOVERY_REFERENCE.legacyResearch.treatmentVisitTotal
      + caregiverHomeDays * CI_RECOVERY_REFERENCE.legacyResearch.caregiverLostIncomePerDay
      + rehabSessions * CI_RECOVERY_REFERENCE.legacyResearch.rehabilitationPerSession
      + homeRehabSessions * CI_RECOVERY_REFERENCE.legacyResearch.homeRehabAddOnPerSession
      + equipmentAndHomeModification
      + otherRecoveryCosts;

    return {
      ...EMPTY_RECOVERY,
      mode: legacyTotal > 0 ? 'custom' : 'none',
      targetReserve: legacyTotal,
      treatmentVisits,
      treatmentVisitUnitCost: CI_RECOVERY_REFERENCE.legacyResearch.treatmentVisitTotal,
      caregiverHomeDays,
      caregiverDailyCost: CI_RECOVERY_REFERENCE.legacyResearch.caregiverLostIncomePerDay,
      rehabSessions,
      rehabUnitCost: CI_RECOVERY_REFERENCE.legacyResearch.rehabilitationPerSession,
      homeAdaptation: equipmentAndHomeModification,
      otherRecoveryCosts: otherRecoveryCosts
        + homeRehabSessions * CI_RECOVERY_REFERENCE.legacyResearch.homeRehabAddOnPerSession,
    };
  }

  return {
    ...EMPTY_RECOVERY,
    ...raw,
  };
}

/**
 * Recovery Reserve v10.
 *
 * The headline reserve is a separate planning block from income / recurring
 * living expenses. Presets have a fixed target; custom mode lets the user keep
 * a chosen headline target while editing the underlying example breakdown.
 */
export function calcRecoveryReserveNeed(input: CIRecoveryCosts) {
  const recovery = normalizeRecoveryCosts(input);
  if (!RECOVERY_MODES.has(recovery.mode)) throw new RangeError('invalid recovery mode');

  const targetReserve = requireRecoveryAmount(recovery.targetReserve, 'recoveryTargetReserve');
  const treatmentVisits = requireRecoveryCount(recovery.treatmentVisits, 'treatmentVisits', 100);
  const treatmentVisitUnitCost = requireRecoveryAmount(recovery.treatmentVisitUnitCost, 'treatmentVisitUnitCost');
  const caregiverHomeDays = requireRecoveryCount(recovery.caregiverHomeDays, 'caregiverHomeDays', 730);
  const caregiverDailyCost = requireRecoveryAmount(recovery.caregiverDailyCost, 'caregiverDailyCost');
  const rehabSessions = requireRecoveryCount(recovery.rehabSessions, 'rehabSessions', 200);
  const rehabUnitCost = requireRecoveryAmount(recovery.rehabUnitCost, 'rehabUnitCost');

  const pulseOximeter = requireRecoveryAmount(recovery.pulseOximeter, 'pulseOximeter');
  const bloodPressureMonitor = requireRecoveryAmount(recovery.bloodPressureMonitor, 'bloodPressureMonitor');
  const thermometer = requireRecoveryAmount(recovery.thermometer, 'thermometer');
  const walker = requireRecoveryAmount(recovery.walker, 'walker');
  const wheelchair = requireRecoveryAmount(recovery.wheelchair, 'wheelchair');
  const showerChair = requireRecoveryAmount(recovery.showerChair, 'showerChair');
  const grabRailAndSafety = requireRecoveryAmount(recovery.grabRailAndSafety, 'grabRailAndSafety');
  const hospitalBed = requireRecoveryAmount(recovery.hospitalBed, 'hospitalBed');
  const consumables = requireRecoveryAmount(recovery.consumables, 'consumables');
  const homeAdaptation = requireRecoveryAmount(recovery.homeAdaptation, 'homeAdaptation');
  const majorHousing = requireRecoveryAmount(recovery.majorHousing, 'majorHousing');
  const contingency = requireRecoveryAmount(recovery.contingency, 'contingency');
  const otherRecoveryCosts = requireRecoveryAmount(recovery.otherRecoveryCosts, 'otherRecoveryCosts');

  const visitNeed = safeMoneyResult(treatmentVisits * treatmentVisitUnitCost, 'recoveryVisitNeed');
  const caregiverHomeNeed = safeMoneyResult(caregiverHomeDays * caregiverDailyCost, 'recoveryCaregiverHomeNeed');
  const rehabNeed = safeMoneyResult(rehabSessions * rehabUnitCost, 'recoveryRehabNeed');

  const equipmentNeed = safeMoneyResult(
    pulseOximeter
      + bloodPressureMonitor
      + thermometer
      + walker
      + wheelchair
      + showerChair
      + grabRailAndSafety
      + hospitalBed,
    'recoveryEquipmentNeed',
  );

  const breakdownTotal = safeMoneyResult(
    safeMoneyResult(visitNeed + caregiverHomeNeed + rehabNeed, 'recoveryServiceSubtotal')
      + safeMoneyResult(equipmentNeed + consumables, 'recoveryEquipmentSubtotal')
      + safeMoneyResult(homeAdaptation + majorHousing, 'recoveryHousingSubtotal')
      + safeMoneyResult(contingency + otherRecoveryCosts, 'recoveryBufferSubtotal'),
    'recoveryBreakdownTotal',
  );

  const reserveNeed = recovery.mode === 'none' ? 0 : targetReserve;
  const unallocated = reserveNeed > breakdownTotal ? reserveNeed - breakdownTotal : 0;
  const overBudget = breakdownTotal > reserveNeed ? breakdownTotal - reserveNeed : 0;

  return {
    ...recovery,
    treatmentVisits,
    treatmentVisitUnitCost,
    caregiverHomeDays,
    caregiverDailyCost,
    rehabSessions,
    rehabUnitCost,
    visitNeed,
    caregiverHomeNeed,
    rehabNeed,
    equipmentNeed,
    breakdownTotal,
    reserveNeed,
    unallocated,
    overBudget,
  };
}

/** Main calculator */
export function calculateCI(formData: CIFormData): CIResult {
  const { expenses, existingCI } = formData;

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

  const recovery = calcRecoveryReserveNeed(expenses.recovery ?? { ...EMPTY_RECOVERY });
  const recoveryReserveNeed = recovery.reserveNeed;

  const expenseBaseNeed = safeMoneyResult(
    safeMoneyResult(householdNeed + educationNeed, 'expenseBaseNeed') + debtNeed,
    'expenseBaseNeed',
  );
  const incomeBaseNeed = calcIncomeBasedNeed(
    expenses.monthlyIncome ?? 0,
    effectiveReserveYears,
  );

  const existingCoverage = safeMoneyInput(existingCI.lumpSum ?? 0, 'existingCoverage');
  const liquidAssets = safeMoneyInput(existingCI.liquidAssets ?? 0, 'liquidAssets');
  const protectLiquidAssets = existingCI.protectLiquidAssets === true && liquidAssets > 0;
  // ponytail: add the chosen asset amount to the goal once; keep resources unchanged so the gap rises once.
  const protectedAssetsNeed = protectLiquidAssets ? liquidAssets : 0;
  const calculatedNeed = expenseBaseNeed > 0
    ? safeMoneyResult(safeMoneyResult(expenseBaseNeed + recoveryReserveNeed, 'calculatedNeed') + protectedAssetsNeed, 'calculatedNeed')
    : 0;
  const incomeBasedNeed = incomeBaseNeed > 0
    ? safeMoneyResult(safeMoneyResult(incomeBaseNeed + recoveryReserveNeed, 'incomeBasedNeed') + protectedAssetsNeed, 'incomeBasedNeed')
    : 0;
  const availableResources = safeMoneyResult(existingCoverage + liquidAssets, 'availableResources');

  const signedGap = calculatedNeed - availableResources;
  const shortfall = Math.max(signedGap, 0);
  const surplus = Math.max(-signedGap, 0);
  const incomeSignedGap = incomeBasedNeed - availableResources;
  const incomeShortfall = Math.max(incomeSignedGap, 0);
  const incomeSurplus = Math.max(-incomeSignedGap, 0);

  const equipmentAndHomeModification = safeMoneyResult(
    recovery.equipmentNeed + recovery.homeAdaptation + recovery.majorHousing,
    'recoveryEquipmentAndHomeModification',
  );

  return {
    householdMonthly,
    householdNeed,
    educationPlans,
    educationNeed,
    mortgageDebtNeed,
    carDebtNeed,
    otherDebtBalance,
    debtNeed,

    recoveryMode: recovery.mode,
    recoveryTargetReserve: recovery.targetReserve,
    recoveryBreakdownTotal: recovery.breakdownTotal,
    recoveryUnallocated: recovery.unallocated,
    recoveryOverBudget: recovery.overBudget,

    recoveryTreatmentVisits: recovery.treatmentVisits,
    recoveryTreatmentVisitUnitCost: recovery.treatmentVisitUnitCost,
    recoveryCaregiverHomeDays: recovery.caregiverHomeDays,
    recoveryCaregiverDailyCost: recovery.caregiverDailyCost,
    recoveryRehabSessions: recovery.rehabSessions,
    recoveryRehabUnitCost: recovery.rehabUnitCost,

    recoveryVisitNeed: recovery.visitNeed,
    recoveryCaregiverHomeNeed: recovery.caregiverHomeNeed,
    recoveryRehabNeed: recovery.rehabNeed,

    recoveryPulseOximeter: recovery.pulseOximeter,
    recoveryBloodPressureMonitor: recovery.bloodPressureMonitor,
    recoveryThermometer: recovery.thermometer,
    recoveryWalker: recovery.walker,
    recoveryWheelchair: recovery.wheelchair,
    recoveryShowerChair: recovery.showerChair,
    recoveryGrabRailAndSafety: recovery.grabRailAndSafety,
    recoveryHospitalBed: recovery.hospitalBed,
    recoveryConsumables: recovery.consumables,
    recoveryHomeAdaptation: recovery.homeAdaptation,
    recoveryMajorHousing: recovery.majorHousing,
    recoveryContingency: recovery.contingency,
    recoveryOtherCosts: recovery.otherRecoveryCosts,

    recoveryHomeRehabSessions: 0,
    recoveryEquipmentAndHomeModification: equipmentAndHomeModification,
    recoveryReserveNeed,

    expenseBaseNeed,
    incomeBaseNeed,
    calculatedNeed,

    existingCoverage,
    liquidAssets,
    protectLiquidAssets,
    protectedAssetsNeed,
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
