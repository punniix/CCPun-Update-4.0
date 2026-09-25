import type { Metadata } from "next";
import { IS_REVIEW_ENVIRONMENT } from "@/lib/deployment-environment";
import { Website43Footer, Website43Navbar } from "@/components/layout/website-43/Website43Shared";
import websiteStyles from "@/components/layout/website-43/Website43.module.css";
import motionStyles from "@/components/ui/FunctionalMotion.module.css";
import InvestmentAllocationTool from "./InvestmentAllocationTool";
import styles from "./InvestmentAllocation.module.css";

const URL = "https://ccpun.com/tools/investment-allocation/";
const DESCRIPTION = "เลือกกองทุนด้วยตัวเอง แล้วดูว่าเงินถูกนำไปลงทุนในอะไร ระดับความเสี่ยงเท่าไร และขายคืนแล้วรับเงินตามเงื่อนไขแบบไหน โดยไม่มีการจัดอันดับหรือเลือกกองแทนคุณ";

export const metadata: Metadata = {
  title: "เครื่องมือวางแผนกองทุน | เลือกกองเอง ดูข้อมูลจาก ก.ล.ต. | CCPun",
  description: DESCRIPTION,
  alternates: { canonical: URL, languages: { "th-TH": URL, "x-default": URL } },
  robots: IS_REVIEW_ENVIRONMENT ? { index: false, follow: false } : { index: true, follow: true },
  openGraph: { title: "CCPun เครื่องมือวางแผนกองทุน", description: DESCRIPTION, url: URL, siteName: "CCPun Financial Advisor", locale: "th_TH", type: "website" },
  twitter: { card: "summary", title: "CCPun เครื่องมือวางแผนกองทุน", description: DESCRIPTION },
};

const schema = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "CCPun เครื่องมือวางแผนกองทุน",
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
          <span className={styles.badge}>CCPun Investment</span>
          <h1>คุณเลือกกองเอง<br /><span>ระบบช่วยให้เห็นว่าเงินอยู่ตรงไหน</span></h1>
          <p className={styles.heroLead}>เริ่มง่ายด้วยกองเดียว หรือจัดหลายกองเอง แล้วดูข้อมูลกองทุนจาก ก.ล.ต. ทั้งประเภทกอง ระดับความเสี่ยง สัดส่วนสินทรัพย์ และเงื่อนไขการรับเงิน โดยไม่มีการจัดอันดับหรือเลือกกองแทนคุณ</p>
          <div className={styles.heroProof} aria-label="ขอบเขตของเครื่องมือ">
            <span>กองเดียวหรือหลายกอง</span><span>ข้อมูลจาก ก.ล.ต.</span><span>คุณเลือกกองเอง</span><span>ไม่มีการคาดการณ์ผลตอบแทน</span>
          </div>
          <a className={styles.heroAction} href="#investment-mode-title">เริ่มเลือกวิธีลงทุน</a>
        </div>
      </section>
      <InvestmentAllocationTool />
      <section className={styles.legalSection} aria-label="ขอบเขตข้อมูล">
        <div className={styles.legalInner}>
          <h2>เครื่องมือนี้ช่วยอธิบาย ไม่ได้ตัดสินใจแทน</h2>
          <p>ผลลัพธ์มาจากจำนวนเงินและกองทุนที่คุณเลือกเอง ระบบแสดงระดับความเสี่ยง สัดส่วนสินทรัพย์ และเงื่อนไขขายคืนแยกกัน โดยไม่ตัดสินว่ากองใดเหมาะกับคุณหรือควรซื้อขายกองไหน</p>
          <p>ถ้าข้อมูลบางส่วนยังไม่พร้อม ระบบจะแจ้งตรง ๆ และจะไม่เติมข้อมูลหรือเดาแทนข้อมูลจาก ก.ล.ต.</p>
        </div>
      </section>
      <Website43Footer warnings />
    </main>
  );
}
