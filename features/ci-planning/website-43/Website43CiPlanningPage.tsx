// Retained Website 4.3 CI planning presentation (rollback target, not routed). Website v5 Phase B
// renders /ci-planning/ through features/ci-planning/v5; metadata stays with features/ci-planning/page.tsx.

import { getPublicCopy } from '@/lib/content/public-copy';
import { publicCopyText, type PublicCopyValues } from '@/lib/content/public-copy-registry';
import functionalMotion from '@/components/ui/FunctionalMotion.module.css';
import styles from '@/components/layout/website-43/Website43.module.css';
import { Website43Footer } from '@/components/layout/website-43/Website43Shared';
import Website43ToolHero from '@/components/layout/website-43/Website43ToolHero';
import CILandingIntro from '@/features/ci-planning/components/CILandingIntro';
import CIWizard from '@/features/ci-planning/components/CIWizard';











export async function renderWebsite43CiPlanningPage(copyOverride?: PublicCopyValues, siteCopyOverride?: PublicCopyValues) {
  const t = publicCopyText(copyOverride ?? await getPublicCopy('ci'));

const CI_FAQS = [
  {
    question: t("ci.landing.question"),
    answer: t("ci.landing.answer"),
  },
  {
    question: t("ci.landing.question2"),
    answer: t("ci.landing.answer2"),
  },
  {
    question: t("ci.landing.question3"),
    answer: t("ci.landing.answer3"),
  },
] as const;

const faqSchema = {
  "@type": "FAQPage",
  '@context': 'https://schema.org',
  mainEntity: CI_FAQS.map((faq) => ({
    '@type': 'Question',
    name: faq.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: faq.answer,
    },
  })),
};

const ciPlanningSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: t("ci.landing.name3"),
  url: 'https://ccpun.com/ci-planning/',
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'Web',
  author: {
    '@type': 'Organization',
    name: 'CCPun Financial Advisor',
    url: 'https://ccpun.com',
  },
  description: t("ci.landing.description"),
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: t("ci.landing.name"), item: 'https://ccpun.com/' },
    { '@type': 'ListItem', position: 2, name: t("ci.landing.name2"), item: 'https://ccpun.com/ci-planning/' },
  ],
};

  return (
    <div className={styles.root}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ciPlanningSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <main className={functionalMotion.scope}>
        <Website43ToolHero
          image="/assets/website-43/ci-hero.png"
          badge={t("ci.landing.badge")}
          line1={t("ci.landing.line1Text")}
          line2={t("ci.landing.line2Text")}
          description={t("ci.landing.description2")}
          ctaHref="#ci-calculator"
          ctaLabel={t("ci.landing.ctaLabel")}
          strongContrast
        />

        <CILandingIntro />

        <section id="ci-calculator" aria-labelledby="ci-calculator-title" className={styles.calculatorSection}>
          <div className={styles.calculatorHeader}>
            <p className={styles.eyebrow}>{t.node("ci.landing.description3")}</p>
            <h2 id="ci-calculator-title">{t.node("ci.landing.calculatorTitle.heading")}<span className={styles.calculatorWord}>{t.node("ci.landing.label")}</span></h2>
            <p>{t.node("ci.landing.description4")}</p>
          </div>
          <div className={styles.calculatorStage}>
            <CIWizard />
          </div>
        </section>

        <section className={styles.toolStorySection} aria-labelledby="ci-reading-title">
          <div className={styles.inner}>
            <p className={styles.eyebrow}>{t.node("ci.landing.description5")}</p>
            <h2 id="ci-reading-title" className={styles.h2}>{t.node("ci.landing.readingTitle.heading")}</h2>
            <p className={styles.lead}>{t.node("ci.landing.description6")}</p>

            <div className={styles.toolMethodGrid}>
              <article className={styles.toolMethodItem}>
                <h3>{t.node("ci.landing.heading")}</h3>
                <p>{t.node("ci.landing.description7")}</p>
              </article>
              <article className={styles.toolMethodItem}>
                <h3>{t.node("ci.landing.heading2")}</h3>
                <p>{t.node("ci.landing.description8")}</p>
              </article>
            </div>
            <div className={styles.methodBox}>
              <div>
                <p className={styles.eyebrow}>{t.node("ci.landing.description9")}</p>
                <h3>{t.node("ci.landing.heading3")}</h3>
              </div>
              <p>
                {t.node("ci.landing.description10")}</p>
            </div>

            <div className={styles.toolFaq}>
              <p className={styles.eyebrow}>{t.node("ci.landing.description11")}</p>
              <h2 className={styles.h2}>{t.node("ci.landing.heading4")}</h2>
              <div className={styles.faqDetails}>
                {CI_FAQS.map((faq) => (
                  <details key={faq.question}>
                    <summary>{faq.question}</summary>
                    <p>{faq.answer}</p>
                  </details>
                ))}
              </div>
            </div>

            <p className={styles.toolDisclaimer}>
              {t.node("ci.landing.description12")}</p>

            <div className={styles.toolProjectRecognition}>
              <p className={styles.toolProjectRecognitionCopy}>{t.node("ci.landing.description13")}</p>
              <a
                className={styles.toolProjectRecognitionLink}
                href="https://www.toryod.co/projects/35d2877e-e97a-45ee-a6df-aefa5e09e2b3-ccpun-s-ci-planning"
                target="_blank"
                rel="noopener"
                aria-label={t("ci.landing.ariaLabel")}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- TorYod badge is a vendor-hosted SVG that must remain external. */}
                <img
                  src="https://www.toryod.co/badge/35d2877e-e97a-45ee-a6df-aefa5e09e2b3"
                  alt={t("ci.landing.alt")}
                  width="240"
                  height="54"
                  loading="lazy"
                  decoding="async"
                />
              </a>
            </div>
          </div>
        </section>
      </main>

      <Website43Footer copy={siteCopyOverride} />
    </div>
  );
}
