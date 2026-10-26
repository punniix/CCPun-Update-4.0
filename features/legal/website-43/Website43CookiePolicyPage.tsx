// Retained Website 4.3 legal presentation (rollback target, not routed). Website v5 Phase B renders
// the legal pages through features/legal/v5; SEO metadata stays with features/legal/pages/*.
import { getPublicCopy } from "@/lib/content/public-copy";
import { publicCopyText, type PublicCopyValues } from "@/lib/content/public-copy-registry";
import Link from "next/link";
import { ArrowLeft, Cookie } from "lucide-react";
import { Website43Footer, Website43Navbar } from "@/components/layout/website-43/Website43Shared";
import w43Styles from "@/components/layout/website-43/Website43.module.css";
import legalStyles from "@/components/layout/website-43/Website43Legal.module.css";


export async function renderWebsite43CookiePolicyPage(copyOverride?: PublicCopyValues, siteCopyOverride?: PublicCopyValues) {
  const text = publicCopyText(copyOverride ?? await getPublicCopy("cookies"));
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
            <ArrowLeft />{text.node("cookies.link")}</Link>
        </div>

        {/* Header */}
        <div className={legalStyles.header}>
          <div className={legalStyles.iconWrap}>
            <Cookie className={legalStyles.headerIcon} />
          </div>
          <h1 className={legalStyles.title}>{text.node("cookies.h1")}</h1>
          <div className={legalStyles.headerRule} />
          <p className={legalStyles.updated}>{text.node("cookies.p")}</p>
        </div>

        {/* Content */}
        <div className={legalStyles.content}>

          {/* Intro */}
          <p className="text-foreground leading-relaxed">{text.node("cookies.p2")}</p>

          {/* Section 1 — ประเภทคุกกี้ที่ใช้ (ตาราง 4 หมวด) */}
          <section>
            <h2 className="text-xl font-semibold text-gold-gradient mb-3">{text.node("cookies.h2")}</h2>
            <div className="section-divider mb-5" style={{ marginLeft: 0, width: "3rem" }} />

            {/* หมวด 1 — คุกกี้ที่จำเป็น */}
            <div
              className={`${legalStyles.policyCard} rounded-xl p-5 mb-4`}
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <div className="flex items-start gap-3 mb-3">
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5"
                  style={{
                    background: "rgba(220,190,130,0.15)",
                    color: "hsl(45,70%,65%)",
                    border: "1px solid rgba(220,190,130,0.25)",
                  }}
                >{text.node("cookies.span")}</span>
                <div>
                  <p className="text-foreground font-medium text-sm mb-1">{text.node("cookies.p3")}</p>
                  <p className="text-muted-foreground text-[13px] md:text-sm leading-relaxed">{text.node("cookies.p4")}</p>
                </div>
              </div>
              <table className="w-full text-[13px] md:text-sm text-muted-foreground">
                <tbody className="divide-y divide-border/20">
                  {[
                    { label: text("cookies.cookiePolicyPageText"), value: "ccpun_cookie_consent (localStorage)" },
                    { label: text("cookies.cookiePolicyPageText2"), value: text("cookies.cookiePolicyPageText3") },
                    { label: text("cookies.cookiePolicyPageText4"), value: text("cookies.cookiePolicyPageText5") },
                    { label: text("cookies.cookiePolicyPageText6"), value: text("cookies.cookiePolicyPageText7") },
                  ].map(({ label, value }) => (
                    <tr key={label}>
                      <td className="py-2 pr-4 text-foreground font-medium w-36 align-top">{label}</td>
                      <td className="py-2 leading-relaxed">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* หมวด 2 — คุกกี้เพิ่มประสิทธิภาพ */}
            <div
              className={`${legalStyles.policyCard} rounded-xl p-5 mb-4`}
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <div className="flex flex-wrap items-start gap-3">
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5"
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    color: "hsl(0,10%,75%)",
                    border: "1px solid rgba(255,255,255,0.14)",
                  }}
                >{text.node("cookies.span2")}</span>
                <div className="min-w-0 flex-1 basis-40 break-words">
                  <p className="text-foreground font-medium text-sm mb-1">{text.node("cookies.p5")}</p>
                  <p className="text-muted-foreground text-[13px] md:text-sm leading-relaxed">{text.node("cookies.p6")}</p>
                </div>
              </div>
            </div>

            {/* หมวด 3 — คุกกี้วิเคราะห์ */}
            <div
              className={`${legalStyles.policyCard} rounded-xl p-5 mb-4`}
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <div className="flex items-start gap-3 mb-3">
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5"
                  style={{
                    background: "rgba(100,160,255,0.12)",
                    color: "hsl(210,80%,70%)",
                    border: "1px solid rgba(100,160,255,0.2)",
                  }}
                >{text.node("cookies.span3")}</span>
                <div>
                  <p className="text-foreground font-medium text-sm mb-1">{text.node("cookies.p7")}</p>
                  <p className="text-muted-foreground text-[13px] md:text-sm leading-relaxed">{text.node("cookies.p8")}</p>
                </div>
              </div>
              <table className="w-full text-[13px] md:text-sm text-muted-foreground">
                <tbody className="divide-y divide-border/20">
                  {[
                    { label: text("cookies.cookiePolicyPageText8"), value: "_ga, _ga_*, _gid" },
                    { label: text("cookies.cookiePolicyPageText2"), value: text("cookies.cookiePolicyPageText9") },
                    { label: text("cookies.cookiePolicyPageText4"), value: text("cookies.cookiePolicyPageText10") },
                    { label: text("cookies.cookiePolicyPageText11"), value: text("cookies.cookiePolicyPageText12") },
                    { label: text("cookies.cookiePolicyPageText13"), value: text("cookies.cookiePolicyPageText14") },
                  ].map(({ label, value }) => (
                    <tr key={label}>
                      <td className="py-2 pr-4 text-foreground font-medium w-36 align-top">{label}</td>
                      <td className="py-2 leading-relaxed">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* หมวด 4 — คุกกี้การตลาด */}
            <div
              className={`${legalStyles.policyCard} rounded-xl p-5 mb-4`}
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <div className="flex items-start gap-3 mb-3">
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5"
                  style={{
                    background: "rgba(180,100,255,0.1)",
                    color: "hsl(270,70%,70%)",
                    border: "1px solid rgba(180,100,255,0.18)",
                  }}
                >{text.node("cookies.span4")}</span>
                <div>
                  <p className="text-foreground font-medium text-sm mb-1">{text.node("cookies.p9")}</p>
                  <p className="text-muted-foreground text-[13px] md:text-sm leading-relaxed">{text.node("cookies.p10")}</p>
                </div>
              </div>
              <table className="w-full text-[13px] md:text-sm text-muted-foreground">
                <tbody className="divide-y divide-border/20">
                  {[
                    { label: text("cookies.cookiePolicyPageText8"), value: text("cookies.cookiePolicyPageText15") },
                    { label: text("cookies.cookiePolicyPageText2"), value: text("cookies.cookiePolicyPageText16") },
                    { label: text("cookies.cookiePolicyPageText17"), value: text("cookies.cookiePolicyPageText18") },
                    { label: text("cookies.cookiePolicyPageText19"), value: text("cookies.cookiePolicyPageText20") },
                    { label: text("cookies.cookiePolicyPageText11"), value: text("cookies.cookiePolicyPageText21") },
                    { label: text("cookies.cookiePolicyPageText13"), value: text("cookies.cookiePolicyPageText14") },
                  ].map(({ label, value }) => (
                    <tr key={label}>
                      <td className="py-2 pr-4 text-foreground font-medium w-36 align-top">{label}</td>
                      <td className="py-2 leading-relaxed">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 2 — วัตถุประสงค์ */}
          <section>
            <h2 className="text-xl font-semibold text-gold-gradient mb-3">{text.node("cookies.h22")}</h2>
            <div className="section-divider mb-5" style={{ marginLeft: 0, width: "3rem" }} />
            <ul className="space-y-2 text-foreground">
              {[
                text("cookies.cookiePolicyPageText22"),
                text("cookies.cookiePolicyPageText23"),
                text("cookies.cookiePolicyPageText24"),
                text("cookies.cookiePolicyPageText25"),
                text("cookies.cookiePolicyPageText26"),
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                  <span className="text-sm leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground text-sm leading-relaxed mt-4">{text.node("cookies.p11")}</p>
          </section>

          {/* Section 3 — วิธีจัดการ */}
          <section>
            <h2 className="text-xl font-semibold text-gold-gradient mb-3">{text.node("cookies.h23")}</h2>
            <div className="section-divider mb-5" style={{ marginLeft: 0, width: "3rem" }} />
            <p className="text-muted-foreground text-sm leading-relaxed mb-4">{text.node("cookies.p12")}</p>
            <ul className="space-y-4 text-foreground">
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm mb-1">{text.node("cookies.p13")}</p>
                  <p className="text-muted-foreground text-sm leading-relaxed">{text.node("cookies.p14")}</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm mb-1">{text.node("cookies.p15")}</p>
                  <p className="text-muted-foreground text-sm leading-relaxed">{text.node("cookies.p16")}</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm mb-1">{text.node("cookies.p17")}</p>
                  <p className="text-muted-foreground text-sm leading-relaxed">{text.node("cookies.p18")}</p>
                </div>
              </li>
            </ul>
          </section>

          {/* Section 4 — Provider privacy */}
          <section>
            <h2 className="text-xl font-semibold text-gold-gradient mb-3">{text.node("cookies.h24")}</h2>
            <div className="section-divider mb-5" style={{ marginLeft: 0, width: "3rem" }} />
            <p className="text-muted-foreground text-sm leading-relaxed">{text.node("cookies.p19")}{" "}
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline underline-offset-2"
              >{text.node("cookies.a")}</a>
              {" "}{text.node("cookies.p20")}{" "}
              <a
                href="https://www.facebook.com/privacy/policy/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline underline-offset-2"
              >{text.node("cookies.a2")}</a>
              {" "}{text.node("cookies.p21")}</p>
          </section>

          {/* Section 5 — Link to Privacy */}
          <section>
            <h2 className="text-xl font-semibold text-gold-gradient mb-3">{text.node("cookies.h25")}</h2>
            <div className="section-divider mb-5" style={{ marginLeft: 0, width: "3rem" }} />
            <p className="text-muted-foreground text-sm leading-relaxed">{text.node("cookies.p22")}{" "}
              <Link
                href="/privacy"
                className="text-primary hover:underline underline-offset-2"
              >{text.node("cookies.link2")}</Link>{" "}{text.node("cookies.p23")}</p>
          </section>

        </div>

        {/* Bottom back link */}
        <div className={legalStyles.bottomBack}>
          <Link
            href="/"
            className={legalStyles.backLink}
          >
            <ArrowLeft />{text.node("cookies.link")}</Link>
        </div>

      </div>
      </main>
      <Website43Footer copy={siteCopyOverride} />
    </div>
  );
}
