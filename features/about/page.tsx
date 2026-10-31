import type { Metadata } from "next";
import type { ReactNode } from "react";
import type { ArticleAuthorProfile } from "@/lib/content/types";
import Image from "next/image";
import { getPublicCopy } from "@/lib/content/public-copy";
import { publicCopyText, type PublicCopyValues } from "@/lib/content/public-copy-registry";
import { getPrimaryAuthorProfile } from "@/lib/content/sanity";
import { IS_REVIEW_ENVIRONMENT } from "@/lib/deployment-environment";
import { CCPUN_PERSON_ID } from "@/lib/seo/structured-data/entity-ids";
import { personSchema } from "@/lib/seo/structured-data/site-schema";
import V5Page from "@/components/layout/v5/V5Page";
import shell from "@/components/layout/v5/V5.module.css";
import { v5AdvisorProfile, v5Partners } from "@/components/layout/v5/advisor-profile";
import OwnerStoryV2, { keepWords } from "./OwnerStoryV2";
import styles from "./About.module.css";

// Owner-approved About narrative and layout from canonical FigCraft 0199.
// Production and UAT share this presentation; environment indexability stays separate.
const URL = "https://ccpun.com/about/";
// Title reuses the approved About heading (home.eyebrow2) and the site Person name.
const TITLE = `รู้จักที่ปรึกษาทางการเงิน CCPun | ${personSchema.name} (${personSchema.alternateName[0]})`;
const DESCRIPTION = personSchema.description;
const PORTRAIT_DARK = "/assets/website-v5/about-dark-white-outline-821c292b.png";
const PORTRAIT_LIGHT = "/assets/website-v5/about-light-white-outline-d013c999.png";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL },
  // UAT stays noindex like every other review page; Production indexes the About page.
  robots: IS_REVIEW_ENVIRONMENT ? { index: false, follow: false } : { index: true, follow: true },
  openGraph: { type: "profile", locale: "th_TH", url: URL, title: TITLE, description: DESCRIPTION, siteName: "CCPun Financial Advisor", images: [{ url: "https://ccpun.com/og-image-20260610.webp?v=68ae8d8", width: 1200, height: 630 }] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export async function renderAboutPage(copy?: PublicCopyValues, siteCopy?: PublicCopyValues, homeCopy?: PublicCopyValues, authorOverride?: ArticleAuthorProfile | null) {
  const [authorProfile, homeValues, siteValues, pageValues] = await Promise.all([
    authorOverride === undefined ? getPrimaryAuthorProfile().catch(() => null) : authorOverride,
    homeCopy ?? getPublicCopy("home"), siteCopy ?? getPublicCopy("site"), copy ?? getPublicCopy("about"),
  ]);
  const text = publicCopyText(pageValues);
  const aboutWords = (value: ReactNode) => keepWords(value);
  const home = publicCopyText(homeValues);
  const site = publicCopyText(siteValues);
  const { qualification, licenceCards } = v5AdvisorProfile(authorProfile, home);
  const partners = v5Partners(home);
  const aboutLabel = site("site.footer.about");

  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ProfilePage",
        "@id": `${URL}#profilepage`,
        url: URL,
        name: TITLE,
        description: DESCRIPTION,
        inLanguage: "th",
        isPartOf: { "@id": "https://ccpun.com/#website" },
        breadcrumb: { "@id": `${URL}#breadcrumb` },
        mainEntity: { "@id": CCPUN_PERSON_ID },
        about: { "@id": CCPUN_PERSON_ID },
      },
      // The full Person entity (credentials, organisation, sameAs) is emitted site-wide by the
      // layout graph under the same @id; this node only adds the portrait shown on this page.
      { "@type": "Person", "@id": CCPUN_PERSON_ID, name: personSchema.name, image: `https://ccpun.com${PORTRAIT_DARK}` },
      {
        "@type": "BreadcrumbList",
        "@id": `${URL}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: text("about.breadcrumb.home"), item: "https://ccpun.com/" },
          { "@type": "ListItem", position: 2, name: aboutLabel, item: URL },
        ],
      },
    ],
  };

  return (
    <V5Page current="/about/" siteCopy={siteValues}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
        <section className={`${styles.nativeBand} ${styles.nativeHero}`} aria-labelledby="about-title">
          <div className={`${shell.inner} ${styles.nativeHeroGrid}`}>
            <div className={`${styles.portraitFrame} ${styles.nativePortraitFrame}`}>
              <Image className={`${styles.portrait} ${styles.portraitDark}`} src={PORTRAIT_DARK} alt="ภาพถ่ายที่ปรึกษาการเงิน CCPun สวมเสื้อสูทสีเข้มและแว่นตา" width={1248} height={1872} sizes="(max-width: 899px) calc(100vw - 40px), 544px" fetchPriority="high" />
              <Image className={`${styles.portrait} ${styles.portraitLight}`} src={PORTRAIT_LIGHT} alt="ภาพถ่ายที่ปรึกษาการเงิน CCPun สวมเสื้อสูทสีเข้มและแว่นตา" width={1248} height={1872} sizes="(max-width: 899px) calc(100vw - 40px), 544px" fetchPriority="high" />
            </div>
            <div className={styles.nativeHeroCopy}>
              <h1 id="about-title">{aboutWords(text.node("about.hero.heading"))}</h1>
              <p className={styles.nativeHeroIntro}>{aboutWords(text.node("about.storyV2.heroIntro"))}</p>
            </div>
          </div>
        </section>
      <OwnerStoryV2 text={text} qualification={qualification} licenceCards={licenceCards} />

      <section className={`${styles.nativeBand} ${styles.nativeAlternate}`} aria-labelledby="about-how">
        <div className={`${shell.inner} ${styles.nativeSplit}`}>
          <div>
            <h2 id="about-how" className={styles.nativeHeading}>{aboutWords(text.node("about.how.heading"))}</h2>
            <p className={styles.nativeLead}>{aboutWords(text.node("about.how.intro"))}</p>
          </div>
          <ol className={styles.nativeSteps}>
            {([1, 2, 3, 4] as const).map((index) => <li key={index}>
              <span className={styles.nativeStepNumber} aria-hidden="true">{String(index).padStart(2, "0")}</span>
              <div><h3>{aboutWords(text.node(`about.how.step${index}.heading`))}</h3><p>{aboutWords(text.node(`about.how.step${index}.body`))}</p></div>
            </li>)}
          </ol>
        </div>
      </section>

      <section className={styles.nativePartners} aria-labelledby="about-partners">
        <div className={shell.inner}>
          <h2 id="about-partners" className={shell.h2}>{aboutWords(text.node("about.partners.heading"))}</h2>
          <ul className={`${styles.partners} ${styles.nativePartnerTiles}`}>
            {partners.map((partner) => (
              <li className={styles.partner} key={partner.name}>
                <Image src={partner.src} alt="" width={partner.width} height={partner.height} sizes="120px" loading="lazy" />
                <span className={styles.accessibleOnly}>{aboutWords(partner.role)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={`${styles.nativeBand} ${styles.nativeAlternate}`} aria-labelledby="about-reviews">
        <div className={shell.inner}>
          <h2 id="about-reviews" className={shell.h2}>{aboutWords(text.node("about.reviews.heading"))}</h2>
          <div className={`${styles.quotes} ${styles.nativeQuotes}`}>
            <figure className={styles.quote}><blockquote>{aboutWords(home.node("home.blockquote"))}</blockquote><figcaption>{aboutWords(home.node("home.cite"))}</figcaption></figure>
            <figure className={styles.quote}><blockquote>{aboutWords(home.node("home.blockquote2"))}</blockquote><figcaption>{aboutWords(home.node("home.cite2"))}</figcaption></figure>
          </div>
        </div>
      </section>

      <section className={styles.nativeBand} aria-labelledby="about-faq">
          <div className={`${shell.inner} ${styles.nativeSplit}`}>
            <h2 id="about-faq" className={styles.nativeHeading}>{aboutWords(text.node("about.faq.heading"))}</h2>
            <div className={styles.nativeFaq}>
              {([1, 2] as const).map((index) => <details key={index}>
                <summary><span>{aboutWords(text.node(`about.faq${index}.question`))}</span></summary>
                <p>{aboutWords(text.node(`about.faq${index}.answer`))}</p>
              </details>)}
            </div>
          </div>
        </section>
    </V5Page>
  );
}

export default function AboutPage() {
  return renderAboutPage();
}
