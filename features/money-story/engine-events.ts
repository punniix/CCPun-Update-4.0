// Event eligibility, seeded selection and ordered effect resolution.
import { MONEY_STORY_EVENTS, getMoneyStoryEvent } from './events';
import { MONEY_STORY_TOTAL_MONTHS, PROTECTION_CATALOG } from './config';
import { roundBaht } from './financial-metrics';
import { activeProtection, characterFor, nextRandom } from './engine-state';
import { addDebt, reduceDebtPrincipal } from './engine-debt';
import type { EventEffect, GameState, MoneyEvent } from './types';

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
    const throughMonth = effect.incomeModifier.throughEnd
      ? MONEY_STORY_TOTAL_MONTHS
      : next.currentMonth + (effect.incomeModifier.months ?? 1);

    next.modifiers = [
      ...next.modifiers,
      {
        kind: 'income',
        amount: effect.incomeModifier.percent,
        throughMonth,
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
