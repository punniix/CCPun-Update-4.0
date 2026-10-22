'use client';
import { usePublicCopy } from "@/components/ui/PublicCopyProvider";
import { MONEY_STORY_COPY_DEFAULTS, moneyStoryLabel } from "@/lib/content/money-story-copy-defaults";
import type { RefObject } from 'react';
import Link from 'next/link';
import { RefreshCcw, Undo2, WalletCards } from 'lucide-react';
import { MONEY_STORY_CHARACTERS } from '../characters';
import { getMoneyStoryEvent } from '../events';
import { createGame, statusBars, totalDebt } from '../engine';
import { MONEY_STORY_LINE_URL, MONEY_STORY_PYRAMID_URL, PROTECTION_CATALOG } from '../config';
import type { CharacterProfile, EventOption, GameState } from '../types';
import styles from '../MoneyStory.module.css';

const money = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 });

export function CharacterPortrait({
  id,
  className,
}: {
  id: string;
  className: string;
}) {
  return (
    <span
      className={className + ' ' + styles.characterPortrait}
      data-character={id}
      aria-hidden="true"
    />
  );
}


function percentLabel(value: number) {
  const percent = Math.abs(value * 100);
  return (Number.isInteger(percent) ? percent.toFixed(0) : percent.toFixed(1)) + '%';
}

function decisionScore(option: EventOption, baseIncome: number) {
  const effect = option.effect;
  let score = 0;

  score += Math.abs(effect.cashDelta ?? 0);
  score += Math.abs(effect.investmentDelta ?? 0);
  score += Math.abs(effect.debtPrincipalReduction ?? 0);
  score += effect.borrow?.principal ?? 0;
  score += effect.cost?.amount ?? 0;

  if (effect.investmentPercent) {
    score += Math.abs(effect.investmentPercent) * baseIncome * 2;
  }
  if (effect.incomeModifier) {
    const months = effect.incomeModifier.throughEnd
      ? 6
      : effect.incomeModifier.months ?? 1;
    score += Math.abs(effect.incomeModifier.percent) * baseIncome * months;
  }
  if (effect.expenseModifier) {
    score += effect.expenseModifier.amount * effect.expenseModifier.months;
  }
  if (effect.addProtection) {
    score += PROTECTION_CATALOG[effect.addProtection].exampleCost * 0.35;
  }

  return score;
}

export function MoneyStorySelection({ rootRef, selectedCharacterId, setSelectedCharacterId, start }: {
  rootRef: RefObject<HTMLDivElement | null>;
  selectedCharacterId: string | null;
  setSelectedCharacterId: (id: string) => void;
  start: (characterId?: string) => void;
}) {
  const text = usePublicCopy(MONEY_STORY_COPY_DEFAULTS);
  const label = (value: string) => moneyStoryLabel(value, text);

    const selectedCharacter = selectedCharacterId
      ? MONEY_STORY_CHARACTERS.find((item) => item.id === selectedCharacterId)
      : null;

    return (
      <div className={styles.shell} ref={rootRef} tabIndex={-1}>
        <div className={styles.start}>
          <div className={styles.startIcon} aria-hidden="true">
            <WalletCards />
          </div>
          <h2>{text("moneyStory.h22")}</h2>
          <p>{text("moneyStory.p4")}</p>

          <div className={styles.characterPicker} aria-label={text("moneyStory.moneyStorySelectionarialabel")}>
            {MONEY_STORY_CHARACTERS.map((profile) => {
              const selected = selectedCharacterId === profile.id;
              return (
                <button
                  type="button"
                  key={profile.id}
                  className={
                    styles.characterPickCard +
                    (selected ? ' ' + styles.characterPickSelected : '')
                  }
                  aria-pressed={selected}
                  onClick={() => setSelectedCharacterId(profile.id)}
                >
                  <CharacterPortrait
                    id={profile.id}
                    className={styles.characterPickAvatar}
                  />
                  <span className={styles.characterPickCopy}>
                    <strong>{label(profile.name)}</strong>
                    <span>{label(profile.role)}</span>
                    <em>{label(profile.archetype)}</em>
                    <small>{label(profile.challenge)}</small>
                  </span>
                  <span className={styles.characterPickMeta}>
                    <b>{text("moneyStory.optionImpactLinesText11")}{money.format(profile.baseIncome)}</b>
                    <b>{text("moneyStory.b")}{money.format(profile.fixedExpenses)}</b>
                  </span>
                </button>
              );
            })}
          </div>

          <p className={styles.mobileSwipeHint}>{text("moneyStory.mobileSwipeHint")}</p>

          {selectedCharacter ? (
            <div className={styles.selectedLifePreview}>
              <div className={styles.selectedLifeTop}>
                <CharacterPortrait
                  id={selectedCharacter.id}
                  className={styles.selectedLifeAvatar}
                />
                <div>
                  <strong>
                    {label(selectedCharacter.name)} · {label(selectedCharacter.role)}
                  </strong>
                  <em>{label(selectedCharacter.archetype)}</em>
                </div>
              </div>
              <p>{label(selectedCharacter.challenge)}</p>
              <div className={styles.selectedLifeStats}>
                <span><small>{text("moneyStory.small4")}</small><b>{money.format(selectedCharacter.startingCash)}</b></span>
                <span><small>{text("moneyStory.small2")}</small><b>{money.format(selectedCharacter.startingInvestments)}</b></span>
                <span><small>{text("moneyStory.small5")}</small><b>{money.format(selectedCharacter.fixedExpenses)}{text("moneyStory.b2")}</b></span>
                <span><small>{text("moneyStory.small6")}</small><b>{money.format(selectedCharacter.goal.targetNetPosition)}</b></span>
              </div>
            </div>
          ) : null}

          <div className={styles.startActions}>
            <button
              type="button"
              className={styles.primary}
              disabled={!selectedCharacterId}
              onClick={() => start(selectedCharacterId ?? undefined)}
            >{text("moneyStory.primary3")}</button>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => start()}
            >{text("moneyStory.secondary")}</button>
          </div>
        </div>
      </div>
    );
}

export function MoneyStoryResult({ game, character, bars, rootRef, canUndo, undo, replay, share, shareStatus, onPyramidClick, onLineClick }: {
  game: GameState;
  character: CharacterProfile;
  bars: ReturnType<typeof statusBars>;
  rootRef: RefObject<HTMLDivElement | null>;
  canUndo: boolean;
  undo: () => void;
  replay: () => void;
  share: () => Promise<void>;
  shareStatus: string;
  onPyramidClick: () => void;
  onLineClick: () => void;
}) {
  const text = usePublicCopy(MONEY_STORY_COPY_DEFAULTS);
  const label = (value: string) => moneyStoryLabel(value, text);
function decisionImpactText(option: EventOption) {
  const effect = option.effect;

  if (effect.incomeModifier) {
    const sign = effect.incomeModifier.percent >= 0 ? '+' : '-';
    const duration = effect.incomeModifier.throughEnd
      ? text("moneyStory.durationText")
      : text("moneyStory.durationText2") + (effect.incomeModifier.months ?? 1) + text("moneyStory.optionImpactLinesText4");
    return text("moneyStory.optionImpactLinesText11") + sign + percentLabel(effect.incomeModifier.percent) + ' ' + duration;
  }

  if (effect.debtPrincipalReduction) {
    return text("moneyStory.decisionImpactTextText") + money.format(effect.debtPrincipalReduction) + text("moneyStory.optionImpactLinesText6");
  }

  if (effect.addProtection) {
    return text("moneyStory.decisionImpactTextText2") + label(PROTECTION_CATALOG[effect.addProtection].label);
  }

  if (effect.borrow) {
    return text("moneyStory.decisionImpactTextText3") + money.format(effect.borrow.principal) + text("moneyStory.optionImpactLinesText6");
  }

  if (effect.investmentDelta) {
    return effect.investmentDelta > 0
      ? text("moneyStory.decisionImpactTextText4") + money.format(effect.investmentDelta) + text("moneyStory.optionImpactLinesText6")
      : text("moneyStory.decisionImpactTextText5") + money.format(Math.abs(effect.investmentDelta)) + text("moneyStory.optionImpactLinesText6");
  }

  if (effect.investmentPercent) {
    return text("moneyStory.decisionImpactTextText6") +
      (effect.investmentPercent > 0 ? '+' : '-') +
      percentLabel(effect.investmentPercent);
  }

  if (effect.expenseModifier) {
    return text("moneyStory.decisionImpactTextText7") +
      money.format(effect.expenseModifier.amount) +
      text("moneyStory.decisionImpactTextText8") +
      effect.expenseModifier.months +
      text("moneyStory.optionImpactLinesText4");
  }

  if (effect.cashDelta) {
    return text("moneyStory.optionImpactLinesText5") +
      (effect.cashDelta > 0 ? '+' : '-') +
      money.format(Math.abs(effect.cashDelta)) +
      text("moneyStory.optionImpactLinesText6");
  }

  return option.outcomeText;
}


    const resultTitle =
      game.status === 'win'
        ? text("moneyStory.resultTitleText")
        : game.status === 'survive'
          ? text("moneyStory.resultTitleText2")
          : text("moneyStory.resultTitleText3");

    const baseline = createGame('result-baseline-' + character.id, character.id);
    const startBars = statusBars(baseline);
    const startingDebt = totalDebt(baseline);
    const endingDebt = totalDebt(game);
    const monthlyReserveNeed = bars.cashReserveTarget / 3;
    const reserveMonths =
      monthlyReserveNeed > 0
        ? Math.min(3, bars.cashReserveAllocated / monthlyReserveNeed)
        : 3;
    const startingProtectionCount = baseline.protections.length;
    const endingProtectionCount = game.protections.length;
    const purchasedProtections = game.protections
      .filter((holding) => holding.source === 'purchased')
      .map((holding) => label(PROTECTION_CATALOG[holding.type].label));

    const importantDecisions = game.history
      .map((entry) => {
        const entryEvent = getMoneyStoryEvent(entry.eventId);
        const option = entryEvent?.options.find(
          (item) => item.label === entry.optionLabel,
        );
        if (!entryEvent || !option || entryEvent.options.length < 2) return null;
        return {
          month: entry.month,
          title: entryEvent.title,
          choice: option.label,
          impact: decisionImpactText(option),
          score: decisionScore(option, character.baseIncome),
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    const watchItems: string[] = [];
    if (reserveMonths < 2.95) {
      watchItems.push(
        text("moneyStory.moneyStoryResultText") +
          reserveMonths.toFixed(1) +
          text("moneyStory.moneyStoryResultText2"),
      );
    }
    if (bars.projectedMonthlyFlexibility < character.baseIncome * 0.15) {
      watchItems.push(
        text("moneyStory.moneyStoryResultText3") +
          money.format(bars.projectedMonthlyFlexibility) +
          text("moneyStory.moneyStoryResultText4"),
      );
    }
    if (endingDebt > startingDebt) {
      watchItems.push(
        text("moneyStory.moneyStoryResultText5") +
          money.format(startingDebt) +
          text("moneyStory.moneyStoryResultText6") +
          money.format(endingDebt) +
          text("moneyStory.optionImpactLinesText6"),
      );
    } else if (endingDebt > 0 && endingDebt >= startingDebt * 0.75) {
      watchItems.push(
        text("moneyStory.moneyStoryResultText7") + money.format(endingDebt) + text("moneyStory.optionImpactLinesText6"),
      );
    }
    if (bars.goalProgressPercent < 100) {
      watchItems.push(
        text("moneyStory.moneyStoryResultText8") +
          Math.round(bars.goalProgressPercent) +
          text("moneyStory.moneyStoryResultText9"),
      );
    }

    const resultLead =
      game.status === 'lose'
        ? text("moneyStory.resultLeadText") +
          game.currentMonth +
          text("moneyStory.resultLeadText2")
        : text("moneyStory.resultLeadText3") +
          reserveMonths.toFixed(1) +
          text("moneyStory.resultLeadText4") +
          money.format(bars.goalPosition) +
          text("moneyStory.optionImpactLinesText6");

    return (
      <div className={styles.shell} ref={rootRef} tabIndex={-1}>
        <div className={styles.result}>
          <div className={styles.resultHero}>
            <CharacterPortrait
              id={character.id}
              className={styles.resultPortrait}
            />
            <p className={styles.kicker}>{text("moneyStory.kicker3")}{label(character.name)}</p>
            <h2>{resultTitle}</h2>
          </div>

          <div className={styles.resultSnapshot}>
            <h3>{text("moneyStory.h3")}</h3>
            <p className={styles.resultLead}>{resultLead}</p>
            <div className={styles.resultNumbers}>
              <div className={styles.numberBox}>
                <small>{text("moneyStory.small7")}</small>
                <strong>{reserveMonths.toFixed(1)}{text("moneyStory.strong9")}</strong>
                <span>
                  {money.format(bars.cashReserveAllocated)}{text("moneyStory.eventTitle3")}</span>
              </div>
              <div className={styles.numberBox}>
                <small>{text("moneyStory.small8")}</small>
                <strong>{money.format(bars.goalPosition)}{text("moneyStory.eventTitle3")}</strong>
                <span>
                  {Math.round(bars.goalProgressPercent)}{text("moneyStory.moneyStoryResultText9")}</span>
              </div>
              <div className={styles.numberBox}>
                <small>{text("moneyStory.small9")}</small>
                <strong>{money.format(endingDebt)}{text("moneyStory.eventTitle3")}</strong>
                <span>{text("moneyStory.span19")}{money.format(startingDebt)}{text("moneyStory.eventTitle3")}</span>
              </div>
              <div className={styles.numberBox}>
                <small>{text("moneyStory.strong")}</small>
                <strong>{endingProtectionCount}{text("moneyStory.strong10")}</strong>
                <span>{text("moneyStory.span19")}{startingProtectionCount}
                  {purchasedProtections.length
                    ? text("moneyStory.moneyStoryResultText10") + purchasedProtections.join(', ')
                    : text("moneyStory.moneyStoryResultText11")}
                </span>
              </div>
            </div>

            <div className={styles.resultCompare}>
              <span>{text("moneyStory.span20")}{' '}
                <strong>{money.format(startBars.goalPosition)}</strong>
              </span>
              <span aria-hidden="true">→</span>
              <span>{text("moneyStory.span21")}<strong>{money.format(bars.goalPosition)}</strong>{text("moneyStory.eventTitle3")}</span>
            </div>
          </div>

          <div className={styles.resultGrid}>
            <div className={styles.card}>
              <h3>{text("moneyStory.h32")}</h3>
              {importantDecisions.length ? (
                <ul className={styles.decisionList}>
                  {importantDecisions.map((item) => (
                    <li key={String(item.month) + '-' + item.title + '-' + item.choice}>
                      <strong>{text("moneyStory.monthNum")}{item.month} · {label(item.title)}</strong>
                      <span>{text("moneyStory.span22")}{label(item.choice)}”</span>
                      <small>{item.impact}</small>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.emptyResultNote}>{text("moneyStory.emptyResultNote")}</p>
              )}
            </div>

            <div className={styles.card}>
              <h3>{text("moneyStory.h33")}</h3>
              {watchItems.length ? (
                <ul className={styles.watchList}>
                  {watchItems.slice(0, 3).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className={styles.emptyResultNote}>{text("moneyStory.emptyResultNote2")}</p>
              )}
            </div>

            <div className={styles.card + ' ' + styles.resultWide}>
              <h3>{text("moneyStory.h34")}</h3>
              <ul className={styles.timeline}>
                {game.history.slice(-5).map((item) => (
                  <li key={String(item.month) + '-' + item.eventId}>
                    <strong>{text("moneyStory.monthNum")}{item.month}</strong>
                    <span>
                      {item.sensitive ? text("moneyStory.moneyStoryResultText12") : label(item.eventTitle)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className={styles.resultActions}>
            {canUndo ? (
              <button type="button" className={styles.secondary} onClick={undo}>
                <Undo2 size={16} />{text("moneyStory.undoButton")}</button>
            ) : null}
            <button type="button" className={styles.primary} onClick={replay}>
              <RefreshCcw size={16} />{text("moneyStory.primary4")}</button>
            <button type="button" className={styles.secondary} onClick={share}>{text("moneyStory.secondary2")}</button>
            <Link
              className={styles.secondary}
              href={MONEY_STORY_PYRAMID_URL}
              onClick={onPyramidClick}
            >{text("moneyStory.secondary3")}</Link>
          </div>

          {shareStatus ? (
            <p className={styles.muted} style={{ textAlign: 'center' }}>
              {shareStatus}
            </p>
          ) : null}

          <div className={styles.lineCard}>
            <h3>{text("moneyStory.h35")}</h3>
            <p>{text("moneyStory.p5")}</p>
            <a
              className={styles.primary}
              href={MONEY_STORY_LINE_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onLineClick}
            >{text("moneyStory.primary5")}</a>
          </div>
        </div>
      </div>
    );
}
