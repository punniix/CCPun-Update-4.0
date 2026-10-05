import { MONEY_STORY_CHARACTERS, getMoneyStoryCharacter } from './characters';
import { MONEY_STORY_EVENTS, getMoneyStoryEvent } from './events';
import { MONEY_STORY_TOTAL_MONTHS, PROTECTION_CATALOG } from './config';
import type { CharacterProfile, Debt, EventEffect, GameState, LoanQuote, MoneyEvent, RecoveryActionId, StatusBars } from './types';

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function randomAt(seed: string, cursor: number): number {
  let t = (hashSeed(seed) + Math.imul(cursor + 1, 0x6D2B79F5)) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function nextRandom(state: GameState): [number, GameState] {
  const value = randomAt(state.seed, state.rngCursor);
  return [value, { ...state, rngCursor: state.rngCursor + 1 }];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundBaht(value: number) {
  return Math.round(value);
}

export function totalDebt(state: GameState) {
  return state.debts.reduce((sum, debt) => sum + Math.max(0, debt.principalRemaining), 0);
}

function currentDebtPayments(state: GameState, month = state.currentMonth) {
  return state.debts
    .filter((debt) => debt.principalRemaining > 0 && debt.remainingMonths > 0 && month >= debt.startPaymentMonth)
    .reduce((sum, debt) => sum + debt.monthlyPayment, 0);
}

function currentPremiums(state: GameState, month = state.currentMonth) {
  return state.protections
    .filter((protection) => protection.activeFromMonth <= month)
    .reduce((sum, protection) => sum + protection.monthlyPremium, 0);
}

function activeProtection(state: GameState, type: string) {
  return state.protections.find(
    (protection) => protection.type === type && protection.activeFromMonth <= state.currentMonth,
  );
}

function relevantModifiers(state: GameState, kind: 'income' | 'expense') {
  return state.modifiers.filter(
    (modifier) => modifier.kind === kind && modifier.throughMonth >= state.currentMonth,
  );
}

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

export function characterFor(state: GameState): CharacterProfile {
  return getMoneyStoryCharacter(state.characterId);
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

function payDebts(state: GameState): { debts: Debt[]; payment: number } {
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

export function eventEligible(event: MoneyEvent, state: GameState): boolean {
  const character = characterFor(state);
  const requirements = event.requirements;

  if (!requirements) return true;
  if (requirements.hasCar !== undefined && character.hasCar !== requirements.hasCar) return false;
  if (requirements.hasHome !== undefined && character.hasHome !== requirements.hasHome) return false;
  if (
    requirements.dependents !== undefined &&
    (character.dependents > 0) !== requirements.dependents
  ) {
    return false;
  }
  if (requirements.investments && state.investments <= 0) return false;
  if (
    requirements.missingProtection &&
    state.protections.some((protection) => protection.type === requirements.missingProtection)
  ) {
    return false;
  }
  if (
    requirements.stabilities &&
    !requirements.stabilities.includes(character.incomeStability)
  ) {
    return false;
  }
  if (requirements.minMonth && state.currentMonth < requirements.minMonth) return false;
  if (requirements.maxMonth && state.currentMonth > requirements.maxMonth) return false;

  return true;
}

export function selectEvent(state: GameState): GameState {
  let next = state;

  const candidates = MONEY_STORY_EVENTS.filter((event) => {
    if (!eventEligible(event, next)) return false;
    if (!event.repeat && next.usedEventIds.includes(event.id)) return false;
    return true;
  });

  const weighted = candidates.map((event) => {
    const sameRecent = next.recentCategories.slice(-2).filter(
      (category) => category === event.category,
    ).length;
    const seen = next.usedEventIds.includes(event.id);
    const factor = sameRecent >= 2 ? 0.08 : sameRecent === 1 ? 0.42 : 1;
    return { event, weight: event.weight * factor * (seen ? 0.3 : 1) };
  });

  const total = weighted.reduce((sum, item) => sum + item.weight, 0);
  let roll = 0.5;
  [roll, next] = nextRandom(next);

  let cursor = roll * total;
  let chosen = weighted[weighted.length - 1]?.event ?? MONEY_STORY_EVENTS[0];

  for (const item of weighted) {
    cursor -= item.weight;
    if (cursor <= 0) {
      chosen = item.event;
      break;
    }
  }

  return {
    ...next,
    currentEventId: chosen.id,
    usedEventIds: [...next.usedEventIds, chosen.id],
    recentCategories: [...next.recentCategories.slice(-2), chosen.category],
  };
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

export function amortizedPayment(
  principal: number,
  monthlyRate: number,
  termMonths: number,
): number {
  if (monthlyRate <= 0) return Math.ceil(principal / termMonths);

  const factor = Math.pow(1 + monthlyRate, termMonths);
  return Math.ceil(principal * (monthlyRate * factor) / (factor - 1));
}

function addDebt(
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

export function protectionBenefitPreview(
  state: GameState,
  type: keyof typeof PROTECTION_CATALOG,
) {
  const catalog = PROTECTION_CATALOG[type];
  const grossCost = catalog.exampleCost;
  const existingBenefit =
    type === 'health' ? Math.min(grossCost, state.healthBenefitCap) : 0;
  const withoutProtection = Math.max(0, grossCost - existingBenefit);
  const afterDeductible = Math.max(0, withoutProtection - catalog.deductible);
  const protectionBenefit = Math.min(
    catalog.maxBenefit,
    roundBaht(afterDeductible * catalog.coverageRate),
  );
  const withProtection = Math.max(
    0,
    withoutProtection - protectionBenefit,
  );

  return {
    grossCost,
    existingBenefit,
    protectionBenefit,
    withoutProtection,
    withProtection,
    savings: Math.max(0, withoutProtection - withProtection),
  };
}

function applyCost(state: GameState, amount: number, protectionType?: string) {
  let remaining = amount;
  let existingBenefit = 0;
  let protectionBenefit = 0;

  if (protectionType === 'health' && state.healthBenefitCap > 0) {
    existingBenefit = Math.min(remaining, state.healthBenefitCap);
    remaining -= existingBenefit;
  }

  const holding = protectionType ? activeProtection(state, protectionType) : undefined;

  if (holding && protectionType) {
    const catalog = PROTECTION_CATALOG[
      protectionType as keyof typeof PROTECTION_CATALOG
    ];
    const afterDeductible = Math.max(0, remaining - catalog.deductible);

    protectionBenefit = Math.min(
      catalog.maxBenefit,
      roundBaht(afterDeductible * catalog.coverageRate),
    );

    remaining = Math.max(0, remaining - protectionBenefit);
  }

  return {
    cash: state.cash - remaining,
    grossCost: amount,
    existingBenefit,
    protectionBenefit,
    outOfPocket: remaining,
    protectionUsed: holding?.type,
  };
}

function reduceDebtPrincipal(debts: Debt[], amount: number): Debt[] {
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

function applyEffect(state: GameState, effect: EventEffect) {
  let next = { ...state };
  let costMeta: ReturnType<typeof applyCost> | undefined;

  if (effect.borrow) next = addDebt(next, effect.borrow);
  if (effect.cashDelta) next.cash += effect.cashDelta;

  if (effect.investmentDelta) {
    const transfer = Math.min(
      Math.max(0, effect.investmentDelta),
      Math.max(0, next.cash),
    );
    if (effect.investmentDelta > 0) {
      next.cash -= transfer;
      next.investments += transfer;
    } else {
      next.investments = Math.max(0, next.investments + effect.investmentDelta);
    }
  }

  if (effect.investmentPercent) {
    next.investments = Math.max(
      0,
      roundBaht(next.investments * (1 + effect.investmentPercent)),
    );
  }

  if (effect.debtPrincipalReduction) {
    const payment = Math.min(effect.debtPrincipalReduction, Math.max(0, next.cash));
    next.cash -= payment;
    next.debts = reduceDebtPrincipal(next.debts, payment);
  }

  if (
    effect.addProtection &&
    !next.protections.some((protection) => protection.type === effect.addProtection)
  ) {
    const catalog = PROTECTION_CATALOG[effect.addProtection];
    next.protections = [
      ...next.protections,
      {
        type: effect.addProtection,
        activeFromMonth: next.currentMonth + 1,
        monthlyPremium: catalog.monthlyPremium,
        source: 'purchased',
      },
    ];
  }

  if (effect.incomeModifier) {
    next.modifiers = [
      ...next.modifiers,
      {
        kind: 'income',
        amount: effect.incomeModifier.percent,
        throughMonth: next.currentMonth + effect.incomeModifier.months,
        label: effect.incomeModifier.label,
      },
    ];
  }

  if (effect.expenseModifier) {
    next.modifiers = [
      ...next.modifiers,
      {
        kind: 'expense',
        amount: effect.expenseModifier.amount,
        throughMonth: next.currentMonth + effect.expenseModifier.months,
        label: effect.expenseModifier.label,
      },
    ];
  }

  if (effect.cost) {
    costMeta = applyCost(next, effect.cost.amount, effect.cost.protectionType);
    next.cash = costMeta.cash;
  }

  return { state: next, costMeta };
}

export function resolveEventChoice(
  state: GameState,
  optionId: string,
): GameState {
  if (state.status !== 'active' || !state.currentEventId) return state;

  const event = getMoneyStoryEvent(state.currentEventId);
  const option = event?.options.find((item) => item.id === optionId);
  if (!event || !option) return state;

  const applied = applyEffect(state, option.effect);

  let next: GameState = {
    ...applied.state,
    currentEventId: undefined,
    lastResolution: {
      eventId: event.id,
      optionId: option.id,
      summary: option.outcomeText,
      grossCost: applied.costMeta?.grossCost,
      existingBenefit: applied.costMeta?.existingBenefit,
      protectionBenefit: applied.costMeta?.protectionBenefit,
      outOfPocket: applied.costMeta?.outOfPocket,
      protectionUsed: applied.costMeta?.protectionUsed,
    },
    history: [
      ...state.history,
      {
        month: state.currentMonth,
        eventId: event.id,
        eventTitle: event.title,
        optionLabel: option.label,
        category: event.category,
        sensitive: Boolean(event.sensitive),
        summary: option.outcomeText,
      },
    ],
  };

  if (next.cash < 0) {
    next = {
      ...next,
      pendingShortfall: {
        amount: Math.abs(next.cash),
        resume: 'month-end',
        usedActions: [],
      },
    };
  }

  return next;
}

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
      ? 'ใช้ทางเลือกกู้ในรอบกู้สถานการณ์นี้ไปแล้ว'
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
        label: 'รายได้เสริมจากช่วงกู้สถานการณ์',
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
    const netPosition = state.cash + state.investments - totalDebt(state);

    if (netPosition >= character.goal.targetNetPosition) {
      return {
        ...state,
        status: 'win',
        outcomeReason:
          'ผ่านครบ 12 เดือนและไปถึงเป้าหมายของชีวิตนี้',
      };
    }

    return {
      ...state,
      status: 'survive',
      outcomeReason:
        'ผ่านครบ 12 เดือน แต่ฐานเงินสุทธิยังไม่ถึงเป้าหมายของชีวิตนี้',
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

export function statusBars(state: GameState): StatusBars {
  const character = characterFor(state);
  const debtPayments = currentDebtPayments(state, state.currentMonth + 1);
  const premiums = currentPremiums(state, state.currentMonth + 1);
  const recurring = Math.max(1, state.fixedExpenses + debtPayments + premiums);

  const liquidity = clamp(
    (Math.max(0, state.cash) / (recurring * 3)) * 100,
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
    (Math.max(0, netPosition) / Math.max(1, character.goal.targetNetPosition)) * 100;
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
    goalNextMilestoneAmount - netPosition,
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
