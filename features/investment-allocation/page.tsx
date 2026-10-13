import { getPageSeoPage } from "@/lib/content/page-seo-registry";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { INVESTMENT_ALLOCATION_ENABLED } from "@/lib/runtime/investment-availability";
import { IS_REVIEW_ENVIRONMENT } from "@/lib/deployment-environment";
import { Website43Footer, Website43Navbar } from "@/components/layout/website-43/Website43Shared";
import websiteStyles from "@/components/layout/website-43/Website43.module.css";
import motionStyles from "@/components/ui/FunctionalMotion.module.css";
import InvestmentAllocationTool from "./InvestmentAllocationTool";
import styles from "./InvestmentAllocation.module.css";

const PAGE_SEO_DEFAULTS = getPageSeoPage("/tools/investment-allocation/")!.defaults;

const URL = "https://ccpun.com/tools/investment-allocation/";
const DESCRIPTION = PAGE_SEO_DEFAULTS.seoDescription!;

export const metadata: Metadata = {
  title: PAGE_SEO_DEFAULTS.seoTitle!,
  description: PAGE_SEO_DEFAULTS.seoDescription!,
  alternates: { canonical: URL, languages: { "th-TH": URL, "x-default": URL } },
  robots: !INVESTMENT_ALLOCATION_ENABLED || IS_REVIEW_ENVIRONMENT ? { index: false, follow: false } : { index: true, follow: true },
  openGraph: { title: PAGE_SEO_DEFAULTS.ogTitle!, description: PAGE_SEO_DEFAULTS.ogDescription!, url: URL, siteName: "CCPun Financial Advisor", locale: "th_TH", type: "website" },
  twitter: { card: "summary", title: PAGE_SEO_DEFAULTS.ogTitle!, description: PAGE_SEO_DEFAULTS.ogDescription! },
};

const schema = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: PAGE_SEO_DEFAULTS.ogTitle!,
  url: URL,
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  description: DESCRIPTION,
  author: { "@type": "Organization", name: "CCPun Financial Advisor", url: "https://ccpun.com" },
};

export default function InvestmentAllocationPage() {
  if (!INVESTMENT_ALLOCATION_ENABLED) notFound();
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
