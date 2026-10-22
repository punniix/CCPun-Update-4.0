import { getPublicCopy } from "@/lib/content/public-copy";
import { publicCopyText, type PublicCopyValues } from "@/lib/content/public-copy-registry";
import { resolvePageSeoMetadata } from "@/lib/seo/page-seo";
import type { Metadata, ResolvingMetadata } from "next";
import { IS_REVIEW_ENVIRONMENT } from "@/lib/deployment-environment";
import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";
import { Website43Footer, Website43Navbar } from "@/components/layout/website-43/Website43Shared";
import w43Styles from "@/components/layout/website-43/Website43.module.css";
import legalStyles from "@/components/layout/website-43/Website43Legal.module.css";

const metadata: Metadata = {
  title: "นโยบายความเป็นส่วนตัว | CCPun ที่ปรึกษาทางการเงิน",
  description: "CCPun ให้ความสำคัญกับการคุ้มครองข้อมูลส่วนบุคคลของคุณ อ่านนโยบายความเป็นส่วนตัวของเราเพื่อทำความเข้าใจว่าเราเก็บและใช้ข้อมูลอย่างไร",
  robots: IS_REVIEW_ENVIRONMENT ? { index: false, follow: false } : { index: true, follow: true },
  alternates: { canonical: "https://ccpun.com/privacy/" },
  openGraph: {
    title: "นโยบายความเป็นส่วนตัว | CCPun ที่ปรึกษาทางการเงิน",
    description: "CCPun ให้ความสำคัญกับการคุ้มครองข้อมูลส่วนบุคคลของคุณ อ่านนโยบายความเป็นส่วนตัวของเราเพื่อทำความเข้าใจว่าเราเก็บและใช้ข้อมูลอย่างไร",
    url: "https://ccpun.com/privacy/",
  },
  twitter: {
    title: "นโยบายความเป็นส่วนตัว | CCPun ที่ปรึกษาทางการเงิน",
    description: "CCPun ให้ความสำคัญกับการคุ้มครองข้อมูลส่วนบุคคลของคุณ อ่านนโยบายความเป็นส่วนตัวของเราเพื่อทำความเข้าใจว่าเราเก็บและใช้ข้อมูลอย่างไร",
  },
};

export async function renderPrivacyPage(copyOverride?: PublicCopyValues, siteCopyOverride?: PublicCopyValues) {
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
            <ArrowLeft />{text("privacy.link")}</Link>
        </div>

        {/* Header */}
        <div className={legalStyles.header}>
          <div className={legalStyles.iconWrap}>
            <Shield className={legalStyles.headerIcon} />
          </div>
          <h1 className={legalStyles.title}>{text("privacy.h1")}</h1>
          <div className={legalStyles.headerRule} />
          <p className={legalStyles.updated}>{text("privacy.p")}</p>
        </div>

        {/* Content */}
        <div className={legalStyles.content}>

          {/* Intro */}
          <p className="text-foreground leading-relaxed">{text("privacy.p2")}</p>

          {/* Section 1 */}
          <section>
            <h2 className="text-xl font-semibold text-gold-gradient mb-3">{text("privacy.h2")}</h2>
            <div className="section-divider mb-5" style={{ marginLeft: 0, width: "3rem" }} />
            <p className="text-muted-foreground leading-relaxed mb-4">{text("privacy.p3")}</p>
            <p className="text-muted-foreground leading-relaxed mt-4">{text("privacy.p4")}</p>
            <p className="text-muted-foreground leading-relaxed mt-4">{text("privacy.p5")}</p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-xl font-semibold text-gold-gradient mb-3">{text("privacy.h22")}</h2>
            <div className="section-divider mb-5" style={{ marginLeft: 0, width: "3rem" }} />
            <p className="text-muted-foreground leading-relaxed mb-4">{text("privacy.p6")}</p>
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
            <h2 className="text-xl font-semibold text-gold-gradient mb-3">{text("privacy.h23")}</h2>
            <div className="section-divider mb-5" style={{ marginLeft: 0, width: "3rem" }} />
            <p className="text-foreground leading-relaxed font-medium mb-3">{text("privacy.p7")}</p>
            <p className="text-muted-foreground leading-relaxed">{text("privacy.p8")}</p>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-xl font-semibold text-gold-gradient mb-3">{text("privacy.h24")}</h2>
            <div className="section-divider mb-5" style={{ marginLeft: 0, width: "3rem" }} />
            <p className="text-muted-foreground leading-relaxed">{text("privacy.p9")}</p>
          </section>

          {/* Section 4b — FHC Tool Data */}
          <section>
            <h2 className="text-xl font-semibold text-gold-gradient mb-3">{text("privacy.h25")}</h2>
            <div className="section-divider mb-5" style={{ marginLeft: 0, width: "3rem" }} />
            <p className="text-muted-foreground leading-relaxed">{text("privacy.p10")}</p>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-xl font-semibold text-gold-gradient mb-3">{text("privacy.h26")}</h2>
            <div className="section-divider mb-5" style={{ marginLeft: 0, width: "3rem" }} />
            <p className="text-muted-foreground leading-relaxed mb-4">{text("privacy.p11")}</p>
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
            <p className="text-muted-foreground leading-relaxed mt-4">{text("privacy.p12")}{" "}
              <a
                href="https://lin.ee/tqLCs4f"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >{text("privacy.a")}</a>{" "}{text("privacy.p13")}</p>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-xl font-semibold text-gold-gradient mb-3">{text("privacy.h27")}</h2>
            <div className="section-divider mb-5" style={{ marginLeft: 0, width: "3rem" }} />
            <p className="text-muted-foreground leading-relaxed mb-4">{text("privacy.p14")}</p>
            <address className="not-italic space-y-2 text-foreground">
              <p>
                <span className="text-muted-foreground">{text("privacy.span")}</span>{" "}
                <a
                  href="https://lin.ee/tqLCs4f"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >{text("privacy.a2")}</a>
              </p>
              <p>
                <span className="text-muted-foreground">{text("privacy.span2")}</span>{" "}
                <a
                  href="mailto:chanatip.chid@gmail.com"
                  className="text-primary hover:underline"
                >{text("privacy.a3")}</a>
              </p>
            </address>
          </section>

          {/* Section 7 — Data Controller */}
          <section>
            <h2 className="text-xl font-semibold text-gold-gradient mb-3">{text("privacy.h28")}</h2>
            <div className="section-divider mb-5" style={{ marginLeft: 0, width: "3rem" }} />
            <p className="text-muted-foreground leading-relaxed mb-4">{text("privacy.p15")}</p>
            <address className="not-italic space-y-2 text-foreground">
              <p>
                <span className="text-muted-foreground">{text("privacy.span3")}</span>{" "}{text("privacy.p16")}</p>
              <p>
                <span className="text-muted-foreground">{text("privacy.span2")}</span>{" "}
                <a
                  href="mailto:chanatip.chid@gmail.com"
                  className="text-primary hover:underline"
                >{text("privacy.a3")}</a>
              </p>
              <p>
                <span className="text-muted-foreground">{text("privacy.span4")}</span>{" "}
                <a href="tel:0633438513" className="text-primary hover:underline">{text("privacy.a4")}</a>
              </p>
            </address>
          </section>

          {/* Section 8 — Cookie */}
          <section>
            <h2 className="text-xl font-semibold text-gold-gradient mb-3">{text("privacy.h29")}</h2>
            <div className="section-divider mb-5" style={{ marginLeft: 0, width: "3rem" }} />
            <p className="text-muted-foreground leading-relaxed mb-3">{text("privacy.p17")}</p>
            <p className="text-muted-foreground leading-relaxed">{text("privacy.p18")}{" "}
              <a
                href="/cookie-policy"
                className="text-primary hover:underline"
              >{text("privacy.a5")}</a>
            </p>
          </section>

          {/* Section 9 */}
          <section>
            <h2 className="text-xl font-semibold text-gold-gradient mb-3">{text("privacy.h210")}</h2>
            <div className="section-divider mb-5" style={{ marginLeft: 0, width: "3rem" }} />
            <p className="text-muted-foreground leading-relaxed">{text("privacy.p19")}{" "}
              <span className="text-foreground font-medium">{text("privacy.span5")}</span>
              {" "}{text("privacy.p20")}</p>
          </section>

        </div>

        {/* Bottom back link */}
        <div className={legalStyles.bottomBack}>
          <Link
            href="/"
            className={legalStyles.backLink}
          >
            <ArrowLeft />{text("privacy.link")}</Link>
        </div>

      </div>
      </main>
      <Website43Footer copy={siteCopyOverride} />
    </div>
  );
}

export function generateMetadata(props: unknown, parent: ResolvingMetadata) {
  void props;
  return resolvePageSeoMetadata("/privacy/", metadata, parent);
}

export default function PrivacyPage() { return renderPrivacyPage(); }
