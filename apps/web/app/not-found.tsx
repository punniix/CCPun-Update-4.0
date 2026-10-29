import { getPublicCopy } from "@/lib/content/public-copy";
import { publicCopyText } from "@/lib/content/public-copy-registry";
import Link from 'next/link';
import type { Metadata } from 'next';
import V5Page from '@/components/layout/v5/V5Page';
import shell from '@/components/layout/v5/V5.module.css';
import { V5ArticleCard } from '@/components/layout/v5/V5Primitives';
import { newestFirst, toV5Cards } from '@/components/layout/v5/article-card-data';
import { getPublishedArticles } from '@/components/layout/v5/shell-data';
import { V5_AIA_FUND_TOOL, V5_INVESTMENT_TOOL, V5_TOOL_LINKS } from "@/components/layout/v5/constants";
import { INVESTMENT_ALLOCATION_ENABLED } from "@/lib/runtime/investment-availability";

export const metadata: Metadata = {
  title: "ไม่พบหน้า | CCPun",
  description: "ไม่พบหน้าที่คุณกำลังหา กลับหน้าแรกหรือเลือกเครื่องมือวางแผนการเงินของ CCPun",
  alternates: { canonical: null },
  openGraph: {
    title: "ไม่พบหน้า | CCPun",
    description: "ไม่พบหน้าที่คุณกำลังหา กลับหน้าแรกหรือเลือกเครื่องมือวางแผนการเงินของ CCPun",
  },
  twitter: {
    title: "ไม่พบหน้า | CCPun",
    description: "ไม่พบหน้าที่คุณกำลังหา กลับหน้าแรกหรือเลือกเครื่องมือวางแผนการเงินของ CCPun",
  },
};

export default async function NotFound() {
  const text = publicCopyText(await getPublicCopy("site"));
  const tools = [
    ...V5_TOOL_LINKS.map((tool) => ({ href: tool.href, label: text(tool.nameKey) })),
    ...(INVESTMENT_ALLOCATION_ENABLED ? [V5_INVESTMENT_TOOL, V5_AIA_FUND_TOOL] : []),
  ];
  // v5 404 (FigCraft 12): recovery links plus the latest articles; a CMS outage still renders the page.
  const latest = toV5Cards(newestFirst(await getPublishedArticles().catch(() => [])).slice(0, 3));
  return (
    <V5Page>
      <section className={shell.section} style={{ textAlign: 'center' }} aria-labelledby="not-found-title">
        <div className={shell.inner}>
          <p aria-hidden="true" style={{ fontSize: 'clamp(96px, 22vw, 180px)', lineHeight: 1, fontWeight: 500, color: 'var(--v5-watermark)', margin: 0 }}>{text.node("site.extra.notFoundCode")}</p>
          <h1 id="not-found-title" className={shell.h1} style={{ marginTop: 8 }}>{text.node("site.extra.h1")}</h1>
          <p className={shell.lead} style={{ marginInline: 'auto' }}>{text.node("site.extra.notFoundDescription")}</p>
          <div className={shell.buttonRow} style={{ justifyContent: 'center' }}>
            <Link className={shell.button} href="/">{text.node("site.extra.primaryButton")}</Link>
            <Link className={shell.buttonOutline} href="/blog/">{text.node("site.extra.blogRecovery")}</Link>
          </div>
        </div>
      </section>
      <section className={shell.section} style={{ paddingTop: 0 }} aria-labelledby="not-found-tools">
        <div className={`${shell.inner} ${shell.notFoundTools}`}>
          <h2 id="not-found-tools" className={shell.h2} style={{ marginBottom: 24 }}>{text.node("site.nav.tools")}</h2>
          <nav aria-label={text("site.nav.tools")}><ul className={shell.chips}>{tools.map((tool) => <li key={tool.href}><Link className={shell.buttonOutline} href={tool.href}>{tool.label}</Link></li>)}</ul></nav>
        </div>
      </section>
      {latest.length > 0 && <section className={shell.section} style={{ paddingTop: 0 }} aria-labelledby="not-found-latest">
        <div className={shell.inner}>
          <h2 id="not-found-latest" className={shell.h2} style={{ marginBottom: 24 }}>{text.node("site.notFound.latestTitle")}</h2>
          <div className={shell.cardGrid}>{latest.map((card) => <V5ArticleCard key={card.id} article={card} />)}</div>
        </div>
      </section>}
    </V5Page>
  );
}
