import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { INVESTMENT_ALLOCATION_ENABLED } from "@/lib/runtime/investment-availability";
import { IS_REVIEW_ENVIRONMENT } from "@/lib/deployment-environment";
import V5Page from "@/components/layout/v5/V5Page";
import shell from "@/components/layout/v5/V5.module.css";
import { V5ToolHero, v5ToolStyles } from "@/components/layout/v5/V5ToolParts";
import motionStyles from "@/components/ui/FunctionalMotion.module.css";
import { V5_AIA_FUND_TOOL } from "@/components/layout/v5/constants";
import InvestmentAllocationTool from "./InvestmentAllocationTool";
import { INVESTMENT_NO_GUARANTEE_STATEMENT } from "./domain/copy";
import { EXCLUDE_AIA_FROM_MAIN_TOOL } from "./domain/fund-scope";

const URL = "https://ccpun.com/tools/investment-allocation/";
const DESCRIPTION = "เลือกกองทุนด้วยตัวเอง แล้วดูว่าเงินถูกนำไปลงทุนในอะไร ระดับความเสี่ยงเท่าไร และขายคืนแล้วรับเงินตามเงื่อนไขแบบไหน โดยไม่มีการจัดอันดับหรือเลือกกองแทนคุณ";

export const metadata: Metadata = {
  title: "เครื่องมือวางแผนกองทุน | เลือกกองเอง ดูข้อมูลจาก ก.ล.ต. | CCPun",
  description: DESCRIPTION,
  alternates: { canonical: URL, languages: { "th-TH": URL, "x-default": URL } },
  robots: !INVESTMENT_ALLOCATION_ENABLED || IS_REVIEW_ENVIRONMENT ? { index: false, follow: false } : { index: true, follow: true },
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

// Website v5 (FigCraft 14): same gate, metadata, schema and builders, inside the shared v5 shell.
// The tool stays out of navigation and sitemaps while its flag is off in Production; with the flag
// on (UAT) the v5 nav lists it under "เครื่องมือ" (D9) and `current` marks it.
export default function InvestmentAllocationPage() {
  if (!INVESTMENT_ALLOCATION_ENABLED) notFound();
  return (
    <V5Page current="/tools/investment-allocation/">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <V5ToolHero
        id="investment-hero-title"
        title={<>คุณเลือกกองเอง<br /><span>ระบบช่วยให้เห็นว่าเงินอยู่ตรงไหน</span></>}
        lead="เริ่มง่ายด้วยกองเดียว หรือจัดหลายกองเอง แล้วดูข้อมูลกองทุนจาก ก.ล.ต. ทั้งประเภทกอง ระดับความเสี่ยง สัดส่วนสินทรัพย์ และเงื่อนไขการรับเงิน โดยไม่มีการจัดอันดับหรือเลือกกองแทนคุณ"
        cta={{ href: "#investment-mode-title", label: "เริ่มเลือกวิธีลงทุน" }}
      />
      <div className={`${v5ToolStyles.calcScope} ${v5ToolStyles.iaScope} ${motionStyles.scope}`}>
        <InvestmentAllocationTool />
      </div>
      <section className={shell.sectionAlt} aria-labelledby="investment-scope-title">
        <div className={`${shell.inner} ${shell.narrow}`}>
          <h2 id="investment-scope-title" className={shell.h2}>เครื่องมือนี้ช่วยอธิบาย ไม่ได้ตัดสินใจแทน</h2>
          <p className={shell.lead}>ผลลัพธ์มาจากจำนวนเงินและกองทุนที่คุณเลือกเอง ระบบแสดงระดับความเสี่ยง สัดส่วนสินทรัพย์ และเงื่อนไขขายคืนแยกกัน โดยไม่ตัดสินว่ากองใดเหมาะกับคุณหรือควรซื้อขายกองไหน</p>
          <p className={shell.lead}>ถ้าข้อมูลบางส่วนยังไม่พร้อม ระบบจะแจ้งตรง ๆ และจะไม่เติมข้อมูลหรือเดาแทนข้อมูลจาก ก.ล.ต.</p>
          <p className={shell.lead}>{INVESTMENT_NO_GUARANTEE_STATEMENT}</p>
          {EXCLUDE_AIA_FROM_MAIN_TOOL ? (
            <p className={shell.lead}>กองทุนของ บลจ. เอไอเอ แยกไว้อีกเครื่องมือหนึ่ง <Link className={shell.textLink} href={V5_AIA_FUND_TOOL.href}>ดูเครื่องมือกองทุน บลจ. เอไอเอ</Link></p>
          ) : null}
        </div>
      </section>
    </V5Page>
  );
}
