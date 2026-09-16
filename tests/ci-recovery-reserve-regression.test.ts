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
});

test('Recovery Reserve formula uses current source-backed rates and is added only to expense method', () => {
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
  assert.equal(result.calculatedNeed, 20_000 * 12 * 5 + expected);
  assert.equal(result.incomeBasedNeed, 50_000 * 12 * 5, 'income method must not add Recovery Reserve twice');
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
