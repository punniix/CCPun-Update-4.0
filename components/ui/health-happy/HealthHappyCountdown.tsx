'use client';
import { usePublicCopy } from '@/components/ui/PublicCopyProvider';
import { useEffect, useRef, useState } from 'react';
import { preload } from 'react-dom';
import { trackEvent } from '@/lib/analytics';
import shared from '@/components/layout/website-43/Website43.module.css';
import countdownArtwork from '@/public/assets/blog-migration/aia-health-happy-describe/featured-01-AIA-Health-Happy-article.lossless.webp';
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
  const text = usePublicCopy();
  const [now, setNow] = useState<number | null>(null);
  const countdownRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const element = countdownRef.current;
    if (!element || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.5)) return;
      trackEvent('health_happy_countdown_view', {
        campaign_id: 'aia_health_happy_2026',
        campaign_placement: placement,
        surface_group: placement === 'home' ? 'homepage' : 'blog',
      });
      observer.disconnect(); // One view per mounted banner; no timer-driven analytics events.
    }, { threshold: 0.5 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [placement]);
  const recordClick = (action: 'line' | 'article' | 'read_details') => {
    trackEvent('health_happy_countdown_click', {
      campaign_id: 'aia_health_happy_2026',
      campaign_placement: placement,
      campaign_action: action,
      surface_group: placement === 'home' ? 'homepage' : 'blog',
    });
  };
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
  if (placement === 'blog') {
    preload(countdownArtwork.src, { as: 'image', fetchPriority: 'high' });
  }

  const left = now === null ? null : remaining(now);
  const values = [
    { id: "days", label: text("site.campaign.days"), value: left?.days },
    { id: "hours", label: text("site.campaign.hours"), value: left?.hours },
    { id: "minutes", label: text("site.campaign.minutes"), value: left?.minutes },
    { id: "seconds", label: text("site.campaign.seconds"), value: left?.seconds },
  ];
  return (
    <aside ref={countdownRef} className={styles.outside} aria-label={text("site.extra.healthHappyCountdownarialabel")} data-campaign="aia-health-happy-2026" data-campaign-placement={placement}>
      <div className={styles.frame}>
        <div className={styles.info}>
          <div className={styles.brandLine}>
            <span className={styles.brandAia}>{text("site.extra.brandAia")}</span>
            <strong className={styles.brandName}>{text("site.extra.brandName")}</strong>
          </div>
          <p className={styles.headline}>{text("site.extra.headline")}</p>
          <p className={styles.date}>{text("site.extra.date")}<span>{text("site.extra.span")}</span></p>
        </div>
        <div className={styles.timer} role="timer" aria-label={text("site.extra.healthHappyCountdownarialabel2")} aria-live="off">
          {values.map(({ id, label, value }, i) => (
            <div className={styles.timePart} key={id}>
              {i !== 0 && <span className={styles.colon} aria-hidden="true">:</span>}
              <span className={styles.timeUnit}>
                <strong className={styles.numeral}>{value === undefined ? '--' : String(value).padStart(2, '0')}</strong>
                <span className={styles.timeLabel}>{label}</span>
              </span>
            </div>
          ))}
        </div>
        <div className={styles.actions}>
          <a className={shared.primaryButton} href={LINE_URL} target="_blank" rel="noopener noreferrer" data-campaign-action="line" data-analytics-location="campaign" onClick={() => recordClick('line')}>{text("site.extra.a")}</a>
          <a className={shared.outlineButton} href={placement === 'article' ? '#health-happy-details' : ARTICLE_URL} data-campaign-action={placement === 'article' ? 'read-details' : 'article'} onClick={() => recordClick(placement === 'article' ? 'read_details' : 'article')}>
            {placement === 'article' ? text("site.extra.healthHappyCountdownText") : text("site.extra.healthHappyCountdownText2")}
          </a>
        </div>
      </div>
    </aside>
  );
}
