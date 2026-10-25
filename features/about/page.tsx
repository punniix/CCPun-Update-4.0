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
import { V5_TOOLS_HUB } from "@/components/layout/v5/constants";
import styles from "./About.module.css";

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

export async function renderAboutPage() {
  const [authorProfile, homeCopy, siteCopy] = await Promise.all([getPrimaryAuthorProfile().catch(() => null), getPublicCopy("home"), getPublicCopy("site")]);
  const home = publicCopyText(homeCopy);
  const site = publicCopyText(siteCopy);
  const { displayName, role, credentials } = v5AdvisorProfile(authorProfile, home);
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
      { "@type": "Person", "@id": CCPUN_PERSON_ID, name: personSchema.name, image: "https://ccpun.com/assets/ccpun.webp" },
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
              <dl className={styles.credentials}>
                {credentials.map((item) => <div key={item.term + item.detail}><dt>{item.term}</dt>{item.detail ? <dd>{item.detail}</dd> : null}</div>)}
              </dl>
            </div>
            <Image className={styles.portrait} src="/assets/ccpun.webp" alt={home("home.website43Homealt8")} width={1200} height={1800} sizes="(max-width: 899px) calc(100vw - 40px), 440px" preload loading="eager" fetchPriority="high" />
          </div>
        </div>
      </section>

      <section className={shell.section} aria-labelledby="about-story">
        <div className={`${shell.inner} ${styles.split}`}>
          <h2 id="about-story" className={shell.h2}>{home.node("home.h2")}</h2>
          <div className={styles.story}>
            <OwnerCopySlot slot="about-start-years" note="ปีที่เริ่มงานการเงินและการลงทุน และปีที่เริ่มเป็นที่ปรึกษา (รอข้อมูลจากเจ้าของ)" />
            <p>{home.node("home.p")}</p>
            <OwnerCopySlot slot="about-father-story" note="เรื่องคุณพ่อและเหตุผลที่ช่วยคนเรื่องค่ารักษาพยาบาลและความมั่นคงทางการเงิน (รอข้อความจากเจ้าของ)" />
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
