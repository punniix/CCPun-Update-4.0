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


export function percentLabel(value: number) {
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

function decisionImpactText(option: EventOption) {
  const effect = option.effect;

  if (effect.incomeModifier) {
    const sign = effect.incomeModifier.percent >= 0 ? '+' : '-';
    const duration = effect.incomeModifier.throughEnd
      ? 'ต่อถึงสิ้นเกม'
      : 'นาน ' + (effect.incomeModifier.months ?? 1) + ' เดือน';
    return 'รายได้ ' + sign + percentLabel(effect.incomeModifier.percent) + ' ' + duration;
  }

  if (effect.debtPrincipalReduction) {
    return 'ลดเงินต้นเพิ่ม ' + money.format(effect.debtPrincipalReduction) + ' บาท';
  }

  if (effect.addProtection) {
    return 'เพิ่มความคุ้มครอง ' + PROTECTION_CATALOG[effect.addProtection].label;
  }

  if (effect.borrow) {
    return 'เพิ่มเงินกู้ ' + money.format(effect.borrow.principal) + ' บาท';
  }

  if (effect.investmentDelta) {
    return effect.investmentDelta > 0
      ? 'ย้ายเงินไปลงทุน ' + money.format(effect.investmentDelta) + ' บาท'
      : 'ลดเงินลงทุน ' + money.format(Math.abs(effect.investmentDelta)) + ' บาท';
  }

  if (effect.investmentPercent) {
    return 'พอร์ตเปลี่ยน ' +
      (effect.investmentPercent > 0 ? '+' : '-') +
      percentLabel(effect.investmentPercent);
  }

  if (effect.expenseModifier) {
    return 'ค่าใช้จ่ายเพิ่ม ' +
      money.format(effect.expenseModifier.amount) +
      ' บาท/เดือน นาน ' +
      effect.expenseModifier.months +
      ' เดือน';
  }

  if (effect.cashDelta) {
    return 'เงินสด ' +
      (effect.cashDelta > 0 ? '+' : '-') +
      money.format(Math.abs(effect.cashDelta)) +
      ' บาท';
  }

  return option.outcomeText;
}

export function MoneyStorySelection({ rootRef, selectedCharacterId, setSelectedCharacterId, start }: {
  rootRef: RefObject<HTMLDivElement | null>;
  selectedCharacterId: string | null;
  setSelectedCharacterId: (id: string) => void;
  start: (characterId?: string) => void;
}) {
  const selectedCharacter = selectedCharacterId
    ? MONEY_STORY_CHARACTERS.find((item) => item.id === selectedCharacterId)
    : null;

  return (
    <div className={styles.shell} ref={rootRef} tabIndex={-1}>
      <div className={styles.start}>
        <div className={styles.startIcon} aria-hidden="true">
          <WalletCards />
        </div>
        <h2>เลือกชีวิตที่อยากลอง แล้วอยู่กับมัน 12 เดือน</h2>
        <p>
          แต่ละชีวิตเริ่มต้นไม่เหมือนกัน ทั้งรายได้ เงินสด พอร์ต ภาระ
          และคนที่ต้องดูแล คุณเลือกเองได้ หรือให้เกมสุ่มให้ก็ได้
        </p>

        <div className={styles.characterPicker} aria-label="เลือกตัวละคร">
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
                  <strong>{profile.name}</strong>
                  <span>{profile.role}</span>
                  <em>{profile.archetype}</em>
                  <small>{profile.challenge}</small>
                </span>
                <span className={styles.characterPickMeta}>
                  <b>รายได้ {money.format(profile.baseIncome)}</b>
                  <b>ภาระ {money.format(profile.fixedExpenses)}</b>
                </span>
              </button>
            );
          })}
        </div>

        <p className={styles.mobileSwipeHint}>เลื่อนไปด้านข้างเพื่อดูชีวิตอื่น</p>

        {selectedCharacter ? (
          <div className={styles.selectedLifePreview}>
            <div className={styles.selectedLifeTop}>
              <CharacterPortrait
                id={selectedCharacter.id}
                className={styles.selectedLifeAvatar}
              />
              <div>
                <strong>
                  {selectedCharacter.name} · {selectedCharacter.role}
                </strong>
                <em>{selectedCharacter.archetype}</em>
              </div>
            </div>
            <p>{selectedCharacter.challenge}</p>
            <div className={styles.selectedLifeStats}>
              <span><small>เงินสดเริ่มต้น</small><b>{money.format(selectedCharacter.startingCash)}</b></span>
              <span><small>พอร์ตลงทุน</small><b>{money.format(selectedCharacter.startingInvestments)}</b></span>
              <span><small>ภาระประจำ</small><b>{money.format(selectedCharacter.fixedExpenses)}/ด.</b></span>
              <span><small>เป้าหมายแรก</small><b>{money.format(selectedCharacter.goal.targetNetPosition)}</b></span>
            </div>
          </div>
        ) : null}

        <div className={styles.startActions}>
          <button
            type="button"
            className={styles.primary}
            disabled={!selectedCharacterId}
            onClick={() => start(selectedCharacterId ?? undefined)}
          >
            เริ่มชีวิตที่เลือก
          </button>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => start()}
          >
            สุ่มให้ฉัน
          </button>
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
  share: () => void;
  shareStatus: string;
  onPyramidClick: () => void;
  onLineClick: () => void;
}) {
  const resultTitle =
    game.status === 'win'
      ? 'คุณพาชีวิตนี้ไปถึงเป้าหมาย'
      : game.status === 'survive'
        ? 'คุณผ่านครบ 12 เดือน'
        : 'รอบนี้ไปต่อไม่ไหว';

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
    .map((holding) => PROTECTION_CATALOG[holding.type].label);

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
      'เงินสำรองตอนจบอยู่ที่ ' +
        reserveMonths.toFixed(1) +
        ' เดือน จากเป้า 3 เดือน',
    );
  }
  if (bars.projectedMonthlyFlexibility < character.baseIncome * 0.15) {
    watchItems.push(
      'หลังภาระประจำ เหลือประมาณ ' +
        money.format(bars.projectedMonthlyFlexibility) +
        ' บาท/เดือน',
    );
  }
  if (endingDebt > startingDebt) {
    watchItems.push(
      'หนี้เพิ่มจาก ' +
        money.format(startingDebt) +
        ' เป็น ' +
        money.format(endingDebt) +
        ' บาท',
    );
  } else if (endingDebt > 0 && endingDebt >= startingDebt * 0.75) {
    watchItems.push(
      'หนี้ยังเหลือ ' + money.format(endingDebt) + ' บาท',
    );
  }
  if (bars.goalProgressPercent < 100) {
    watchItems.push(
      'เงินสำหรับเป้าหมายอยู่ที่ ' +
        Math.round(bars.goalProgressPercent) +
        '% ของเป้าแรก',
    );
  }

  const resultLead =
    game.status === 'lose'
      ? 'รอบนี้หยุดที่เดือน ' +
        game.currentMonth +
        ' เพราะเงินสดรับภาระที่เข้ามาต่อไม่ไหว'
      : 'จบรอบด้วยเงินสำรอง ' +
        reserveMonths.toFixed(1) +
        ' เดือน และเงินสำหรับเป้าหมาย ' +
        money.format(bars.goalPosition) +
        ' บาท';

  return (
    <div className={styles.shell} ref={rootRef} tabIndex={-1}>
      <div className={styles.result}>
        <div className={styles.resultHero}>
          <CharacterPortrait
            id={character.id}
            className={styles.resultPortrait}
          />
          <p className={styles.kicker}>ผลลัพธ์ · {character.name}</p>
          <h2>{resultTitle}</h2>
        </div>

        <div className={styles.resultSnapshot}>
          <h3>หลังรอบนี้ เงินอยู่ตรงไหน</h3>
          <p className={styles.resultLead}>{resultLead}</p>
          <div className={styles.resultNumbers}>
            <div className={styles.numberBox}>
              <small>เงินสำรอง</small>
              <strong>{reserveMonths.toFixed(1)} / 3 เดือน</strong>
              <span>
                {money.format(bars.cashReserveAllocated)} บาท
              </span>
            </div>
            <div className={styles.numberBox}>
              <small>เงินสำหรับเป้าหมาย</small>
              <strong>{money.format(bars.goalPosition)} บาท</strong>
              <span>
                {Math.round(bars.goalProgressPercent)}% ของเป้าแรก
              </span>
            </div>
            <div className={styles.numberBox}>
              <small>หนี้คงเหลือ</small>
              <strong>{money.format(endingDebt)} บาท</strong>
              <span>เริ่มต้น {money.format(startingDebt)} บาท</span>
            </div>
            <div className={styles.numberBox}>
              <small>ความคุ้มครอง</small>
              <strong>{endingProtectionCount} ประเภท</strong>
              <span>
                เริ่มต้น {startingProtectionCount}
                {purchasedProtections.length
                  ? ' · เพิ่ม ' + purchasedProtections.join(', ')
                  : ' · ไม่ได้เพิ่มระหว่างเกม'}
              </span>
            </div>
          </div>

          <div className={styles.resultCompare}>
            <span>
              เงินสำหรับเป้าหมายเริ่มต้น{' '}
              <strong>{money.format(startBars.goalPosition)}</strong>
            </span>
            <span aria-hidden="true">→</span>
            <span>
              ตอนจบ <strong>{money.format(bars.goalPosition)}</strong> บาท
            </span>
          </div>
        </div>

        <div className={styles.resultGrid}>
          <div className={styles.card}>
            <h3>จังหวะที่เปลี่ยนรอบนี้</h3>
            {importantDecisions.length ? (
              <ul className={styles.decisionList}>
                {importantDecisions.map((item) => (
                  <li key={String(item.month) + '-' + item.title + '-' + item.choice}>
                    <strong>เดือน {item.month} · {item.title}</strong>
                    <span>เลือก “{item.choice}”</span>
                    <small>{item.impact}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.emptyResultNote}>
                รอบนี้ยังไม่มีจังหวะที่ต้องเลือกหลายทางมากนัก
              </p>
            )}
          </div>

          <div className={styles.card}>
            <h3>ถ้าเล่นอีกรอบ</h3>
            {importantDecisions[0] && <p className={styles.emptyResultNote}>ลองทบทวนเดือน {importantDecisions[0].month} ที่เลือก “{importantDecisions[0].choice}” แล้วเปรียบเทียบวิธีอื่นในรอบถัดไป เหตุการณ์แต่ละรอบอาจต่างกัน</p>}
            {watchItems.length ? (
              <ul className={styles.watchList}>
                {watchItems.slice(0, 3).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className={styles.emptyResultNote}>
                เงินสำรองครบ 3 เดือน เป้าแรกถึงแล้ว และหนี้ไม่ได้เพิ่ม ลองดูว่ารอบหน้าจะรักษาฐานนี้ไว้ได้ไหม
              </p>
            )}
          </div>

          <div className={styles.card + ' ' + styles.resultWide}>
            <h3>เรื่องที่เกิดขึ้นช่วงท้าย</h3>
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
          {canUndo ? (
            <button type="button" className={styles.secondary} onClick={undo}>
              <Undo2 size={16} /> ย้อนกลับ
            </button>
          ) : null}
          <button type="button" className={styles.primary} onClick={replay}>
            <RefreshCcw size={16} /> เลือกชีวิตใหม่
          </button>
          <button type="button" className={styles.secondary} onClick={share}>
            แชร์ Money Story
          </button>
          <Link
            className={styles.secondary}
            href={MONEY_STORY_PYRAMID_URL}
            onClick={onPyramidClick}
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
          <h3>ถ้าอยากลองดูตัวเลขของชีวิตจริง</h3>
          <p>
            เอารายได้ ภาระ เงินสำรอง ความคุ้มครอง และเป้าหมายของคุณมาคุยกันได้
          </p>
          <a
            className={styles.primary}
            href={MONEY_STORY_LINE_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onLineClick}
          >
            เพิ่มเพื่อน LINE เพื่อคุยต่อ
          </a>
        </div>
      </div>
    </div>
  );
}
