import { getPublicCopy } from "@/lib/content/public-copy";
import { publicCopyText } from "@/lib/content/public-copy-registry";
import { INVESTMENT_ALLOCATION_ENABLED } from "@/lib/runtime/investment-availability";
import { INVESTMENT_TOOL_LINK } from "@/components/layout/website-43/constants";
import Link from 'next/link';
import CookieSettingsButton from '@/components/layout/CookieSettingsButton';
import styles from './Website43.module.css';
import { WEBSITE43_BASE as BASE, WEBSITE43_HOME as HOME } from './constants';

import { Website43Navbar as Navbar } from './Website43Navbar';
export function Website43Navbar(props: Omit<React.ComponentProps<typeof Navbar>, 'investmentEnabled'>) {
  return <Navbar {...props} investmentEnabled={INVESTMENT_ALLOCATION_ENABLED} />;
}

export function Website43Brand() {
  return (
    <span className={styles.brand} aria-label="CCPUN">
      <span className={styles.brandCc}>CC</span><span className={styles.brandPun}>PUN</span>
    </span>
  );
}

export async function Website43Footer({ warnings = false, notFound = false, flushBottom = false }: { warnings?: boolean; notFound?: boolean; flushBottom?: boolean }) {
  const text = publicCopyText(await getPublicCopy("site"));
  return (
    <footer className={`${styles.footerWrap} ${notFound ? styles.notFoundFooterWrap : ''} ${flushBottom ? styles.footerFlushBottom : ''}`}>
      <div className={styles.inner}>
        <div className={styles.footerFull}>
          <div className={styles.footerTop}>
            <div>
              <Website43Brand />
            </div>
            <div className={styles.footerColumn}>
              <strong>{text("site.footer.explore")}</strong>
              <Link href={HOME}>{text("site.nav.home")}</Link>
              <Link href={`${BASE}/blog`}>{text("site.nav.blog")}</Link>
              <Link href={`${BASE}/tools/financial-health-check`}>{text("site.nav.tools")}</Link>
            </div>
            <div className={styles.footerColumn}>
              <strong>{text("site.nav.tools")}</strong>
              <Link href={`${BASE}/play/money-story`}>{text("site.tools.moneyStory")}</Link>
              <Link href={`${BASE}/tools/financial-health-check`}>{text("site.tools.fhc")}</Link>
              <Link href={`${BASE}/ci-planning`}>{text("site.tools.ci")}</Link>
              {INVESTMENT_ALLOCATION_ENABLED ? <Link href={INVESTMENT_TOOL_LINK.href}>{text("site.tools.investment")}</Link> : null}
            </div>
            <div className={styles.footerColumn}>
              <strong>{text("site.footer.information")}</strong>
              <Link href={`${HOME}#about-ccpun`}>{text("site.footer.about")}</Link>
              <Link href={`${BASE}/privacy`}>{text("site.footer.privacy")}</Link>
              <Link href={`${BASE}/cookie-policy`}>{text("site.footer.cookies")}</Link>
              <CookieSettingsButton className={styles.footerCookieButton} />
            </div>
          </div>
          <div className={styles.footerRule} />
          <p className={styles.footerDisclaimer}>{text("site.footerDisclaimer")}</p>
          {warnings ? (
            <div className={styles.footerWarnings}>
              <p>{text("site.disclosure.investment")}</p>
              <p>{text("site.disclosure.pastPerformance")}</p>
              <p>{text("site.disclosure.insurance")}</p>
            </div>
          ) : null}
          <p className={styles.footerCopyright}>{text("site.footerCopyright")}</p>
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
