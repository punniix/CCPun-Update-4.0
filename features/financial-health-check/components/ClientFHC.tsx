import functionalMotion from '@/components/ui/FunctionalMotion.module.css';
import styles from '@/components/layout/website-43/Website43.module.css';
import { Website43Footer } from '@/components/layout/website-43/Website43Shared';
import Website43ToolHero from '@/components/layout/website-43/Website43ToolHero';
import FHCLandingIntro, { FHC_FAQS, FHCPlanningContext } from './FHCLandingIntro';
import LifeCoverageWizard from './LifeCoverageWizard';

export default function ClientFHC() {
  return (
    <div className={styles.root}>
      <main id="main-content" tabIndex={-1} className={functionalMotion.scope}>
        <Website43ToolHero
          image="/assets/website-43/fhc-hero.png"
          badge="Financial Health Check · โมดูลความคุ้มครองชีวิต"
          line1="ตรวจสุขภาพการเงิน"
          line2="เริ่มจากช่องว่างความคุ้มครอง"
          description="ประเมินภาระที่ครอบครัวยังต้องดูแล แล้วเทียบกับทุนประกันชีวิตและสินทรัพย์ที่พร้อมใช้ เพื่อเห็นจุดที่ควรทบทวนต่อในแผนการเงิน"
          ctaHref="#fhc-calculator"
          ctaLabel="เริ่มประเมิน"
          strongContrast
        />

        <FHCLandingIntro />

        <section id="fhc-calculator" aria-labelledby="fhc-calculator-heading" className={styles.calculatorSection}>
          <div className={styles.calculatorHeader}>
            <p className={styles.eyebrow}>เครื่องคำนวณทุนประกันชีวิต</p>
            <h2 id="fhc-calculator-heading">เริ่มจากภาระที่คนข้างหลังต้องดูแล</h2>
            <p>2 ขั้นตอน เพื่อเห็นภาระรวม เทียบกับทุนประกันชีวิตและสินทรัพย์ที่พร้อมใช้</p>
          </div>
          <div className={styles.calculatorStage}>
            <LifeCoverageWizard />
          </div>
        </section>

        <FHCPlanningContext />

        <section className={`${styles.sectionDeep} ${styles.sectionTopLarge} ${styles.sectionBottomLarge}`} aria-labelledby="fhc-faq-title">
          <div className={styles.inner}>
            <div className={`${styles.toolFaq} ${styles.toolFaqStandalone}`}>
              <p className={styles.eyebrow}>คำถามที่พบบ่อย</p>
              <h2 id="fhc-faq-title" className={styles.h2}>เรื่องที่ควรรู้ก่อนใช้ผลประเมิน</h2>
              <div className={styles.faqDetails}>
                {FHC_FAQS.map((faq) => (
                  <details key={faq.question}>
                    <summary>{faq.question}</summary>
                    <p>{faq.answer}</p>
                  </details>
                ))}
              </div>
            </div>
            <p className={styles.toolDisclaimer}>
              ผลลัพธ์เป็นประมาณการเบื้องต้นจากข้อมูลและสมมติฐานที่คุณกรอก ไม่ใช่คำแนะนำเฉพาะบุคคล และไม่ยืนยันว่าจำนวนเงินจะเพียงพอในทุกกรณี โปรดศึกษารายละเอียดความคุ้มครอง เงื่อนไข และข้อยกเว้นของกรมธรรม์ก่อนตัดสินใจทำประกันภัย และประกันไม่ใช่เงินฝาก
            </p>
          </div>
        </section>
      </main>
      <Website43Footer />
    </div>
  );
}
