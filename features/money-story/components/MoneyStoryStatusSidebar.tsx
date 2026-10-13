import { Car, HeartPulse, House, ShieldCheck, Users } from 'lucide-react';
import { PROTECTION_CATALOG } from '../config';
import type { statusBars } from '../engine';
import type { GameState, ProtectionType } from '../types';
import styles from '../MoneyStory.module.css';
import { percentLabel } from './MoneyStoryScreens';

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

type MoneyStoryStatusSidebarProps = {
  readonly game: GameState;
  readonly bars: ReturnType<typeof statusBars>;
};

// Presentation only. The controller owns decisions, focus, state and analytics.
export function MoneyStoryStatusSidebar({ game, bars }: MoneyStoryStatusSidebarProps) {
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
  );
}
