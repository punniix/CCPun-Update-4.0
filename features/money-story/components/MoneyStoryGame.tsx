'use client';
import { usePublicCopy } from "@/components/ui/PublicCopyProvider";
import { MONEY_STORY_COPY_DEFAULTS, moneyStoryLabel } from "@/lib/content/money-story-copy-defaults";


import { useEffect, useMemo, useRef, useState } from 'react';
import { Undo2 } from 'lucide-react';
import { trackEvent, type EventParams } from '@/lib/analytics';
import { getMoneyStoryEvent } from '../events';
import {
  amortizedPayment,
  beginMonth,
  characterFor,
  completeMonth,
  coverShortfallWithDebtRestructure,
  coverShortfallWithExpenseCut,
  coverShortfallWithExtraIncome,
  coverShortfallWithInvestments,
  coverShortfallWithLoan,
  createGame,
  declareUnableToContinue,
  hasRecoveryOption,
  quoteRecoveryDebtRestructure,
  quoteRecoveryExpenseCut,
  quoteRecoveryExtraIncome,
  quoteShortfallLoan,
  protectionBenefitPreview,
  resolveEventChoice,
  statusBars,
} from '../engine';
import {
  EVENT_CATEGORY_LABELS,
  PROTECTION_CATALOG,
} from '../config';
import type { EventOption, GameState, ProtectionType } from '../types';
import styles from '../MoneyStory.module.css';
import { getConsentData } from '@/lib/cookie-consent';
import { CharacterPortrait, MoneyStoryResult, MoneyStorySelection } from './MoneyStoryScreens';
import { money, MoneyStoryStatusSidebar, percentLabel } from './MoneyStoryStatusSidebar';

function trackMoneyStoryEvent(eventName: string, params: EventParams = {}) {
  trackEvent(eventName, {
    ...params,
    tool_name: 'money_story',
    surface_group: 'money_story',
  });
}

function isLumpSumProtection(type?: ProtectionType) {
  return type === 'critical' || type === 'life';
}

export default function MoneyStoryGame({ showSeed = false }: { showSeed?: boolean }) {
  const text = usePublicCopy(MONEY_STORY_COPY_DEFAULTS);
  const label = (value: string) => moneyStoryLabel(value, text);
function optionImpactLines(option: EventOption, game: GameState) {
  const effect = option.effect;
  const lines: string[] = [];
  const borrowed = effect.borrow?.principal ?? 0;
  const cashDelta = effect.cashDelta ?? 0;
  const cashBeforeTransfers = Math.max(0, game.cash + borrowed + cashDelta);
  let cashAfterTransfers = cashBeforeTransfers;

  if (effect.borrow) {
    const loan = effect.borrow;
    lines.push(
      text("moneyStory.optionImpactLinesText") +
        money.format(loan.principal) +
        text("moneyStory.optionImpactLinesText2") +
        money.format(amortizedPayment(loan.principal, loan.monthlyRate, loan.termMonths)) +
        text("moneyStory.optionImpactLinesText3") +
        loan.termMonths +
        text("moneyStory.optionImpactLinesText4"),
    );
  }

  if (cashDelta !== 0) {
    lines.push(
      text("moneyStory.optionImpactLinesText5") +
        (cashDelta > 0 ? '+' : '-') +
        money.format(Math.abs(cashDelta)) +
        text("moneyStory.optionImpactLinesText6"),
    );
  }

  if (effect.investmentDelta) {
    if (effect.investmentDelta > 0) {
      const transfer = Math.min(effect.investmentDelta, cashAfterTransfers);
      cashAfterTransfers -= transfer;
      lines.push(text("moneyStory.optionImpactLinesText7") + money.format(transfer) + text("moneyStory.optionImpactLinesText8"));
    } else {
      const reduction = Math.min(game.investments, Math.abs(effect.investmentDelta));
      lines.push(text("moneyStory.optionImpactLinesText9") + money.format(reduction) + text("moneyStory.optionImpactLinesText6"));
    }
  }

  if (effect.investmentPercent !== undefined) {
    const before = game.investments;
    const after = Math.max(0, Math.round(before * (1 + effect.investmentPercent)));
    const sign =
      effect.investmentPercent > 0 ? '+' : effect.investmentPercent < 0 ? '-' : '';
    lines.push(
      text("moneyStory.optionImpactLinesText10") +
        sign +
        percentLabel(effect.investmentPercent) +
        ' · ' +
        money.format(before) +
        ' → ' +
        money.format(after) +
        text("moneyStory.optionImpactLinesText6"),
    );
  }

  if (effect.incomeModifier) {
    lines.push(
      text("moneyStory.optionImpactLinesText11") +
        (effect.incomeModifier.percent > 0 ? '+' : '-') +
        percentLabel(effect.incomeModifier.percent) +
        (effect.incomeModifier.throughEnd
          ? text("moneyStory.optionImpactLinesText12")
          : ' × ' + (effect.incomeModifier.months ?? 1) + text("moneyStory.optionImpactLinesText4")),
    );
  }

  if (effect.expenseModifier) {
    lines.push(
      text("moneyStory.optionImpactLinesText13") +
        money.format(effect.expenseModifier.amount) +
        text("moneyStory.optionImpactLinesText3") +
        effect.expenseModifier.months +
        text("moneyStory.optionImpactLinesText4"),
    );
  }

  if (effect.cost) {
    lines.push(
      text("moneyStory.optionImpactLinesText14") +
        money.format(effect.cost.amount) +
        text("moneyStory.optionImpactLinesText15"),
    );
  }

  if (effect.debtPrincipalReduction) {
    const payment = Math.min(effect.debtPrincipalReduction, cashAfterTransfers);
    lines.push(text("moneyStory.optionImpactLinesText16") + money.format(payment) + text("moneyStory.optionImpactLinesText17"));
  }

  if (effect.addProtection) {
    const protectionType = effect.addProtection;
    const protection = PROTECTION_CATALOG[protectionType];
    const preview = protectionBenefitPreview(game, protectionType);
    lines.push(
      text("moneyStory.optionImpactLinesText18") +
        money.format(protection.monthlyPremium) +
        text("moneyStory.optionImpactLinesText19"),
    );

    if (isLumpSumProtection(protectionType)) {
      lines.push(
        text("moneyStory.optionImpactLinesText20") +
          money.format(preview.grossCost) +
          text("moneyStory.optionImpactLinesText6"),
      );
      lines.push(
        text("moneyStory.optionImpactLinesText21") +
          money.format(preview.protectionBenefit) +
          text("moneyStory.optionImpactLinesText22") +
          money.format(preview.withProtection) +
          text("moneyStory.optionImpactLinesText6"),
      );
    } else {
      lines.push(
        text("moneyStory.optionImpactLinesText23") +
          money.format(preview.grossCost) +
          text("moneyStory.optionImpactLinesText6"),
      );
      lines.push(
        text("moneyStory.optionImpactLinesText24") +
          money.format(preview.withoutProtection) +
          text("moneyStory.optionImpactLinesText25") +
          money.format(preview.withProtection) +
          text("moneyStory.optionImpactLinesText6"),
      );
    }
  }

  if (lines.length === 0) {
    lines.push(text("moneyStory.optionImpactLinesText26"));
  }

  return lines;
}


  const [game, setGame] = useState<GameState | null>(null);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState('');
  const [lastChoiceImpact, setLastChoiceImpact] = useState<string[]>([]);
  const [undoStack, setUndoStack] = useState<Array<{
    game: GameState;
    lastChoiceImpact: string[];
  }>>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const landingTrackedRef = useRef(false);
  const resultTrackedRef = useRef<string | null>(null);

  useEffect(() => {
    const trackLanding = () => {
      if (landingTrackedRef.current || !getConsentData()?.analytics) return;
      landingTrackedRef.current = true;
      trackMoneyStoryEvent('money_story_landing_view');
    };

    trackLanding();
    window.addEventListener('ccpun:consent', trackLanding);
    return () => window.removeEventListener('ccpun:consent', trackLanding);
  }, []);

  useEffect(() => {
    if (!game || game.status === 'active') return;

    const trackResult = () => {
      if (!getConsentData()?.analytics) return;
      const resultKey = game.seed + ':' + game.status;
      if (resultTrackedRef.current === resultKey) return;
      resultTrackedRef.current = resultKey;
      trackMoneyStoryEvent('money_story_result_view');
    };

    trackResult();
    window.addEventListener('ccpun:consent', trackResult);
    return () => window.removeEventListener('ccpun:consent', trackResult);
  }, [game]);


  const character = game ? characterFor(game) : null;
  const bars = game ? statusBars(game) : null;
  const event = game?.currentEventId
    ? getMoneyStoryEvent(game.currentEventId)
    : undefined;
  const resolvedEvent = game?.lastResolution
    ? getMoneyStoryEvent(game.lastResolution.eventId)
    : undefined;
  const resolvedOption = game?.lastResolution && resolvedEvent
    ? resolvedEvent.options.find(
        (option) => option.id === game.lastResolution?.optionId,
      )
    : undefined;
  const resolvedProtectionType = resolvedOption?.effect.cost?.protectionType;
  const resolvedUsesLumpSum = isLumpSumProtection(resolvedProtectionType);
  const loanQuote = game?.pendingShortfall
    ? quoteShortfallLoan(game)
    : null;
  const extraIncomeQuote = game?.pendingShortfall
    ? quoteRecoveryExtraIncome(game)
    : null;
  const expenseCutQuote = game?.pendingShortfall
    ? quoteRecoveryExpenseCut(game)
    : null;
  const debtRestructureQuote = game?.pendingShortfall
    ? quoteRecoveryDebtRestructure(game)
    : null;

  const focusGame = () => requestAnimationFrame(() => rootRef.current?.focus());

  const commitGame = (next: GameState) => {
    if (!game || next === game) {
      setGame(next);
      return;
    }

    setUndoStack((stack) => [
      ...stack.slice(-11),
      { game, lastChoiceImpact },
    ]);
    setGame(next);
  };

  const undo = () => {
    const previous = undoStack.at(-1);
    if (!previous) return;

    setUndoStack((stack) => stack.slice(0, -1));
    setGame(previous.game);
    setLastChoiceImpact(previous.lastChoiceImpact);
    trackMoneyStoryEvent('money_story_undo');
    focusGame();
  };

  const start = (characterId?: string) => {
    const next = createGame(undefined, characterId);
    setGame(next);
    setShareStatus('');
    setLastChoiceImpact([]);
    setUndoStack([]);
    trackMoneyStoryEvent('money_story_start');
    trackMoneyStoryEvent('money_story_character_generated');
    focusGame();
  };

  const begin = () => {
    if (!game) return;
    const next = beginMonth(game);
    commitGame(next);
    focusGame();

    if (
      next.currentEventId &&
      getMoneyStoryEvent(next.currentEventId)?.category === 'crisis'
    ) {
      trackMoneyStoryEvent('money_story_crisis');
    }
  };

  const choose = (optionId: string) => {
    if (!game) return;

    const currentEvent = getMoneyStoryEvent(game.currentEventId ?? '');
    const option = currentEvent?.options.find((item) => item.id === optionId);
    if (option) setLastChoiceImpact(optionImpactLines(option, game));
    const next = resolveEventChoice(game, optionId);

    commitGame(next);
    focusGame();
    trackMoneyStoryEvent('money_story_choice');

    if (option?.effect.borrow) trackMoneyStoryEvent('money_story_borrow');
    if (option?.effect.investmentDelta || option?.effect.investmentPercent) {
      trackMoneyStoryEvent('money_story_invest');
    }
    if (option?.effect.addProtection) {
      trackMoneyStoryEvent('money_story_protection');
    }
  };

  const goNext = () => {
    if (!game) return;

    const previousMonth = game.currentMonth;
    const next = completeMonth(game);
    commitGame(next);
    focusGame();
    trackMoneyStoryEvent('money_story_month_complete', { step_number: previousMonth });

    if (next.status === 'win') trackMoneyStoryEvent('money_story_win');
    if (next.status === 'survive') trackMoneyStoryEvent('money_story_survive');
    if (next.status === 'lose') trackMoneyStoryEvent('money_story_lose');
  };

  const returnToCharacterSelection = () => {
    if (game?.status === 'active' && (game.currentMonth > 1 || game.history.length > 0) && !window.confirm(text("moneyStory.returnToCharacterSelectionText"))) return;
    trackMoneyStoryEvent('money_story_character_reselect');
    setGame(null);
    setSelectedCharacterId(null);
    setShareStatus('');
    setLastChoiceImpact([]);
    setUndoStack([]);
    focusGame();
  };

  const replay = () => {
    trackMoneyStoryEvent('money_story_replay');
    returnToCharacterSelection();
  };

  const shareText = useMemo(() => {
    if (!game || !character) return '';

    const safeHighlight = game.history.filter((entry) => !entry.sensitive).at(-1);
    const result =
      game.status === 'win'
        ? text("moneyStory.resultText")
        : game.status === 'survive'
          ? text("moneyStory.resultText2")
          : text("moneyStory.resultText3");

    return (
      text("moneyStory.shareTextText") +
      moneyStoryLabel(character.name, text) +
      text("moneyStory.shareTextText2") +
      result +
      (safeHighlight ? text("moneyStory.shareTextText3") + moneyStoryLabel(safeHighlight.eventTitle, text) + '”' : '') +
      text("moneyStory.shareTextText4")
    );
  }, [game, character, text]);

  const share = async () => {
    if (!shareText) return;

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Money Story',
          text: shareText,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(
          shareText + ' ' + window.location.href,
        );
        setShareStatus(text("moneyStory.shareText"));
      }
      trackMoneyStoryEvent('money_story_share');
    } catch {
      setShareStatus(text("moneyStory.shareText2"));
    }
  };

  const onKeyDown = (eventKey: React.KeyboardEvent<HTMLDivElement>) => {
    if (!event || eventKey.altKey || eventKey.metaKey || eventKey.ctrlKey) return;

    const target = eventKey.target as HTMLElement;
    if (
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
      target.isContentEditable
    ) {
      return;
    }

    if (['1', '2', '3'].includes(eventKey.key)) {
      const index = Number(eventKey.key) - 1;
      const option = event.options[index];
      if (option) {
        eventKey.preventDefault();
        choose(option.id);
      }
    }
  };

  if (!game) {
    return <MoneyStorySelection rootRef={rootRef} selectedCharacterId={selectedCharacterId} setSelectedCharacterId={setSelectedCharacterId} start={start} />;
  }

  if (!character || !bars) return null;

  if (game.status !== 'active') {
    return (
      <MoneyStoryResult
        game={game}
        character={character}
        bars={bars}
        rootRef={rootRef}
        canUndo={Boolean(undoStack.length)}
        undo={undo}
        replay={replay}
        share={share}
        shareStatus={shareStatus}
        onPyramidClick={() => trackMoneyStoryEvent('money_story_financial_pyramid_click')}
        onLineClick={() => trackMoneyStoryEvent('money_story_line_click')}
      />
    );
  }

  const canSellInvestments = Boolean(
    game.pendingShortfall && game.investments > 0,
  );
  const canRecover = hasRecoveryOption(game);

  return (
    <div
      className={styles.shell}
      ref={rootRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <div className={styles.game}>
        <aside className={styles.side + ' ' + styles.sideLeft}>
          <div className={styles.characterTop}>
            <CharacterPortrait
              id={character.id}
              className={styles.characterBadge}
            />
            <div>
              <div className={styles.characterName}>{label(character.name)}</div>
              <p className={styles.characterRole}>{label(character.role)}</p>
            </div>
          </div>
          <p className={label(styles.story)}>{label(character.story)}</p>
          <p className={label(styles.trait)}>{label(character.trait)}</p>
          <p className={styles.goalText}>
            <strong>{text("moneyStory.strong4")}</strong>
            <br />
            {label(character.goal.label)}
          </p>
          <button
            type="button"
            className={styles.changeCharacterButton}
            onClick={returnToCharacterSelection}
          >{text("moneyStory.changeCharacterButton")}</button>
        </aside>

        <section className={styles.center} aria-live="polite">
          <div className={styles.monthTop}>
            <div>
              <div className={styles.monthNum}>{text("moneyStory.monthNum")}{game.currentMonth}{' '}{text("moneyStory.monthNum2")}</div>
              {showSeed ? (
                <div className={styles.seed}>{text("moneyStory.seed")}{game.seed.slice(-6).toUpperCase()}
                </div>
              ) : null}
            </div>
            <div className={styles.monthStatus}>
              <div className={styles.balanceSummary} aria-label={text("moneyStory.moneyStoryGamearialabel")}>
                <span>
                  <small>{text("moneyStory.small")}</small>
                  <strong>{money.format(Math.max(0, game.cash))}</strong>
                </span>
                <span>
                  <small>{text("moneyStory.small2")}</small>
                  <strong>{money.format(game.investments)}</strong>
                </span>
              </div>
              <button
                type="button"
                className={styles.undoButton}
                onClick={undo}
                disabled={undoStack.length === 0}
                aria-label={text("moneyStory.moneyStoryGamearialabel2")}
              >
                <Undo2 size={14} />{text("moneyStory.undoButton")}</button>
            </div>
          </div>

          {!game.monthStarted ? (
            <div className={styles.card}>
              <span className={styles.category}>{text("moneyStory.category")}</span>
              <h2 className={label(styles.eventTitle)}>{text("moneyStory.eventTitle")}</h2>
              <p className={styles.eventText}>{text("moneyStory.eventText")}</p>
              <div className={styles.choices}>
                <button
                  className={styles.primary}
                  type="button"
                  onClick={begin}
                >{text("moneyStory.primary")}{game.currentMonth}
                </button>
              </div>
            </div>
          ) : null}

          {game.pendingShortfall ? (
            <div className={styles.card + ' ' + styles.shortfall}>
              <span className={styles.category}>{text("moneyStory.category2")}</span>
              <h2 className={label(styles.eventTitle)}>{text("moneyStory.eventTitle2")}{money.format(game.pendingShortfall.amount)}{' '}{text("moneyStory.eventTitle3")}</h2>
              <p className={styles.eventText}>{text("moneyStory.eventText2")}</p>

              <div className={styles.shortfallActions}>
                {canSellInvestments ? (
                  <button
                    type="button"
                    className={styles.recoveryChoice}
                    onClick={() => {
                      commitGame(coverShortfallWithInvestments(game));
                      trackMoneyStoryEvent('money_story_recovery_investment');
                    }}
                  >
                    <strong>{text("moneyStory.strong5")}</strong>
                    <span>{text("moneyStory.span")}{money.format(
                        Math.min(game.pendingShortfall.amount, game.investments),
                      )}{' '}{text("moneyStory.span2")}</span>
                  </button>
                ) : null}

                {extraIncomeQuote?.available ? (
                  <button
                    type="button"
                    className={styles.recoveryChoice}
                    onClick={() => {
                      commitGame(coverShortfallWithExtraIncome(game));
                      trackMoneyStoryEvent('money_story_recovery_income');
                    }}
                  >
                    <strong>{text("moneyStory.strong6")}</strong>
                    <span>{text("moneyStory.span3")}{money.format(extraIncomeQuote.immediate)}{' '}{text("moneyStory.span4")}{percentLabel(extraIncomeQuote.ongoingPercent)}{' '}{text("moneyStory.span5")}{' '}
                      {extraIncomeQuote.months}{' '}{text("moneyStory.span6")}</span>
                  </button>
                ) : null}

                {expenseCutQuote?.available ? (
                  <button
                    type="button"
                    className={styles.recoveryChoice}
                    onClick={() => {
                      commitGame(coverShortfallWithExpenseCut(game));
                      trackMoneyStoryEvent('money_story_recovery_expense_cut');
                    }}
                  >
                    <strong>{text("moneyStory.strong7")}</strong>
                    <span>{text("moneyStory.span7")}{money.format(expenseCutQuote.immediate)}{' '}{text("moneyStory.span8")}{' '}{money.format(expenseCutQuote.monthlyReduction)}{' '}{text("moneyStory.span9")}{' '}{expenseCutQuote.months}{' '}{text("moneyStory.span6")}</span>
                  </button>
                ) : null}

                {debtRestructureQuote?.available ? (
                  <button
                    type="button"
                    className={styles.recoveryChoice}
                    onClick={() => {
                      commitGame(coverShortfallWithDebtRestructure(game));
                      trackMoneyStoryEvent('money_story_recovery_debt');
                    }}
                  >
                    <strong>{text("moneyStory.strong8")}</strong>
                    <span>{text("moneyStory.span10")}{' '}
                      {money.format(debtRestructureQuote.immediateRelief)}{' '}{text("moneyStory.span11")}{' '}
                      {money.format(debtRestructureQuote.nextMonthlyBefore)} →{' '}
                      {money.format(debtRestructureQuote.nextMonthlyAfter)}{' '}{text("moneyStory.span12")}</span>
                  </button>
                ) : null}

                {loanQuote?.canBorrow ? (
                  <button
                    type="button"
                    className={styles.recoveryChoice}
                    onClick={() => {
                      commitGame(coverShortfallWithLoan(game));
                      trackMoneyStoryEvent('money_story_borrow');
                    }}
                  >
                    <strong>
                      {loanQuote.partial
                        ? text("moneyStory.moneyStoryGameText") + money.format(loanQuote.principal) + text("moneyStory.optionImpactLinesText6")
                        : text("moneyStory.moneyStoryGameText2") + money.format(loanQuote.principal) + text("moneyStory.optionImpactLinesText6")}
                    </strong>
                    <span>{text("moneyStory.span13")}{money.format(loanQuote.monthlyPayment)}{' '}{text("moneyStory.span14")}{' '}
                      {loanQuote.termMonths}{' '}{text("moneyStory.span6")}{loanQuote.partial
                        ? text("moneyStory.moneyStoryGameText3")
                        : text("moneyStory.moneyStoryGameText4")}
                    </span>
                  </button>
                ) : null}

                {!canRecover ? (
                  <>
                    <p className={styles.recoveryExhausted}>{text("moneyStory.recoveryExhausted")}</p>
                    <button
                      type="button"
                      className={styles.danger}
                      onClick={() => {
                        commitGame(declareUnableToContinue(game));
                        trackMoneyStoryEvent('money_story_lose');
                      }}
                    >{text("moneyStory.danger")}</button>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}

          {event && !game.pendingShortfall ? (
            <div className={styles.card}>
              <span className={styles.category}>
                {label(EVENT_CATEGORY_LABELS[event.category])}
              </span>
              <h2 className={label(styles.eventTitle)}>{label(event.title)}</h2>
              <p className={styles.eventText}>{label(event.text)}</p>

              {game.monthLedger ? (
                <div className={styles.ledger}>
                  <div>
                    <span>{text("moneyStory.span15")}</span>
                    <strong>+{money.format(game.monthLedger.income)}</strong>
                  </div>
                  <div>
                    <span>{text("moneyStory.span16")}</span>
                    <strong>
                      -{money.format(game.monthLedger.fixedExpenses)}
                    </strong>
                  </div>
                  <div>
                    <span>{text("moneyStory.span17")}</span>
                    <strong>-{money.format(game.monthLedger.debtPayments)}</strong>
                  </div>
                  <div>
                    <span>{text("moneyStory.span18")}</span>
                    <strong>
                      -{money.format(game.monthLedger.protectionPremiums)}
                    </strong>
                  </div>
                </div>
              ) : null}

              {event.options.length === 1 ? (
                <div className={styles.acknowledgement}>
                  <div className={styles.eventImpact}>
                    {optionImpactLines(event.options[0], game).map((line) => (
                      <span key={line}>{line}</span>
                    ))}
                  </div>
                  <button
                    data-money-choice
                    type="button"
                    className={styles.primary}
                    onClick={() => choose(event.options[0].id)}
                  >{text("moneyStory.primary2")}</button>
                </div>
              ) : (
                <div className={styles.choices}>
                  {event.options.slice(0, 3).map((option, index) => (
                    <button
                      key={option.id}
                      data-money-choice
                      type="button"
                      className={label(styles.choice)}
                      onClick={() => choose(option.id)}
                    >
                      <span className={styles.key}>{index + 1}</span>
                      <strong>{label(option.label)}</strong>
                      <span className={styles.choiceOutcome}>{label(option.outcomeText)}</span>
                      {optionImpactLines(option, game).map((line) => (
                        <span className={styles.choiceImpact} key={line}>{line}</span>
                      ))}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {game.lastResolution &&
          !game.pendingShortfall &&
          !event ? (
            <div className={styles.card}>
              <span className={styles.category}>
                {resolvedEvent?.options.length === 1
                  ? text("moneyStory.moneyStoryGameText5")
                  : text("moneyStory.moneyStoryGameText6")}
              </span>
              <h2 className={label(styles.eventTitle)}>
                {label(game.lastResolution.summary)}
              </h2>
              {lastChoiceImpact.length ? (
                <div className={styles.eventImpact}>
                  {lastChoiceImpact.map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </div>
              ) : null}

              {game.lastResolution.grossCost !== undefined ? (
                <div className={styles.resultNumbers}>
                  <div className={styles.numberBox}>
                    <small>
                      {resolvedUsesLumpSum
                        ? text("moneyStory.moneyStoryGameText7")
                        : text("moneyStory.moneyStoryGameText8")}
                    </small>
                    <strong>
                      {money.format(game.lastResolution.grossCost)}{' '}{text("moneyStory.eventTitle3")}</strong>
                  </div>
                  {!resolvedUsesLumpSum ? (
                    <div className={styles.numberBox}>
                      <small>{text("moneyStory.small3")}</small>
                      <strong>
                        {money.format(game.lastResolution.existingBenefit ?? 0)}{' '}{text("moneyStory.eventTitle3")}</strong>
                    </div>
                  ) : null}
                  <div className={styles.numberBox}>
                    <small>
                      {resolvedUsesLumpSum
                        ? text("moneyStory.moneyStoryGameText9")
                        : text("moneyStory.moneyStoryGameText10")}
                    </small>
                    <strong>
                      {money.format(game.lastResolution.protectionBenefit ?? 0)}{' '}{text("moneyStory.eventTitle3")}</strong>
                  </div>
                  <div className={styles.numberBox}>
                    <small>
                      {resolvedUsesLumpSum
                        ? text("moneyStory.moneyStoryGameText11")
                        : text("moneyStory.moneyStoryGameText12")}
                    </small>
                    <strong>
                      {money.format(game.lastResolution.outOfPocket ?? 0)}{' '}{text("moneyStory.eventTitle3")}</strong>
                  </div>
                </div>
              ) : null}

              <div className={styles.choices}>
                <button
                  type="button"
                  className={styles.primary}
                  onClick={goNext}
                >
                  {game.currentMonth === 12
                    ? text("moneyStory.moneyStoryGameText13")
                    : text("moneyStory.moneyStoryGameText14")}
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <MoneyStoryStatusSidebar game={game} bars={bars} />
      </div>
    </div>
  );
}
