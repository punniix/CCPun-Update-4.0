import assert from 'node:assert/strict';
import test from 'node:test';
import { MONEY_STORY_EVENTS } from '../features/money-story/events';
import {
  coverShortfallWithLoan,
  createGame,
  eventEligible,
  quoteShortfallLoan,
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
