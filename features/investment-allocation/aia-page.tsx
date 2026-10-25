import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { INVESTMENT_ALLOCATION_ENABLED } from "@/lib/runtime/investment-availability";
import { IS_REVIEW_ENVIRONMENT } from "@/lib/deployment-environment";
import V5Page from "@/components/layout/v5/V5Page";
import shell from "@/components/layout/v5/V5.module.css";
import { V5ToolHero, v5ToolStyles } from "@/components/layout/v5/V5ToolParts";
import { V5Breadcrumbs } from "@/components/layout/v5/V5Primitives";
import { V5_AIA_FUND_TOOL, V5_INVESTMENT_TOOL, V5_TOOLS_HUB } from "@/components/layout/v5/constants";
import motionStyles from "@/components/ui/FunctionalMotion.module.css";
import InvestmentAllocationTool from "./InvestmentAllocationTool";
import { INVESTMENT_NO_GUARANTEE_STATEMENT } from "./domain/copy";

// บลจ. เอไอเอ fund tool (owner request 2026-10-26; slug and copy pending owner approval).
// Same engine, server flag, rate limit and robots rule as /tools/investment-allocation/;
// the server locks every catalog, search and detail request to the AIA AMC (scope "aia").
// Like the main tool it stays out of sitemaps and is noindex on UAT or while the flag is off.
const URL = "https://ccpun.com/tools/aia-fund-allocation/";
const TITLE = "เครื่องมือกองทุน บลจ. เอไอเอ | เลือกกองเอง ดูข้อมูลจาก ก.ล.ต. | CCPun";
const NAME = "CCPun เครื่องมือกองทุน บลจ. เอไอเอ";
const DESCRIPTION = "เลือกกองทุนรวมของ บลจ. เอไอเอ ด้วยตัวเอง แล้วดูว่าเงินถูกนำไปลงทุนในอะไร ระดับความเสี่ยงเท่าไร และขายคืนแล้วรับเงินตามเงื่อนไขแบบไหน โดยไม่มีการจัดอันดับหรือเลือกกองแทนคุณ";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL, languages: { "th-TH": URL, "x-default": URL } },
  robots: !INVESTMENT_ALLOCATION_ENABLED || IS_REVIEW_ENVIRONMENT ? { index: false, follow: false } : { index: true, follow: true },
  openGraph: { title: NAME, description: DESCRIPTION, url: URL, siteName: "CCPun Financial Advisor", locale: "th_TH", type: "website" },
  twitter: { card: "summary", title: NAME, description: DESCRIPTION },
};

const schema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      name: NAME,
      url: URL,
      applicationCategory: "FinanceApplication",
      operatingSystem: "Web",
      description: DESCRIPTION,
      author: { "@type": "Organization", name: "CCPun Financial Advisor", url: "https://ccpun.com" },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "หน้าแรก", item: "https://ccpun.com/" },
        { "@type": "ListItem", position: 2, name: V5_TOOLS_HUB.label, item: `https://ccpun.com${V5_TOOLS_HUB.href}` },
        { "@type": "ListItem", position: 3, name: V5_AIA_FUND_TOOL.label, item: URL },
      ],
    },
  ],
};

export default function AiaFundAllocationPage() {
  if (!INVESTMENT_ALLOCATION_ENABLED) notFound();
  return (
    <V5Page current={V5_AIA_FUND_TOOL.href}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
      <V5ToolHero
        id="aia-fund-hero-title"
        breadcrumbs={<V5Breadcrumbs label="เส้นทางของหน้า" items={[{ href: "/", label: "หน้าแรก" }, { href: V5_TOOLS_HUB.href, label: V5_TOOLS_HUB.label }, { label: V5_AIA_FUND_TOOL.label }]} />}
        title={<>กองทุนของ บลจ. เอไอเอ<br /><span>เลือกเอง แล้วดูว่าเงินอยู่ตรงไหน</span></>}
        lead="ดูข้อมูลกองทุนจาก ก.ล.ต. ทั้งประเภทกอง ระดับความเสี่ยง สัดส่วนสินทรัพย์ และเงื่อนไขการรับเงิน ใช้กองเดียวหรือจัดหลายกองเองก็ได้ โดยไม่มีการจัดอันดับหรือเลือกกองแทนคุณ"
        meta="กองทุนในเครื่องมือนี้เป็นกองทุนรวมที่บริหารโดย บลจ. เอไอเอ ส่วนกองทุนที่เลือกได้ในกรมธรรม์ประกันควบการลงทุน (Unit Linked) เป็นไปตามเอกสารกรมธรรม์ของบริษัทประกัน"
        cta={{ href: "#investment-mode-title", label: "เริ่มเลือกวิธีลงทุน" }}
      />
      <div className={`${v5ToolStyles.calcScope} ${v5ToolStyles.iaScope} ${motionStyles.scope}`}>
        <InvestmentAllocationTool scope="aia" />
      </div>
      <section className={shell.sectionAlt} aria-labelledby="aia-fund-scope-title">
        <div className={`${shell.inner} ${shell.narrow}`}>
          <h2 id="aia-fund-scope-title" className={shell.h2}>เครื่องมือนี้ช่วยอธิบาย ไม่ได้ตัดสินใจแทน</h2>
          <p className={shell.lead}>ผลลัพธ์มาจากจำนวนเงินและกองทุนที่คุณเลือกเอง ระบบแสดงระดับความเสี่ยง สัดส่วนสินทรัพย์ และเงื่อนไขขายคืนแยกกัน โดยไม่ตัดสินว่ากองใดเหมาะกับคุณหรือควรซื้อขายกองไหน</p>
          <p className={shell.lead}>ถ้าข้อมูลบางส่วนยังไม่พร้อม ระบบจะแจ้งตรง ๆ และจะไม่เติมข้อมูลหรือเดาแทนข้อมูลจาก ก.ล.ต.</p>
          <p className={shell.lead}>{INVESTMENT_NO_GUARANTEE_STATEMENT}</p>
          <p className={shell.lead}>อยากดูกองทุนของ บลจ. อื่น <Link className={shell.textLink} href={V5_INVESTMENT_TOOL.href}>ไปที่เครื่องมือวางแผนกองทุน</Link></p>
        </div>
      </section>
    </V5Page>
  );
}
