import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateCI, calcRecoveryReserveNeed } from '../features/ci-planning/calculator/calculator';
import { INITIAL_CI_FORM_DATA } from '../features/ci-planning/calculator/constants';
import { validateCIStep } from '../features/ci-planning/calculator/schemas';
import {
  buildCustomRecoveryFromTarget,
  CI_RECOVERY_EVIDENCE_YEAR_FLOOR,
  CI_RECOVERY_PRESETS,
  CI_RECOVERY_REFERENCE,
  CI_RECOVERY_SOURCES,
  copyPresetToCustom,
  EMPTY_CI_RECOVERY,
  getRecoveryPreset,
} from '../features/ci-planning/recovery-evidence';

test('Recovery Reserve defaults to zero and does not change legacy CI outputs', () => {
  const result = calculateCI(structuredClone(INITIAL_CI_FORM_DATA));
  assert.equal(result.recoveryReserveNeed, 0);
  assert.equal(result.recoveryBreakdownTotal, 0);
  assert.equal(result.expenseBaseNeed, result.calculatedNeed);
  assert.equal(result.incomeBaseNeed, result.incomeBasedNeed);
});

test('three CCPun Recovery presets reconcile exactly to their headline reserve', () => {
  const expected = {
    basic: 100_000,
    continued: 500_000,
    longTerm: 2_500_000,
  } as const;

  for (const mode of Object.keys(expected) as Array<keyof typeof expected>) {
    const breakdown = calcRecoveryReserveNeed(getRecoveryPreset(mode));
    assert.equal(breakdown.reserveNeed, expected[mode], mode);
    assert.equal(breakdown.breakdownTotal, expected[mode], mode);
    assert.equal(breakdown.unallocated, 0, mode);
    assert.equal(breakdown.overBudget, 0, mode);
  }
});

test('Recovery Reserve is added once to both available methods', () => {
  const input = structuredClone(INITIAL_CI_FORM_DATA);
  input.expenses.monthlyIncome = 50_000;
  input.expenses.household = 20_000;
  input.expenses.reserveYears = 5;
  input.expenses.recovery = getRecoveryPreset('continued');

  const result = calculateCI(input);

  assert.equal(result.recoveryReserveNeed, 500_000);
  assert.equal(result.expenseBaseNeed, 20_000 * 12 * 5);
  assert.equal(result.calculatedNeed, 20_000 * 12 * 5 + 500_000);
  assert.equal(result.incomeBaseNeed, 50_000 * 12 * 5);
  assert.equal(result.incomeBasedNeed, 50_000 * 12 * 5 + 500_000);
});

test('income-only planning adds Recovery only to income method', () => {
  const input = structuredClone(INITIAL_CI_FORM_DATA);
  input.expenses.monthlyIncome = 50_000;
  input.expenses.reserveYears = 5;
  input.expenses.recovery = getRecoveryPreset('basic');

  const result = calculateCI(input);

  assert.equal(result.expenseBaseNeed, 0);
  assert.equal(result.calculatedNeed, 0);
  assert.equal(result.incomeBaseNeed, 3_000_000);
  assert.equal(result.incomeBasedNeed, 3_100_000);
});

test('expense-only planning adds Recovery only to expense method', () => {
  const input = structuredClone(INITIAL_CI_FORM_DATA);
  input.expenses.household = 20_000;
  input.expenses.reserveYears = 5;
  input.expenses.recovery = getRecoveryPreset('basic');

  const result = calculateCI(input);

  assert.equal(result.expenseBaseNeed, 1_200_000);
  assert.equal(result.calculatedNeed, 1_300_000);
  assert.equal(result.incomeBaseNeed, 0);
  assert.equal(result.incomeBasedNeed, 0);
});

test('custom reserve keeps the user headline amount separate from editable breakdown', () => {
  const custom = copyPresetToCustom('basic');
  custom.targetReserve = 120_000;
  custom.caregiverHomeDays = 20;

  const breakdown = calcRecoveryReserveNeed(custom);

  assert.equal(breakdown.reserveNeed, 120_000);
  assert.ok(breakdown.breakdownTotal > 120_000);
  assert.equal(breakdown.unallocated, 0);
  assert.equal(breakdown.overBudget, breakdown.breakdownTotal - 120_000);
});

test('custom target builder returns an editable example that reconciles to the requested amount', () => {
  const custom = buildCustomRecoveryFromTarget(800_000);
  const breakdown = calcRecoveryReserveNeed(custom);

  assert.equal(custom.mode, 'custom');
  assert.equal(breakdown.reserveNeed, 800_000);
  assert.equal(breakdown.breakdownTotal, 800_000);
  assert.ok(custom.majorHousing > 0, '800k scenario should begin allocating toward major housing');
});

test('custom copy preserves the preset line items but changes only the mode', () => {
  const preset = getRecoveryPreset('continued');
  const custom = copyPresetToCustom('continued');

  assert.equal(custom.mode, 'custom');
  assert.equal(custom.targetReserve, preset.targetReserve);
  assert.equal(custom.homeAdaptation, preset.homeAdaptation);
  assert.equal(custom.caregiverHomeDays, preset.caregiverHomeDays);
});

test('Recovery Reserve cannot be the only planning basis', () => {
  const expenses = structuredClone(INITIAL_CI_FORM_DATA.expenses);
  expenses.recovery = getRecoveryPreset('basic');
  const errors = validateCIStep(0, expenses as unknown as Record<string, unknown>);
  assert.match(errors.expenses ?? '', /รายได้|ค่าใช้จ่าย|ภาระ/);
});

test('custom Recovery requires a positive headline reserve', () => {
  const expenses = structuredClone(INITIAL_CI_FORM_DATA.expenses);
  expenses.monthlyIncome = 1;
  expenses.recovery = { ...EMPTY_CI_RECOVERY, mode: 'custom', targetReserve: 0 };
  const errors = validateCIStep(0, expenses as unknown as Record<string, unknown>);
  assert.match(errors['recovery.targetReserve'] ?? '', /เงินสำรอง|จำนวนเงิน/);
});

test('legacy Recovery payload remains accepted during v10 cutover', () => {
  const legacyExpenses = {
    ...structuredClone(INITIAL_CI_FORM_DATA.expenses),
    monthlyIncome: 50_000,
    recovery: {
      treatmentVisits: 1,
      caregiverHomeDays: 0,
      rehabSessions: 0,
      homeRehabSessions: 0,
      equipmentAndHomeModification: 0,
      otherRecoveryCosts: 0,
    },
  };

  const errors = validateCIStep(0, legacyExpenses as unknown as Record<string, unknown>);
  assert.deepEqual(errors, {});

  const input = structuredClone(INITIAL_CI_FORM_DATA) as unknown as {
    expenses: typeof legacyExpenses;
    existingCI: typeof INITIAL_CI_FORM_DATA.existingCI;
  };
  input.expenses = legacyExpenses;
  const result = calculateCI(input as never);
  assert.equal(result.recoveryReserveNeed, CI_RECOVERY_REFERENCE.legacyResearch.treatmentVisitTotal);
});

test('planning benchmarks and source floor stay explicit', () => {
  assert.equal(CI_RECOVERY_EVIDENCE_YEAR_FLOOR, 2023);
  for (const source of CI_RECOVERY_SOURCES) assert.ok(source.year >= 2023, source.id);

  assert.equal(CI_RECOVERY_REFERENCE.treatmentVisit.planningPerVisit, 3_000);
  assert.equal(CI_RECOVERY_REFERENCE.caregiver.planningPerDay, 2_000);
  assert.equal(CI_RECOVERY_REFERENCE.rehabilitation.planningPerSession, 2_000);
  assert.equal(CI_RECOVERY_REFERENCE.equipment.pulseOximeter, 1_200);
  assert.equal(CI_RECOVERY_REFERENCE.housing.majorHousingPlanning, 2_000_000);

  assert.equal(CI_RECOVERY_PRESETS.basic.reserve, 100_000);
  assert.equal(CI_RECOVERY_PRESETS.continued.reserve, 500_000);
  assert.equal(CI_RECOVERY_PRESETS.longTerm.reserve, 2_500_000);
});
