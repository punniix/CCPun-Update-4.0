import type { ReactNode } from "react";
import shell from "./V5.module.css";
import styles from "./V5Tool.module.css";

/**
 * Text-first hero for v5 tool, legal and Investment pages (FigCraft 07-11, 14).
 * There is no hero image, so the server-rendered H1 is the LCP element.
 */
export function V5ToolHero({ id = "tool-hero-title", title, subtitle, lead, meta, cta, breadcrumbs }: {
  id?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  lead?: ReactNode;
  meta?: ReactNode;
  cta?: { href: string; label: ReactNode };
  breadcrumbs?: ReactNode;
}) {
  return (
    <section className={styles.hero} aria-labelledby={id}>
      <div className={shell.inner}>
        {breadcrumbs ? <div className={styles.heroBreadcrumbs}>{breadcrumbs}</div> : null}
        <div className={styles.heroGrid}>
          <div>
            <h1 id={id} className={styles.heroTitle}>{title}</h1>
            {subtitle ? <p className={styles.heroSubtitle}>{subtitle}</p> : null}
          </div>
          {lead || meta || cta ? <div className={styles.heroAside}>
            {lead ? <p className={styles.heroLead}>{lead}</p> : null}
            {meta ? <p className={styles.heroMeta}>{meta}</p> : null}
            {cta ? <div className={shell.buttonRow}><a className={shell.button} href={cta.href}>{cta.label}</a></div> : null}
          </div> : null}
        </div>
      </div>
    </section>
  );
}

/** Server-rendered FAQ; the matching FAQPage JSON-LD stays with each page's existing schema. */
export function V5Faq({ items }: { items: readonly { question: string; answer: string }[] }) {
  return (
    <div className={styles.faq}>
      {items.map((item, index) => (
        <details key={item.question} open={index === 0}>
          <summary>{item.question}</summary>
          <p>{item.answer}</p>
        </details>
      ))}
    </div>
  );
}

export function V5InfoCards({ items, numbered = false }: { items: readonly { title: ReactNode; body: ReactNode; key?: string }[]; numbered?: boolean }) {
  return (
    <div className={styles.infoGrid}>
      {items.map((item, index) => (
        <article className={styles.infoCard} key={item.key ?? index}>
          {numbered ? <span className={styles.infoNum}>{String(index + 1).padStart(2, "0")}</span> : null}
          <h3>{item.title}</h3>
          <p>{item.body}</p>
        </article>
      ))}
    </div>
  );
}

export { styles as v5ToolStyles };
