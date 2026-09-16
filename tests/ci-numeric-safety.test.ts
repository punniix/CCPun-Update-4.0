import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCI,
  calcDebtNeed,
  calcEducationNeed,
  calcHouseholdNeed,
  calcIncomeBasedNeed,
  calcRecoveryReserveNeed,
} from '../features/ci-planning/calculator/calculator';
import { INITIAL_CI_FORM_DATA } from '../features/ci-planning/calculator/constants';

test('CI money formulas reject arithmetic beyond Number safe-integer precision', () => {
  assert.throws(() => calcHouseholdNeed(Number.MAX_SAFE_INTEGER, 10), RangeError);
  assert.throws(() => calcIncomeBasedNeed(Number.MAX_SAFE_INTEGER, 10), RangeError);
  assert.throws(() => calcDebtNeed(Number.MAX_SAFE_INTEGER, 120, 10), RangeError);
  assert.throws(() => calcEducationNeed([{ annualCost: Number.MAX_SAFE_INTEGER, yearsRemaining: 30 }]), RangeError);
});

test('Recovery Reserve rejects unsafe user-entered money even when visit counts are valid', () => {
  assert.throws(() => calcRecoveryReserveNeed({
    treatmentVisits: 1,
    caregiverHomeDays: 1,
    rehabSessions: 1,
    homeRehabSessions: 0,
    equipmentAndHomeModification: Number.MAX_SAFE_INTEGER,
    otherRecoveryCosts: 1,
  }), RangeError);
});

test('CI calculator rejects combined resources that would lose integer precision', () => {
  const input = structuredClone(INITIAL_CI_FORM_DATA);
  input.expenses.household = 1;
  input.existingCI.lumpSum = Number.MAX_SAFE_INTEGER;
  input.existingCI.liquidAssets = 1;
  assert.throws(() => calculateCI(input), RangeError);
});

test('large but safe CI values still calculate exactly', () => {
  const input = structuredClone(INITIAL_CI_FORM_DATA);
  input.expenses.monthlyIncome = 1_000_000_000;
  input.expenses.household = 500_000_000;
  input.expenses.reserveYears = 10;
  input.expenses.recovery = {
    treatmentVisits: 100,
    caregiverHomeDays: 730,
    rehabSessions: 20,
    homeRehabSessions: 20,
    equipmentAndHomeModification: 40_000,
    otherRecoveryCosts: 1_000_000,
  };
  const result = calculateCI(input);
  assert.ok(Number.isSafeInteger(result.calculatedNeed));
  assert.ok(Number.isSafeInteger(result.incomeBasedNeed));
  assert.equal(result.calculatedNeed, result.expenseBaseNeed! + result.recoveryReserveNeed);
  assert.equal(result.incomeBasedNeed, result.incomeBaseNeed! + result.recoveryReserveNeed);
});
