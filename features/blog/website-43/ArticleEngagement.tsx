'use client';
import { usePublicCopy } from "@/components/ui/PublicCopyProvider";
import { BLOG_COPY_DEFAULTS } from "@/lib/content/blog-copy-defaults";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { isAnalyticsEnabled } from '@/lib/cookie-consent';
import styles from '@/features/blog/v5/ArticleWidgets.module.css';

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

export function ArticleEngagementProvider({ articleId, disabled = false, recordView = true, loadMetrics = true, children }: { articleId: string; disabled?: boolean; recordView?: boolean; loadMetrics?: boolean; children: ReactNode }) {
  const [metrics, setMetrics] = useState(empty);
  const [heartPending, setHeartPending] = useState(false);
  const viewEvent = useRef<string | null>(null);
  const viewSent = useRef(false);
  const heartInFlight = useRef(false);
  const appliedEvents = useRef(0);
  const heartConfirmed = useRef(false);
  const endpoint = `/api/article-engagement/${encodeURIComponent(articleId)}/`;
  const record = useCallback(async (type: Action, liked?: boolean) => {
    if (disabled || (type === 'view' && !recordView) || (type !== 'heart' && !isAnalyticsEnabled())) return false;
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
      if (type === 'heart') heartConfirmed.current = true;
      setMetrics(previous => ({
        ...next,
        views: previous.views === null ? next.views : next.views === null ? previous.views : Math.max(previous.views, next.views),
        shares: previous.shares === null ? next.shares : next.shares === null ? previous.shares : Math.max(previous.shares, next.shares),
        ...(type !== 'heart' && heartConfirmed.current ? { liked: previous.liked, hearts: previous.hearts } : {}),
      }));
      if (type === 'view') viewSent.current = true;
      return true;
    } catch { return false; }
    finally {
      clearTimeout(timeout);
      if (type === 'heart') { heartInFlight.current = false; setHeartPending(false); }
    }
  }, [disabled, endpoint, recordView]);

  useEffect(() => {
    if (disabled) return;
    const controller = new AbortController();
    const revision = appliedEvents.current;
    const timeout = loadMetrics ? setTimeout(() => controller.abort(), 6000) : undefined;
    if (loadMetrics) void fetch(endpoint, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      .then(async response => { if (response.ok) { const next = parseMetrics(await response.json()); if (next && !controller.signal.aborted && appliedEvents.current === revision) setMetrics(next); } })
      .catch(() => undefined).finally(() => clearTimeout(timeout));
    const countView = () => { if (recordView && isAnalyticsEnabled()) void record('view'); };
    countView();
    window.addEventListener('ccpun:consent', countView);
    return () => { controller.abort(); clearTimeout(timeout); window.removeEventListener('ccpun:consent', countView); };
  }, [disabled, endpoint, record, recordView, loadMetrics]);

  return <Engagement.Provider value={{ metrics, heartPending, record }}>{children}</Engagement.Provider>;
}

export function useArticleEngagement() { return useContext(Engagement); }

export function ArticleEngagementSummary({ readingMinutes }: { readingMinutes?: number }) {
  const copyText = usePublicCopy(BLOG_COPY_DEFAULTS);

  const { metrics } = useArticleEngagement();
  return <div className={styles.articleReadingTime}>
    {readingMinutes !== undefined && <span className={styles.articleReadingEstimate}>{copyText.node("blog.articleReadingEstimate")}<b>{readingMinutes}</b>{" "}{copyText.node("blog.articleReadingEstimate2")}</span>}
    {metrics.shares !== null && <span title={copyText("blog.articleEngagementSummarytitle")} aria-label={copyText("blog.dynamic3").replaceAll("{0}", String(metrics.shares))}>{copyText.node("blog.span3")}<b>{metrics.shares}</b>{" "}{copyText.node("blog.span4")}</span>}
  </div>;
}
