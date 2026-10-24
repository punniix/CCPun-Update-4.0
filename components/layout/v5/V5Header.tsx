import Link from "next/link";
import { getPublicCopy } from "@/lib/content/public-copy";
import { publicCopyText, type PublicCopyValues } from "@/lib/content/public-copy-registry";
import styles from "./V5.module.css";
import { getShellTopics } from "./shell-data";
import V5HeaderEnhancer from "./V5HeaderEnhancer";
import { V5_LINE_URL, V5_TOOL_LINKS, V5_THEME_STORAGE_KEY } from "./constants";

// Runs before first paint so a saved light preference never flashes dark.
const THEME_BOOT = `try{var t=localStorage.getItem(${JSON.stringify(V5_THEME_STORAGE_KEY)});if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

function Chevron() {
  return <svg className={styles.chevron} viewBox="0 0 10 10" aria-hidden="true"><path d="M1.5 3.5 5 7l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function V5Brand() {
  return <><span className={styles.brandCc}>CC</span><span className={styles.brandPun}>PUN</span></>;
}

/**
 * Server-rendered site header. Every tool and topic link is present in the HTML
 * (plan T04); CSS and a small enhancer only control visibility. `current` is the
 * physical path of the page so aria-current never depends on client rendering.
 */
export default async function V5Header({ current = "", siteCopy }: { current?: string; siteCopy?: PublicCopyValues }) {
  const [copy, topics] = await Promise.all([siteCopy ? Promise.resolve(siteCopy) : getPublicCopy("site"), getShellTopics()]);
  const text = publicCopyText(copy);
  const isCurrent = (href: string) => current === href ? "page" as const : undefined;
  const blogCurrent = current === "/blog/" ? "page" as const : current.startsWith("/blog/") ? "location" as const : undefined;
  const tools = V5_TOOL_LINKS.map((tool) => ({ ...tool, label: text(tool.navKey) }));
  const toolsCurrent = tools.some((tool) => tool.href === current);

  return (
    <header className={styles.header} data-v5-header="">
      <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      <div className={`${styles.inner} ${styles.headerBar}`}>
        <Link href="/" className={styles.brand} aria-label={text("site.nav.homeLabel")}><V5Brand /></Link>
        <nav className={styles.desktopNav} aria-label={text("site.nav.mainLabel")}>
          <ul>
            <li className={styles.navItem}><Link className={styles.navLink} href="/" aria-current={isCurrent("/")}>{text.node("site.nav.home")}</Link></li>
            <li className={styles.navItem} data-v5-dropdown="">
              <button type="button" className={styles.navToggle} aria-expanded="false" aria-controls="v5-nav-articles" data-active={blogCurrent ? "true" : undefined}>
                {text.node("site.nav.blog")}<Chevron />
              </button>
              <ul id="v5-nav-articles" className={styles.dropdown}>
                <li><Link href="/blog/" aria-current={current === "/blog/" ? "page" : undefined}>{text.node("site.nav.allArticles")}</Link></li>
                {topics.length > 0 && <li aria-hidden="true" className={styles.dropdownDivider} />}
                {topics.map((topic) => <li key={topic.slug}><Link href={topic.href} aria-current={current.startsWith(topic.href) ? (current === topic.href ? "page" : "location") : undefined}>{topic.title}</Link></li>)}
              </ul>
            </li>
            <li className={styles.navItem} data-v5-dropdown="">
              <button type="button" className={styles.navToggle} aria-expanded="false" aria-controls="v5-nav-tools" data-active={toolsCurrent ? "true" : undefined}>
                {text.node("site.nav.tools")}<Chevron />
              </button>
              <ul id="v5-nav-tools" className={styles.dropdown}>
                {tools.map((tool) => <li key={tool.href}><Link href={tool.href} aria-current={isCurrent(tool.href)}>{tool.label}</Link></li>)}
              </ul>
            </li>
            <li className={styles.navItem}><Link className={styles.navLink} href="/#about-ccpun">{text.node("site.footer.about")}</Link></li>
          </ul>
        </nav>
        <div className={styles.headerActions}>
          <button type="button" className={styles.iconButton} data-v5-theme-toggle="" aria-label={text("site.theme.toggle")} title={text("site.theme.toggle")}>
            <svg className={styles.themeIconDark} viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
            <svg className={styles.themeIconLight} viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          </button>
          <a className={`${styles.button} ${styles.headerCta}`} href={V5_LINE_URL} target="_blank" rel="noopener noreferrer" data-analytics-location="navbar">{text.node("site.nav.contact")}</a>
          <button type="button" className={`${styles.iconButton} ${styles.menuButton}`} data-v5-menu-toggle="" aria-controls="mobile-navigation" aria-expanded="false" aria-label={text("site.nav.open")} data-label-open={text("site.nav.open")} data-label-close={text("site.nav.close")}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </button>
        </div>
      </div>
      <nav id="mobile-navigation" className={`${styles.inner} ${styles.mobilePanel}`} aria-label={text("site.nav.mobileLabel")} hidden>
        <ul className={styles.mobileGroup}>
          <li><Link href="/" aria-current={isCurrent("/")}>{text.node("site.nav.home")}</Link></li>
          <li><Link href="/blog/" aria-current={blogCurrent === "page" ? "page" : undefined}>{text.node("site.nav.allArticles")}</Link></li>
          <li><Link href="/#about-ccpun">{text.node("site.footer.about")}</Link></li>
        </ul>
        {topics.length > 0 && <div className={styles.mobileGroup}>
          <p className={styles.mobileGroupTitle}>{text.node("site.nav.topics")}</p>
          <ul>{topics.map((topic) => <li key={topic.slug}><Link href={topic.href} aria-current={current === topic.href ? "page" : undefined}>{topic.title}</Link></li>)}</ul>
        </div>}
        <div className={styles.mobileGroup}>
          <p className={styles.mobileGroupTitle}>{text.node("site.nav.tools")}</p>
          <ul>{tools.map((tool) => <li key={tool.href}><Link href={tool.href} aria-current={isCurrent(tool.href)}>{tool.label}</Link></li>)}</ul>
        </div>
        <a className={`${styles.button} ${styles.mobileCta}`} href={V5_LINE_URL} target="_blank" rel="noopener noreferrer" data-analytics-location="navbar_mobile">{text.node("site.nav.contact")}</a>
      </nav>
      <V5HeaderEnhancer storageKey={V5_THEME_STORAGE_KEY} />
    </header>
  );
}
