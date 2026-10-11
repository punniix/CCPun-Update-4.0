import { getMoneyStoryCharacter } from './characters';
import type { GameState, StatusBars } from './types';

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function roundBaht(value: number) {
  return Math.round(value);
}

export function totalDebt(state: GameState) {
  return state.debts.reduce((sum, debt) => sum + Math.max(0, debt.principalRemaining), 0);
}

export function currentDebtPayments(state: GameState, month = state.currentMonth) {
  return state.debts
    .filter((debt) => debt.principalRemaining > 0 && debt.remainingMonths > 0 && month >= debt.startPaymentMonth)
    .reduce((sum, debt) => sum + debt.monthlyPayment, 0);
}

export function currentPremiums(state: GameState, month = state.currentMonth) {
  return state.protections
    .filter((protection) => protection.activeFromMonth <= month)
    .reduce((sum, protection) => sum + protection.monthlyPremium, 0);
}

export function financialPyramidGoalMetrics(state: GameState) {
  const reserveMonth = state.currentMonth + 1;
  const recurring =
    state.fixedExpenses +
    currentPremiums(state, reserveMonth) +
    currentDebtPayments(state, reserveMonth);
  const cashReserveTarget = roundBaht(Math.max(0, recurring) * 3);
  const cashReserveAllocated = Math.min(
    Math.max(0, state.cash),
    cashReserveTarget,
  );
  const cashAboveReserve = Math.max(
    0,
    state.cash - cashReserveTarget,
  );
  const goalPosition =
    cashAboveReserve + state.investments - totalDebt(state);

  return {
    recurring: Math.max(1, recurring),
    cashReserveTarget,
    cashReserveAllocated,
    cashAboveReserve,
    goalPosition: roundBaht(goalPosition),
  };
}

export function statusBars(state: GameState): StatusBars {
  const character = getMoneyStoryCharacter(state.characterId);
  const {
    recurring,
    cashReserveTarget,
    cashReserveAllocated,
    cashAboveReserve,
    goalPosition,
  } = financialPyramidGoalMetrics(state);

  const liquidity = clamp(
    (Math.max(0, state.cash) / cashReserveTarget) * 100,
    0,
    100,
  );

  const projected = character.baseIncome - recurring;
  const flexibility = clamp(
    (projected / Math.max(1, character.baseIncome)) * 160,
    0,
    100,
  );

  const netPosition =
    state.cash + state.investments - totalDebt(state);

  const goalProgressPercent =
    (Math.max(0, goalPosition) / Math.max(1, character.goal.targetNetPosition)) * 100;
  const goal = clamp(goalProgressPercent, 0, 100);
  const milestoneStep = goalProgressPercent < 100 ? 25 : 50;
  const goalPreviousMilestonePercent =
    goalProgressPercent < 100
      ? Math.floor(goalProgressPercent / milestoneStep) * milestoneStep
      : Math.floor(goalProgressPercent / milestoneStep) * milestoneStep;
  const goalNextMilestonePercent =
    Math.max(
      milestoneStep,
      goalPreviousMilestonePercent + milestoneStep,
    );
  const goalSegmentRange = Math.max(
    1,
    goalNextMilestonePercent - goalPreviousMilestonePercent,
  );
  const goalSegmentProgress = clamp(
    ((goalProgressPercent - goalPreviousMilestonePercent) / goalSegmentRange) * 100,
    0,
    100,
  );
  const goalNextMilestoneAmount = roundBaht(
    character.goal.targetNetPosition * (goalNextMilestonePercent / 100),
  );
  const goalRemainingToNext = Math.max(
    0,
    goalNextMilestoneAmount - goalPosition,
  );

  const label = (value: number) =>
    value >= 70 ? 'แข็งแรง' :
    value >= 40 ? 'พอขยับได้' :
    value >= 20 ? 'เริ่มตึง' : 'เปราะบาง';

  return {
    liquidity,
    flexibility,
    goal,
    goalProgressPercent,
    goalSegmentProgress,
    goalPreviousMilestonePercent,
    goalNextMilestonePercent,
    goalNextMilestoneAmount,
    goalRemainingToNext,
    cashReserveTarget,
    cashReserveAllocated,
    cashAboveReserve,
    goalPosition,
    liquidityLabel: label(liquidity),
    flexibilityLabel: label(flexibility),
    goalLabel:
      goalProgressPercent >= 200 ? 'ไปไกลกว่าเป้า' :
      goalProgressPercent >= 150 ? 'ต่อยอดหลังถึงเป้า' :
      goalProgressPercent >= 100 ? 'เกินเป้าแล้ว' :
      goalProgressPercent >= 65 ? 'ใกล้ขึ้นมาก' :
      goalProgressPercent >= 35 ? 'กำลังสร้าง' : 'เพิ่งเริ่ม',
    netPosition: roundBaht(netPosition),
    projectedMonthlyFlexibility: roundBaht(projected),
  };
}
