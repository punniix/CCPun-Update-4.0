import { getPublicCopy } from "@/lib/content/public-copy";
import { publicCopyText, type PublicCopyValues } from "@/lib/content/public-copy-registry";
import Link from 'next/link';
import CookieSettingsButton from '@/components/layout/CookieSettingsButton';
import styles from './Website43.module.css';
import { WEBSITE43_BASE as BASE, WEBSITE43_HOME as HOME } from './constants';

export { Website43Navbar } from './Website43Navbar';

export function Website43Brand() {
  return (
    <span className={styles.brand} aria-label="CCPUN">
      <span className={styles.brandCc}>CC</span><span className={styles.brandPun}>PUN</span>
    </span>
  );
}

export async function Website43Footer({ warnings = false, notFound = false, flushBottom = false, copy }: { warnings?: boolean; notFound?: boolean; flushBottom?: boolean; copy?: PublicCopyValues }) {
  const text = publicCopyText(copy ?? await getPublicCopy("site"));
  return (
    <footer className={`${styles.footerWrap} ${notFound ? styles.notFoundFooterWrap : ''} ${flushBottom ? styles.footerFlushBottom : ''}`}>
      <div className={styles.inner}>
        <div className={styles.footerFull}>
          <div className={styles.footerTop}>
            <div>
              <Website43Brand />
            </div>
            <div className={styles.footerColumn}>
              <strong>{text.node("site.footer.explore")}</strong>
              <Link href={HOME}>{text.node("site.nav.home")}</Link>
              <Link href={`${BASE}/blog/`}>{text.node("site.nav.blog")}</Link>
              <Link href={`${BASE}/tools/financial-health-check/`}>{text.node("site.nav.tools")}</Link>
            </div>
            <div className={styles.footerColumn}>
              <strong>{text.node("site.nav.tools")}</strong>
              <Link href={`${BASE}/play/money-story/`}>{text.node("site.tools.moneyStory")}</Link>
              <Link href={`${BASE}/tools/financial-health-check/`}>{text.node("site.tools.fhc")}</Link>
              <Link href={`${BASE}/ci-planning/`}>{text.node("site.tools.ci")}</Link>
            </div>
            <div className={styles.footerColumn}>
              <strong>{text.node("site.footer.information")}</strong>
              <Link href={`${HOME}#about-ccpun`}>{text.node("site.footer.about")}</Link>
              <Link href={`${BASE}/privacy/`}>{text.node("site.footer.privacy")}</Link>
              <Link href={`${BASE}/cookie-policy/`}>{text.node("site.footer.cookies")}</Link>
              <CookieSettingsButton className={styles.footerCookieButton} />
            </div>
          </div>
          <div className={styles.footerRule} />
          <p className={styles.footerDisclaimer}>{text.node("site.footerDisclaimer")}</p>
          {warnings ? (
            <div className={styles.footerWarnings}>
              <p>{text.node("site.disclosure.investment")}</p>
              <p>{text.node("site.disclosure.pastPerformance")}</p>
              <p>{text.node("site.disclosure.insurance")}</p>
            </div>
          ) : null}
          <p className={styles.footerCopyright}>{text.node("site.footerCopyright")}</p>
        </div>
      </div>
    </footer>
  );
}

export function SectionHeading({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) {
  return <>
    {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
    <h2 className={styles.h2}>{title}</h2>
    {description ? <p className={styles.lead}>{description}</p> : null}
  </>;
}
