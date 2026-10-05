import type { Metadata } from 'next';
import Link from 'next/link';
import { Website43Footer, Website43Navbar } from '@/components/layout/website-43/Website43Shared';
import { IS_REVIEW_ENVIRONMENT } from '@/lib/deployment-environment';
import MoneyStoryGame from './components/MoneyStoryGame';
import { MONEY_STORY_DISCLAIMER, MONEY_STORY_PYRAMID_URL } from './config';
import styles from './MoneyStory.module.css';

const DESCRIPTION =
  'เกมจำลองชีวิตการเงิน 12 เดือน สุ่มชีวิตสมมติแล้วลองตัดสินใจเรื่องเงินสด การลงทุน ความคุ้มครอง และการกู้ เมื่อชีวิตมีเรื่องไม่คาดคิดเข้ามา';

export const metadata: Metadata = {
  title: 'Money Story | เกมจำลองชีวิตการเงิน 12 เดือน | CCPun',
  description: DESCRIPTION,
  alternates: { canonical: 'https://ccpun.com/play/money-story/' },
  openGraph: {
    title: 'Money Story | CCPun',
    description: DESCRIPTION,
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
    <div className={styles.root}>
      <Website43Navbar />
      <main id="main-content" tabIndex={-1}>
        <section className={styles.hero}>
          <div className={styles.heroInner}>
            <p className={styles.kicker}>
              CCPun Play · เกมจำลองการเงินแบบโต้ตอบ
            </p>
            <h1 className={styles.title}>Money Story</h1>
            <p className={styles.subtitle}>
              เกมจำลองชีวิตการเงิน 12 เดือน คุณเลือกจุดเริ่มต้นไม่ได้
              แต่เลือกได้ว่าจะจัดการเงินอย่างไรเมื่อเรื่องไม่คาดคิดเข้ามา
            </p>
            <div className={styles.heroMeta}>
              <span className={styles.pill}>12 เดือน</span>
              <span className={styles.pill}>ชีวิตสมมติ</span>
              <span className={styles.pill}>เล่นซ้ำได้</span>
              <span className={styles.pill}>มือถือ · เมาส์ · คีย์บอร์ด</span>
            </div>
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
              พีระมิดในเกมเป็นเพียงภาพสรุปเล็กๆ ถ้าอยากเข้าใจแนวคิดเต็ม อ่านต่อที่{' '}
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
