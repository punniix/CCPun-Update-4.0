import type { Metadata } from "next";
import type { ReactNode } from "react";
import type { ArticleAuthorProfile } from "@/lib/content/types";
import Image from "next/image";
import Link from "next/link";
import { getPublicCopy } from "@/lib/content/public-copy";
import { publicCopyText, type PublicCopyValues } from "@/lib/content/public-copy-registry";
import { getPrimaryAuthorProfile } from "@/lib/content/sanity";
import { IS_REVIEW_ENVIRONMENT } from "@/lib/deployment-environment";
import { CCPUN_PERSON_ID } from "@/lib/seo/structured-data/entity-ids";
import { personSchema } from "@/lib/seo/structured-data/site-schema";
import V5Page from "@/components/layout/v5/V5Page";
import shell from "@/components/layout/v5/V5.module.css";
import { V5Breadcrumbs, v5Label } from "@/components/layout/v5/V5Primitives";
import { v5AdvisorProfile, v5Partners } from "@/components/layout/v5/advisor-profile";
import V5CredentialCards from "@/components/layout/v5/V5CredentialCards";
import OwnerStoryV2, { keepWords } from "./OwnerStoryV2";
import { V5_TOOLS_HUB } from "@/components/layout/v5/constants";
import styles from "./About.module.css";
import flipStyles from "@/components/layout/v5/V5LicenceFlip.module.css";
import { FATHER_STORY_KEEP } from "./father-story-copy";

/*
  Owner-approved new indexable URL (2026-10-25): /about/. No historical About URL exists in the
  legacy ledger, URL/taxonomy owners or the migration contract, so there is no redirect. Every
  visible sentence reuses copy that is already approved on the site (home About section, credential
  and licence data, partners, reviews); slots that need new owner copy render only on UAT/preview.
*/
const URL = "https://ccpun.com/about/";
// Title reuses the approved About heading (home.eyebrow2) and the site Person name.
const TITLE = `รู้จักที่ปรึกษาทางการเงิน CCPun | ${personSchema.name} (${personSchema.alternateName[0]})`;
const DESCRIPTION = personSchema.description;
const PORTRAIT_DARK = "/assets/ccpun-portrait-v5-about-dark.webp";
const PORTRAIT_LIGHT = "/assets/ccpun-portrait-v5-about-light.webp";
// The existing father-trial strings remain UAT-only and keep their original approval status.
type AboutText = ReturnType<typeof publicCopyText>;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL },
  // UAT stays noindex like every other review page; Production indexes the About page.
  robots: IS_REVIEW_ENVIRONMENT ? { index: false, follow: false } : { index: true, follow: true },
  openGraph: { type: "profile", locale: "th_TH", url: URL, title: TITLE, description: DESCRIPTION, siteName: "CCPun Financial Advisor", images: [{ url: "https://ccpun.com/og-image-20260610.webp?v=68ae8d8", width: 1200, height: 630 }] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

/** UAT-only slot for owner copy that does not exist yet. Production builds never render it. */
function OwnerCopySlot({ slot, note }: { slot: string; note: string }) {
  if (!IS_REVIEW_ENVIRONMENT) return null;
  return <p className={styles.slot} data-uat-placeholder={slot}><strong>UAT</strong> {note}</p>;
}

/**
 * The owner-chosen father photo (treatment a, colour, 2026-10-25) accompanies the UAT story trial.
 * The story and caption await final owner approval; Production builds never render this photo.
 */
function FatherPhotoSlot({ text }: { text: AboutText }) {
  if (!IS_REVIEW_ENVIRONMENT) return null;
  const caption = text.node("about.father.caption");
  return (
    <figure className={styles.fatherPhoto} data-uat-placeholder="about-father-photo">
      <Image src="/assets/ccpun-father-v5-colour.webp" alt={text("about.father.photoAlt")} width={1086} height={1448} sizes="(max-width: 1279px) min(420px, calc(100vw - 40px)), (max-width: 1439px) calc(37.5vw - 84px), 456px" />
      <figcaption>{typeof caption === "string" ? caption.split("\n").map((line, index) => <span key={line}>{index > 0 ? <br /> : null}{keepFatherPhrase(line)}</span>) : caption}</figcaption>
    </figure>
  );
}

/** Match the existing licence-card `keep` mechanism without changing the plain text. */
function keepFatherPhrase(value: ReactNode, wrapTerms = false) {
  if (typeof value !== "string") return value;
  const at = value.indexOf(FATHER_STORY_KEEP);
  if (at < 0) return value;
  const phrase = wrapTerms ? <span className={styles.fatherPhrase}>{FATHER_STORY_KEEP.split(" ").flatMap((term, index) => [
    index ? " " : null, <span className={flipStyles.keep} key={term}>{term}</span>,
  ])}</span> : <span className={flipStyles.keep}>{FATHER_STORY_KEEP}</span>;
  return <>{value.slice(0, at)}{phrase}{value.slice(at + FATHER_STORY_KEEP.length)}</>;
}

function FatherStory({ text }: { text: AboutText }) {
  if (!IS_REVIEW_ENVIRONMENT) return null;
  return (
    <div className={styles.fatherStory} data-uat-trial="about-father-story">
      <h3>{text.node("about.father.heading")}</h3>
      <p>{keepFatherPhrase(text.node("about.father.paragraph1"), true)}</p>
      <FatherPhotoSlot text={text} />
      <div className={styles.fatherStoryBody}>
        {([2, 3, 4, 5, 6] as const).map(index => <p key={index}>{text.node(`about.father.paragraph${index}`)}</p>)}
        <ul>{([1, 2, 3] as const).map(index => <li key={index}>{text.node(`about.father.question${index}`)}</li>)}</ul>
        <p>{text.node("about.father.paragraph7")}</p>
      </div>
    </div>
  );
}

export async function renderAboutPage(copy?: PublicCopyValues, siteCopy?: PublicCopyValues, homeCopy?: PublicCopyValues, authorOverride?: ArticleAuthorProfile | null) {
  const [authorProfile, homeValues, siteValues, pageValues] = await Promise.all([
    authorOverride === undefined ? getPrimaryAuthorProfile().catch(() => null) : authorOverride,
    homeCopy ?? getPublicCopy("home"), siteCopy ?? getPublicCopy("site"), copy ?? getPublicCopy("about"),
  ]);
  const text = publicCopyText(pageValues);
  const aboutWords = (value: ReactNode) => IS_REVIEW_ENVIRONMENT ? keepWords(value) : value;
  const home = publicCopyText(homeValues);
  const site = publicCopyText(siteValues);
  const { displayName, role, qualification, licenceCards } = v5AdvisorProfile(authorProfile, home);
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
      <section className={styles.hero} aria-labelledby="about-title">
        <div className={shell.inner}>
          <V5Breadcrumbs label={site("site.nav.mainLabel")} items={[{ href: "/", label: text("about.breadcrumb.home") }, { label: aboutLabel }]} />
          <div className={styles.heroGrid}>
            <div>
              <h1 id="about-title" className={shell.h1}>{aboutWords(home.node("home.eyebrow2"))}</h1>
              <p className={styles.identity}><strong>{aboutWords(displayName)}</strong><span>{aboutWords(role)}</span></p>
              {IS_REVIEW_ENVIRONMENT ? <p className={styles.ownerHeroIntro}>{aboutWords(text.node("about.storyV2.heroIntro"))}</p> : null}
              {!IS_REVIEW_ENVIRONMENT ? <V5CredentialCards className={styles.credentials} qualification={qualification} licenceCards={licenceCards} /> : null}
            </div>
            <div className={styles.portraitFrame}>
              {/* Owner-approved portrait (photo 4, v5b set, 2026-10-25), art-directed per theme. Next's theme-image
                  pattern: both stay lazy with high fetch priority, so only the visible theme's file is fetched. */}
              <Image className={`${styles.portrait} ${styles.portraitDark}`} src={PORTRAIT_DARK} alt={home("home.website43Homealt8")} width={1200} height={1800} sizes="(max-width: 899px) calc(100vw - 40px), 440px" fetchPriority="high" />
              <Image className={`${styles.portrait} ${styles.portraitLight}`} src={PORTRAIT_LIGHT} alt={home("home.website43Homealt8")} width={1200} height={1800} sizes="(max-width: 899px) calc(100vw - 40px), 440px" fetchPriority="high" />
            </div>
          </div>
        </div>
      </section>

      {IS_REVIEW_ENVIRONMENT ? (
        <section className={shell.section} aria-label="ประวัติและแนวทางการวางแผนการเงิน">
          <div className={shell.inner}>
            <OwnerStoryV2 text={text} qualification={qualification} licenceCards={licenceCards} />
          </div>
        </section>
      ) : (
        <section className={shell.section} aria-labelledby="about-story">
          <div className={`${shell.inner} ${styles.split}`}>
            <h2 id="about-story" className={shell.h2}>{aboutWords(home.node("home.h2"))}</h2>
            <div className={styles.story}>
              <OwnerCopySlot slot="about-start-years" note="ปีที่เริ่มงานการเงินและการลงทุน และปีที่เริ่มเป็นที่ปรึกษา (รอข้อมูลจากเจ้าของ)" />
              <p>{aboutWords(home.node("home.p"))}</p>
              <FatherStory text={text} />
              <p>{aboutWords(home.node("home.p2"))}</p>
              <p>{aboutWords(home.node("home.p3"))}</p>
            </div>
          </div>
        </section>
      )}

      <section className={shell.sectionAlt} aria-labelledby="about-partners">
        <div className={shell.inner}>
          <h2 id="about-partners" className={shell.h2}>{aboutWords(home.node("home.partnerLabel"))}</h2>
          <ul className={styles.partners}>
            {partners.map((partner) => (
              <li className={styles.partner} key={partner.name}>
                <Image src={partner.src} alt={partner.name} width={partner.width} height={partner.height} sizes="120px" loading="lazy" />
                <strong>{aboutWords(partner.name)}</strong><span>{aboutWords(partner.role)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={shell.section} aria-labelledby="about-reviews">
        <div className={shell.inner}>
          <h2 id="about-reviews" className={shell.h2}>{aboutWords(home.node("home.website43Hometitle2"))}</h2>
          <div className={styles.quotes}>
            <figure className={styles.quote}><blockquote>{aboutWords(home.node("home.blockquote"))}</blockquote><figcaption>{aboutWords(home.node("home.cite"))}</figcaption></figure>
            <figure className={styles.quote}><blockquote>{aboutWords(home.node("home.blockquote2"))}</blockquote><figcaption>{aboutWords(home.node("home.cite2"))}</figcaption></figure>
          </div>
          <div className={styles.next}>
            <Link className={shell.textLink} href="/blog/">{v5Label(home("home.toolCtaAction"))}</Link>
            <Link className={shell.textLink} href={V5_TOOLS_HUB.href}>{aboutWords(text.node("about.next.tools"))}</Link>
          </div>
        </div>
      </section>
    </V5Page>
  );
}

export default function AboutPage() {
  return renderAboutPage();
}
