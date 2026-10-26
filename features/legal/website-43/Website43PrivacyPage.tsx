// Retained Website 4.3 legal presentation (rollback target, not routed). Website v5 Phase B renders
// the legal pages through features/legal/v5; SEO metadata stays with features/legal/pages/*.
import { getPublicCopy } from "@/lib/content/public-copy";
import { publicCopyText, type PublicCopyValues } from "@/lib/content/public-copy-registry";
import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";
import { Website43Footer, Website43Navbar } from "@/components/layout/website-43/Website43Shared";
import w43Styles from "@/components/layout/website-43/Website43.module.css";
import legalStyles from "@/components/layout/website-43/Website43Legal.module.css";


export async function renderWebsite43PrivacyPage(copyOverride?: PublicCopyValues, siteCopyOverride?: PublicCopyValues) {
  const text = publicCopyText(copyOverride ?? await getPublicCopy("privacy"));
  return (
    <div className={`${w43Styles.root} ${legalStyles.page}`}>
      <Website43Navbar />
      <main id="main-content" tabIndex={-1} className={legalStyles.main}>
      <div className={legalStyles.inner}>

        {/* Back link */}
        <div className={legalStyles.backRow}>
          <Link
            href="/"
            className={legalStyles.backLink}
          >
            <ArrowLeft />{text.node("privacy.link")}</Link>
        </div>

        {/* Header */}
        <div className={legalStyles.header}>
          <div className={legalStyles.iconWrap}>
            <Shield className={legalStyles.headerIcon} />
          </div>
          <h1 className={legalStyles.title}>{text.node("privacy.h1")}</h1>
          <div className={legalStyles.headerRule} />
          <p className={legalStyles.updated}>{text.node("privacy.p")}</p>
        </div>

        {/* Content */}
        <div className={legalStyles.content}>

          {/* Intro */}
          <p className="text-foreground leading-relaxed">{text.node("privacy.p2")}</p>

          {/* Section 1 */}
          <section>
            <h2 className="text-xl font-semibold text-gold-gradient mb-3">{text.node("privacy.h2")}</h2>
            <div className="section-divider mb-5" style={{ marginLeft: 0, width: "3rem" }} />
            <p className="text-muted-foreground leading-relaxed mb-4">{text.node("privacy.p3")}</p>
            <p className="text-muted-foreground leading-relaxed mt-4">{text.node("privacy.p4")}</p>
            <p className="text-muted-foreground leading-relaxed mt-4">{text.node("privacy.p5")}</p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-xl font-semibold text-gold-gradient mb-3">{text.node("privacy.h22")}</h2>
            <div className="section-divider mb-5" style={{ marginLeft: 0, width: "3rem" }} />
            <p className="text-muted-foreground leading-relaxed mb-4">{text.node("privacy.p6")}</p>
            <ul className="space-y-2 text-foreground">
              {[
                text("privacy.privacyPageText"),
                text("privacy.privacyPageText2"),
                text("privacy.privacyPageText3"),
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-xl font-semibold text-gold-gradient mb-3">{text.node("privacy.h23")}</h2>
            <div className="section-divider mb-5" style={{ marginLeft: 0, width: "3rem" }} />
            <p className="text-foreground leading-relaxed font-medium mb-3">{text.node("privacy.p7")}</p>
            <p className="text-muted-foreground leading-relaxed">{text.node("privacy.p8")}</p>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-xl font-semibold text-gold-gradient mb-3">{text.node("privacy.h24")}</h2>
            <div className="section-divider mb-5" style={{ marginLeft: 0, width: "3rem" }} />
            <p className="text-muted-foreground leading-relaxed">{text.node("privacy.p9")}</p>
          </section>

          {/* Section 4b — FHC Tool Data */}
          <section>
            <h2 className="text-xl font-semibold text-gold-gradient mb-3">{text.node("privacy.h25")}</h2>
            <div className="section-divider mb-5" style={{ marginLeft: 0, width: "3rem" }} />
            <p className="text-muted-foreground leading-relaxed">{text.node("privacy.p10")}</p>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-xl font-semibold text-gold-gradient mb-3">{text.node("privacy.h26")}</h2>
            <div className="section-divider mb-5" style={{ marginLeft: 0, width: "3rem" }} />
            <p className="text-muted-foreground leading-relaxed mb-4">{text.node("privacy.p11")}</p>
            <ul className="space-y-3 text-foreground">
              {[
                { title: text("privacy.privacyPageText4"), desc: text("privacy.privacyPageText5") },
                { title: text("privacy.privacyPageText6"), desc: text("privacy.privacyPageText7") },
                { title: text("privacy.privacyPageText8"), desc: text("privacy.privacyPageText9") },
                { title: text("privacy.privacyPageText10"), desc: text("privacy.privacyPageText11") },
                { title: text("privacy.privacyPageText12"), desc: text("privacy.privacyPageText13") },
              ].map(({ title, desc }) => (
                <li key={title} className="flex items-start gap-3">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                  <span>
                    <span className="font-medium text-primary">{title}:</span>{" "}
                    {desc}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">{text.node("privacy.p12")}{" "}
              <a
                href="https://lin.ee/tqLCs4f"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >{text.node("privacy.a")}</a>{" "}{text.node("privacy.p13")}</p>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-xl font-semibold text-gold-gradient mb-3">{text.node("privacy.h27")}</h2>
            <div className="section-divider mb-5" style={{ marginLeft: 0, width: "3rem" }} />
            <p className="text-muted-foreground leading-relaxed mb-4">{text.node("privacy.p14")}</p>
            <address className="not-italic space-y-2 text-foreground">
              <p>
                <span className="text-muted-foreground">{text.node("privacy.span")}</span>{" "}
                <a
                  href="https://lin.ee/tqLCs4f"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >{text.node("privacy.a2")}</a>
              </p>
              <p>
                <span className="text-muted-foreground">{text.node("privacy.span2")}</span>{" "}
                <a
                  href="mailto:chanatip.chid@gmail.com"
                  className="text-primary hover:underline"
                >{text.node("privacy.a3")}</a>
              </p>
            </address>
          </section>

          {/* Section 7 — Data Controller */}
          <section>
            <h2 className="text-xl font-semibold text-gold-gradient mb-3">{text.node("privacy.h28")}</h2>
            <div className="section-divider mb-5" style={{ marginLeft: 0, width: "3rem" }} />
            <p className="text-muted-foreground leading-relaxed mb-4">{text.node("privacy.p15")}</p>
            <address className="not-italic space-y-2 text-foreground">
              <p>
                <span className="text-muted-foreground">{text.node("privacy.span3")}</span>{" "}{text.node("privacy.p16")}</p>
              <p>
                <span className="text-muted-foreground">{text.node("privacy.span2")}</span>{" "}
                <a
                  href="mailto:chanatip.chid@gmail.com"
                  className="text-primary hover:underline"
                >{text.node("privacy.a3")}</a>
              </p>
              <p>
                <span className="text-muted-foreground">{text.node("privacy.span4")}</span>{" "}
                <a href="tel:0633438513" className="text-primary hover:underline">{text.node("privacy.a4")}</a>
              </p>
            </address>
          </section>

          {/* Section 8 — Cookie */}
          <section>
            <h2 className="text-xl font-semibold text-gold-gradient mb-3">{text.node("privacy.h29")}</h2>
            <div className="section-divider mb-5" style={{ marginLeft: 0, width: "3rem" }} />
            <p className="text-muted-foreground leading-relaxed mb-3">{text.node("privacy.p17")}</p>
            <p className="text-muted-foreground leading-relaxed">{text.node("privacy.p18")}{" "}
              <a
                href="/cookie-policy"
                className="text-primary hover:underline"
              >{text.node("privacy.a5")}</a>
            </p>
          </section>

          {/* Section 9 */}
          <section>
            <h2 className="text-xl font-semibold text-gold-gradient mb-3">{text.node("privacy.h210")}</h2>
            <div className="section-divider mb-5" style={{ marginLeft: 0, width: "3rem" }} />
            <p className="text-muted-foreground leading-relaxed">{text.node("privacy.p19")}{" "}
              <span className="text-foreground font-medium">{text.node("privacy.span5")}</span>
              {" "}{text.node("privacy.p20")}</p>
          </section>

        </div>

        {/* Bottom back link */}
        <div className={legalStyles.bottomBack}>
          <Link
            href="/"
            className={legalStyles.backLink}
          >
            <ArrowLeft />{text.node("privacy.link")}</Link>
        </div>

      </div>
      </main>
      <Website43Footer copy={siteCopyOverride} />
    </div>
  );
}
