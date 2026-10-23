'use client';
import { usePublicCopy } from "@/components/ui/PublicCopyProvider";
import { BLOG_COPY_DEFAULTS } from "@/lib/content/blog-copy-defaults";

import { useEffect, useRef, useState, type Ref } from 'react';
import { Eye, Heart } from 'lucide-react';
import { ArticleEngagementProvider, useArticleEngagement } from './ArticleEngagement';
import styles from './ArticleCardEngagement.module.css';

type CardMeta = { title: string; dateLabel: string; publishedAt: string };

export function ArticleCardEngagementControls({ title, dateLabel, publishedAt, metricsRef }: CardMeta & { metricsRef?: Ref<HTMLElement> }) {
  const copyText = usePublicCopy(BLOG_COPY_DEFAULTS);

  const { metrics, heartPending, record } = useArticleEngagement();
  const [error, setError] = useState(false);
  const knownViews = metrics.available && metrics.views !== null;
  const knownHearts = metrics.available && metrics.hearts !== null;
  return <footer ref={metricsRef} className={styles.footer}>
    <div className={styles.row}>
      {dateLabel && <time className={styles.date} dateTime={publishedAt}>{dateLabel}</time>}
      <div className={styles.metrics}>
        {knownViews && <span className={styles.views} aria-label={copyText("blog.dynamic1").replaceAll("{0}", String(metrics.views))}><Eye aria-hidden="true" size={17} /><span>{metrics.views}</span></span>}
        <button type="button" className={styles.heart} disabled={heartPending} aria-pressed={metrics.liked}
          aria-label={`${metrics.liked ? copyText("blog.articleCardEngagementControlsText") : copyText("blog.articleCardEngagementControlsText2")}: ${title}`}
          onClick={async () => { setError(false); if (!await record('heart', !metrics.liked)) setError(true); }}>
          <Heart aria-hidden="true" size={18} fill={metrics.liked ? 'currentColor' : 'none'} />{knownHearts && <span>{metrics.hearts}</span>}
        </button>
      </div>
    </div>
    {error && <p className={styles.error} role="status">{copyText.node("blog.error")}</p>}
  </footer>;
}

export default function ArticleCardEngagement({ articleId, ...meta }: CardMeta & { articleId: string }) {
  const metricsRef = useRef<HTMLElement>(null);
  const [loadMetrics, setLoadMetrics] = useState(() => typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    const target = metricsRef.current;
    if (!target || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.target === target && entry.isIntersecting)) {
        setLoadMetrics(true);
        observer.disconnect();
      }
    }, { rootMargin: '0px', threshold: 0 });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);
  return <ArticleEngagementProvider articleId={articleId} recordView={false} loadMetrics={loadMetrics}><ArticleCardEngagementControls {...meta} metricsRef={metricsRef} /></ArticleEngagementProvider>;
}
