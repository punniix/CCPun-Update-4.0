import type { Metadata } from 'next';
import styles from '@/components/layout/website-43/Website43.module.css';
import { Website43Footer } from '@/components/layout/website-43/Website43Shared';
import Website43ToolHero from '@/components/layout/website-43/Website43ToolHero';
import CILandingIntro from '@/features/ci-planning/components/CILandingIntro';
import CIWizard from '@/features/ci-planning/components/CIWizard';
import { IS_REVIEW_ENVIRONMENT } from '@/lib/deployment-environment';

export const metadata: Metadata = {
  title: 'วางแผนทุนโรคร้ายแรงจากรายได้และภาระ | CCPun',
  description: 'วางแผนทุนโรคร้ายแรงด้วยเครื่องมือประเมินเบื้องต้น เปรียบเทียบรายได้หรือค่าใช้จ่ายกับเงินก้อนและสินทรัพย์สภาพคล่อง เพื่อเห็นส่วนต่างก่อนทบทวนความคุ้มครอง',
  keywords: ['วางแผนทุนโรคร้ายแรง', 'คำนวณทุนโรคร้ายแรง', 'ทุนประกันโรคร้ายแรง'],
  openGraph: {
    title: 'วางแผนทุนโรคร้ายแรงจากรายได้และภาระ | CCPun',
    description: 'วางแผนทุนโรคร้ายแรงด้วยเครื่องมือประเมินเบื้องต้น เปรียบเทียบรายได้หรือค่าใช้จ่ายกับเงินก้อนและสินทรัพย์สภาพคล่อง เพื่อเห็นส่วนต่างก่อนทบทวนความคุ้มครอง',
    url: 'https://ccpun.com/ci-planning/',
    siteName: 'CCPun Financial Advisor',
    images: [
      {
        url: 'https://ccpun.com/og-image-20260610.webp?v=68ae8d8',
        width: 1200,
        height: 630,
        alt: 'CCPun วางแผนทุนประกันโรคร้ายแรง',
      },
    ],
    locale: 'th_TH',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'วางแผนทุนโรคร้ายแรงจากรายได้และภาระ | CCPun',
    description: 'วางแผนทุนโรคร้ายแรงด้วยเครื่องมือประเมินเบื้องต้น เปรียบเทียบรายได้หรือค่าใช้จ่ายกับเงินก้อนและสินทรัพย์สภาพคล่อง เพื่อเห็นส่วนต่างก่อนทบทวนความคุ้มครอง',
    images: ['https://ccpun.com/og-image-20260610.webp?v=68ae8d8'],
  },
  robots: IS_REVIEW_ENVIRONMENT ? { index: false, follow: false } : { index: true, follow: true },
  alternates: {
    canonical: 'https://ccpun.com/ci-planning/',
    languages: { 'th-TH': 'https://ccpun.com/ci-planning/', 'x-default': 'https://ccpun.com/ci-planning/' },
  },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'หน้าหลัก', item: 'https://ccpun.com/' },
    { '@type': 'ListItem', position: 2, name: 'การวางแผนทุนโรคร้ายแรง', item: 'https://ccpun.com/ci-planning/' },
  ],
};

const ciPlanningSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'การวางแผนทุนโรคร้ายแรง · Research Preview',
  url: 'https://ccpun.com/ci-planning/',
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'Web',
  author: {
    '@type': 'Organization',
    name: 'CCPun Financial Advisor',
    url: 'https://ccpun.com',
  },
  description: 'เครื่องมือ Research Preview สำหรับเปรียบเทียบทุนตามรายได้หรือรายจ่าย กับเงินก้อนจากประกันโรคร้ายแรงและสินทรัพย์สภาพคล่องที่พร้อมใช้',
};

const CI_FAQS = [
  {
    question: 'ได้เลขทุนแล้ว ต้องทำอย่างไรต่อ?',
    answer: 'บันทึกภาพผลลัพธ์ไว้ แล้วทบทวนว่ารายได้ ค่าใช้จ่าย ระยะเวลาที่เลือก และทรัพยากรที่พร้อมใช้ตรงกับสถานการณ์จริงหรือไม่ หากต้องการคุยต่อ เพิ่มเพื่อน LINE @ccpun เพื่อทบทวนแผนประกันโรคร้ายแรงครับ',
  },
  {
    question: 'ทุนตามรายได้กับทุนตามรายจ่ายต่างกันอย่างไร?',
    answer: 'ทุนตามรายได้ดูจากรายได้ต่อเดือนและระยะเวลาที่เลือก ส่วนทุนตามรายจ่ายดูจากค่าใช้จ่ายครอบครัว ค่าเรียน ค่างวด และหนี้ที่เหลือ ระบบแสดงแยกกันและไม่นำมาบวกกัน',
  },
  {
    question: 'สินทรัพย์สภาพคล่องควรกรอกอะไรบ้าง?',
    answer: 'กรอกเฉพาะเงินสด เงินฝาก หรือสินทรัพย์ที่พร้อมเปลี่ยนเป็นเงินเพื่อนำมาใช้ได้จริง โดยไม่รวมบ้าน รถ หรือทรัพย์สินที่ครอบครัวยังจำเป็นต้องใช้',
  },
] as const;

const faqSchema = {
  '@context': 'https://schema.org',
  "@type": "FAQPage",
  mainEntity: CI_FAQS.map((faq) => ({
    '@type': 'Question',
    name: faq.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: faq.answer,
    },
  })),
};

export default function CiPlanningPage() {
  return (
    <div className={styles.root}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ciPlanningSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <main id="main-content" tabIndex={-1}>
        <Website43ToolHero
          image="/assets/website-43/ci-hero.png"
          badge="เครื่องมือวางแผนทุนโรคร้ายแรง · Research Preview"
          line1="เงินก้อนจากประกันโรคร้ายแรงที่มี "
          line2="เพียงพอรับภาระจริงไหม?"
          description="กรอกรายได้หรือภาระที่ยังต้องดูแล แล้วเทียบกับเงินก้อนจากประกันโรคร้ายแรงและสินทรัพย์สภาพคล่องที่พร้อมใช้"
          ctaHref="#ci-calculator"
          ctaLabel="เริ่มประเมิน"
        />

        <CILandingIntro />

        <section id="ci-calculator" aria-labelledby="ci-calculator-title" className={styles.calculatorSection}>
          <div className={styles.calculatorHeader}>
            <p className={styles.eyebrow}>เครื่องคำนวณทุนโรคร้ายแรง</p>
            <h2 id="ci-calculator-title">2 ขั้นตอน เพื่อเห็นส่วนต่างที่ต้องเตรียม</h2>
            <p>เริ่มจากรายได้และภาระที่ยังต้องดูแล แล้วค่อยเทียบกับเงินก้อนและสินทรัพย์ที่พร้อมใช้</p>
          </div>
          <div className={styles.calculatorStage}>
            <CIWizard />
          </div>
        </section>

        <section className={styles.toolStorySection} aria-labelledby="ci-reading-title">
          <div className={styles.inner}>
            <p className={styles.eyebrow}>วิธีอ่านผล</p>
            <h2 id="ci-reading-title" className={styles.h2}>ผลลัพธ์มี 2 มุม เลือกอ่านแยกกัน</h2>
            <p className={styles.lead}>เครื่องมือแสดงสองวิธีแยกกัน ไม่นำมาบวกกัน แล้วเทียบกับเงินก้อนจากประกันโรคร้ายแรงและสินทรัพย์สภาพคล่องที่พร้อมใช้</p>

            <div className={styles.toolMethodGrid}>
              <article className={styles.toolMethodItem}>
                <h3>ทุนตามรายจ่าย</h3>
                <p>ดูจากค่าใช้จ่าย ค่าเรียน ค่างวด และหนี้อื่นที่ยังต้องดูแลตามช่วงเวลาที่กรอก</p>
              </article>
              <article className={styles.toolMethodItem}>
                <h3>ทุนตามรายได้</h3>
                <p>ดูจากรายได้ต่อเดือนและระยะเวลาที่ต้องการวางแผน เมื่อคุณเลือกกรอกรายได้</p>
              </article>
            </div>
            <div className={styles.methodBox}>
              <div>
                <p className={styles.eyebrow}>ทุนสำรองช่วงพักฟื้น · ข้อพิจารณาเพิ่มเติม</p>
                <h3>Recovery Reserve แยกให้เห็นที่มาและกรอกตามสถานการณ์จริง</h3>
              </div>
              <p>
                ในขั้นตอนแรก คุณสามารถเพิ่มจำนวนครั้งรักษา/ติดตาม วันที่ผู้ดูแลต้องหยุดงาน กายภาพ อุปกรณ์หรือปรับบ้าน และค่าใช้จ่ายอื่นได้ โดยระบบใช้ข้อมูลอ้างอิงปี 2025–2026 พร้อมแสดงแหล่งข้อมูล และไม่ใช้ก้อน 300,000 หรือ 1,000,000 บาทเป็นค่าเริ่มต้น
              </p>
            </div>

            <div className={styles.toolFaq}>
              <p className={styles.eyebrow}>คำถามที่พบบ่อย</p>
              <h2 className={styles.h2}>เรื่องที่ควรรู้ก่อนใช้ผลประเมิน</h2>
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
              ผลลัพธ์เป็นประมาณการเบื้องต้นจากข้อมูลและสมมติฐานที่คุณกรอก ไม่ใช่คำแนะนำเฉพาะบุคคล และไม่ยืนยันว่าจำนวนเงินจะเพียงพอในทุกกรณี โปรดศึกษารายละเอียดความคุ้มครอง เงื่อนไข และข้อยกเว้นของกรมธรรม์ก่อนตัดสินใจทำประกันภัย และประกันไม่ใช่เงินฝาก
            </p>
          </div>
        </section>
      </main>

      <Website43Footer />
    </div>
  );
}
