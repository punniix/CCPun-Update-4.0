'use client';
import { useEffect, useState } from 'react';
import shared from '@/components/layout/website-43/Website43.module.css';
import styles from './HealthHappyCountdown.module.css';

const TARGET = Date.parse('2026-11-30T23:59:59+07:00');
const ARTICLE_URL = '/blog/health-insurance/aia-health-happy-describe/';
const LINE_URL = 'https://lin.ee/tqLCs4f';
type Placement = 'home' | 'blog' | 'article';
type TimeLeft = { days: number; hours: number; minutes: number; seconds: number };

function remaining(timestamp: number): TimeLeft {
  const secondsTotal = Math.max(0, Math.floor((TARGET - timestamp) / 1000));
  return {
    days: Math.floor(secondsTotal / 86400),
    hours: Math.floor((secondsTotal % 86400) / 3600),
    minutes: Math.floor((secondsTotal % 3600) / 60),
    seconds: secondsTotal % 60,
  };
}

export default function HealthHappyCountdown({ placement }: { placement: Placement }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const timer = window.setInterval(update, 1000);
    const onVisibilityChange = () => { if (document.visibilityState === 'visible') update(); };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);
  if (now !== null && now >= TARGET) return null;

  const left = now === null ? null : remaining(now);
  const values = [
    { label: 'DAYS', value: left?.days },
    { label: 'HOURS', value: left?.hours },
    { label: 'MINUTES', value: left?.minutes },
    { label: 'SECONDS', value: left?.seconds },
  ];
  return (
    <aside className={styles.outside} aria-label="แคมเปญ AIA Health Happy" data-campaign="aia-health-happy-2026" data-campaign-placement={placement}>
      <div className={styles.frame}>
        <div className={styles.info}>
          <div className={styles.brandLine}>
            <span className={styles.brandAia}>AIA</span>
            <strong className={styles.brandName}>HEALTH HAPPY</strong>
          </div>
          <p className={styles.headline}>นับถอยหลังปิดแผนประกันสุขภาพที่ดีที่สุดของ AIA</p>
          <p className={styles.date}>30 พฤศจิกายน <span>2569</span></p>
        </div>
        <div className={styles.timer} role="timer" aria-label="นับถอยหลังถึงวันที่ 30 พฤศจิกายน 2569 เวลา 23 นาฬิกา 59 นาที 59 วินาที เวลาประเทศไทย" aria-live="off">
          {values.map(({ label, value }, i) => (
            <div className={styles.timePart} key={label}>
              {i !== 0 && <span className={styles.colon} aria-hidden="true">:</span>}
              <span className={styles.timeUnit}>
                <strong className={styles.numeral}>{value === undefined ? '--' : String(value).padStart(2, '0')}</strong>
                <span className={styles.timeLabel}>{label}</span>
              </span>
            </div>
          ))}
        </div>
        <div className={styles.actions}>
          <a className={shared.primaryButton} href={LINE_URL} target="_blank" rel="noopener noreferrer" data-campaign-action="line" data-analytics-location="campaign">ปรึกษาผ่าน LINE OA</a>
          <a className={shared.outlineButton} href={placement === 'article' ? '#health-happy-details' : ARTICLE_URL} data-campaign-action={placement === 'article' ? 'read-details' : 'article'}>
            {placement === 'article' ? 'อ่านรายละเอียดด้านล่าง' : 'อ่านบทความ Health Happy'}
          </a>
        </div>
      </div>
    </aside>
  );
}
