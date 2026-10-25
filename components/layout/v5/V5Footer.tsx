import Link from "next/link";
import CookieSettingsButton from "@/components/layout/CookieSettingsButton";
import { getPublicCopy } from "@/lib/content/public-copy";
import { publicCopyText, type PublicCopyValues } from "@/lib/content/public-copy-registry";
import styles from "./V5.module.css";
import { getShellTopics } from "./shell-data";
import { INVESTMENT_ALLOCATION_ENABLED } from "@/lib/runtime/investment-availability";
import { V5_INVESTMENT_TOOL, V5_TOOL_LINKS, V5_TOOLS_HUB } from "./constants";

/** The one v5 footer for every page (plan T05), including the topic-hub column. */
export default async function V5Footer({ siteCopy }: { siteCopy?: PublicCopyValues }) {
  const [copy, topics] = await Promise.all([siteCopy ? Promise.resolve(siteCopy) : getPublicCopy("site"), getShellTopics()]);
  const text = publicCopyText(copy);
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <span className={styles.footerMark} aria-hidden="true">CCPUN</span>
        <div className={styles.footerGrid}>
          <div className={styles.footerColumn}>
            <h2>{text.node("site.footer.explore")}</h2>
            <ul>
              <li><Link href="/">{text.node("site.nav.home")}</Link></li>
              <li><Link href="/blog/">{text.node("site.nav.blog")}</Link></li>
            </ul>
          </div>
          <div className={styles.footerColumn}>
            <h2>{text.node("site.nav.tools")}</h2>
            <ul>
              <li><Link href={V5_TOOLS_HUB.href}>{V5_TOOLS_HUB.label}</Link></li>
              {V5_TOOL_LINKS.map((tool) => <li key={tool.href}><Link href={tool.href}>{text.node(tool.nameKey)}</Link></li>)}
              {INVESTMENT_ALLOCATION_ENABLED ? <li><Link href={V5_INVESTMENT_TOOL.href}>{V5_INVESTMENT_TOOL.label}</Link></li> : null}
            </ul>
          </div>
          {topics.length > 0 && <div className={styles.footerColumn}>
            <h2>{text.node("site.nav.topics")}</h2>
            <ul>{topics.map((topic) => <li key={topic.slug}><Link href={topic.href}>{topic.title}</Link></li>)}</ul>
          </div>}
          <div className={styles.footerColumn}>
            <h2>{text.node("site.footer.information")}</h2>
            <ul>
              <li><Link href="/about/">{text.node("site.footer.about")}</Link></li>
              <li><Link href="/privacy/">{text.node("site.footer.privacy")}</Link></li>
              <li><Link href="/cookie-policy/">{text.node("site.footer.cookies")}</Link></li>
              <li><CookieSettingsButton /></li>
            </ul>
          </div>
        </div>
        <div className={styles.footerLegal}>
          <p>{text.node("site.footerDisclaimer")}</p>
          <p>{text.node("site.disclosure.investment")} {text.node("site.disclosure.pastPerformance")}</p>
          <p>{text.node("site.disclosure.insurance")}</p>
        </div>
        <p className={styles.footerCopyright}>{text.node("site.footerCopyright")}</p>
      </div>
    </footer>
  );
}
