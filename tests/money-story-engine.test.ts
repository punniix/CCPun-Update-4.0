import assert from 'node:assert/strict';
import test from 'node:test';
import { MONEY_STORY_EVENTS } from '../features/money-story/events';
import {
  coverShortfallWithDebtRestructure,
  coverShortfallWithExpenseCut,
  coverShortfallWithExtraIncome,
  coverShortfallWithLoan,
  createGame,
  eventEligible,
  quoteRecoveryDebtRestructure,
  quoteShortfallLoan,
  protectionBenefitPreview,
  resolveEventChoice,
  statusBars,
} from '../features/money-story/engine';

test('event library is much larger than one 12-month run', () => {
  assert.ok(MONEY_STORY_EVENTS.length >= 60);
  const categories = new Set(MONEY_STORY_EVENTS.map((event) => event.category));
  for (const category of [
    'everyday',
    'work',
    'health',
    'motor',
    'home',
    'family',
    'market',
    'crisis',
    'calm',
  ]) {
    assert.ok(categories.has(category as never));
  }
});

test('car event is ineligible for a life without a car', () => {
  const state = createGame('no-car', 'gam');
  const event = MONEY_STORY_EVENTS.find(
    (item) => item.id === 'motor-minor-accident',
  )!;
  assert.equal(eventEligible(event, state), false);
});

test('new protection starts next month, never retroactively', () => {
  let state = createGame('protect', 'gam');
  state = {
    ...state,
    currentMonth: 1,
    monthStarted: true,
    currentEventId: 'protect-health',
  };
  state = resolveEventChoice(state, 'buy');
  assert.equal(
    state.protections.find((protection) => protection.type === 'health')
      ?.activeFromMonth,
    2,
  );
});

test('shortfall loan raises cash but leaves matching debt burden', () => {
  let state = createGame('loan', 'gam');
  state = {
    ...state,
    cash: -12000,
    pendingShortfall: { amount: 12000, resume: 'month-end' },
    monthStarted: true,
  };
  const before = statusBars(state).netPosition;
  const quote = quoteShortfallLoan(state);
  assert.equal(quote.canBorrow, true);
  state = coverShortfallWithLoan(state);
  const after = statusBars(state).netPosition;
  assert.ok(after <= before + 4000);
  assert.ok(state.debts.some((debt) => debt.label.includes('ฉุกเฉิน')));
});


test('large shortfall can use a partial emergency loan instead of instant game over', () => {
  let state = createGame('large-shortfall', 'gam');
  state = {
    ...state,
    cash: -121126,
    pendingShortfall: { amount: 121126, resume: 'month-end', usedActions: [] },
    monthStarted: true,
  };

  const quote = quoteShortfallLoan(state);
  assert.equal(quote.canBorrow, true);
  assert.equal(quote.partial, true);
  assert.ok(quote.principal > 0);
  assert.ok(quote.principal < 125000);

  state = coverShortfallWithLoan(state);
  assert.ok(state.pendingShortfall);
  assert.ok((state.pendingShortfall?.amount ?? 0) < 121126);
  assert.equal(quoteShortfallLoan(state).canBorrow, false);
});

test('recovery actions can be combined to close a shortfall', () => {
  let state = createGame('recovery-combo', 'gam');
  state = {
    ...state,
    cash: -8000,
    pendingShortfall: { amount: 8000, resume: 'month-end', usedActions: [] },
    monthStarted: true,
  };

  state = coverShortfallWithExtraIncome(state);
  assert.ok(state.pendingShortfall);
  assert.ok(state.modifiers.some((modifier) => modifier.label.includes('รายได้เสริม')));

  state = coverShortfallWithExpenseCut(state);
  assert.equal(state.pendingShortfall, undefined);
  assert.equal(state.status, 'active');
  assert.ok(state.cash >= 0);
  assert.ok(state.modifiers.some((modifier) => modifier.label.includes('ลดค่าใช้จ่าย')));
});

test('debt restructure lowers future installment and gives bounded current relief', () => {
  let state = createGame('restructure', 'nut');
  state = {
    ...state,
    currentMonth: 4,
    monthStarted: true,
    cash: -2000,
    pendingShortfall: { amount: 2000, resume: 'month-end', usedActions: [] },
    monthLedger: {
      month: 4,
      income: 52000,
      fixedExpenses: 29000,
      protectionPremiums: 700,
      debtPayments: 7000,
      temporaryExpenses: 0,
      netBeforeEvent: 15300,
    },
  };

  const beforePayment = state.debts[0].monthlyPayment;
  const quote = quoteRecoveryDebtRestructure(state);
  assert.equal(quote.available, true);

  state = coverShortfallWithDebtRestructure(state);
  assert.ok(state.debts[0].monthlyPayment < beforePayment);
  assert.ok(state.debts[0].remainingMonths > 24);
  assert.equal(state.pendingShortfall, undefined);
});


test('the 121,126 baht shortfall can be rescued by combining loan, extra income and cuts', () => {
  let state = createGame('screenshot-recovery', 'gam');
  state = {
    ...state,
    cash: -121126,
    pendingShortfall: { amount: 121126, resume: 'month-end', usedActions: [] },
    monthStarted: true,
  };

  state = coverShortfallWithLoan(state);
  assert.equal(state.pendingShortfall?.amount, 6126);

  state = coverShortfallWithExtraIncome(state);
  assert.equal(state.pendingShortfall?.amount, 126);

  state = coverShortfallWithExpenseCut(state);
  assert.equal(state.pendingShortfall, undefined);
  assert.equal(state.status, 'active');
  assert.ok(state.cash >= 0);
});


test('protection preview shows how much a protection can reduce out-of-pocket cost', () => {
  const state = createGame('protection-preview', 'gam');
  const preview = protectionBenefitPreview(state, 'health');

  assert.equal(preview.grossCost, 72000);
  assert.ok(preview.withProtection < preview.withoutProtection);
  assert.equal(
    preview.savings,
    preview.withoutProtection - preview.withProtection,
  );
});


test('goal journey continues beyond 100 percent with a next milestone', () => {
  let state = createGame('goal-beyond-100', 'gam');
  state = {
    ...state,
    cash: 82500,
    investments: 0,
    debts: [],
  };

  const bars = statusBars(state);
  assert.equal(Math.round(bars.goalProgressPercent), 150);
  assert.equal(bars.goalPreviousMilestonePercent, 150);
  assert.equal(bars.goalNextMilestonePercent, 200);
  assert.equal(bars.goalNextMilestoneAmount, 110000);
  assert.equal(bars.goalRemainingToNext, 27500);
});
