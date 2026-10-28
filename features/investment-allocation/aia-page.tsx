import type { Metadata } from "next";
import { getPublicCopy } from "@/lib/content/public-copy";
import { publicCopyText } from "@/lib/content/public-copy-registry";
import { PublicCopyProvider } from "@/components/ui/PublicCopyProvider";
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

export default async function AiaFundAllocationPage() {
  if (!INVESTMENT_ALLOCATION_ENABLED) notFound();
  const copy = await getPublicCopy("investment");
  const text = publicCopyText(copy);
  return (
    <PublicCopyProvider values={copy}><V5Page current={V5_AIA_FUND_TOOL.href}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
      <V5ToolHero
        id="aia-fund-hero-title"
        breadcrumbs={<V5Breadcrumbs label={text("investment.aia.text265")} items={[{ href: "/", label: text("investment.aia.text264") }, { href: V5_TOOLS_HUB.href, label: V5_TOOLS_HUB.label }, { label: V5_AIA_FUND_TOOL.label }]} />}
        title={text("investment.aia.text266")}
        subtitle={<span className={shell.lead}>{text.node("investment.aia.text267")}</span>}
        lead={text("investment.aia.text268")}
        meta={text("investment.aia.text269")}
        cta={{ href: "#investment-mode-title", label: text("investment.main.text255") }}
      />
      <div className={`${v5ToolStyles.calcScope} ${v5ToolStyles.iaScope} ${motionStyles.scope}`}>
        <InvestmentAllocationTool scope="aia" />
      </div>
      <section className={shell.sectionAlt} aria-labelledby="aia-fund-scope-title">
        <div className={`${shell.inner} ${shell.narrow}`}>
          <h2 id="aia-fund-scope-title" className={shell.h2}>{text.node("investment.main.text256")}</h2>
          <p className={shell.lead}>{text.node("investment.main.text257")}</p>
          <p className={shell.lead}>{text.node("investment.main.text258")}</p>
          <p className={shell.lead}>{INVESTMENT_NO_GUARANTEE_STATEMENT}</p>
          <p className={shell.lead}>{text.node("investment.aia.text270")}<Link className={shell.textLink} href={V5_INVESTMENT_TOOL.href}>{text.node("investment.aia.text271")}</Link></p>
        </div>
      </section>
    </V5Page></PublicCopyProvider>
  );
}
