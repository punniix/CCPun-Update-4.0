'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Car,
  HeartPulse,
  House,
  ShieldCheck,
  Undo2,
  Users,
} from 'lucide-react';
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
import { CharacterPortrait, MoneyStoryResult, MoneyStorySelection, percentLabel } from './MoneyStoryScreens';

const money = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 });

function trackMoneyStoryEvent(eventName: string, params: EventParams = {}) {
  trackEvent(eventName, {
    ...params,
    tool_name: 'money_story',
    surface_group: 'money_story',
  });
}

const protectionIcons: Record<ProtectionType, React.ReactNode> = {
  health: <HeartPulse size={14} />,
  critical: <ShieldCheck size={14} />,
  life: <Users size={14} />,
  motor: <Car size={14} />,
  home: <House size={14} />,
};

function Meter({
  label,
  value,
  status,
  detail,
}: {
  label: string;
  value: number;
  status: string;
  detail: React.ReactNode;
}) {
  return (
    <div>
      <div className={styles.meterHeader}>
        <strong>{label}</strong>
        <span>{status}</span>
      </div>
      <div
        className={styles.meterTrack}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value)}
      >
        <div
          className={styles.meterFill}
          style={{ width: String(Math.max(0, Math.min(100, value))) + '%' }}
        />
      </div>
      <div className={styles.valueLine}>
        <span>{Math.round(value)} / 100</span>
        <div className={styles.meterDetail}>{detail}</div>
      </div>
    </div>
  );
}

function isLumpSumProtection(type?: ProtectionType) {
  return type === 'critical' || type === 'life';
}

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
      'ได้เงิน ' +
        money.format(loan.principal) +
        ' บาท · ค่างวดประมาณ ' +
        money.format(amortizedPayment(loan.principal, loan.monthlyRate, loan.termMonths)) +
        ' บาท/เดือน × ' +
        loan.termMonths +
        ' เดือน',
    );
  }

  if (cashDelta !== 0) {
    lines.push(
      'เงินสด ' +
        (cashDelta > 0 ? '+' : '-') +
        money.format(Math.abs(cashDelta)) +
        ' บาท',
    );
  }

  if (effect.investmentDelta) {
    if (effect.investmentDelta > 0) {
      const transfer = Math.min(effect.investmentDelta, cashAfterTransfers);
      cashAfterTransfers -= transfer;
      lines.push('ย้ายเงินสด ' + money.format(transfer) + ' บาทไปลงทุน');
    } else {
      const reduction = Math.min(game.investments, Math.abs(effect.investmentDelta));
      lines.push('เงินลงทุน -' + money.format(reduction) + ' บาท');
    }
  }

  if (effect.investmentPercent !== undefined) {
    const before = game.investments;
    const after = Math.max(0, Math.round(before * (1 + effect.investmentPercent)));
    const sign =
      effect.investmentPercent > 0 ? '+' : effect.investmentPercent < 0 ? '-' : '';
    lines.push(
      'เงินลงทุน ' +
        sign +
        percentLabel(effect.investmentPercent) +
        ' · ' +
        money.format(before) +
        ' → ' +
        money.format(after) +
        ' บาท',
    );
  }

  if (effect.incomeModifier) {
    lines.push(
      'รายได้ ' +
        (effect.incomeModifier.percent > 0 ? '+' : '-') +
        percentLabel(effect.incomeModifier.percent) +
        (effect.incomeModifier.throughEnd
          ? ' ตั้งแต่เดือนหน้าไปจนจบเกม'
          : ' × ' + (effect.incomeModifier.months ?? 1) + ' เดือน'),
    );
  }

  if (effect.expenseModifier) {
    lines.push(
      'ค่าใช้จ่าย +' +
        money.format(effect.expenseModifier.amount) +
        ' บาท/เดือน × ' +
        effect.expenseModifier.months +
        ' เดือน',
    );
  }

  if (effect.cost) {
    lines.push(
      'ค่าใช้จ่ายจากเหตุการณ์ ' +
        money.format(effect.cost.amount) +
        ' บาท · ระบบจะใช้สิทธิ/ความคุ้มครองที่มี ก่อนคำนวณเงินที่ต้องจ่ายเอง',
    );
  }

  if (effect.debtPrincipalReduction) {
    const payment = Math.min(effect.debtPrincipalReduction, cashAfterTransfers);
    lines.push('จ่ายเพิ่ม ' + money.format(payment) + ' บาทเพื่อลดเงินต้น');
  }

  if (effect.addProtection) {
    const protectionType = effect.addProtection;
    const protection = PROTECTION_CATALOG[protectionType];
    const preview = protectionBenefitPreview(game, protectionType);
    lines.push(
      'เบี้ย ' +
        money.format(protection.monthlyPremium) +
        ' บาท/เดือน · เริ่มคุ้มครองเดือนถัดไป',
    );

    if (isLumpSumProtection(protectionType)) {
      lines.push(
        'ตัวอย่างในเกม: ถ้าเกิดเหตุที่เข้าเงื่อนไขและมีผลกระทบทางการเงิน ' +
          money.format(preview.grossCost) +
          ' บาท',
      );
      lines.push(
        'ความคุ้มครองนี้ช่วยเป็นเงินก้อนประมาณ ' +
          money.format(preview.protectionBenefit) +
          ' บาท · เหลือภาระที่ต้องรับเองประมาณ ' +
          money.format(preview.withProtection) +
          ' บาท',
      );
    } else {
      lines.push(
        'ตัวอย่างในเกม: ถ้าเกิดค่าใช้จ่าย ' +
          money.format(preview.grossCost) +
          ' บาท',
      );
      lines.push(
        'ไม่มีความคุ้มครองนี้ จ่ายเอง ' +
          money.format(preview.withoutProtection) +
          ' บาท → มีความคุ้มครอง จ่ายเองประมาณ ' +
          money.format(preview.withProtection) +
          ' บาท',
      );
    }
  }

  if (lines.length === 0) {
    lines.push('ไม่มีผลกระทบทางการเงินทันที');
  }

  return lines;
}

export default function MoneyStoryGame({ showSeed = false }: { showSeed?: boolean }) {
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
    if (game?.status === 'active' && (game.currentMonth > 1 || game.history.length > 0) && !window.confirm('กลับไปเลือกตัวละครจะเริ่มรอบใหม่ ต้องการเริ่มใหม่หรือไม่?')) return;
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
        ? 'ไปถึงเป้าหมาย'
        : game.status === 'survive'
          ? 'ผ่านครบ 12 เดือน'
          : 'เจอเดือนที่ไปต่อไม่ไหว';

    return (
      'Money Story: รอบนี้ได้เล่นชีวิตของ “' +
      character.name +
      '” และ' +
      result +
      (safeHighlight ? ' — แถมเจอ “' + safeHighlight.eventTitle + '”' : '') +
      ' ลองดูว่า 12 เดือนของคุณจะเป็นยังไง'
    );
  }, [game, character]);

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
        setShareStatus('คัดลอกลิงก์แล้ว');
      }
      trackMoneyStoryEvent('money_story_share');
    } catch {
      setShareStatus('ยังแชร์ไม่ได้ในเบราว์เซอร์นี้');
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
    return <MoneyStoryResult
      game={game} character={character} bars={bars} rootRef={rootRef}
      canUndo={Boolean(undoStack.length)} undo={undo} replay={replay}
      share={share} shareStatus={shareStatus}
      onPyramidClick={() => trackMoneyStoryEvent('money_story_financial_pyramid_click')}
      onLineClick={() => trackMoneyStoryEvent('money_story_line_click')}
    />;
  }

  const protectionTypes: ProtectionType[] = [
    'health',
    'critical',
    'life',
    'motor',
    'home',
  ];

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
              <div className={styles.characterName}>{character.name}</div>
              <p className={styles.characterRole}>{character.role}</p>
            </div>
          </div>
          <p className={styles.story}>{character.story}</p>
          <p className={styles.trait}>{character.trait}</p>
          <p className={styles.goalText}>
            <strong>เป้าหมาย</strong>
            <br />
            {character.goal.label}
          </p>
          <button
            type="button"
            className={styles.changeCharacterButton}
            onClick={returnToCharacterSelection}
          >
            กลับไปเลือกตัวละคร
          </button>
        </aside>

        <section className={styles.center} aria-live="polite">
          <div className={styles.monthTop}>
            <div>
              <div className={styles.monthNum}>
                เดือน {game.currentMonth} / 12
              </div>
              {showSeed ? (
                <div className={styles.seed}>
                  รอบจำลอง {game.seed.slice(-6).toUpperCase()}
                </div>
              ) : null}
            </div>
            <div className={styles.monthStatus}>
              <div className={styles.balanceSummary} aria-label="สถานะเงินปัจจุบัน">
                <span>
                  <small>เงินสดพร้อมใช้</small>
                  <strong>{money.format(Math.max(0, game.cash))}</strong>
                </span>
                <span>
                  <small>พอร์ตลงทุน</small>
                  <strong>{money.format(game.investments)}</strong>
                </span>
              </div>
              <button
                type="button"
                className={styles.undoButton}
                onClick={undo}
                disabled={undoStack.length === 0}
                aria-label="ย้อนกลับการตัดสินใจล่าสุด"
              >
                <Undo2 size={14} />
                ย้อนกลับ
              </button>
            </div>
          </div>

          {!game.monthStarted ? (
            <div className={styles.card}>
              <span className={styles.category}>เริ่มเดือนใหม่</span>
              <h2 className={styles.eventTitle}>
                รับรายได้ แล้วหักค่าใช้จ่ายประจำ
              </h2>
              <p className={styles.eventText}>
                ระบบจะคำนวณค่าใช้จ่ายประจำ ค่างวดหนี้ และเบี้ยความคุ้มครองก่อน
                แล้วจึงสุ่มเหตุการณ์ประจำเดือน
              </p>
              <div className={styles.choices}>
                <button
                  className={styles.primary}
                  type="button"
                  onClick={begin}
                >
                  เริ่มเดือน {game.currentMonth}
                </button>
              </div>
            </div>
          ) : null}

          {game.pendingShortfall ? (
            <div className={styles.card + ' ' + styles.shortfall}>
              <span className={styles.category}>ช่วงแก้สถานการณ์</span>
              <h2 className={styles.eventTitle}>
                ยังขาดอีก {money.format(game.pendingShortfall.amount)} บาท
              </h2>
              <p className={styles.eventText}>
                เกมยังไม่จบตรงนี้ คุณใช้หลายวิธีร่วมกันได้
                ทุกครั้งที่เลือก ระบบจะคำนวณยอดที่ยังขาดใหม่
              </p>

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
                    <strong>ใช้เงินลงทุนก่อน</strong>
                    <span>
                      ขาย {money.format(
                        Math.min(game.pendingShortfall.amount, game.investments),
                      )} บาท เพื่อเติมส่วนที่ขาด
                    </span>
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
                    <strong>รับงานเสริมเร่งด่วน</strong>
                    <span>
                      เงินสด +{money.format(extraIncomeQuote.immediate)} บาทวันนี้ ·
                      รายได้ +{percentLabel(extraIncomeQuote.ongoingPercent)} อีก{' '}
                      {extraIncomeQuote.months} เดือน
                    </span>
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
                    <strong>ลดค่าใช้จ่ายชั่วคราว</strong>
                    <span>
                      ช่วยเดือนนี้ได้สูงสุด {money.format(expenseCutQuote.immediate)} บาท ·
                      ลดรายจ่าย {money.format(expenseCutQuote.monthlyReduction)} บาท/เดือน
                      อีก {expenseCutQuote.months} เดือน
                    </span>
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
                    <strong>ขอปรับค่างวด</strong>
                    <span>
                      ลดค่างวดที่ต้องจ่ายเดือนนี้ได้ประมาณ{' '}
                      {money.format(debtRestructureQuote.immediateRelief)} บาท ·
                      ค่างวดถัดไปประมาณ{' '}
                      {money.format(debtRestructureQuote.nextMonthlyBefore)} →{' '}
                      {money.format(debtRestructureQuote.nextMonthlyAfter)} บาท/เดือน
                    </span>
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
                        ? 'กู้ได้สูงสุด ' + money.format(loanQuote.principal) + ' บาท'
                        : 'กู้ ' + money.format(loanQuote.principal) + ' บาท'}
                    </strong>
                    <span>
                      ค่างวดประมาณ {money.format(loanQuote.monthlyPayment)} บาท/เดือน ×{' '}
                      {loanQuote.termMonths} เดือน
                      {loanQuote.partial
                        ? ' · เงินกู้นี้ยังไม่พอปิดส่วนที่ขาด ต้องใช้วิธีอื่นร่วมด้วย'
                        : ' · ช่วยผ่านเดือนนี้ แต่เพิ่มภาระเดือนถัดไป'}
                    </span>
                  </button>
                ) : null}

                {!canRecover ? (
                  <>
                    <p className={styles.recoveryExhausted}>
                      ลองใช้ทางเลือกฉุกเฉินที่มีครบแล้ว
                      หากยังปิดส่วนที่ขาดไม่ได้ รอบนี้จึงไปต่อไม่ไหว
                    </p>
                    <button
                      type="button"
                      className={styles.danger}
                      onClick={() => {
                        commitGame(declareUnableToContinue(game));
                        trackMoneyStoryEvent('money_story_lose');
                      }}
                    >
                      จบรอบนี้
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}

          {event && !game.pendingShortfall ? (
            <div className={styles.card}>
              <span className={styles.category}>
                {EVENT_CATEGORY_LABELS[event.category]}
              </span>
              <h2 className={styles.eventTitle}>{event.title}</h2>
              <p className={styles.eventText}>{event.text}</p>

              {game.monthLedger ? (
                <div className={styles.ledger}>
                  <div>
                    <span>รายได้เดือนนี้</span>
                    <strong>+{money.format(game.monthLedger.income)}</strong>
                  </div>
                  <div>
                    <span>ค่าใช้จ่ายประจำ</span>
                    <strong>
                      -{money.format(game.monthLedger.fixedExpenses)}
                    </strong>
                  </div>
                  <div>
                    <span>ค่างวดหนี้</span>
                    <strong>-{money.format(game.monthLedger.debtPayments)}</strong>
                  </div>
                  <div>
                    <span>เบี้ยความคุ้มครอง</span>
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
                  >
                    รับทราบและไปต่อ
                  </button>
                </div>
              ) : (
                <div className={styles.choices}>
                  {event.options.slice(0, 3).map((option, index) => (
                    <button
                      key={option.id}
                      data-money-choice
                      type="button"
                      className={styles.choice}
                      onClick={() => choose(option.id)}
                    >
                      <span className={styles.key}>{index + 1}</span>
                      <strong>{option.label}</strong>
                      <span className={styles.choiceOutcome}>{option.outcomeText}</span>
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
                  ? 'ผลของเหตุการณ์'
                  : 'ผลของการตัดสินใจ'}
              </span>
              <h2 className={styles.eventTitle}>
                {game.lastResolution.summary}
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
                        ? 'ผลกระทบทางการเงิน'
                        : 'ค่าใช้จ่ายจากเหตุการณ์'}
                    </small>
                    <strong>
                      {money.format(game.lastResolution.grossCost)} บาท
                    </strong>
                  </div>
                  {!resolvedUsesLumpSum ? (
                    <div className={styles.numberBox}>
                      <small>สิทธิ/สวัสดิการช่วย</small>
                      <strong>
                        {money.format(game.lastResolution.existingBenefit ?? 0)} บาท
                      </strong>
                    </div>
                  ) : null}
                  <div className={styles.numberBox}>
                    <small>
                      {resolvedUsesLumpSum
                        ? 'เงินก้อนจากความคุ้มครอง'
                        : 'ความคุ้มครองช่วย'}
                    </small>
                    <strong>
                      {money.format(game.lastResolution.protectionBenefit ?? 0)} บาท
                    </strong>
                  </div>
                  <div className={styles.numberBox}>
                    <small>
                      {resolvedUsesLumpSum
                        ? 'ภาระที่ยังต้องรับเอง'
                        : 'เงินที่ต้องจ่ายเอง'}
                    </small>
                    <strong>
                      {money.format(game.lastResolution.outOfPocket ?? 0)} บาท
                    </strong>
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
                    ? 'ดูผล 12 เดือน'
                    : 'ไปเดือนถัดไป'}
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <aside className={styles.side + ' ' + styles.sideRight}>
          <div className={styles.sidebarSection}>
            <Meter
              label="เงินพร้อมรับมือ"
              value={bars.liquidity}
              status={bars.liquidityLabel}
              detail={
                <>
                  <span>เงินสดพร้อมใช้ {money.format(Math.max(0, game.cash))} บาท</span>
                  <small>
                    พอร์ตลงทุน {money.format(game.investments)} บาท ไม่รวมในบาร์นี้
                  </small>
                </>
              }
            />
          </div>

          <div className={styles.sidebarSection}>
            <Meter
              label="ความคล่องตัว"
              value={bars.flexibility}
              status={bars.flexibilityLabel}
              detail={
                <>
                  <span>
                    เหลือหลังภาระประจำ{' '}
                    {money.format(bars.projectedMonthlyFlexibility)} บาท/เดือน
                  </span>
                  <small>วัดจากรายได้เทียบกับภาระประจำของเดือนถัดไป</small>
                </>
              }
            />
          </div>

          <div className={styles.sidebarSection}>
            <div className={styles.goalJourney}>
              <div className={styles.goalJourneyHeader}>
                <strong>เส้นทางเป้าหมาย</strong>
                <span>{bars.goalLabel}</span>
              </div>
              <div className={styles.goalScore}>
                <strong>{Math.round(bars.goalProgressPercent)}%</strong>
                <span>
                  เงินสำหรับเป้าหมาย {money.format(bars.goalPosition)} บาท
                </span>
              </div>
              <div
                className={styles.goalJourneyTrack}
                role="progressbar"
                aria-label="ความคืบหน้าสู่หมุดหมายถัดไป"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(bars.goalSegmentProgress)}
              >
                <div
                  className={styles.goalJourneyFill}
                  style={{ width: bars.goalSegmentProgress + '%' }}
                />
              </div>
              <div className={styles.goalMilestoneLine}>
                <span>{bars.goalPreviousMilestonePercent}%</span>
                <strong>{bars.goalNextMilestonePercent}%</strong>
              </div>
              <p className={styles.goalNext}>
                หมุดหมายถัดไป {money.format(bars.goalNextMilestoneAmount)} บาท
                {' · '}อีก {money.format(bars.goalRemainingToNext)} บาท
              </p>
              <div className={styles.goalReserveNote}>
                <span>
                  กันเงินสำรอง 3 เดือน {money.format(bars.cashReserveTarget)} บาท
                </span>
                <small>
                  ตอนนี้กันได้ {money.format(bars.cashReserveAllocated)} บาท
                  {' · '}เงินสดส่วนเกินที่นับเข้าเป้าหมาย{' '}
                  {money.format(bars.cashAboveReserve)} บาท
                </small>
              </div>
              <small className={styles.goalFormula}>
                เป้าหมาย = พอร์ตลงทุน + เงินสดส่วนที่เกินเงินสำรอง − หนี้
                {' · '}100% คือเป้าหมายแรก ไม่ใช่จุดจบ
              </small>
            </div>
          </div>

          <div className={styles.sidebarSection + ' ' + styles.protections}>
            <div className={styles.sidebarHeading}>
              <h3>ความคุ้มครอง</h3>
            </div>
            <div className={styles.coverageList}>
              {protectionTypes.map((type) => {
                const holding = game.protections.find(
                  (protection) => protection.type === type,
                );
                const active = Boolean(
                  holding && holding.activeFromMonth <= game.currentMonth,
                );
                const pending = Boolean(
                  holding && holding.activeFromMonth > game.currentMonth,
                );
                const catalog = PROTECTION_CATALOG[type];

                if (!holding) {
                  return (
                    <div className={styles.coverageMissing} key={type}>
                      <span>{protectionIcons[type]} {catalog.label}</span>
                      <small>ยังไม่มี</small>
                    </div>
                  );
                }

                return (
                  <div className={styles.coverageItem} key={type}>
                    <div className={styles.coverageTitle}>
                      <span>{protectionIcons[type]} {catalog.label}</span>
                      <strong>{pending ? 'เริ่มเดือนหน้า' : active ? 'มีผลแล้ว' : 'รอเริ่ม'}</strong>
                    </div>
                    <small>
                      ช่วยตามกติกาเกมสูงสุด {money.format(catalog.maxBenefit)} บาท
                      {catalog.coverageRate < 1
                        ? ' · ' + percentLabel(catalog.coverageRate) + ' ของส่วนที่เข้าเกณฑ์'
                        : ''}
                    </small>
                    <small>
                      {holding.source === 'existing'
                        ? 'ความคุ้มครองที่มีอยู่แล้ว'
                        : 'เบี้ย ' + money.format(holding.monthlyPremium) + ' บาท/เดือน'}
                    </small>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
