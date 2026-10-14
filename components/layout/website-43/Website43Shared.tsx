import Link from 'next/link';
import CookieSettingsButton from '@/components/layout/CookieSettingsButton';
import styles from './Website43.module.css';
import navigation from '@/lib/nav-config.json';
import { INVESTMENT_TOOL_LINK, WEBSITE43_BASE as BASE, WEBSITE43_HOME as HOME } from './constants';
import { INVESTMENT_ALLOCATION_ENABLED } from '@/lib/runtime/investment-availability';
import { Website43Navbar as ClientNavbar } from './Website43Navbar';

export function Website43Navbar(props: { overlay?: boolean; notFound?: boolean; responsiveOverlay?: boolean }) {
  return <ClientNavbar {...props} investmentEnabled={INVESTMENT_ALLOCATION_ENABLED} />;
}

export function Website43Brand() {
  return (
    <span className={styles.brand} aria-label="CCPUN">
      <span className={styles.brandCc}>CC</span><span className={styles.brandPun}>PUN</span>
    </span>
  );
}

export function Website43Footer({ warnings = false, notFound = false, flushBottom = false }: { warnings?: boolean; notFound?: boolean; flushBottom?: boolean }) {
  const toolLinks = [...navigation.tools, ...(INVESTMENT_ALLOCATION_ENABLED ? [INVESTMENT_TOOL_LINK] : [])];
  return (
    <footer className={`${styles.footerWrap} ${notFound ? styles.notFoundFooterWrap : ''} ${flushBottom ? styles.footerFlushBottom : ''}`}>
      <div className={styles.inner}>
        <div className={styles.footerFull}>
          <div className={styles.footerTop}>
            <div>
              <Website43Brand />
            </div>
            <div className={styles.footerColumn}>
              <strong>สำรวจ</strong>
              <Link href={HOME}>หน้าแรก</Link>
              <Link href={`${BASE}/blog`}>บทความ</Link>
              <Link href={`${BASE}/tools/financial-health-check`}>เครื่องมือ</Link>
            </div>
            <div className={styles.footerColumn}>
              <strong>เครื่องมือ</strong>
              {toolLinks.map(({ href, label }) => <Link key={href} href={`${BASE}${href.replace(/\/$/, '')}`}>{label}</Link>)}
            </div>
            <div className={styles.footerColumn}>
              <strong>ข้อมูล</strong>
              <Link href={`${HOME}#about-ccpun`}>เกี่ยวกับ Pun</Link>
              <Link href={`${BASE}/privacy`}>Privacy</Link>
              <Link href={`${BASE}/cookie-policy`}>Cookie</Link>
              <CookieSettingsButton className={styles.footerCookieButton} />
            </div>
          </div>
          <div className={styles.footerRule} />
          <p className={styles.footerDisclaimer}>ข้อมูลบนเว็บไซต์มีวัตถุประสงค์เพื่อให้ความรู้ทั่วไป ไม่ใช่คำแนะนำเฉพาะบุคคล</p>
          {warnings ? (
            <div className={styles.footerWarnings}>
              <p>คำเตือน: การลงทุนมีความเสี่ยง ผู้ลงทุนควรทำความเข้าใจลักษณะสินค้า เงื่อนไขผลตอบแทน และความเสี่ยงก่อนตัดสินใจลงทุน</p>
              <p>ผลการดำเนินงานในอดีต มิได้เป็นสิ่งยืนยันถึงผลการดำเนินงานในอนาคต</p>
              <p>ผลิตภัณฑ์ประกันไม่ใช่เงินฝาก ควรศึกษาความคุ้มครอง เงื่อนไข และข้อยกเว้นก่อนตัดสินใจ</p>
            </div>
          ) : null}
          <p className={styles.footerCopyright}>© 2026 CCPUN · ที่ปรึกษาทางการเงิน และผู้วางแผนการลงทุน</p>
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
