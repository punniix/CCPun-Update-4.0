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

export function HomeFooter({ warnings = false }: { warnings?: boolean }) {
  return (
    <footer className={styles.footerWrap}>
      <div className={styles.inner}>
        {warnings ? (
          <div className={styles.footerWarnings}>
            <p>คำเตือน: การลงทุนมีความเสี่ยง ผู้ลงทุนควรทำความเข้าใจลักษณะสินค้า เงื่อนไขผลตอบแทน และความเสี่ยงก่อนตัดสินใจลงทุน</p>
            <p>ผลการดำเนินงานในอดีต มิได้เป็นสิ่งยืนยันถึงผลการดำเนินงานในอนาคต</p>
            <p>ผลิตภัณฑ์ประกันไม่ใช่เงินฝาก ควรศึกษาความคุ้มครอง เงื่อนไข และข้อยกเว้นก่อนตัดสินใจ</p>
          </div>
        ) : null}

        <div className={styles.footerFull}>
          <div className={styles.footerTop}>
            <div>
              <HomeBrand />
              <div className={styles.footerBrandText}>วางแผนการเงินจากชีวิตจริง<br />เพื่อให้คุณตัดสินใจได้อย่างมั่นใจ</div>
            </div>
            <div className={styles.footerColumn}>
              <strong>สำรวจ</strong>
              <Link href={HOME}>หน้าแรก</Link>
              <Link href={`${BASE}/blog`}>บทความ</Link>
              <Link href={`${BASE}/tools/financial-health-check`}>เครื่องมือ</Link>
            </div>
            <div className={styles.footerColumn}>
              <strong>เครื่องมือ</strong>
              <Link href={`${BASE}/tools/financial-health-check`}>Financial Health Check</Link>
              <Link href={`${BASE}/ci-planning`}>CI Planning</Link>
            </div>
            <div className={styles.footerColumn}>
              <strong>ข้อมูล</strong>
              <Link href={`${HOME}#about-ccpun`}>เกี่ยวกับ Pun</Link>
              <Link href={`${BASE}/privacy`}>Privacy</Link>
              <Link href={`${BASE}/cookie-policy`}>Cookie</Link>
            </div>
          </div>
          <div className={styles.footerRule} />
          <p className={styles.footerDisclaimer}>ข้อมูลบนเว็บไซต์มีวัตถุประสงค์เพื่อให้ความรู้ทั่วไป ไม่ใช่คำแนะนำเฉพาะบุคคล</p>
          <p className={styles.footerCopyright}>© 2026 CCPUN · ที่ปรึกษาทางการเงิน และผู้วางแผนการลงทุน</p>
        </div>

        <div className={styles.footerCompact}>
          {warnings ? <HomeBrand /> : <HomeBrand />}
          <p>วางแผนการเงินจากชีวิตจริง เพื่อให้คุณตัดสินใจได้อย่างมั่นใจ</p>
          <nav aria-label="เมนูส่วนท้าย">
            <Link href={HOME}>หน้าแรก</Link> · <Link href={`${BASE}/blog`}>บทความ</Link> · <Link href={`${BASE}/tools/financial-health-check`}>FHC</Link> · <Link href={`${BASE}/ci-planning`}>CI Planning</Link>
          </nav>
          <nav aria-label="นโยบาย">
            <Link href={`${BASE}/privacy`}>นโยบายความเป็นส่วนตัว</Link> · <Link href={`${BASE}/cookie-policy`}>นโยบายคุกกี้</Link>
          </nav>
          <p>ข้อมูลเพื่อความรู้ทั่วไป ไม่ใช่คำแนะนำเฉพาะบุคคล</p>
        </div>
        <CookieSettingsButton />
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
