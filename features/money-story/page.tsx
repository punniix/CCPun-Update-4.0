import { getPageSeoPage } from "@/lib/content/page-seo-registry";
import type { Metadata } from 'next';
import Link from 'next/link';
import { Website43Footer, Website43Navbar } from '@/components/layout/website-43/Website43Shared';
import { IS_REVIEW_ENVIRONMENT } from '@/lib/deployment-environment';
import MoneyStoryGame from './components/MoneyStoryGame';
import { MONEY_STORY_DISCLAIMER, MONEY_STORY_PYRAMID_URL } from './config';
import styles from './MoneyStory.module.css';
import sharedStyles from '@/components/layout/website-43/Website43.module.css';

const PAGE_SEO_DEFAULTS = getPageSeoPage("/play/money-story/")!.defaults;

export const metadata: Metadata = {
  title: PAGE_SEO_DEFAULTS.seoTitle!,
  description: PAGE_SEO_DEFAULTS.seoDescription!,
  alternates: { canonical: 'https://ccpun.com/play/money-story/' },
  openGraph: {
    title: PAGE_SEO_DEFAULTS.ogTitle!,
    description: PAGE_SEO_DEFAULTS.ogDescription!,
    url: 'https://ccpun.com/play/money-story/',
    siteName: 'CCPun Financial Advisor',
    locale: 'th_TH',
    type: 'website',
  },
  robots: IS_REVIEW_ENVIRONMENT
    ? { index: false, follow: false, nocache: true }
    : { index: true, follow: true },
};

export default function MoneyStoryPage() {
  return (
    <div className={`${sharedStyles.root} ${styles.root}`}>
      <Website43Navbar />
      <main id="main-content" tabIndex={-1}>
        <section className={styles.hero} aria-labelledby="money-story-title">
          <div className={styles.heroInner}>
            <p className={styles.kicker}>
              CCPun Play · เกมจำลองการเงินแบบโต้ตอบ
            </p>
            <h1 id="money-story-title" className={styles.title}>Money Story</h1>
            <p className={styles.subtitle}>
              เกมจำลองชีวิตการเงิน 12 เดือน เลือกชีวิตที่อยากลอง
              แล้วตัดสินใจว่าจะจัดการเงินอย่างไรเมื่อเรื่องไม่คาดคิดเข้ามา
            </p>
          </div>
        </section>

        <section className={styles.gameSection} aria-label="เกม Money Story">
          <MoneyStoryGame showSeed={IS_REVIEW_ENVIRONMENT} />
        </section>

        <section
          className={styles.explain}
          aria-labelledby="money-story-about"
        >
          <div className={styles.explainInner}>
            <p className={styles.kicker}>เล่นก่อน แล้วค่อยเห็นภาพ</p>
            <h2 id="money-story-about">
              เงินแต่ละก้อนทำหน้าที่ไม่เหมือนกัน
            </h2>
            <div className={styles.explainGrid}>
              <div className={styles.explainCard}>
                <strong>ความคุ้มครอง</strong>
                <p>
                  มีต้นทุน แต่ช่วยลดแรงกระแทกจากเหตุที่ตรงกับความคุ้มครอง
                  ไม่ได้ทำให้ทุกเหตุการณ์หายไป
                </p>
              </div>
              <div className={styles.explainCard}>
                <strong>การลงทุน</strong>
                <p>
                  ช่วยให้เงินมีโอกาสเติบโต แต่มีขึ้นลง
                  และเงินที่ต้องรีบใช้ไม่ควรพึ่งผลลัพธ์เดียว
                </p>
              </div>
              <div className={styles.explainCard}>
                <strong>การกู้</strong>
                <p>
                  เพิ่มเงินในมือวันนี้ แต่ทำให้เดือนถัดไปมีค่างวดเพิ่ม
                  และเงินเหลือน้อยลง
                </p>
              </div>
            </div>
            <p className={styles.disclaimer}>
              ถ้าอยากเข้าใจหลักการวางฐานการเงินให้เป็นลำดับ อ่านต่อที่{' '}
              <Link href={MONEY_STORY_PYRAMID_URL}>พีระมิดทางการเงิน</Link>
            </p>
            <p className={styles.disclaimer}>{MONEY_STORY_DISCLAIMER}</p>
          </div>
        </section>
      </main>
      <Website43Footer warnings />
    </div>
  );
}
