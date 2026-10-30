import { getPublicCopy } from "@/lib/content/public-copy";
import { publicCopyText, type PublicCopyValues, type PublicCopyKey } from "@/lib/content/public-copy-registry";
import V5Page from "@/components/layout/v5/V5Page";
import shell from "@/components/layout/v5/V5.module.css";
import { V5ToolHero, v5ToolStyles as styles } from "@/components/layout/v5/V5ToolParts";
import { V5_LINE_URL } from "@/components/layout/v5/constants";

const SECTIONS = [
  ["privacy-collect", "privacy.h2"],
  ["privacy-purpose", "privacy.h22"],
  ["privacy-disclosure", "privacy.h23"],
  ["privacy-retention", "privacy.h24"],
  ["privacy-fhc", "privacy.h25"],
  ["privacy-rights", "privacy.h26"],
  ["privacy-contact", "privacy.h27"],
  ["privacy-controller", "privacy.h28"],
  ["privacy-cookies", "privacy.h29"],
  ["privacy-care", "privacy.h210"],
] as const satisfies readonly (readonly [string, PublicCopyKey])[];

/**
 * v5 privacy policy (FigCraft 10, UAT prototype). Every sentence still comes from the
 * existing `privacy` copy scope; only the frame (hero, table of contents, reading column) is v5.
 * Metadata stays with the existing PrivacyPage owner.
 */
export default async function V5Privacy({ copy, siteCopy }: { copy?: PublicCopyValues; siteCopy?: PublicCopyValues } = {}) {
  const [privacyCopy, blogCopy] = await Promise.all([copy ? Promise.resolve(copy) : getPublicCopy("privacy"), getPublicCopy("blog")]);
  const text = publicCopyText(privacyCopy);
  const blog = publicCopyText(blogCopy);
    const mail = <a href="mailto:chanatip.chid@gmail.com">{text.node("privacy.a3")}</a>;

  return (
    <V5Page siteCopy={siteCopy}>
      <V5ToolHero id="privacy-title" title={text("privacy.h1")} meta={text("privacy.p")} lead={text("privacy.p2")} />
      <section className={shell.section}>
        <div className={`${shell.inner} ${styles.legalGrid}`}>
          <nav className={styles.toc} aria-labelledby="privacy-toc">
            <h2 id="privacy-toc">{blog.node("blog.website43Articlearialabel2")}</h2>
            <ol>{SECTIONS.map(([id, key]) => <li key={id}><a href={`#${id}`}>{text.node(key)}</a></li>)}</ol>
          </nav>
          <div className={styles.legalBody}>
            <section id={SECTIONS[0][0]}>
              <h2>{text.node("privacy.h2")}</h2>
              <p>{text.node("privacy.p3")}</p>
              <p>{text.node("privacy.p4")}</p>
              <p>{text.node("privacy.p5")}</p>
            </section>
            <section id={SECTIONS[1][0]}>
              <h2>{text.node("privacy.h22")}</h2>
              <p>{text.node("privacy.p6")}</p>
              <ul>
                <li>{text.node("privacy.privacyPageText")}</li>
                <li>{text.node("privacy.privacyPageText2")}</li>
                <li>{text.node("privacy.privacyPageText3")}</li>
              </ul>
            </section>
            <section id={SECTIONS[2][0]}>
              <h2>{text.node("privacy.h23")}</h2>
              <p><strong>{text.node("privacy.p7")}</strong></p>
              <p>{text.node("privacy.p8")}</p>
            </section>
            <section id={SECTIONS[3][0]}><h2>{text.node("privacy.h24")}</h2><p>{text.node("privacy.p9")}</p></section>
            <section id={SECTIONS[4][0]}><h2>{text.node("privacy.h25")}</h2><p>{text.node("privacy.p10")}</p></section>
            <section id={SECTIONS[5][0]}>
              <h2>{text.node("privacy.h26")}</h2>
              <p>{text.node("privacy.p11")}</p>
              <ul>
                <li><strong>{text.node("privacy.privacyPageText4")}:</strong> {text.node("privacy.privacyPageText5")}</li>
                <li><strong>{text.node("privacy.privacyPageText6")}:</strong> {text.node("privacy.privacyPageText7")}</li>
                <li><strong>{text.node("privacy.privacyPageText8")}:</strong> {text.node("privacy.privacyPageText9")}</li>
                <li><strong>{text.node("privacy.privacyPageText10")}:</strong> {text.node("privacy.privacyPageText11")}</li>
                <li><strong>{text.node("privacy.privacyPageText12")}:</strong> {text.node("privacy.privacyPageText13")}</li>
              </ul>
              <p>{text.node("privacy.p12")} <a href={V5_LINE_URL} target="_blank" rel="noopener noreferrer">{text.node("privacy.a")}</a> {text.node("privacy.p13")}</p>
            </section>
            <section id={SECTIONS[6][0]}>
              <h2>{text.node("privacy.h27")}</h2>
              <p>{text.node("privacy.p14")}</p>
              <address style={{ fontStyle: "normal" }}>
                <p>{text.node("privacy.span")} <a href={V5_LINE_URL} target="_blank" rel="noopener noreferrer">{text.node("privacy.a2")}</a></p>
                <p>{text.node("privacy.span2")} {mail}</p>
              </address>
            </section>
            <section id={SECTIONS[7][0]}>
              <h2>{text.node("privacy.h28")}</h2>
              <p>{text.node("privacy.p15")}</p>
              <address style={{ fontStyle: "normal" }}>
                <p>{text.node("privacy.span3")} {text.node("privacy.p16")}</p>
                <p>{text.node("privacy.span2")} {mail}</p>
                <p>{text.node("privacy.span4")} <a href="tel:0633438513">{text.node("privacy.a4")}</a></p>
              </address>
            </section>
            <section id={SECTIONS[8][0]}>
              <h2>{text.node("privacy.h29")}</h2>
              <p>{text.node("privacy.p17")}</p>
              <p>{text.node("privacy.p18")} <a href="/cookie-policy/">{text.node("privacy.a5")}</a></p>
            </section>
            <section id={SECTIONS[9][0]}>
              <h2>{text.node("privacy.h210")}</h2>
              <p>{text.node("privacy.p19")} <strong>{text.node("privacy.span5")}</strong> {text.node("privacy.p20")}</p>
            </section>
          </div>
        </div>
      </section>
    </V5Page>
  );
}
