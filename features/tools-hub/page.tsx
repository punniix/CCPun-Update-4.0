import type { Metadata } from "next";
import { getPublicCopy } from "@/lib/content/public-copy";
import { publicCopyText } from "@/lib/content/public-copy-registry";
import { INVESTMENT_ALLOCATION_ENABLED } from "@/lib/runtime/investment-availability";
import V5Page from "@/components/layout/v5/V5Page";
import shell from "@/components/layout/v5/V5.module.css";
import Link from "next/link";
import { V5Breadcrumbs } from "@/components/layout/v5/V5Primitives";
import { V5ToolHero } from "@/components/layout/v5/V5ToolParts";
import { V5_INVESTMENT_TOOL, V5_TOOLS_HUB } from "@/components/layout/v5/constants";
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
  robots: { index: true, follow: true },
  openGraph: { type: "website", locale: "th_TH", url: URL, title: TITLE, description: DESCRIPTION, siteName: "CCPun Financial Advisor" },
  twitter: { card: "summary", title: TITLE, description: DESCRIPTION },
};

export async function renderToolsHubPage() {
  const [homeCopy, siteCopy] = await Promise.all([getPublicCopy("home"), getPublicCopy("site")]);
  const home = publicCopyText(homeCopy);
  const site = publicCopyText(siteCopy);
  // Names and descriptions reuse the approved Home copy keys so CMS edits stay in one place.
  const tools = [
    { href: "/ci-planning/", title: home("home.h33"), body: home("home.p6"), action: home("home.toolCtaAction2") },
    { href: "/tools/financial-health-check/", title: home("home.h32"), body: home("home.p5"), action: home("home.toolCtaAction2") },
    { href: "/play/money-story/", title: site("site.tools.moneyStory"), body: home("home.moneyStory.description"), action: home("home.toolCtaAction2") },
    ...(INVESTMENT_ALLOCATION_ENABLED ? [{
      href: V5_INVESTMENT_TOOL.href,
      title: "วางแผนกองทุน",
      body: "เลือกกองทุนเอง แล้วดูว่าเงินอยู่ในอะไร ความเสี่ยงระดับไหน และขายคืนได้แบบไหน จากข้อมูล ก.ล.ต.",
      action: home("home.toolCtaAction2"),
    }] : []),
  ];
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "หน้าแรก", item: "https://ccpun.com/" },
          { "@type": "ListItem", position: 2, name: V5_TOOLS_HUB.label, item: URL },
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
    <V5Page current={V5_TOOLS_HUB.href} siteCopy={siteCopy}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
      <V5ToolHero
        id="tools-hub-title"
        breadcrumbs={<V5Breadcrumbs label="เส้นทางของหน้า" items={[{ href: "/", label: "หน้าแรก" }, { label: V5_TOOLS_HUB.label }]} />}
        kicker="เครื่องมือ CCPun"
        title="ลองคิดเองก่อน แล้วค่อยคุยกัน"
        lead="แต่ละเครื่องมือใช้ตัวเลขที่คุณใส่เอง ช่วยให้เห็นภาพก่อนตัดสินใจ ถ้าอยากให้ช่วยดูผลต่อ ทักมาทาง LINE ได้"
      />
      <section className={shell.section} aria-label={V5_TOOLS_HUB.label}>
        <div className={shell.inner}>
          <div className={styles.grid}>
            {tools.map((tool) => (
              <article className={styles.card} key={tool.href}>
                <h2><Link href={tool.href}>{tool.title}</Link></h2>
                <p>{tool.body}</p>
                <span className={styles.action} aria-hidden="true">{tool.action}</span>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className={shell.band} aria-labelledby="tools-hub-line">
        <div className={shell.inner}>
          <h2 id="tools-hub-line" className={shell.h2}>อยากให้ช่วยดูผลที่ได้</h2>
          <p className={shell.bandLead}>ส่งผลมาคุยกับปั้นทาง LINE @ccpun ได้เลย</p>
          <div className={shell.buttonRow}>
            <a className={shell.buttonDark} href="https://lin.ee/tqLCs4f" target="_blank" rel="noopener noreferrer" data-analytics-location="tools_hub">ทักปั้นทาง LINE</a>
          </div>
        </div>
      </section>
    </V5Page>
  );
}

export default function ToolsHubPage() {
  return renderToolsHubPage();
}
