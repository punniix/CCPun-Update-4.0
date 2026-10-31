'use client';

import { useId, useState } from "react";
import { Eye, Heart } from "lucide-react";
import { usePublicCopy } from "@/components/ui/PublicCopyProvider";
import { BLOG_COPY_DEFAULTS } from "@/lib/content/blog-copy-defaults";
import { useArticleEngagement } from "@/features/blog/website-43/ArticleEngagement";
import { displayedHearts, displayedViews } from "./engagement-display";
import styles from "./V5Engagement.module.css";

/**
 * View count and heart beside the reading time under the article title. Uses the page's existing
 * ArticleEngagementProvider (its verified GET and server-confirmed record("heart")); no new events.
 * The box keeps a fixed size from the first render, so counts arriving later never move the page.
 */
export default function V5ArticleEngagementMeta() {
  const text = usePublicCopy(BLOG_COPY_DEFAULTS);
  const describedBy = useId();
  const { metrics, heartPending, record } = useArticleEngagement();
  const [error, setError] = useState(false);
  const views = metrics.available ? displayedViews(metrics.views) : null;
  const hearts = metrics.available ? displayedHearts(metrics.hearts) : null;
  const heartsUnknown = metrics.available && hearts === null;
  return (
    <span className={styles.articleMetrics}>
      <button type="button" className={styles.heart} disabled={heartPending} aria-pressed={metrics.liked} aria-describedby={hearts !== null || heartsUnknown ? describedBy : undefined}
        aria-label={metrics.liked ? text("blog.articleCardEngagementControlsText") : text("blog.articleCardEngagementControlsText2")}
        onClick={async () => { setError(false); if (!await record("heart", !metrics.liked)) setError(true); }}>
        <Heart aria-hidden="true" size={18} fill={metrics.liked ? "currentColor" : "none"} />
        <span className={styles.heartCount} aria-hidden="true" title={heartsUnknown ? "ยังไม่มีข้อมูลยอดหัวใจย้อนหลังที่ยืนยันได้" : undefined}>{hearts ?? (heartsUnknown ? "—" : "")}</span>
      </button>
      {(hearts !== null || heartsUnknown) && <span id={describedBy} className={styles.srOnly}>{heartsUnknown ? "ยังไม่มีข้อมูลยอดหัวใจย้อนหลังที่ยืนยันได้" : text("blog.engagement.hearts").replaceAll("{0}", hearts!)}</span>}
      <span className={styles.views} role={views ? "img" : undefined} aria-label={views ? text("blog.dynamic1").replaceAll("{0}", views) : undefined}>
        {views && <><Eye aria-hidden="true" size={16} /><span aria-hidden="true">{views}</span></>}
      </span>
      {error && <span className={styles.articleError} role="status">{text.node("blog.error")}</span>}
    </span>
  );
}
