import { PublicCopyProvider } from "@/components/ui/PublicCopyProvider";
import { getPublicCopy } from "@/lib/content/public-copy";
import { publicCopyText, type PublicCopyValues } from "@/lib/content/public-copy-registry";
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

export async function renderInvestmentAllocationPage(copyOverride?: PublicCopyValues) {
  const copy = copyOverride ?? await getPublicCopy("investment");
  const copyText = publicCopyText(copy);


  return (<PublicCopyProvider values={copy}><main className={`${websiteStyles.root} ${motionStyles.scope}`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <Website43Navbar />
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <span className={styles.badge}>{copyText("investment.badge")}</span>
          <h1>{copyText("investment.h1")}<br /><span>{copyText("investment.span13")}</span></h1>
          <p className={styles.heroLead}>{copyText("investment.heroLead")}</p>
          <div className={styles.heroProof} aria-label={copyText("investment.investmentAllocationPagearialabel")}>
            <span>{copyText("investment.span14")}</span><span>{copyText("investment.linesText5")}</span><span>{copyText("investment.h1")}</span><span>{copyText("investment.span15")}</span>
          </div>
          <a className={styles.heroAction} href="#investment-mode-title">{copyText("investment.heroAction")}</a>
        </div>
      </section>
      <InvestmentAllocationTool />
      <section className={styles.legalSection} aria-label={copyText("investment.investmentAllocationPagearialabel2")}>
        <div className={styles.legalInner}>
          <h2>{copyText("investment.h25")}</h2>
          <p>{copyText("investment.p17")}</p>
          <p>{copyText("investment.p18")}</p>
        </div>
      </section>
      <Website43Footer warnings />
    </main></PublicCopyProvider>);
}

export default function InvestmentAllocationPage() {
  if (!INVESTMENT_ALLOCATION_ENABLED) notFound();
  return renderInvestmentAllocationPage();
}
