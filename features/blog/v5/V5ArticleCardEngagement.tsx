'use client';

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Eye, Heart } from "lucide-react";
import { usePublicCopy } from "@/components/ui/PublicCopyProvider";
import { BLOG_COPY_DEFAULTS } from "@/lib/content/blog-copy-defaults";
import { ArticleEngagementProvider, useArticleEngagement } from "@/features/blog/website-43/ArticleEngagement";
import { CARD_METRICS_BATCH_MAX, displayedHearts, displayedViews } from "./engagement-display";
import styles from "./V5Engagement.module.css";

type CardMetrics = { views: number | null; hearts: number | null };
type Batch = { metrics: Readonly<Record<string, CardMetrics>>; want: (articleId: string) => void };

const BATCH_DELAY_MS = 80;
const BatchContext = createContext<Batch>({ metrics: {}, want: () => undefined });

function count(value: unknown) {
  return value === null || (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) ? value : undefined;
}

/** Reads `{ items: { [id]: { views, hearts } } }`; anything malformed is dropped, never guessed. */
export function parseCardMetrics(value: unknown): Record<string, CardMetrics> {
  if (!value || typeof value !== "object" || (value as { available?: unknown }).available !== true) return {};
  const items = (value as { items?: unknown }).items;
  if (!items || typeof items !== "object" || Array.isArray(items)) return {};
  const result: Record<string, CardMetrics> = {};
  for (const [id, row] of Object.entries(items as Record<string, unknown>)) {
    if (!row || typeof row !== "object") continue;
    const views = count((row as CardMetrics).views);
    const hearts = count((row as CardMetrics).hearts);
    if (views !== undefined && hearts !== undefined) result[id] = { views, hearts };
  }
  return result;
}

/**
 * One batched, cookieless read for all cards on a list page (at most 24 IDs per request)
 * instead of one request per card. Failures stay quiet: the counts simply do not appear.
 */
export function V5CardMetricsProvider({ children }: { children: ReactNode }) {
  const [metrics, setMetrics] = useState<Record<string, CardMetrics>>({});
  const requested = useRef(new Set<string>());
  const pending = useRef(new Set<string>());
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const controllers = useRef(new Set<AbortController>());

  const flush = useCallback(() => {
    timer.current = undefined;
    const ids = [...pending.current];
    pending.current.clear();
    for (let start = 0; start < ids.length; start += CARD_METRICS_BATCH_MAX) {
      const chunk = ids.slice(start, start + CARD_METRICS_BATCH_MAX);
      const controller = new AbortController();
      controllers.current.add(controller);
      const timeout = setTimeout(() => controller.abort(), 6000);
      void fetch(`/api/article-engagement/?ids=${chunk.map(encodeURIComponent).join(",")}`, { credentials: "same-origin", cache: "no-store", signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) return;
          const next = parseCardMetrics(await response.json());
          if (!controller.signal.aborted && Object.keys(next).length) setMetrics((previous) => ({ ...previous, ...next }));
        })
        .catch(() => undefined)
        .finally(() => { clearTimeout(timeout); controllers.current.delete(controller); });
    }
  }, []);

  const want = useCallback((articleId: string) => {
    if (requested.current.has(articleId)) return;
    requested.current.add(articleId);
    pending.current.add(articleId);
    timer.current ??= setTimeout(flush, BATCH_DELAY_MS);
  }, [flush]);

  useEffect(() => {
    const active = controllers.current;
    return () => { clearTimeout(timer.current); for (const controller of active) controller.abort(); };
  }, []);

  const value = useMemo(() => ({ metrics, want }), [metrics, want]);
  return <BatchContext.Provider value={value}>{children}</BatchContext.Provider>;
}

function useCardMetrics(articleId: string) {
  const { metrics, want } = useContext(BatchContext);
  // Every card on the list registers once on mount; the provider folds them into <=24-ID reads
  // within one short window, so scrolling never adds a request per card.
  useEffect(() => { want(articleId); }, [articleId, want]);
  return metrics[articleId] ?? null;
}

function CardControls({ articleId, title }: { articleId: string; title: string }) {
  const text = usePublicCopy(BLOG_COPY_DEFAULTS);
  const describedBy = useId();
  const batch = useCardMetrics(articleId);
  const { metrics, heartPending, record } = useArticleEngagement();
  const [error, setError] = useState(false);
  // After an explicit heart the server-confirmed answer for this article wins over the list read.
  const confirmed = metrics.available;
  const views = displayedViews(confirmed && metrics.views !== null ? metrics.views : batch?.views);
  const hearts = displayedHearts(confirmed ? metrics.hearts : batch?.hearts);
  // The list read is cookieless, so `liked` is only known after this visitor's own heart action.
  // Hearts are set-not-toggle on the server, so a repeat "like" never double counts.
  const liked = confirmed && metrics.liked;
  return (
    <div className={styles.cardMetrics}>
      <span className={styles.views} role={views ? "img" : undefined} aria-label={views ? text("blog.dynamic1").replaceAll("{0}", views) : undefined}>
        {views && <><Eye aria-hidden="true" size={16} /><span aria-hidden="true">{views}</span></>}
      </span>
      <button type="button" className={styles.heart} disabled={heartPending} aria-pressed={liked} aria-describedby={hearts ? describedBy : undefined}
        aria-label={`${liked ? text("blog.articleCardEngagementControlsText") : text("blog.articleCardEngagementControlsText2")}: ${title}`}
        onClick={async () => { setError(false); if (!await record("heart", !liked)) setError(true); }}>
        <Heart aria-hidden="true" size={18} fill={liked ? "currentColor" : "none"} />
        <span className={styles.heartCount} aria-hidden="true">{hearts ?? ""}</span>
      </button>
      {hearts && <span id={describedBy} className={styles.srOnly}>{text("blog.engagement.hearts").replaceAll("{0}", hearts)}</span>}
      {error && <p className={styles.error} role="status">{text.node("blog.error")}</p>}
    </div>
  );
}

/** Heart + view count for one v5 card. Reuses the Website 4.3 heart write (server-confirmed, no view writes). */
export default function V5CardEngagement({ articleId, title }: { articleId: string; title: string }) {
  return (
    <ArticleEngagementProvider articleId={articleId} recordView={false} loadMetrics={false}>
      <CardControls articleId={articleId} title={title} />
    </ArticleEngagementProvider>
  );
}
