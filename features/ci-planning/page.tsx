import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import ToolHero from "@/components/layout/ToolHero";
import CILandingIntro from "@/features/ci-planning/components/CILandingIntro";
import CIWizard from "@/features/ci-planning/components/CIWizard";
import { IS_REVIEW_ENVIRONMENT } from "@/lib/deployment-environment";

export const metadata: Metadata = {
  title: "วางแผนทุนโรคร้ายแรงจากรายได้และภาระ | CCPun",
  description: "วางแผนทุนโรคร้ายแรงด้วยเครื่องมือประเมินเบื้องต้น เปรียบเทียบรายได้หรือค่าใช้จ่ายกับเงินก้อนและสินทรัพย์สภาพคล่อง เพื่อเห็นส่วนต่างก่อนทบทวนความคุ้มครอง",
  keywords: ["วางแผนทุนโรคร้ายแรง", "คำนวณทุนโรคร้ายแรง", "ทุนประกันโรคร้ายแรง"],
  openGraph: {
    title: "วางแผนทุนโรคร้ายแรงจากรายได้และภาระ | CCPun",
    description: "วางแผนทุนโรคร้ายแรงด้วยเครื่องมือประเมินเบื้องต้น เปรียบเทียบรายได้หรือค่าใช้จ่ายกับเงินก้อนและสินทรัพย์สภาพคล่อง เพื่อเห็นส่วนต่างก่อนทบทวนความคุ้มครอง",
    url: "https://ccpun.com/ci-planning/",
    siteName: "CCPun Financial Advisor",
    images: [
      {
        url: "https://ccpun.com/og-image-20260610.webp?v=68ae8d8",
        width: 1200,
        height: 630,
        alt: "CCPun วางแผนทุนประกันโรคร้ายแรง",
      },
    ],
    locale: "th_TH",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "วางแผนทุนโรคร้ายแรงจากรายได้และภาระ | CCPun",
    description: "วางแผนทุนโรคร้ายแรงด้วยเครื่องมือประเมินเบื้องต้น เปรียบเทียบรายได้หรือค่าใช้จ่ายกับเงินก้อนและสินทรัพย์สภาพคล่อง เพื่อเห็นส่วนต่างก่อนทบทวนความคุ้มครอง",
    images: ["https://ccpun.com/og-image-20260610.webp?v=68ae8d8"],
  },
  robots: IS_REVIEW_ENVIRONMENT ? { index: false, follow: false } : { index: true, follow: true },
  alternates: {
    canonical: "https://ccpun.com/ci-planning/",
    languages: { "th-TH": "https://ccpun.com/ci-planning/", "x-default": "https://ccpun.com/ci-planning/" },
  },
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "หน้าหลัก", "item": "https://ccpun.com/" },
    { "@type": "ListItem", "position": 2, "name": "การวางแผนทุนโรคร้ายแรง", "item": "https://ccpun.com/ci-planning/" },
  ],
};

const ciPlanningSchema = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "การวางแผนทุนโรคร้ายแรง · Research Preview",
  url: "https://ccpun.com/ci-planning/",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  author: {
    "@type": "Organization",
    name: "CCPun Financial Advisor",
    url: "https://ccpun.com",
  },
  description: "เครื่องมือ Research Preview สำหรับเปรียบเทียบทุนตามรายได้หรือรายจ่าย กับเงินก้อนจากประกันโรคร้ายแรงและสินทรัพย์สภาพคล่องที่พร้อมใช้",
};

const CI_FAQS = [
  {
    question: "ได้เลขทุนแล้ว ต้องทำอย่างไรต่อ?",
    answer: "บันทึกภาพผลลัพธ์ไว้ แล้วทบทวนว่ารายได้ ค่าใช้จ่าย ระยะเวลาที่เลือก และทรัพยากรที่พร้อมใช้ตรงกับสถานการณ์จริงหรือไม่ หากต้องการคุยต่อ เพิ่มเพื่อน LINE @ccpun เพื่อทบทวนแผนประกันโรคร้ายแรงครับ",
  },
  {
    question: "ทุนตามรายได้กับทุนตามรายจ่ายต่างกันอย่างไร?",
    answer: "ทุนตามรายได้ดูจากรายได้ต่อเดือนและระยะเวลาที่เลือก ส่วนทุนตามรายจ่ายดูจากค่าใช้จ่ายครอบครัว ค่าเรียน ค่างวด และหนี้ที่เหลือ ระบบแสดงแยกกันและไม่นำมาบวกกัน",
  },
  {
    question: "สินทรัพย์สภาพคล่องควรกรอกอะไรบ้าง?",
    answer: "กรอกเฉพาะเงินสด เงินฝาก หรือสินทรัพย์ที่พร้อมเปลี่ยนเป็นเงินเพื่อนำมาใช้ได้จริง โดยไม่รวมบ้าน รถ หรือทรัพย์สินที่ครอบครัวยังจำเป็นต้องใช้",
  },
] as const;

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: CI_FAQS.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.answer,
    },
  })),
};

export default function CiPlanningPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ciPlanningSchema) }}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <Navbar isToolPage />
      <main id="main-content" tabIndex={-1} className="flex-1 pb-16">
        <ToolHero
          badge="เครื่องมือวางแผนทุนโรคร้ายแรง · Research Preview"
          title="เงินก้อนจากประกันโรคร้ายแรงที่มี "
          highlight="เพียงพอรับภาระจริงไหม?"
          highlightOnNewLine
          description="กรอกรายได้หรือภาระที่ยังต้องดูแล แล้วเทียบกับเงินก้อนจากประกันโรคร้ายแรงและสินทรัพย์สภาพคล่องที่พร้อมใช้"
        />
        <CILandingIntro />
        <section
          id="ci-calculator"
          aria-labelledby="ci-calculator-title"
          className="mx-auto max-w-3xl scroll-mt-28 px-4 pt-6"
        >
          <div className="mb-6 text-center">
            <p className="text-sm font-semibold text-primary">เครื่องคำนวณทุนโรคร้ายแรง</p>
            <h2 id="ci-calculator-title" className="mt-2 text-2xl font-bold text-foreground">
              เริ่มจากรายได้และภาระที่ยังต้องดูแล
            </h2>
          </div>
          <CIWizard />
        </section>

        <section aria-label="ข้อมูลประกอบการอ่านผลการวางแผนทุนโรคร้ายแรง" className="px-4 pt-14 md:pt-20">
          <div className="mx-auto max-w-5xl space-y-12 md:space-y-16">
            <aside
              aria-labelledby="ci-example-title"
              className="rounded-2xl border border-border/30 bg-card/40 p-5 md:p-8"
            >
              <p className="text-sm font-semibold text-primary">เลือกมุมที่อยากวางแผน</p>
              <h2 id="ci-example-title" className="mt-2 text-2xl font-bold text-foreground">
                เลือกดูประมาณการจากรายจ่ายหรือรายได้
              </h2>
              <dl className="mt-6 grid gap-6 md:grid-cols-2">
                <div className="border-l border-primary/40 pl-4">
                  <dt className="font-semibold text-foreground">ทุนตามรายจ่าย</dt>
                  <dd className="mt-2 text-base leading-relaxed text-muted-foreground">
                    ดูจากค่าใช้จ่าย ค่าเรียน ค่างวด และหนี้อื่นที่ยังต้องดูแลตามช่วงเวลาที่กรอก
                  </dd>
                </div>
                <div className="border-l border-border/50 pl-4">
                  <dt className="font-semibold text-foreground">ทุนตามรายได้</dt>
                  <dd className="mt-2 text-base leading-relaxed text-muted-foreground">
                    ดูจากรายได้ต่อเดือนและระยะเวลาที่ต้องการวางแผน เมื่อคุณเลือกกรอกรายได้
                  </dd>
                </div>
              </dl>
              <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
                เครื่องมือแสดงสองวิธีแยกกัน ไม่นำมาบวกกัน แล้วเทียบกับเงินก้อนจากประกันโรคร้ายแรงและสินทรัพย์สภาพคล่องที่พร้อมใช้
              </p>
            </aside>

            <section aria-labelledby="ci-faq-title">
              <h2 id="ci-faq-title" className="text-2xl font-bold text-foreground">
                คำถามที่พบบ่อย
              </h2>
              <div className="mt-6 divide-y divide-border/30 border-y border-border/30">
                {CI_FAQS.map((faq) => (
                  <details key={faq.question} className="group py-1">
                    <summary className="min-h-11 cursor-pointer py-3 text-base font-semibold leading-relaxed text-foreground focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                      {faq.question}
                    </summary>
                    <p className="pb-5 pr-2 text-base leading-relaxed text-muted-foreground">
                      {faq.answer}
                    </p>
                  </details>
                ))}
              </div>
            </section>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
