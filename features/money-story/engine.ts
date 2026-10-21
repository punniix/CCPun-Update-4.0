// Public engine contract and monthly orchestration. Internal modules stay acyclic.
import { MONEY_STORY_CHARACTERS, getMoneyStoryCharacter } from './characters';
import { MONEY_STORY_TOTAL_MONTHS } from './config';
import { currentPremiums, financialPyramidGoalMetrics, roundBaht } from './financial-metrics';
import { characterFor, nextRandom, randomAt, relevantModifiers } from './engine-state';
import { payDebts } from './engine-debt';
import { selectEvent } from './engine-events';
import type { GameState } from './types';

export { statusBars, totalDebt } from './financial-metrics';
export { characterFor } from './engine-state';
export { amortizedPayment } from './engine-debt';
export { eventEligible, selectEvent, protectionBenefitPreview, resolveEventChoice } from './engine-events';
export {
  quoteShortfallLoan, quoteRecoveryExtraIncome, quoteRecoveryExpenseCut, quoteRecoveryDebtRestructure,
  coverShortfallWithInvestments, coverShortfallWithLoan, coverShortfallWithExtraIncome,
  coverShortfallWithExpenseCut, coverShortfallWithDebtRestructure, hasRecoveryOption, declareUnableToContinue,
} from './engine-recovery';

export function createSeed(): string {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

export function createGame(seed = createSeed(), characterId?: string): GameState {
  const index = Math.floor(randomAt(seed, 0) * MONEY_STORY_CHARACTERS.length) % MONEY_STORY_CHARACTERS.length;
  const character = getMoneyStoryCharacter(characterId ?? MONEY_STORY_CHARACTERS[index].id);

  return {
    seed,
    rngCursor: 1,
    characterId: character.id,
    currentMonth: 1,
    monthStarted: false,
    cash: character.startingCash,
    investments: character.startingInvestments,
    fixedExpenses: character.fixedExpenses,
    healthBenefitCap: character.healthBenefitCap,
    protections: character.existingProtections.map((protection) => ({
      type: protection.type,
      activeFromMonth: 1,
      monthlyPremium: protection.monthlyPremium ?? 0,
      source: 'existing',
    })),
    debts: character.startingDebts.map((debt) => ({
      ...debt,
      startPaymentMonth: debt.startPaymentMonth ?? 1,
    })),
    modifiers: [],
    usedEventIds: [],
    recentCategories: [],
    history: [],
    status: 'active',
  };
}

function incomeForMonth(state: GameState): [number, GameState] {
  const character = characterFor(state);
  let next = state;
  let random = 0.5;
  [random, next] = nextRandom(next);

  const range =
    character.incomeStability === 'stable' ? 0.03 :
    character.incomeStability === 'variable' ? 0.32 : 0.42;

  const base = character.baseIncome * (1 + (random * 2 - 1) * range);
  const modifierPercent = relevantModifiers(next, 'income').reduce(
    (sum, modifier) => sum + modifier.amount,
    0,
  );

  return [Math.max(0, roundBaht(base * (1 + modifierPercent))), next];
}

export function beginMonth(state: GameState): GameState {
  if (state.status !== 'active' || state.monthStarted) return state;

  let next: GameState = {
    ...state,
    modifiers: state.modifiers.filter(
      (modifier) => modifier.throughMonth >= state.currentMonth,
    ),
  };

  let income = 0;
  [income, next] = incomeForMonth(next);

  const debt = payDebts(next);
  const premiums = currentPremiums(next);
  const temporaryExpenses = relevantModifiers(next, 'expense').reduce(
    (sum, modifier) => sum + modifier.amount,
    0,
  );

  const outflow = next.fixedExpenses + premiums + debt.payment + temporaryExpenses;
  const cash = roundBaht(next.cash + income - outflow);

  next = {
    ...next,
    debts: debt.debts,
    cash,
    monthStarted: true,
    monthLedger: {
      month: next.currentMonth,
      income,
      fixedExpenses: next.fixedExpenses,
      protectionPremiums: premiums,
      debtPayments: debt.payment,
      temporaryExpenses,
      netBeforeEvent: income - outflow,
    },
    lastResolution: undefined,
  };

  if (cash < 0) {
    return {
      ...next,
      pendingShortfall: { amount: Math.abs(cash), resume: 'event', usedActions: [] },
    };
  }

  return selectEvent(next);
}

export function completeMonth(state: GameState): GameState {
  if (
    state.status !== 'active' ||
    state.pendingShortfall ||
    state.currentEventId ||
    !state.monthStarted
  ) {
    return state;
  }

  if (state.currentMonth >= MONEY_STORY_TOTAL_MONTHS) {
    const character = characterFor(state);
    const { goalPosition } = financialPyramidGoalMetrics(state);

    if (goalPosition >= character.goal.targetNetPosition) {
      return {
        ...state,
        status: 'win',
        outcomeReason:
          'ผ่านครบ 12 เดือนและมีเงินสำหรับเป้าหมายถึงหมุดหมายแรก หลังกันเงินสำรองแล้ว',
      };
    }

    return {
      ...state,
      status: 'survive',
      outcomeReason:
        'ผ่านครบ 12 เดือน แต่เงินสำหรับเป้าหมายหลังกันเงินสำรองยังไม่ถึงหมุดหมายแรก',
    };
  }

  return {
    ...state,
    currentMonth: state.currentMonth + 1,
    monthStarted: false,
    monthLedger: undefined,
    lastResolution: undefined,
  };
}
