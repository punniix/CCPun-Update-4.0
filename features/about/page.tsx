import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getPublicCopy } from "@/lib/content/public-copy";
import { publicCopyText } from "@/lib/content/public-copy-registry";
import { getPrimaryAuthorProfile } from "@/lib/content/sanity";
import { IS_REVIEW_ENVIRONMENT } from "@/lib/deployment-environment";
import { CCPUN_PERSON_ID } from "@/lib/seo/structured-data/entity-ids";
import { personSchema } from "@/lib/seo/structured-data/site-schema";
import V5Page from "@/components/layout/v5/V5Page";
import shell from "@/components/layout/v5/V5.module.css";
import { V5Breadcrumbs, v5Label } from "@/components/layout/v5/V5Primitives";
import { v5AdvisorProfile, v5Partners } from "@/components/layout/v5/advisor-profile";
import V5CredentialCards from "@/components/layout/v5/V5CredentialCards";
import { V5_TOOLS_HUB } from "@/components/layout/v5/constants";
import styles from "./About.module.css";
import flipStyles from "@/components/layout/v5/V5LicenceFlip.module.css";
import { FATHER_STORY_HEADING, FATHER_STORY_KEEP, FATHER_STORY_PARAGRAPHS, FATHER_STORY_QUESTIONS, FATHER_PHOTO_CAPTION } from "./father-story-copy";

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
// UAT-only alt text for the father photo (new string, pending owner approval).
const FATHER_PHOTO_ALT = "ปั้นกับคุณพ่อในวันรับปริญญา";

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
function FatherPhotoSlot() {
  if (!IS_REVIEW_ENVIRONMENT) return null;
  return (
    <figure className={styles.fatherPhoto} data-uat-placeholder="about-father-photo">
      <Image src="/assets/ccpun-father-v5-colour.webp" alt={FATHER_PHOTO_ALT} width={1086} height={1448} sizes="(max-width: 899px) calc(100vw - 40px), 280px" />
      <figcaption>{FATHER_PHOTO_CAPTION.split("\n").map((line, index) => <span key={line}>{index > 0 ? <br /> : null}{keepFatherPhrase(line)}</span>)}</figcaption>
    </figure>
  );
}

/** Match the existing licence-card `keep` mechanism without changing the plain text. */
function keepFatherPhrase(value: string) {
  const at = value.indexOf(FATHER_STORY_KEEP);
  if (at < 0) return value;
  return <>{value.slice(0, at)}<span className={flipStyles.keep}>{FATHER_STORY_KEEP}</span>{value.slice(at + FATHER_STORY_KEEP.length)}</>;
}

function FatherStory() {
  if (!IS_REVIEW_ENVIRONMENT) return null;
  return (
    <div className={styles.fatherStory} data-uat-trial="about-father-story">
      <h3>{FATHER_STORY_HEADING}</h3>
      <p>{keepFatherPhrase(FATHER_STORY_PARAGRAPHS[0])}</p>
      <FatherPhotoSlot />
      <div className={styles.fatherStoryBody}>
        {FATHER_STORY_PARAGRAPHS.slice(1, 6).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        <ul>{FATHER_STORY_QUESTIONS.map((question) => <li key={question}>{question}</li>)}</ul>
        <p>{FATHER_STORY_PARAGRAPHS[6]}</p>
      </div>
    </div>
  );
}

export async function renderAboutPage() {
  const [authorProfile, homeCopy, siteCopy] = await Promise.all([getPrimaryAuthorProfile().catch(() => null), getPublicCopy("home"), getPublicCopy("site")]);
  const home = publicCopyText(homeCopy);
  const site = publicCopyText(siteCopy);
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
          { "@type": "ListItem", position: 1, name: "หน้าแรก", item: "https://ccpun.com/" },
          { "@type": "ListItem", position: 2, name: aboutLabel, item: URL },
        ],
      },
    ],
  };

  return (
    <V5Page current="/about/" siteCopy={siteCopy}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
      <section className={styles.hero} aria-labelledby="about-title">
        <div className={shell.inner}>
          <V5Breadcrumbs label={site("site.nav.mainLabel")} items={[{ href: "/", label: "หน้าแรก" }, { label: aboutLabel }]} />
          <div className={styles.heroGrid}>
            <div>
              <h1 id="about-title" className={shell.h1}>{home.node("home.eyebrow2")}</h1>
              <p className={styles.identity}><strong>{displayName}</strong><span>{role}</span></p>
              <OwnerCopySlot slot="about-hero-sentence" note="ประโยคแนะนำตัวของปั้นหนึ่งประโยค (รอข้อความจากเจ้าของ)" />
              <V5CredentialCards className={styles.credentials} qualification={qualification} licenceCards={licenceCards} />
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

      <section className={shell.section} aria-labelledby="about-story">
        <div className={`${shell.inner} ${styles.split}`}>
          <h2 id="about-story" className={shell.h2}>{home.node("home.h2")}</h2>
          <div className={styles.story}>
            <OwnerCopySlot slot="about-start-years" note="ปีที่เริ่มงานการเงินและการลงทุน และปีที่เริ่มเป็นที่ปรึกษา (รอข้อมูลจากเจ้าของ)" />
            <p>{home.node("home.p")}</p>
            <FatherStory />
            <p>{home.node("home.p2")}</p>
            <p>{home.node("home.p3")}</p>
          </div>
        </div>
      </section>

      <section className={shell.sectionAlt} aria-labelledby="about-partners">
        <div className={shell.inner}>
          <h2 id="about-partners" className={shell.h2}>{home.node("home.partnerLabel")}</h2>
          <ul className={styles.partners}>
            {partners.map((partner) => (
              <li className={styles.partner} key={partner.name}>
                <Image src={partner.src} alt={partner.name} width={partner.width} height={partner.height} sizes="120px" loading="lazy" />
                <strong>{partner.name}</strong><span>{partner.role}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={shell.section} aria-labelledby="about-reviews">
        <div className={shell.inner}>
          <h2 id="about-reviews" className={shell.h2}>{home.node("home.website43Hometitle2")}</h2>
          <div className={styles.quotes}>
            <figure className={styles.quote}><blockquote>{home.node("home.blockquote")}</blockquote><figcaption>{home.node("home.cite")}</figcaption></figure>
            <figure className={styles.quote}><blockquote>{home.node("home.blockquote2")}</blockquote><figcaption>{home.node("home.cite2")}</figcaption></figure>
          </div>
          <div className={styles.next}>
            <Link className={shell.textLink} href="/blog/">{v5Label(home("home.toolCtaAction"))}</Link>
            <Link className={shell.textLink} href={V5_TOOLS_HUB.href}>{V5_TOOLS_HUB.label}</Link>
          </div>
        </div>
      </section>
    </V5Page>
  );
}

export default function AboutPage() {
  return renderAboutPage();
}
