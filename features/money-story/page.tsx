import { getPublicCopy } from "@/lib/content/public-copy";
import { publicCopyText, type PublicCopyValues } from "@/lib/content/public-copy-registry";
import { PublicCopyProvider } from "@/components/ui/PublicCopyProvider";
import type { Metadata } from 'next';
import Link from 'next/link';
import { Website43Footer, Website43Navbar } from '@/components/layout/website-43/Website43Shared';
import { IS_REVIEW_ENVIRONMENT } from '@/lib/deployment-environment';
import MoneyStoryGame from './components/MoneyStoryGame';
import { MONEY_STORY_PYRAMID_URL } from './config';
import styles from './MoneyStory.module.css';
import sharedStyles from '@/components/layout/website-43/Website43.module.css';


const DESCRIPTION =
  'เกมจำลองชีวิตการเงิน 12 เดือน เลือกหรือสุ่มชีวิตสมมติ แล้วลองตัดสินใจเรื่องเงินสด การลงทุน ความคุ้มครอง และการกู้ เมื่อชีวิตมีเรื่องไม่คาดคิดเข้ามา';

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

export async function renderMoneyStoryPage(copyOverride?: PublicCopyValues, siteCopyOverride?: PublicCopyValues) {
  const copy = copyOverride ?? await getPublicCopy("moneyStory");
  const text = publicCopyText(copy);
  const pyramidHref = MONEY_STORY_PYRAMID_URL;
  return (
    <div className={`${sharedStyles.root} ${styles.root}`}>
      <Website43Navbar />
      <main id="main-content" tabIndex={-1}>
        <section className={styles.hero} aria-labelledby="money-story-title">
          <div className={styles.heroInner}>
            <p className={styles.kicker}>{text.node("moneyStory.kicker")}</p>
            <h1 id="money-story-title" className={styles.title}>{text.node("moneyStory.title")}</h1>
            <p className={styles.subtitle}>{text.node("moneyStory.subtitle")}</p>
          </div>
        </section>

        <section className={styles.gameSection} aria-label={text("moneyStory.moneyStoryPagearialabel")}>
          <PublicCopyProvider values={copy}><MoneyStoryGame showSeed={IS_REVIEW_ENVIRONMENT} pyramidHref={pyramidHref} /></PublicCopyProvider>
        </section>

        <section
          className={styles.explain}
          aria-labelledby="money-story-about"
        >
          <div className={styles.explainInner}>
            <p className={styles.kicker}>{text.node("moneyStory.kicker2")}</p>
            <h2 id="money-story-about">{text.node("moneyStory.h2")}</h2>
            <div className={styles.explainGrid}>
              <div className={styles.explainCard}>
                <strong>{text.node("moneyStory.strong")}</strong>
                <p>{text.node("moneyStory.p")}</p>
              </div>
              <div className={styles.explainCard}>
                <strong>{text.node("moneyStory.strong2")}</strong>
                <p>{text.node("moneyStory.p2")}</p>
              </div>
              <div className={styles.explainCard}>
                <strong>{text.node("moneyStory.strong3")}</strong>
                <p>{text.node("moneyStory.p3")}</p>
              </div>
            </div>
            <p className={styles.disclaimer}>{text.node("moneyStory.disclaimer")}{' '}
              <Link href={pyramidHref}>{text.node("moneyStory.link")}</Link>
            </p>
            <p className={styles.disclaimer}>{text.node("moneyStory.config.label449")}</p>
          </div>
        </section>
      </main>
      <Website43Footer warnings copy={siteCopyOverride} />
    </div>
  );
}

export default function MoneyStoryPage() { return renderMoneyStoryPage(); }
