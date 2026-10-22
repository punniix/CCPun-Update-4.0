import { getFhcPyramidHref } from "../article-availability";
import { getPublicCopy } from '@/lib/content/public-copy';
import { publicCopyText, type PublicCopyValues } from '@/lib/content/public-copy-registry';
import { getFhcFaqs } from '@/lib/content/tool-copy-defaults';


import functionalMotion from '@/components/ui/FunctionalMotion.module.css';
import styles from '@/components/layout/website-43/Website43.module.css';
import { Website43Footer } from '@/components/layout/website-43/Website43Shared';
import Website43ToolHero from '@/components/layout/website-43/Website43ToolHero';
import FHCLandingIntro, { FHCPlanningContext } from './FHCLandingIntro';
import LifeCoverageWizard from './LifeCoverageWizard';

export default async function ClientFHC({ copy }: { copy?: PublicCopyValues } = {}) {
  const t = publicCopyText(copy ?? await getPublicCopy('fhc'));
  const pyramidHref = await getFhcPyramidHref();

  return (
    <div className={styles.root}>
      <main className={functionalMotion.scope}>
        <Website43ToolHero
          image="/assets/website-43/fhc-hero.png"
          badge={t("fhc.landing.badge")}
          line1={t("fhc.landing.line1Text")}
          line2={t("fhc.landing.line2Text")}
          description={t("fhc.landing.description")}
          ctaHref="#fhc-calculator"
          ctaLabel={t("fhc.landing.ctaLabel")}
          strongContrast
        />

        <FHCLandingIntro />

        <section id="fhc-calculator" aria-labelledby="fhc-calculator-heading" className={styles.calculatorSection}>
          <div className={styles.calculatorHeader}>
            <p className={styles.eyebrow}>{t("fhc.landing.description2")}</p>
            <h2 id="fhc-calculator-heading">{t("fhc.landing.calculatorHeading.heading")}</h2>
            <p>{t("fhc.landing.description3")}</p>
          </div>
          <div className={styles.calculatorStage}>
            <LifeCoverageWizard />
          </div>
        </section>

        <FHCPlanningContext pyramidHref={pyramidHref} />

        <section className={`${styles.sectionDeep} ${styles.sectionTopLarge} ${styles.sectionBottomLarge}`} aria-labelledby="fhc-faq-title">
          <div className={styles.inner}>
            <div className={`${styles.toolFaq} ${styles.toolFaqStandalone}`}>
              <p className={styles.eyebrow}>{t("fhc.landing.description4")}</p>
              <h2 id="fhc-faq-title" className={styles.h2}>{t("fhc.landing.faqTitle.heading")}</h2>
              <div className={styles.faqDetails}>
                {getFhcFaqs(t).map((faq) => (
                  <details key={faq.question}>
                    <summary>{faq.question}</summary>
                    <p>{faq.answer}</p>
                  </details>
                ))}
              </div>
            </div>
            <p className={styles.toolDisclaimer}>
              {t("fhc.landing.description5")}</p>
          </div>
        </section>
      </main>
      <Website43Footer />
    </div>
  );
}
