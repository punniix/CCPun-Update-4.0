// Shortfall quotes and recovery actions retain their original resume semantics.
import { currentDebtPayments, currentPremiums } from './financial-metrics';
import { characterFor } from './engine-state';
import { addDebt, amortizedPayment } from './engine-debt';
import { selectEvent } from './engine-events';
import type { GameState, LoanQuote, RecoveryActionId } from './types';

function recoveryActionUsed(state: GameState, action: RecoveryActionId) {
  return Boolean(state.pendingShortfall?.usedActions?.includes(action));
}

function withRecoveryAction(state: GameState, action: RecoveryActionId): GameState {
  if (!state.pendingShortfall) return state;
  const used = state.pendingShortfall.usedActions ?? [];
  return {
    ...state,
    pendingShortfall: {
      ...state.pendingShortfall,
      usedActions: used.includes(action) ? used : [...used, action],
    },
  };
}

export function quoteShortfallLoan(state: GameState): LoanQuote {
  const needed = Math.max(0, Math.abs(Math.min(0, state.cash)));
  const desiredPrincipal = Math.ceil(Math.max(5000, needed + 3000) / 5000) * 5000;
  const monthlyRate = 0.0075;
  const termMonths = 12;
  const character = characterFor(state);
  const recurringBeforeLoan =
    state.fixedExpenses +
    currentPremiums(state, state.currentMonth + 1) +
    currentDebtPayments(state, state.currentMonth + 1);

  const maxPrincipalByIncome = Math.floor((character.baseIncome * 8) / 5000) * 5000;
  const maxRecurring = character.baseIncome * 1.2;
  let maxAffordablePrincipal = 0;

  for (let principal = 5000; principal <= maxPrincipalByIncome; principal += 5000) {
    const payment = amortizedPayment(principal, monthlyRate, termMonths);
    if (recurringBeforeLoan + payment <= maxRecurring) {
      maxAffordablePrincipal = principal;
    } else {
      break;
    }
  }

  const alreadyUsed = recoveryActionUsed(state, 'loan');
  const principal = Math.min(desiredPrincipal, maxAffordablePrincipal);
  const monthlyPayment = principal > 0
    ? amortizedPayment(principal, monthlyRate, termMonths)
    : 0;
  const canBorrow = !alreadyUsed && principal >= 5000;

  return {
    principal,
    monthlyPayment,
    monthlyRate,
    termMonths,
    canBorrow,
    partial: canBorrow && principal < desiredPrincipal,
    reason: alreadyUsed
      ? 'ใช้ทางเลือกกู้ในช่วงแก้สถานการณ์นี้ไปแล้ว'
      : canBorrow
        ? undefined
        : 'ภาระเดิมสูงจนเกมไม่เปิดหนี้ก้อนใหม่เพิ่ม',
  };
}

export function quoteRecoveryExtraIncome(state: GameState) {
  const character = characterFor(state);
  const multiplier =
    character.incomeStability === 'business' ? 0.24 :
    character.incomeStability === 'variable' ? 0.22 : 0.18;
  const immediate = Math.min(
    Math.max(6000, Math.round(character.baseIncome * multiplier / 1000) * 1000),
    30000,
  );
  const ongoingPercent =
    character.incomeStability === 'stable' ? 0.08 : 0.12;

  return {
    available: Boolean(state.pendingShortfall) && !recoveryActionUsed(state, 'extra-income'),
    immediate,
    ongoingPercent,
    months: 2,
  };
}

export function quoteRecoveryExpenseCut(state: GameState) {
  const immediate = Math.max(
    3000,
    Math.round(state.fixedExpenses * 0.18 / 500) * 500,
  );
  const monthlyReduction = Math.max(
    1000,
    Math.round(state.fixedExpenses * 0.1 / 500) * 500,
  );

  return {
    available: Boolean(state.pendingShortfall) && !recoveryActionUsed(state, 'expense-cut'),
    immediate,
    monthlyReduction,
    months: 2,
  };
}

export function quoteRecoveryDebtRestructure(state: GameState) {
  const active = state.debts.filter(
    (debt) => debt.principalRemaining > 0 && debt.remainingMonths > 0,
  );
  const currentPayment =
    state.monthLedger?.debtPayments ??
    currentDebtPayments(state, state.currentMonth);
  const immediateRelief = Math.max(
    0,
    Math.round(currentPayment * 0.35 / 500) * 500,
  );
  const nextMonthlyBefore = currentDebtPayments(state, state.currentMonth + 1);
  const nextMonthlyAfter = Math.round(nextMonthlyBefore * 0.72);

  return {
    available:
      Boolean(state.pendingShortfall) &&
      !recoveryActionUsed(state, 'debt-restructure') &&
      active.length > 0 &&
      immediateRelief >= 1000,
    immediateRelief,
    nextMonthlyBefore,
    nextMonthlyAfter,
  };
}

function resumeAfterShortfall(state: GameState): GameState {
  const resume = state.pendingShortfall?.resume;
  let next: GameState = {
    ...state,
    pendingShortfall: undefined,
    cash: Math.max(0, state.cash),
  };

  if (resume === 'event') next = selectEvent(next);
  return next;
}

export function coverShortfallWithInvestments(state: GameState): GameState {
  if (!state.pendingShortfall || state.investments <= 0) return state;

  const needed = Math.abs(Math.min(0, state.cash));
  const sell = Math.min(needed, state.investments);

  const next: GameState = {
    ...state,
    cash: state.cash + sell,
    investments: state.investments - sell,
  };

  if (next.cash >= 0) return resumeAfterShortfall(next);

  return {
    ...next,
    pendingShortfall: {
      ...state.pendingShortfall,
      amount: Math.abs(next.cash),
    },
  };
}

export function coverShortfallWithLoan(state: GameState): GameState {
  if (!state.pendingShortfall) return state;

  const quote = quoteShortfallLoan(state);
  if (!quote.canBorrow) return state;

  let next = addDebt(state, {
    principal: quote.principal,
    monthlyRate: quote.monthlyRate,
    termMonths: quote.termMonths,
    label: 'เงินกู้ฉุกเฉินในเกม',
  });
  next = withRecoveryAction(next, 'loan');

  if (next.cash >= 0) return resumeAfterShortfall(next);

  return {
    ...next,
    pendingShortfall: {
      ...next.pendingShortfall!,
      amount: Math.abs(next.cash),
    },
  };
}

export function coverShortfallWithExtraIncome(state: GameState): GameState {
  if (!state.pendingShortfall) return state;
  const quote = quoteRecoveryExtraIncome(state);
  if (!quote.available) return state;

  let next: GameState = {
    ...state,
    cash: state.cash + quote.immediate,
    modifiers: [
      ...state.modifiers,
      {
        kind: 'income',
        amount: quote.ongoingPercent,
        throughMonth: state.currentMonth + quote.months,
        label: 'รายได้เสริมจากช่วงแก้สถานการณ์',
      },
    ],
  };
  next = withRecoveryAction(next, 'extra-income');

  if (next.cash >= 0) return resumeAfterShortfall(next);
  return {
    ...next,
    pendingShortfall: {
      ...next.pendingShortfall!,
      amount: Math.abs(next.cash),
    },
  };
}

export function coverShortfallWithExpenseCut(state: GameState): GameState {
  if (!state.pendingShortfall) return state;
  const quote = quoteRecoveryExpenseCut(state);
  if (!quote.available) return state;

  const relief = Math.min(quote.immediate, Math.abs(Math.min(0, state.cash)));
  let next: GameState = {
    ...state,
    cash: state.cash + relief,
    modifiers: [
      ...state.modifiers,
      {
        kind: 'expense',
        amount: -quote.monthlyReduction,
        throughMonth: state.currentMonth + quote.months,
        label: 'ลดค่าใช้จ่ายชั่วคราว',
      },
    ],
  };
  next = withRecoveryAction(next, 'expense-cut');

  if (next.cash >= 0) return resumeAfterShortfall(next);
  return {
    ...next,
    pendingShortfall: {
      ...next.pendingShortfall!,
      amount: Math.abs(next.cash),
    },
  };
}

export function coverShortfallWithDebtRestructure(state: GameState): GameState {
  if (!state.pendingShortfall) return state;
  const quote = quoteRecoveryDebtRestructure(state);
  if (!quote.available) return state;

  const relief = Math.min(
    quote.immediateRelief,
    Math.abs(Math.min(0, state.cash)),
  );
  const activeIndex = state.debts.findIndex(
    (debt) => debt.principalRemaining > 0 && debt.remainingMonths > 0,
  );

  const debts = state.debts.map((debt, index) => {
    if (debt.principalRemaining <= 0 || debt.remainingMonths <= 0) return debt;
    return {
      ...debt,
      principalRemaining:
        index === activeIndex ? debt.principalRemaining + relief : debt.principalRemaining,
      monthlyPayment: Math.max(500, Math.round(debt.monthlyPayment * 0.72)),
      remainingMonths: debt.remainingMonths + 6,
    };
  });

  let next: GameState = {
    ...state,
    cash: state.cash + relief,
    debts,
    monthLedger: state.monthLedger
      ? {
          ...state.monthLedger,
          debtPayments: Math.max(0, state.monthLedger.debtPayments - relief),
          netBeforeEvent: state.monthLedger.netBeforeEvent + relief,
        }
      : state.monthLedger,
  };
  next = withRecoveryAction(next, 'debt-restructure');

  if (next.cash >= 0) return resumeAfterShortfall(next);
  return {
    ...next,
    pendingShortfall: {
      ...next.pendingShortfall!,
      amount: Math.abs(next.cash),
    },
  };
}

export function hasRecoveryOption(state: GameState) {
  if (!state.pendingShortfall) return false;
  return Boolean(
    state.investments > 0 ||
    quoteShortfallLoan(state).canBorrow ||
    quoteRecoveryExtraIncome(state).available ||
    quoteRecoveryExpenseCut(state).available ||
    quoteRecoveryDebtRestructure(state).available
  );
}

export function declareUnableToContinue(state: GameState): GameState {
  return {
    ...state,
    status: 'lose',
    outcomeReason:
      'ภาระที่ถึงกำหนดมากกว่าทรัพยากรและทางเลือกที่มีในรอบนี้',
  };
}
