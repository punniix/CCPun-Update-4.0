import Link from "next/link";
import { getPublicCopy } from "@/lib/content/public-copy";
import { publicCopyText, type PublicCopyKey, type PublicCopyValues } from "@/lib/content/public-copy-registry";
import V5Page from "@/components/layout/v5/V5Page";
import shell from "@/components/layout/v5/V5.module.css";
import { V5ToolHero, v5ToolStyles as styles } from "@/components/layout/v5/V5ToolParts";

const SECTIONS = [
  ["cookies-types", "cookies.h2"],
  ["cookies-purpose", "cookies.h22"],
  ["cookies-manage", "cookies.h23"],
  ["cookies-providers", "cookies.h24"],
  ["cookies-privacy", "cookies.h25"],
] as const satisfies readonly (readonly [string, PublicCopyKey])[];

type Row = { label: string; value: string };

/**
 * v5 cookie policy (FigCraft 11, UAT prototype). Same `cookies` copy scope and cookie
 * names as the existing policy; consent behaviour is untouched (the footer keeps the
 * existing cookie-settings button). Metadata stays with the existing CookiePolicyPage owner.
 */
export default async function V5CookiePolicy({ copy, siteCopy }: { copy?: PublicCopyValues; siteCopy?: PublicCopyValues } = {}) {
  const [cookieCopy, blogCopy] = await Promise.all([copy ? Promise.resolve(copy) : getPublicCopy("cookies"), getPublicCopy("blog")]);
  const text = publicCopyText(cookieCopy);
  const blog = publicCopyText(blogCopy);
  const table = (rows: Row[]) => (
    <div className={styles.tableScroll}>
      <table><tbody>{rows.map(({ label, value }) => <tr key={label}><td>{label}</td><td>{value}</td></tr>)}</tbody></table>
    </div>
  );

  return (
    <V5Page siteCopy={siteCopy}>
      <V5ToolHero id="cookies-title" title={text("cookies.h1")} meta={text("cookies.p")} lead={text("cookies.p2")} />
      <section className={shell.section}>
        <div className={`${shell.inner} ${styles.legalGrid}`}>
          <nav className={styles.toc} aria-labelledby="cookies-toc">
            <h2 id="cookies-toc">{blog.node("blog.website43Articlearialabel2")}</h2>
            <ol>{SECTIONS.map(([id, key]) => <li key={id}><a href={`#${id}`}>{text.node(key)}</a></li>)}</ol>
          </nav>
          <div className={styles.legalBody}>
            <section id={SECTIONS[0][0]}>
              <h2>{text.node("cookies.h2")}</h2>
              <div className={styles.policyCard}>
                <header>
                  <span className={styles.policyTag}>{text.node("cookies.span")}</span>
                  <div><p>{text.node("cookies.p3")}</p><p>{text.node("cookies.p4")}</p></div>
                </header>
                {table([
                { label: text("cookies.cookiePolicyPageText"), value: "ccpun_cookie_consent (localStorage)" },
                { label: text("cookies.cookiePolicyPageText2"), value: text("cookies.cookiePolicyPageText3") },
                { label: text("cookies.cookiePolicyPageText4"), value: text("cookies.cookiePolicyPageText5") },
                { label: text("cookies.cookiePolicyPageText6"), value: text("cookies.cookiePolicyPageText7") },
              ])}
              </div>
              <div className={styles.policyCard}>
                <header>
                  <span className={styles.policyTag}>{text.node("cookies.span2")}</span>
                  <div><p>{text.node("cookies.p5")}</p><p>{text.node("cookies.p6")}</p></div>
                </header>
              </div>
              <div className={styles.policyCard}>
                <header>
                  <span className={styles.policyTag}>{text.node("cookies.span3")}</span>
                  <div><p>{text.node("cookies.p7")}</p><p>{text.node("cookies.p8")}</p></div>
                </header>
                {table([
                { label: text("cookies.cookiePolicyPageText8"), value: "_ga, _ga_*, _gid" },
                { label: text("cookies.cookiePolicyPageText2"), value: text("cookies.cookiePolicyPageText9") },
                { label: text("cookies.cookiePolicyPageText4"), value: text("cookies.cookiePolicyPageText10") },
                { label: text("cookies.cookiePolicyPageText11"), value: text("cookies.cookiePolicyPageText12") },
                { label: text("cookies.cookiePolicyPageText13"), value: text("cookies.cookiePolicyPageText14") },
              ])}
              </div>
              <div className={styles.policyCard}>
                <header>
                  <span className={styles.policyTag}>{text.node("cookies.span4")}</span>
                  <div><p>{text.node("cookies.p9")}</p><p>{text.node("cookies.p10")}</p></div>
                </header>
                {table([
                { label: text("cookies.cookiePolicyPageText8"), value: text("cookies.cookiePolicyPageText15") },
                { label: text("cookies.cookiePolicyPageText2"), value: text("cookies.cookiePolicyPageText16") },
                { label: text("cookies.cookiePolicyPageText17"), value: text("cookies.cookiePolicyPageText18") },
                { label: text("cookies.cookiePolicyPageText19"), value: text("cookies.cookiePolicyPageText20") },
                { label: text("cookies.cookiePolicyPageText11"), value: text("cookies.cookiePolicyPageText21") },
                { label: text("cookies.cookiePolicyPageText13"), value: text("cookies.cookiePolicyPageText14") },
              ])}
              </div>
            </section>
            <section id={SECTIONS[1][0]}>
              <h2>{text.node("cookies.h22")}</h2>
              <ul>
                <li>{text.node("cookies.cookiePolicyPageText22")}</li>
                <li>{text.node("cookies.cookiePolicyPageText23")}</li>
                <li>{text.node("cookies.cookiePolicyPageText24")}</li>
                <li>{text.node("cookies.cookiePolicyPageText25")}</li>
                <li>{text.node("cookies.cookiePolicyPageText26")}</li>
              </ul>
              <p>{text.node("cookies.p11")}</p>
            </section>
            <section id={SECTIONS[2][0]}>
              <h2>{text.node("cookies.h23")}</h2>
              <p>{text.node("cookies.p12")}</p>
              <ul>
                <li><strong>{text.node("cookies.p13")}</strong><br />{text.node("cookies.p14")}</li>
                <li><strong>{text.node("cookies.p15")}</strong><br />{text.node("cookies.p16")}</li>
                <li><strong>{text.node("cookies.p17")}</strong><br />{text.node("cookies.p18")}</li>
              </ul>
            </section>
            <section id={SECTIONS[3][0]}>
              <h2>{text.node("cookies.h24")}</h2>
              <p>
                {text.node("cookies.p19")}{" "}
                <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">{text.node("cookies.a")}</a>
                {" "}{text.node("cookies.p20")}{" "}
                <a href="https://www.facebook.com/privacy/policy/" target="_blank" rel="noopener noreferrer">{text.node("cookies.a2")}</a>
                {" "}{text.node("cookies.p21")}
              </p>
            </section>
            <section id={SECTIONS[4][0]}>
              <h2>{text.node("cookies.h25")}</h2>
              <p>{text.node("cookies.p22")} <Link href="/privacy/">{text.node("cookies.link2")}</Link> {text.node("cookies.p23")}</p>
            </section>
          </div>
        </div>
      </section>
    </V5Page>
  );
}
