'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { isAnalyticsEnabled } from '@/lib/cookie-consent';
import styles from '@/components/layout/website-43/Website43.module.css';

type Metrics = {
  views: number | null;
  shares: number | null;
  hearts: number | null;
  liked: boolean;
  available: boolean;
  activatedAt?: string | null;
};
type Action = 'view' | 'share' | 'heart';
const empty: Metrics = { views: null, shares: null, hearts: null, liked: false, available: false };
const Engagement = createContext<{ metrics: Metrics; heartPending: boolean; record: (type: Action, liked?: boolean) => Promise<boolean> }>({ metrics: empty, heartPending: false, record: async () => false });

function parseMetrics(value: unknown): Metrics | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (typeof row.available !== 'boolean' || typeof row.liked !== 'boolean') return null;
  for (const key of ['views', 'shares', 'hearts']) {
    if (row[key] !== null && (!Number.isSafeInteger(row[key]) || Number(row[key]) < 0)) return null;
  }
  return { views: row.views as number | null, shares: row.shares as number | null, hearts: row.hearts as number | null, liked: row.liked, available: row.available, activatedAt: typeof row.activatedAt === 'string' ? row.activatedAt : null };
}

export function ArticleEngagementProvider({ articleId, disabled = false, children }: { articleId: string; disabled?: boolean; children: ReactNode }) {
  const [metrics, setMetrics] = useState(empty);
  const [heartPending, setHeartPending] = useState(false);
  const viewEvent = useRef<string | null>(null);
  const viewSent = useRef(false);
  const heartInFlight = useRef(false);
  const appliedEvents = useRef(0);
  const endpoint = `/api/article-engagement/${encodeURIComponent(articleId)}/`;
  const record = useCallback(async (type: Action, liked?: boolean) => {
    if (disabled || (type !== 'heart' && !isAnalyticsEnabled())) return false;
    if (type === 'heart' && heartInFlight.current) return false;
    if (type === 'view' && viewSent.current) return true;
    if (type === 'view') viewEvent.current ??= crypto.randomUUID();
    if (type === 'heart') { heartInFlight.current = true; setHeartPending(true); }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    try {
      const payload = type === 'heart' ? { type, liked: liked === true } : { type, eventId: type === 'view' ? viewEvent.current : crypto.randomUUID(), analyticsConsent: true };
      const response = await fetch(endpoint, { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal });
      if (!response.ok) return false;
      const next = parseMetrics(await response.json());
      if (!next?.available) return false;
      appliedEvents.current += 1;
      setMetrics(next);
      if (type === 'view') viewSent.current = true;
      return true;
    } catch { return false; }
    finally {
      clearTimeout(timeout);
      if (type === 'heart') { heartInFlight.current = false; setHeartPending(false); }
    }
  }, [disabled, endpoint]);

  useEffect(() => {
    if (disabled) return;
    const controller = new AbortController();
    const revision = appliedEvents.current;
    const timeout = setTimeout(() => controller.abort(), 6000);
    void fetch(endpoint, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      .then(async response => { if (response.ok) { const next = parseMetrics(await response.json()); if (next && !controller.signal.aborted && appliedEvents.current === revision) setMetrics(next); } })
      .catch(() => undefined).finally(() => clearTimeout(timeout));
    const countView = () => { if (isAnalyticsEnabled()) void record('view'); };
    countView();
    window.addEventListener('ccpun:consent', countView);
    return () => { controller.abort(); clearTimeout(timeout); window.removeEventListener('ccpun:consent', countView); };
  }, [disabled, endpoint, record]);

  return <Engagement.Provider value={{ metrics, heartPending, record }}>{children}</Engagement.Provider>;
}

export function useArticleEngagement() { return useContext(Engagement); }

export function ArticleEngagementSummary({ readingMinutes }: { readingMinutes?: number }) {
  const { metrics } = useArticleEngagement();
  return <div className={styles.articleReadingTime}>
    {readingMinutes !== undefined && <span>อ่าน <b>{readingMinutes}</b> นาที</span>}
    {metrics.views !== null && <span title="ยอดที่บันทึกได้" aria-label={`การเปิดบทความที่บันทึกได้ ${metrics.views} ครั้ง`}>เปิดอ่าน <b>{metrics.views}</b> ครั้ง</span>}
    {metrics.shares !== null && <span title="ยอดที่บันทึกได้" aria-label={`การแชร์ที่บันทึกได้ ${metrics.shares} ครั้ง`}>แชร์ <b>{metrics.shares}</b> ครั้ง</span>}
  </div>;
}
