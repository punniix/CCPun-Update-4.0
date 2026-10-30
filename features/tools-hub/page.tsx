import type { Metadata } from "next";
import { getPublicCopy } from "@/lib/content/public-copy";
import { publicCopyText, type PublicCopyValues } from "@/lib/content/public-copy-registry";
import { INVESTMENT_ALLOCATION_ENABLED } from "@/lib/runtime/investment-availability";
import { IS_REVIEW_ENVIRONMENT } from "@/lib/deployment-environment";
import V5Page from "@/components/layout/v5/V5Page";
import shell from "@/components/layout/v5/V5.module.css";
import Link from "next/link";
import { V5Breadcrumbs, v5Label } from "@/components/layout/v5/V5Primitives";
import { V5ToolHero } from "@/components/layout/v5/V5ToolParts";
import { V5_AIA_FUND_TOOL, V5_INVESTMENT_TOOL, V5_TOOLS_HUB } from "@/components/layout/v5/constants";
import V5PhillipAccount from "@/components/layout/v5/V5PhillipAccount";
import styles from "./ToolsHub.module.css";

// Owner-approved new indexable URL (2026-10-25, T1): one hub for the existing tool owners. Each
// tool keeps its own URL, canonical and sitemap entry; this page only links to them.
const URL = "https://ccpun.com/tools/";
const TITLE = "เครื่องมือวางแผนการเงิน ประกัน และการลงทุน | CCPun";
const DESCRIPTION = "รวมเครื่องมือของ CCPun ไว้ที่เดียว ทั้งวางแผนเงินก้อนโรคร้ายแรง ตรวจทุนประกันชีวิต เกมจำลองชีวิตการเงิน 12 เดือน ลองใช้เองก่อน แล้วค่อยคุยกับปั้นทาง LINE";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL },
  // UAT stays noindex like every other tool page; Production indexes the hub.
  robots: IS_REVIEW_ENVIRONMENT ? { index: false, follow: false } : { index: true, follow: true },
  openGraph: { type: "website", locale: "th_TH", url: URL, title: TITLE, description: DESCRIPTION, siteName: "CCPun Financial Advisor" },
  twitter: { card: "summary", title: TITLE, description: DESCRIPTION },
};

// The final argument changes copy-preview presentation only; public pages keep the existing feature flag.
export async function renderToolsHubPage(copy?: PublicCopyValues, siteCopy?: PublicCopyValues, homeCopy?: PublicCopyValues, showInvestmentCards = INVESTMENT_ALLOCATION_ENABLED) {
  const [pageValues, homeValues, siteValues] = await Promise.all([
    copy ?? getPublicCopy("toolsHub"), homeCopy ?? getPublicCopy("home"), siteCopy ?? getPublicCopy("site"),
  ]);
  const text = publicCopyText(pageValues);
  const home = publicCopyText(homeValues);
  const site = publicCopyText(siteValues);
  // Names and descriptions reuse the approved Home copy keys so CMS edits stay in one place.
  const tools = [
    { href: "/ci-planning/", title: home("home.h33"), titleNode: home.node("home.h33"), body: home.node("home.p6"), action: v5Label(home("home.toolCtaAction2")) },
    { href: "/tools/financial-health-check/", title: home("home.h32"), titleNode: home.node("home.h32"), body: home.node("home.p5"), action: v5Label(home("home.toolCtaAction2")) },
    { href: "/play/money-story/", title: site("site.tools.moneyStory"), titleNode: site.node("site.tools.moneyStory"), body: home.node("home.moneyStory.description"), action: v5Label(home("home.toolCtaAction2")) },
    ...(showInvestmentCards ? [{
      href: V5_INVESTMENT_TOOL.href,
      title: text("toolsHub.investment.title"), titleNode: text.node("toolsHub.investment.title"),
      body: text.node("toolsHub.investment.body"),
      action: v5Label(home("home.toolCtaAction2")),
    }, {
      // บลจ. เอไอเอ fund tool (owner request 2026-10-26): same flag as the main tool, same card style.
      href: V5_AIA_FUND_TOOL.href,
      title: text("toolsHub.aia.title"), titleNode: text.node("toolsHub.aia.title"),
      body: text.node("toolsHub.aia.body"),
      action: v5Label(home("home.toolCtaAction2")),
    }] : []),
  ];
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: text("toolsHub.breadcrumb.home"), item: "https://ccpun.com/" },
          { "@type": "ListItem", position: 2, name: text("toolsHub.label"), item: URL },
        ],
      },
      {
        "@type": "ItemList",
        name: TITLE,
        itemListElement: tools.map((tool, index) => ({ "@type": "ListItem", position: index + 1, name: tool.title, url: `https://ccpun.com${tool.href}` })),
      },
    ],
  };

  return (
    <V5Page current={V5_TOOLS_HUB.href} siteCopy={siteValues}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
      <V5ToolHero
        id="tools-hub-title"
        breadcrumbs={<V5Breadcrumbs label={text("toolsHub.breadcrumb.label")} items={[{ href: "/", label: text("toolsHub.breadcrumb.home") }, { label: text("toolsHub.label") }]} />}
        title={text.node("toolsHub.hero.title")}
        lead={text("toolsHub.hero.lead")}
      />
      <section className={shell.section} aria-label={text("toolsHub.label")}>
        <div className={shell.inner}>
          <div className={styles.grid}>
            {tools.map((tool) => (
              <article className={styles.card} key={tool.href}>
                <h2><Link href={tool.href}>{tool.titleNode}</Link></h2>
                <p>{tool.body}</p>
                <span className={styles.action} aria-hidden="true">{tool.action}</span>
              </article>
            ))}
          </div>
        </div>
      </section>
      <V5PhillipAccount siteCopy={siteValues} />
    </V5Page>
  );
}

export default function ToolsHubPage() {
  return renderToolsHubPage();
}
