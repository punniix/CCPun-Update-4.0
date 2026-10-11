// Debt payment and principal operations; no event or recovery dependency.
import { roundBaht } from './financial-metrics';
import type { Debt, EventEffect, GameState } from './types';

export function payDebts(state: GameState): { debts: Debt[]; payment: number } {
  let total = 0;

  const debts = state.debts.map((debt) => {
    if (
      debt.principalRemaining <= 0 ||
      debt.remainingMonths <= 0 ||
      state.currentMonth < debt.startPaymentMonth
    ) {
      return debt;
    }

    const interest = debt.principalRemaining * debt.monthlyRate;
    const payment = Math.min(debt.monthlyPayment, debt.principalRemaining + interest);
    const principalPaid = Math.max(0, payment - interest);
    total += payment;

    return {
      ...debt,
      principalRemaining: Math.max(0, roundBaht(debt.principalRemaining - principalPaid)),
      remainingMonths: Math.max(0, debt.remainingMonths - 1),
    };
  });

  return { debts, payment: roundBaht(total) };
}

export function amortizedPayment(
  principal: number,
  monthlyRate: number,
  termMonths: number,
): number {
  if (monthlyRate <= 0) return Math.ceil(principal / termMonths);

  const factor = Math.pow(1 + monthlyRate, termMonths);
  return Math.ceil(principal * (monthlyRate * factor) / (factor - 1));
}

export function addDebt(
  state: GameState,
  specification: NonNullable<EventEffect['borrow']>,
): GameState {
  const monthlyPayment = amortizedPayment(
    specification.principal,
    specification.monthlyRate,
    specification.termMonths,
  );

  const debt: Debt = {
    id: 'loan-' + state.currentMonth + '-' + state.debts.length,
    label: specification.label,
    principalRemaining: specification.principal,
    monthlyRate: specification.monthlyRate,
    monthlyPayment,
    remainingMonths: specification.termMonths,
    startPaymentMonth: state.currentMonth + 1,
  };

  return {
    ...state,
    cash: state.cash + specification.principal,
    debts: [...state.debts, debt],
  };
}

export function reduceDebtPrincipal(debts: Debt[], amount: number): Debt[] {
  let remaining = Math.max(0, amount);

  return debts.map((debt) => {
    if (remaining <= 0 || debt.principalRemaining <= 0) return debt;
    const payment = Math.min(remaining, debt.principalRemaining);
    remaining -= payment;
    return {
      ...debt,
      principalRemaining: debt.principalRemaining - payment,
    };
  });
}
