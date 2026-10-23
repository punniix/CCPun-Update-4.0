import { getPublicCopy } from "@/lib/content/public-copy";
import { publicCopyText, type PublicCopyValues } from "@/lib/content/public-copy-registry";
import Link from 'next/link';
import CookieSettingsButton from '@/components/layout/CookieSettingsButton';
import styles from '@/components/layout/website-43/Website43.module.css';
import { WEBSITE43_BASE as BASE, WEBSITE43_HOME as HOME } from '@/components/layout/website-43/constants';

function HomeBrand() {
  return (
    <span className={styles.brand} aria-label="CCPUN">
      <span className={styles.brandCc}>CC</span><span className={styles.brandPun}>PUN</span>
    </span>
  );
}

export async function HomeFooter({ warnings = false, copy }: { warnings?: boolean; copy?: PublicCopyValues }) {
  const text = publicCopyText(copy ?? await getPublicCopy("site"));
  return (
    <footer className={styles.footerWrap}>
      <div className={styles.inner}>
        <div className={styles.footerFull}>
          <div className={styles.footerTop}>
            <div>
              <HomeBrand />
            </div>
            <div className={styles.footerColumn}>
              <strong>{text("site.footer.explore")}</strong>
              <Link href={HOME}>{text("site.nav.home")}</Link>
              <Link href={`${BASE}/blog/`}>{text("site.nav.blog")}</Link>
              <Link href={`${BASE}/tools/financial-health-check/`}>{text("site.nav.tools")}</Link>
            </div>
            <div className={styles.footerColumn}>
              <strong>{text("site.nav.tools")}</strong>
              <Link href={`${BASE}/tools/financial-health-check/`}>{text("site.tools.fhc")}</Link>
              <Link href={`${BASE}/ci-planning/`}>{text("site.tools.ci")}</Link>
            </div>
            <div className={styles.footerColumn}>
              <strong>{text("site.footer.information")}</strong>
              <Link href={`${HOME}#about-ccpun`}>{text("site.footer.about")}</Link>
              <Link href={`${BASE}/privacy/`}>{text("site.footer.privacy")}</Link>
              <Link href={`${BASE}/cookie-policy/`}>{text("site.footer.cookies")}</Link>
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

export function HomeSectionHeading({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) {
  return <>
    {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
    <h2 className={styles.h2}>{title}</h2>
    {description ? <p className={styles.lead}>{description}</p> : null}
  </>;
}
