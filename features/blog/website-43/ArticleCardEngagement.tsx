'use client';

import { useState } from 'react';
import { Eye, Heart } from 'lucide-react';
import { ArticleEngagementProvider, useArticleEngagement } from './ArticleEngagement';
import styles from './ArticleCardEngagement.module.css';

type CardMeta = { title: string; dateLabel: string; publishedAt: string };

export function ArticleCardEngagementControls({ title, dateLabel, publishedAt }: CardMeta) {
  const { metrics, heartPending, record } = useArticleEngagement();
  const [error, setError] = useState(false);
  const knownViews = metrics.available && metrics.views !== null;
  const knownHearts = metrics.available && metrics.hearts !== null;
  return <footer className={styles.footer}>
    <div className={styles.row}>
      {dateLabel && <time className={styles.date} dateTime={publishedAt}>{dateLabel}</time>}
      <div className={styles.metrics}>
        {knownViews && <span className={styles.views} aria-label={`เปิดอ่านที่บันทึกได้ ${metrics.views} ครั้ง`}><Eye aria-hidden="true" size={17} /><span>{metrics.views}</span></span>}
        <button type="button" className={styles.heart} disabled={heartPending} aria-pressed={metrics.liked}
          aria-label={`${metrics.liked ? 'ยกเลิกถูกใจบทความ' : 'ถูกใจบทความ'}: ${title}`}
          onClick={async () => { setError(false); if (!await record('heart', !metrics.liked)) setError(true); }}>
          <Heart aria-hidden="true" size={18} fill={metrics.liked ? 'currentColor' : 'none'} />{knownHearts && <span>{metrics.hearts}</span>}
        </button>
      </div>
    </div>
    {error && <p className={styles.error} role="status">บันทึกถูกใจไม่สำเร็จ กรุณาลองอีกครั้ง</p>}
  </footer>;
}

export default function ArticleCardEngagement({ articleId, ...meta }: CardMeta & { articleId: string }) {
  return <ArticleEngagementProvider articleId={articleId} recordView={false}><ArticleCardEngagementControls {...meta} /></ArticleEngagementProvider>;
}
