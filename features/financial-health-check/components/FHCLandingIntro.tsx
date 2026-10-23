'use client';
import { usePublicCopy } from '@/components/ui/PublicCopyProvider';
import { FHC_COPY_DEFAULTS } from '@/lib/content/tool-copy-defaults';


import Link from 'next/link';
import styles from '@/components/layout/website-43/Website43.module.css';





export default function FHCLandingIntro() {
  const t = usePublicCopy(FHC_COPY_DEFAULTS);

  return (
    <section aria-labelledby="fhc-intro-title" className={`${styles.toolStorySection} ${styles.fhcIntroCompact}`}>
      <div className={styles.inner}>
        <h2 id="fhc-intro-title" className={styles.h2}>
          {t.node("fhc.intro.introTitle.heading")}</h2>
        <div className={styles.storyCopy}>
          <p>
            {t.node("fhc.intro.description")}</p>
          <p>
            {t.node("fhc.intro.description2")}</p>
        </div>
      </div>
    </section>
  );
}

export function FHCPlanningContext({ pyramidHref }: { pyramidHref: string }) {
  const siteText = usePublicCopy();
  const t = usePublicCopy(FHC_COPY_DEFAULTS);

const truths = [
  [
    '01',
    t("fhc.intro.truths"),
    t("fhc.intro.truths2"),
  ],
  [
    '02',
    t("fhc.intro.truths3"),
    t("fhc.intro.truths4"),
  ],
  [
    '03',
    t("fhc.intro.truths5"),
    t("fhc.intro.truths6"),
  ],
] as const;

  return (
    <section aria-labelledby="fhc-context-title" className={`${styles.toolStorySection} ${styles.fhcContextSection}`}>
      <div className={styles.inner}>
        <p className={styles.eyebrow}>{t.node("fhc.intro.description3")}</p>
        <h2 id="fhc-context-title" className={styles.h2}>{t.node("fhc.intro.contextTitle.heading")}</h2>
        <div className={styles.truthGrid}>
          {truths.map(([number, title, description]) => (
            <article className={styles.truth} key={number}>
              <span className={styles.truthNum}>{number}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>

        <div className={styles.methodBox}>
          <div>
            <p className={styles.eyebrow}>{t.node("fhc.intro.description4")}</p>
            <h3>{t.node("fhc.intro.heading")}</h3>
          </div>
          <div>
            <p>
              {t.node("fhc.intro.description5")}</p>
            <p>
              {t.node("fhc.intro.description6")}</p>
            <p>
              {t.node("fhc.intro.description7")}{' '}
              <Link href={pyramidHref} className={styles.toolInlineLink}>{pyramidHref === "/blog/" ? siteText("site.nav.blog") : t("fhc.intro.label")}</Link>
              {' '}{t.node("fhc.intro.description8")}{' '}
              <Link href="/ci-planning/" className={styles.toolInlineLink}>{t.node("fhc.intro.label2")}</Link>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
