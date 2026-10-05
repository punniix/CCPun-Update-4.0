'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Car, HeartPulse, House, RefreshCcw, ShieldCheck, Users, WalletCards } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';
import { getMoneyStoryEvent } from '../events';
import {
  amortizedPayment,
  beginMonth,
  characterFor,
  completeMonth,
  coverShortfallWithInvestments,
  coverShortfallWithLoan,
  createGame,
  declareUnableToContinue,
  quoteShortfallLoan,
  resolveEventChoice,
  statusBars,
  totalDebt,
} from '../engine';
import {
  EVENT_CATEGORY_LABELS,
  MONEY_STORY_LINE_URL,
  MONEY_STORY_PYRAMID_URL,
  PROTECTION_CATALOG,
} from '../config';
import type { EventOption, GameState, ProtectionType } from '../types';
import styles from '../MoneyStory.module.css';

const money = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 });

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
  detail: string;
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
        <span>{detail}</span>
      </div>
    </div>
  );
}

function optionHint(option: EventOption) {
  if (option.effect.borrow) {
    const loan = option.effect.borrow;
    return (
      'ได้เงิน ' +
      money.format(loan.principal) +
      ' บาท · ค่างวดจำลองประมาณ ' +
      money.format(amortizedPayment(loan.principal, loan.monthlyRate, loan.termMonths)) +
      ' บาท/เดือน'
    );
  }

  if (option.effect.addProtection) {
    const protection = PROTECTION_CATALOG[option.effect.addProtection];
    return (
      'เบี้ยจำลอง ' +
      money.format(protection.monthlyPremium) +
      ' บาท/เดือน · เริ่มคุ้มครองเดือนถัดไป'
    );
  }

  if (option.effect.investmentDelta && option.effect.investmentDelta > 0) {
    return 'ย้ายเงินสด ' + money.format(option.effect.investmentDelta) + ' บาทไปลงทุน';
  }

  return option.description;
}

export default function MoneyStoryGame() {
  const [game, setGame] = useState<GameState | null>(null);
  const [shareStatus, setShareStatus] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  const character = game ? characterFor(game) : null;
  const bars = game ? statusBars(game) : null;
  const event = game?.currentEventId
    ? getMoneyStoryEvent(game.currentEventId)
    : undefined;
  const loanQuote = game?.pendingShortfall
    ? quoteShortfallLoan(game)
    : null;

  const focusGame = () => requestAnimationFrame(() => rootRef.current?.focus());

  const start = () => {
    const next = createGame();
    setGame(next);
    setShareStatus('');
    trackEvent('money_story_start');
    trackEvent('money_story_character_generated');
    focusGame();
  };

  const begin = () => {
    if (!game) return;
    const next = beginMonth(game);
    setGame(next);
    focusGame();

    if (
      next.currentEventId &&
      getMoneyStoryEvent(next.currentEventId)?.category === 'crisis'
    ) {
      trackEvent('money_story_crisis');
    }
  };

  const choose = (optionId: string) => {
    if (!game) return;

    const currentEvent = getMoneyStoryEvent(game.currentEventId ?? '');
    const option = currentEvent?.options.find((item) => item.id === optionId);
    const next = resolveEventChoice(game, optionId);

    setGame(next);
    focusGame();
    trackEvent('money_story_choice');

    if (option?.effect.borrow) trackEvent('money_story_borrow');
    if (option?.effect.investmentDelta || option?.effect.investmentPercent) {
      trackEvent('money_story_invest');
    }
    if (option?.effect.addProtection) {
      trackEvent('money_story_protection');
    }
  };

  const goNext = () => {
    if (!game) return;

    const previousMonth = game.currentMonth;
    const next = completeMonth(game);
    setGame(next);
    focusGame();
    trackEvent('money_story_month_complete', { step_number: previousMonth });

    if (next.status === 'win') trackEvent('money_story_win');
    if (next.status === 'survive') trackEvent('money_story_survive');
    if (next.status === 'lose') trackEvent('money_story_lose');
  };

  const replay = () => {
    trackEvent('money_story_replay');
    start();
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
      'Money Story: รอบนี้ผมสุ่มได้ชีวิตของ “' +
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
      trackEvent('money_story_share');
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
    return (
      <div className={styles.shell} ref={rootRef}>
        <div className={styles.start}>
          <div className={styles.startIcon} aria-hidden="true">
            <WalletCards />
          </div>
          <h2>สุ่มหนึ่งชีวิต แล้วลองอยู่กับมัน 12 เดือน</h2>
          <p>
            คุณไม่เลือกจุดเริ่มต้น แต่เลือกได้ว่าจะใช้ เก็บ ลงทุน
            เพิ่มความคุ้มครอง หรือกู้เมื่อชีวิตมีเรื่องเข้ามา
            เกมใช้ตัวละครและตัวเลขสมมติทั้งหมด
          </p>
          <button type="button" className={styles.primary} onClick={start}>
            สุ่มชีวิตของฉัน
          </button>
        </div>
      </div>
    );
  }

  if (!character || !bars) return null;

  if (game.status !== 'active') {
    const resultTitle =
      game.status === 'win'
        ? 'คุณพาชีวิตนี้ไปถึงเป้าหมาย'
        : game.status === 'survive'
          ? 'คุณผ่านครบ 12 เดือน'
          : 'รอบนี้ไปต่อไม่ไหว';

    return (
      <div className={styles.shell} ref={rootRef}>
        <div className={styles.result}>
          <div className={styles.resultHero}>
            <p className={styles.kicker}>ผลลัพธ์ · {character.name}</p>
            <h2>{resultTitle}</h2>
            <p>{game.outcomeReason}</p>
          </div>

          <div className={styles.resultGrid}>
            <div className={styles.card}>
              <h3>ปลายปีเหลืออะไรบ้าง</h3>
              <div className={styles.resultNumbers}>
                <div className={styles.numberBox}>
                  <small>เงินพร้อมใช้</small>
                  <strong>{money.format(Math.max(0, game.cash))} บาท</strong>
                </div>
                <div className={styles.numberBox}>
                  <small>เงินลงทุน</small>
                  <strong>{money.format(game.investments)} บาท</strong>
                </div>
                <div className={styles.numberBox}>
                  <small>หนี้คงเหลือ</small>
                  <strong>{money.format(totalDebt(game))} บาท</strong>
                </div>
                <div className={styles.numberBox}>
                  <small>ฐานเงินสุทธิในเกม</small>
                  <strong>{money.format(bars.netPosition)} บาท</strong>
                </div>
              </div>
            </div>

            <div className={styles.card}>
              <h3>เรื่องที่เกิดขึ้น</h3>
              <ul className={styles.timeline}>
                {game.history.slice(-5).map((item) => (
                  <li key={String(item.month) + '-' + item.eventId}>
                    <strong>เดือน {item.month}</strong>
                    <span>
                      {item.sensitive ? 'เหตุการณ์สำคัญ' : item.eventTitle}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className={styles.resultActions}>
            <button type="button" className={styles.primary} onClick={replay}>
              <RefreshCcw size={16} /> สุ่มชีวิตใหม่
            </button>
            <button type="button" className={styles.secondary} onClick={share}>
              แชร์ Money Story
            </button>
            <Link
              className={styles.secondary}
              href={MONEY_STORY_PYRAMID_URL}
              onClick={() => trackEvent('money_story_financial_pyramid_click')}
            >
              พีระมิดทางการเงินคืออะไร?
            </Link>
          </div>

          {shareStatus ? (
            <p className={styles.muted} style={{ textAlign: 'center' }}>
              {shareStatus}
            </p>
          ) : null}

          <div className={styles.lineCard}>
            <h3>เรื่องเงินจริงของคุณ เริ่มคุยกันได้</h3>
            <p>
              คุยเรื่องเงินเก็บ ภาระ ความคุ้มครอง หรือเป้าหมายของคุณกับ CCPun
            </p>
            <a
              className={styles.primary}
              href={MONEY_STORY_LINE_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackEvent('money_story_line_click')}
            >
              เพิ่มเพื่อน LINE เพื่อคุยต่อ
            </a>
          </div>
        </div>
      </div>
    );
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
            <div className={styles.characterBadge} aria-hidden="true">
              {character.name.slice(0, 1)}
            </div>
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
        </aside>

        <section className={styles.center} aria-live="polite">
          <div className={styles.monthTop}>
            <div>
              <div className={styles.monthNum}>
                เดือน {game.currentMonth} / 12
              </div>
              <div className={styles.seed}>
                รอบจำลอง {game.seed.slice(-6).toUpperCase()}
              </div>
            </div>
            <div className={styles.muted}>
              เงินสด {money.format(Math.max(0, game.cash))} · ลงทุน{' '}
              {money.format(game.investments)}
            </div>
          </div>

          {!game.monthStarted ? (
            <div className={styles.card}>
              <span className={styles.category}>เริ่มเดือนใหม่</span>
              <h2 className={styles.eventTitle}>
                รายได้จะเข้า แล้วภาระประจำจะเดินก่อน
              </h2>
              <p className={styles.eventText}>
                เกมจะหักค่าใช้ชีวิต ค่างวด และเบี้ยที่มีอยู่
                จากนั้นสุ่มเหตุการณ์ของเดือนนี้
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
              <span className={styles.category}>
                เงินไม่พอกับภาระที่ถึงกำหนด
              </span>
              <h2 className={styles.eventTitle}>
                ขาดอีก {money.format(game.pendingShortfall.amount)} บาท
              </h2>
              <p className={styles.eventText}>
                เกมยังไม่จบทันที คุณใช้เงินลงทุนหรือกู้เพื่อประคองรอบนี้ได้
                ถ้ายังมีทางเลือกที่รับไหว
              </p>

              <div className={styles.shortfallActions}>
                {canSellInvestments ? (
                  <button
                    type="button"
                    className={styles.secondary}
                    onClick={() =>
                      setGame(coverShortfallWithInvestments(game))
                    }
                  >
                    ขายเงินลงทุนเท่าที่ขาด
                  </button>
                ) : null}

                {loanQuote ? (
                  <>
                    <div className={styles.loanPreview}>
                      <strong>
                        ถ้ากู้ในเกม {money.format(loanQuote.principal)} บาท
                      </strong>
                      <br />
                      ค่างวดจำลองประมาณ{' '}
                      {money.format(loanQuote.monthlyPayment)} บาท/เดือน · 12
                      เดือน
                      <br />
                      เงินกู้ช่วยวันนี้ แต่ลดความคล่องตัวในเดือนต่อๆ ไป
                    </div>

                    <button
                      type="button"
                      className={styles.secondary}
                      disabled={!loanQuote.canBorrow}
                      onClick={() => {
                        setGame(coverShortfallWithLoan(game));
                        trackEvent('money_story_borrow');
                      }}
                    >
                      กู้เพื่อไปต่อ
                    </button>

                    {!loanQuote.canBorrow ? (
                      <p className={styles.muted}>{loanQuote.reason}</p>
                    ) : null}
                  </>
                ) : null}

                {!canSellInvestments && !loanQuote?.canBorrow ? (
                  <button
                    type="button"
                    className={styles.danger}
                    onClick={() => {
                      setGame(declareUnableToContinue(game));
                      trackEvent('money_story_lose');
                    }}
                  >
                    ยอมรับว่ารอบนี้ไปต่อไม่ไหว
                  </button>
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

              {event.sensitive ? (
                <div className={styles.sensitive}>
                  เหตุการณ์นี้ใช้โทนตรงไปตรงมาและไม่มีมุก
                  เพราะเกี่ยวกับผลกระทบที่อ่อนไหว
                </div>
              ) : null}

              {game.monthLedger ? (
                <div className={styles.ledger}>
                  <div>
                    <span>รายได้เดือนนี้</span>
                    <strong>+{money.format(game.monthLedger.income)}</strong>
                  </div>
                  <div>
                    <span>ค่าใช้ชีวิต</span>
                    <strong>
                      -{money.format(game.monthLedger.fixedExpenses)}
                    </strong>
                  </div>
                  <div>
                    <span>หนี้ที่จ่าย</span>
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

              <div className={styles.choices}>
                {event.options.slice(0, 3).map((option, index) => {
                  const hint = optionHint(option);

                  return (
                    <button
                      key={option.id}
                      data-money-choice
                      type="button"
                      className={styles.choice}
                      onClick={() => choose(option.id)}
                    >
                      <span className={styles.key}>{index + 1}</span>
                      <strong>{option.label}</strong>
                      {hint ? <span>{hint}</span> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {game.lastResolution &&
          !game.pendingShortfall &&
          !event ? (
            <div className={styles.card}>
              <span className={styles.category}>ผลของการตัดสินใจ</span>
              <h2 className={styles.eventTitle}>
                {game.lastResolution.summary}
              </h2>

              {game.lastResolution.grossCost !== undefined ? (
                <div className={styles.resultNumbers}>
                  <div className={styles.numberBox}>
                    <small>ผลกระทบทางการเงินรวม</small>
                    <strong>
                      {money.format(game.lastResolution.grossCost)} บาท
                    </strong>
                  </div>
                  <div className={styles.numberBox}>
                    <small>สิทธิ/สวัสดิการจำลองช่วย</small>
                    <strong>
                      {money.format(game.lastResolution.existingBenefit ?? 0)} บาท
                    </strong>
                  </div>
                  <div className={styles.numberBox}>
                    <small>ความคุ้มครองจำลองช่วย</small>
                    <strong>
                      {money.format(game.lastResolution.protectionBenefit ?? 0)} บาท
                    </strong>
                  </div>
                  <div className={styles.numberBox}>
                    <small>จ่ายเอง</small>
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
          <div className={styles.meters}>
            <Meter
              label="เงินพร้อมรับมือ"
              value={bars.liquidity}
              status={bars.liquidityLabel}
              detail={money.format(Math.max(0, game.cash)) + ' บาท'}
            />
            <Meter
              label="ความคล่องตัว"
              value={bars.flexibility}
              status={bars.flexibilityLabel}
              detail={
                money.format(bars.projectedMonthlyFlexibility) + ' บาท/เดือน'
              }
            />
            <Meter
              label="เป้าหมาย"
              value={bars.goal}
              status={bars.goalLabel}
              detail={money.format(bars.netPosition) + ' บาทสุทธิ'}
            />
          </div>

          <div className={styles.protections}>
            <h3>โล่ความคุ้มครองในเกม</h3>
            <div className={styles.shields}>
              {protectionTypes.map((type) => {
                const active = game.protections.some(
                  (protection) =>
                    protection.type === type &&
                    protection.activeFromMonth <= game.currentMonth,
                );
                const pending = game.protections.some(
                  (protection) =>
                    protection.type === type &&
                    protection.activeFromMonth > game.currentMonth,
                );

                return (
                  <span
                    key={type}
                    className={
                      styles.shield + (active ? ' ' + styles.shieldActive : '')
                    }
                  >
                    {protectionIcons[type]}
                    {PROTECTION_CATALOG[type].label}
                    {pending ? ' · เดือนหน้า' : ''}
                  </span>
                );
              })}
            </div>
          </div>

          <div className={styles.pyramid}>
            <h3>โครงสร้างการเงิน · กิมมิคสรุป</h3>
            <div
              className={styles.pyramidStack}
              aria-label="ภาพสรุปพีระมิดทางการเงิน"
            >
              <div
                className={styles.pyramidLayer}
                data-on={bars.goal >= 55}
              />
              <div
                className={styles.pyramidLayer}
                data-on={game.investments > 0}
              />
              <div
                className={styles.pyramidLayer}
                data-on={game.protections.length >= 2}
              />
              <div
                className={styles.pyramidLayer}
                data-on={bars.liquidity >= 35}
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
