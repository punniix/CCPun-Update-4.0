import type { Metadata } from "next";
import { IS_REVIEW_ENVIRONMENT } from "@/lib/deployment-environment";
import { Website43Footer, Website43Navbar } from "@/components/layout/website-43/Website43Shared";
import websiteStyles from "@/components/layout/website-43/Website43.module.css";
import motionStyles from "@/components/ui/FunctionalMotion.module.css";
import InvestmentAllocationTool from "./InvestmentAllocationTool";
import styles from "./InvestmentAllocation.module.css";

const URL = "https://ccpun.com/tools/investment-allocation/";
const DESCRIPTION = "เครื่องมือช่วยมองภาพ Allocation จากกองทุนที่คุณเลือกเอง แยก Target กับ Effective Allocation, Risk Spectrum 1–8 และเงื่อนไขสภาพคล่อง โดยไม่จัดอันดับหรือเลือกกองทุนแทนคุณ";

export const metadata: Metadata = {
  title: "Investment Allocation Tool | ดูพอร์ตจากกองที่คุณเลือกเอง | CCPun",
  description: DESCRIPTION,
  alternates: { canonical: URL, languages: { "th-TH": URL, "x-default": URL } },
  robots: IS_REVIEW_ENVIRONMENT ? { index: false, follow: false } : { index: true, follow: true },
  openGraph: { title: "CCPun Investment Allocation Tool", description: DESCRIPTION, url: URL, siteName: "CCPun Financial Advisor", locale: "th_TH", type: "website" },
  twitter: { card: "summary", title: "CCPun Investment Allocation Tool", description: DESCRIPTION },
};

const schema = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "CCPun Investment Allocation Tool",
  url: URL,
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  description: DESCRIPTION,
  author: { "@type": "Organization", name: "CCPun Financial Advisor", url: "https://ccpun.com" },
};

export default function InvestmentAllocationPage() {
  return (
    <main className={`${websiteStyles.root} ${motionStyles.scope}`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <Website43Navbar />
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <span className={styles.badge}>CCPun Investment · UAT</span>
          <h1>คุณเลือกกองเอง<br /><span>ระบบช่วยให้เห็นว่าเงินอยู่ตรงไหน</span></h1>
          <p className={styles.heroLead}>เริ่มง่ายด้วยกองเดียว หรือเลือกโหมดจัดหลายกองเอง แล้วดูข้อมูลจาก SEC Fund Factsheet ทั้งประเภทกอง Risk Spectrum สัดส่วนสินทรัพย์ และเงื่อนไขการรับเงิน โดยไม่จัดอันดับหรือเลือกกองแทนคุณ</p>
          <div className={styles.heroProof} aria-label="ขอบเขตของเครื่องมือ">
            <span>กองเดียวหรือหลายกอง</span><span>SEC Fund Factsheet</span><span>No fund ranking</span><span>No expected return</span>
          </div>
          <a className={styles.heroAction} href="#investment-mode-title">เริ่มเลือกวิธีลงทุน</a>
        </div>
      </section>
      <InvestmentAllocationTool />
      <section className={styles.legalSection} aria-label="ขอบเขตข้อมูล">
        <div className={styles.legalInner}>
          <h2>เครื่องมือนี้ช่วยอธิบาย ไม่ได้ตัดสินใจแทน</h2>
          <p><strong>Phase 1</strong> แสดงผลจากสิ่งที่ผู้ใช้กรอกและกองที่ผู้ใช้เลือกเอง พร้อมสถานะข้อมูลที่รู้/ไม่รู้ ข้อมูล Risk และ Liquidity เป็น factual layer แยกจากกัน ไม่ใช่การประเมินความเหมาะสมเฉพาะบุคคลหรือคำแนะนำซื้อขาย</p>
          <p>UAT อาจใช้ข้อมูลสังเคราะห์ที่ติดป้ายชัดเจนเมื่อยังไม่มี SEC subscription key ใน Preview environment ข้อมูลดังกล่าวมีไว้ทดสอบ UX และ calculation เท่านั้น ไม่ใช่ข้อเท็จจริงของกองทุนจริง</p>
        </div>
      </section>
      <Website43Footer warnings />
    </main>
  );
}
