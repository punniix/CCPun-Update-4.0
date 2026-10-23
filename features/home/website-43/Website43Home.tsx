import { getHomeCopyFaqs, publicCopyText, type PublicCopyValues } from "@/lib/content/public-copy-registry";
import { getPublicAuthorName } from "@/lib/content/author-identity";
import { Fragment } from "react";
import phillipLogo from "../../../public/assets/phillip-logo.svg";
import protectionGapIcon from "../../../public/assets/website-43/icon-protection-gap.svg";
import taxIcon from "../../../public/assets/website-43/icon-tax.svg";
import investmentRiskIcon from "../../../public/assets/website-43/icon-investment-risk.svg";

import Image from 'next/image';
import Link from 'next/link';
import styles from '@/components/layout/website-43/Website43.module.css';
import { Website43Navbar } from '@/components/layout/website-43/Website43Shared';
import { HomeFooter, HomeSectionHeading } from './Website43HomeStatic';
import { WEBSITE43_BASE as BASE } from '@/components/layout/website-43/constants';
import type { ArticleAuthorProfile } from '@/lib/content/types';
import HealthHappyCountdown from '@/components/ui/health-happy/HealthHappyCountdown';

export default function Website43Home({ authorProfile = null, copy = {}, faqs = getHomeCopyFaqs(copy), siteCopy }: { authorProfile?: ArticleAuthorProfile | null; copy?: PublicCopyValues; faqs?: readonly { question: string; answer: string }[]; siteCopy?: PublicCopyValues }) {
  const text = publicCopyText(copy);
const DEFAULT_AUTHOR_ROLE = text("home.advisor.defaultRole");

const pains = [
  [protectionGapIcon, text("home.painsText"), text("home.painsText2")],
  [taxIcon, text("home.painsText3"), text("home.painsText4")],
  [investmentRiskIcon, text("home.painsText5"), text("home.painsText6")],
] as const;

const steps = [
  ['01', text("home.stepsText"), text("home.stepsText2")],
  ['02', text("home.stepsText3"), text("home.stepsText4")],
  ['03', text("home.stepsText5"), text("home.stepsText6")],
  ['04', text("home.stepsText7"), text("home.stepsText8")],
] as const;


  const professionalQualifications = authorProfile?.professionalQualifications ?? [];
  const primaryQualification = professionalQualifications[0];
  const qualificationSuffix = professionalQualifications.map((qualification) => qualification.shortName.trim()).filter(Boolean).join(', ');
  const profileName = getPublicAuthorName(authorProfile);
  const profileRole = authorProfile?.profileRole?.trim() || DEFAULT_AUTHOR_ROLE;
  const displayName = qualificationSuffix ? `${profileName}, ${qualificationSuffix}` : profileName;
  const qualificationIdentifier = primaryQualification?.identifier?.trim();
  const showManagedIdentity = professionalQualifications.length > 0;
  const licenseLabels = authorProfile?.professionalLicenses?.length
    ? authorProfile.professionalLicenses.map(({ name, identifier }) => name.trim() + " " + identifier.trim())
    : [
      text("home.licenseLabelsText"),
      text("home.licenseLabelsText2"),
      text("home.licenseLabelsText3"),
    ];

  return (
    <div className={styles.root}>
      <main>
        <section id="home" className={styles.homeHero} aria-labelledby="home-hero-title">
          <div className={styles.homeHeroPicture}><Image src="/assets/website-43/home-hero-desktop.png" alt={text("home.website43Homealt")} fill preload loading="eager" fetchPriority="high" sizes="100vw" /></div>
          <div className={styles.homeHeroGradient} aria-hidden="true" /><div className={styles.homeHeroBottomGradient} aria-hidden="true" /><Website43Navbar overlay />
          <div id="main-content" tabIndex={-1} className={styles.homeHeroCopy}>
            <p className={styles.eyebrow}>{text("home.hero.eyebrow")}</p>
            <h1 id="home-hero-title" className={styles.homeHeroTitle}>{text("home.hero.titleBefore")}<span className={styles.homeHeroWord}>{text("home.hero.titleEmphasis")}</span>{text("home.hero.titleAfter")}</h1>
            <p className={styles.homeHeroBody}>{text("home.hero.description")}</p>
            <div className={styles.heroActions}><Link className={styles.primaryButton} href="#about-ccpun">{text("home.hero.aboutCta")}</Link><a className={styles.outlineButton} href="https://lin.ee/tqLCs4f" target="_blank" rel="noopener noreferrer" data-analytics-location="home_hero">{text("home.contactCta")}</a></div>
            <p className={styles.heroProof}>{text("home.heroProof")}</p>
          </div>
        </section>

        <HealthHappyCountdown placement="home" />

        <section className={`${styles.sectionDeep} ${styles.sectionTopLarge} ${styles.sectionBottomLarge}`}><div className={styles.inner}>
          <HomeSectionHeading eyebrow={text("home.website43Homeeyebrow")} title={text("home.website43Hometitle")} description={text("home.website43Homedescription")} />
          <div className={styles.threeCols}>{pains.map(([icon,title,body]) => <article className={styles.editorialCard} key={title}><Image className={styles.editorialCardIcon} src={icon} alt="" width={24} height={24} aria-hidden="true" /><h3 className={styles.cardTitle}>{title}</h3><p className={styles.cardBody}>{body}</p></article>)}</div>
        </div></section>

        <section className={`${styles.section} ${styles.trustSection}`}><div className={styles.inner}>
          <div className={styles.stats}><div className={styles.stat}><strong>{text("home.strong")}</strong><span>{text("home.span")}</span></div><div className={styles.stat}><strong>{text("home.strong2")}</strong><span>{text("home.span2")}</span></div><div className={styles.stat}><strong>{text("home.strong3")}</strong><span>{text("home.span3")}</span></div></div>
          <p className={styles.license}>{licenseLabels.map((label, index) => (
            <Fragment key={label}>
              {index > 0 ? <span className={styles.licenseSeparator} aria-hidden="true"> · </span> : null}
              <span>{index === 0 ? text("home.website43HomeText") : ""}{label}</span>
            </Fragment>
          ))}</p>
          <p className={styles.partnerLabel}>{text("home.partnerLabel")}</p>
          <div className={styles.partners} ><div className={styles.partner}><div className={`${styles.partnerLogoFrame} ${styles.partnerLogoFrameStandard}`}><Image className={`${styles.partnerLogo} ${styles.partnerLogoStandard}`} src="/assets/aia-logo.webp" alt={text("home.website43Homealt2")} width={512} height={341} /></div><strong>{text("home.website43Homealt2")}</strong><span>{text("home.span4")}</span></div><div className={styles.partner}><div className={`${styles.partnerLogoFrame} ${styles.partnerLogoFrameFairdee}`}><Image className={`${styles.partnerLogo} ${styles.partnerLogoFairdee}`} src="/assets/website-43/fairdee-logo.png" alt={text("home.website43Homealt3")} width={512} height={512} /></div><strong>{text("home.website43Homealt3")}</strong><span>{text("home.span5")}</span></div><div className={styles.partner}><div className={`${styles.partnerLogoFrame} ${styles.partnerLogoFrameStandard}`}><Image className={`${styles.partnerLogo} ${styles.partnerLogoStandard}`} src="/assets/maybank-logo.webp" alt={text("home.website43Homealt4")} width={512} height={512} /></div><strong>{text("home.website43Homealt4")}</strong><span>{text("home.span6")}</span></div><div className={styles.partner}><div className={`${styles.partnerLogoFrame} ${styles.partnerLogoFrameStandard}`}><Image className={`${styles.partnerLogo} ${styles.partnerLogoStandard}`} src={phillipLogo} alt={text("home.website43Homealt5")} width={1000} height={400} /></div><strong>{text("home.website43Homealt5")}</strong><span>{text("home.span6")}</span></div><div className={styles.partner}><div className={`${styles.partnerLogoFrame} ${styles.partnerLogoFrameWebull}`}><Image className={`${styles.partnerLogo} ${styles.partnerLogoWebull}`} src="/assets/website-43/webull-logo.png" alt={text("home.website43Homealt6")} width={736} height={736} /></div><strong>{text("home.website43Homealt6")}</strong><span>{text("home.span7")}</span></div><div className={styles.partner}><div className={`${styles.partnerLogoFrame} ${styles.partnerLogoFrameStandard}`}><Image className={`${styles.partnerLogo} ${styles.partnerLogoStandard}`} src="/assets/finnomena-logo.webp" alt={text("home.website43Homealt7")} width={200} height={200} /></div><strong>{text("home.website43Homealt7")}</strong><span>{text("home.span6")}</span></div></div>
        </div></section>

        <section id="about-ccpun" className={styles.about}><div className={styles.aboutInner}><div className={styles.aboutCopy}>
          <p className={styles.eyebrow}>{text("home.eyebrow2")}</p><h2 className={styles.h2}>{text("home.h2")}</h2>
          {showManagedIdentity ? <div className={styles.aboutIdentity}>
            <p className={styles.aboutIdentityName}>{displayName}</p>
            <p className={styles.aboutIdentityMeta}>{profileRole}{qualificationIdentifier ? text("home.advisor.qualificationPrefix") + qualificationIdentifier : ''}</p>
          </div> : null}
          <div className={styles.aboutPortraitStage}><Image className={styles.aboutPortrait} src="/assets/ccpun.webp" alt={text("home.website43Homealt8")} width={400} height={526} sizes="(max-width: 639px) 318px, (max-width: 1023px) 260px, 400px" /></div>
          <div className={styles.aboutParagraphs}><p>{text("home.p")}</p><p>{text("home.p2")}</p><p>{text("home.p3")}</p></div>
          <div className={styles.advisorNote}>{text("home.advisorNote")}</div>
        </div></div></section>

        <section className={styles.section}><div className={styles.inner}><HomeSectionHeading eyebrow={text("home.website43Homeeyebrow2")} title={text("home.website43Hometitle2")} /><div className={styles.voices}><div className={styles.voice}><blockquote>{text("home.blockquote")}</blockquote><cite>{text("home.cite")}</cite></div><div className={styles.voiceDivider} aria-hidden="true" /><div className={styles.voice}><blockquote>{text("home.blockquote2")}</blockquote><cite>{text("home.cite2")}</cite></div></div></div></section>

        <section className={`${styles.sectionDeep} ${styles.sectionTopLarge} ${styles.sectionBottomLarge}`}><div className={styles.inner}><HomeSectionHeading eyebrow={text("home.website43Homeeyebrow3")} title={text("home.website43Hometitle3")} description={text("home.website43Homedescription2")} /><div className={styles.journey}>{steps.map(([number,title,body],index)=><article className={styles.step} key={number}><div className={styles.stepRail}><span className={styles.stepNum}>{number}</span>{index<steps.length-1?<span className={styles.stepLine}/>:null}</div><h3>{title}</h3><p>{body}</p></article>)}</div></div></section>

        <section className={styles.section} data-uat-section="home-learning"><div className={styles.inner}><HomeSectionHeading title={text("home.website43Hometitle4")} description={text("home.website43Homedescription3")} /><div className={styles.learnGrid}>
          <Link className={`${styles.toolCtaCard} ${styles.learnArticleCard}`} href={`${BASE}/blog/`} aria-label={text("home.website43Homearialabel")}>
            <Image src="/assets/website-43/blog-hero.png" alt="" fill sizes="(max-width: 639px) 100vw, 33vw" aria-hidden="true" className={`${styles.toolCtaImage} ${styles.learnArticleImage}`}/>
            <span className={styles.toolCtaOverlay} aria-hidden="true" />
            <span className={styles.toolCtaContent}><span className={styles.planNum}>{text("home.planNum")}</span><h3>{text("home.h3")}</h3><p>{text("home.p4")}</p><span className={styles.toolCtaAction}>{text("home.toolCtaAction")}</span></span>
          </Link>
          <div className={styles.toolCtaGrid}>
            <Link className={styles.toolCtaCard} href={`${BASE}/tools/financial-health-check/`} aria-label={text("home.website43Homearialabel2")}>
              <Image src="/assets/website-43/fhc-hero.png" alt="" fill sizes="(max-width: 639px) 100vw, 25vw" aria-hidden="true" className={styles.toolCtaImage}/>
              <span className={styles.toolCtaOverlay} aria-hidden="true" />
              <span className={styles.toolCtaContent}><span className={styles.planNum}>{text("home.planNum2")}</span><h3>{text("home.h32")}</h3><p>{text("home.p5")}</p><span className={styles.toolCtaAction}>{text("home.toolCtaAction2")}</span></span>
            </Link>
            <Link className={styles.toolCtaCard} href={`${BASE}/ci-planning/`} aria-label={text("home.website43Homearialabel3")}>
              <Image src="/assets/website-43/ci-hero.png" alt="" fill sizes="(max-width: 639px) 100vw, 25vw" aria-hidden="true" className={styles.toolCtaImage}/>
              <span className={styles.toolCtaOverlay} aria-hidden="true" />
              <span className={styles.toolCtaContent}><span className={styles.planNum}>{text("home.planNum2")}</span><h3>{text("home.h33")}</h3><p>{text("home.p6")}</p><span className={styles.toolCtaAction}>{text("home.toolCtaAction2")}</span></span>
            </Link>
          </div>
        </div></div></section>

        <section className={`${styles.section} ${styles.sectionBottomLarge}`} id="faq" data-uat-section="home-faq"><div className={styles.inner}><HomeSectionHeading eyebrow={text("home.website43Homeeyebrow4")} title={text("home.website43Hometitle5")} /><div className={styles.faqList}>{faqs.map(({question,answer})=><details className={styles.faqItem} key={question}><summary className={styles.faqSummary}><span>{question}</span><span className={styles.faqIcon} aria-hidden="true">+</span></summary><p className={styles.faqAnswer}>{answer}</p></details>)}</div><a className={styles.faqCta} href="https://lin.ee/tqLCs4f" target="_blank" rel="noopener noreferrer" data-analytics-location="home_faq">{text("home.contactCta")}</a></div></section>

      </main>
      <HomeFooter warnings copy={siteCopy} />
    </div>
  );
}
