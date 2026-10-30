import Image from "next/image";
import Link from "next/link";
import { getPublicCopy } from "@/lib/content/public-copy";
import { getHomeCopyFaqs, publicCopyText, type PublicCopyValues } from "@/lib/content/public-copy-registry";
import { v5AdvisorProfile, v5Partners } from "@/components/layout/v5/advisor-profile";
import { HOME_CORE_GUIDE_SLUGS } from "@/lib/content/topic-navigation";
import type { Article, ArticleAuthorProfile } from "@/lib/content/types";
import V5Page from "@/components/layout/v5/V5Page";
import shell from "@/components/layout/v5/V5.module.css";
import { V5_HORIZONTAL_CARD_SIZES, V5ArticleCard, V5SectionHeading, v5CardGridSizes, v5Label } from "@/components/layout/v5/V5Primitives";
import V5CredentialCards from "@/components/layout/v5/V5CredentialCards";
import { IS_REVIEW_ENVIRONMENT } from "@/lib/deployment-environment";
import { newestFirst, toV5Cards } from "@/components/layout/v5/article-card-data";
import { getPublishedArticles, getShellTopics } from "@/components/layout/v5/shell-data";
import { V5_TOOLS_HUB } from "@/components/layout/v5/constants";
import V5HealthHappyCountdown from "@/components/layout/v5/V5HealthHappyCountdown";
import protectionGapIcon from "../../../public/assets/website-43/icon-protection-gap.svg";
import taxIcon from "../../../public/assets/website-43/icon-tax.svg";
import investmentRiskIcon from "../../../public/assets/website-43/icon-investment-risk.svg";
import styles from "./V5Home.module.css";

async function readArticles(): Promise<Article[]> {
  try { return await getPublishedArticles(); } catch { return []; }
}

/**
 * v5 homepage (FigCraft 01, UAT prototype). Copy comes from the existing home/site
 * registry keys; owner-input copy stays the current live text. Adds the permanent
 * "core guides" block and topic links (internal-linking plan T01).
 */
export default async function V5Home({ authorProfile = null, copy = {}, faqs = getHomeCopyFaqs(copy), siteCopy }: { authorProfile?: ArticleAuthorProfile | null; copy?: PublicCopyValues; faqs?: readonly { question: string; answer: string }[]; siteCopy?: PublicCopyValues }) {
  const text = publicCopyText(copy);
  const [articles, topics, liveSiteCopy] = await Promise.all([readArticles(), getShellTopics(), siteCopy ? Promise.resolve(siteCopy) : getPublicCopy("site")]);
  const siteText = publicCopyText(liveSiteCopy);

  const { qualifications, primary, displayName, role, qualification, licenceCards } = v5AdvisorProfile(authorProfile, text);

  const pains = [
    [protectionGapIcon, text("home.painsText"), text("home.painsText2")],
    [taxIcon, text("home.painsText3"), text("home.painsText4")],
    [investmentRiskIcon, text("home.painsText5"), text("home.painsText6")],
  ] as const;
  const partners = v5Partners(text);
  const tools = [
    { href: "/blog/", title: text("home.h3"), body: text("home.p4"), action: v5Label(text("home.toolCtaAction")), label: text("home.website43Homearialabel") },
    { href: "/tools/financial-health-check/", title: text("home.h32"), body: text("home.p5"), action: v5Label(text("home.toolCtaAction2")), label: text("home.website43Homearialabel2") },
    { href: "/ci-planning/", title: text("home.h33"), body: text("home.p6"), action: v5Label(text("home.toolCtaAction2")), label: text("home.website43Homearialabel3") },
    { href: "/play/money-story/", title: siteText("site.tools.moneyStory"), body: text("home.moneyStory.description"), action: v5Label(text("home.toolCtaAction2")), label: siteText("site.tools.moneyStory") },
  ];
  const coreGuides = toV5Cards(HOME_CORE_GUIDE_SLUGS.map((slug) => articles.find((article) => article.slug === slug)).filter((article): article is Article => Boolean(article)), {});
  const latest = toV5Cards(newestFirst(articles).slice(0, 3), {});

  return (
    <V5Page current="/" siteCopy={siteCopy}>
      <section id="home" className={styles.hero} aria-labelledby="home-hero-title">
        <div className={`${shell.inner} ${styles.heroGrid}`}>
          <div className={styles.heroCopy}>
            <h1 id="home-hero-title" className={styles.heroTitle}>{text.node("home.hero.titleBefore")}<em>{text.node("home.hero.titleEmphasis")}</em>{text.node("home.hero.titleAfter")}</h1>
            <p className={styles.heroBody}>{text.node("home.hero.eyebrow")} {text.node("home.hero.description")}</p>
            <div className={shell.buttonRow}>
              <Link className={shell.buttonOutline} href="#about-ccpun">{text.node("home.hero.aboutCta")}</Link>
            </div>
            <V5CredentialCards className={IS_REVIEW_ENVIRONMENT ? `${styles.credentials} ${styles.staticCredentials}` : styles.credentials} qualification={qualification} licenceCards={licenceCards} compact />
          </div>
          <div className={styles.portrait}>
            <Image src="/assets/website-v5/home-hero-white-outline-8e7f5dc2.png" alt={text("home.website43Homealt")} fill preload loading="eager" fetchPriority="high" sizes="(max-width: 767px) calc(100vw - 40px), (max-width: 1023px) calc(100vw - 64px), (max-width: 1199px) calc(50vw - 56px), (max-width: 1439px) calc(50vw - 104px), 616px" />
            <div className={styles.portraitBadge} data-home-profile-badge><strong>{displayName}</strong><span>{role}</span></div>
          </div>
        </div>
      </section>

      <div className={styles.countdownFrame}><V5HealthHappyCountdown placement="home" /></div>

      <section className={`${shell.section} ${styles.homeSection} ${styles.painsSection}`} aria-labelledby="home-pains">
        <div className={shell.inner}>
          <V5SectionHeading id="home-pains" title={text.node("home.website43Hometitle")} description={text.node("home.website43Homedescription")} />
          <div className={styles.cards3}>
            {pains.map(([icon, title, body]) => (
              <article className={styles.painCard} key={title}>
                <span className={styles.painIcon}><Image src={icon} alt="" width={24} height={24} /></span>
                <h3>{title}</h3><p>{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <div className={styles.story}>
      <section className={`${shell.section} ${styles.homeSection} ${styles.voicesSection}`} aria-labelledby="home-voices">
        <div className={shell.inner}>
          <V5SectionHeading id="home-voices" title={text.node("home.website43Hometitle2")} />
          <div className={styles.quotes} role="region" aria-labelledby="home-voices" tabIndex={0}>
            <figure className={styles.quote}><blockquote>{text.node("home.blockquote")}</blockquote><figcaption>{text.node("home.cite")}</figcaption></figure>
            <figure className={styles.quote}><blockquote>{text.node("home.blockquote2")}</blockquote><figcaption>{text.node("home.cite2")}</figcaption></figure>
          </div>
        </div>
      </section>

      <section id="about-ccpun" className={`${shell.sectionAlt} ${styles.homeSection} ${styles.aboutSection}`} aria-labelledby="home-about">
        <div className={`${shell.inner} ${styles.about}`}>
          <div className={styles.aboutPortraitFrame}>
            {/* One portrait per theme; the hidden one is display:none and, being lazy, is never fetched. */}
            <Image className={`${styles.aboutPortrait} ${styles.aboutPortraitDark}`} src="/assets/website-v5/home-about-dark-white-outline-70db2c14.png" alt={text("home.website43Homealt8")} width={1248} height={1872} sizes="(max-width: 639px) 72px, 400px" loading="lazy" />
            <Image className={`${styles.aboutPortrait} ${styles.aboutPortraitLight}`} src="/assets/website-v5/home-about-light-white-outline-6d5daba9.png" alt={text("home.website43Homealt8")} width={1248} height={1872} sizes="(max-width: 639px) 72px, 400px" loading="lazy" />
          </div>
          <div>
            <V5SectionHeading id="home-about" title={text.node("home.h2")} />
            {qualifications.length > 0 && <p className={styles.aboutIdentity}><strong>{displayName}</strong><span>{role}{primary?.identifier ? text("home.advisor.qualificationPrefix") + primary.identifier : ""}</span></p>}
            <div className={styles.aboutCopy}><p>{text.node("home.p")}</p><p>{text.node("home.p2")}</p><p>{text.node("home.p3")}</p></div>
            <p className={styles.advisorNote}>{text.node("home.advisorNote")}</p>
            <p><Link className={shell.textLink} href="/about/">{text.node("home.hero.aboutCta")}</Link></p>
          </div>
        </div>
      </section>

      <section className={`${shell.sectionAlt} ${styles.homeSection} ${styles.partnerStrip}`} aria-labelledby="home-partners">
        <div className={shell.inner}>
          <h2 id="home-partners" className={shell.h3}>{text.node("home.partnerLabel")}</h2>
          <ul className={styles.partners} tabIndex={0} aria-labelledby="home-partners">
            {partners.map((partner) => (
              <li className={styles.partner} key={partner.name}>
                <Image src={partner.src} alt={partner.name} width={partner.width} height={partner.height} sizes="120px" loading="lazy" />
                <strong>{partner.name}</strong><span>{partner.role}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
      </div>

      <section className={`${shell.section} ${styles.homeSection} ${styles.learningSection}`} data-uat-section="home-learning" aria-labelledby="home-start">
        <div className={shell.inner}>
          <V5SectionHeading id="home-start" title={text.node("home.website43Hometitle4")} description={text.node("home.website43Homedescription3")} />
          <div className={styles.tools}>
            {tools.map((tool) => (
              <div className={styles.toolCard} key={tool.href}>
                <h3><Link href={tool.href} aria-label={tool.label}>{tool.title}</Link></h3>
                <p>{tool.body}</p>
                <span aria-hidden="true">{tool.action}</span>
              </div>
            ))}
          </div>
          <p><Link className={shell.textLink} href={V5_TOOLS_HUB.href}>ดูเครื่องมือทั้งหมด</Link></p>

          {coreGuides.length > 0 && <div className={styles.coreGuides} aria-labelledby="home-core-guides" role="region">
            <h2 id="home-core-guides" className={shell.h2}>{text.node("home.coreGuides.title")}</h2>
            <div className={styles.guides}>
              {coreGuides.map((card) => <V5ArticleCard key={card.id} article={card} horizontal className={styles.guideCard} sizes={`(max-width: 639px) 104px, ${V5_HORIZONTAL_CARD_SIZES}`} />)}
            </div>
            {topics.length > 0 && <>
              <p className={styles.topicsLabel}>{siteText.node("site.nav.topics")}</p>
              <ul className={shell.chips}>{topics.map((topic) => <li key={topic.slug}><Link className={shell.chip} href={topic.href}>{topic.title}</Link></li>)}</ul>
            </>}
          </div>}
        </div>
      </section>

      {latest.length > 0 && <section className={`${shell.section} ${styles.homeSection} ${styles.latestSection}`} aria-labelledby="home-latest">
        <div className={shell.inner}>
          <div className={shell.headingRow}>
            <h2 id="home-latest" className={shell.h2}>{text.node("home.latest.title")}</h2>
            <Link className={shell.textLink} href="/blog/">{v5Label(text("home.toolCtaAction"))}</Link>
          </div>
          <div className={`${shell.cardGrid} ${styles.latestTrack}`} role="region" aria-labelledby="home-latest" tabIndex={0}>{latest.map((card) => <V5ArticleCard key={card.id} article={card} className={styles.latestCard} sizes={`(max-width: 639px) 104px, ${v5CardGridSizes(latest.length)}`} />)}</div>
        </div>
      </section>}

      <section className={`${shell.sectionAlt} ${styles.homeSection} ${styles.faqSection}`} id="faq" data-uat-section="home-faq" aria-labelledby="home-faq-title">
        <div className={`${shell.inner} ${styles.faq}`}>
          <div>
            <V5SectionHeading id="home-faq-title" title={text.node("home.website43Hometitle5")} />
          </div>
          <div className={styles.faqList}>
            {faqs.map(({ question, answer }) => <details className={styles.faqItem} key={question}><summary>{question}</summary><p>{answer}</p></details>)}
          </div>
        </div>
      </section>
    </V5Page>
  );
}
