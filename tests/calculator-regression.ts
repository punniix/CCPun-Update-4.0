import assert from 'node:assert/strict';
import { calculateCiPlanning, validateCiPlanning, type CiFormData } from '../features/ci-planning/legacy/calculator';
import {
  calculateCI,
  calcDebtNeed,
  calcEducationNeed,
  calcHouseholdNeed,
  calcIncomeBasedNeed,
  calcOtherDebtNeed,
} from '../features/ci-planning/calculator/calculator';
import { INITIAL_CI_FORM_DATA } from '../features/ci-planning/calculator/constants';
import { validateCIStep } from '../features/ci-planning/calculator/schemas';
import { calculateFHC } from '../features/financial-health-check/calculator/calculator';
import { validateStep } from '../features/financial-health-check/calculator/schemas';
import type { FHCFormData } from '../features/financial-health-check/calculator/types';

const ciBase: CiFormData = {
  age: 35,
  monthlyIncome: 50_000,
  monthlyExpenses: 30_000,
  savings: 100_000,
  healthInsuranceCoverage: 0,
  criticalIllnessCoverage: 0,
  dependents: 0,
};

const fhcBase: FHCFormData = {
  personalInfo: {
    age: 35,
    retirementAge: 60,
  },
  priorities: {
    incomeProtection: 1,
    retirementSavings: 2,
    medicalExpenses: 3,
    criticalIllness: 0,
    childEducation: 0,
  },
  incomeExpenses: {
    monthlyIncome: 50_000,
    monthlyExpenses: 30_000,
    spouseIncome: 0,
  },
  debts: {
    items: [],
    totalDebt: 0,
  },
  dependents: {
    numberOfDependents: 0,
    yearsOfSupport: 0,
    numberOfChildren: 0,
    educationCostPerChild: 0,
    children: [],
  },
  existingCoverage: {
    lifeInsuranceSumAssured: 0,
    savings: 0,
    investments: 0,
    hasHealthInsurance: false,
    healthInsuranceCoverage: 0,
    hasCriticalIllness: false,
    criticalIllnessCoverage: 0,
    hasSocialSecurity: false,
    finalExpenses: 200_000,
    existingEmergencyFund: 0,
  },
};

type FhcOverrides = Partial<Omit<FHCFormData, 'personalInfo' | 'incomeExpenses' | 'debts' | 'dependents' | 'existingCoverage' | 'priorities'>> & {
  personalInfo?: Partial<FHCFormData['personalInfo']>;
  incomeExpenses?: Partial<FHCFormData['incomeExpenses']>;
  debts?: Partial<FHCFormData['debts']>;
  dependents?: Partial<FHCFormData['dependents']>;
  existingCoverage?: Partial<FHCFormData['existingCoverage']>;
  priorities?: Partial<FHCFormData['priorities']>;
};

function withFhc(overrides: FhcOverrides): FHCFormData {
  return {
    ...fhcBase,
    ...overrides,
    personalInfo: { ...fhcBase.personalInfo, ...overrides.personalInfo },
    incomeExpenses: { ...fhcBase.incomeExpenses, ...overrides.incomeExpenses },
    debts: { ...fhcBase.debts, ...overrides.debts },
    dependents: { ...fhcBase.dependents, ...overrides.dependents },
    existingCoverage: { ...fhcBase.existingCoverage, ...overrides.existingCoverage },
    priorities: { ...fhcBase.priorities, ...overrides.priorities },
  };
}

const ciDefault = calculateCiPlanning(ciBase);
assert.equal(ciDefault.recoveryMonths, 6, 'CI default should use 6 months income replacement');
assert.equal(ciDefault.totalNeed, 1_380_000, 'CI default total need changed unexpectedly');
assert.equal(ciDefault.existingProtection, 0, 'Emergency savings must not be counted twice as protection');
assert.equal(ciDefault.gap, 1_380_000, 'CI default gap should not subtract reserved emergency savings twice');

const ciAge25 = calculateCiPlanning({ ...ciBase, age: 25 });
const ciAge60 = calculateCiPlanning({ ...ciBase, age: 60 });
assert.notEqual(ciAge25.gap, ciAge60.gap, 'CI age input must affect the result');
assert.equal(ciAge60.recoveryMonths, 12, 'CI age 60 should use a longer recovery period');
assert.equal(ciAge60.medicalBuffer, 1_500_000, 'CI age 60 should use a higher medical buffer base');

const ciHighHealthCover = calculateCiPlanning({
  ...ciBase,
  healthInsuranceCoverage: 1_000_000,
});
assert.ok(ciHighHealthCover.medicalBuffer > 0, 'Health insurance must not reduce medical buffer to zero');
assert.equal(ciHighHealthCover.medicalBuffer, 300_000, 'Health insurance credit/floor changed unexpectedly');

const ciSavingsFullReserve = calculateCiPlanning({
  ...ciBase,
  savings: 180_000,
});
const ciNoSavings = calculateCiPlanning({
  ...ciBase,
  savings: 0,
});
assert.equal(
  ciNoSavings.gap - ciSavingsFullReserve.gap,
  180_000,
  'Savings should reduce CI gap once, not twice'
);

const ciFamily = calculateCiPlanning({
  ...ciBase,
  monthlyIncome: 80_000,
  monthlyExpenses: 55_000,
  dependents: 3,
});
assert.equal(ciFamily.recoveryMonths, 12, 'CI with dependents should use 12 months income replacement');
assert.equal(ciFamily.familySupport, 165_000, 'CI family support should use total household expenses once, not per dependent');

const ciInvalid = validateCiPlanning({
  ...ciBase,
  age: 0,
  monthlyIncome: 0,
  monthlyExpenses: 0,
});
assert.equal(ciInvalid.isValid, false, 'CI should not be valid when core fields are zero');
assert.equal(ciInvalid.errors.age, 'กรุณากรอกอายุ', 'CI should validate age');
assert.equal(ciInvalid.errors.monthlyIncome, 'กรุณากรอกรายได้ต่อเดือน', 'CI should validate monthly income');
assert.equal(ciInvalid.errors.monthlyExpenses, 'กรุณากรอกค่าใช้จ่ายต่อเดือน', 'CI should validate monthly expenses');

const ciCashflowWarning = validateCiPlanning({
  ...ciBase,
  monthlyIncome: 30_000,
  monthlyExpenses: 60_000,
});
assert.equal(ciCashflowWarning.isValid, true, 'CI should still calculate when expenses exceed income');
assert.equal(
  ciCashflowWarning.warnings.cashflow,
  'ค่าใช้จ่ายมากกว่ารายได้ ผลลัพธ์อาจสูงกว่าสถานการณ์ปกติ',
  'CI should warn when expenses exceed income'
);

const livingBenefitsExpenses = {
  monthlyIncome: 50_000,
  household: 20_000,
  educationPlans: [
    { annualCost: 60_000, yearsRemaining: 10 },
    { annualCost: 100_000, yearsRemaining: 4 },
  ],
  mortgagePayment: 15_000,
  mortgageInstallmentsRemaining: 60,
  carPayment: 8_000,
  carInstallmentsRemaining: 36,
  otherDebtBalance: 50_000,
  reserveYears: 5,
};

const livingBenefitsCi = calculateCI({
  ...INITIAL_CI_FORM_DATA,
  expenses: livingBenefitsExpenses,
  existingCI: {
    lumpSum: 1_000_000,
    liquidAssets: 500_000,
  },
});
assert.equal(livingBenefitsCi.effectiveReserveYears, 5, 'Living Benefits reserve years should use the user-selected value');
assert.equal(calcHouseholdNeed(20_000, 5), 1_200_000, 'Household need should use monthly cost x 12 x reserve years');
assert.equal(calcEducationNeed(livingBenefitsExpenses.educationPlans), 1_000_000, 'Education need should sum each child with an independent horizon');
assert.equal(livingBenefitsCi.householdNeed, 1_200_000, 'Household need must exclude education and debt installments');
assert.equal(livingBenefitsCi.educationNeed, 1_000_000, 'Education need should include both children once');
assert.equal(livingBenefitsCi.mortgageDebtNeed, 900_000, 'Mortgage need should cover 60 remaining installments');
assert.equal(livingBenefitsCi.carDebtNeed, 288_000, 'Car need should stop after 36 remaining installments');
assert.equal(livingBenefitsCi.otherDebtBalance, 50_000, 'Other remaining debt should be returned once');
assert.equal(livingBenefitsCi.debtNeed, 1_238_000, 'Debt need should include installment reserves and other remaining debt once');
assert.equal(livingBenefitsCi.calculatedNeed, 3_438_000, 'Calculated need should include household, education, installment reserves, and other debt');
assert.equal(calcIncomeBasedNeed(50_000, 5), 3_000_000, 'Income method should use monthly income x 12 x reserve years');
assert.equal(livingBenefitsCi.incomeBasedNeed, 3_000_000, 'Income method should remain separate from expense need');
assert.equal(livingBenefitsCi.existingCoverage, 1_000_000, 'CI lump sum should remain visible separately');
assert.equal(livingBenefitsCi.liquidAssets, 500_000, 'Liquid assets should remain visible separately');
assert.equal(livingBenefitsCi.availableResources, 1_500_000, 'Available resources should combine CI lump sum and liquid assets once');
assert.equal(livingBenefitsCi.signedGap, 1_938_000, 'Signed gap should deduct all available resources once');
assert.equal(livingBenefitsCi.shortfall, 1_938_000, 'Shortfall should be the positive signed gap');
assert.equal(livingBenefitsCi.surplus, 0, 'A shortfall case should have no surplus');
assert.equal(livingBenefitsCi.incomeSignedGap, 1_500_000, 'Available resources should offset the income method independently');
assert.equal(livingBenefitsCi.incomeShortfall, 1_500_000, 'Income shortfall should deduct available resources once');
assert.equal(livingBenefitsCi.incomeSurplus, 0, 'Income shortfall should not create a surplus');
assert.ok(!('combinedNeed' in livingBenefitsCi), 'CI result must never expose a combined expense and income total');
assert.notEqual(
  livingBenefitsCi.calculatedNeed,
  livingBenefitsCi.calculatedNeed + livingBenefitsCi.incomeBasedNeed,
  'Expense method must remain unchanged instead of adding the income method',
);

const livingBenefitsZero = calculateCI({
  ...INITIAL_CI_FORM_DATA,
  existingCI: {
    lumpSum: 0,
    liquidAssets: 0,
  },
});
assert.equal(livingBenefitsZero.calculatedNeed, 0, 'Zero entered need must remain zero without a fixed floor');
assert.equal(livingBenefitsZero.shortfall, 0, 'Zero need must not create a shortfall');
assert.equal(livingBenefitsZero.incomeBasedNeed, 0, 'Zero monthly income must keep the income method unavailable');
assert.equal(livingBenefitsZero.incomeShortfall, 0, 'Zero monthly income must not create an income shortfall');

const livingBenefitsIncomeOnly = calculateCI({
  ...INITIAL_CI_FORM_DATA,
  expenses: {
    ...INITIAL_CI_FORM_DATA.expenses,
    monthlyIncome: 50_000,
    reserveYears: 5,
  },
});
assert.equal(livingBenefitsIncomeOnly.calculatedNeed, 0, 'Income-only planning must not change the expense method');
assert.equal(livingBenefitsIncomeOnly.incomeBasedNeed, 3_000_000, 'Income-only planning must calculate the income method');
assert.equal(livingBenefitsIncomeOnly.incomeShortfall, 3_000_000, 'Income-only planning must derive its own shortfall');

const livingBenefitsSmallNeed = calculateCI({
  ...INITIAL_CI_FORM_DATA,
  expenses: {
    ...INITIAL_CI_FORM_DATA.expenses,
    household: 100,
    reserveYears: 1,
  },
  existingCI: {
    lumpSum: 0,
    liquidAssets: 0,
  },
});
assert.equal(livingBenefitsSmallNeed.calculatedNeed, 1_200, 'Calculated need must not be raised by a fixed floor');

for (const amount of [2_999_999, 3_000_000, 3_000_001]) {
  const boundaryNeed = calculateCI({
    ...INITIAL_CI_FORM_DATA,
    expenses: {
      ...INITIAL_CI_FORM_DATA.expenses,
      educationPlans: [{ annualCost: amount, yearsRemaining: 1 }],
    },
  });
  assert.equal(boundaryNeed.calculatedNeed, amount, 'CI must preserve user-entered need around internal research benchmarks');
}

const livingBenefitsSurplus = calculateCI({
  ...INITIAL_CI_FORM_DATA,
  expenses: {
    ...INITIAL_CI_FORM_DATA.expenses,
    household: 20_000,
    reserveYears: 5,
  },
  existingCI: {
    lumpSum: 1_000_000,
    liquidAssets: 500_000,
  },
});
assert.equal(livingBenefitsSurplus.signedGap, -300_000, 'Signed gap should be negative when available resources exceed need');
assert.equal(livingBenefitsSurplus.shortfall, 0, 'Surplus should not produce a shortfall');
assert.equal(livingBenefitsSurplus.surplus, 300_000, 'Surplus should expose the absolute excess amount');
assert.equal(livingBenefitsSurplus.availableResources, 1_500_000, 'Surplus case should combine available resources once');

const liquidAssetsOffsetGap = calculateCI({
  ...INITIAL_CI_FORM_DATA,
  expenses: {
    ...INITIAL_CI_FORM_DATA.expenses,
    household: 20_000,
    reserveYears: 5,
  },
  existingCI: {
    lumpSum: 200_000,
    liquidAssets: 300_000,
  },
});
assert.equal(liquidAssetsOffsetGap.calculatedNeed, 1_200_000, 'Primary need should use entered expenses only');
assert.equal(liquidAssetsOffsetGap.shortfall, 700_000, 'CI lump sum and liquid assets should offset the gap once');
assert.equal(liquidAssetsOffsetGap.availableResources, 500_000, 'Available resources should not be counted twice');

const protectedAssets = calculateCI({
  ...INITIAL_CI_FORM_DATA,
  expenses: {
    ...INITIAL_CI_FORM_DATA.expenses,
    household: 20_000,
    monthlyIncome: 20_000,
    reserveYears: 5,
  },
  existingCI: {
    lumpSum: 200_000,
    liquidAssets: 300_000,
    protectLiquidAssets: true,
  },
});
assert.equal(protectedAssets.protectedAssetsNeed, 300_000, 'Protection target must use the entered liquid assets once');
assert.equal(protectedAssets.calculatedNeed, 1_500_000, 'Expense method must add the protection target once');
assert.equal(protectedAssets.incomeBasedNeed, 1_500_000, 'Income method must add the protection target once');
assert.equal(protectedAssets.availableResources, 500_000, 'Protection choice must not remove or duplicate existing resources');
assert.equal(protectedAssets.shortfall, 1_000_000, 'Protected assets must increase the gap by one asset amount');
assert.equal(protectedAssets.incomeShortfall, 1_000_000, 'Income gap must use the same single protection addition');
assert.equal(calculateCI({ ...INITIAL_CI_FORM_DATA, existingCI: { lumpSum: 0, liquidAssets: 0, protectLiquidAssets: true } }).protectedAssetsNeed, 0, 'Zero assets must not create a protection target');

assert.equal(
  calcDebtNeed(10_000, 24, 5),
  240_000,
  'Debt reserve should stop when remaining installments are shorter than the reserve window',
);
assert.equal(
  calcDebtNeed(10_000, 120, 5),
  600_000,
  'Debt reserve should stop when the reserve window is shorter than the loan term',
);
assert.throws(
  () => calcDebtNeed(Number.NaN, 12, 5),
  RangeError,
  'Debt reserve should reject non-finite payments',
);
assert.throws(
  () => calcDebtNeed(10_000, 601, 5),
  RangeError,
  'Debt reserve should reject more than 600 remaining installments',
);
assert.throws(
  () => calcHouseholdNeed(Number.POSITIVE_INFINITY, 5),
  RangeError,
  'Household need should reject non-finite amounts',
);
assert.throws(
  () => calcEducationNeed([{ annualCost: 60_000, yearsRemaining: 31 }]),
  RangeError,
  'Education need should reject a horizon above 30 years',
);
assert.equal(calcOtherDebtNeed(50_000), 50_000, 'Other debt must be included once without a multiplier');
assert.throws(() => calcOtherDebtNeed(-1), RangeError, 'Other debt must reject negative values');
assert.throws(() => calcOtherDebtNeed(Number.NaN), RangeError, 'Other debt must reject non-finite values');

const otherDebtOnly = calculateCI({
  ...INITIAL_CI_FORM_DATA,
  expenses: { ...INITIAL_CI_FORM_DATA.expenses, otherDebtBalance: 50_000 },
});
assert.equal(otherDebtOnly.debtNeed, 50_000, 'Other debt alone must satisfy the full debt need');
assert.equal(otherDebtOnly.calculatedNeed, 50_000, 'Other debt alone must satisfy Step 1 calculation input');

const ciEducationMissingCost = validateCIStep(0, {
  ...livingBenefitsExpenses,
  educationPlans: [{ annualCost: 0, yearsRemaining: 10 }],
});
assert.ok(ciEducationMissingCost['educationPlans.0.annualCost'], 'Each child should require an annual education cost');

const ciEducationMissingYears = validateCIStep(0, {
  ...livingBenefitsExpenses,
  educationPlans: [{ annualCost: 60_000, yearsRemaining: 0 }],
});
assert.ok(ciEducationMissingYears['educationPlans.0.yearsRemaining'], 'Each child should require remaining education years');

const ciEducationSkipped = validateCIStep(0, {
  ...livingBenefitsExpenses,
  educationPlans: [],
});
assert.equal(ciEducationSkipped['educationPlans.0.annualCost'], undefined, 'An empty education list should be valid');

const ciMortgageMissingInstallments = validateCIStep(0, {
  ...livingBenefitsExpenses,
  mortgageInstallmentsRemaining: 0,
});
assert.ok(
  ciMortgageMissingInstallments.mortgageInstallmentsRemaining,
  'CI expenses should require remaining mortgage installments when a payment is entered',
);

const ciMortgageMissingPayment = validateCIStep(0, {
  ...livingBenefitsExpenses,
  mortgagePayment: 0,
});
assert.ok(
  ciMortgageMissingPayment.mortgagePayment,
  'CI expenses should require a mortgage payment when remaining installments are entered',
);

const ciCarMissingInstallments = validateCIStep(0, {
  ...livingBenefitsExpenses,
  carInstallmentsRemaining: 0,
});
assert.ok(
  ciCarMissingInstallments.carInstallmentsRemaining,
  'CI expenses should require remaining car installments when a payment is entered',
);

const ciInvalidInstallments = validateCIStep(0, {
  ...livingBenefitsExpenses,
  carInstallmentsRemaining: 36.5,
});
assert.ok(ciInvalidInstallments.carInstallmentsRemaining, 'CI expenses should require whole remaining installments');

const ciTooManyInstallments = validateCIStep(0, {
  ...livingBenefitsExpenses,
  mortgageInstallmentsRemaining: 601,
});
assert.ok(ciTooManyInstallments.mortgageInstallmentsRemaining, 'CI expenses should cap remaining installments at 600');

const ciNegativeExpense = validateCIStep(0, {
  ...livingBenefitsExpenses,
  household: -1,
});
assert.ok(ciNegativeExpense.household, 'CI expenses should reject negative household expenses');
assert.ok(
  validateCIStep(0, { ...livingBenefitsExpenses, monthlyIncome: -1 }).monthlyIncome,
  'CI expenses should reject negative monthly income',
);
assert.ok(
  validateCIStep(0, { ...livingBenefitsExpenses, monthlyIncome: Number.POSITIVE_INFINITY }).monthlyIncome,
  'CI expenses should reject non-finite monthly income',
);

const ciIncomeOnlyValidation = validateCIStep(0, {
  ...INITIAL_CI_FORM_DATA.expenses,
  monthlyIncome: 50_000,
});
assert.deepEqual(ciIncomeOnlyValidation, {}, 'Monthly income alone should enable the optional income method');

const ciOtherDebtOnlyValidation = validateCIStep(0, {
  ...INITIAL_CI_FORM_DATA.expenses,
  otherDebtBalance: 50_000,
});
assert.deepEqual(ciOtherDebtOnlyValidation, {}, 'Other debt alone should satisfy Step 1 zero-input validation');
assert.ok(
  validateCIStep(0, { ...livingBenefitsExpenses, otherDebtBalance: -1 }).otherDebtBalance,
  'CI expenses should reject negative other debt',
);
assert.ok(
  validateCIStep(0, { ...livingBenefitsExpenses, otherDebtBalance: Number.POSITIVE_INFINITY }).otherDebtBalance,
  'CI expenses should reject non-finite other debt',
);

const ciEmptyExpenseValidation = validateCIStep(
  0,
  INITIAL_CI_FORM_DATA.expenses as unknown as Record<string, unknown>,
);
assert.ok(
  ciEmptyExpenseValidation.expenses,
  'CI expenses should require monthly income or at least one expense-side burden',
);

const ciInstallmentsOnlyValidation = validateCIStep(0, {
  ...INITIAL_CI_FORM_DATA.expenses,
  mortgageInstallmentsRemaining: 12,
});
assert.ok(ciInstallmentsOnlyValidation.mortgagePayment, 'Installments alone should require a paired mortgage payment');
assert.ok(ciInstallmentsOnlyValidation.expenses, 'Installments alone should not count as a planning basis');

assert.deepEqual(
  validateCIStep(1, { lumpSum: 0, liquidAssets: 0 }),
  {},
  'Existing CI and liquid assets should both be optional',
);
assert.ok(
  validateCIStep(1, { lumpSum: 0, liquidAssets: -1 }).liquidAssets,
  'Liquid assets should reject negative values',
);
assert.ok(
  validateCIStep(1, { lumpSum: 0, liquidAssets: Number.POSITIVE_INFINITY }).liquidAssets,
  'Liquid assets should reject non-finite values',
);

const fhcNoDependents = calculateFHC(fhcBase);
assert.equal(fhcNoDependents.incomeReplacement, 300_000, 'FHC no-dependent baseline should cover 6 months of income');
assert.equal(fhcNoDependents.totalNeed, 480_000, 'FHC no-dependent total need changed unexpectedly');
assert.equal(fhcNoDependents.gap, 480_000, 'FHC no-dependent gap changed unexpectedly');

const fhcEmergencyAndSavings = calculateFHC(withFhc({
  existingCoverage: {
    savings: 180_000,
    existingEmergencyFund: 180_000,
  },
}));
assert.equal(fhcEmergencyAndSavings.emergencyFund, 0, 'Existing emergency fund should satisfy emergency target');
assert.equal(fhcEmergencyAndSavings.savingsAvailableForProtection, 0, 'Reserved emergency savings must not be counted as extra protection');
assert.equal(fhcEmergencyAndSavings.totalExisting, 0, 'Reserved emergency savings should not inflate total existing');
assert.equal(fhcEmergencyAndSavings.gap, 300_000, 'FHC reserved savings should reduce gap once, not twice');

const fhcSavingsOnly = calculateFHC(withFhc({
  existingCoverage: {
    savings: 180_000,
    existingEmergencyFund: 0,
  },
}));
assert.equal(fhcSavingsOnly.gap, 300_000, 'Savings-only and explicit emergency reserve should not create different protection gaps');

const fhcReserveGreaterThanSavings = calculateFHC(withFhc({
  existingCoverage: {
    savings: 0,
    existingEmergencyFund: 180_000,
  },
}));
assert.equal(fhcReserveGreaterThanSavings.emergencyReserveUsed, 0, 'Emergency reserve cannot exceed savings entered above');
assert.equal(fhcReserveGreaterThanSavings.emergencyFund, 180_000, 'Emergency need should not be reduced by unavailable savings');
assert.equal(fhcReserveGreaterThanSavings.gap, 480_000, 'Unavailable emergency reserve should not reduce FHC gap');

const dependentValidation = validateStep(4, {
  numberOfDependents: 1,
  yearsOfSupport: 0,
  numberOfChildren: 0,
  educationCostPerChild: 0,
});
assert.equal(
  dependentValidation.yearsOfSupport,
  'กรุณากรอกจำนวนปีที่ต้องดูแล',
  'Dependents should require years of support'
);

const childValidation = validateStep(4, {
  numberOfDependents: 1,
  yearsOfSupport: 10,
  numberOfChildren: 1,
  educationCostPerChild: 0,
  children: [{ costPerYear: 0, yearsRemaining: 0 }],
});
assert.equal(
  childValidation.children,
  'กรุณากรอกค่าใช้จ่ายและจำนวนปีของบุตรให้ครบ',
  'Children should require complete education cost and years'
);

const emergencyValidation = validateStep(5, {
  lifeInsuranceSumAssured: 0,
  savings: 0,
  investments: 0,
  existingEmergencyFund: 180_000,
});
assert.equal(
  emergencyValidation.existingEmergencyFund,
  'เงินสำรองฉุกเฉินต้องไม่มากกว่าเงินออมที่กรอกด้านบน',
  'Emergency reserve should not exceed savings entered above'
);

process.stdout.write('calculator regression checks passed\n');
