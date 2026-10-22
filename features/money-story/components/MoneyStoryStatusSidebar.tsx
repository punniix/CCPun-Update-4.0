'use client';
import { usePublicCopy } from "@/components/ui/PublicCopyProvider";
import { MONEY_STORY_COPY_DEFAULTS, moneyStoryLabel } from "@/lib/content/money-story-copy-defaults";
import { Car, HeartPulse, House, ShieldCheck, Users } from 'lucide-react';
import { PROTECTION_CATALOG } from '../config';
import type { statusBars } from '../engine';
import type { GameState, ProtectionType } from '../types';
import styles from '../MoneyStory.module.css';

export const money = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 });

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
  const text = usePublicCopy(MONEY_STORY_COPY_DEFAULTS);

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
        <span>{Math.round(value)}{text("moneyStory.span23")}</span>
        <div className={styles.meterDetail}>{detail}</div>
      </div>
    </div>
  );
}

export function percentLabel(value: number) {
  const percent = Math.abs(value * 100);
  return (Number.isInteger(percent) ? percent.toFixed(0) : percent.toFixed(1)) + '%';
}

type MoneyStoryStatusSidebarProps = {
  readonly game: GameState;
  readonly bars: ReturnType<typeof statusBars>;
};

// Presentation only. The controller owns decisions, focus, state and analytics.
export function MoneyStoryStatusSidebar({ game, bars }: MoneyStoryStatusSidebarProps) {
  const text = usePublicCopy(MONEY_STORY_COPY_DEFAULTS);
  const label = (value: string) => moneyStoryLabel(value, text);
  const protectionTypes: ProtectionType[] = [
    'health',
    'critical',
    'life',
    'motor',
    'home',
  ];

  return (
        <aside className={styles.side + ' ' + styles.sideRight}>
          <div className={styles.sidebarSection}>
            <Meter
              label={text("moneyStory.moneyStoryStatusSidebarlabel")}
              value={bars.liquidity}
              status={bars.liquidityLabel}
              detail={
                <>
                  <span>{text("moneyStory.span24")}{money.format(Math.max(0, game.cash))}{text("moneyStory.eventTitle3")}</span>
                  <small>{text("moneyStory.small10")}{money.format(game.investments)}{text("moneyStory.small11")}</small>
                </>
              }
            />
          </div>

          <div className={styles.sidebarSection}>
            <Meter
              label={text("moneyStory.moneyStoryStatusSidebarlabel2")}
              value={bars.flexibility}
              status={bars.flexibilityLabel}
              detail={
                <>
                  <span>{text("moneyStory.span25")}{' '}
                    {money.format(bars.projectedMonthlyFlexibility)}{text("moneyStory.span12")}</span>
                  <small>{text("moneyStory.small12")}</small>
                </>
              }
            />
          </div>

          <div className={styles.sidebarSection}>
            <div className={styles.goalJourney}>
              <div className={styles.goalJourneyHeader}>
                <strong>{text("moneyStory.strong11")}</strong>
                <span>{bars.goalLabel}</span>
              </div>
              <div className={styles.goalScore}>
                <strong>{Math.round(bars.goalProgressPercent)}%</strong>
                <span>{text("moneyStory.span26")}{money.format(bars.goalPosition)}{text("moneyStory.eventTitle3")}</span>
              </div>
              <div
                className={styles.goalJourneyTrack}
                role="progressbar"
                aria-label={text("moneyStory.moneyStoryStatusSidebararialabel")}
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
              <p className={styles.goalNext}>{text("moneyStory.goalNext")}{money.format(bars.goalNextMilestoneAmount)}{text("moneyStory.eventTitle3")}{' · '}{text("moneyStory.goalNext2")}{money.format(bars.goalRemainingToNext)}{text("moneyStory.eventTitle3")}</p>
              <div className={styles.goalReserveNote}>
                <span>{text("moneyStory.span27")}{money.format(bars.cashReserveTarget)}{text("moneyStory.eventTitle3")}</span>
                <small>{text("moneyStory.small13")}{money.format(bars.cashReserveAllocated)}{text("moneyStory.eventTitle3")}{' · '}{text("moneyStory.small14")}{' '}
                  {money.format(bars.cashAboveReserve)}{text("moneyStory.eventTitle3")}</small>
              </div>
              <small className={styles.goalFormula}>{text("moneyStory.goalFormula")}{' · '}{text("moneyStory.goalFormula2")}</small>
            </div>
          </div>

          <div className={styles.sidebarSection + ' ' + styles.protections}>
            <div className={styles.sidebarHeading}>
              <h3>{text("moneyStory.strong")}</h3>
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
                      <span>{protectionIcons[type]} {label(catalog.label)}</span>
                      <small>{text("moneyStory.small15")}</small>
                    </div>
                  );
                }

                return (
                  <div className={styles.coverageItem} key={type}>
                    <div className={styles.coverageTitle}>
                      <span>{protectionIcons[type]} {label(catalog.label)}</span>
                      <strong>{pending ? text("moneyStory.moneyStoryStatusSidebarText") : active ? text("moneyStory.moneyStoryStatusSidebarText2") : text("moneyStory.moneyStoryStatusSidebarText3")}</strong>
                    </div>
                    <small>{text("moneyStory.small16")}{money.format(catalog.maxBenefit)}{text("moneyStory.eventTitle3")}{catalog.coverageRate < 1
                        ? ' · ' + percentLabel(catalog.coverageRate) + text("moneyStory.moneyStoryStatusSidebarText4")
                        : ''}
                    </small>
                    <small>
                      {holding.source === 'existing'
                        ? text("moneyStory.moneyStoryStatusSidebarText5")
                        : text("moneyStory.optionImpactLinesText18") + money.format(holding.monthlyPremium) + text("moneyStory.moneyStoryResultText4")}
                    </small>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
  );
}
