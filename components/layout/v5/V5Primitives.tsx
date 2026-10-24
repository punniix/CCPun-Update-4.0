import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./V5.module.css";
import { V5_LINE_URL } from "./constants";

export type V5Crumb = { href?: string; label: ReactNode };

/** Visible breadcrumbs; BreadcrumbList JSON-LD stays with the existing schema builders. */
export function V5Breadcrumbs({ items, label }: { items: V5Crumb[]; label: string }) {
  return (
    <nav className={styles.breadcrumbs} aria-label={label}>
      <ol>
        {items.map((item, index) => (
          <li key={index}>
            {item.href && index < items.length - 1
              ? <Link href={item.href}>{item.label}</Link>
              : <span aria-current={index === items.length - 1 ? "page" : undefined}>{item.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export type V5CardArticle = {
  id: string;
  href: string;
  title: string;
  topic: string;
  excerpt?: string;
  meta?: string;
  image?: { src: string; width: number; height: number };
};

/**
 * Article card: one real link (the title) whose ::after covers the card, so
 * every card contributes exactly one crawlable, descriptive anchor.
 */
export function V5ArticleCard({ article, headingLevel = 3, sizes = "(max-width: 639px) calc(100vw - 40px), (max-width: 1023px) 46vw, 400px", horizontal = false, showExcerpt = false, priority = false, extra, className }: {
  article: V5CardArticle;
  headingLevel?: 2 | 3;
  sizes?: string;
  horizontal?: boolean;
  showExcerpt?: boolean;
  priority?: boolean;
  extra?: ReactNode;
  className?: string;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <article className={`${styles.articleCard} ${horizontal ? styles.articleCardHorizontal : ""} ${className ?? ""}`}>
      {article.image
        ? <Image className={styles.articleCardImage} src={article.image.src} alt="" width={article.image.width} height={article.image.height} sizes={sizes} {...(priority ? { preload: true, loading: "eager" as const, fetchPriority: "high" as const } : { loading: "lazy" as const })} />
        : <span className={styles.articleCardImage} aria-hidden="true" />}
      <div className={styles.articleCardBody}>
        <span className={styles.articleCardTopic}>{article.topic}</span>
        <Heading className={styles.articleCardTitle}><Link href={article.href}>{article.title}</Link></Heading>
        {showExcerpt && article.excerpt ? <p className={styles.articleCardExcerpt}>{article.excerpt}</p> : null}
        {article.meta ? <p className={styles.articleCardMeta}>{article.meta}</p> : null}
        {extra}
      </div>
    </article>
  );
}

/**
 * Gold LINE band. `analyticsSection` reuses the existing click-listener contract:
 * "contact" maps to the approved `home_contact` location on the homepage; blog
 * pages fall back to the listener's existing `blog_article` location.
 */
export function V5ContactBand({ title, lead, cta, analyticsSection, analyticsLocation }: { title: ReactNode; lead?: ReactNode; cta: ReactNode; analyticsSection?: "contact"; analyticsLocation?: "blog_article" }) {
  return (
    <section className={styles.band} data-uat-section={analyticsSection}>
      <div className={styles.inner}>
        <h2 className={styles.h2}>{title}</h2>
        {lead ? <p className={styles.bandLead}>{lead}</p> : null}
        <div className={styles.buttonRow}>
          <a className={styles.buttonDark} href={V5_LINE_URL} target="_blank" rel="noopener noreferrer" data-analytics-surface={analyticsLocation ? "blog" : undefined} data-analytics-location={analyticsLocation}>{cta}</a>
        </div>
      </div>
    </section>
  );
}

export function V5SectionHeading({ eyebrow, title, description, id, as = "h2" }: { eyebrow?: ReactNode; title: ReactNode; description?: ReactNode; id?: string; as?: "h1" | "h2" }) {
  const Heading = as;
  return <>
    {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
    <Heading id={id} className={as === "h1" ? styles.h1 : styles.h2}>{title}</Heading>
    {description ? <p className={styles.lead}>{description}</p> : null}
  </>;
}
