import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateCI, calcRecoveryReserveNeed } from '../features/ci-planning/calculator/calculator';
import { INITIAL_CI_FORM_DATA } from '../features/ci-planning/calculator/constants';
import { validateCIStep } from '../features/ci-planning/calculator/schemas';
import { CI_RECOVERY_EVIDENCE_YEAR_FLOOR, CI_RECOVERY_REFERENCE, CI_RECOVERY_SOURCES } from '../features/ci-planning/recovery-evidence';

test('Recovery Reserve defaults to zero and does not change legacy CI outputs', () => {
  const result = calculateCI(structuredClone(INITIAL_CI_FORM_DATA));
  assert.equal(result.recoveryReserveNeed, 0);
  assert.equal(result.recoveryVisitNeed, 0);
  assert.equal(result.recoveryCaregiverHomeNeed, 0);
  assert.equal(result.recoveryRehabNeed, 0);
  assert.equal(result.expenseBaseNeed, result.calculatedNeed);
  assert.equal(result.incomeBaseNeed, result.incomeBasedNeed);
});

test('Recovery Reserve formula uses current source-backed rates and is added once to both methods', () => {
  const recovery = {
    treatmentVisits: 4,
    caregiverHomeDays: 10,
    rehabSessions: 6,
    homeRehabSessions: 2,
    equipmentAndHomeModification: 12_000,
    otherRecoveryCosts: 3_000,
  };
  const breakdown = calcRecoveryReserveNeed(recovery);
  const expected = 4 * 2_578 + 10 * 141 + 6 * 450 + 2 * 200 + 12_000 + 3_000;
  assert.equal(breakdown.total, expected);

  const input = structuredClone(INITIAL_CI_FORM_DATA);
  input.expenses.monthlyIncome = 50_000;
  input.expenses.household = 20_000;
  input.expenses.reserveYears = 5;
  input.expenses.recovery = recovery;
  const result = calculateCI(input);

  assert.equal(result.recoveryReserveNeed, expected);
  assert.equal(result.expenseBaseNeed, 20_000 * 12 * 5);
  assert.equal(result.calculatedNeed, 20_000 * 12 * 5 + expected, 'expense total must add Recovery Reserve once');
  assert.equal(result.incomeBaseNeed, 50_000 * 12 * 5);
  assert.equal(result.incomeBasedNeed, 50_000 * 12 * 5 + expected, 'income total must add Recovery Reserve once');
});

test('changing Recovery Reserve changes both totals by exactly the same standalone amount', () => {
  const base = structuredClone(INITIAL_CI_FORM_DATA);
  base.expenses.monthlyIncome = 80_000;
  base.expenses.household = 35_000;
  base.expenses.reserveYears = 4;
  base.existingCI.lumpSum = 500_000;
  base.existingCI.liquidAssets = 200_000;

  const withoutRecovery = calculateCI(base);
  const withRecoveryInput = structuredClone(base);
  withRecoveryInput.expenses.recovery = {
    treatmentVisits: 20,
    caregiverHomeDays: 90,
    rehabSessions: 20,
    homeRehabSessions: 20,
    equipmentAndHomeModification: 40_000,
    otherRecoveryCosts: 250_000,
  };
  const withRecovery = calculateCI(withRecoveryInput);

  const recovery = withRecovery.recoveryReserveNeed;
  assert.ok(recovery > 0);
  assert.equal(withRecovery.expenseBaseNeed, withoutRecovery.expenseBaseNeed);
  assert.equal(withRecovery.incomeBaseNeed, withoutRecovery.incomeBaseNeed);
  assert.equal(withRecovery.calculatedNeed - withoutRecovery.calculatedNeed, recovery);
  assert.equal(withRecovery.incomeBasedNeed - withoutRecovery.incomeBasedNeed, recovery);
  assert.equal(withRecovery.signedGap - withoutRecovery.signedGap, recovery);
  assert.equal(withRecovery.incomeSignedGap - withoutRecovery.incomeSignedGap, recovery);
});

test('home rehab sessions cannot exceed total rehab sessions', () => {
  const expenses = structuredClone(INITIAL_CI_FORM_DATA.expenses);
  expenses.monthlyIncome = 1;
  expenses.recovery = { ...expenses.recovery!, rehabSessions: 2, homeRehabSessions: 3 };
  const errors = validateCIStep(0, expenses as unknown as Record<string, unknown>);
  assert.match(errors['recovery.homeRehabSessions'] ?? '', /ไม่มากกว่า/);
  assert.throws(() => calcRecoveryReserveNeed(expenses.recovery!), /must not exceed/);
});

test('rehab benchmark is bounded to the current NHSO session limit', () => {
  const expenses = structuredClone(INITIAL_CI_FORM_DATA.expenses);
  expenses.monthlyIncome = 1;
  expenses.recovery = { ...expenses.recovery!, rehabSessions: CI_RECOVERY_REFERENCE.rehabilitation.benchmarkSessionLimit + 1 };
  const errors = validateCIStep(0, expenses as unknown as Record<string, unknown>);
  assert.match(errors['recovery.rehabSessions'] ?? '', /20/);
});

test('all Recovery Reserve evidence is 2023 or newer and current source values stay explicit', () => {
  assert.equal(CI_RECOVERY_EVIDENCE_YEAR_FLOOR, 2023);
  for (const source of CI_RECOVERY_SOURCES) assert.ok(source.year >= 2023, source.id);
  assert.equal(CI_RECOVERY_REFERENCE.treatmentVisit.total, 2_578);
  assert.equal(CI_RECOVERY_REFERENCE.caregiverHomePerDay, 141);
  assert.equal(CI_RECOVERY_REFERENCE.rehabilitation.perSession, 450);
  assert.equal(CI_RECOVERY_REFERENCE.rehabilitation.homeServiceAddOnPerSession, 200);
  assert.equal(CI_RECOVERY_REFERENCE.homeModificationPublicProgramCeiling, 40_000);
});
